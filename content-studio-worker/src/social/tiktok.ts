import type { PublicationResult } from '../client.ts';
import { open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { capture } from '../process.ts';
import type { PublicationRequest } from '../worker.ts';
import { caption, httpsUrl, jsonPost, object, pending, providerOrigin, SocialContext, SocialError, tiktokPublishId, uncertain } from './types.ts';

const chunkSizeFor = (size: number) => size <= 64 * 1024 * 1024 ? size : 10 * 1024 * 1024;

export async function publishTikTok(request: PublicationRequest, context: SocialContext): Promise<PublicationResult> {
  // TikTok's public Direct Post review explicitly excludes internal/team tools.
  // This adapter is only an opt-in SELF_ONLY integration test for this product.
  if (context.env.TIKTOK_PRIVATE_TEST_ENABLED !== 'true') throw new SocialError('action-required', 'TikTok Direct Post excludes internal team upload tools from public approval. Set TIKTOK_PRIVATE_TEST_ENABLED=true only for private integration testing.');
  if (request.job.copy_json.privacy !== 'SELF_ONLY') throw new SocialError('action-required', 'TikTok requires an explicitly selected SELF_ONLY privacy for this internal tool. Public publishing is unavailable.');
  const base = providerOrigin(context.env.TIKTOK_API_BASE_URL ?? 'https://open.tiktokapis.com', ['open.tiktokapis.com']);
  const api = (path: string) => new URL(`${base}/v2/post/publish/${path}/`);
  const token = await context.token();
  if (!context.checkpoint) {
    const text = caption(request, 2200);
    const response = await context.read(api('creator_info/query'), token, jsonPost({})); const creator = object(response.data);
    if (!Array.isArray(creator.privacy_level_options) || !creator.privacy_level_options.includes('SELF_ONLY')) throw new SocialError('action-required', 'The connected TikTok account does not permit the selected private visibility.');
    const duration = await (context.deps.probeDuration ?? (async (path) => Number((await capture(context.env.FFPROBE_PATH ?? 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path])).trim())))(request.videoPath);
    if (!Number.isFinite(duration) || duration <= 0 || typeof creator.max_video_post_duration_sec !== 'number' || duration > creator.max_video_post_duration_sec) throw new SocialError('action-required', 'The rendered video exceeds the connected TikTok creator duration limit.');
    const file = await open(request.videoPath, 'r'); let size: number;
    try { const info = await file.stat(); size = info.size; if (!info.isFile() || size < 1 || size > 262144000) throw new SocialError('action-required', 'The rendered TikTok video is missing or too large.'); } finally { await file.close(); }
    const chunkSize = chunkSizeFor(size); const chunks = Math.max(1, Math.floor(size / chunkSize));
    await context.save({ phase: 'tiktok-initializing' });
    const initialized = object((await context.json(api('video/init'), token, jsonPost({
      post_info: { title: text, privacy_level: 'SELF_ONLY', disable_comment: true, disable_duet: true, disable_stitch: true, brand_content_toggle: false, brand_organic_toggle: true },
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: chunks },
    }), true)).data);
    let id: string; try { id = tiktokPublishId(initialized.publish_id); } catch { throw uncertain(); }
    const uploadUrl = transferUrl(initialized.upload_url);
    await context.save({ phase: 'tiktok-upload', operationId: id, uploadUrl: uploadUrl.href, size });
    await upload(request, context, token, api('status/fetch'), false);
  } else if (context.checkpoint.phase === 'tiktok-upload') {
    await upload(request, context, token, api('status/fetch'), true);
  }
  if (context.checkpoint?.phase === 'tiktok-initializing') throw uncertain();
  if (context.checkpoint?.phase !== 'tiktok-post') throw uncertain();
  const id = tiktokPublishId(context.checkpoint.operationId);
  for (let poll = 0; poll < 40; poll++) {
    const data = object((await context.read(api('status/fetch'), token, jsonPost({ publish_id: id }))).data);
    if (data.status === 'PUBLISH_COMPLETE') return context.done({ externalId: id, published: false, visibility: 'private' });
    if (data.status === 'FAILED') throw new SocialError('action-required', 'TikTok could not publish this private test. Review the provider account.');
    if (!['PROCESSING_UPLOAD', 'PROCESSING_DOWNLOAD'].includes(String(data.status))) throw new SocialError('action-required', 'TikTok returned an unexpected publication state.');
    if (poll < 39) await context.pause(5000);
  }
  throw pending();
}

function transferUrl(raw: unknown): URL {
  const url = httpsUrl(raw, ['open-upload.tiktokapis.com', 'upload.us.tiktokapis.com', 'upload.eu.tiktokapis.com']);
  if (url.pathname !== '/video/' || !url.searchParams.get('upload_id') || !url.searchParams.get('upload_token')) throw new SocialError('action-required', 'TikTok returned an invalid upload session.');
  return url;
}
async function upload(request: PublicationRequest, context: SocialContext, token: string, statusUrl: URL, resume: boolean): Promise<void> {
  const saved = context.checkpoint!; const id = tiktokPublishId(saved.operationId); const url = transferUrl(saved.uploadUrl); const size = saved.size;
  if (!Number.isSafeInteger(size) || !size || size > 262144000) throw uncertain();
  const chunkSize = chunkSizeFor(size); const chunks = Math.max(1, Math.floor(size / chunkSize)); let offset = 0;
  if (resume) {
    const data = object((await context.read(statusUrl, token, jsonPost({ publish_id: id }))).data);
    if (data.status === 'PUBLISH_COMPLETE') { await context.save({ phase: 'tiktok-post', operationId: id }); return; }
    if (data.status !== 'PROCESSING_UPLOAD' || !Number.isSafeInteger(data.uploaded_bytes)) throw new SocialError('action-required', 'TikTok could not resume the existing upload. Inspect this private test before retrying.');
    offset = Number(data.uploaded_bytes);
    if (offset === size) { await context.save({ phase: 'tiktok-post', operationId: id }); return; }
    if (offset < 0 || offset > size || offset % chunkSize !== 0 || offset / chunkSize >= chunks) throw uncertain();
  }
  const file = await open(request.videoPath, 'r');
  try {
    const info = await file.stat(); if (!info.isFile() || info.size !== size) throw uncertain();
    for (let chunk = offset / chunkSize; chunk < chunks; chunk++) {
      const end = chunk === chunks - 1 ? size - 1 : offset + chunkSize - 1;
      const stream = file.createReadStream({ start: offset, end, autoClose: false });
      try {
        const init = { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-length': String(end - offset + 1), 'content-range': `bytes ${offset}-${end}/${size}` }, body: Readable.toWeb(stream) as ReadableStream<Uint8Array>, duplex: 'half' } satisfies RequestInit & { duplex: string };
        const response = await context.request(url, null, init, true);
        if (response.status !== (end === size - 1 ? 201 : 206)) throw uncertain();
      } finally { stream.destroy(); }
      offset = end + 1;
    }
  } finally { await file.close(); }
  await context.save({ phase: 'tiktok-post', operationId: id });
}
