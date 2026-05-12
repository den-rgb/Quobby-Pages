'use client';

import { CheckCircle2, Crown } from 'lucide-react';
import Link from 'next/link';

export default function PremiumSuccessPage() {
  return (
    <div className="px-6 py-24 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center mx-auto mb-6">
          <Crown className="w-8 h-8 text-yellow-400" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <CheckCircle2 className="w-5 h-5 text-green" />
          <h1 className="text-2xl font-bold text-foreground">
            Welcome to Premium!
          </h1>
        </div>
        <p className="text-foreground-muted mb-8">
          Your subscription is now active. All premium features are unlocked —
          larger video uploads, video splitting, and tutorial analytics.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/profile"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-black font-semibold rounded-[14px] transition-all hover:bg-accent-light hover:-translate-y-0.5"
          >
            Go to Profile
          </Link>
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 text-foreground font-medium rounded-[14px] transition-all hover:bg-white/5"
          >
            Create a Tutorial
          </Link>
        </div>
      </div>
    </div>
  );
}
