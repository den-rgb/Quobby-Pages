import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishPublication } from '../src/social/publish.ts';
import { classifyPlatformError, SocialContext, SocialError, type SocialDependencies } from '../src/social/types.ts';
import type { PublicationRequest } from '../src/worker.ts';
import { renderJob } from './worker-helpers.ts';

let videoDirectory = ''; let fixtureVideo = '';
before(async () => { videoDirectory = await mkdtemp(join(tmpdir(), 'quobby-tiktok-test-')); fixtureVideo = join(videoDirectory, 'video.mp4'); await writeFile(fixtureVideo, 'video'); });
after(async () => { await rm(videoDirectory, { recursive: true, force: true }); });

function request(platform: 'instagram' | 'tiktok' | 'youtube', privacy?: string): PublicationRequest {
  return { job: { ...renderJob(), kind: 'publication', platform, copy_json: { title: 'Quobby study', caption: 'Make room for study', hashtags: ['Quobby'], ...(privacy ? { privacy } : {}) }, output_path: `renders/${renderJob().id}/output.mp4` }, videoPath: fixtureVideo, signedUrl: 'https://media.example/owned/output.mp4?token=private' };
}
const env = { INSTAGRAM_API_BASE_URL: 'https://graph.instagram.com', INSTAGRAM_API_VERSION: 'v27.0', INSTAGRAM_USER_ID: '123', TIKTOK_PRIVATE_TEST_ENABLED: 'true' };
function setup(responses: (Response | Error)[]) {
  const storage = new Map<string, string>([['instagram', 'ig-secret'], ['tiktok', 'tt-secret'], ['youtube', 'yt-secret']]);
  const calls: { url: URL; init: RequestInit }[] = []; const delays: number[] = [];
  const deps: SocialDependencies = {
    env, keychain: { get: async (key) => storage.get(key) ?? null, set: async (key, value) => { storage.set(key, value); } },
    fetcher: async (url, init = {}) => { calls.push({ url: new URL(String(url)), init }); if (String(url).startsWith('https://open-upload.tiktokapis.com/') && init.body instanceof ReadableStream) assert.equal(await new Response(init.body).text(), 'video'); const next = responses.shift(); if (!next) throw new Error('Unexpected request'); if (next instanceof Error) throw next; return next; },
    sleep: async (ms) => { delays.push(ms); }, probeDuration: async () => 15,
  };
  return { deps, storage, calls, delays };
}
const json = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const tt = (data: unknown) => json({ data, error: { code: 'ok', message: '', log_id: 'trace' } });
const creator = () => tt({ creator_nickname: 'Quobby', privacy_level_options: ['SELF_ONLY'], comment_disabled: true, duet_disabled: true, stitch_disabled: true, max_video_post_duration_sec: 60 });
const tiktokPublishId = 'v_pub_file~v2-1.123456789';
const tikTokInit = () => tt({ publish_id: tiktokPublishId, upload_url: 'https://open-upload.tiktokapis.com/video/?upload_id=one&upload_token=private' });

test('only temporary provider HTTP errors are retryable', () => {
  for (const status of [408, 425, 429, 500, 503, 599]) assert.equal(classifyPlatformError(status), 'retryable');
  for (const status of [400, 401, 403, 404, 409, 600]) assert.equal(classifyPlatformError(status), 'action-required');
});
test('instagram waits for a finished container then publishes and validates its permalink', async () => {
  const { deps, calls } = setup([json({ id: '456' }), json({ status_code: 'IN_PROGRESS' }), json({ status_code: 'FINISHED' }), json({ id: '789' }), json({ permalink: 'https://www.instagram.com/reel/ABC/' })]);
  const result = await publishPublication(request('instagram'), deps);
  assert.deepEqual(result, { externalId: '789', publicUrl: 'https://www.instagram.com/reel/ABC/', published: true, visibility: 'public' });
  assert.deepEqual(calls.map(({ url, init }) => [init.method, url.pathname]), [['POST', '/v27.0/123/media'], ['GET', '/v27.0/456'], ['GET', '/v27.0/456'], ['POST', '/v27.0/123/media_publish'], ['GET', '/v27.0/789']]);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { media_type: 'REELS', video_url: 'https://media.example/owned/output.mp4?token=private', caption: 'Make room for study\n#Quobby', share_to_feed: true });
  assert.ok(calls.every(({ url, init }) => url.hostname === 'graph.instagram.com' && !url.search.includes('secret') && new Headers(init.headers).get('authorization') === 'Bearer ig-secret' && init.redirect === 'error' && init.signal));
});
test('a saved instagram result prevents duplicate provider posts after a lost completion response', async () => {
  const { deps, calls } = setup([json({ id: '456' }), json({ status_code: 'FINISHED' }), json({ id: '789' }), json({ permalink: 'https://www.instagram.com/reel/ABC/' })]);
  const first = await publishPublication(request('instagram'), deps);
  assert.deepEqual(await publishPublication(request('instagram'), deps), first);
  assert.equal(calls.length, 4);
});
test('an uncertain instagram publish never repeats media_publish on recovery', async () => {
  const { deps, calls } = setup([json({ id: '456' }), json({ status_code: 'FINISHED' }), new Error('ig-secret https://signed?token=x')]);
  await assert.rejects(publishPublication(request('instagram'), deps), (error: unknown) => error instanceof SocialError && error.kind === 'uncertain' && !error.message.includes('ig-secret'));
  await assert.rejects(publishPublication(request('instagram'), deps), (error: unknown) => error instanceof SocialError && error.kind === 'uncertain');
  assert.equal(calls.length, 3);
});
test('instagram resumes permalink reads after a captured media ID and does not publish twice', async () => {
  const { deps, calls } = setup([json({ id: '456' }), json({ status_code: 'FINISHED' }), json({ id: '789' }), json({ error: { message: 'secret' } }, 401), json({ permalink: 'https://instagram.com/reel/ABC/' })]);
  await assert.rejects(publishPublication(request('instagram'), deps), SocialError);
  assert.equal((await publishPublication(request('instagram'), deps)).externalId, '789');
  assert.equal(calls.filter(({ url }) => url.pathname.endsWith('/media_publish')).length, 1);
});
test('instagram terminal failures and malformed permalinks cannot report success', async () => {
  for (const terminal of ['ERROR', 'EXPIRED']) {
    const { deps, calls } = setup([json({ id: '456' }), json({ status_code: terminal })]);
    await assert.rejects(publishPublication(request('instagram'), deps), SocialError); assert.equal(calls.length, 2);
  }
  const { deps } = setup([json({ id: '456' }), json({ status_code: 'FINISHED' }), json({ id: '789' }), json({ permalink: 'https://evil.example/reel/ABC/' })]);
  await assert.rejects(publishPublication(request('instagram'), deps), SocialError);
});
test('safe provider status reads retry three transient failures with bounded backoff', async () => {
  const { deps, delays } = setup([json({ id: '456' }), json({}, 429), json({}, 503), json({ status_code: 'FINISHED' }), json({ id: '789' }), json({ permalink: 'https://instagram.com/reel/ABC/' })]);
  assert.equal((await publishPublication(request('instagram'), deps)).published, true);
  assert.deepEqual(delays, [1000, 2000]);
});
test('provider credentials and API origins are checked before any request', async () => {
  const absent = setup([]); absent.storage.delete('instagram');
  await assert.rejects(publishPublication(request('instagram'), absent.deps), SocialError); assert.equal(absent.calls.length, 0);
  const hostile = setup([]); hostile.deps.env = { ...env, INSTAGRAM_API_BASE_URL: 'https://graph.instagram.com.evil.example' };
  await assert.rejects(publishPublication(request('instagram'), hostile.deps), SocialError); assert.equal(hostile.calls.length, 0);
});
test('tiktok private testing reports the provider restriction and never a public success', async () => {
  const { deps, calls } = setup([creator(), tikTokInit(), new Response(null, { status: 201 }), tt({ status: 'PROCESSING_UPLOAD', uploaded_bytes: 5 }), tt({ status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [] })]);
  const result = await publishPublication(request('tiktok', 'SELF_ONLY'), deps);
  assert.deepEqual(result, { externalId: tiktokPublishId, published: false, visibility: 'private' });
  assert.deepEqual(calls.map(({ url }) => url.pathname), ['/v2/post/publish/creator_info/query/', '/v2/post/publish/video/init/', '/video/', '/v2/post/publish/status/fetch/', '/v2/post/publish/status/fetch/']);
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { post_info: { title: 'Make room for study\n#Quobby', privacy_level: 'SELF_ONLY', disable_comment: true, disable_duet: true, disable_stitch: true, brand_content_toggle: false, brand_organic_toggle: true }, source_info: { source: 'FILE_UPLOAD', video_size: 5, chunk_size: 5, total_chunk_count: 1 } });
  assert.equal(new Headers(calls[2].init.headers).has('authorization'), false);
  assert.equal(new Headers(calls[2].init.headers).get('content-range'), 'bytes 0-4/5');
});
test('tiktok accepts its documented opaque publish IDs but rejects unsafe or unbounded IDs before upload', async () => {
  for (const publishId of ['contains space', 'x'.repeat(257), '../not-an-id']) {
    const { deps, calls } = setup([creator(), tt({ publish_id: publishId, upload_url: 'https://open-upload.tiktokapis.com/video/?upload_id=one&upload_token=private' })]);
    await assert.rejects(publishPublication(request('tiktok', 'SELF_ONLY'), deps), (error: unknown) => error instanceof SocialError && error.kind === 'uncertain');
    assert.equal(calls.length, 2);
    assert.ok(!calls.some(({ url }) => url.hostname === 'open-upload.tiktokapis.com'));
  }
});
test('tiktok requires explicit private testing, selected available privacy, and allowed duration', async () => {
  for (const mode of ['disabled', 'public', 'missing-privacy', 'duration']) {
    const { deps, calls } = setup([creator()]); const input = request('tiktok', mode === 'public' ? 'PUBLIC_TO_EVERYONE' : mode === 'missing-privacy' ? undefined : 'SELF_ONLY');
    if (mode === 'disabled') deps.env = { ...env, TIKTOK_PRIVATE_TEST_ENABLED: 'false' };
    if (mode === 'duration') deps.probeDuration = async () => 61;
    await assert.rejects(publishPublication(input, deps), (error: unknown) => error instanceof SocialError && error.kind === 'action-required');
    assert.ok(!calls.some(({ url }) => url.pathname.endsWith('/init/')));
  }
});
test('tiktok rejects an unavailable creator privacy option before initialization', async () => {
  const { deps, calls } = setup([tt({ creator_nickname: 'Quobby', privacy_level_options: ['MUTUAL_FOLLOW_FRIENDS'], max_video_post_duration_sec: 60 })]);
  await assert.rejects(publishPublication(request('tiktok', 'SELF_ONLY'), deps), SocialError); assert.equal(calls.length, 1);
});
test('tiktok poll exhaustion resumes the captured publish ID without submitting again', async () => {
  const responses = [creator(), tikTokInit(), new Response(null, { status: 201 }), ...Array.from({ length: 40 }, () => tt({ status: 'PROCESSING_UPLOAD', uploaded_bytes: 5 })), tt({ status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [] })];
  const { deps, calls } = setup(responses);
  await assert.rejects(publishPublication(request('tiktok', 'SELF_ONLY'), deps), SocialError);
  assert.equal((await publishPublication(request('tiktok', 'SELF_ONLY'), deps)).published, false);
  assert.equal(calls.filter(({ url }) => url.pathname.endsWith('/init/')).length, 1);
});
test('youtube streams a resumable upload then waits for processing and actual visibility', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-social-test-'));
  try {
    const input = request('youtube', 'public'); input.videoPath = join(directory, 'video.mp4'); await writeFile(input.videoPath, 'video');
    const { deps, calls } = setup([new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=session-secret' } }), json({ id: 'yt_123' }, 201), json({ items: [{ id: 'yt_123', processingDetails: { processingStatus: 'processing' }, status: { uploadStatus: 'uploaded', privacyStatus: 'public' } }] }), json({ items: [{ id: 'yt_123', processingDetails: { processingStatus: 'succeeded' }, status: { uploadStatus: 'processed', privacyStatus: 'public' } }] })]);
    const fetcher = deps.fetcher!; deps.fetcher = async (url, init = {}) => { if (init.body instanceof ReadableStream) assert.equal(await new Response(init.body).text(), 'video'); return fetcher(url, init); };
    assert.deepEqual(await publishPublication(input, deps), { externalId: 'yt_123', publicUrl: 'https://www.youtube.com/watch?v=yt_123', published: true, visibility: 'public' });
    assert.deepEqual(calls.map(({ init }) => init.method), ['POST', 'PUT', 'GET', 'GET']);
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), { snippet: { title: 'Quobby study', description: 'Make room for study\n#Quobby', tags: ['Quobby'], categoryId: '27' }, status: { privacyStatus: 'public', selfDeclaredMadeForKids: false } });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('youtube processing failure or private restriction does not report a public post', async () => {
  for (const status of ['failed', 'private']) {
    const { deps, storage } = setup([json({ items: [{ id: 'yt_123', processingDetails: { processingStatus: status === 'failed' ? 'failed' : 'succeeded' }, status: { uploadStatus: status === 'failed' ? 'failed' : 'processed', privacyStatus: 'private' } }] })]);
    storage.set(`publication-${renderJob().id}`, JSON.stringify({ version: 1, platform: 'youtube', phase: 'youtube-video', operationId: 'yt_123' }));
    if (status === 'failed') await assert.rejects(publishPublication(request('youtube'), deps), SocialError);
    else assert.deepEqual(await publishPublication(request('youtube'), deps), { externalId: 'yt_123', published: false, visibility: 'private' });
  }
});
test('youtube resumes an interrupted session with a status query instead of starting another upload', async () => {
  const { deps, storage, calls } = setup([json({ id: 'yt_123' }, 201), json({ items: [{ id: 'yt_123', processingDetails: { processingStatus: 'succeeded' }, status: { uploadStatus: 'processed', privacyStatus: 'public' } }] })]);
  storage.set(`publication-${renderJob().id}`, JSON.stringify({ version: 1, platform: 'youtube', phase: 'youtube-session', uploadUrl: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=session-secret', size: 5 }));
  assert.equal((await publishPublication(request('youtube'), deps)).externalId, 'yt_123');
  assert.equal(calls[0].init.method, 'PUT'); assert.equal(new Headers(calls[0].init.headers).get('content-range'), 'bytes */5');
  assert.ok(!calls.some(({ init }) => init.method === 'POST'));
});
test('youtube never sends a token to an untrusted resumable Location', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-social-test-'));
  try {
    const input = request('youtube'); input.videoPath = join(directory, 'video.mp4'); await writeFile(input.videoPath, 'video');
    const { deps, calls } = setup([new Response(null, { headers: { location: 'https://evil.example/upload' } })]);
    await assert.rejects(publishPublication(input, deps), SocialError); assert.equal(calls.length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a failed recovery-record write stops before any provider mutation', async () => {
  const { deps, calls } = setup([]);
  deps.keychain = { get: async (key) => key === 'instagram' ? 'token' : null, set: async () => { throw new Error('Keychain locked'); } };
  await assert.rejects(publishPublication(request('instagram'), deps), (error: unknown) => error instanceof SocialError && error.kind === 'uncertain');
  assert.equal(calls.length, 0);
});
test('youtube resumes precisely after the last accepted byte in the existing session', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-social-test-'));
  try {
    const input = request('youtube'); input.videoPath = join(directory, 'video.mp4'); await writeFile(input.videoPath, 'video');
    const { deps, storage, calls } = setup([new Response(null, { status: 308, headers: { range: 'bytes=0-1' } }), json({ id: 'yt_123' }, 201), json({ items: [{ id: 'yt_123', processingDetails: { processingStatus: 'succeeded' }, status: { uploadStatus: 'processed', privacyStatus: 'public' } }] })]);
    storage.set(`publication-${renderJob().id}`, JSON.stringify({ version: 1, platform: 'youtube', phase: 'youtube-session', uploadUrl: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=session-secret', size: 5 }));
    const fetcher = deps.fetcher!; deps.fetcher = async (url, init = {}) => { if (init.body instanceof ReadableStream) assert.equal(await new Response(init.body).text(), 'deo'); return fetcher(url, init); };
    await publishPublication(input, deps);
    assert.equal(new Headers(calls[1].init.headers).get('content-range'), 'bytes 2-4/5');
    assert.ok(!calls.some(({ init }) => init.method === 'POST'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('safe reads stop after three transient retries and 401 responses require account action', async () => {
  for (const status of [503, 401]) {
    const responses = [json({ id: '456' }), ...Array.from({ length: 4 }, () => json({ error: { message: 'never expose token-secret' } }, status))];
    const { deps, calls, delays } = setup(responses);
    await assert.rejects(publishPublication(request('instagram'), deps), (error: unknown) => error instanceof SocialError && error.kind === (status === 503 ? 'retryable' : 'action-required') && !error.message.includes('token-secret'));
    assert.equal(calls.length, status === 503 ? 5 : 2);
    assert.deepEqual(delays, status === 503 ? [1000, 2000, 4000] : []);
  }
});
test('a deadline stops status polling within the database lease and keeps the operation recoverable', async () => {
  const { deps, calls, storage } = setup([json({ id: '456' }), json({ status_code: 'IN_PROGRESS' })]);
  let now = 0; deps.now = () => now; deps.sleep = async () => { now = 600_000; };
  await assert.rejects(publishPublication(request('instagram'), deps), (error: unknown) => error instanceof SocialError && error.kind === 'retryable');
  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(storage.get(`publication-${renderJob().id}`)!).phase, 'instagram-container');
});
test('corrupt recovery state and mutations without captured IDs fail closed', async () => {
  for (const saved of ['broken-json', JSON.stringify({ version: 1, platform: 'instagram', phase: 'instagram-creating' })]) {
    const { deps, storage, calls } = setup([]); storage.set(`publication-${renderJob().id}`, saved);
    await assert.rejects(publishPublication(request('instagram'), deps), (error: unknown) => error instanceof SocialError && error.kind === 'uncertain');
    assert.equal(calls.length, 0);
  }
});

test('tiktok files larger than 64 MiB initialize multiple valid chunks', async () => {
  const path = join(videoDirectory, 'sparse.mp4'); await writeFile(path, '');
  for (const [size, chunkSize, count] of [[5, 5, 1], [67_108_864, 67_108_864, 1], [67_108_865, 10_485_760, 6], [262_144_000, 10_485_760, 25]]) {
    await truncate(path, size); const input = request('tiktok', 'SELF_ONLY'); input.videoPath = path;
    const { deps, calls } = setup([creator(), json({}, 503)]);
    await assert.rejects(publishPublication(input, deps), SocialError);
    assert.deepEqual(JSON.parse(String(calls[1].init.body)).source_info, { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: count });
    assert.equal(calls.length, 2);
  }
});
test('tiktok queries an interrupted upload and reuses its publish ID', async () => {
  const { deps, calls } = setup([creator(), tikTokInit(), new Error('unknown transfer result'), tt({ status: 'PROCESSING_UPLOAD', uploaded_bytes: 0 }), new Response(null, { status: 201 }), tt({ status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [] })]);
  const input = request('tiktok', 'SELF_ONLY');
  await assert.rejects(publishPublication(input, deps), (error: unknown) => error instanceof SocialError && error.kind === 'uncertain');
  assert.equal((await publishPublication(input, deps)).published, false);
  assert.equal(calls.filter(({ url }) => url.pathname.endsWith('/init/')).length, 1);
  assert.deepEqual(JSON.parse(String(calls[3].init.body)), { publish_id: tiktokPublishId });
});
const NOW = Date.parse('2026-11-18T12:00:00.000Z');
const youtubeOAuth = (expiresAt: string, extra: Record<string, string> = {}) => JSON.stringify({ access_token: 'yt-stale', refresh_token: 'yt-refresh', expires_at: expiresAt, token_url: 'https://oauth2.googleapis.com/token', client_id: 'client-id', client_secret: 'desktop-secret', ...extra });
test('a youtube token close to expiry refreshes through the stored endpoint and is saved', async () => {
  const { deps, storage, calls } = setup([json({ access_token: 'yt-fresh', expires_in: 3599 })]); deps.now = () => NOW;
  storage.set('youtube', youtubeOAuth('2026-11-18T12:10:00.000Z'));
  assert.equal(await new SocialContext(request('youtube'), deps).token(), 'yt-fresh');
  assert.equal(calls.length, 1); assert.equal(calls[0].url.href, 'https://oauth2.googleapis.com/token'); assert.equal(calls[0].init.redirect, 'error');
  assert.equal(new Headers(calls[0].init.headers).has('authorization'), false);
  assert.deepEqual(Object.fromEntries(new URLSearchParams(String(calls[0].init.body))), { grant_type: 'refresh_token', refresh_token: 'yt-refresh', client_id: 'client-id', client_secret: 'desktop-secret' });
  const saved = JSON.parse(storage.get('youtube')!);
  assert.equal(saved.access_token, 'yt-fresh'); assert.equal(saved.refresh_token, 'yt-refresh'); assert.equal(saved.expires_at, '2026-11-18T12:59:59.000Z');
});
test('a youtube token with time remaining is used without a refresh request', async () => {
  const { deps, storage, calls } = setup([]); deps.now = () => NOW;
  storage.set('youtube', youtubeOAuth('2026-11-18T12:30:00.000Z'));
  assert.equal(await new SocialContext(request('youtube'), deps).token(), 'yt-stale'); assert.equal(calls.length, 0);
});
test('expired tokens that cannot be refreshed require reconnecting the account', async () => {
  const missing = setup([]); missing.deps.now = () => NOW;
  missing.storage.set('youtube', JSON.stringify({ access_token: 'yt-stale', expires_at: '2026-11-18T11:00:00.000Z' }));
  await assert.rejects(new SocialContext(request('youtube'), missing.deps).token(), (error: unknown) => error instanceof SocialError && error.kind === 'action-required' && /Reconnect/.test(error.message));
  assert.equal(missing.calls.length, 0);
  const untrusted = setup([]); untrusted.deps.now = () => NOW;
  untrusted.storage.set('youtube', youtubeOAuth('2026-11-18T11:00:00.000Z', { token_url: 'https://evil.example/token' }));
  await assert.rejects(new SocialContext(request('youtube'), untrusted.deps).token(), (error: unknown) => error instanceof SocialError && error.kind === 'action-required');
  assert.equal(untrusted.calls.length, 0);
  const revoked = setup([json({ error: 'invalid_grant' }, 400)]); revoked.deps.now = () => NOW;
  revoked.storage.set('youtube', youtubeOAuth('2026-11-18T11:00:00.000Z'));
  await assert.rejects(new SocialContext(request('youtube'), revoked.deps).token(), (error: unknown) => error instanceof SocialError && error.kind === 'action-required' && /Reconnect/.test(error.message));
  const outage = setup([json({}, 503)]); outage.deps.now = () => NOW;
  outage.storage.set('youtube', youtubeOAuth('2026-11-18T11:00:00.000Z'));
  await assert.rejects(new SocialContext(request('youtube'), outage.deps).token(), (error: unknown) => error instanceof SocialError && error.kind === 'retryable');
});
test('tiktok rejects untrusted upload locations before transferring private media', async () => {
  const { deps, calls } = setup([creator(), tt({ publish_id: tiktokPublishId, upload_url: 'https://tiktokapis.com.evil.example/video/?upload_id=x&upload_token=y' })]);
  await assert.rejects(publishPublication(request('tiktok', 'SELF_ONLY'), deps), SocialError);
  assert.equal(calls.length, 2);
});
