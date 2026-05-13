'use client';

import { useAuth } from '@/lib/auth';
import { PREMIUM_FEATURES } from '@/lib/premium';
import {
  CheckCircle2,
  Crown,
  Loader2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface Props {
  onClose: () => void;
  feature?: string;
}

export function PremiumUpsell({ onClose, feature }: Props) {
  const { user, signIn } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (priceId: string) => {
    if (!user) return;
    setLoading(priceId);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setLoading(null);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
      setLoading(null);
    }
  };

  const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY;
  const yearlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY;

  const grouped = useMemo(() => {
    const map = new Map<string, typeof PREMIUM_FEATURES[number][]>();
    for (const f of PREMIUM_FEATURES) {
      const list = map.get(f.category) ?? [];
      list.push(f);
      map.set(f.category, list);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#16162a] border border-yellow-500/20 rounded-2xl max-w-sm w-full shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-400" />
            Quobby Premium
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-foreground-faint hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {feature && (
            <p className="text-xs text-foreground-muted leading-relaxed">
              <span className="font-semibold text-yellow-400">{feature}</span>{' '}
              is available with Quobby Premium.
            </p>
          )}

          <div className="px-3 py-2 bg-green/10 border border-green/20 rounded-xl text-center">
            <p className="text-xs font-semibold text-green">
              7-day free trial for new subscribers
            </p>
            <p className="text-[10px] text-foreground-faint">
              Cancel anytime — you won&apos;t be charged until the trial ends.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-2">
            {user ? (
              <>
                {monthlyPriceId && (
                  <button
                    onClick={() => handleCheckout(monthlyPriceId)}
                    disabled={!!loading}
                    className="w-full px-4 py-2.5 text-xs font-semibold text-black bg-yellow-400 rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading === monthlyPriceId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Crown className="w-3.5 h-3.5" />
                    )}
                    Start Free Trial — Monthly
                  </button>
                )}
                {yearlyPriceId && (
                  <button
                    onClick={() => handleCheckout(yearlyPriceId)}
                    disabled={!!loading}
                    className="w-full px-4 py-2.5 text-xs font-semibold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-xl hover:bg-yellow-400/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading === yearlyPriceId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Crown className="w-3.5 h-3.5" />
                    )}
                    Start Free Trial — Yearly
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => signIn('google')}
                className="w-full px-4 py-2.5 text-xs font-semibold text-black bg-yellow-400 rounded-xl hover:bg-yellow-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5" />
                Sign In to Subscribe
              </button>
            )}
          </div>

          {grouped.map(([category, features]) => (
            <div key={category}>
              <p className="text-[10px] font-semibold text-foreground-faint uppercase tracking-wider mb-2 px-1">
                {category}
              </p>
              <div className="space-y-1.5">
                {features.map((f) => (
                  <div
                    key={f.title}
                    className="flex items-start gap-2.5 px-3 py-2 bg-yellow-500/[0.04] border border-yellow-500/10 rounded-xl"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {f.title}
                      </p>
                      <p className="text-[10px] text-foreground-faint leading-relaxed">
                        {f.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-xs text-foreground-faint hover:text-foreground transition-colors cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
