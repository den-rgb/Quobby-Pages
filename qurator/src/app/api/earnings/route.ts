import { getRequestUser } from '@/lib/request-user';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { MIN_WITHDRAW_CENTS, PAYOUT_HOLD_DAYS } from '@/lib/tutorial-pricing';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const holdBefore = new Date(Date.now() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: allSales }, { data: payouts }, { data: library }, { data: welcome }, { data: profile }] =
      await Promise.all([
        sb
          .from('tutorial_purchases')
          .select('id, tutorial_id, amount_paid_cents, creator_earn_cents, source, created_at, refunded_at, tutorials(title)')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        sb
          .from('creator_payouts')
          .select('id, amount_cents, status, created_at')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        sb
          .from('tutorial_purchases')
          .select('tutorial_id, created_at, source, tutorials(title, is_paid, price_cents)')
          .eq('buyer_id', user.id)
          .is('refunded_at', null)
          .order('created_at', { ascending: false }),
        sb
          .from('tutorial_purchases')
          .select('id')
          .eq('buyer_id', user.id)
          .eq('source', 'welcome')
          .maybeSingle(),
        sb
          .from('profiles')
          .select(
            'created_at, subscription_tier, has_lifetime_premium, stripe_subscription_status, referral_credit_cents, stripe_connect_payouts_enabled',
          )
          .eq('id', user.id)
          .maybeSingle(),
      ]);

    const paidSales = (allSales ?? []).filter((s) => s.source === 'stripe' && !s.refunded_at);
    const lifetime = paidSales.reduce((s, r) => s + (r.creator_earn_cents ?? 0), 0);
    const availableSales = paidSales.filter((s) => s.created_at < holdBefore);
    const availableEarned = availableSales.reduce((s, r) => s + (r.creator_earn_cents ?? 0), 0);
    const paidOut = (payouts ?? [])
      .filter((p) => p.status === 'pending' || p.status === 'paid')
      .reduce((s, r) => s + (r.amount_cents ?? 0), 0);

    return NextResponse.json({
      lifetimeCents: lifetime,
      availableCents: Math.max(0, availableEarned - paidOut),
      minWithdrawCents: MIN_WITHDRAW_CENTS,
      payoutsEnabled: !!profile?.stripe_connect_payouts_enabled,
      sales: allSales ?? [],
      payouts: payouts ?? [],
      library: library ?? [],
      welcomeUsed: !!welcome,
      profile,
    });
  } catch (err) {
    console.error('Earnings fetch failed:', err);
    return NextResponse.json({ error: 'Failed to load earnings' }, { status: 500 });
  }
}
