import { open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { PublicationResult } from '../client.ts';
import type { PublicationRequest } from '../worker.ts';
import { caption, httpsUrl, identifier, jsonPost, object, pending, providerOrigin, SocialContext, SocialError, uncertain } from './types.ts';

function sessionUrl(raw: unknown): URL {
  const url = httpsUrl(raw, ['www.googleapis.com']);
  if (url.pathname !== '/upload/youtube/v3/videos' || !url.searchParams.get('upload_id')) throw new SocialError('action-required', 'YouTube returned an invalid upload session.');
  return url;
}
export async function publishYouTube(request: PublicationRequest, context: SocialContext): Promise<PublicationResult> {
  const base = providerOrigin(context.env.YOUTUBE_API_BASE_URL ?? 'https://www.googleapis.com', ['www.googleapis.com']);
  const api = (path: string) => new URL(`${base}${path}`); const token = await context.token();
  if (!context.checkpoint) {
    const description = caption(request, 5000); const copy = request.job.copy_json; const privacy = copy.privacy ?? 'public';
    if (copy.title.length > 100 || /[<>]/.test(copy.title) || !['public', 'private', 'unlisted'].includes(privacy)) throw new SocialError('action-required', 'Review the YouTube title and privacy setting.');
    const file = await open(request.videoPath, 'r'); let size: number;
    try { const info = await file.stat(); size = info.size; if (!info.isFile() || size < 1 || size > 262144000) throw new SocialError('action-required', 'The rendered YouTube video is missing or too large.'); } finally { await file.close(); }
    const url = api('/upload/youtube/v3/videos'); url.searchParams.set('uploadType', 'resumable'); url.searchParams.set('part', 'snippet,status');
    await context.save({ phase: 'youtube-starting' });
    const response = await context.request(url, token, { ...jsonPost({ snippet: { title: copy.title, description, tags: copy.hashtags.map((tag) => tag.replace(/^#/, '')), categoryId: '27' }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } }), headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'video/mp4', 'x-upload-content-length': String(size) } }, true);
    const uploadUrl = sessionUrl(response.headers.get('location'));
    await context.save({ phase: 'youtube-session', uploadUrl: uploadUrl.href, size });
    await upload(request, context, token, false);
  } else if (context.checkpoint.phase === 'youtube-session') await upload(request, context, token, true);
  if (context.checkpoint?.phase === 'youtube-starting') throw uncertain();
  if (context.checkpoint?.phase !== 'youtube-video') throw uncertain();
  const id = identifier(context.checkpoint.operationId); const statusUrl = api('/youtube/v3/videos'); statusUrl.searchParams.set('part', 'processingDetails,status'); statusUrl.searchParams.set('id', id);
  for (let poll = 0; poll < 40; poll++) {
    const response = await context.read(statusUrl, token, { method: 'GET' });
    if (!Array.isArray(response.items) || response.items.length !== 1) throw new SocialError('action-required', 'YouTube did not return the uploaded video.');
    const video = object(response.items[0]); if (video.id !== id) throw new SocialError('action-required', 'YouTube returned an unexpected video.');
    const processing = object(video.processingDetails); const status = object(video.status);
    if (['failed', 'terminated'].includes(String(processing.processingStatus)) || ['failed', 'rejected', 'deleted'].includes(String(status.uploadStatus))) throw new SocialError('action-required', 'YouTube processing failed. Inspect the uploaded video before retrying.');
    if (processing.processingStatus === 'succeeded') {
      if (!['public', 'private', 'unlisted'].includes(String(status.privacyStatus))) throw new SocialError('action-required', 'YouTube returned an unknown privacy setting.');
      const visibility = String(status.privacyStatus);
      return context.done(visibility === 'public' ? { externalId: id, publicUrl: `https://www.youtube.com/watch?v=${id}`, published: true, visibility } : { externalId: id, published: false, visibility });
    }
    if (processing.processingStatus !== 'processing') throw new SocialError('action-required', 'YouTube returned an unknown processing state.');
    if (poll < 39) await context.pause(5000);
  }
  throw pending();
}

async function upload(request: PublicationRequest, context: SocialContext, token: string, resume: boolean): Promise<void> {
  const saved = context.checkpoint!; const url = sessionUrl(saved.uploadUrl); const size = saved.size;
  if (!Number.isSafeInteger(size) || !size || size > 262144000) throw uncertain();
  let offset = 0;
  if (resume) {
    // Query the same session after an interrupted PUT; never start a second insert.
    const status = await context.request(url, token, { method: 'PUT', headers: { 'content-length': '0', 'content-range': `bytes */${size}` } });
    if (status.status !== 308) { await uploaded(status, context); return; }
    const range = status.headers.get('range');
    if (range) {
      const match = /^bytes=0-([0-9]+)$/.exec(range); if (!match) throw uncertain();
      offset = Number(match[1]) + 1;
    }
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= size) throw uncertain();
  const file = await open(request.videoPath, 'r'); const stream = file.createReadStream({ start: offset, autoClose: false });
  try {
    const info = await file.stat(); if (!info.isFile() || info.size !== size) throw uncertain();
    const init = { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': String(size - offset), 'content-range': `bytes ${offset}-${size - 1}/${size}` }, body: Readable.toWeb(stream) as ReadableStream<Uint8Array>, duplex: 'half' } satisfies RequestInit & { duplex: string };
    const response = await context.request(url, token, init, true);
    if (response.status === 308) throw pending();
    await uploaded(response, context);
  } finally { stream.destroy(); await file.close(); }
}
async function uploaded(response: Response, context: SocialContext): Promise<void> {
  let id: string;
  try { id = identifier(object(await response.json()).id); } catch { throw uncertain(); }
  await context.save({ phase: 'youtube-video', operationId: id });
}
