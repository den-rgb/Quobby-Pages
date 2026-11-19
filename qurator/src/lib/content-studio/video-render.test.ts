import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { VOICE_TEMPLATES, isVoiceTemplate, voiceOverFfmpegArgs, voiceOverTimeline } from './video-render.ts';

test('voice-over duration grows to fit the voice and keeps a four second CTA', () => {
  assert.deepEqual(voiceOverTimeline('study-streak-meme', 3), { durationSeconds: 12, ctaStart: 8 });
  assert.deepEqual(voiceOverTimeline('focus-blocker-problem-solution', 14.2), { durationSeconds: 16, ctaStart: 12 });
  assert.throws(() => voiceOverTimeline('study-streak-meme', 0), /voice-over duration/);
  assert.equal(VOICE_TEMPLATES['flashcards-before-exam'].durationSeconds, 15);
  assert.ok(isVoiceTemplate('flashcards-before-exam'));
  assert.ok(!isVoiceTemplate('meme-classic'));
  assert.ok(!isVoiceTemplate('constructor'));
});

test('the voice-over graph pads the recording, times images, and mixes voice with music', () => {
  const args = voiceOverFfmpegArgs({
    durationSeconds: 15, recordingName: 'recording.mp4',
    imageNames: ['image0.png', 'image1.jpg'], musicName: 'music.mp3',
  });
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /\[0:v\]setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920/);
  assert.match(graph, /\[2:v\].*\[image0\]/);
  assert.match(graph, /\[3:v\].*\[image1\]/);
  // Two images split the middle section evenly.
  assert.match(graph, /enable='between\(t,4\.000,7\.500\)'/);
  assert.match(graph, /enable='between\(t,7\.500,11\.000\)'/);
  // Captions: hook 0-4, title 4-11, CTA 11-15.
  assert.match(graph, /\[base2\]\[5:v\]overlay=0:0:enable='between\(t,0,4\)'/);
  assert.match(graph, /\[cap1\]\[6:v\]overlay=0:0:enable='between\(t,4,11\)'/);
  assert.match(graph, /\[cap2\]\[7:v\]overlay=0:0:enable='between\(t,11,15\)'/);
  assert.match(graph, /\[1:a\]aresample=48000,apad=whole_dur=15,atrim=duration=15/);
  assert.match(graph, /\[4:a\]aresample=48000,volume=0\.15.*\[music\]/);
  assert.match(graph, /\[voice\]\[music\]amix=inputs=2:duration=first:normalize=0\[audio\]/);
  assert.equal(args.filter((arg) => arg === '-i').length, 8);
  assert.equal(args[args.indexOf('-t') + 1], '15');
});

test('a record with no images or music still gets a voice-only audio track', () => {
  const args = voiceOverFfmpegArgs({ durationSeconds: 12, recordingName: 'recording.mov', imageNames: [] });
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /\[base0\]\[2:v\]overlay=0:0:enable='between\(t,0,4\)'/);
  assert.match(graph, /\[1:a\]aresample=48000,apad=whole_dur=12/);
  assert.match(graph, /\[voice\]anull\[audio\]/);
  assert.doesNotMatch(graph, /amix/);
});

test('inputs are ordered recording, voice, images, music, then captions', () => {
  const args = voiceOverFfmpegArgs({ durationSeconds: 12, recordingName: 'recording.mov', imageNames: ['image0.png'], musicName: 'music.mp3' });
  const inputs = args.flatMap((arg, index) => arg === '-i' ? [args[index + 1]] : []);
  assert.deepEqual(inputs, ['recording.mov', 'voice.wav', 'image0.png', 'music.mp3', 'hook.png', 'title.png', 'cta.png']);
  // One image plus three caption stills loop until -t caps the output.
  assert.equal(args.filter((arg) => arg === '-loop').length, 4);
  assert.equal(args.filter((arg) => arg === '-stream_loop').length, 2);
});
