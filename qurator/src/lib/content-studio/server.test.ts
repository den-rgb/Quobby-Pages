import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Installed Node 20 typings predate Node 25's synchronous module hooks.
import { registerHooks } from 'node:module';

// Next replaces this marker at build time; Node tests run the server module directly.
registerHooks({ resolve(specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true };
  return nextResolve(specifier, context);
} });
// @ts-expect-error Node's strip-types runner requires the .ts extension.
const studio = await import('./server.ts');
// @ts-expect-error Node's strip-types runner requires the .ts extension.
const { ContentStudioInputError } = await import('./errors.ts');

const campaignId = '11111111-1111-4111-8111-111111111111';
const renderId = '22222222-2222-4222-8222-222222222222';
const publicationId = '33333333-3333-4333-8333-333333333333';
const assetId = '44444444-4444-4444-8444-444444444444';
const sourceAsset = { id: assetId, campaign_id: null, mime_type: 'video/mp4', size_bytes: 100 };
const timestamp = '2026-11-18T12:00:00.000Z';
const spec = { templateId: 'focus-blocker-problem-solution', templateVersion: 1, title: 'Study', hook: 'Focus', cta: 'Try it', voiceText: 'Keep studying.', sourceAssetIds: [assetId] };
const input = { templateId: spec.templateId, title: spec.title, hook: spec.hook, cta: spec.cta, voiceText: spec.voiceText, sourceAssetIds: spec.sourceAssetIds, platforms: ['instagram'], requiresApproval: true };
const campaign = { id: campaignId, title: 'Study', template_id: spec.templateId, template_version: 1, requires_approval: true, approved_at: null, status: 'draft', render_spec: spec, created_by: 'admin-1', created_at: timestamp, updated_at: timestamp };
const lease = { lease_owner: null, lease_expires_at: null, attempt_count: 0, error_code: null, error_message: null, created_at: timestamp, updated_at: timestamp };
const render = { ...lease, id: renderId, campaign_id: campaignId, render_spec: spec, status: 'draft', output_path: null, duration_ms: null };
const publication = { ...lease, id: publicationId, render_id: renderId, platform: 'instagram', copy_json: { title: 'Study', caption: 'Focus\n\nTry it', hashtags: [] }, scheduled_for: null, status: 'draft', external_post_id: null, public_url: null, published_at: null };
const actor = { type: 'admin' as const, id: 'admin-1' };
const audit = { path: '/rest/v1/rpc/content_studio_record_transition', method: 'POST', data: 'audit-id' };

interface Step { path: string; method: string; data: unknown; status?: number }
interface Observed { url: URL; method: string; body: Record<string, unknown>; headers: Headers }
function api(t: TestContext, steps: Step[]) {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://studio-db.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
  const observed: Observed[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const request = new Request(url, init);
    const body = request.method === 'GET' ? {} : await request.json();
    observed.push({ url: new URL(request.url), method: request.method, body, headers: request.headers });
    const step = steps[observed.length - 1];
    assert.ok(step, `Unexpected ${request.method} ${request.url}`);
    assert.equal(new URL(request.url).pathname, step.path);
    assert.equal(request.method, step.method);
    // Provider lookups are direct fetches; only Supabase requests carry the service key.
    if (new URL(request.url).hostname === 'studio-db.test') assert.equal(request.headers.get('apikey'), 'test-service-role');
    return new Response(JSON.stringify(step.data), { status: step.status ?? 200, headers: { 'content-type': 'application/json' } });
  });
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    assert.equal(observed.length, steps.length, 'all expected boundary requests happened');
  });
  return observed;
}

test('creates a complete immutable campaign before exposing its render to workers', async (t) => {
  const requests = api(t, [
    { path: '/rest/v1/content_studio_assets', method: 'GET', data: [sourceAsset] },
    { path: '/rest/v1/content_studio_campaigns', method: 'POST', data: campaign }, audit,
    { path: '/rest/v1/content_studio_renders', method: 'POST', data: render }, audit,
    { path: '/rest/v1/content_studio_publications', method: 'POST', data: [publication] }, audit,
    { path: '/rest/v1/content_studio_assets', method: 'PATCH', data: [{ id: assetId }] },
    { path: '/rest/v1/content_studio_campaigns', method: 'GET', data: campaign },
    { path: '/rest/v1/content_studio_campaigns', method: 'PATCH', data: { ...campaign, status: 'queued' } }, audit,
    { path: '/rest/v1/content_studio_renders', method: 'GET', data: render },
    { path: '/rest/v1/content_studio_renders', method: 'PATCH', data: { ...render, status: 'queued' } }, audit,
  ]);
  const result = await studio.createCampaign(input, 'admin-1');
  assert.equal(result.campaign.status, 'queued');
  assert.equal(result.render.id, renderId);
  assert.deepEqual(result.publications, [publication]);
  assert.deepEqual(requests[1].body, { title: 'Study', template_id: 'focus-blocker-problem-solution', template_version: 1, requires_approval: true, status: 'draft', render_spec: spec, created_by: 'admin-1' });
  assert.deepEqual(requests[3].body, { campaign_id: campaignId, status: 'draft', render_spec: spec });
  assert.deepEqual(requests[5].body, [{ render_id: renderId, platform: 'instagram', copy_json: { title: 'Study', caption: 'Focus\n\nTry it', hashtags: [] }, scheduled_for: null, status: 'draft' }]);
  assert.equal(requests[0].url.searchParams.get('campaign_id'), 'is.null');
  assert.equal(requests[7].url.searchParams.get('campaign_id'), 'is.null');
  assert.equal(requests[2].body.p_new_status, 'draft');
  assert.equal(requests[6].body.p_publication_id, publicationId);
  assert.equal(requests[13].body.p_new_status, 'queued');
});
const pixabayVideo = { id: 325416, pageURL: 'https://pixabay.com/videos/id-325416/', user: 'asifsharif', user_id: 40661824, duration: 9, videos: { tiny: { url: 'https://cdn.pixabay.com/video/2024/01/01/325416.mp4', width: 960, height: 540, size: 1_000_000 } } };
const memeClipRow = { id: '55555555-5555-4555-8555-555555555555', provider: 'pixabay', video_id: 325416, label: 'Cabin confusion', page_url: 'https://pixabay.com/videos/id-325416/', author: 'asifsharif', author_url: 'https://pixabay.com/users/asifsharif-40661824/', file_url: 'https://cdn.pixabay.com/video/2024/01/01/325416.mp4', portrait: false, active: true, created_at: timestamp };

test('a curated clip is resolved from the provider and stored with its credits', async (t) => {
  const oldKey = process.env.PIXABAY_API_KEY;
  process.env.PIXABAY_API_KEY = 'pixabay-test-key';
  t.after(() => { if (oldKey === undefined) delete process.env.PIXABAY_API_KEY; else process.env.PIXABAY_API_KEY = oldKey; });
  const requests = api(t, [
    { path: '/api/videos/', method: 'GET', data: { totalHits: 1, hits: [pixabayVideo] } },
    { path: '/rest/v1/content_studio_meme_clips', method: 'POST', data: memeClipRow },
  ]);
  const stored = await studio.addMemeClip({ provider: 'pixabay', videoId: 325416, label: 'Cabin confusion' }, 'admin-1');
  assert.equal(stored.id, memeClipRow.id);
  assert.equal(requests[0].url.searchParams.get('id'), '325416');
  assert.deepEqual(requests[1].body, {
    provider: 'pixabay', video_id: 325416, label: 'Cabin confusion',
    page_url: 'https://pixabay.com/videos/id-325416/', author: 'asifsharif',
    author_url: 'https://pixabay.com/users/asifsharif-40661824/',
    file_url: 'https://cdn.pixabay.com/video/2024/01/01/325416.mp4', portrait: false, created_by: 'admin-1',
  });
});

test('duplicate clips and a missing library table are reported as input errors', async (t) => {
  const oldKey = process.env.PIXABAY_API_KEY;
  process.env.PIXABAY_API_KEY = 'pixabay-test-key';
  t.after(() => { if (oldKey === undefined) delete process.env.PIXABAY_API_KEY; else process.env.PIXABAY_API_KEY = oldKey; });
  api(t, [
    { path: '/api/videos/', method: 'GET', data: { totalHits: 1, hits: [pixabayVideo] } },
    { path: '/rest/v1/content_studio_meme_clips', method: 'POST', data: { code: '23505', message: 'duplicate key value' }, status: 409 },
  ]);
  await assert.rejects(studio.addMemeClip({ provider: 'pixabay', videoId: 325416, label: 'Cabin confusion' }, 'admin-1'), /already in the library/);

  const missing = api(t, [
    { path: '/rest/v1/content_studio_meme_clips', method: 'GET', data: { code: 'PGRST205', message: "Could not find the table 'public.content_studio_meme_clips'" }, status: 404 },
  ]);
  assert.deepEqual(await studio.memeLibraryClips(), []);
  // Generation keeps working while the migration is unapplied.
  assert.equal(missing[0].url.pathname, '/rest/v1/content_studio_meme_clips');
});

test('persists the only permitted TikTok privacy as SELF_ONLY after private-test acknowledgement', async (t) => {
  const tiktokPublication = { ...publication, platform: 'tiktok', copy_json: { ...publication.copy_json, privacy: 'SELF_ONLY' } };
  const requests = api(t, [
    { path: '/rest/v1/content_studio_assets', method: 'GET', data: [sourceAsset] },
    { path: '/rest/v1/content_studio_campaigns', method: 'POST', data: campaign }, audit,
    { path: '/rest/v1/content_studio_renders', method: 'POST', data: render }, audit,
    { path: '/rest/v1/content_studio_publications', method: 'POST', data: [tiktokPublication] }, audit,
    { path: '/rest/v1/content_studio_assets', method: 'PATCH', data: [{ id: assetId }] },
    { path: '/rest/v1/content_studio_campaigns', method: 'GET', data: campaign },
    { path: '/rest/v1/content_studio_campaigns', method: 'PATCH', data: { ...campaign, status: 'queued' } }, audit,
    { path: '/rest/v1/content_studio_renders', method: 'GET', data: render },
    { path: '/rest/v1/content_studio_renders', method: 'PATCH', data: { ...render, status: 'queued' } }, audit,
  ]);
  await studio.createCampaign({ ...input, platforms: ['tiktok'], tiktokPrivateTest: true }, 'admin-1');
  assert.deepEqual(requests[5].body, [{ render_id: renderId, platform: 'tiktok', copy_json: { title: 'Study', caption: 'Focus\n\nTry it', hashtags: [], privacy: 'SELF_ONLY' }, scheduled_for: null, status: 'draft' }]);
});
test('rejects campaign input and unavailable source assets before creating rows', async (t) => {
  api(t, [{ path: '/rest/v1/content_studio_assets', method: 'GET', data: [] }]);
  await assert.rejects(studio.createCampaign({ ...input, title: '' }, 'admin-1'), /Title must/);
  await assert.rejects(studio.createCampaign(input, 'admin-1'), { constructor: ContentStudioInputError, message: 'Source assets must exist and be unassigned.' });
});
test('normalizes UUID casing before deduplication while preserving recording and optional source order', async (t) => {
  const recordingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const imageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const sourceAssetIds = [recordingId, imageId];
  const requests = api(t, [
    { path: '/rest/v1/content_studio_assets', method: 'GET', data: [{ ...sourceAsset, id: imageId, mime_type: 'image/png' }, { ...sourceAsset, id: recordingId }] },
    { path: '/rest/v1/content_studio_campaigns', method: 'POST', data: campaign }, audit,
    { path: '/rest/v1/content_studio_renders', method: 'POST', data: render }, audit,
    { path: '/rest/v1/content_studio_publications', method: 'POST', data: [publication] }, audit,
    { path: '/rest/v1/content_studio_assets', method: 'PATCH', data: sourceAssetIds.map((id) => ({ id })) },
    { path: '/rest/v1/content_studio_campaigns', method: 'GET', data: campaign },
    { path: '/rest/v1/content_studio_campaigns', method: 'PATCH', data: { ...campaign, status: 'queued' } }, audit,
    { path: '/rest/v1/content_studio_renders', method: 'GET', data: render },
    { path: '/rest/v1/content_studio_renders', method: 'PATCH', data: { ...render, status: 'queued' } }, audit,
  ]);
  await studio.createCampaign({ ...input, sourceAssetIds: [recordingId.toUpperCase(), imageId, recordingId, imageId.toUpperCase()] }, 'admin-1');
  assert.equal(requests[0].url.searchParams.get('id'), `in.(${sourceAssetIds.join(',')})`);
  assert.equal(requests[7].url.searchParams.get('id'), `in.(${sourceAssetIds.join(',')})`);
  assert.deepEqual(requests[1].body.render_spec, { ...spec, sourceAssetIds });
  assert.deepEqual(requests[3].body.render_spec, { ...spec, sourceAssetIds });
});
test('rejects a missing source lookup as client input even when the response has the expected row count', async (t) => {
  api(t, [{ path: '/rest/v1/content_studio_assets', method: 'GET', data: [{ ...sourceAsset, id: campaignId }] }]);
  await assert.rejects(studio.createCampaign(input, 'admin-1'), { constructor: ContentStudioInputError, message: 'Source assets must exist and be unassigned.' });
});
test('stops queue activation when an audit fails', async (t) => {
  api(t, [
    { path: '/rest/v1/content_studio_assets', method: 'GET', data: [sourceAsset] },
    { path: '/rest/v1/content_studio_campaigns', method: 'POST', data: campaign },
    { ...audit, status: 500, data: { message: 'audit unavailable' } },
  ]);
  await assert.rejects(studio.createCampaign(input, 'admin-1'), /record transition.*audit unavailable/i);
});
for (const [label, types, message] of [
  ['two audio files', ['audio/wav', 'audio/mpeg'], /at most one optional background audio/],
  ['nine images', Array(9).fill('image/png'), /at most eight optional images/],
  ['an extra recording', ['video/mp4'], /Optional sources/],
] as const) {
  test(`rejects ${label} before creating campaign rows`, async (t) => {
    const extras = types.map((mime_type, index) => ({ ...sourceAsset, id: `55555555-5555-4555-8555-${String(index).padStart(12, '0')}`, mime_type }));
    api(t, [{ path: '/rest/v1/content_studio_assets', method: 'GET', data: [...extras, sourceAsset] }]);
    await assert.rejects(studio.createCampaign({ ...input, sourceAssetIds: [assetId, ...extras.map((asset) => asset.id)] }, 'admin-1'), message);
  });
}
test('lists the newest 100 campaigns with render and publication summaries', async (t) => {
  const row = { ...campaign, content_studio_renders: [{ ...render, content_studio_publications: [publication] }] };
  const requests = api(t, [{ path: '/rest/v1/content_studio_campaigns', method: 'GET', data: [row] }]);
  assert.deepEqual(await studio.listQueue(), [row]);
  assert.equal(requests[0].url.searchParams.get('limit'), '100');
  assert.equal(requests[0].url.searchParams.get('order'), 'created_at.desc');
  assert.match(requests[0].url.searchParams.get('select')!, /content_studio_renders\(\*,content_studio_publications\(\*\)\)/);
});
test('claims render jobs only through the atomic claim RPC and immediately audits the claim', async (t) => {
  const job = { kind: 'render', id: renderId, render_id: renderId, campaign_id: campaignId, render_spec: spec, output_path: null, platform: null, copy_json: null };
  const requests = api(t, [{ path: '/rest/v1/rpc/content_studio_claim_job', method: 'POST', data: job }, audit]);
  assert.deepEqual(await studio.claimJob('mac-1'), job);
  assert.deepEqual(requests[0].body, { p_machine_id: 'mac-1' });
  assert.deepEqual(requests[1].body, { p_campaign_id: campaignId, p_render_id: renderId, p_publication_id: null, p_actor_type: 'worker', p_actor_id: 'mac-1', p_event_name: 'job_claimed', p_old_status: 'queued', p_new_status: 'rendering', p_details: {} });
});
test('an empty queue needs no audit, and a blank machine ID never calls the database', async (t) => {
  api(t, [{ path: '/rest/v1/rpc/content_studio_claim_job', method: 'POST', data: null }]);
  await assert.rejects(studio.claimJob(' '), /Machine ID is required/);
  assert.equal(await studio.claimJob('mac-1'), null);
});
test('audits publication claims without inventing the prior queue state', async (t) => {
  const job = { kind: 'publication', id: publicationId, render_id: renderId, campaign_id: campaignId, render_spec: spec, output_path: `renders/${renderId}/output.mp4`, platform: 'instagram', copy_json: publication.copy_json };
  const requests = api(t, [
    { path: '/rest/v1/rpc/content_studio_claim_job', method: 'POST', data: job }, audit,
  ]);
  await studio.claimJob('mac-1');
  assert.equal(requests[1].body.p_publication_id, publicationId);
  // Task 1 does not return queued vs scheduled: do not invent a prior state.
  assert.equal(requests[1].body.p_old_status, null);
  assert.equal(requests[1].body.p_new_status, 'publishing');
});
test('writes campaign status and approval metadata with an audit carrying both states', async (t) => {
  const requests = api(t, [
    { path: '/rest/v1/content_studio_campaigns', method: 'GET', data: { ...campaign, status: 'review' } },
    { path: '/rest/v1/content_studio_campaigns', method: 'PATCH', data: { ...campaign, status: 'scheduled', approved_at: timestamp } }, audit,
  ]);
  await studio.transitionCampaign(campaignId, { status: 'scheduled', approvedAt: timestamp, actor, eventName: 'approved', details: { reason: 'Ready' } });
  assert.equal(requests[1].url.searchParams.get('status'), 'eq.review');
  assert.equal(requests[1].body.approved_at, timestamp);
  assert.equal(requests[2].body.p_old_status, 'review');
  assert.equal(requests[2].body.p_new_status, 'scheduled');
  assert.deepEqual(requests[2].body.p_details, { reason: 'Ready' });
});
test('a publication that became terminal before the helper lookup cannot be edited', async (t) => {
  api(t, [{ path: '/rest/v1/content_studio_publications', method: 'GET', data: { ...publication, status: 'published' } }]);
  await assert.rejects(studio.transitionPublication(publicationId, { status: 'review', expectedStatuses: ['review'], actor }), /changed.*refresh/i);
});
test('expected publication states remain in the database update predicate during a race', async (t) => {
  const requests = api(t, [
    { path: '/rest/v1/content_studio_publications', method: 'GET', data: { ...publication, status: 'queued' } },
    { path: '/rest/v1/content_studio_publications', method: 'PATCH', status: 406, data: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } },
  ]);
  await assert.rejects(studio.transitionPublication(publicationId, { status: 'review', expectedStatuses: ['review', 'queued'], actor }), /changed.*refresh/i);
  const predicates = requests[1].url.searchParams.getAll('status');
  assert.ok(predicates.includes('eq.queued'));
  assert.ok(predicates.includes('in.(review,queued)'));
});
test('an explicitly empty expected-state set fails before any database operation', async (t) => {
  api(t, []);
  await assert.rejects(studio.transitionPublication(publicationId, { status: 'review', expectedStatuses: [], actor }), /nonempty/i);
});
test('a worker render completion delegates mutation-time lease checks and atomic auditing to SQL', async (t) => {
  const active = { ...render, status: 'rendering', lease_owner: 'mac-1', lease_expires_at: '2099-11-18T13:00:00.000Z' };
  const requests = api(t, [
    { path: '/rest/v1/content_studio_renders', method: 'GET', data: active },
    { path: '/rest/v1/rpc/content_studio_transition_job', method: 'POST', data: { ...active, status: 'review', lease_owner: null, lease_expires_at: null } },
  ]);
  await studio.transitionRender(renderId, { status: 'review', outputPath: `renders/${renderId}/output.mp4`, durationMs: 15000, actor: { type: 'worker', id: 'mac-1' } });
  assert.deepEqual(requests[1].body, {
    p_job_kind: 'render', p_job_id: renderId, p_machine_id: 'mac-1', p_status: 'review',
    p_patch: { output_path: `renders/${renderId}/output.mp4`, duration_ms: 15000 },
    p_event_name: 'status_changed', p_details: {},
  });
});
test('atomic render completion sends no application approval snapshot to SQL', async (t) => {
  const requests = api(t, [{ path: '/rest/v1/rpc/content_studio_complete_render', method: 'POST', data: { ...render, status: 'review' } }]);
  const completed = await studio.completeRender(renderId, { machineId: 'mac-1', status: 'review', outputPath: `renders/${renderId}/output.mp4`, durationMs: 15000 });
  assert.equal(completed.status, 'review');
  assert.deepEqual(requests[0].body, { p_render_id: renderId, p_machine_id: 'mac-1', p_status: 'review', p_patch: { output_path: `renders/${renderId}/output.mp4`, duration_ms: 15000 } });
});
test('approval policy changes use one guarded RPC without application render snapshots', async (t) => {
  const requests = api(t, [{ path: '/rest/v1/rpc/content_studio_set_approval_policy', method: 'POST', data: { ...campaign, requires_approval: true, status: 'review' } }]);
  const updated = await studio.setApprovalPolicy(campaignId, { adminId: 'admin-1', requiresApproval: true, expectedStatuses: ['queued'] });
  assert.equal(updated.status, 'review');
  assert.deepEqual(requests[0].body, { p_campaign_id: campaignId, p_admin_id: 'admin-1', p_requires_approval: true, p_expected_statuses: ['queued'] });
});
test('campaign review delegates all campaign and publication state to one guarded RPC', async (t) => {
  const requests = api(t, [{ path: '/rest/v1/rpc/content_studio_review_campaign', method: 'POST', data: { ...campaign, status: 'queued', approved_at: timestamp } }]);
  const updated = await studio.reviewCampaign(campaignId, { adminId: 'admin-1', action: 'approve' });
  assert.equal(updated.status, 'queued');
  assert.deepEqual(requests[0].body, { p_campaign_id: campaignId, p_admin_id: 'admin-1', p_action: 'approve' });
});
test('publication retry delegates approval/schedule eligibility to one guarded RPC', async (t) => {
  const failed = { ...publication, status: 'failed', error_code: 'publication-retryable', error_message: 'temporary provider issue' };
  const requests = api(t, [{ path: '/rest/v1/rpc/content_studio_retry_publication', method: 'POST', data: { ...failed, status: 'review', error_code: null, error_message: null } }]);
  const updated = await studio.retryPublication(publicationId, { adminId: 'admin-1' });
  assert.equal(updated.status, 'review');
  assert.deepEqual(requests[0].body, { p_publication_id: publicationId, p_admin_id: 'admin-1' });
});
test('an approval policy state conflict remains a refreshable conflict', async (t) => {
  api(t, [{ path: '/rest/v1/rpc/content_studio_set_approval_policy', method: 'POST', status: 409, data: { code: '40001', message: 'Campaign state changed' } }]);
  await assert.rejects(studio.setApprovalPolicy(campaignId, { adminId: 'admin-1', requiresApproval: true, expectedStatuses: ['queued'] }), /state changed; refresh/);
});
test('refuses a stale or foreign worker lease without mutating a job', async (t) => {
  api(t, [
    { path: '/rest/v1/content_studio_renders', method: 'GET', data: { ...render, status: 'rendering', lease_owner: 'other', lease_expires_at: '2099-01-01T00:00:00Z' } },
    { path: '/rest/v1/content_studio_renders', method: 'GET', data: { ...render, status: 'rendering', lease_owner: 'mac-1', lease_expires_at: '2020-01-01T00:00:00Z' } },
  ]);
  await assert.rejects(studio.transitionRender(renderId, { status: 'failed', actor: { type: 'worker', id: 'mac-1' } }), /active lease/);
  await assert.rejects(studio.transitionRender(renderId, { status: 'failed', actor: { type: 'worker', id: 'mac-1' } }), /active lease/);
});
test('rejects a malformed worker lease expiry instead of treating it as active', async (t) => {
  api(t, [{ path: '/rest/v1/content_studio_renders', method: 'GET', data: { ...render, status: 'rendering', lease_owner: 'mac-1', lease_expires_at: 'not-a-date' } }]);
  await assert.rejects(studio.transitionRender(renderId, { status: 'failed', actor: { type: 'worker', id: 'mac-1' } }), /active lease/);
});
for (const kind of ['render', 'publication'] as const) {
  test(`a delayed ${kind} completion cannot use a lease that expired after prevalidation`, async (t) => {
    api(t, []);
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(timestamp) });
    const id = kind === 'render' ? renderId : publicationId;
    const active = { ...(kind === 'render' ? render : publication), status: kind === 'render' ? 'rendering' : 'publishing', lease_owner: 'mac-1', lease_expires_at: '2026-11-18T12:00:01.000Z' };
    let mutated = false;
    t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
      const request = new Request(url, init);
      const parsedUrl = new URL(request.url);
      if (request.method === 'GET') return Response.json(active);
      if (parsedUrl.pathname.endsWith('/content_studio_record_transition')) return Response.json('audit-id');
      // Simulate transport delay after application validation, before the database statement.
      t.mock.timers.tick(2000);
      if (request.method === 'PATCH') {
        const cutoff = parsedUrl.searchParams.get('lease_expires_at')!.slice(3);
        mutated = Date.parse(active.lease_expires_at) > Date.parse(cutoff);
        return Response.json({ ...active, status: 'failed' });
      }
      assert.equal(parsedUrl.pathname, '/rest/v1/rpc/content_studio_transition_job');
      const body = await request.json();
      assert.equal(body.p_job_kind, kind);
      assert.equal(body.p_job_id, id);
      assert.equal('lease_expires_at' in body.p_patch, false);
      return Response.json({ code: '42501', message: 'Worker must own the active lease.' }, { status: 403 });
    });
    const complete = kind === 'render' ? studio.transitionRender : studio.transitionPublication;
    await assert.rejects(complete(id, { status: 'failed', actor: { type: 'worker', id: 'mac-1' } }), /active lease/);
    assert.equal(mutated, false);
  });
}
test('a worker output reference must be the server-generated private path for that render', async (t) => {
  api(t, []);
  for (const outputPath of ['https://remote.test/output.mp4', `renders/${campaignId}/output.mp4`, `renders/${renderId}/other.mp4`]) {
    await assert.rejects(studio.transitionRender(renderId, { status: 'review', outputPath, actor }), /generated render output path/);
  }
});
test('delegates intermediate publication updates and atomic auditing to the worker RPC', async (t) => {
  const active = { ...publication, status: 'publishing', lease_owner: 'mac-1', lease_expires_at: '2099-01-01T00:00:00Z' };
  const requests = api(t, [
    { path: '/rest/v1/content_studio_publications', method: 'GET', data: active },
    { path: '/rest/v1/rpc/content_studio_transition_job', method: 'POST', data: active },
  ]);
  await studio.transitionPublication(publicationId, { status: 'publishing', externalPostId: 'provider-42', actor: { type: 'worker', id: 'mac-1' } });
  assert.deepEqual(requests[1].body, {
    p_job_kind: 'publication', p_job_id: publicationId, p_machine_id: 'mac-1', p_status: 'publishing',
    p_patch: { external_post_id: 'provider-42' }, p_event_name: 'status_changed', p_details: {},
  });
});
test('surfaces a worker RPC audit error without issuing a second transition', async (t) => {
  api(t, [
    { path: '/rest/v1/content_studio_renders', method: 'GET', data: { ...render, status: 'rendering', lease_owner: 'mac-1', lease_expires_at: '2099-01-01T00:00:00Z' } },
    { path: '/rest/v1/rpc/content_studio_transition_job', method: 'POST', status: 500, data: { message: 'audit unavailable' } },
  ]);
  await assert.rejects(studio.transitionRender(renderId, { status: 'failed', actor: { type: 'worker', id: 'mac-1' } }), /audit unavailable/);
});
test('records published IDs, URLs and time and clears the publication lease', async (t) => {
  const requests = api(t, [
    { path: '/rest/v1/content_studio_publications', method: 'GET', data: { ...publication, status: 'publishing' } },
    { path: '/rest/v1/content_studio_publications', method: 'PATCH', data: { ...publication, status: 'published' } }, audit,
  ]);
  await studio.transitionPublication(publicationId, { status: 'published', externalPostId: 'provider-42', publicUrl: 'https://social.test/post/42', publishedAt: timestamp, actor });
  assert.equal(requests[1].body.external_post_id, 'provider-42');
  assert.equal(requests[1].body.public_url, 'https://social.test/post/42');
  assert.equal(requests[1].body.published_at, timestamp);
  assert.equal(requests[1].body.lease_owner, null);
});
test('a publication cannot succeed until the provider returned an external ID', async (t) => {
  api(t, [{ path: '/rest/v1/content_studio_publications', method: 'GET', data: { ...publication, status: 'publishing' } }]);
  await assert.rejects(studio.transitionPublication(publicationId, { status: 'published', actor }), /external post ID/);
});
test('whitespace is not a provider post ID', async (t) => {
  api(t, [{ path: '/rest/v1/content_studio_publications', method: 'GET', data: { ...publication, status: 'publishing' } }]);
  await assert.rejects(studio.transitionPublication(publicationId, { status: 'published', externalPostId: '   ', actor }), /external post ID/);
});
test('refuses unknown statuses before any database work', async (t) => {
  api(t, []);
  // @ts-expect-error Exercise the runtime boundary with untrusted input.
  await assert.rejects(studio.transitionCampaign(campaignId, { status: 'invented', actor }), /supported status/);
});
test('surfaces transition update and audit failures', async (t) => {
  api(t, [
    { path: '/rest/v1/content_studio_campaigns', method: 'GET', data: campaign },
    { path: '/rest/v1/content_studio_campaigns', method: 'PATCH', data: { message: 'conflict' }, status: 409 },
    { path: '/rest/v1/content_studio_campaigns', method: 'GET', data: campaign },
    { path: '/rest/v1/content_studio_campaigns', method: 'PATCH', data: { ...campaign, status: 'failed' } },
    { ...audit, data: { message: 'audit unavailable' }, status: 500 },
  ]);
  await assert.rejects(studio.transitionCampaign(campaignId, { status: 'failed', actor }), /conflict/);
  await assert.rejects(studio.transitionCampaign(campaignId, { status: 'failed', actor }), /audit unavailable/);
});
test('signs private source uploads with server-generated UUID paths', async (t) => {
  const requests = api(t, [{ path: '/storage/v1/object/upload/sign/content-studio/uploads/generated', method: 'POST', data: {} }]);
  // Storage includes a random UUID path. Assert that boundary dynamically here.
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const request = new Request(url, init);
    const path = new URL(request.url).pathname;
    assert.match(path, /^\/storage\/v1\/object\/upload\/sign\/content-studio\/uploads\/[0-9a-f-]{36}\/screen_recording\.mp4$/);
    requests.push({ url: new URL(request.url), method: request.method, body: await request.json() });
    return Response.json({ url: `${path}?token=one-use-token` });
  });
  const result = await studio.createSignedUploadUrl('screen recording.mp4');
  assert.match(result.path, /^uploads\/[0-9a-f-]{36}\/screen_recording\.mp4$/);
  assert.equal(result.token, 'one-use-token');
  assert.match(result.signedUrl, /^https:\/\/studio-db.test\/storage\/v1\//);
});
test('signs downloads only from private relative paths for five minutes', async (t) => {
  const requests = api(t, [{ path: `/storage/v1/object/sign/content-studio/renders/${renderId}/output.mp4`, method: 'POST', data: { signedURL: '/object/sign/content-studio/output.mp4?token=download' } }]);
  const result = await studio.createSignedDownloadUrl(`renders/${renderId}/output.mp4`);
  assert.match(result, /token=download$/);
  assert.deepEqual(requests[0].body, { expiresIn: 300 });
  for (const path of ['https://other.test/file', '/absolute.mp4', '../secret', 'uploads/../secret', 'uploads\\secret', 'uploads/file?token=bad']) {
    await assert.rejects(studio.createSignedDownloadUrl(path), /private Storage path/);
  }
});
test('encoded traversal and URL control characters cannot escape the private bucket', async (t) => {
  api(t, []);
  for (const path of ['%2e%2e/other-bucket/secret', 'uploads/%2E%2E/secret', 'uploads/file\n.mp4', 'uploads/file%3Ftoken=bad']) {
    await assert.rejects(studio.createSignedDownloadUrl(path), /private Storage path/);
  }
});
test('signs render output uploads only at the generated MP4 path', async (t) => {
  const requests = api(t, [{ path: `/storage/v1/object/upload/sign/content-studio/renders/${renderId}/output.mp4`, method: 'POST', data: { url: `/object/upload/sign/content-studio/renders/${renderId}/output.mp4?token=render-upload` } }]);
  const result = await studio.createSignedRenderUploadUrl(renderId);
  assert.equal(result.path, `renders/${renderId}/output.mp4`);
  assert.equal(result.token, 'render-upload');
  assert.equal(requests[0].method, 'POST');
  // A completion request can be lost after Storage accepts the output. A
  // reclaimed lease may only replace this one canonical object, never choose
  // another path, so render recovery remains idempotent.
  assert.equal(requests[0].headers.get('x-upsert'), 'true');
  await assert.rejects(studio.createSignedRenderUploadUrl('../escape'), /valid render UUID/);
});
test('confirms the exact uploaded file before creating asset metadata', async (t) => {
  const path = `uploads/${assetId}/recording.mp4`;
  const asset = { id: assetId, campaign_id: null, storage_path: path, mime_type: 'video/mp4', size_bytes: 1000, original_filename: 'recording.mp4', created_at: timestamp };
  const requests = api(t, [
    { path: '/storage/v1/object/list/content-studio', method: 'POST', data: [{ name: 'recording.mp4', id: assetId, metadata: { size: 1000, mimetype: 'video/mp4' }, created_at: timestamp, updated_at: timestamp, last_accessed_at: timestamp }] },
    { path: '/rest/v1/content_studio_assets', method: 'POST', data: asset },
  ]);
  assert.deepEqual(await studio.createAsset({ storagePath: path, filename: 'recording.mp4', mimeType: 'video/mp4', sizeBytes: 1000 }), asset);
  assert.equal(requests[0].body.prefix, `uploads/${assetId}`);
  assert.deepEqual(requests[1].body, { storage_path: path, mime_type: 'video/mp4', size_bytes: 1000, original_filename: 'recording.mp4' });
});
test('rejects unconfirmed assets and invalid metadata', async (t) => {
  api(t, [{ path: '/storage/v1/object/list/content-studio', method: 'POST', data: [] }]);
  const metadata = { storagePath: `uploads/${assetId}/recording.mp4`, filename: 'recording.mp4', mimeType: 'video/mp4', sizeBytes: 1000 };
  await assert.rejects(studio.createAsset({ ...metadata, sizeBytes: 262144001 }), /250 MB/);
  await assert.rejects(studio.createAsset({ ...metadata, mimeType: 'text/html' }), /supported media/);
  await assert.rejects(studio.createAsset(metadata), /Upload has not been confirmed/);
});
test('does not trust declared upload size or MIME type when Storage metadata disagrees', async (t) => {
  const stored = { name: 'recording.mp4', id: assetId, metadata: { size: 2000, mimetype: 'video/quicktime' }, created_at: timestamp, updated_at: timestamp, last_accessed_at: timestamp };
  api(t, [{ path: '/storage/v1/object/list/content-studio', method: 'POST', data: [stored] }]);
  await assert.rejects(studio.createAsset({ storagePath: `uploads/${assetId}/recording.mp4`, filename: 'recording.mp4', mimeType: 'video/mp4', sizeBytes: 1000 }), /metadata does not match/);
});
