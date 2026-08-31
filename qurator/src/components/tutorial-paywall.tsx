'use client';

import { useAuth } from '@/lib/auth';
import { formatEur, TERMS_BUYER_URL, type TutorialQuote } from '@/lib/tutorial-pricing';
import { Loader2, Lock, Tag } from 'lucide-react';
import { useState } from 'react';

export function TutorialPaywall({
  title,
  description,
  listPriceCents,
  quote,
  onUnlocked,
}: {
  title: string;
  description: string;
  listPriceCents: number;
  quote: TutorialQuote | null;
  onUnlocked: () => void;
}) {
  const { user, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const tutorialId = typeof window !== 'undefined'
    ? window.location.pathname.split('/').pop()
    : '';

  async function buy() {
    if (!user) {
      signIn();
      return;
    }
    if (!agreed) {
      setError('Please accept the Buyer rules to continue.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (quote?.kind === 'welcome') {
        const res = await fetch(`/api/tutorials/${tutorialId}/claim-welcome`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Claim failed');
        onUnlocked();
        return;
      }
      const res = await fetch(`/api/tutorials/${tutorialId}/checkout`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const yourPrice = quote?.kind === 'welcome' ? 0 : quote?.chargedCents ?? listPriceCents;
  const showLoyalty = quote && quote.loyaltyRate > 0 && quote.kind === 'paid';

  return (
    <div className="max-w-lg mx-auto px-6 py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-400/15 text-amber-300 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-7 h-7" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-300 mb-2 flex items-center justify-center gap-1">
        <Tag className="w-3.5 h-3.5" /> Paid tutorial
      </p>
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      {description && (
        <p className="text-sm text-foreground-muted mb-6 line-clamp-4">{description}</p>
      )}

      <p className="text-foreground mb-1">
        {quote?.kind === 'welcome' ? (
          <span className="text-xl font-semibold text-accent">Free with your welcome grant</span>
        ) : (
          <>
            {showLoyalty && (
              <span className="line-through text-foreground-faint mr-2">{formatEur(listPriceCents)}</span>
            )}
            <span className="text-xl font-semibold">{formatEur(yourPrice)}</span>
          </>
        )}
      </p>
      {showLoyalty && (
        <p className="text-xs text-accent mb-4">
          Premium loyalty {(quote.loyaltyRate * 100).toFixed(1)}% off
        </p>
      )}
      {!user && (
        <p className="text-xs text-foreground-muted mb-4">
          Sign in — your first paid tutorial is free if it is €5 or less.
        </p>
      )}

      <label className="flex items-start gap-2 text-left text-xs text-foreground-secondary max-w-md mx-auto mb-4">
        <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I agree to the{' '}
          <a href={TERMS_BUYER_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline">
            Buyer rules
          </a>
          . Digital access is granted immediately and I waive my 14-day withdrawal right.
        </span>
      </label>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <button
        disabled={busy}
        onClick={buy}
        className="px-6 py-3 bg-accent text-black font-semibold rounded-xl hover:bg-accent-light disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin inline" />
        ) : !user ? (
          'Sign in to continue'
        ) : quote?.kind === 'welcome' ? (
          'Claim free tutorial'
        ) : (
          `Pay ${formatEur(yourPrice)}`
        )}
      </button>
    </div>
  );
}
