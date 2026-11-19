import type { PublicationResult } from '../client.ts';
import type { PublicationRequest } from '../worker.ts';
import { publishInstagram } from './instagram.ts';
import { publishTikTok } from './tiktok.ts';
import { SocialContext, SocialError, type SocialDependencies } from './types.ts';
import { publishYouTube } from './youtube.ts';

export async function publishPublication(request: PublicationRequest, dependencies: SocialDependencies = {}): Promise<PublicationResult> {
  const context = new SocialContext(request, dependencies); await context.load();
  if (context.checkpoint?.phase === 'done') return context.checkpoint.result!;
  switch (request.job.platform) {
    case 'instagram': return publishInstagram(request, context);
    case 'tiktok': return publishTikTok(request, context);
    case 'youtube': return publishYouTube(request, context);
    default: throw new SocialError('action-required', 'Choose a supported social platform.');
  }
}
