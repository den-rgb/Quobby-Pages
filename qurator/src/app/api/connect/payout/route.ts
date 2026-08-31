import { QURATOR_EVENT, trackQuratorEvent } from '@/lib/qurator-analytics';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestUser } from '@/lib/request-user';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { MIN_WITHDRAW_CENTS, PAYOUT_HOLD_DAYS } from '@/lib/tutorial-pricing';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_payouts_enabled')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.stripe_connect_account_id || !profile.stripe_connect_payouts_enabled) {
    return NextResponse.json({ error: 'Payouts are not set up yet' }, { status: 400 });
  }

  const holdBefore = new Date(Date.now() - PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: sales } = await sb
    .from('tutorial_purchases')
    .select('creator_earn_cents')
    .eq('creator_id', user.id)
    .eq('source', 'stripe')
    .is('refunded_at', null)
    .lt('created_at', holdBefore);

  const { data: payouts } = await sb
    .from('creator_payouts')
    .select('amount_cents')
    .eq('creator_id', user.id)
    .in('status', ['pending', 'paid']);

  const earned = (sales ?? []).reduce((s, r) => s + (r.creator_earn_cents ?? 0), 0);
  const paidOut = (payouts ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const available = earned - paidOut;

  if (available < MIN_WITHDRAW_CENTS) {
    return NextResponse.json(
      { error: `Minimum withdrawal is €${(MIN_WITHDRAW_CENTS / 100).toFixed(0)}` },
      { status: 400 },
    );
  }

  const { data: payoutRow, error: insErr } = await sb
    .from('creator_payouts')
    .insert({
      creator_id: user.id,
      amount_cents: available,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insErr || !payoutRow) {
    return NextResponse.json({ error: 'Could not start payout' }, { status: 500 });
  }

  try {
    const stripe = getStripe();
    const transfer = await stripe.transfers.create({
      amount: available,
      currency: 'eur',
      destination: profile.stripe_connect_account_id as string,
      metadata: { payout_id: payoutRow.id, supabase_user_id: user.id },
    });
    await sb
      .from('creator_payouts')
      .update({ status: 'paid', stripe_transfer_id: transfer.id })
      .eq('id', payoutRow.id);
    await trackQuratorEvent(QURATOR_EVENT.PAYOUT_REQUESTED, user.id, {
      amountCents: available,
      payoutId: payoutRow.id,
    });
    return NextResponse.json({ ok: true, amountCents: available });
  } catch (err) {
    console.error('Payout transfer failed:', err);
    await sb.from('creator_payouts').update({ status: 'failed' }).eq('id', payoutRow.id);
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}
