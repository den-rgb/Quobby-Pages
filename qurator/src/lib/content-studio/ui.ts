import type { PublicationStatus } from './types';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
export { validateSourceFiles } from './media.ts';

export function workerIsOnline(lastSeenAt: string | null, now: number): boolean {
  if (!lastSeenAt) return false;
  const age = now - Date.parse(lastSeenAt);
  return Number.isFinite(age) && age >= 0 && age <= 120_000;
}

// Provider messages and unknown codes may contain credentials. Only show curated summaries.
export function publicationErrorSummary(status: PublicationStatus, code: string | null): string | null {
  if (status === 'rejected') return 'Publication rejected.';
  if (status !== 'failed') return null;
  switch (code) {
    case 'publication-action-required': return 'Provider action required. Check the connected account, privacy, and app permissions on the Mac.';
    case 'publication-retryable': return 'The provider is processing this post or temporarily unavailable. Retry only the existing publication from the Mac.';
    case 'publication-uncertain': return 'Submission outcome uncertain. Inspect the provider account before retrying or creating another post.';
    case 'AUTH_REQUIRED': case 'TOKEN_EXPIRED': return 'Reconnect this platform on the worker Mac.';
    case 'RATE_LIMITED': return 'Platform rate limit reached. Check the worker logs on the Mac.';
    case 'POLICY_REJECTED': return 'The platform rejected this publication. Review its publishing policy.';
    default: return 'Publishing failed. Check the worker logs on the Mac.';
  }
}
