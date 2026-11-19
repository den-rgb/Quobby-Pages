'use client';

// One browser render entry point for every template: fetch the immutable spec
// and signed sources, build the overlays/voice, encode with ffmpeg.wasm, upload,
// then let the server verify and complete the render.

import { completeBrowserRender, StudioAccessError, studioRequest, uploadRender } from './client';
import { memeTimeline } from './meme-render';
import { renderEndCard, renderTopOverlay } from './meme-overlays';
import { MEME_TEMPLATE_ID, type RenderSpec } from './types';
import { VOICE_TEMPLATES, isVoiceTemplate, voiceOverTimeline } from './video-render';
import { renderCaptionOverlays } from './video-overlays';
import { renderMeme, renderVoiceOver } from '@/lib/video-processor';

interface SourceAsset { id: string; mimeType: string; url: string }
interface RenderSource { campaignId: string; spec: RenderSpec; assets: SourceAsset[] }

function extension(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('aac') || mimeType.includes('m4a')) return 'm4a';
  return 'mp4';
}

async function download(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Could not download a source file. Try again.');
  return response.blob();
}

function mediaDuration(blob: Blob, kind: 'video' | 'audio'): Promise<number> {
  return new Promise((resolve, reject) => {
    const element = kind === 'audio' ? document.createElement('audio') : document.createElement('video');
    element.preload = 'metadata';
    const fail = () => { URL.revokeObjectURL(element.src); reject(new Error(`Could not read the ${kind} duration.`)); };
    element.onloadedmetadata = () => {
      const seconds = element.duration;
      URL.revokeObjectURL(element.src);
      if (Number.isFinite(seconds) && seconds > 0) resolve(seconds); else fail();
    };
    element.onerror = fail;
    element.src = URL.createObjectURL(blob);
  });
}

async function synthesizeVoice(text: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch('/api/admin/content-studio/voice', {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  });
  if (response.status === 401 || response.status === 403) throw new StudioAccessError();
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? 'Voice generation failed. Try again.');
  }
  return response.blob();
}

export async function renderCampaign(renderId: string, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<void> {
  const source = await studioRequest<RenderSource>(`/renders/${renderId}/source`, { signal });
  const { spec, assets } = source;
  const recording = assets.find((asset) => asset.mimeType.startsWith('video/'));
  if (!recording) throw new Error('This campaign has no source recording.');
  const recordingBlob = await download(recording.url, signal);

  if (spec.templateId === MEME_TEMPLATE_ID) {
    const timeline = memeTimeline(await mediaDuration(recordingBlob, 'video'));
    const [top, end] = await Promise.all([renderTopOverlay(spec.hook), renderEndCard(spec.cta)]);
    const video = await renderMeme({ clip: recordingBlob, top, end, timeline, onProgress });
    await uploadRender(renderId, video, signal);
    await completeBrowserRender(renderId, timeline.durationSeconds * 1000, signal);
    return;
  }

  if (!isVoiceTemplate(spec.templateId)) throw new Error('This template has no browser renderer.');
  const template = VOICE_TEMPLATES[spec.templateId];
  const voice = await synthesizeVoice(spec.voiceText, signal);
  const timeline = voiceOverTimeline(spec.templateId, await mediaDuration(voice, 'audio'));
  const imageAssets = assets.filter((asset) => asset.mimeType.startsWith('image/'));
  const images = await Promise.all(imageAssets.map(async (asset, index) => ({
    name: `image${index}.${extension(asset.mimeType)}`, blob: await download(asset.url, signal),
  })));
  const musicAsset = assets.find((asset) => asset.mimeType.startsWith('audio/'));
  const music = musicAsset ? { name: `music.${extension(musicAsset.mimeType)}`, blob: await download(musicAsset.url, signal) } : null;
  const captions = await renderCaptionOverlays({ hook: spec.hook, title: spec.title, cta: spec.cta, accent: template.accent, fontSize: template.fontSize });
  const video = await renderVoiceOver({
    recording: recordingBlob, recordingName: `recording.${extension(recording.mimeType)}`,
    voice, images, music, captions, durationSeconds: timeline.durationSeconds, onProgress,
  });
  await uploadRender(renderId, video, signal);
  await completeBrowserRender(renderId, timeline.durationSeconds * 1000, signal);
}
