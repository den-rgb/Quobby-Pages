import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { priceId } = (await request.json()) as { priceId?: string };

  const allowedPrices = [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY,
  ].filter(Boolean);

  if (!priceId || !allowedPrices.includes(priceId)) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  try {
    const stripe = getStripe();

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | undefined;

    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        customerId = undefined;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const TRIAL_DAYS = 7;
    const TRIAL_BLOCKING_STATUSES = ['active', 'trialing', 'past_due', 'canceled'];

    let eligibleForTrial = true;
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    });
    if (subs.data.some((s) => TRIAL_BLOCKING_STATUSES.includes(s.status))) {
      eligibleForTrial = false;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_collection: 'always',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${request.nextUrl.origin}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/profile`,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
        ...(eligibleForTrial ? { trial_period_days: TRIAL_DAYS } : {}),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
