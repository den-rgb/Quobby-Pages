'use client';

import { useAuth } from '@/lib/auth';
import {
  formatEur,
  isPaidPremium,
  loyaltyRate,
  MIN_WITHDRAW_CENTS,
} from '@/lib/tutorial-pricing';
import { BookOpen, Loader2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface EarningsData {
  lifetimeCents: number;
  availableCents: number;
  minWithdrawCents: number;
  payoutsEnabled: boolean;
  sales: {
    id: string;
    amount_paid_cents: number;
    creator_earn_cents: number;
    source: string;
    created_at: string;
    refunded_at: string | null;
    tutorials?: { title: string } | { title: string }[] | null;
  }[];
  payouts: { id: string; amount_cents: number; status: string; created_at: string }[];
  library: {
    tutorial_id: string;
    created_at: string;
    source: string;
    tutorials?: { title: string; is_paid?: boolean; price_cents?: number } | { title: string }[] | null;
  }[];
  welcomeUsed: boolean;
  profile: {
    created_at: string;
    subscription_tier?: string;
    has_lifetime_premium?: boolean;
    stripe_subscription_status?: string;
    referral_credit_cents?: number;
  } | null;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    /* fall through */
  }
  window.prompt('Copy this referral link:', text);
  return false;
}

function titleOf(row: { tutorials?: { title: string } | { title: string }[] | null }): string {
  const t = row.tutorials;
  if (!t) return 'Tutorial';
  if (Array.isArray(t)) return t[0]?.title ?? 'Tutorial';
  return t.title ?? 'Tutorial';
}

export function EarningsPanel() {
  const { user } = useAuth();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    fetch('/api/earnings')
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<EarningsData>;
      })
      .then((body) => {
        if (!body || typeof body.lifetimeCents !== 'number') {
          setData(null);
          return;
        }
        setData({
          ...body,
          sales: body.sales ?? [],
          payouts: body.payouts ?? [],
          library: body.library ?? [],
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;
  if (loading) {
    return (
      <div className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-faint" />
      </div>
    );
  }
  if (!data) return null;

  const paidPrem = isPaidPremium({
    hasLifetimePremium: data.profile?.has_lifetime_premium,
    subscriptionTier: data.profile?.subscription_tier,
    stripeSubscriptionStatus: data.profile?.stripe_subscription_status,
  });
  const loyalty = loyaltyRate(data.profile?.created_at, paidPrem);
  const loyaltyPct = Math.round(loyalty * 1000) / 10;
  const canWithdraw = data.availableCents >= MIN_WITHDRAW_CENTS && data.payoutsEnabled;
  const ageDays = data.profile?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(data.profile.created_at).getTime()) / 86400000))
    : 0;
  const welcomeLeft = !data.welcomeUsed && ageDays <= 30;

  return (
    <div className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-3.5 h-3.5 text-accent" />
        <h2 className="text-xs font-semibold text-foreground-faint uppercase tracking-wider">
          Earnings &amp; library
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-white/[0.03]">
          <p className="text-[10px] text-foreground-faint uppercase">Available</p>
          <p className="text-lg font-semibold text-foreground">{formatEur(data.availableCents)}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.03]">
          <p className="text-[10px] text-foreground-faint uppercase">Lifetime</p>
          <p className="text-lg font-semibold text-foreground">{formatEur(data.lifetimeCents)}</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-foreground-muted mb-1">
          Premium loyalty {paidPrem ? `${loyaltyPct}%` : '0% (paid Premium required)'} — 35% at 2 years
        </p>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${(loyalty / 0.35) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-foreground-faint mt-1">
          {welcomeLeft ? 'Welcome grant unused — first tutorial €5 or less is free.' : data.welcomeUsed ? 'Welcome grant used.' : 'Welcome grant expired.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!data.payoutsEnabled && (
          <button
            onClick={async () => {
              const res = await fetch('/api/connect/onboard', { method: 'POST' });
              const body = await res.json();
              if (body.url) window.location.href = body.url;
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-accent text-black rounded-lg"
          >
            Set up payouts
          </button>
        )}
        <button
          disabled={!canWithdraw || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch('/api/connect/payout', { method: 'POST' });
              if (res.ok) load();
            } finally {
              setBusy(false);
            }
          }}
          className="px-3 py-1.5 text-xs font-semibold border border-border rounded-lg text-foreground disabled:opacity-40"
        >
          {busy ? 'Working…' : `Withdraw (min ${formatEur(MIN_WITHDRAW_CENTS)})`}
        </button>
        <button
          type="button"
          onClick={async () => {
            const link = `${window.location.origin}/tutorials?ref=${user.id}`;
            const ok = await copyText(link);
            if (!ok) return;
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="px-3 py-1.5 text-xs border border-border rounded-lg text-foreground-muted"
        >
          {copied ? 'Copied' : 'Copy referral link'}
        </button>
      </div>
      {(data.profile?.referral_credit_cents ?? 0) > 0 && (
        <p className="text-xs text-accent">Referral credit: {formatEur(data.profile!.referral_credit_cents!)} off your next paid tutorial</p>
      )}

      {(data.library ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-foreground-faint uppercase tracking-wider mb-2">Purchased</p>
          <ul className="space-y-1">
            {(data.library ?? []).slice(0, 8).map((row) => (
              <li key={row.tutorial_id}>
                <Link href={`/tutorials/${row.tutorial_id}`} className="text-xs text-accent hover:underline flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> {titleOf(row)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(data.sales ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-foreground-faint uppercase tracking-wider mb-2">Recent sales</p>
          <ul className="space-y-1 text-xs text-foreground-muted">
            {(data.sales ?? []).slice(0, 8).map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span className="truncate">{titleOf(s)} {s.source === 'welcome' ? '(welcome)' : ''}{s.refunded_at ? ' (refunded)' : ''}</span>
                <span>{formatEur(s.creator_earn_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
