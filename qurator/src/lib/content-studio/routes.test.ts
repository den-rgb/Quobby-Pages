import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Installed Node typings predate synchronous module hooks.
import { registerHooks } from 'node:module';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { authorizeAdmin, authorizeMachine, assertPublicationAction, createContentStudioHandlers } from './routes.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { ContentStudioConflictError, ContentStudioInputError, MemeGenerationError } from './errors.ts';
import type { RouteDependencies, StudioStore } from './routes';
import type { CampaignRow, MemeClipRow, RenderRow, PublicationRow } from './types';

const campaignId = '11111111-1111-4111-8111-111111111111';
const renderId = '22222222-2222-4222-8222-222222222222';
const publicationId = '33333333-3333-4333-8333-333333333333';
const assetId = '44444444-4444-4444-8444-444444444444';
const now = '2026-11-18T12:00:00.000Z';
const outputPath = `renders/${renderId}/output.mp4`;
const spec = { templateId: 'focus-blocker-problem-solution' as const, templateVersion: 1, title: 'Study', hook: 'Focus', cta: 'Try it', voiceText: 'Keep studying.', sourceAssetIds: [assetId] };
const campaign: CampaignRow = { id: campaignId, title: 'Study', template_id: spec.templateId, template_version: 1, requires_approval: true, approved_at: null, status: 'review', render_spec: spec, created_by: 'admin-1', created_at: now, updated_at: now };
const lease = { lease_owner: null, lease_expires_at: null, attempt_count: 0, error_code: null, error_message: null, created_at: now, updated_at: now };
const render: RenderRow = { ...lease, id: renderId, campaign_id: campaignId, render_spec: spec, status: 'review', output_path: outputPath, duration_ms: 15000 };
const publication: PublicationRow = { ...lease, id: publicationId, render_id: renderId, platform: 'instagram', copy_json: { title: 'Study', caption: 'Focus', hashtags: [] }, scheduled_for: null, status: 'review', external_post_id: null, public_url: null, published_at: null };

function request(body: unknown = {}, machine = false) {
  return new Request('https://studio.test/api', { method: 'POST', headers: { 'content-type': 'application/json', ...(machine ? { 'x-content-studio-machine-token': 'test-token' } : {}) }, body: JSON.stringify(body) });
}

function setup(overrides: Partial<StudioStore> = {}, auth: Partial<Pick<RouteDependencies, 'requireAdmin' | 'requireMachine'>> = {}) {
  const writes: { entity: string; id: string; input: Record<string, unknown> }[] = [];
  const store = new Proxy(overrides, { get(target, key) {
    if (key in target) return target[key as keyof StudioStore];
    if (key === 'getCampaign') return async () => campaign;
    if (key === 'getRender') return async () => render;
    if (key === 'getPublication') return async () => publication;
    if (key === 'listCampaignRenders') return async () => [render];
    if (key === 'listPublications') return async () => [publication];
    if (key === 'setApprovalPolicy') return async (id: string, input: { requiresApproval: boolean }) => {
      writes.push({ entity: 'setApprovalPolicy', id, input });
      return { ...campaign, requires_approval: input.requiresApproval };
    };
    if (key === 'reviewCampaign') return async (id: string, input: { action: 'approve' | 'reject' }) => {
      writes.push({ entity: 'reviewCampaign', id, input });
      return { ...campaign, status: input.action === 'approve' ? 'queued' : 'rejected', approved_at: input.action === 'approve' ? now : null };
    };
    if (key === 'retryPublication') return async (id: string, input: Record<string, unknown>) => {
      writes.push({ entity: 'retryPublication', id, input });
      return { ...publication, status: 'queued', error_code: null, error_message: null };
    };
    if (String(key).startsWith('transition')) return async (id: string, input: Record<string, unknown>) => {
      writes.push({ entity: String(key), id, input });
      return { ...(key === 'transitionCampaign' ? campaign : key === 'transitionRender' ? render : publication), status: input.status };
    };
    return async () => { throw new Error(`Unexpected store operation ${String(key)}`); };
  } }) as StudioStore;
  const handlers = createContentStudioHandlers({ requireAdmin: async () => ({ id: 'admin-1' }), requireMachine: () => true, store, now: () => new Date(now), ...auth });
  return { handlers, writes };
}

test('platform copy is regenerated for unpublished publications only', async () => {
  const calls: { id: string; admin: string }[] = [];
  const { handlers } = setup({
    generateCampaignCopy: async (id, admin) => { calls.push({ id, admin }); return [publication]; },
  });
  assert.deepEqual(await handlers.generateCopy(request(), campaignId), { status: 200, body: { publications: [publication] } });
  assert.deepEqual(calls, [{ id: campaignId, admin: 'admin-1' }]);
  const published = setup({ getCampaign: async () => ({ ...campaign, status: 'published' }) });
  assert.equal((await published.handlers.generateCopy(request(), campaignId)).status, 409);
});

test('browser rendering signs, verifies, and completes without any worker lease', async () => {
  const calls: string[] = [];
  const queuedRender = { ...render, status: 'queued' as const, output_path: null, duration_ms: null };
  const { handlers } = setup({
    getRender: async () => queuedRender,
    getAsset: async () => ({ id: assetId, campaign_id: campaignId, mime_type: 'video/mp4', size_bytes: 100, storage_path: `uploads/${assetId}/clip.mp4`, original_filename: 'clip.mp4', created_at: now }),
    createSignedRenderUploadUrl: async (id) => { calls.push(`sign:${id}`); return { path: `renders/${id}/output.mp4`, signedUrl: 'https://storage.test/upload', token: 't' }; },
    confirmRenderOutput: async (id) => { calls.push(`confirm:${id}`); },
    completeRenderAsAdmin: async (id, adminId, durationMs) => { calls.push(`complete:${id}:${adminId}:${durationMs}`); return { ...queuedRender, status: 'review', output_path: outputPath, duration_ms: durationMs }; },
    createSignedDownloadUrl: async (path) => { calls.push(`download:${path}`); return `https://storage.test/${path}`; },
    publishPublicationManually: async (id, adminId, url) => { calls.push(`publish:${id}:${adminId}:${url}`); return { ...publication, status: 'published', public_url: url, published_at: now, external_post_id: 'manual' }; },
  });
  assert.deepEqual(await handlers.renderUpload(request(), renderId), { status: 200, body: { path: `renders/${renderId}/output.mp4`, signedUrl: 'https://storage.test/upload', token: 't' } });
  assert.equal((await handlers.completeBrowserRender(request({ durationMs: 11000 }), renderId)).status, 200);
  assert.equal((await handlers.completeBrowserRender(request({}), renderId)).status, 400);
  assert.equal((await handlers.assetDownload(request(), assetId)).status, 200);
  assert.equal((await handlers.publishManual(request({ publicUrl: 'https://instagram.com/p/abc' }), publicationId)).status, 200);
  assert.equal((await handlers.publishManual(request({ publicUrl: 'http://insecure.example' }), publicationId)).status, 400);
  assert.deepEqual(calls, [
    `sign:${renderId}`, `confirm:${renderId}`, `complete:${renderId}:admin-1:11000`,
    `download:uploads/${assetId}/clip.mp4`,
    `publish:${publicationId}:admin-1:https://instagram.com/p/abc`,
  ]);
});

test('the browser render source signs every asset for the owner only', async () => {
  const sourceAssets = [
    { id: assetId, campaign_id: campaignId, mime_type: 'video/mp4', size_bytes: 100, storage_path: `uploads/${assetId}/recording.mp4`, original_filename: 'recording.mp4', created_at: now },
    { id: '66666666-6666-4666-8666-666666666666', campaign_id: campaignId, mime_type: 'image/png', size_bytes: 50, storage_path: 'uploads/x/extra.png', original_filename: 'extra.png', created_at: now },
  ];
  const { handlers } = setup({
    getRender: async () => ({ ...render, status: 'queued', output_path: null, render_spec: { ...spec, sourceAssetIds: sourceAssets.map((asset) => asset.id) } }),
    getAsset: async (id) => sourceAssets.find((asset) => asset.id === id) ?? null,
    createSignedDownloadUrl: async (path) => `https://storage.test/${path}`,
  });
  const foreign = setup({
    getRender: async () => ({ ...render, render_spec: { ...spec, sourceAssetIds: [assetId] } }),
    getCampaign: async () => ({ ...campaign, created_by: 'someone-else' }),
    getAsset: async () => sourceAssets[0],
  });
  assert.equal((await foreign.handlers.renderSource(request(), renderId)).status, 403);
  const response = await handlers.renderSource(request(), renderId);
  assert.equal(response.status, 200);
  const body = response.body as { spec: { templateId: string }; assets: { id: string; mimeType: string; url: string }[] };
  assert.equal(body.spec.templateId, spec.templateId);
  assert.deepEqual(body.assets.map((asset) => asset.mimeType), ['video/mp4', 'image/png']);
  assert.equal(body.assets[0].url, `https://storage.test/uploads/${assetId}/recording.mp4`);
});

test('a finalised render cannot be re-uploaded', async () => {
  const { handlers } = setup({ getRender: async () => ({ ...render, status: 'review', output_path: outputPath }) });
  assert.equal((await handlers.renderUpload(request(), renderId)).status, 409);
});

const memeClip: MemeClipRow = { id: campaignId, provider: 'pixabay', video_id: 325416, label: 'Cabin confusion', page_url: 'https://pixabay.com/videos/id-325416/', author: 'asifsharif', author_url: 'https://pixabay.com/users/asifsharif-40661824/', file_url: 'https://cdn.pixabay.com/video/x.mp4', portrait: false, active: true, source: 'manual', created_at: now };

test('the funny clip library lists, validates, adds, and toggles clips', async () => {
  const added: { provider: string; videoId: number; label: string }[] = [];
  const toggled: { id: string; active: boolean }[] = [];
  const { handlers } = setup({
    listMemeClips: async () => [memeClip],
    addMemeClip: async (input) => { added.push(input); return { ...memeClip, label: input.label }; },
    setMemeClipActive: async (id, active) => { toggled.push({ id, active }); return { ...memeClip, active }; },
  });
  assert.deepEqual(await handlers.listMemeClips(request()), { status: 200, body: { clips: [memeClip] } });
  assert.equal((await handlers.addMemeClip(request({ provider: 'pixabay', videoId: 325416, label: 'Cabin confusion' }))).status, 201);
  assert.deepEqual(added, [{ provider: 'pixabay', videoId: 325416, label: 'Cabin confusion' }]);
  assert.equal((await handlers.addMemeClip(request({ provider: 'vimeo', videoId: 325416, label: 'x' }))).status, 400);
  assert.equal((await handlers.addMemeClip(request({ provider: 'pexels', videoId: 1.5, label: 'x' }))).status, 400);
  assert.equal((await handlers.addMemeClip(request({ provider: 'pexels', videoId: 325416, label: '' }))).status, 400);
  assert.equal((await handlers.setMemeClipActive(request({ active: false }), campaignId)).status, 200);
  assert.deepEqual(toggled, [{ id: campaignId, active: false }]);
  assert.equal((await handlers.setMemeClipActive(request({ active: false }), 'not-a-uuid')).status, 400);
  assert.equal((await handlers.setMemeClipActive(request({ active: 'no' }), campaignId)).status, 400);
});

test('an injected false admin decision returns Forbidden', async () => {
  assert.deepEqual(await authorizeAdmin(async () => false), { status: 403, body: { error: 'Forbidden' } });
});
test('an injected false machine decision returns Forbidden', async () => {
  assert.deepEqual(await authorizeMachine(request({}, true), () => false), { status: 403, body: { error: 'Forbidden' } });
});
test('a missing machine header returns 401 even if an injected checker would permit it', async () => {
  assert.deepEqual(await authorizeMachine(request(), () => true), { status: 401, body: { error: 'Unauthorized' } });
});
test('approval is allowed only for a review publication', () => {
  assert.doesNotThrow(() => assertPublicationAction('approved', 'review'));
  for (const status of ['draft', 'queued', 'rendering', 'scheduled', 'publishing', 'published', 'failed', 'rejected'] as const) {
    assert.throws(() => assertPublicationAction('approved', status), /review/);
  }
});

test('meme generation validates targeting before spending stock or AI calls', async () => {
  const calls: unknown[] = [];
  const { handlers } = setup({ generateMemeCampaign: async (input, owner) => { calls.push({ input, owner }); return { campaignId, renderId, clipUrl: 'https://storage.test/clip', copy: { title: 'T', hook: 'H', cta: 'C', caption: 'Cap', hashtags: [] } }; } });
  for (const body of [{ platforms: [], requiresApproval: true }, { platforms: ['tiktok'], requiresApproval: true }, { platforms: ['instagram'] }, { platforms: ['instagram'], requiresApproval: true, scheduledFor: '2020-01-01T00:00:00Z' }, { platforms: ['instagram'], requiresApproval: true, theme: 'x'.repeat(61) }, { platforms: ['instagram'], requiresApproval: true, title: 'injected' }]) {
    assert.equal((await handlers.generateMeme(request(body))).status, 400, JSON.stringify(body));
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(await handlers.generateMeme(request({ platforms: ['instagram', 'youtube'], requiresApproval: true, theme: 'exam stress' })), { status: 201, body: { campaignId, renderId, clipUrl: 'https://storage.test/clip', copy: { title: 'T', hook: 'H', cta: 'C', caption: 'Cap', hashtags: [] } } });
  assert.deepEqual(calls, [{ input: { theme: 'exam stress', platforms: ['instagram', 'youtube'], requiresApproval: true, scheduledFor: null }, owner: 'admin-1' }]);
});
test('meme generation surfaces curated generation and configuration errors only', async () => {
  const body = { platforms: ['instagram'], requiresApproval: true };
  const failed = setup({ generateMemeCampaign: async () => { throw new MemeGenerationError('No new stock clips found for "x". Try another theme.'); } });
  assert.deepEqual(await failed.handlers.generateMeme(request(body)), { status: 502, body: { error: 'No new stock clips found for "x". Try another theme.' } });
  const config = setup({ generateMemeCampaign: async () => { throw new ContentStudioInputError('Set PEXELS_API_KEY in the Qurator server environment to generate memes.'); } });
  assert.equal((await config.handlers.generateMeme(request(body))).status, 400);
  const leak = setup({ generateMemeCampaign: async () => { throw new Error('gemini key AIza-secret'); } });
  assert.deepEqual(await leak.handlers.generateMeme(request(body)), { status: 500, body: { error: 'Content Studio request failed' } });
});
for (const name of ['listCampaigns', 'createCampaign', 'generateMeme', 'adminAsset', 'reviewCampaign', 'patchPublication', 'retryPublication', 'previewRender', 'listMemeClips', 'addMemeClip', 'setMemeClipActive', 'renderUpload', 'completeBrowserRender', 'publishManual', 'assetDownload', 'renderSource', 'generateCopy'] as const) {
  test(`${name} authorizes before reading the request or accessing data`, async () => {
    const { handlers } = setup({}, { requireAdmin: async () => false });
    const req = new Request('https://studio.test', { method: 'POST', body: 'not-json' });
    assert.deepEqual(await handlers[name](req, publicationId), { status: 403, body: { error: 'Forbidden' } });
  });
}
for (const name of ['heartbeat', 'claim', 'machineAsset', 'updateRender', 'updatePublication'] as const) {
  test(`${name} fails closed before parsing or accessing data`, async () => {
    const { handlers } = setup({}, { requireMachine: () => false });
    assert.deepEqual(await handlers[name](request({}, true), renderId), { status: 403, body: { error: 'Forbidden' } });
    assert.deepEqual(await handlers[name](request(), renderId), { status: 401, body: { error: 'Unauthorized' } });
  });
}

test('campaign creation validates input before writing and returns row UUIDs', async () => {
  let createdBy = '';
  const { handlers } = setup({ createCampaign: async (_input, owner) => { createdBy = owner; return { campaign, render, publications: [publication] }; } });
  assert.equal((await handlers.createCampaign(request({ title: '' }))).status, 400);
  const input = { templateId: spec.templateId, title: 'Study', hook: 'Focus', cta: 'Try', voiceText: 'Hello', sourceAssetIds: [assetId], platforms: ['instagram'], requiresApproval: true };
  assert.deepEqual(await handlers.createCampaign(request(input)), { status: 201, body: { campaignId, renderId, publicationIds: [publicationId] } });
  assert.equal(createdBy, 'admin-1');
});
test('campaign creation requires explicit TikTok private-test acknowledgement', async () => {
  const { handlers } = setup({ createCampaign: async () => ({ campaign, render, publications: [publication] }) });
  const input = { templateId: spec.templateId, title: 'Study', hook: 'Focus', cta: 'Try', voiceText: 'Hello', sourceAssetIds: [assetId], platforms: ['tiktok'], requiresApproval: true };
  assert.equal((await handlers.createCampaign(request(input))).status, 400);
  assert.equal((await handlers.createCampaign(request({ ...input, tiktokPrivateTest: true }))).status, 201);
});
test('campaign media validation failures return a field error without leaking database errors', async () => {
  const input = { templateId: spec.templateId, title: 'Study', hook: 'Focus', cta: 'Try', voiceText: 'Hello', sourceAssetIds: [assetId], platforms: ['instagram'], requiresApproval: true };
  const invalid = setup({ createCampaign: async () => { throw new ContentStudioInputError('Choose at most one optional background audio file.'); } });
  assert.deepEqual(await invalid.handlers.createCampaign(request(input)), { status: 400, body: { error: 'Choose at most one optional background audio file.' } });
  const unavailable = setup({ createCampaign: async () => { throw new Error('database secret'); } });
  assert.deepEqual(await unavailable.handlers.createCampaign(request(input)), { status: 500, body: { error: 'Content Studio request failed' } });
});
test('lists campaign summaries supplied by the bounded queue helper', async () => {
  const workers = [{ machine_id: 'mac-1', last_seen_at: now }];
  const { handlers } = setup({ listQueue: async () => [], listWorkerHeartbeats: async () => workers });
  assert.deepEqual(await handlers.listCampaigns(request()), { status: 200, body: { campaigns: [], workers } });
});
test('admin preview signs only a confirmed canonical output associated with the owner campaign', async () => {
  const { handlers } = setup({ createSignedDownloadUrl: async (path) => {
    assert.equal(path, outputPath);
    return 'https://storage.test/private-signed-output';
  } });
  assert.deepEqual(await handlers.previewRender(request(), renderId), { status: 200, body: { signedUrl: 'https://storage.test/private-signed-output', expiresIn: 300 } });
});
test('admin preview denies missing, foreign, unfinished and noncanonical renders without signing', async () => {
  const cases: [Partial<StudioStore>, number][] = [
    [{ getRender: async () => null }, 404],
    [{ getCampaign: async () => null }, 404],
    [{ getCampaign: async () => ({ ...campaign, created_by: 'other' }) }, 403],
    [{ getRender: async () => ({ ...render, status: 'rendering' }) }, 409],
    [{ getRender: async () => ({ ...render, output_path: `uploads/${assetId}/clip.mp4` }) }, 409],
  ];
  for (const [overrides, expected] of cases) {
    assert.equal((await setup(overrides).handlers.previewRender(request(), renderId)).status, expected);
  }
  assert.equal((await setup().handlers.previewRender(request(), 'invalid')).status, 400);
});
test('asset signing validates metadata and never accepts media bytes', async () => {
  const upload = { path: `uploads/${assetId}/clip.mp4`, signedUrl: 'https://storage.test/signed', token: 'upload-token' };
  const { handlers } = setup({ createSignedUploadUrl: async () => upload });
  assert.deepEqual(await handlers.adminAsset(request({ filename: 'clip.mp4', mimeType: 'video/mp4', sizeBytes: 100 })), { status: 201, body: upload });
  for (const body of [
    { filename: 'clip', mimeType: 'text/html', sizeBytes: 10 },
    { filename: 'clip', mimeType: 'video/mp4', sizeBytes: 0 },
    { filename: 'clip', mimeType: 'video/mp4', sizeBytes: 262144001 },
    { filename: 'clip', mimeType: 'video/mp4', sizeBytes: 10, bytes: 'media' },
  ]) assert.equal((await handlers.adminAsset(request(body))).status, 400);
});
test('asset confirmation delegates Storage verification before returning an asset', async () => {
  const asset = { id: assetId, campaign_id: null, storage_path: `uploads/${assetId}/clip.mp4`, mime_type: 'video/mp4', size_bytes: 100, original_filename: 'clip.mp4', created_at: now };
  const { handlers } = setup({ createAsset: async (input) => { assert.equal(input.storagePath, asset.storage_path); return asset; } });
  assert.deepEqual(await handlers.adminAsset(request({ action: 'confirm', storagePath: asset.storage_path, filename: 'clip.mp4', mimeType: 'video/mp4', sizeBytes: 100 })), { status: 201, body: { asset } });
});
test('approval delegates the complete campaign decision to one atomic store operation', async () => {
  const { handlers, writes } = setup();
  assert.equal((await handlers.reviewCampaign(request({ action: 'approve' }), campaignId)).status, 200);
  assert.deepEqual(writes, [{ entity: 'reviewCampaign', id: campaignId, input: { adminId: 'admin-1', action: 'approve' } }]);
});
test('rejection delegates the complete campaign decision to the atomic store operation', async () => {
  const { handlers, writes } = setup();
  assert.equal((await handlers.reviewCampaign(request({ action: 'reject' }), campaignId)).status, 200);
  assert.deepEqual(writes, [{ entity: 'reviewCampaign', id: campaignId, input: { adminId: 'admin-1', action: 'reject' } }]);
});
test('review rejects arbitrary actions, foreign campaigns, and non-review approvals', async () => {
  assert.equal((await setup().handlers.reviewCampaign(request({ action: 'approved' }), campaignId)).status, 400);
  assert.equal((await setup({ getCampaign: async () => ({ ...campaign, created_by: 'other' }) }).handlers.reviewCampaign(request({ action: 'approve' }), campaignId)).status, 403);
  const { handlers, writes } = setup({ reviewCampaign: async () => { throw new ContentStudioConflictError(); } });
  assert.equal((await handlers.reviewCampaign(request({ action: 'approve' }), campaignId)).status, 409);
  assert.equal(writes.length, 0);
});
test('publication editing validates campaign ownership and rejects terminal or leased rows', async () => {
  assert.equal((await setup({ getCampaign: async () => ({ ...campaign, created_by: 'other' }) }).handlers.patchPublication(request({ title: 'New' }), publicationId)).status, 403);
  for (const status of ['published', 'failed', 'rejected', 'publishing'] as const) {
    const { handlers, writes } = setup({ getPublication: async () => ({ ...publication, status }) });
    assert.equal((await handlers.patchPublication(request({ title: 'New' }), publicationId)).status, 409);
    assert.equal(writes.length, 0);
  }
});
test('publication editing preserves existing copy and recalculates approval and schedule', async () => {
  const { handlers, writes } = setup();
  assert.equal((await handlers.patchPublication(request({ title: 'New title', scheduledFor: '2026-11-19T12:00:00Z', requiresApproval: false }), publicationId)).status, 200);
  const edit = writes.find((write) => write.entity === 'transitionPublication')!;
  assert.equal(edit.input.status, 'scheduled');
  assert.deepEqual(edit.input.copy, { title: 'New title', caption: 'Focus', hashtags: [] });
  assert.equal(writes.find((write) => write.entity === 'setApprovalPolicy')!.input.requiresApproval, false);
});
test('an owner can explicitly retry only a retryable failed publication without changing its copy', async () => {
  const failed = { ...publication, status: 'failed' as const, error_code: 'publication-retryable', error_message: 'Temporary provider issue' };
  const { handlers, writes } = setup({ getPublication: async () => failed, getCampaign: async () => ({ ...campaign, status: 'queued', approved_at: now }) });
  assert.equal((await handlers.retryPublication(request(), publicationId)).status, 200);
  const retry = writes.find((write) => write.entity === 'retryPublication')!;
  assert.equal(retry.id, publicationId);
  assert.deepEqual(retry.input, { adminId: 'admin-1' });
});
test('retry rejects nonretryable, stale, foreign, unrendered, or terminal campaign publications', async () => {
  const retryable = { ...publication, status: 'failed' as const, error_code: 'publication-retryable' };
  const cases: [Partial<StudioStore>, number][] = [
    [{ retryPublication: async () => { throw new ContentStudioConflictError(); } }, 409],
    [{ getPublication: async () => ({ ...retryable, status: 'queued' }), retryPublication: async () => { throw new ContentStudioConflictError(); } }, 409],
    [{ getCampaign: async () => ({ ...campaign, created_by: 'other', status: 'queued', approved_at: now }) }, 403],
    [{ getRender: async () => ({ ...render, status: 'failed', output_path: null }), retryPublication: async () => { throw new ContentStudioConflictError(); } }, 409],
    [{ getCampaign: async () => ({ ...campaign, status: 'rejected', approved_at: now }), retryPublication: async () => { throw new ContentStudioConflictError(); } }, 409],
  ];
  for (const [overrides, expected] of cases) {
    const { handlers, writes } = setup({ getPublication: async () => retryable, ...overrides });
    assert.equal((await handlers.retryPublication(request(), publicationId)).status, expected);
    assert.equal(writes.length, 0);
  }
});
for (const order of ['worker-first', 'admin-first'] as const) {
  test(`approval enable uses current database rows when operations run ${order}`, async () => {
    let currentCampaign: CampaignRow = { ...campaign, requires_approval: false, status: 'queued' };
    let currentRender: RenderRow = { ...render, status: 'rendering', output_path: null };
    let currentPublication: PublicationRow = { ...publication, status: 'draft' };
    let policyWasAtomic = false;
    const finishWorker = () => {
      currentRender = { ...render };
      currentPublication = { ...currentPublication, status: currentCampaign.requires_approval ? 'review' : 'queued' };
    };
    const { handlers } = setup({
      getPublication: async () => ({ ...currentPublication }),
      getRender: async () => ({ ...currentRender }),
      getCampaign: async () => {
        const snapshot = { ...currentCampaign };
        if (order === 'worker-first') finishWorker();
        return snapshot;
      },
      listCampaignRenders: async () => [currentRender],
      listPublications: async () => [currentPublication],
      setApprovalPolicy: async (_id, input) => {
        assert.deepEqual(input.expectedStatuses, ['queued']);
        assert.equal(input.adminId, 'admin-1');
        currentCampaign = { ...currentCampaign, requires_approval: true, status: currentRender.output_path ? 'review' : 'queued' };
        if (currentRender.output_path) currentPublication = { ...currentPublication, status: 'review' };
        policyWasAtomic = true;
        return currentCampaign;
      },
      transitionCampaign: async (_id, input) => {
        currentCampaign = { ...currentCampaign, requires_approval: input.requiresApproval ?? currentCampaign.requires_approval, status: input.status };
        return currentCampaign;
      },
      transitionPublication: async (_id, input) => {
        if (!input.expectedStatuses?.includes(currentPublication.status)) throw new ContentStudioConflictError();
        currentPublication = { ...currentPublication, status: input.status };
        return currentPublication;
      },
    });
    const response = await handlers.patchPublication(request({ requiresApproval: true }), publicationId);
    if (order === 'admin-first') finishWorker();
    assert.equal(currentCampaign.requires_approval, true);
    assert.equal(currentPublication.status, 'review', 'enabled approval must never leave the completed publication queued');
    assert.equal(response.status, 200);
    assert.equal(policyWasAtomic, true);
  });
}
test('publication editing rejects invalid schedules and unknown status bypasses', async () => {
  for (const body of [{ scheduledFor: 'yesterday' }, { scheduledFor: '2020-01-01T00:00:00Z' }, { status: 'published' }, { hashtags: 'study' }, { requiresApproval: 'false' }, { requiresApproval: null }]) {
    const { handlers, writes } = setup();
    assert.equal((await handlers.patchPublication(request(body), publicationId)).status, 400);
    assert.equal(writes.length, 0);
  }
});
test('publication privacy rejects arrays instead of coercing them to an allowed string', async () => {
  const { handlers, writes } = setup();
  assert.equal((await handlers.patchPublication(request({ privacy: ['public'] }), publicationId)).status, 400);
  assert.equal(writes.length, 0);
});
test('TikTok publication privacy cannot be changed away from the acknowledged SELF_ONLY test mode', async () => {
  const tiktok = { ...publication, platform: 'tiktok' as const, copy_json: { ...publication.copy_json, privacy: 'SELF_ONLY' } };
  const { handlers, writes } = setup({ getPublication: async () => tiktok });
  assert.equal((await handlers.patchPublication(request({ privacy: 'PUBLIC_TO_EVERYONE' }), publicationId)).status, 400);
  assert.equal(writes.length, 0);
});
test('editing copy preserves an unchanged schedule that is already due', async () => {
  const { handlers, writes } = setup({ getPublication: async () => ({ ...publication, scheduled_for: '2026-11-17T12:00:00Z' }) });
  assert.equal((await handlers.patchPublication(request({ caption: 'Updated copy' }), publicationId)).status, 200);
  assert.equal(writes.find((write) => write.entity === 'transitionPublication')!.input.scheduledFor, '2026-11-17T12:00:00Z');
});
test('authenticated malformed, binary, and oversized bodies cannot reach storage or data operations', async () => {
  const { handlers } = setup();
  assert.equal((await handlers.adminAsset(new Request('https://studio.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal((await handlers.adminAsset(new Request('https://studio.test', { method: 'POST', headers: { 'content-type': 'video/mp4' }, body: 'media' }))).status, 415);
  assert.equal((await handlers.adminAsset(request({ filename: 'x'.repeat(17000) }))).status, 413);
});
test('publication edits carry the previously validated state to the conditional update', async () => {
  const { handlers, writes } = setup();
  assert.equal((await handlers.patchPublication(request({ caption: 'Updated copy' }), publicationId)).status, 200);
  assert.deepEqual(writes.find((write) => write.entity === 'transitionPublication')!.input.expectedStatuses, ['review']);
});
test('a stale conditional publication edit returns 409 instead of exposing a database error', async () => {
  const { handlers } = setup({ transitionPublication: async () => { throw new ContentStudioConflictError(); } });
  assert.deepEqual(await handlers.patchPublication(request({ caption: 'Updated copy' }), publicationId), { status: 409, body: { error: 'Content Studio state changed; refresh and try again' } });
});
test('heartbeat records only validated machine metadata and claim uses its machine ID', async () => {
  let heartbeat: unknown;
  const { handlers } = setup({ upsertHeartbeat: async (value) => { heartbeat = value; }, claimJob: async (id) => { assert.equal(id, 'mac-1'); return null; } });
  assert.deepEqual(await handlers.heartbeat(request({ machineId: 'mac-1', version: '1.0', currentJobId: null, statusMessage: 'Idle' }, true)), { status: 200, body: { ok: true } });
  assert.deepEqual(heartbeat, { machineId: 'mac-1', version: '1.0', currentJobId: null, statusMessage: 'Idle' });
  assert.deepEqual(await handlers.claim(request({ machineId: 'mac-1' }, true)), { status: 200, body: { job: null } });
  assert.equal((await handlers.claim(request({ machineId: '' }, true))).status, 400);
});
test('signed source downloads are limited to the active render lease and its source assets', async () => {
  const active = { ...render, status: 'rendering' as const, lease_owner: 'mac-1', lease_expires_at: '2026-11-18T12:15:00Z' };
  const { handlers } = setup({ getRender: async () => active, getAsset: async () => ({ id: assetId, campaign_id: campaignId, storage_path: `uploads/${assetId}/clip.mp4`, mime_type: 'video/mp4', size_bytes: 100, original_filename: 'clip.mp4', created_at: now }), createSignedDownloadUrl: async (path) => `signed:${path}` });
  const body = { action: 'download', machineId: 'mac-1', jobKind: 'render', jobId: renderId, assetId };
  assert.deepEqual(await handlers.machineAsset(request(body, true)), { status: 200, body: { signedUrl: `signed:uploads/${assetId}/clip.mp4` } });
  assert.equal((await handlers.machineAsset(request({ ...body, machineId: 'other' }, true))).status, 403);
  assert.equal((await handlers.machineAsset(request({ ...body, assetId: publicationId }, true))).status, 403);
});
test('render uploads and publication downloads never sign a worker-provided path', async () => {
  const activeRender = { ...render, status: 'rendering' as const, lease_owner: 'mac-1', lease_expires_at: '2026-11-18T12:15:00Z' };
  const activePublication = { ...publication, status: 'publishing' as const, lease_owner: 'mac-1', lease_expires_at: '2026-11-18T12:15:00Z' };
  const { handlers } = setup({ getRender: async () => activeRender, getPublication: async () => activePublication, createSignedRenderUploadUrl: async (id) => ({ path: `renders/${id}/output.mp4`, signedUrl: 'signed-upload', token: 'upload-token' }), createSignedDownloadUrl: async (path) => `signed:${path}` });
  assert.equal((await handlers.machineAsset(request({ action: 'upload', machineId: 'mac-1', jobKind: 'render', jobId: renderId }, true))).status, 200);
  assert.deepEqual(await handlers.machineAsset(request({ action: 'download', machineId: 'mac-1', jobKind: 'publication', jobId: publicationId }, true)), { status: 200, body: { signedUrl: `signed:${outputPath}` } });
  assert.equal((await handlers.machineAsset(request({ action: 'upload', machineId: 'mac-1', jobKind: 'render', jobId: renderId, path: 'https://evil.test' }, true))).status, 400);
});
test('expired leases cannot request Storage URLs', async () => {
  const { handlers } = setup({ getRender: async () => ({ ...render, status: 'rendering', lease_owner: 'mac-1', lease_expires_at: '2020-01-01T00:00:00Z' }) });
  assert.equal((await handlers.machineAsset(request({ action: 'upload', machineId: 'mac-1', jobKind: 'render', jobId: renderId }, true))).status, 403);
});
test('render completion confirms the exact output path and applies approval gating to publications', async () => {
  let confirmed = false;
  let completed = false;
  const active = { ...render, status: 'rendering' as const, lease_owner: 'mac-1', lease_expires_at: '2026-11-18T12:15:00Z', output_path: null };
  const { handlers, writes } = setup({ getRender: async () => active, completeRender: async (id, input) => {
    assert.equal(confirmed, true);
    assert.equal(id, renderId);
    assert.deepEqual(input, { machineId: 'mac-1', status: 'review', outputPath, durationMs: 15000 });
    completed = true;
    return render;
  }, confirmRenderOutput: async (id) => { assert.equal(id, renderId); confirmed = true; } });
  assert.equal((await handlers.updateRender(request({ machineId: 'mac-1', status: 'review', outputPath, durationMs: 15000 }, true), renderId)).status, 200);
  assert.equal(confirmed, true);
  assert.equal(completed, true);
  assert.deepEqual(writes, [], 'no separate stale-snapshot transitions follow the atomic completion');
});
test('a concurrent approval enable during output confirmation leaves the publication in review', async () => {
  let requiresApproval = false;
  let publicationState: PublicationRow['status'] = 'draft';
  const active = { ...render, status: 'rendering' as const, lease_owner: 'mac-1', lease_expires_at: '2026-11-18T12:15:00Z', output_path: null };
  const { handlers } = setup({
    getRender: async () => active,
    getCampaign: async () => ({ ...campaign, status: 'queued', requires_approval: requiresApproval }),
    listPublications: async () => [{ ...publication, status: publicationState }],
    confirmRenderOutput: async () => { requiresApproval = true; },
    // The transaction boundary reads the current policy; it never accepts a
    // route's pre-confirmation approval snapshot as an input.
    completeRender: async () => {
      assert.equal(requiresApproval, true);
      publicationState = 'review';
      return render;
    },
    transitionPublication: async (_id, input) => {
      publicationState = input.status;
      return { ...publication, status: input.status };
    },
  });
  assert.equal((await handlers.updateRender(request({ machineId: 'mac-1', status: 'review', outputPath, durationMs: 15000 }, true), renderId)).status, 200);
  assert.equal(publicationState, 'review', 'the stale pre-confirmation policy must never queue the publication');
});
test('worker completion rejects remote output URLs, unsupported states, and foreign leases before mutations', async () => {
  for (const body of [
    { machineId: 'mac-1', status: 'review', outputPath: 'https://evil.test/output.mp4', durationMs: 15 },
    { machineId: 'mac-1', status: 'published', outputPath, durationMs: 15 },
    { machineId: 'other', status: 'failed' },
  ]) {
    const { handlers, writes } = setup({ getRender: async () => ({ ...render, status: 'rendering', lease_owner: 'mac-1', lease_expires_at: '2026-11-18T12:15:00Z' }) });
    assert.ok([400, 403].includes((await handlers.updateRender(request(body, true), renderId)).status));
    assert.equal(writes.length, 0);
  }
});
test('publication completion preserves provider IDs and restricts worker state changes', async () => {
  const active = { ...publication, status: 'publishing' as const, lease_owner: 'mac-1', lease_expires_at: '2026-11-18T12:15:00Z' };
  const { handlers, writes } = setup({ getPublication: async () => active });
  assert.equal((await handlers.updatePublication(request({ machineId: 'mac-1', status: 'published', externalPostId: 'provider-42', publicUrl: 'https://social.test/42' }, true), publicationId)).status, 200);
  const transition = writes.find((write) => write.entity === 'transitionPublication')!;
  assert.equal(transition.input.externalPostId, 'provider-42');
  assert.equal(transition.input.publishedAt, now);
  assert.equal((await handlers.updatePublication(request({ machineId: 'mac-1', status: 'review' }, true), publicationId)).status, 400);
});
test('unexpected service errors never expose secrets to callers', async () => {
  const { handlers } = setup({ listQueue: async () => { throw new Error('service_role_secret'); } });
  assert.deepEqual(await handlers.listCampaigns(request()), { status: 500, body: { error: 'Content Studio request failed' } });
});

registerHooks({ resolve(specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  return nextResolve(specifier, context);
} });

test('heartbeat reads select only safe freshness fields in a bounded newest-first query', async (t) => {
  // @ts-expect-error Node's strip-types runner requires the .ts extension.
  const { studioStore } = await import('./route-store.ts');
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://studio-db.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const parsed = new URL(new Request(url, init).url);
    assert.equal(parsed.pathname, '/rest/v1/content_studio_worker_heartbeats');
    assert.equal(parsed.searchParams.get('select'), 'machine_id,last_seen_at');
    assert.equal(parsed.searchParams.get('order'), 'last_seen_at.desc');
    assert.equal(parsed.searchParams.get('limit'), '10');
    return Response.json([{ machine_id: 'mac-1', last_seen_at: now }]);
  });
  assert.deepEqual(await studioStore.listWorkerHeartbeats(), [{ machine_id: 'mac-1', last_seen_at: now }]);
});

test('heartbeat adapter writes a server timestamp and upserts by machine identity', async (t) => {
  // @ts-expect-error Node's strip-types runner requires the .ts extension.
  const { studioStore } = await import('./route-store.ts');
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://studio-db.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  let observed = false;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const req = new Request(url, init);
    const parsed = new URL(req.url);
    assert.equal(parsed.pathname, '/rest/v1/content_studio_worker_heartbeats');
    assert.equal(parsed.searchParams.get('on_conflict'), 'machine_id');
    const body = await req.json();
    assert.equal(body.machine_id, 'mac-1');
    assert.equal(body.current_job_id, renderId);
    assert.equal(body.version, '1.0');
    assert.equal(body.status_message, 'Rendering');
    assert.ok(Number.isFinite(Date.parse(body.last_seen_at)));
    observed = true;
    return new Response(null, { status: 204 });
  });
  await studioStore.upsertHeartbeat({ machineId: 'mac-1', version: '1.0', currentJobId: renderId, statusMessage: 'Rendering' });
  assert.equal(observed, true);
});
test('render confirmation requires the exact output object in the private bucket', async (t) => {
  // @ts-expect-error Node's strip-types runner requires the .ts extension.
  const { studioStore } = await import('./route-store.ts');
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://studio-db.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });
  let files: unknown[] = [{ id: 'file-id', name: 'output.mp4', metadata: { size: 100, mimetype: 'video/mp4' } }];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const req = new Request(url, init);
    assert.equal(new URL(req.url).pathname, '/storage/v1/object/list/content-studio');
    const body = await req.json();
    assert.equal(body.prefix, `renders/${renderId}`);
    assert.equal(body.search, 'output.mp4');
    return Response.json(files);
  });
  await studioStore.confirmRenderOutput(renderId);
  files = [{ id: 'file-id', name: 'other-output.mp4', metadata: { size: 100, mimetype: 'video/mp4' } }];
  await assert.rejects(studioStore.confirmRenderOutput(renderId), /not been confirmed/);
  files = [{ id: 'file-id', name: 'output.mp4', metadata: { size: 0, mimetype: 'text/html' } }];
  await assert.rejects(studioStore.confirmRenderOutput(renderId), /metadata/);
});
