import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { workerIsOnline, publicationErrorSummary, validateSourceFiles } from './ui.ts';

test('a missing, invalid, or older-than-120-second heartbeat shows worker offline', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  assert.equal(workerIsOnline(null, now), false);
  assert.equal(workerIsOnline('invalid', now), false);
  assert.equal(workerIsOnline('2026-11-18T11:57:59Z', now), false);
  assert.equal(workerIsOnline('2026-11-18T11:58:00Z', now), true);
  assert.equal(workerIsOnline('2026-11-18T11:59:59Z', now), true);
});

test('publication errors never echo raw provider messages or unknown credential-like codes', () => {
  assert.equal(publicationErrorSummary('failed', 'AUTH_REQUIRED'), 'Reconnect this platform on the worker Mac.');
  assert.equal(publicationErrorSummary('failed', 'Bearer secret-access-token'), 'Publishing failed. Check the worker logs on the Mac.');
  assert.equal(publicationErrorSummary('rejected', null), 'Publication rejected.');
  assert.equal(publicationErrorSummary('queued', null), null);
});

test('worker social failures expose curated restriction, recovery, and uncertainty guidance', () => {
  assert.equal(publicationErrorSummary('failed', 'publication-action-required'), 'Provider action required. Check the connected account, privacy, and app permissions on the Mac.');
  assert.equal(publicationErrorSummary('failed', 'publication-retryable'), 'The provider is processing this post or temporarily unavailable. Retry only the existing publication from the Mac.');
  assert.equal(publicationErrorSummary('failed', 'publication-uncertain'), 'Submission outcome uncertain. Inspect the provider account before retrying or creating another post.');
});

test('required recording slots reject missing, non-video, empty and oversized files', () => {
  assert.equal(validateSourceFiles([null], []), 'Choose each required recording.');
  assert.equal(validateSourceFiles([{ type: 'image/png', size: 10 }], []), 'Required recordings must be MP4 or QuickTime videos.');
  for (const size of [0, 262144001]) {
    assert.equal(validateSourceFiles([{ type: 'video/mp4', size }], []), 'Use supported video, image, or audio files between 1 byte and 250 MB each.');
  }
  assert.equal(validateSourceFiles([{ type: 'video/mp4', size: 262144000 }], [{ type: 'audio/wav', size: 10 }]), null);
  assert.equal(validateSourceFiles([{ type: 'video/mp4', size: 10 }], [{ type: 'text/html', size: 10 }]), 'Use supported video, image, or audio files between 1 byte and 250 MB each.');
});

test('optional sources match the renderer limits before upload', () => {
  const recording = { type: 'video/mp4', size: 10 };
  const images = Array.from({ length: 8 }, () => ({ type: 'image/png', size: 10 }));
  const audio = { type: 'audio/wav', size: 10 };
  assert.equal(validateSourceFiles([recording], [...images, audio]), null);
  assert.equal(validateSourceFiles([recording], [audio, audio]), 'Choose at most one optional background audio file.');
  assert.equal(validateSourceFiles([recording], [...images, images[0]]), 'Choose at most eight optional images.');
  assert.equal(validateSourceFiles([recording], [recording]), 'Optional sources must be supported images or audio.');
  assert.equal(validateSourceFiles([recording, recording], []), 'Choose exactly one required recording.');
});

test('admin and independent worker accept the same optional media boundaries for every template', async () => {
  const { validateRenderRequest } = await import(new URL('../../../../content-studio-worker/src/templates.ts', import.meta.url).href);
  for (const templateId of ['focus-blocker-problem-solution', 'flashcards-before-exam', 'study-streak-meme']) {
    for (let images = 0; images <= 9; images++) {
      for (let audio = 0; audio <= 2; audio++) {
        const sources = [
          { id: 'recording', path: '/tmp/recording.mp4', mimeType: 'video/mp4' },
          ...Array.from({ length: images }, (_, index) => ({ id: `image-${index}`, path: `/tmp/image-${index}.png`, mimeType: 'image/png' })),
          ...Array.from({ length: audio }, (_, index) => ({ id: `audio-${index}`, path: `/tmp/audio-${index}.wav`, mimeType: 'audio/wav' })),
        ];
        const files = sources.map((asset) => ({ type: asset.mimeType, size: 100 }));
        let workerAccepts = false;
        try {
          validateRenderRequest({
            spec: { templateId, templateVersion: 1, title: 'Study', hook: 'Focus', cta: 'Try Quobby', voiceText: 'Study with Quobby.', sourceAssetIds: sources.map((asset) => asset.id) },
            assets: sources, outputDirectory: '/tmp/quobby-render', voicePath: '/tmp/voice.wav',
          });
          workerAccepts = true;
        } catch { /* Compare the independently deployed packages' accepted combinations. */ }
        assert.equal(validateSourceFiles([files[0]], files.slice(1)) === null, workerAccepts, `${templateId}: ${images} images / ${audio} audio`);
      }
    }
  }
});
