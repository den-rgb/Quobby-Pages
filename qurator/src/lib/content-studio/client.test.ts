import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { createCampaignWithAssets } from './client.ts';

const input = {
  templateId: 'flashcards-before-exam' as const, title: 'Study', hook: 'Exam soon?',
  cta: 'Try Quobby', voiceText: 'Study with flashcards.', platforms: ['instagram' as const], requiresApproval: true,
};

test('each signed asset upload is confirmed before creating the campaign with confirmed IDs', async () => {
  const calls: string[] = [];
  let asset = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls.push(`${init?.method} ${url}`);
    if (url === 'https://storage.test/signed') {
      assert.equal(init?.body instanceof File, true);
      assert.equal(new Headers(init?.headers).has('authorization'), false);
      assert.equal(init?.credentials, 'omit');
      return new Response('{}');
    }
    const body = JSON.parse(init?.body as string);
    if (body.action === 'upload') return Response.json({ path: `uploads/${++asset}/clip.mp4`, signedUrl: 'https://storage.test/signed', token: 'must-not-use' });
    if (body.action === 'confirm') {
      assert.equal(body.storagePath, `uploads/${asset}/clip.mp4`);
      return Response.json({ asset: { id: `asset-${asset}` } });
    }
    assert.deepEqual(body.sourceAssetIds, ['asset-1', 'asset-2']);
    assert.equal(body.requiresApproval, true);
    return Response.json({ campaignId: 'campaign-1', renderId: 'render-1' });
  };
  const created = await createCampaignWithAssets(input, [new File(['clip'], 'one.mp4', { type: 'video/mp4' }), new File(['image'], 'two.png', { type: 'image/png' })], undefined, fetcher);
  assert.deepEqual(created, { campaignId: 'campaign-1', renderId: 'render-1' });
  assert.deepEqual(calls, [
    'POST /api/admin/content-studio/assets', 'PUT https://storage.test/signed', 'POST /api/admin/content-studio/assets',
    'POST /api/admin/content-studio/assets', 'PUT https://storage.test/signed', 'POST /api/admin/content-studio/assets',
    'POST /api/admin/content-studio/campaigns',
  ]);
});

test('an invalid optional media combination makes no upload or campaign request', async () => {
  const fetcher: typeof fetch = async () => { assert.fail('invalid sources must be rejected before upload'); };
  await assert.rejects(createCampaignWithAssets(input, [
    new File(['clip'], 'one.mp4', { type: 'video/mp4' }),
    new File(['audio'], 'one.wav', { type: 'audio/wav' }),
    new File(['audio'], 'two.wav', { type: 'audio/wav' }),
  ], undefined, fetcher), /at most one optional background audio/);
});

test('a failed upload never confirms the asset or creates a campaign and hides storage response secrets', async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    calls.push(String(url));
    return url === '/api/admin/content-studio/assets'
      ? Response.json({ path: 'uploads/1/clip.mp4', signedUrl: 'https://storage.test/signed' })
      : new Response('secret-storage-credential', { status: 500 });
  };
  await assert.rejects(createCampaignWithAssets(input, [new File(['clip'], 'one.mp4', { type: 'video/mp4' })], undefined, fetcher), /^Error: Media upload failed\. Try again\.$/);
  assert.equal(calls.length, 2);
});
