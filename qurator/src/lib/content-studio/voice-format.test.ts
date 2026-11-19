import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { toWav } from './voice-format.ts';

test('WAV output is passed through and raw PCM gains a RIFF header', () => {
  const wav = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]);
  assert.equal(toWav(wav, 'audio/wav'), wav);

  const pcm = new Uint8Array(1000).fill(7);
  const wrapped = toWav(pcm, 'audio/L16;codec=pcm;rate=24000');
  assert.equal(wrapped.byteLength, 1044);
  assert.equal(String.fromCharCode(...wrapped.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...wrapped.slice(8, 12)), 'WAVE');
  const view = new DataView(wrapped.buffer);
  assert.equal(view.getUint32(24, true), 24000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 1000);
  assert.deepEqual([...wrapped.slice(44, 48)], [7, 7, 7, 7]);
});
