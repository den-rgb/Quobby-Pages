'use client';

import type { AdminAnalytics, AdminDayBucket } from '@/lib/admin-analytics-types';
import { ADMIN_ANALYTICS_DAYS } from '@/lib/admin-analytics-types';
import { useAuth } from '@/lib/auth';
import { formatEur } from '@/lib/tutorial-pricing';
import {
  BarChart3,
  BookOpen,
  CreditCard,
  Euro,
  Gift,
  Globe,
  Loader2,
  LogIn,
  Play,
  RefreshCw,
  ShieldAlert,
  Star,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const EVENT_LABELS: Record<string, string> = {
  profile_signup: 'Profile sign-up',
  qurator_login: 'Sign-in',
  stripe_connect_started: 'Stripe setup started',
  stripe_connect_ready: 'Stripe payouts ready',
  tutorial_created: 'Tutorial created',
  tutorial_published: 'Tutorial published',
  tutorial_unpublished: 'Tutorial unpublished',
  tutorial_forked: 'Tutorial forked',
  tutorial_paid_enabled: 'Paid listing on',
  tutorial_purchased: 'Purchase',
  welcome_claimed: 'Welcome grant',
  payout_requested: 'Payout',
  referral_credit_granted: 'Referral credit',
  premium_activated: 'Premium activated',
  premium_canceled: 'Premium canceled',
};

function MiniBars({
  series,
  value,
  color,
}: {
  series: AdminDayBucket[];
  value: keyof AdminDayBucket;
  color: string;
}) {
  const values = series.map((d) => (typeof d[value] === 'number' ? (d[value] as number) : 0));
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-px h-14" aria-hidden>
      {series.map((d, i) => {
        const v = values[i];
        return (
          <div
            key={d.date}
            className="flex-1 rounded-t min-h-0"
            style={{
              height: v > 0 ? `${Math.max(8, (v / max) * 100)}%` : '2px',
              background: v > 0 ? color : 'rgba(255,255,255,0.06)',
            }}
            title={`${d.date}: ${value === 'gmvCents' ? formatEur(v) : v}`}
          />
        );
      })}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof UserPlus;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-accent" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint">
          {label}
        </p>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-foreground-faint mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [days, setDays] = useState<(typeof ADMIN_ANALYTICS_DAYS)[number]>(30);
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?days=${range}`);
      if (res.status === 403) {
        setError('forbidden');
        setData(null);
        return;
      }
      if (!res.ok) {
        setError('Failed to load analytics');
        return;
      }
      setData((await res.json()) as AdminAnalytics);
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setData(null);
      return;
    }
    void load(days);
  }, [authLoading, user, days, load]);

  if (authLoading || (user && loading && !data && error === null)) {
    return (
      <div className="max-w-[1100px] mx-auto px-6 py-16 flex items-center justify-center text-foreground-muted gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading analytics…
      </div>
    );
  }

  if (!user || error === 'forbidden') {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h1 className="text-lg font-semibold text-foreground mb-2">Admin only</h1>
        <p className="text-sm text-foreground-muted mb-6">
          You need an admin account to view Qurator analytics.
        </p>
        <Link href="/" className="text-sm text-accent hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  const rangeHint = `Last ${days} days`;

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-accent" />
            <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          </div>
          <p className="text-sm text-foreground-muted">
            Qurator sign-ups, Stripe Connect, tutorials, and sales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/[0.04] border border-white/[0.08] rounded-xl p-0.5">
            {ADMIN_ANALYTICS_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${days === d
                    ? 'bg-accent text-black'
                    : 'text-foreground-muted hover:text-foreground'
                  }`}
              >
                {d === 365 ? '1y' : `${d}d`}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load(days)}
            className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-white/5"
            aria-label="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && error !== 'forbidden' && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      {data && (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
            {rangeHint}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard
              icon={UserPlus}
              label="Sign-ups"
              value={data.range.signups.toLocaleString()}
              hint={`${data.range.signupsNewAccount} new · ${data.range.signupsExistingAccount} existing Quobby`}
            />
            <StatCard
              icon={CreditCard}
              label="Stripe setups"
              value={`${data.range.stripeStarted} / ${data.range.stripeReady}`}
              hint="Started / payouts ready"
            />
            <StatCard
              icon={BookOpen}
              label="Tutorials created"
              value={data.range.tutorialsCreated.toLocaleString()}
              hint={`${data.range.tutorialsPublished} published · ${data.range.tutorialsForked} forked`}
            />
            <StatCard
              icon={Euro}
              label="Sales"
              value={formatEur(data.range.gmvCents)}
              hint={`${data.range.purchases} purchases · ${formatEur(data.range.platformFeeCents)} fee`}
            />
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
            All-time snapshot
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard
              icon={Users}
              label="Creators"
              value={data.live.tutorials.creators.toLocaleString()}
              hint={`${data.live.tutorials.published} published · ${data.live.tutorials.paidPublished} paid`}
            />
            <StatCard
              icon={Wallet}
              label="Stripe Connect"
              value={`${data.live.stripe.payoutsEnabled}/${data.live.stripe.accounts}`}
              hint="Payouts ready / accounts"
            />
            <StatCard
              icon={Play}
              label="Plays"
              value={data.live.tutorials.plays.toLocaleString()}
              hint={`${data.live.tutorials.total} tutorials total`}
            />
            <StatCard
              icon={Gift}
              label="Welcome grants"
              value={data.live.commerce.welcomeClaims.toLocaleString()}
              hint={`${data.range.referrals} referral credits in range`}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-4">
                Creator funnel (all time)
              </p>
              <div className="space-y-2">
                {data.funnel.map((step, i) => {
                  const max = Math.max(1, data.funnel[0]?.count ?? 1);
                  return (
                    <div key={step.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground-muted">
                          {i + 1}. {step.label}
                        </span>
                        <span className="text-foreground font-medium">{step.count}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.min(100, (step.count / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
                More in this range
              </p>
              <ul className="text-sm text-foreground-muted space-y-2">
                <li className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <LogIn className="w-3.5 h-3.5" /> Sign-ins
                  </span>
                  <span className="text-foreground">
                    {data.range.logins} ({data.range.uniqueLogins} people)
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" /> Premium activated
                  </span>
                  <span className="text-foreground">{data.range.premiumActivated}</span>
                </li>
                <li className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5" /> Payouts
                  </span>
                  <span className="text-foreground">
                    {data.range.payouts} · all-time {formatEur(data.live.commerce.payoutsPaidCents)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <Euro className="w-3.5 h-3.5" /> All-time GMV
                  </span>
                  <span className="text-foreground">
                    {formatEur(data.live.commerce.gmvCents)} ({data.live.commerce.purchases} sales)
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
                Sign-ups
              </p>
              <MiniBars series={data.series} value="signups" color="rgba(184, 255, 107, 0.85)" />
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
                Tutorials created
              </p>
              <MiniBars series={data.series} value="tutorialsCreated" color="rgba(90, 200, 250, 0.85)" />
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
                Stripe setups
              </p>
              <MiniBars series={data.series} value="stripeStarted" color="rgba(255, 214, 10, 0.85)" />
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
                Purchases
              </p>
              <MiniBars series={data.series} value="purchases" color="rgba(255, 149, 0, 0.85)" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
                Top tutorials by plays
              </p>
              {data.topTutorials.length === 0 ? (
                <p className="text-sm text-foreground-faint">None yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.topTutorials.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/tutorials/${t.id}`}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-sm"
                      >
                        <span className="truncate flex-1 text-foreground">{t.title}</span>
                        {t.isPaid && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green/15 text-green font-semibold">
                            Paid
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-foreground-faint shrink-0">
                          <Play className="w-3 h-3" />
                          {t.playCount}
                        </span>
                        {t.ratingCount > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-foreground-faint shrink-0">
                            <Star className="w-3 h-3 text-yellow-400" />
                            {t.ratingAvg.toFixed(1)}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
                Top sellers
              </p>
              {data.topSellers.length === 0 ? (
                <p className="text-sm text-foreground-faint">No sales yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.topSellers.map((t) => (
                    <li key={t.tutorialId}>
                      <Link
                        href={`/tutorials/${t.tutorialId}`}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-sm"
                      >
                        <span className="truncate flex-1 text-foreground">{t.title}</span>
                        <span className="text-[11px] text-foreground-faint shrink-0">
                          {t.sales} sales
                        </span>
                        <span className="text-[11px] text-foreground font-medium shrink-0">
                          {formatEur(t.gmvCents)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {data.categories.length > 0 && (
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl mb-8">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
                Published by category
              </p>
              <div className="flex flex-wrap gap-2">
                {data.categories.map((c) => (
                  <span
                    key={c.name}
                    className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-foreground-muted"
                  >
                    {c.name} · {c.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-faint mb-3">
              Recent events
            </p>
            {data.recent.length === 0 ? (
              <p className="text-sm text-foreground-faint">
                No tracked events in this range yet. Sign-ups, Stripe, and publishes will appear here
                after the analytics table is applied.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {data.recent.map((e) => (
                  <li key={e.id} className="py-2 flex items-center gap-3 text-xs">
                    <span className="text-foreground-faint w-36 shrink-0">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                    <span className="text-foreground font-medium">
                      {EVENT_LABELS[e.eventName] ?? e.eventName}
                    </span>
                    {e.userId && (
                      <span className="text-foreground-faint truncate">{e.userId.slice(0, 8)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
