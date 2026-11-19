import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAssCaptions, buildFfmpegArgs, buildMemeAss, buildMemeFfmpegArgs, MEME_FEATURES, MEME_LOGO_PATH, memeDurationSeconds, renderVideo } from '../src/renderer.ts';
import { memeRequest, request } from './helpers.ts';

test('renderer maps normalized vertical H.264 video and AAC audio at 30fps', () => {
  const args = buildFfmpegArgs(request());
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /scale=1080:1920:force_original_aspect_ratio=decrease/);
  assert.match(graph, /pad=1080:1920/);
  assert.match(graph, /ass=filename=/);
  for (const [flag, value] of [['-r', '30'], ['-c:v', 'libx264'], ['-c:a', 'aac'], ['-pix_fmt', 'yuv420p'], ['-movflags', '+faststart']]) {
    assert.equal(args[args.indexOf(flag) + 1], value);
  }
  assert.deepEqual(args.filter((_, i) => args[i - 1] === '-map'), ['[video]', '[audio]']);
});

test('optional images are composed and background audio mixes below the voice', () => {
  const input = request();
  input.spec.sourceAssetIds.push('image', 'music');
  input.assets.push({ id: 'image', path: '/tmp/image.png', mimeType: 'image/png' }, { id: 'music', path: '/tmp/music.mp3', mimeType: 'audio/mpeg' });
  const args = buildFfmpegArgs(input);
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.ok(args.includes('/tmp/image.png'));
  assert.match(graph, /overlay=/);
  assert.match(graph, /volume=0\.15/);
  assert.match(graph, /amix=inputs=2/);
});

test('copy is burned into ASS as literal text and cannot inject ASS events or overrides', () => {
  const captions = buildAssCaptions(request({ hook: 'Hello {\\pos(0,0)}\\N\nDialogue: bad' }).spec, 15);
  assert.equal(captions.split('\n').filter((line) => line.startsWith('Dialogue:')).length, 3);
  assert.doesNotMatch(captions, /\{\\pos|\\N|\nDialogue: bad/);
  assert.match(captions, /Try Quobby/);
});

test('untrusted filenames and filter punctuation remain separate arguments', () => {
  const input = request();
  input.assets[0].path = '/tmp/$(touch nope); clip.mp4';
  input.outputDirectory = "/tmp/render 'a:b,[c]";
  const args = buildFfmpegArgs(input);
  assert.equal(args[args.indexOf('-i') + 1], '/tmp/$(touch nope); clip.mp4');
  assert.ok(!args.some((arg) => arg.includes(input.spec.hook)));
  assert.equal(args.at(-1), "/tmp/render 'a:b,[c]/output.mp4");
  assert.match(args[args.indexOf('-filter_complex') + 1], /\\\\:/);
});

test('render writes captions, extends to fit the voice, and requires a nonempty output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-render-test-'));
  try {
    const input = request();
    input.outputDirectory = directory;
    input.assets[0].path = join(directory, 'source.mp4');
    input.voicePath = join(directory, 'voice.wav');
    await writeFile(input.assets[0].path, 'fixture source');
    await writeFile(input.voicePath, 'fixture voice');
    let args: string[] = [];
    const dependencies = { capture: async () => '24.2', run: async (_command: string, commandArgs: string[]) => { args = commandArgs; await writeFile(commandArgs.at(-1)!, 'rendered output'); } };
    const result = await renderVideo(input, dependencies);
    assert.equal(result.durationMs, 26000);
    assert.equal(args[args.indexOf('-t') + 1], '26');
    assert.match(await readFile(join(directory, 'captions.ass'), 'utf8'), /Try Quobby/);
    await assert.rejects(renderVideo(input, { ...dependencies, run: async () => {} }), /output/i);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('meme renders a white top band, a cropped clip below it, and a CTA end card at 1080x1920', () => {
  const args = buildMemeFfmpegArgs(memeRequest(), 12, true);
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /color=c=white:s=1080x1920:r=30:d=12\[bg\]/);
  assert.match(graph, /scale=1080:1360:force_original_aspect_ratio=increase,crop=1080:1360/);
  assert.match(graph, /overlay=0:560/);
  assert.match(graph, /drawbox=.*enable='gte\(t,9\)'\[card\]/);
  // Every end card carries the bundled logo above the copy.
  assert.ok(args.includes(MEME_LOGO_PATH));
  assert.match(graph, /\[1:v\]scale=300:300,setsar=1\[logo\]/);
  assert.match(graph, /\[card\]\[logo\]overlay=x=\(W-w\)\/2:y=520:enable='gte\(t,9\)'\[branded\]/);
  assert.match(graph, /\[branded\]ass=/);
  assert.match(graph, /\[0:a\]aresample=48000.*afade=t=out:st=9:d=3\[audio\]/);
  assert.equal(args.filter((arg) => arg === '-i').length, 2);
  for (const [flag, value] of [['-t', '12'], ['-r', '30'], ['-c:v', 'libx264'], ['-c:a', 'aac'], ['-pix_fmt', 'yuv420p']]) assert.equal(args[args.indexOf(flag) + 1], value);
  assert.deepEqual(args.filter((_, i) => args[i - 1] === '-map'), ['[video]', '[audio]']);
});

test('silent stock clips get a generated silent AAC track', () => {
  const graph = buildMemeFfmpegArgs(memeRequest(), 10, false).join(' ');
  assert.match(graph, /anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=10\[audio\]/);
  assert.doesNotMatch(graph, /\[0:a\]/);
});

test('meme captions escape copy and switch from top text to the CTA card', () => {
  const captions = buildMemeAss(memeRequest({ hook: 'Me {\\pos(0,0)}\nDialogue: bad', cta: 'Try {\\b1}Quobby' }).spec, 12);
  const dialogue = captions.split('\n').filter((line) => line.startsWith('Dialogue:'));
  assert.equal(dialogue.length, 2);
  assert.match(dialogue[0], /^Dialogue: 0,0:00:00\.00,0:00:09\.00,Top,/);
  assert.match(dialogue[1], /^Dialogue: 0,0:00:09\.00,0:00:12\.00,CTA,.*\{\\an5\\pos\(540,1180\)\}\{\\fs112\\c&HFFB4DE&\}Quobby\{\\r\}\\N\{\\fs56\}Try ｛＼b1｝Quobby/);
  // The feature list is always on the end card, after the campaign CTA, and is
  // pinned literally so emptying or renaming MEME_FEATURES cannot pass silently.
  assert.deepEqual([...MEME_FEATURES], ['Focus blocker', 'Flashcards & study streaks', 'Points, challenges & prizes']);
  assert.equal(dialogue[1].split('• ').length - 1, 3);
  for (const feature of ['Focus blocker', 'Flashcards & study streaks', 'Points, challenges & prizes']) assert.ok(dialogue[1].includes(`• ${feature}`), feature);
  // Only the renderer's own {\an5\pos(...)} override may survive.
  assert.doesNotMatch(captions, /\{\\pos|\{\\b1\}|\nDialogue: bad/);
});

test('meme duration plays 5-12 seconds of clip plus a 3 second CTA', () => {
  assert.equal(memeDurationSeconds(2.4), 8);
  assert.equal(memeDurationSeconds(7.2), 11);
  assert.equal(memeDurationSeconds(40), 15);
  assert.throws(() => memeDurationSeconds(0), /duration/);
  assert.throws(() => buildMemeFfmpegArgs(memeRequest(), 20, true), /between 8 and 15/);
  assert.throws(() => buildMemeFfmpegArgs(request(), 12, true), /voice-over templates/);
  assert.throws(() => buildFfmpegArgs(memeRequest()), /without a voice-over/);
});

test('meme render probes clip duration and audio without synthesizing a voice', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-meme-render-test-'));
  try {
    const input = memeRequest();
    input.outputDirectory = directory;
    input.assets[0].path = join(directory, 'source.mp4');
    await writeFile(input.assets[0].path, 'fixture source');
    const probes: string[][] = []; let args: string[] = [];
    const result = await renderVideo(input, {
      capture: async (_command, commandArgs) => { probes.push(commandArgs); return commandArgs.includes('-select_streams') ? '' : '6.5'; },
      run: async (_command, commandArgs) => { args = commandArgs; await writeFile(commandArgs.at(-1)!, 'rendered output'); },
    });
    assert.equal(result.durationMs, 10000);
    assert.ok(probes.every((probe) => probe.at(-1) === input.assets[0].path));
    assert.match(args.join(' '), /anullsrc/);
    assert.match(await readFile(join(directory, 'captions.ass'), 'utf8'), /Block the scroll/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
