import type { RenderRequest, RenderSpec } from '../src/types.ts';

export function request(spec: Partial<RenderSpec> = {}): RenderRequest {
  return {
    spec: {
      templateId: 'focus-blocker-problem-solution', templateVersion: 1,
      title: 'Make room for study', hook: 'One more scroll?',
      cta: 'Try Quobby', voiceText: 'Start your next focus session with Quobby.',
      sourceAssetIds: ['recording'], ...spec,
    },
    assets: [{ id: 'recording', path: '/tmp/recording.mp4', mimeType: 'video/mp4' }],
    outputDirectory: '/tmp/quobby-render', voicePath: '/tmp/voice.wav',
  };
}

export function memeRequest(spec: Partial<RenderSpec> = {}): RenderRequest {
  const input = request({ templateId: 'meme-classic', hook: 'Me opening TikTok "for five minutes" before my exam', cta: 'Block the scroll. Study with Quobby.', voiceText: '', ...spec });
  input.voicePath = null;
  return input;
}
