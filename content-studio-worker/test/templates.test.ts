import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, validateRenderRequest } from '../src/templates.ts';
import { memeRequest, request } from './helpers.ts';

test('meme template has no voice-over: empty voice text and no voice file are required', () => {
  assert.equal(TEMPLATES['meme-classic'].voiceOver, false);
  assert.doesNotThrow(() => validateRenderRequest(memeRequest()));
  assert.throws(() => validateRenderRequest(memeRequest({ voiceText: 'Read this aloud' })), /no voice-over text/);
  assert.throws(() => validateRenderRequest({ ...memeRequest(), voicePath: '/tmp/voice.wav' }), /no voice-over/);
  assert.throws(() => validateRenderRequest({ ...request(), voicePath: null }), /local/);
  const silent = memeRequest(); silent.assets[0].mimeType = 'image/png';
  assert.throws(() => validateRenderRequest(silent), /Stock meme clip/);
});

test('all three template snapshots accept their recording and reject unsupported versions', () => {
  for (const templateId of ['focus-blocker-problem-solution', 'flashcards-before-exam', 'study-streak-meme'] as const) {
    assert.doesNotThrow(() => validateRenderRequest(request({ templateId })));
    assert.throws(() => validateRenderRequest(request({ templateId, templateVersion: 2 })), /version/);
    assert.ok(TEMPLATES[templateId].durationSeconds > 0);
  }
});

test('flashcard template requires its named first recording slot', () => {
  const input = request({ templateId: 'flashcards-before-exam' });
  input.assets = [];
  assert.throws(() => validateRenderRequest(input), /Flashcard recording/);
  input.assets = [{ id: 'recording', path: '/tmp/image.png', mimeType: 'image/png' }];
  assert.throws(() => validateRenderRequest(input), /Flashcard recording/);
});

test('snapshot assets cannot be missing, duplicated, or supplemented outside the snapshot', () => {
  const input = request();
  input.spec.sourceAssetIds.push('missing');
  assert.throws(() => validateRenderRequest(input), /missing/i);
  input.spec.sourceAssetIds = ['recording'];
  input.assets.push({ ...input.assets[0] });
  assert.throws(() => validateRenderRequest(input), /duplicate/i);
  input.assets[1].id = 'unexpected';
  assert.throws(() => validateRenderRequest(input), /snapshot/);
});

test('render rejects unbounded copy, nonlocal paths, and unsupported optional assets', () => {
  assert.throws(() => validateRenderRequest(request({ hook: 'x'.repeat(121) })), /Hook/);
  assert.throws(() => validateRenderRequest({ ...request(), voicePath: 'https://example.com/audio.wav' }), /local/);
  const input = request();
  input.spec.sourceAssetIds.push('extra');
  input.assets.push({ id: 'extra', path: '/tmp/more.mp4', mimeType: 'video/mp4' });
  assert.throws(() => validateRenderRequest(input), /optional/);
});

test('render cannot overwrite one of its source or voice files', () => {
  const input = request();
  input.assets[0].path = '/tmp/quobby-render/output.mp4';
  assert.throws(() => validateRenderRequest(input), /overlap/);
  input.assets[0].path = '/tmp/recording.mp4';
  input.voicePath = '/tmp/quobby-render/captions.ass';
  assert.throws(() => validateRenderRequest(input), /overlap/);
});
