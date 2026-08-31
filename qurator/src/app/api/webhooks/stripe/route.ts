import { QURATOR_EVENT, trackQuratorEvent } from '@/lib/qurator-analytics';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { creatorEarnCents } from '@/lib/tutorial-pricing';
import { maybeGrantReferralCredit, stripeFeeFromPaymentIntent } from '@/lib/tutorial-commerce';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return secret;
}

async function setSubscription(
  userId: string,
  active: boolean,
  status?: string,
) {
  const sb = supabaseAdmin();
  const { data: prev } = await sb
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  const { error } = await sb
    .from('profiles')
    .update({
      subscription_tier: active ? 'premium' : 'free',
      stripe_subscription_status: status ?? (active ? 'active' : ''),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error(`Failed to update subscription for ${userId}:`, error.message);
    return;
  }

  const wasPremium = prev?.subscription_tier === 'premium';
  if (active && !wasPremium) {
    await trackQuratorEvent(QURATOR_EVENT.PREMIUM_ACTIVATED, userId, { status: status ?? 'active' });
  } else if (!active && wasPremium) {
    await trackQuratorEvent(QURATOR_EVENT.PREMIUM_CANCELED, userId, { status: status ?? 'canceled' });
  }
}

function getUserIdFromMeta(metadata: Stripe.Metadata | null): string | null {
  return metadata?.supabase_user_id ?? null;
}

async function resolveUserId(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function fulfillTutorialPurchase(session: Stripe.Checkout.Session) {
  if (session.metadata?.type !== 'tutorial_purchase') return;
  const tutorialId = session.metadata.tutorial_id;
  const buyerId = session.metadata.buyer_id;
  const creatorId = session.metadata.creator_id;
  if (!tutorialId || !buyerId || !creatorId) return;

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  const amountPaid = session.amount_total ?? Number(session.metadata.charged_cents ?? 0);
  const platformFee = Number(session.metadata.platform_fee_cents ?? 0);
  const listPrice = Number(session.metadata.list_price_cents ?? amountPaid);
  const discountBps = Number(session.metadata.discount_bps ?? 0);
  const referralApplied = Number(session.metadata.referral_credit_applied ?? 0);
  const stripeFee = paymentIntentId ? await stripeFeeFromPaymentIntent(paymentIntentId) : 0;
  const creatorEarn = creatorEarnCents(amountPaid, platformFee, stripeFee);

  const sb = supabaseAdmin();
  const { error } = await sb.from('tutorial_purchases').insert({
    tutorial_id: tutorialId,
    buyer_id: buyerId,
    creator_id: creatorId,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId ?? null,
    list_price_cents: listPrice,
    amount_paid_cents: amountPaid,
    discount_bps: discountBps,
    platform_fee_cents: platformFee,
    stripe_fee_cents: stripeFee,
    creator_earn_cents: creatorEarn,
    currency: session.currency ?? 'eur',
    source: 'stripe',
  });

  if (error) {
    if (error.code === '23505') return;
    console.error('Purchase insert failed:', error.message);
    return;
  }

  await trackQuratorEvent(QURATOR_EVENT.TUTORIAL_PURCHASED, buyerId, {
    tutorialId,
    creatorId,
    amountPaidCents: amountPaid,
    platformFeeCents: platformFee,
    listPriceCents: listPrice,
  });

  if (referralApplied > 0) {
    await sb.from('profiles').update({ referral_credit_cents: 0 }).eq('id', buyerId);
  }
  await maybeGrantReferralCredit(buyerId);
}

async function refundPurchase(paymentIntentId: string) {
  const sb = supabaseAdmin();
  await sb
    .from('tutorial_purchases')
    .update({ refunded_at: new Date().toISOString(), creator_earn_cents: 0 })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .is('refunded_at', null);
}

async function syncConnectAccount(account: Stripe.Account) {
  const sb = supabaseAdmin();
  const metaUserId = account.metadata?.supabase_user_id;
  const { data: prev } = metaUserId
    ? await sb
        .from('profiles')
        .select('id, stripe_connect_payouts_enabled')
        .eq('id', metaUserId)
        .maybeSingle()
    : await sb
        .from('profiles')
        .select('id, stripe_connect_payouts_enabled')
        .eq('stripe_connect_account_id', account.id)
        .maybeSingle();

  const userId = prev?.id ?? metaUserId;
  if (userId) {
    await sb
      .from('profiles')
      .update({ stripe_connect_payouts_enabled: !!account.payouts_enabled })
      .eq('id', userId);
  } else {
    await sb
      .from('profiles')
      .update({ stripe_connect_payouts_enabled: !!account.payouts_enabled })
      .eq('stripe_connect_account_id', account.id);
  }

  if (userId && !prev?.stripe_connect_payouts_enabled && account.payouts_enabled) {
    await trackQuratorEvent(QURATOR_EVENT.STRIPE_CONNECT_READY, userId, {
      accountId: account.id,
    });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'payment') {
          await fulfillTutorialPurchase(session);
        } else if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          const userId =
            getUserIdFromMeta(sub.metadata) ??
            (await resolveUserId(session.customer as string | null));
          if (userId) {
            const active = sub.status === 'active' || sub.status === 'trialing';
            await setSubscription(userId, active, sub.status);
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          getUserIdFromMeta(sub.metadata) ??
          (await resolveUserId(sub.customer as string | null));
        if (!userId) break;
        const active = sub.status === 'active' || sub.status === 'trialing';
        await setSubscription(userId, active, sub.status);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          getUserIdFromMeta(sub.metadata) ??
          (await resolveUserId(sub.customer as string | null));
        if (userId) {
          await setSubscription(userId, false, 'canceled');
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const paidSubId = invoice.parent?.subscription_details?.subscription;
        if (paidSubId) {
          const subId = typeof paidSubId === 'string' ? paidSubId : paidSubId.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          const userId =
            getUserIdFromMeta(sub.metadata) ??
            (await resolveUserId(invoice.customer as string | null));
          if (userId) {
            await setSubscription(userId, true, sub.status);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const failedSubId = invoice.parent?.subscription_details?.subscription;
        if (failedSubId) {
          const subId =
            typeof failedSubId === 'string' ? failedSubId : failedSubId.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          const userId =
            getUserIdFromMeta(sub.metadata) ??
            (await resolveUserId(invoice.customer as string | null));
          if (userId && sub.status !== 'active' && sub.status !== 'trialing') {
            await setSubscription(userId, false, sub.status);
          }
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const pi =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (pi) await refundPurchase(pi);
        break;
      }

      case 'account.updated': {
        await syncConnectAccount(event.data.object as Stripe.Account);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  return NextResponse.json({ received: true });
}
