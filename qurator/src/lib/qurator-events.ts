export const QURATOR_EVENT = {
  PROFILE_SIGNUP: 'profile_signup',
  QURATOR_LOGIN: 'qurator_login',
  STRIPE_CONNECT_STARTED: 'stripe_connect_started',
  STRIPE_CONNECT_READY: 'stripe_connect_ready',
  TUTORIAL_CREATED: 'tutorial_created',
  TUTORIAL_PUBLISHED: 'tutorial_published',
  TUTORIAL_UNPUBLISHED: 'tutorial_unpublished',
  TUTORIAL_FORKED: 'tutorial_forked',
  TUTORIAL_PAID_ENABLED: 'tutorial_paid_enabled',
  TUTORIAL_PURCHASED: 'tutorial_purchased',
  WELCOME_CLAIMED: 'welcome_claimed',
  PAYOUT_REQUESTED: 'payout_requested',
  REFERRAL_CREDIT_GRANTED: 'referral_credit_granted',
  PREMIUM_ACTIVATED: 'premium_activated',
  PREMIUM_CANCELED: 'premium_canceled',
} as const;

export type QuratorEventName = (typeof QURATOR_EVENT)[keyof typeof QURATOR_EVENT];

export const CLIENT_QURATOR_EVENTS = new Set<string>([
  QURATOR_EVENT.TUTORIAL_CREATED,
  QURATOR_EVENT.TUTORIAL_PUBLISHED,
  QURATOR_EVENT.TUTORIAL_UNPUBLISHED,
  QURATOR_EVENT.TUTORIAL_FORKED,
  QURATOR_EVENT.TUTORIAL_PAID_ENABLED,
]);

export function trackClientEvent(
  eventName: string,
  eventData: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined') return;
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventName, eventData }),
  }).catch(() => {});
}
