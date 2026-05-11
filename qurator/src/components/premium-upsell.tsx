'use client';

import { PREMIUM_FEATURES } from '@/lib/premium';
import { CheckCircle2, Crown, X } from 'lucide-react';

interface Props {
  onClose: () => void;
  feature?: string;
}

export function PremiumUpsell({ onClose, feature }: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#16162a] border border-yellow-500/20 rounded-2xl max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-400" />
            Premium Feature
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-foreground-faint hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {feature && (
            <p className="text-xs text-foreground-muted leading-relaxed">
              <span className="font-semibold text-yellow-400">{feature}</span>{' '}
              is available with Quobby Premium.
            </p>
          )}

          <div className="space-y-2.5">
            {PREMIUM_FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-2.5 px-3 py-2 bg-yellow-500/[0.04] border border-yellow-500/10 rounded-xl"
              >
                <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
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

          <p className="text-[10px] text-foreground-faint text-center leading-relaxed">
            Subscribe to Premium in the Quobby app on iOS or Android.
          </p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-xs text-foreground-muted hover:text-foreground border border-white/10 rounded-xl transition-colors"
            >
              Maybe Later
            </button>
            <a
              href="https://apps.apple.com/app/quobby/id6738030858"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2.5 text-xs font-semibold text-center text-black bg-yellow-400 rounded-xl hover:bg-yellow-300 transition-colors"
            >
              Get Premium
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
