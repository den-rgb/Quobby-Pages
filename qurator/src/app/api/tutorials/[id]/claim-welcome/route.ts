import { QURATOR_EVENT, trackQuratorEvent } from '@/lib/qurator-analytics';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestUser } from '@/lib/request-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildQuoteForUser, maybeGrantReferralCredit } from '@/lib/tutorial-commerce';
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
  if (result.quote.kind !== 'welcome') {
    return NextResponse.json({ error: 'Not eligible for a welcome grant' }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from('tutorial_purchases').insert({
    tutorial_id: id,
    buyer_id: user.id,
    creator_id: result.tutorial.creator_id,
    list_price_cents: result.quote.listPriceCents,
    amount_paid_cents: 0,
    discount_bps: 10000,
    platform_fee_cents: 0,
    stripe_fee_cents: 0,
    creator_earn_cents: 0,
    currency: 'eur',
    source: 'welcome',
  });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Welcome grant already used' }, { status: 409 });
    }
    console.error('Welcome claim failed:', error.message);
    return NextResponse.json({ error: 'Failed to claim tutorial' }, { status: 500 });
  }

  await maybeGrantReferralCredit(user.id);
  await trackQuratorEvent(QURATOR_EVENT.WELCOME_CLAIMED, user.id, {
    tutorialId: id,
    creatorId: result.tutorial.creator_id,
    listPriceCents: result.quote.listPriceCents,
  });
  return NextResponse.json({ ok: true });
}
