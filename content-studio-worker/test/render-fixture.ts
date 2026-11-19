import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, capture } from '../src/process.ts';
import { renderVideo } from '../src/renderer.ts';
import { request } from './helpers.ts';

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
try {
  await run(ffmpeg, ['-version']);
  await run(ffprobe, ['-version']);
} catch {
  console.error('Fixture render requires local ffmpeg and ffprobe. Install FFmpeg, then rerun npm run render:test.');
  process.exit(1);
}

const directory = await mkdtemp(join(tmpdir(), 'quobby-render-fixture-'));
try {
  const source = join(directory, 'recording.mp4');
  const voice = join(directory, 'voice.wav');
  // A deterministic, owned 2-second fixture avoids bundling copyrighted media.
  await run(ffmpeg, ['-hide_banner', '-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=0x5f4bba:s=320x240:r=30:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', source]);
  await run(ffmpeg, ['-hide_banner', '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', '-c:a', 'pcm_s16le', voice]);
  const input = request();
  input.assets[0].path = source;
  input.voicePath = voice;
  input.outputDirectory = join(directory, 'render');
  const result = await renderVideo(input);
  const probe = JSON.parse(await capture(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', result.outputPath])) as {
    streams: { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string }[];
    format: { duration: string };
  };
  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
  assert.equal(video?.codec_name, 'h264');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1920);
  assert.equal(video.r_frame_rate, '30/1');
  assert.equal(audio?.codec_name, 'aac');
  assert.ok(Math.abs(Number(probe.format.duration) - 15) < 0.2);
  console.log('Fixture passed: H.264/AAC, 1080×1920, 30fps, video and audio streams.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
