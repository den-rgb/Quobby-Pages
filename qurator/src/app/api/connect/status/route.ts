import { getRequestUser } from '@/lib/request-user';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_payouts_enabled')
    .eq('id', user.id)
    .maybeSingle();

  const accountId = profile?.stripe_connect_account_id as string | undefined;
  if (!accountId) {
    return NextResponse.json({
      onboarded: false,
      payoutsEnabled: false,
    });
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  const payoutsEnabled = !!account.payouts_enabled;
  if (payoutsEnabled !== !!profile?.stripe_connect_payouts_enabled) {
    await sb
      .from('profiles')
      .update({ stripe_connect_payouts_enabled: payoutsEnabled })
      .eq('id', user.id);
  }

  return NextResponse.json({
    onboarded: account.details_submitted,
    payoutsEnabled,
  });
}
