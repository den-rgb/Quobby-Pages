// Some TTS models return a WAV container, older ones return raw 16-bit PCM at
// 24 kHz mono. Wrap the latter so the browser and ffmpeg see a real file.
export function toWav(bytes: Uint8Array, mimeType: string): Uint8Array {
  if (/wav|wave/i.test(mimeType)) return bytes;
  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1] ?? 24_000);
  const channels = 1; const bits = 16;
  const header = new ArrayBuffer(44); const view = new DataView(header);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + bytes.byteLength, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * channels * bits / 8, true);
  view.setUint16(32, channels * bits / 8, true); view.setUint16(34, bits, true);
  text(36, 'data'); view.setUint32(40, bytes.byteLength, true);
  const out = new Uint8Array(44 + bytes.byteLength);
  out.set(new Uint8Array(header)); out.set(bytes, 44);
  return out;
}
