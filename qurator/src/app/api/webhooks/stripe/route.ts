import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return secret;
}

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function setSubscription(userId: string, active: boolean) {
  const sb = supabaseAdmin();
  const { error } = await sb
    .from('profiles')
    .update({
      subscription_tier: active ? 'premium' : 'free',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error(`Failed to update subscription for ${userId}:`, error.message);
  }
}

function getUserIdFromMeta(metadata: Stripe.Metadata | null): string | null {
  return metadata?.supabase_user_id ?? null;
}

async function resolveUserId(
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.id ?? null;
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
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          const userId =
            getUserIdFromMeta(sub.metadata) ??
            (await resolveUserId(session.customer as string | null));
          if (userId) {
            const active = sub.status === 'active' || sub.status === 'trialing';
            await setSubscription(userId, active);
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
        await setSubscription(userId, active);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          getUserIdFromMeta(sub.metadata) ??
          (await resolveUserId(sub.customer as string | null));
        if (userId) {
          await setSubscription(userId, false);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const paidSubId =
          invoice.parent?.subscription_details?.subscription;
        if (paidSubId) {
          const subId =
            typeof paidSubId === 'string' ? paidSubId : paidSubId.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          const userId =
            getUserIdFromMeta(sub.metadata) ??
            (await resolveUserId(invoice.customer as string | null));
          if (userId) {
            await setSubscription(userId, true);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const failedSubId =
          invoice.parent?.subscription_details?.subscription;
        if (failedSubId) {
          const subId =
            typeof failedSubId === 'string' ? failedSubId : failedSubId.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          const userId =
            getUserIdFromMeta(sub.metadata) ??
            (await resolveUserId(invoice.customer as string | null));
          if (userId && sub.status !== 'active' && sub.status !== 'trialing') {
            await setSubscription(userId, false);
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  return NextResponse.json({ received: true });
}
