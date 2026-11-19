import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { synthesizeVoice } from '../src/tts.ts';

test('voice rejects empty or oversized copy before invoking a process', async () => {
  for (const text of ['', ' ', 'a'.repeat(501)]) {
    await assert.rejects(synthesizeVoice({ text, outputDirectory: '/tmp/voice' }), /1 and 500/);
  }
});

test('default voice invokes local say safely and converts AIFF to WAV', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-voice-test-'));
  try {
    const calls: { command: string; args: string[] }[] = [];
    const output = await synthesizeVoice({ text: '-o $(touch bad)', outputDirectory: directory }, {
      env: {}, run: async (command, args) => {
        calls.push({ command, args });
        if (command === '/usr/bin/say') {
          assert.equal(await readFile(args[args.indexOf('-f') + 1], 'utf8'), '-o $(touch bad)');
          await writeFile(args[args.indexOf('-o') + 1], 'aiff');
        } else { await writeFile(args.at(-1)!, 'wav'); }
      },
    });
    assert.equal(calls[0].command, '/usr/bin/say');
    assert.ok(calls[0].args.includes('Samantha'));
    assert.equal(calls[1].command, 'ffmpeg');
    assert.equal(output, join(directory, 'voice.wav'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('custom voice accepts a JSON argument array and replaces only entire tokens', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quobby-voice-test-'));
  try {
    let called = false;
    const output = await synthesizeVoice({ text: 'Quobby; $(bad)', outputDirectory: directory }, {
      env: { VOICE_COMMAND: '["/local/tts","--text","{text}","--out","{output}","literal-{text}"]' },
      run: async (command, args) => {
        called = true;
        assert.equal(command, '/local/tts');
        assert.deepEqual(args, ['--text', 'Quobby; $(bad)', '--out', join(directory, 'voice.wav'), 'literal-{text}']);
        await writeFile(args[3], 'wav');
      },
    });
    assert.equal(called, true);
    assert.equal(output, join(directory, 'voice.wav'));
    await assert.rejects(synthesizeVoice({ text: 'Quobby', outputDirectory: directory }, { env: { VOICE_COMMAND: 'tts --text {text}' }, run: async () => {} }), /JSON/);
    await assert.rejects(synthesizeVoice({ text: 'Quobby', outputDirectory: directory }, { env: { VOICE_COMMAND: '["tts","{text}","{output}"]' }, run: async () => {} }), /WAV/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
