import type { ReadStream } from 'node:fs';
import { open, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { WorkerConfig } from './config.ts';
import { TEMPLATES } from './templates.ts';
import type { RenderSpec } from './types.ts';

export type Platform = 'instagram' | 'tiktok' | 'youtube';
export interface PublicationCopy { title: string; caption: string; hashtags: string[]; privacy?: string }
interface JobFields { id: string; render_id: string; campaign_id: string; render_spec: RenderSpec; output_path: string | null }
export type ClaimedJob = (JobFields & { kind: 'render'; platform: null; copy_json: null }) | (JobFields & { kind: 'publication'; platform: Platform; copy_json: PublicationCopy });
export interface DownloadedAsset { path: string; mimeType: string; signedUrl: string }
export interface PublicationResult { externalId: string; publicUrl?: string; published: boolean; visibility?: string }
export interface WorkerClient {
  heartbeat(currentJobId: string | null): Promise<void>;
  claim(): Promise<ClaimedJob | null>;
  downloadAsset(job: ClaimedJob, destination: string, assetId?: string): Promise<DownloadedAsset>;
  uploadOutput(job: ClaimedJob, path: string): Promise<string>;
  completeRender(id: string, outputPath: string, durationMs: number): Promise<void>;
  completePublication(id: string, result: PublicationResult): Promise<void>;
  failJob(job: ClaimedJob, code: string, message: string): Promise<void>;
}

export class ControlPlaneError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(status: number, message: string) {
    super(message); this.name = 'ControlPlaneError'; this.status = status;
    this.retryable = status === 0 || [408, 425, 429].includes(status) || (status >= 500 && status <= 599);
  }
}

/**
 * A signed Storage PUT can be accepted even when its response is lost. This is
 * intentionally distinct from a non-2xx Storage response: callers must leave
 * an indeterminate PUT to lease recovery so the canonical, scoped upload can
 * be retried without incorrectly marking the render terminally failed.
 */
export class AmbiguousUploadError extends Error {
  constructor() { super('The output upload outcome is unknown. It will be retried safely.'); this.name = 'AmbiguousUploadError'; }
}
const MAX_MEDIA_BYTES = 262144000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'audio/mpeg', 'audio/aac']);
function invalid(): never { throw new ControlPlaneError(502, 'Invalid control-plane response.'); }
function uuid(value: string): string { if (typeof value !== 'string' || !UUID.test(value)) invalid(); return value; }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function signedUrl(value: unknown, baseUrl: string): string {
  if (typeof value !== 'string') invalid();
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local && new URL(baseUrl).protocol === 'http:')) || url.username || url.password || url.hash) invalid();
  return url.href;
}
function claimedJob(value: unknown): ClaimedJob {
  const job = record(value);
  for (const field of ['id', 'render_id', 'campaign_id']) uuid(job[field] as string);
  const spec = record(job.render_spec);
  // The template manifest is the single source of truth: a hardcoded list here
  // silently rejected meme-classic claims and stranded meme renders forever.
  if (typeof spec.templateId !== 'string' || !Object.hasOwn(TEMPLATES, spec.templateId) || !Number.isSafeInteger(spec.templateVersion)
    || !['title', 'hook', 'cta', 'voiceText'].every((key) => typeof spec[key] === 'string') || !Array.isArray(spec.sourceAssetIds) || !spec.sourceAssetIds.length || spec.sourceAssetIds.length > 10) invalid();
  for (const id of spec.sourceAssetIds) uuid(id);
  if (job.kind === 'render') {
    if (job.id !== job.render_id || job.platform !== null || job.copy_json !== null) invalid();
  } else if (job.kind === 'publication') {
    if (!['instagram', 'tiktok', 'youtube'].includes(String(job.platform)) || job.output_path !== `renders/${job.render_id}/output.mp4`) invalid();
    const copy = record(job.copy_json);
    if (typeof copy.title !== 'string' || typeof copy.caption !== 'string' || !Array.isArray(copy.hashtags) || !copy.hashtags.every((tag) => typeof tag === 'string') || (copy.privacy !== undefined && typeof copy.privacy !== 'string')) invalid();
  } else invalid();
  return job as unknown as ClaimedJob;
}

export class ContentStudioClient implements WorkerClient {
  private config: WorkerConfig;
  private fetcher: typeof fetch;
  constructor(config: WorkerConfig, fetcher: typeof fetch = fetch) { this.config = config; this.fetcher = fetcher; }
  private async request(path: string, body: Record<string, unknown>, method = 'POST'): Promise<Record<string, unknown>> {
    if (!/^\/(heartbeat|claim|assets|renders\/[0-9a-f-]{36}|publications\/[0-9a-f-]{36})$/.test(path)) invalid();
    let response: Response;
    try {
      response = await this.fetcher(`${this.config.baseUrl}/api/internal/content-studio${path}`, {
        method, headers: { 'content-type': 'application/json', 'x-content-studio-machine-token': this.config.machineToken },
        body: JSON.stringify({ ...body, machineId: this.config.machineId }), signal: AbortSignal.timeout(30_000), redirect: 'error',
      });
    } catch { throw new ControlPlaneError(0, 'Could not reach the Content Studio control plane.'); }
    let data: unknown;
    try { data = await response.json(); } catch { if (response.ok) invalid(); }
    if (!response.ok) {
      // Parse the body, but never forward arbitrary server text or signed URLs.
      const message = response.status === 401 || response.status === 403 ? 'Content Studio authorization failed.' : response.status === 409 ? 'Content Studio job state changed.' : `Content Studio request failed (${response.status}).`;
      throw new ControlPlaneError(response.status, message);
    }
    return record(data);
  }
  async heartbeat(currentJobId: string | null): Promise<void> {
    if (currentJobId !== null) uuid(currentJobId);
    await this.request('/heartbeat', { version: this.config.version, currentJobId, statusMessage: currentJobId ? 'Working' : 'Ready' });
  }
  async claim(): Promise<ClaimedJob | null> {
    const response = await this.request('/claim', {});
    return response.job === null ? null : claimedJob(response.job);
  }
  async downloadAsset(job: ClaimedJob, destination: string, assetId?: string): Promise<DownloadedAsset> {
    const data = await this.request('/assets', { action: 'download', jobKind: job.kind, jobId: uuid(job.id), ...(assetId ? { assetId: uuid(assetId) } : {}) });
    const url = signedUrl(data.signedUrl, this.config.baseUrl);
    let file: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const response = await this.fetcher(url, { method: 'GET', signal: AbortSignal.timeout(30_000), redirect: 'error' });
      const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!response.ok || !response.body || !mimeType || !MIME_TYPES.has(mimeType) || Number(response.headers.get('content-length')) > MAX_MEDIA_BYTES) throw new Error();
      file = await open(destination, 'wx', 0o600);
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > MAX_MEDIA_BYTES) throw new Error();
        await file.writeFile(chunk);
      }
      if (!size) throw new Error();
      await file.close(); file = undefined;
      return { path: destination, mimeType, signedUrl: url };
    } catch {
      if (file) { await file.close().catch(() => {}); await rm(destination, { force: true }).catch(() => {}); }
      throw new Error('Media download failed.');
    }
  }
  async uploadOutput(job: ClaimedJob, path: string): Promise<string> {
    if (job.kind !== 'render') invalid();
    const data = await this.request('/assets', { action: 'upload', jobKind: 'render', jobId: uuid(job.id) });
    const outputPath = `renders/${job.id}/output.mp4`;
    if (data.path !== outputPath) invalid();
    const url = signedUrl(data.signedUrl, this.config.baseUrl);
    let file: Awaited<ReturnType<typeof open>> | undefined;
    let source: ReadStream | undefined;
    try {
      file = await open(path, 'r');
      const metadata = await file.stat();
      if (!metadata.isFile() || !metadata.size || metadata.size > MAX_MEDIA_BYTES) throw new Error();
      source = file.createReadStream({ autoClose: false });
      // The control plane signs only the leased render's canonical path with
      // upsert permission. Repeat the same explicit option on the signed PUT
      // so a reclaimed render can replace an output uploaded before a lost
      // completion response, without gaining access to any other object.
      const init = { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': String(metadata.size), 'x-upsert': 'true' }, body: Readable.toWeb(source) as ReadableStream<Uint8Array>, duplex: 'half', signal: AbortSignal.timeout(30_000), redirect: 'error' } satisfies RequestInit & { duplex: string };
      let response: Response;
      try {
        response = await this.fetcher(url, init);
      } catch {
        throw new AmbiguousUploadError();
      }
      if (!response.ok) throw new Error();
      return outputPath;
    } catch (error) {
      if (error instanceof AmbiguousUploadError) throw error;
      throw new Error('Media upload failed.');
    }
    finally { source?.destroy(); await file?.close().catch(() => {}); }
  }
  async completeRender(id: string, outputPath: string, durationMs: number): Promise<void> {
    await this.request(`/renders/${uuid(id)}`, { status: 'review', outputPath, durationMs }, 'PATCH');
  }
  async completePublication(id: string, result: PublicationResult): Promise<void> {
    if (!result.published || !result.externalId?.trim()) throw new Error('Publication has not been confirmed.');
    await this.request(`/publications/${uuid(id)}`, { status: 'published', externalPostId: result.externalId, ...(result.publicUrl ? { publicUrl: result.publicUrl } : {}) }, 'PATCH');
  }
  async failJob(job: ClaimedJob, code: string, message: string): Promise<void> {
    await this.request(`/${job.kind === 'render' ? 'renders' : 'publications'}/${uuid(job.id)}`, { status: 'failed', errorCode: code, errorMessage: message }, 'PATCH');
  }
}
