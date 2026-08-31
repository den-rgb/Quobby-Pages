import { supabaseAdmin } from '@/lib/supabase/admin';
import { QURATOR_EVENT, trackQuratorEvent } from '@/lib/qurator-analytics';
import {
  isPaidPremium,
  quotePaidTutorial,
  type TutorialQuote,
} from '@/lib/tutorial-pricing';
import { getStripe } from '@/lib/stripe';

export async function maybeGrantReferralCredit(refereeId: string): Promise<void> {
  const sb = supabaseAdmin();
  const { data: profile } = await sb
    .from('profiles')
    .select('referred_by')
    .eq('id', refereeId)
    .maybeSingle();
  const referrerId = profile?.referred_by as string | null;
  if (!referrerId || referrerId === refereeId) return;

  const { count } = await sb
    .from('tutorial_purchases')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', refereeId);
  if ((count ?? 0) !== 1) return;

  const { data: referrer } = await sb
    .from('profiles')
    .select('referral_credit_cents')
    .eq('id', referrerId)
    .maybeSingle();
  const current = (referrer?.referral_credit_cents as number | null) ?? 0;
  if (current > 0) return;

  await sb
    .from('profiles')
    .update({ referral_credit_cents: 300, updated_at: new Date().toISOString() })
    .eq('id', referrerId);
  await trackQuratorEvent(QURATOR_EVENT.REFERRAL_CREDIT_GRANTED, referrerId, {
    refereeId,
  });
}

export async function loadBuyerPricingContext(userId: string, tutorialId: string) {
  const sb = supabaseAdmin();
  const [{ data: profile }, { data: tutorial }, { data: purchase }, { data: welcome }] =
    await Promise.all([
      sb
        .from('profiles')
        .select(
          'created_at, subscription_tier, has_lifetime_premium, stripe_subscription_status, stripe_customer_id, referral_credit_cents, referred_by, stripe_connect_account_id, stripe_connect_payouts_enabled',
        )
        .eq('id', userId)
        .maybeSingle(),
      sb
        .from('tutorials')
        .select('id, creator_id, is_paid, price_cents, currency, status, title')
        .eq('id', tutorialId)
        .maybeSingle(),
      sb
        .from('tutorial_purchases')
        .select('id')
        .eq('tutorial_id', tutorialId)
        .eq('buyer_id', userId)
        .is('refunded_at', null)
        .maybeSingle(),
      sb
        .from('tutorial_purchases')
        .select('id')
        .eq('buyer_id', userId)
        .eq('source', 'welcome')
        .maybeSingle(),
    ]);

  return { profile, tutorial, purchase, welcome };
}

export async function buildQuoteForUser(
  userId: string,
  tutorialId: string,
): Promise<{ error?: string; status?: number; quote?: TutorialQuote; tutorial?: Record<string, unknown> }> {
  const ctx = await loadBuyerPricingContext(userId, tutorialId);
  if (!ctx.tutorial) return { error: 'Tutorial not found', status: 404 };
  if (!ctx.tutorial.is_paid || !ctx.tutorial.price_cents) {
    return { error: 'Tutorial is not paid', status: 400 };
  }

  const paidPremium = isPaidPremium({
    hasLifetimePremium: ctx.profile?.has_lifetime_premium,
    subscriptionTier: ctx.profile?.subscription_tier,
    stripeSubscriptionStatus: ctx.profile?.stripe_subscription_status,
  });

  const quote = quotePaidTutorial({
    listPriceCents: ctx.tutorial.price_cents as number,
    paidPremium,
    accountCreatedAt: ctx.profile?.created_at as string | undefined,
    hasWelcomeGrant: !!ctx.welcome,
    isOwnTutorial: ctx.tutorial.creator_id === userId,
    alreadyOwned: !!ctx.purchase,
    referralCreditCents: (ctx.profile?.referral_credit_cents as number | null) ?? 0,
  });

  return { quote, tutorial: ctx.tutorial };
}

export async function stripeFeeFromPaymentIntent(paymentIntentId: string): Promise<number> {
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge.balance_transaction'],
  });
  const charge = pi.latest_charge;
  if (!charge || typeof charge === 'string') return 0;
  const bt = charge.balance_transaction;
  if (!bt || typeof bt === 'string') return 0;
  return bt.fee ?? 0;
}
