import test from 'node:test';
import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Worker } from '../src/worker.ts';
import { AmbiguousUploadError, ControlPlaneError, type WorkerClient, type ClaimedJob } from '../src/client.ts';
import { renderJob } from './worker-helpers.ts';
import { SocialError } from '../src/social/types.ts';

function client(job: ClaimedJob | null, calls: string[] = []): WorkerClient {
  return {
    heartbeat: async () => { calls.push('heartbeat'); }, claim: async () => { calls.push('claim'); return job; },
    downloadAsset: async (_job, path) => { calls.push('download'); await writeFile(path, 'source'); return { path, mimeType: 'video/mp4', signedUrl: 'https://storage.example/output' }; },
    uploadOutput: async () => { calls.push('upload'); return `renders/${renderJob().id}/output.mp4`; },
    completeRender: async () => { calls.push('completeRender'); }, completePublication: async () => { calls.push('completePublication'); },
    failJob: async () => { calls.push('failJob'); },
  };
}
test('worker reports heartbeat before claiming one job', async () => {
  const calls: string[] = [];
  assert.equal(await new Worker(client(null, calls)).runOnce(), false);
  assert.deepEqual(calls, ['heartbeat', 'claim']);
});
test('render success uploads and completes before deleting its temporary directory', async () => {
  const calls: string[] = []; let directory = '';
  const worker = new Worker(client(renderJob(), calls), {
    synthesizeVoice: async ({ outputDirectory }) => { directory = outputDirectory; calls.push('voice'); return join(directory, 'voice.wav'); },
    renderVideo: async (request) => { assert.equal(request.assets[0].mimeType, 'video/mp4'); assert.equal(request.spec.title, 'Study with Quobby'); calls.push('render'); return { outputPath: join(directory, 'output.mp4'), durationMs: 15000 }; },
  });
  assert.equal(await worker.runOnce(), true);
  assert.deepEqual(calls.filter((item) => item !== 'heartbeat'), ['claim', 'download', 'voice', 'render', 'upload', 'completeRender']);
  await assert.rejects(access(directory), { code: 'ENOENT' });
});
test('meme renders skip voice synthesis and pass no voice file to the renderer', async () => {
  const calls: string[] = []; const job = renderJob();
  job.render_spec = { ...job.render_spec, templateId: 'meme-classic', voiceText: '' };
  const worker = new Worker(client(job, calls), {
    synthesizeVoice: async () => { calls.push('voice'); return '/tmp/voice.wav'; },
    renderVideo: async (request) => { assert.equal(request.voicePath, null); calls.push('render'); return { outputPath: join(request.outputDirectory, 'output.mp4'), durationMs: 12000 }; },
  });
  assert.equal(await worker.runOnce(), true);
  assert.deepEqual(calls.filter((item) => item !== 'heartbeat'), ['claim', 'download', 'render', 'upload', 'completeRender']);
});
test('render failure reports only a safe summary and removes its temporary directory', async () => {
  const calls: string[] = []; let directory = ''; const api = client(renderJob(), calls);
  api.failJob = async (_job, code, message) => { assert.equal(code, 'render-failed'); assert.equal(message, 'Local rendering failed. Check the Mac worker setup.'); calls.push('failJob'); };
  const worker = new Worker(api, {
    synthesizeVoice: async ({ outputDirectory }) => { directory = outputDirectory; throw new Error('secret-token /Users/private https://signed?token=x'); },
  });
  assert.equal(await worker.runOnce(), true); assert.ok(calls.includes('failJob')); assert.ok(!calls.includes('upload'));
  await assert.rejects(access(directory), { code: 'ENOENT' });
});
test('lost completion responses propagate without changing completed work to failed', async () => {
  let failed = false; const api = client(renderJob());
  api.completeRender = async () => { throw new ControlPlaneError(503, 'Control plane unavailable.'); };
  api.failJob = async () => { failed = true; };
  const worker = new Worker(api, { synthesizeVoice: async () => '/tmp/voice', renderVideo: async () => ({ outputPath: '/tmp/output', durationMs: 15000 }) });
  await assert.rejects(worker.runOnce(), ControlPlaneError); assert.equal(failed, false);
});
test('an ambiguous output upload is left for lease recovery instead of failing the render', async () => {
  let failed = false; const api = client(renderJob());
  api.uploadOutput = async () => { throw new AmbiguousUploadError(); };
  api.failJob = async () => { failed = true; };
  const worker = new Worker(api, { synthesizeVoice: async () => '/tmp/voice', renderVideo: async () => ({ outputPath: '/tmp/output', durationMs: 15000 }) });
  await assert.rejects(worker.runOnce(), AmbiguousUploadError);
  assert.equal(failed, false);
});
test('publication jobs delegate the rendered media and complete only a public success', async () => {
  const calls: string[] = []; const job: ClaimedJob = { ...renderJob(), kind: 'publication', platform: 'youtube', copy_json: { title: 'Quobby', caption: 'Study', hashtags: [] }, output_path: `renders/${renderJob().id}/output.mp4` };
  const worker = new Worker(client(job, calls), { publishPublication: async ({ job: claimed, videoPath, signedUrl }) => {
    assert.equal(claimed.platform, 'youtube'); await access(videoPath); assert.equal(signedUrl, 'https://storage.example/output'); calls.push('publish');
    return { externalId: 'yt-1', publicUrl: 'https://youtube.com/watch?v=yt-1', published: true };
  } });
  await worker.runOnce(); assert.deepEqual(calls.filter((item) => item !== 'heartbeat'), ['claim', 'download', 'publish', 'completePublication']);
  const restrictedCalls: string[] = [];
  await new Worker(client(job, restrictedCalls), { publishPublication: async () => ({ externalId: 'private-1', published: false, visibility: 'private' }) }).runOnce();
  assert.ok(restrictedCalls.includes('failJob')); assert.ok(!restrictedCalls.includes('completePublication'));
});
test('forever polling backs off for outages, resets after success, and stops when aborted', async () => {
  const controller = new AbortController(); const delays: number[] = []; const api = client(null); let attempt = 0;
  api.heartbeat = async () => { attempt++; if (attempt <= 7 || attempt === 9) throw new ControlPlaneError(503, 'Unavailable'); };
  await new Worker(api, { sleep: async (ms) => { delays.push(ms); if (delays.length === 9) controller.abort(); } }).runForever(controller.signal);
  assert.deepEqual(delays, [15000, 30000, 60000, 120000, 240000, 300000, 300000, 15000, 15000]);
});

test('publication failures distinguish provider action, resumable processing, and uncertain submission', async () => {
  const job: ClaimedJob = { ...renderJob(), kind: 'publication', platform: 'youtube', copy_json: { title: 'Quobby', caption: 'Study', hashtags: [] }, output_path: `renders/${renderJob().id}/output.mp4` };
  for (const kind of ['retryable', 'action-required', 'uncertain'] as const) {
    const api = client(job); let reported = '';
    api.failJob = async (_job, code, message) => { reported = code; assert.equal(message, 'Safe provider summary.'); };
    await new Worker(api, { publishPublication: async () => { throw new SocialError(kind, 'Safe provider summary.'); } }).runOnce();
    assert.equal(reported, `publication-${kind}`);
  }
});
