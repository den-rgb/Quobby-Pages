import type { CampaignInput } from './types';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { validateSourceFiles } from './media.ts';

export const STUDIO_API = '/api/admin/content-studio';

export class StudioAccessError extends Error {
  constructor() { super('Admin access is required.'); }
}

export async function studioRequest<T>(path: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(`${STUDIO_API}${path}`, {
    ...init, cache: 'no-store', credentials: 'same-origin',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (response.status === 401 || response.status === 403) throw new StudioAccessError();
  if (!response.ok) {
    // Content Studio routes curate 400/502 text (validation, missing provider
    // key, clip lookup); show it instead of a generic failure.
    const body = await response.json().catch(() => null) as { error?: unknown } | null;
    if ((response.status === 400 || response.status === 502) && typeof body?.error === 'string' && body.error) throw new Error(body.error);
    throw new Error(response.status === 409 ? 'This item changed. Refresh the queue and try again.'
      : response.status === 429 ? 'Too many requests. Wait a moment and try again.'
        : 'Content Studio request failed. Check the fields and try again.');
  }
  return response.json() as Promise<T>;
}

export interface MemeInput {
  theme?: string;
  platforms: CampaignInput['platforms'];
  tiktokPrivateTest?: boolean;
  requiresApproval: boolean;
  scheduledFor: string | null;
}

export interface MemeCopy {
  title: string;
  hook: string;
  cta: string;
  caption: string;
  hashtags: string[];
}

export interface GeneratedMeme {
  campaignId: string;
  renderId: string;
  clipUrl: string;
  copy: MemeCopy;
}

// Server 400/502 messages for meme generation are curated (config, rate limit,
// no suitable clip), so show them instead of the generic failure text.
export async function generateMeme(input: MemeInput, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<GeneratedMeme> {
  const response = await fetcher(`${STUDIO_API}/memes`, {
    method: 'POST', cache: 'no-store', credentials: 'same-origin', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (response.status === 401 || response.status === 403) throw new StudioAccessError();
  const body = await response.json().catch(() => null) as Partial<GeneratedMeme> & { error?: string } | null;
  if (!response.ok || typeof body?.campaignId !== 'string' || typeof body?.renderId !== 'string' || typeof body?.clipUrl !== 'string' || !body.copy) {
    throw new Error((response.status === 400 || response.status === 502) && typeof body?.error === 'string' ? body.error
      : response.status === 429 ? 'Too many requests. Wait a moment and try again.' : 'Meme generation failed. Try again.');
  }
  return { campaignId: body.campaignId, renderId: body.renderId, clipUrl: body.clipUrl, copy: body.copy };
}

// Writes per-platform descriptions and tags onto the unpublished publications.
export async function generatePlatformCopy(campaignId: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<void> {
  await studioRequest(`/campaigns/${campaignId}/copy`, { method: 'POST', body: '{}', signal }, fetcher);
}

// Browser rendering: sign the canonical output path, PUT the MP4, then let the
// server verify Storage before completing the render.
export async function uploadRender(renderId: string, video: Blob, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<void> {
  const upload = await studioRequest<{ signedUrl: string }>(`/renders/${renderId}/upload`, {
    method: 'POST', body: '{}', signal,
  }, fetcher);
  const response = await fetcher(upload.signedUrl, {
    method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: video, credentials: 'omit', signal,
  });
  if (!response.ok) throw new Error('The rendered video upload failed. Try again.');
}

export async function completeBrowserRender(renderId: string, durationMs: number, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<void> {
  await studioRequest(`/renders/${renderId}/complete`, { method: 'POST', body: JSON.stringify({ durationMs }), signal }, fetcher);
}



export async function createCampaignWithAssets(
  input: Omit<CampaignInput, 'sourceAssetIds'>,
  files: File[],
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<{ campaignId: string; renderId: string }> {
  const mediaError = validateSourceFiles([files[0] ?? null], files.slice(1));
  if (mediaError) throw new Error(mediaError);
  const sourceAssetIds: string[] = [];
  for (const file of files) {
    signal?.throwIfAborted();
    const metadata = { filename: file.name, mimeType: file.type, sizeBytes: file.size };
    // The short-lived signed URL grants this upload; no service or provider token is used.
    const upload = await studioRequest<{ path: string; signedUrl: string }>('/assets', {
      method: 'POST', body: JSON.stringify({ action: 'upload', ...metadata }), signal,
    }, fetcher);
    const response = await fetcher(upload.signedUrl, {
      method: 'PUT', headers: { 'Content-Type': file.type }, body: file, credentials: 'omit', signal,
    });
    if (!response.ok) throw new Error('Media upload failed. Try again.');
    const confirmed = await studioRequest<{ asset: { id: string } }>('/assets', {
      method: 'POST', body: JSON.stringify({ action: 'confirm', ...metadata, storagePath: upload.path }), signal,
    }, fetcher);
    sourceAssetIds.push(confirmed.asset.id);
  }
  signal?.throwIfAborted();
  return studioRequest('/campaigns', { method: 'POST', body: JSON.stringify({ ...input, sourceAssetIds }), signal }, fetcher);
}
