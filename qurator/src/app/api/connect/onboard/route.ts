import { QURATOR_EVENT, trackQuratorEvent } from '@/lib/qurator-analytics';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestUser } from '@/lib/request-user';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stripe = getStripe();
  const sb = supabaseAdmin();
  const { data: profile } = await sb
    .from('profiles')
    .select('stripe_connect_account_id, email')
    .eq('id', user.id)
    .maybeSingle();

  let accountId = profile?.stripe_connect_account_id as string | undefined;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      metadata: { supabase_user_id: user.id },
      capabilities: { transfers: { requested: true } },
      email: user.email ?? undefined,
    });
    accountId = account.id;
    await sb
      .from('profiles')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', user.id);
    await trackQuratorEvent(QURATOR_EVENT.STRIPE_CONNECT_STARTED, user.id, {
      accountId,
    });
  }

  const origin = request.nextUrl.origin;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/profile?connect=refresh`,
    return_url: `${origin}/profile?connect=return`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: link.url });
}
