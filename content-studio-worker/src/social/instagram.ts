import type { PublicationResult } from '../client.ts';
import type { PublicationRequest } from '../worker.ts';
import { caption, httpsUrl, identifier, jsonPost, pending, providerOrigin, SocialContext, SocialError, uncertain } from './types.ts';

export async function publishInstagram(request: PublicationRequest, context: SocialContext): Promise<PublicationResult> {
  const env = context.env;
  if (!env.INSTAGRAM_API_BASE_URL || !env.INSTAGRAM_API_VERSION || !env.INSTAGRAM_USER_ID) throw new SocialError('action-required', 'Set INSTAGRAM_API_BASE_URL, INSTAGRAM_API_VERSION, and INSTAGRAM_USER_ID on the Mac.');
  const base = providerOrigin(env.INSTAGRAM_API_BASE_URL, ['graph.facebook.com', 'graph.instagram.com']);
  if (!/^v[0-9]{1,3}\.[0-9]{1,2}$/.test(env.INSTAGRAM_API_VERSION) || !/^[0-9]{1,40}$/.test(env.INSTAGRAM_USER_ID)) throw new SocialError('action-required', 'Set a valid INSTAGRAM_API_VERSION and INSTAGRAM_USER_ID.');
  const api = (path: string) => new URL(`${base}/${env.INSTAGRAM_API_VERSION}/${path}`);
  const token = await context.token();
  if (request.job.copy_json.privacy && request.job.copy_json.privacy !== 'public') throw new SocialError('action-required', 'Instagram publishing supports public Reels. Review this publication privacy.');
  if (!context.checkpoint) {
    const text = caption(request, 2200); const videoUrl = httpsUrl(request.signedUrl).href;
    await context.save({ phase: 'instagram-creating' });
    const response = await context.json(api(`${env.INSTAGRAM_USER_ID}/media`), token, jsonPost({ media_type: 'REELS', video_url: videoUrl, caption: text, share_to_feed: true }), true);
    let id: string; try { id = identifier(response.id); } catch { throw uncertain(); }
    await context.save({ phase: 'instagram-container', operationId: id });
  }
  if (context.checkpoint?.phase === 'instagram-creating' || context.checkpoint?.phase === 'instagram-publishing') throw uncertain();
  if (context.checkpoint?.phase === 'instagram-container') {
    const id = identifier(context.checkpoint.operationId); const statusUrl = api(id); statusUrl.searchParams.set('fields', 'status_code');
    let finished = false;
    for (let poll = 0; poll < 40; poll++) {
      const status = await context.read(statusUrl, token, { method: 'GET' });
      if (status.status_code === 'FINISHED') { finished = true; break; }
      if (['ERROR', 'EXPIRED'].includes(String(status.status_code))) throw new SocialError('action-required', 'Instagram could not process this Reel. Inspect the provider account before retrying.');
      if (status.status_code === 'PUBLISHED') throw uncertain();
      if (status.status_code !== 'IN_PROGRESS') throw new SocialError('action-required', 'Instagram returned an unknown processing state.');
      if (poll < 39) await context.pause(5000);
    }
    if (!finished) throw pending();
    await context.save({ phase: 'instagram-publishing', operationId: id });
    const published = await context.json(api(`${env.INSTAGRAM_USER_ID}/media_publish`), token, jsonPost({ creation_id: id }), true);
    let mediaId: string; try { mediaId = identifier(published.id); } catch { throw uncertain(); }
    await context.save({ phase: 'instagram-media', operationId: mediaId });
  }
  if (context.checkpoint?.phase !== 'instagram-media') throw uncertain();
  const mediaId = identifier(context.checkpoint.operationId); const mediaUrl = api(mediaId); mediaUrl.searchParams.set('fields', 'permalink');
  const media = await context.read(mediaUrl, token, { method: 'GET' });
  const permalink = httpsUrl(media.permalink, ['instagram.com', 'www.instagram.com']);
  if (!/^\/(reel|p)\/[a-zA-Z0-9_-]+\/?$/.test(permalink.pathname) || permalink.search) throw new SocialError('action-required', 'Instagram did not return a valid Reel permalink.');
  return context.done({ externalId: mediaId, publicUrl: permalink.href, published: true, visibility: 'public' });
}
