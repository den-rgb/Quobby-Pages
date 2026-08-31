'use client';

import { useEditorStore } from '@/lib/store';
import {
  estimatedCreatorPayoutCents,
  formatEur,
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
  PLATFORM_FEE_RATE,
  TERMS_SELLER_URL,
} from '@/lib/tutorial-pricing';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function PaidPanel() {
  const tutorial = useEditorStore((s) => s.tutorial);
  const setTutorial = useEditorStore((s) => s.setTutorial);
  const [connect, setConnect] = useState<{ onboarded: boolean; payoutsEnabled: boolean } | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [priceInput, setPriceInput] = useState(
    tutorial?.price_cents ? (tutorial.price_cents / 100).toFixed(2) : '4.99',
  );
  const [termsAccepted, setTermsAccepted] = useState(!!tutorial?.seller_terms_accepted_at);

  useEffect(() => {
    fetch('/api/connect/status')
      .then((r) => r.json())
      .then((d) => setConnect({ onboarded: !!d.onboarded, payoutsEnabled: !!d.payoutsEnabled }))
      .catch(() => setConnect({ onboarded: false, payoutsEnabled: false }));
  }, []);

  const applyPrice = useCallback(
    (raw: string) => {
      if (!tutorial) return;
      const euros = Number(raw.replace(',', '.'));
      if (!Number.isFinite(euros)) return;
      const cents = Math.round(euros * 100);
      const clamped = Math.min(MAX_PRICE_CENTS, Math.max(MIN_PRICE_CENTS, cents));
      setTutorial({ ...tutorial, price_cents: clamped, currency: 'eur' });
      useEditorStore.setState({ isDirty: true });
      setPriceInput((clamped / 100).toFixed(2));
    },
    [tutorial, setTutorial],
  );

  if (!tutorial) return null;

  const paid = !!tutorial.is_paid;
  const cents = tutorial.price_cents ?? 499;
  const creatorEst = estimatedCreatorPayoutCents(cents);
  const platformEst = Math.round(cents * PLATFORM_FEE_RATE);

  return (
    <div className="p-4 space-y-4 text-sm overflow-y-auto">
      <div>
        <h3 className="font-semibold text-foreground mb-1">Sell this tutorial</h3>
        <p className="text-xs text-foreground-muted">
          Charge a one-time EUR price. Buyers get a personal licence. Welcome grants on listings of €5 or less pay you €0.
        </p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={paid}
          onChange={(e) => {
            setTutorial({
              ...tutorial,
              is_paid: e.target.checked,
              price_cents: e.target.checked ? (tutorial.price_cents ?? 499) : null,
              currency: e.target.checked ? 'eur' : tutorial.currency,
            });
            useEditorStore.setState({ isDirty: true });
          }}
        />
        <span className="text-foreground">Paid tutorial</span>
      </label>

      {paid && (
        <>
          <div>
            <label className="block text-xs text-foreground-muted mb-1">Price (EUR)</label>
            <input
              type="number"
              min={MIN_PRICE_CENTS / 100}
              max={MAX_PRICE_CENTS / 100}
              step="0.50"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              onBlur={() => applyPrice(priceInput)}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground"
            />
            <p className="text-[10px] text-foreground-faint mt-1">€2.00 – €49.99</p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-border text-xs space-y-1">
            <p className="text-foreground-muted">On a full-price sale (before buyer discounts):</p>
            <p>You receive about <span className="text-accent font-semibold">{formatEur(creatorEst)}</span> after 10% + card fees</p>
            <p>Site keeps <span className="font-semibold">{formatEur(platformEst)}</span> (10%)</p>
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={termsAccepted}
              onChange={(e) => {
                const on = e.target.checked;
                setTermsAccepted(on);
                setTutorial({
                  ...tutorial,
                  seller_terms_accepted_at: on ? new Date().toISOString() : null,
                });
                useEditorStore.setState({ isDirty: true });
              }}
            />
            <span className="text-foreground-secondary">
              I accept the{' '}
              <a href={TERMS_SELLER_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                Seller rules
              </a>
              , including the 10% platform fee and that welcome grants (€5 or less) pay €0.
            </span>
          </label>

          <div className="p-3 rounded-xl border border-border">
            <p className="text-xs font-medium text-foreground mb-2">Payouts</p>
            {connect?.payoutsEnabled ? (
              <p className="text-xs text-green-400">Stripe Connect is ready. You can publish as paid.</p>
            ) : (
              <>
                <p className="text-xs text-foreground-muted mb-2">
                  Set up payouts with Stripe before publishing a paid tutorial. You can still save a paid draft.
                </p>
                <button
                  disabled={connectLoading}
                  onClick={async () => {
                    setConnectLoading(true);
                    try {
                      const res = await fetch('/api/connect/onboard', { method: 'POST' });
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    } finally {
                      setConnectLoading(false);
                    }
                  }}
                  className="px-3 py-1.5 bg-accent text-black text-xs font-semibold rounded-lg"
                >
                  {connectLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set up payouts'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export async function canPublishPaid(tutorial: {
  is_paid?: boolean;
  price_cents?: number | null;
  seller_terms_accepted_at?: string | null;
}): Promise<string | null> {
  if (!tutorial.is_paid) return null;
  if (!tutorial.seller_terms_accepted_at) return 'Accept the Seller rules to publish a paid tutorial.';
  const price = tutorial.price_cents ?? 0;
  if (price < MIN_PRICE_CENTS || price > MAX_PRICE_CENTS) return 'Set a price between €2.00 and €49.99.';
  try {
    const res = await fetch('/api/connect/status');
    const data = await res.json();
    if (!data.payoutsEnabled) return 'Set up Stripe payouts before publishing a paid tutorial.';
  } catch {
    return 'Could not verify payout status.';
  }
  return null;
}
