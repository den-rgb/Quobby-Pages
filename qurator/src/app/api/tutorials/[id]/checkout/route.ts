import { rateLimit } from '@/lib/rate-limit';
import { getRequestUser } from '@/lib/request-user';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildQuoteForUser, loadBuyerPricingContext } from '@/lib/tutorial-commerce';
import { TERMS_BUYER_URL } from '@/lib/tutorial-pricing';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, { maxRequests: 8, windowMs: 60_000 });
  if (limited) return limited;

  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await buildQuoteForUser(user.id, id);
  if (result.error || !result.quote || !result.tutorial) {
    return NextResponse.json({ error: result.error ?? 'Failed' }, { status: result.status ?? 400 });
  }

  if (result.quote.kind === 'owner') {
    return NextResponse.json({ error: 'You already have access to your own tutorial' }, { status: 400 });
  }
  if (result.quote.kind === 'already_owned') {
    return NextResponse.json({ error: 'Already purchased' }, { status: 400 });
  }
  if (result.quote.kind === 'welcome') {
    return NextResponse.json({ error: 'Use the welcome claim instead' }, { status: 400 });
  }

  const ctx = await loadBuyerPricingContext(user.id, id);
  const stripe = getStripe();
  const sb = supabaseAdmin();

  let customerId = ctx.profile?.stripe_customer_id as string | undefined;
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
    await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const origin = request.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    currency: 'eur',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: result.quote.chargedCents,
          product_data: {
            name: (result.tutorial.title as string) || 'Qurator tutorial',
            description: 'Personal licence to play this Qurator tutorial.',
          },
        },
      },
    ],
    success_url: `${origin}/tutorials/${id}?purchased=1`,
    cancel_url: `${origin}/tutorials/${id}`,
    consent_collection: { terms_of_service: 'required' },
    custom_text: {
      terms_of_service_acceptance: {
        message: `I agree to the Buyer rules (${TERMS_BUYER_URL}) and waive my 14-day withdrawal right because digital access is granted immediately.`,
      },
    },
    metadata: {
      type: 'tutorial_purchase',
      tutorial_id: id,
      buyer_id: user.id,
      creator_id: result.tutorial.creator_id as string,
      list_price_cents: String(result.quote.listPriceCents),
      charged_cents: String(result.quote.chargedCents),
      platform_fee_cents: String(result.quote.platformFeeCents),
      discount_bps: String(Math.round(result.quote.loyaltyRate * 10000)),
      referral_credit_applied: String(result.quote.referralCreditApplied),
    },
  });

  return NextResponse.json({ url: session.url });
}
