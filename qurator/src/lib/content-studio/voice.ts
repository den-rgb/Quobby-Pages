import 'server-only';

// Cloud voice-over, replacing the retired Mac worker's `say` command. Returns a
// WAV file the browser can feed straight into ffmpeg.wasm.
import { ContentStudioInputError, MemeGenerationError } from './errors';
import { toWav } from './voice-format';

const TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'] as const;
const TTS_TIMEOUT_MS = 20_000;

export async function synthesizeVoice(text: string): Promise<Uint8Array> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 500) throw new ContentStudioInputError('Voice text must be between 1 and 500 characters.');
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) throw new ContentStudioInputError('Set GEMINI_API_KEY in the Qurator server environment to generate voice-overs.');

  const models = [...new Set([process.env.GEMINI_TTS_MODEL?.trim() || TTS_MODELS[0], ...TTS_MODELS])].filter(Boolean);
  let lastFailure: MemeGenerationError | null = null;
  for (const model of models) {
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Read this voice-over for a short app marketing video. Speak clearly and naturally, no preamble:\n${trimmed}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          },
        }),
      });
    } catch {
      lastFailure = new MemeGenerationError('Could not reach the voice service. Try again.');
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      // A bad key or model name fails for every model: stop instead of fanning out.
      if (response.status !== 429 && response.status < 500) {
        throw new ContentStudioInputError('The voice service rejected the request. Check GEMINI_API_KEY and GEMINI_TTS_MODEL.');
      }
      lastFailure = new MemeGenerationError(response.status === 429
        ? 'The voice service rate limit was reached. Try again later.'
        : 'The voice service is busy right now. Try again in a minute.');
      continue;
    }
    const body = await response.json().catch(() => null) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: unknown; mimeType?: unknown } }[] } }[];
    } | null;
    const inline = body?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.inlineData?.data === 'string')?.inlineData;
    if (typeof inline?.data !== 'string') {
      lastFailure = new MemeGenerationError('The voice service returned no audio. Try again.');
      continue;
    }
    const bytes = Buffer.from(inline.data, 'base64');
    if (bytes.byteLength < 1000) {
      lastFailure = new MemeGenerationError('The voice service returned too little audio. Try again.');
      continue;
    }
    return toWav(new Uint8Array(bytes), typeof inline.mimeType === 'string' ? inline.mimeType : 'audio/wav');
  }
  throw lastFailure ?? new MemeGenerationError('The voice service is unavailable. Try again.');
}
