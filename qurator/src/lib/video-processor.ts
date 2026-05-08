import { fetchFile } from '@ffmpeg/util';

let worker: Worker | null = null;
let loaded = false;
let msgId = 0;
const resolves: Record<number, (v: unknown) => void> = {};
const rejects: Record<number, (e: unknown) => void> = {};
let currentProgressCb: ((p: number) => void) | null = null;
let lastLogs: string[] = [];

export interface VideoSegment {
  blob: Blob;
  startTime: number;
  endTime: number;
  index: number;
}

const MSG = {
  LOAD: 'LOAD',
  EXEC: 'EXEC',
  WRITE_FILE: 'WRITE_FILE',
  READ_FILE: 'READ_FILE',
  DELETE_FILE: 'DELETE_FILE',
  LOG: 'LOG',
  PROGRESS: 'PROGRESS',
  ERROR: 'ERROR',
} as const;

function send(type: string, data: unknown, transfer: Transferable[] = []): Promise<unknown> {
  if (!worker) return Promise.reject(new Error('Worker not initialized'));
  return new Promise((resolve, reject) => {
    const id = msgId++;
    resolves[id] = resolve;
    rejects[id] = reject;
    worker!.postMessage({ id, type, data }, transfer);
  });
}

async function ensureLoaded(): Promise<void> {
  if (loaded && worker) return;

  worker = new Worker('/ffmpeg/worker.js');
  worker.onmessage = ({ data: { id, type, data } }) => {
    switch (type) {
      case MSG.LOAD:
        loaded = true;
        resolves[id]?.(data);
        break;
      case MSG.LOG:
        lastLogs.push((data as { message: string }).message);
        if (lastLogs.length > 50) lastLogs.shift();
        return;
      case MSG.PROGRESS:
        currentProgressCb?.(
          Math.max(0, Math.min(1, (data as { progress: number }).progress)),
        );
        return;
      case MSG.ERROR:
        rejects[id]?.(new Error(String(data)));
        break;
      default:
        resolves[id]?.(data);
        break;
    }
    delete resolves[id];
    delete rejects[id];
  };

  await send(MSG.LOAD, {
    coreURL: `${location.origin}/ffmpeg/ffmpeg-core.js`,
    wasmURL: `${location.origin}/ffmpeg/ffmpeg-core.wasm`,
  });
}

async function writeFile(path: string, data: Uint8Array): Promise<void> {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  await send(MSG.WRITE_FILE, { path, data: new Uint8Array(buf) }, [buf]);
}

async function readFile(path: string): Promise<Uint8Array> {
  const data = await send(MSG.READ_FILE, { path, encoding: 'binary' });
  return new Uint8Array(data as ArrayBuffer);
}

async function deleteFile(path: string): Promise<void> {
  await send(MSG.DELETE_FILE, { path });
}

async function exec(args: string[]): Promise<number> {
  lastLogs = [];
  const code = (await send(MSG.EXEC, { args, timeout: -1 })) as number;
  return code;
}

async function execOrThrow(args: string[]): Promise<void> {
  const code = await exec(args);
  if (code !== 0) {
    const tail = lastLogs.slice(-10).join('\n');
    throw new Error(`Video processing failed (code ${code}).\n${tail}`);
  }
}

function fileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.substring(i) : '.mp4';
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      resolve(el.duration);
      URL.revokeObjectURL(el.src);
    };
    el.onerror = () => {
      URL.revokeObjectURL(el.src);
      reject(new Error('Could not read video metadata'));
    };
    el.src = URL.createObjectURL(file);
  });
}

function compressionArgs(durationSec: number): string[] {
  const targetBytes = 45 * 1024 * 1024;
  const totalBps = Math.floor((targetBytes * 8) / durationSec);
  const vBps = Math.min(Math.floor(totalBps * 0.9), 2_000_000);
  const aBps = Math.min(Math.floor(totalBps * 0.1), 128_000);

  return [
    '-c:v', 'libx264', '-preset', 'ultrafast',
    '-b:v', String(vBps),
    '-c:a', 'aac', '-b:a', String(aBps),
    '-movflags', '+faststart',
  ];
}

async function readAndClean(path: string): Promise<Blob> {
  let raw: Uint8Array;
  try {
    raw = await readFile(path);
  } catch {
    throw new Error(
      'Output file was not created — FFmpeg may have run out of memory. Try splitting into smaller segments.',
    );
  }
  await deleteFile(path);
  if (raw.length === 0) {
    throw new Error('Video processing produced an empty file.');
  }
  return new Blob([new Uint8Array(raw)], { type: 'video/mp4' });
}

export async function compressVideo(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<Blob> {
  await ensureLoaded();
  const dur = await getVideoDuration(file);

  const inName = `in${fileExt(file.name)}`;
  await writeFile(inName, await fetchFile(file));

  currentProgressCb = onProgress ?? null;

  await execOrThrow(['-i', inName, ...compressionArgs(dur), 'out.mp4']);

  const blob = await readAndClean('out.mp4');
  await deleteFile(inName);
  currentProgressCb = null;

  return blob;
}

export async function splitVideo(
  file: File,
  splitPoints: number[],
  compress: boolean,
  onProgress?: (progress: number, label: string) => void,
): Promise<VideoSegment[]> {
  await ensureLoaded();
  const dur = await getVideoDuration(file);

  const inName = `in${fileExt(file.name)}`;
  await writeFile(inName, await fetchFile(file));

  const pts = [0, ...splitPoints.filter(t => t > 0 && t < dur).sort((a, b) => a - b), dur];
  const total = pts.length - 1;
  const results: VideoSegment[] = [];

  for (let i = 0; i < total; i++) {
    const start = pts[i];
    const end = pts[i + 1];
    const segDur = end - start;
    const outName = `s${i}.mp4`;

    currentProgressCb = (p) => {
      onProgress?.((i + p) / total, `Segment ${i + 1} of ${total}`);
    };
    onProgress?.(i / total, `Segment ${i + 1} of ${total}`);

    const args = ['-ss', String(start), '-i', inName, '-t', String(segDur)];

    if (compress) {
      args.push(...compressionArgs(segDur));
    } else {
      args.push('-c', 'copy', '-movflags', '+faststart');
    }

    args.push(outName);
    await execOrThrow(args);

    let blob = await readAndClean(outName);

    if (blob.size > 50 * 1024 * 1024 && !compress) {
      const reInName = `re_s${i}${fileExt(file.name)}`;
      await writeFile(reInName, new Uint8Array(await blob.arrayBuffer()));
      await execOrThrow(['-i', reInName, ...compressionArgs(segDur), `rc${i}.mp4`]);
      blob = await readAndClean(`rc${i}.mp4`);
      await deleteFile(reInName);
    }

    results.push({ blob, startTime: start, endTime: end, index: i });
  }

  await deleteFile(inName);
  currentProgressCb = null;
  return results;
}
