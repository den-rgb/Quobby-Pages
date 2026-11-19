import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { CURATED_TEMPLATE_IDS, CURATED_TEMPLATES } from './templates.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { assertCampaignInput } from './state.ts';

test('all curated template labels are available', () => {
  assert.deepEqual(CURATED_TEMPLATE_IDS, [
    'focus-blocker-problem-solution',
    'flashcards-before-exam',
    'study-streak-meme',
  ]);
  assert.deepEqual(CURATED_TEMPLATES.map((template) => template.label), [
    'Focus blocker: problem → solution', 'Flashcards before an exam', 'Study streak meme',
  ]);
});

test('each template supplies usable required asset labels and valid default campaign copy', () => {
  for (const template of CURATED_TEMPLATES) {
    assert.ok(template.description.trim());
    assert.equal(template.requiredAssetLabels.length, 1);
    assert.ok(template.requiredAssetLabels[0].trim());
    assert.doesNotThrow(() => assertCampaignInput({
      templateId: template.id, ...template.defaultCopy,
      sourceAssetIds: ['44444444-4444-4444-8444-444444444444'],
      platforms: ['instagram'], requiresApproval: true,
    }));
  }
});
