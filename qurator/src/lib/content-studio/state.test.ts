import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { assertCampaignInput, nextPublicationStatus, isRetryablePlatformFailure } from './state.ts';

const now = new Date('2026-11-18T12:00:00.000Z');
const valid = {
  templateId: 'focus-blocker-problem-solution',
  title: 'Study with Quobby', hook: 'Keep your focus', cta: 'Try Quobby',
  voiceText: 'A calmer way to study.',
  sourceAssetIds: ['d9428888-122b-41e1-b85c-61cd3cbb3210'],
  platforms: ['instagram'], requiresApproval: true,
};

test('approval holds a rendered campaign in review', () => {
  assert.equal(nextPublicationStatus({ requiresApproval: true, renderSucceeded: true, approvedAt: null, scheduledFor: null }), 'review');
});
test('auto-publish campaigns schedule after render', () => {
  assert.equal(nextPublicationStatus({ requiresApproval: false, renderSucceeded: true, approvedAt: null, scheduledFor: '2026-11-19T09:00:00.000Z' }), 'scheduled');
});
test('approved renders queue without a schedule', () => {
  assert.equal(nextPublicationStatus({ requiresApproval: true, renderSucceeded: true, approvedAt: now.toISOString(), scheduledFor: null }), 'queued');
});
test('a failed render cannot become publishable', () => {
  assert.equal(nextPublicationStatus({ requiresApproval: false, renderSucceeded: false, approvedAt: null, scheduledFor: null }), 'failed');
});
test('only transient HTTP status codes are retryable', () => {
  for (const status of [408, 425, 429, 500, 503, 599]) assert.equal(isRetryablePlatformFailure(status), true, `${status}`);
  for (const status of [0, 200, 400, 401, 403, 404, 409, 499, 600, 500.5, NaN, Infinity]) assert.equal(isRetryablePlatformFailure(status), false, `${status}`);
});
test('accepts each curated template and all supported platforms', () => {
  for (const templateId of ['focus-blocker-problem-solution', 'flashcards-before-exam', 'study-streak-meme']) {
    assert.doesNotThrow(() => assertCampaignInput({ ...valid, templateId, platforms: ['instagram', 'tiktok', 'youtube'], tiktokPrivateTest: true }, now));
  }
});
test('allows TikTok only as an explicitly acknowledged SELF_ONLY private test', () => {
  assert.throws(() => assertCampaignInput({ ...valid, platforms: ['tiktok'] }, now), /private TikTok test/);
  assert.throws(() => assertCampaignInput({ ...valid, platforms: ['tiktok'], tiktokPrivateTest: false }, now), /private TikTok test/);
  assert.doesNotThrow(() => assertCampaignInput({ ...valid, platforms: ['tiktok'], tiktokPrivateTest: true }, now));
  assert.throws(() => assertCampaignInput({ ...valid, tiktokPrivateTest: true }, now), /only valid when TikTok/);
});
test('accepts text boundaries and an optional schedule at or after now', () => {
  assert.doesNotThrow(() => assertCampaignInput({ ...valid, title: 'a'.repeat(100), hook: 'h'.repeat(120), cta: 'c'.repeat(80), voiceText: 'v'.repeat(500), scheduledFor: now.toISOString() }, now));
  assert.doesNotThrow(() => assertCampaignInput({ ...valid, title: 'x', hook: 'x', cta: 'x', voiceText: 'x', scheduledFor: '2026-11-19T09:00:00+00:00' }, now));
  assert.doesNotThrow(() => assertCampaignInput({ ...valid, scheduledFor: null }, now));
});
for (const [field, max, label] of [['title', 100, 'Title'], ['hook', 120, 'Hook'], ['cta', 80, 'CTA'], ['voiceText', 500, 'Voice text']] as const) {
  test(`rejects missing, blank, non-string, or oversized ${field}`, () => {
    for (const value of [undefined, null, '', '   ', 123, 'x'.repeat(max + 1)]) {
      assert.throws(() => assertCampaignInput({ ...valid, [field]: value }, now), { message: `${label} must be between 1 and ${max} characters.` });
    }
  });
}
test('rejects unknown or malformed campaign fields', () => {
  for (const value of [null, [], 'campaign']) assert.throws(() => assertCampaignInput(value, now), { message: 'Campaign must be an object.' });
  assert.throws(() => assertCampaignInput({ ...valid, unexpected: true }, now), { message: 'Unknown campaign field: unexpected.' });
  assert.throws(() => assertCampaignInput({ ...valid, templateId: 'other' }, now), { message: 'Choose a supported template.' });
  assert.throws(() => assertCampaignInput({ ...valid, requiresApproval: 'true' }, now), { message: 'Requires approval must be a boolean.' });
});
test('requires at least one source asset UUID and supported platform', () => {
  for (const sourceAssetIds of [undefined, [], ['not-a-uuid'], [123]]) assert.throws(() => assertCampaignInput({ ...valid, sourceAssetIds }, now), { message: 'Choose at least one source asset with a valid UUID.' });
  for (const platforms of [undefined, [], ['facebook'], ['instagram', 1]]) assert.throws(() => assertCampaignInput({ ...valid, platforms }, now), { message: 'Choose at least one supported platform.' });
});
test('requires a real ISO datetime with timezone and no past schedule', () => {
  for (const scheduledFor of ['', 123, 'tomorrow', '2026-11-19', '2026-11-19T09:00:00', '2026-02-30T09:00:00.000Z', '2026-11-19T25:00:00Z']) {
    assert.throws(() => assertCampaignInput({ ...valid, scheduledFor }, now), { message: 'Schedule must be a valid ISO date and time with a timezone.' });
  }
  assert.throws(() => assertCampaignInput({ ...valid, scheduledFor: '2026-11-18T11:59:59.999Z' }, now), { message: 'Schedule cannot be earlier than now.' });
});

test('meme campaigns require empty voice text while other templates still require it', () => {
  assert.doesNotThrow(() => assertCampaignInput({ ...valid, templateId: 'meme-classic', voiceText: '' }, now));
  assert.throws(() => assertCampaignInput({ ...valid, templateId: 'meme-classic' }, now), { message: 'Meme campaigns have no voice-over text.' });
  assert.throws(() => assertCampaignInput({ ...valid, voiceText: '' }, now), /Voice text/);
});
