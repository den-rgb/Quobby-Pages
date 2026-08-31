import type { AdminAnalytics, AdminAnalyticsDays, AdminDayBucket } from '@/lib/admin-analytics-types';
import { ADMIN_ANALYTICS_DAYS } from '@/lib/admin-analytics-types';
import { QURATOR_EVENT } from '@/lib/qurator-events';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type { AdminAnalytics, AdminAnalyticsDays, AdminDayBucket } from '@/lib/admin-analytics-types';
export { ADMIN_ANALYTICS_DAYS } from '@/lib/admin-analytics-types';

type EventRow = {
  id: string;
  event_name: string;
  event_data: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
};

type TutorialRow = {
  id: string;
  title: string;
  creator_id: string | null;
  status: string;
  is_paid: boolean | null;
  play_count: number | null;
  rating_avg: number | null;
  rating_count: number | null;
  created_at: string;
  categories: { name: string } | { name: string }[] | null;
};

type PurchaseRow = {
  tutorial_id: string;
  creator_id: string;
  amount_paid_cents: number | null;
  platform_fee_cents: number | null;
  source: string;
  refunded_at: string | null;
  created_at: string;
  tutorials: { title: string } | { title: string }[] | null;
};

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function emptyBucket(date: string): AdminDayBucket {
  return {
    date,
    signups: 0,
    logins: 0,
    tutorialsCreated: 0,
    tutorialsPublished: 0,
    stripeStarted: 0,
    stripeReady: 0,
    purchases: 0,
    gmvCents: 0,
  };
}

function relationName(value: { name: string } | { name: string }[] | null | undefined): string | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? null;
}

function relationTitle(value: { title: string } | { title: string }[] | null | undefined): string {
  if (!value) return 'Untitled';
  const row = Array.isArray(value) ? value[0] : value;
  return row?.title || 'Untitled';
}

function inRange(iso: string, sinceMs: number): boolean {
  return new Date(iso).getTime() >= sinceMs;
}

export function parseAdminAnalyticsDays(raw: string | null): AdminAnalyticsDays {
  const n = Number(raw);
  if ((ADMIN_ANALYTICS_DAYS as readonly number[]).includes(n)) {
    return n as AdminAnalyticsDays;
  }
  return 30;
}

export async function loadAdminAnalytics(days: AdminAnalyticsDays): Promise<AdminAnalytics> {
  const sb = supabaseAdmin();
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  const [
    eventsRes,
    tutorialsRes,
    purchasesRes,
    payoutsRes,
    connectAccountsRes,
    connectReadyRes,
    signupsAllRes,
  ] = await Promise.all([
    sb
      .from('qurator_analytics')
      .select('id, event_name, event_data, user_id, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(8000),
    sb
      .from('tutorials')
      .select(
        'id, title, creator_id, status, is_paid, play_count, rating_avg, rating_count, created_at, categories(name)',
      )
      .order('created_at', { ascending: false })
      .limit(5000),
    sb
      .from('tutorial_purchases')
      .select(
        'tutorial_id, creator_id, amount_paid_cents, platform_fee_cents, source, refunded_at, created_at, tutorials(title)',
      )
      .order('created_at', { ascending: false })
      .limit(5000),
    sb
      .from('creator_payouts')
      .select('amount_cents, status, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
    sb
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('stripe_connect_account_id', 'is', null),
    sb
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('stripe_connect_payouts_enabled', true),
    sb
      .from('qurator_analytics')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', QURATOR_EVENT.PROFILE_SIGNUP),
  ]);

  const events = (eventsRes.data ?? []) as EventRow[];
  const tutorials = (tutorialsRes.data ?? []) as TutorialRow[];
  const purchases = (purchasesRes.data ?? []) as PurchaseRow[];
  const payouts = payoutsRes.data ?? [];

  const published = tutorials.filter((t) => t.status === 'published');
  const draft = tutorials.filter((t) => t.status === 'draft');
  const paidPublished = published.filter((t) => t.is_paid);
  const creatorIds = new Set(tutorials.map((t) => t.creator_id).filter(Boolean) as string[]);
  const publishedCreatorIds = new Set(
    published.map((t) => t.creator_id).filter(Boolean) as string[],
  );

  const paidPurchases = purchases.filter((p) => p.source === 'stripe' && !p.refunded_at);
  const welcomeClaims = purchases.filter((p) => p.source === 'welcome' && !p.refunded_at);
  const refunds = purchases.filter((p) => p.refunded_at);
  const paidPayouts = payouts.filter((p) => p.status === 'paid' || p.status === 'pending');

  const rangeEvents = events.filter((e) => inRange(e.created_at, sinceMs));
  const countEvents = (name: string) => rangeEvents.filter((e) => e.event_name === name);
  const signupEvents = countEvents(QURATOR_EVENT.PROFILE_SIGNUP);
  const loginEvents = countEvents(QURATOR_EVENT.QURATOR_LOGIN);
  const signupKind = (kind: string) =>
    signupEvents.filter((e) => (e.event_data?.kind as string | undefined) === kind).length;

  const tutorialsCreatedInRange = tutorials.filter((t) => inRange(t.created_at, sinceMs));
  const purchasesInRange = paidPurchases.filter((p) => inRange(p.created_at, sinceMs));
  const welcomeInRange = welcomeClaims.filter((p) => inRange(p.created_at, sinceMs));
  const payoutsInRange = paidPayouts.filter((p) => inRange(p.created_at as string, sinceMs));

  const seriesDays = lastNDays(Math.min(days, 90));
  const seriesMap = new Map(seriesDays.map((d) => [d, emptyBucket(d)]));

  for (const e of rangeEvents) {
    const bucket = seriesMap.get(utcDay(e.created_at));
    if (!bucket) continue;
    if (e.event_name === QURATOR_EVENT.PROFILE_SIGNUP) bucket.signups += 1;
    if (e.event_name === QURATOR_EVENT.QURATOR_LOGIN) bucket.logins += 1;
    if (e.event_name === QURATOR_EVENT.TUTORIAL_PUBLISHED) bucket.tutorialsPublished += 1;
    if (e.event_name === QURATOR_EVENT.STRIPE_CONNECT_STARTED) bucket.stripeStarted += 1;
    if (e.event_name === QURATOR_EVENT.STRIPE_CONNECT_READY) bucket.stripeReady += 1;
  }

  for (const t of tutorialsCreatedInRange) {
    const bucket = seriesMap.get(utcDay(t.created_at));
    if (bucket) bucket.tutorialsCreated += 1;
  }

  for (const p of purchasesInRange) {
    const bucket = seriesMap.get(utcDay(p.created_at));
    if (!bucket) continue;
    bucket.purchases += 1;
    bucket.gmvCents += p.amount_paid_cents ?? 0;
  }

  const saleCreatorIds = new Set(paidPurchases.map((p) => p.creator_id));
  const categoryCounts = new Map<string, number>();
  for (const t of published) {
    const name = relationName(t.categories) ?? 'Uncategorised';
    categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  }

  const sellerMap = new Map<string, { title: string; sales: number; gmvCents: number }>();
  for (const p of paidPurchases) {
    const current = sellerMap.get(p.tutorial_id) ?? {
      title: relationTitle(p.tutorials),
      sales: 0,
      gmvCents: 0,
    };
    current.sales += 1;
    current.gmvCents += p.amount_paid_cents ?? 0;
    sellerMap.set(p.tutorial_id, current);
  }

  return {
    days,
    generatedAt: new Date().toISOString(),
    live: {
      tutorials: {
        total: tutorials.length,
        draft: draft.length,
        published: published.length,
        paidPublished: paidPublished.length,
        creators: creatorIds.size,
        plays: tutorials.reduce((s, t) => s + (t.play_count ?? 0), 0),
      },
      stripe: {
        accounts: connectAccountsRes.count ?? 0,
        payoutsEnabled: connectReadyRes.count ?? 0,
      },
      commerce: {
        purchases: paidPurchases.length,
        welcomeClaims: welcomeClaims.length,
        gmvCents: paidPurchases.reduce((s, p) => s + (p.amount_paid_cents ?? 0), 0),
        platformFeeCents: paidPurchases.reduce((s, p) => s + (p.platform_fee_cents ?? 0), 0),
        refunds: refunds.length,
        payoutsPaidCents: paidPayouts.reduce((s, p) => s + ((p.amount_cents as number) ?? 0), 0),
        payoutsCount: paidPayouts.length,
      },
    },
    range: {
      signups: signupEvents.length,
      signupsNewAccount: signupKind('new_account'),
      signupsExistingAccount: signupKind('existing_account'),
      logins: loginEvents.length,
      uniqueLogins: new Set(loginEvents.map((e) => e.user_id).filter(Boolean)).size,
      stripeStarted: countEvents(QURATOR_EVENT.STRIPE_CONNECT_STARTED).length,
      stripeReady: countEvents(QURATOR_EVENT.STRIPE_CONNECT_READY).length,
      tutorialsCreated: tutorialsCreatedInRange.length,
      tutorialsPublished: countEvents(QURATOR_EVENT.TUTORIAL_PUBLISHED).length,
      tutorialsForked: countEvents(QURATOR_EVENT.TUTORIAL_FORKED).length,
      purchases: purchasesInRange.length,
      welcomeClaims: welcomeInRange.length,
      gmvCents: purchasesInRange.reduce((s, p) => s + (p.amount_paid_cents ?? 0), 0),
      platformFeeCents: purchasesInRange.reduce((s, p) => s + (p.platform_fee_cents ?? 0), 0),
      payouts: payoutsInRange.length,
      premiumActivated: countEvents(QURATOR_EVENT.PREMIUM_ACTIVATED).length,
      referrals: countEvents(QURATOR_EVENT.REFERRAL_CREDIT_GRANTED).length,
    },
    funnel: [
      { label: 'Sign-ups', count: signupsAllRes.count ?? signupEvents.length },
      { label: 'Created a tutorial', count: creatorIds.size },
      { label: 'Published', count: publishedCreatorIds.size },
      { label: 'Stripe payouts ready', count: connectReadyRes.count ?? 0 },
      { label: 'Made a sale', count: saleCreatorIds.size },
    ],
    series: seriesDays.map((d) => seriesMap.get(d)!),
    topTutorials: [...published]
      .sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0))
      .slice(0, 8)
      .map((t) => ({
        id: t.id,
        title: t.title,
        playCount: t.play_count ?? 0,
        ratingAvg: t.rating_avg ?? 0,
        ratingCount: t.rating_count ?? 0,
        isPaid: !!t.is_paid,
        status: t.status,
      })),
    topSellers: [...sellerMap.entries()]
      .map(([tutorialId, row]) => ({ tutorialId, ...row }))
      .sort((a, b) => b.gmvCents - a.gmvCents)
      .slice(0, 8),
    categories: [...categoryCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    recent: events.slice(0, 40).map((e) => ({
      id: e.id,
      eventName: e.event_name,
      userId: e.user_id,
      createdAt: e.created_at,
      eventData: e.event_data ?? {},
    })),
  };
}
