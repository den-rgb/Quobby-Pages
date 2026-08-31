export const TUTORIAL_CURRENCY = 'eur';
export const MIN_PRICE_CENTS = 200;
export const MAX_PRICE_CENTS = 4999;
export const WELCOME_MAX_PRICE_CENTS = 500;
export const WELCOME_MAX_AGE_DAYS = 30;
export const LOYALTY_FLOOR = 0.05;
export const LOYALTY_RANGE = 0.3;
export const LOYALTY_YEARS = 2;
export const PLATFORM_FEE_RATE = 0.1;
export const MIN_CHARGE_CENTS = 50;
export const MIN_WITHDRAW_CENTS = 2000;
export const REFERRAL_CREDIT_CENTS = 300;
export const PAYOUT_HOLD_DAYS = 14;
export const TERMS_SELLER_URL = 'https://www.quobby.com/terms.html#seller-rules';
export const TERMS_BUYER_URL = 'https://www.quobby.com/terms.html#buyer-rules';

export function isPaidPremium(opts: {
  hasLifetimePremium?: boolean | null;
  subscriptionTier?: string | null;
  stripeSubscriptionStatus?: string | null;
}): boolean {
  if (opts.hasLifetimePremium) return true;
  return (
    opts.subscriptionTier === 'premium' &&
    opts.stripeSubscriptionStatus === 'active'
  );
}

export function loyaltyRate(
  accountCreatedAt: string | Date | null | undefined,
  paidPremium: boolean,
): number {
  if (!paidPremium) return 0;
  if (!accountCreatedAt) return LOYALTY_FLOOR;
  const created =
    accountCreatedAt instanceof Date
      ? accountCreatedAt
      : new Date(accountCreatedAt);
  const years = Math.max(0, (Date.now() - created.getTime()) / (365 * 24 * 60 * 60 * 1000));
  return LOYALTY_FLOOR + Math.min(LOYALTY_RANGE, (years / LOYALTY_YEARS) * LOYALTY_RANGE);
}

export function isWelcomeEligible(opts: {
  accountCreatedAt: string | Date | null | undefined;
  hasWelcomeGrant: boolean;
  isOwnTutorial: boolean;
  priceCents: number;
}): boolean {
  if (opts.hasWelcomeGrant || opts.isOwnTutorial) return false;
  if (opts.priceCents > WELCOME_MAX_PRICE_CENTS) return false;
  if (!opts.accountCreatedAt) return false;
  const created =
    opts.accountCreatedAt instanceof Date
      ? opts.accountCreatedAt
      : new Date(opts.accountCreatedAt);
  const ageMs = Date.now() - created.getTime();
  return ageMs >= 0 && ageMs <= WELCOME_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export type QuoteKind = 'welcome' | 'paid' | 'owner' | 'already_owned';

export interface TutorialQuote {
  kind: QuoteKind;
  listPriceCents: number;
  chargedCents: number;
  loyaltyRate: number;
  loyaltyCents: number;
  referralCreditApplied: number;
  platformFeeCents: number;
  welcomeEligible: boolean;
  currency: string;
}

export function quotePaidTutorial(opts: {
  listPriceCents: number;
  paidPremium: boolean;
  accountCreatedAt: string | Date | null | undefined;
  hasWelcomeGrant: boolean;
  isOwnTutorial: boolean;
  alreadyOwned: boolean;
  referralCreditCents: number;
}): TutorialQuote {
  const list = opts.listPriceCents;
  if (opts.isOwnTutorial) {
    return {
      kind: 'owner',
      listPriceCents: list,
      chargedCents: 0,
      loyaltyRate: 0,
      loyaltyCents: 0,
      referralCreditApplied: 0,
      platformFeeCents: 0,
      welcomeEligible: false,
      currency: TUTORIAL_CURRENCY,
    };
  }
  if (opts.alreadyOwned) {
    return {
      kind: 'already_owned',
      listPriceCents: list,
      chargedCents: 0,
      loyaltyRate: 0,
      loyaltyCents: 0,
      referralCreditApplied: 0,
      platformFeeCents: 0,
      welcomeEligible: false,
      currency: TUTORIAL_CURRENCY,
    };
  }

  const welcomeEligible = isWelcomeEligible({
    accountCreatedAt: opts.accountCreatedAt,
    hasWelcomeGrant: opts.hasWelcomeGrant,
    isOwnTutorial: false,
    priceCents: list,
  });

  if (welcomeEligible) {
    return {
      kind: 'welcome',
      listPriceCents: list,
      chargedCents: 0,
      loyaltyRate: 0,
      loyaltyCents: 0,
      referralCreditApplied: 0,
      platformFeeCents: 0,
      welcomeEligible: true,
      currency: TUTORIAL_CURRENCY,
    };
  }

  const rate = loyaltyRate(opts.accountCreatedAt, opts.paidPremium);
  const loyaltyCents = Math.round(list * rate);
  const credit = Math.max(0, opts.referralCreditCents);
  const charged = Math.max(list - loyaltyCents - credit, MIN_CHARGE_CENTS);
  const referralApplied = Math.min(credit, Math.max(0, list - loyaltyCents - charged));
  const platformFeeCents = Math.round(charged * PLATFORM_FEE_RATE);

  return {
    kind: 'paid',
    listPriceCents: list,
    chargedCents: charged,
    loyaltyRate: rate,
    loyaltyCents,
    referralCreditApplied: referralApplied,
    platformFeeCents,
    welcomeEligible: false,
    currency: TUTORIAL_CURRENCY,
  };
}

export function creatorEarnCents(amountPaidCents: number, platformFeeCents: number, stripeFeeCents: number): number {
  return Math.max(0, amountPaidCents - platformFeeCents - stripeFeeCents);
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function estimatedCreatorPayoutCents(listPriceCents: number): number {
  const platform = Math.round(listPriceCents * PLATFORM_FEE_RATE);
  const stripeEstimate = Math.round(listPriceCents * 0.015 + 25);
  return creatorEarnCents(listPriceCents, platform, stripeEstimate);
}
