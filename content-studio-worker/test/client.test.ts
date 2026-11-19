import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AmbiguousUploadError, ContentStudioClient, ControlPlaneError } from '../src/client.ts';
import { renderJob } from './worker-helpers.ts';

const config = { baseUrl: 'https://qurator.example', machineId: 'mac-one', machineToken: 'secret-token', version: '0.1.0' };
test('client uses internal API payloads and authentication without leaking secrets to signed transfers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-client-test-'));
  const calls: { url: string; init: RequestInit }[] = [];
  const client = new ContentStudioClient(config, async (input, init = {}) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes('/api/internal/')) {
      assert.equal(new Headers(init.headers).get('x-content-studio-machine-token'), 'secret-token');
      assert.ok(init.signal);
      const body = JSON.parse(String(init.body)); assert.equal(body.machineId, 'mac-one');
      if (url.endsWith('/claim')) return Response.json({ job: renderJob() });
      if (url.endsWith('/assets')) return Response.json(body.action === 'upload' ? { path: `renders/${renderJob().id}/output.mp4`, signedUrl: 'https://storage.example/upload?token=private' } : { signedUrl: 'https://storage.example/download?token=private' });
      if (url.includes('/renders/')) assert.deepEqual(body.status === 'review' ? body : { status: body.status, errorCode: body.errorCode }, body.status === 'review' ? { machineId: 'mac-one', status: 'review', outputPath: `renders/${renderJob().id}/output.mp4`, durationMs: 15000 } : { status: 'failed', errorCode: 'render-failed' });
      if (url.includes('/publications/')) assert.deepEqual(body, { machineId: 'mac-one', status: 'published', externalPostId: 'post-1', publicUrl: 'https://social.example/post-1' });
      return Response.json({ ok: true });
    }
    assert.equal(new Headers(init.headers).get('x-content-studio-machine-token'), null);
    assert.equal(init.redirect, 'error');
    if (init.method === 'PUT') assert.equal(new Headers(init.headers).get('x-upsert'), 'true');
    return new Response(init.method === 'PUT' ? '' : 'video-bytes', { headers: { 'content-type': 'video/mp4' } });
  });
  try {
    await client.heartbeat(null);
    const job = await client.claim(); assert.equal(job?.kind, 'render');
    const local = await client.downloadAsset(renderJob(), join(directory, 'source'), renderJob().render_spec.sourceAssetIds[0]);
    assert.equal(local.mimeType, 'video/mp4'); assert.equal(await readFile(local.path, 'utf8'), 'video-bytes');
    const output = join(directory, 'output.mp4'); await writeFile(output, 'output-bytes');
    assert.equal(await client.uploadOutput(renderJob(), output), `renders/${renderJob().id}/output.mp4`);
    await client.completeRender(renderJob().id, `renders/${renderJob().id}/output.mp4`, 15000);
    await client.completePublication(renderJob().id, { externalId: 'post-1', publicUrl: 'https://social.example/post-1', published: true });
    await client.failJob(renderJob(), 'render-failed', 'Local rendering failed.');
    assert.deepEqual(calls.filter(({url}) => url.includes('/api/internal/')).map(({url}) => new URL(url).pathname), [
      '/api/internal/content-studio/heartbeat', '/api/internal/content-studio/claim', '/api/internal/content-studio/assets',
      '/api/internal/content-studio/assets', `/api/internal/content-studio/renders/${renderJob().id}`, `/api/internal/content-studio/publications/${renderJob().id}`, `/api/internal/content-studio/renders/${renderJob().id}`,
    ]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('a claimed meme render is accepted because the template manifest is authoritative', async () => {
  const meme = { ...renderJob(), render_spec: { templateId: 'meme-classic', templateVersion: 1, title: 'Brain freeze during finals', hook: 'POV: you are trying to memorise your notes', cta: 'Use the Quobby flashcards.', voiceText: '', sourceAssetIds: ['44444444-4444-4444-8444-444444444444'] } };
  const job = await new ContentStudioClient(config, async () => Response.json({ job: meme })).claim();
  assert.equal(job?.kind, 'render');
  assert.equal(job?.render_spec.templateId, 'meme-classic');
  // Only own manifest keys are templates: inherited names and non-strings must fail closed.
  for (const templateId of ['unknown-template', 'constructor', '__proto__', ['meme-classic']]) {
    const rejected = { ...meme, render_spec: { ...meme.render_spec, templateId } };
    await assert.rejects(new ContentStudioClient(config, async () => Response.json({ job: rejected })).claim(), /Invalid control-plane response/);
  }
});
test('control-plane errors and malformed claims do not expose response secrets', async () => {
  const client = new ContentStudioClient(config, async () => Response.json({ error: 'secret-token https://storage.example/?token=hidden' }, { status: 503 }));
  await assert.rejects(client.claim(), (error: unknown) => error instanceof ControlPlaneError && error.status === 503 && error.retryable && !error.message.includes('secret'));
  await assert.rejects(new ContentStudioClient(config, async () => Response.json({ job: { kind: 'other', id: '../bad' } })).claim(), /Invalid control-plane response/);
});
test('client rejects signed URL redirects and removes failed or oversized downloads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-client-test-'));
  let mediaCalls = 0;
  const client = new ContentStudioClient(config, async (input) => {
    if (String(input).includes('/api/')) return Response.json({ signedUrl: 'https://storage.example/file' });
    mediaCalls++; return new Response('too-large', { headers: { 'content-type': 'video/mp4', 'content-length': '262144001' } });
  });
  try {
    const path = join(directory, 'asset');
    await assert.rejects(client.downloadAsset(renderJob(), path, renderJob().render_spec.sourceAssetIds[0]), /Media download failed/);
    await assert.rejects(readFile(path), { code: 'ENOENT' }); assert.equal(mediaCalls, 1);
    const unsafe = new ContentStudioClient(config, async () => Response.json({ signedUrl: 'http://external.example/file' }));
    await assert.rejects(unsafe.downloadAsset(renderJob(), path, renderJob().render_spec.sourceAssetIds[0]), /Invalid control-plane response/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('client removes a partially downloaded file after a broken media stream', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-client-test-'));
  let reads = 0;
  const client = new ContentStudioClient(config, async (input) => String(input).includes('/api/')
    ? Response.json({ signedUrl: 'https://storage.example/file' })
    : new Response(new ReadableStream({ pull(controller) { if (reads++ === 0) controller.enqueue(new TextEncoder().encode('partial')); else controller.error(new Error('secret download failure')); } }), { headers: { 'content-type': 'video/mp4' } }));
  try {
    const path = join(directory, 'partial');
    await assert.rejects(client.downloadAsset(renderJob(), path, renderJob().render_spec.sourceAssetIds[0]), { message: 'Media download failed.' });
    await assert.rejects(readFile(path), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('upload rejects absent output without an unhandled stream error', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-client-test-'));
  const client = new ContentStudioClient(config, async () => Response.json({ path: `renders/${renderJob().id}/output.mp4`, signedUrl: 'https://storage.example/upload' }));
  try {
    await assert.rejects(client.uploadOutput(renderJob(), join(directory, 'missing')), { message: 'Media upload failed.' });
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an indeterminate signed output PUT stays recoverable, but a confirmed rejection fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-client-test-'));
  const output = join(directory, 'output.mp4');
  await writeFile(output, 'output-bytes');
  try {
    const ambiguous = new ContentStudioClient(config, async (input, init = {}) => {
      if (String(input).includes('/api/')) return Response.json({ path: `renders/${renderJob().id}/output.mp4`, signedUrl: 'https://storage.example/upload' });
      assert.equal(init.method, 'PUT');
      // Storage may have consumed the object before the connection drops.
      throw new TypeError('connection reset after upload');
    });
    await assert.rejects(ambiguous.uploadOutput(renderJob(), output), AmbiguousUploadError);

    const rejected = new ContentStudioClient(config, async (input) => String(input).includes('/api/')
      ? Response.json({ path: `renders/${renderJob().id}/output.mp4`, signedUrl: 'https://storage.example/upload' })
      : new Response('rejected', { status: 403 }));
    await assert.rejects(rejected.uploadOutput(renderJob(), output), { message: 'Media upload failed.' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
