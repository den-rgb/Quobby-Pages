import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { MEME_BAND_HEIGHT, MEME_CTA_SECONDS, MEME_HEIGHT, MEME_WIDTH, memeFfmpegArgs, memeTimeline } from './meme-render.ts';

test('meme timeline clamps the clip to 5-12 seconds and adds the 3 second end card', () => {
  assert.deepEqual(memeTimeline(2.4), { shownSeconds: 5, ctaStart: 5, durationSeconds: 8 });
  assert.deepEqual(memeTimeline(7.2), { shownSeconds: 8, ctaStart: 8, durationSeconds: 11 });
  assert.deepEqual(memeTimeline(40), { shownSeconds: 12, ctaStart: 12, durationSeconds: 15 });
  assert.throws(() => memeTimeline(0), /duration/);
  assert.equal(MEME_CTA_SECONDS, 3);
});

test('the browser graph matches the worker end card layout', () => {
  const timeline = memeTimeline(9);
  const args = memeFfmpegArgs(timeline, true);
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, new RegExp(`color=c=white:s=${MEME_WIDTH}x${MEME_HEIGHT}:r=30:d=12\\[bg\\]`));
  assert.match(graph, new RegExp(`scale=${MEME_WIDTH}:${MEME_HEIGHT - MEME_BAND_HEIGHT}:force_original_aspect_ratio=increase`));
  assert.match(graph, new RegExp(`crop=${MEME_WIDTH}:${MEME_HEIGHT - MEME_BAND_HEIGHT}`));
  assert.match(graph, new RegExp(`overlay=0:${MEME_BAND_HEIGHT}\\[stack\\]`));
  // Top band overlay, then the full-frame end card from the CTA start.
  assert.match(graph, /\[stack\]\[1:v\]overlay=0:0\[withTop\]/);
  assert.match(graph, /\[withTop\]\[2:v\]overlay=0:0:enable='gte\(t,9\)'\[card\]/);
  assert.match(graph, /\[0:a\]aresample=48000.*afade=t=out:st=9:d=3\[audio\]/);
  assert.equal(args.filter((arg) => arg === '-i').length, 3);
  // Both overlays must loop so they exist for the whole timeline.
  assert.equal(args.filter((arg) => arg === '-loop').length, 2);
  assert.deepEqual(args.filter((_, index) => args[index - 1] === '-map'), ['[video]', '[audio]']);
  assert.equal(args[args.indexOf('-t') + 1], '12');
});

test('silent clips get a silent audio track so the output is platform-ready', () => {
  const graph = memeFfmpegArgs(memeTimeline(5), false)[memeFfmpegArgs(memeTimeline(5), false).indexOf('-filter_complex') + 1];
  assert.match(graph, /anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=8\[audio\]/);
  assert.doesNotMatch(graph, /\[0:a\]/);
});
