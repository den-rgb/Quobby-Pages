'use client';

import type { GameKey, RoundResult } from '@/lib/games/types';
import { useAuth } from '@/lib/auth';
import { Check, Flame, Gamepad2, Share2, Trophy, Zap } from 'lucide-react';
import { useState } from 'react';

const GAME_TITLES: Record<GameKey, string> = {
  'letter-ledger': 'Letter Ledger',
  'number-trail': 'Number Trail',
  'riddle-master': 'Riddle Master',
};

export function GameResult({
  result,
  onRetry,
  retrying,
}: {
  result: RoundResult;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { user, signIn } = useAuth();
  const [shareLabel, setShareLabel] = useState('Share result');
  const solved = result.outcome === 'won';

  const shareResult = async () => {
    const outcome = solved ? 'solved' : 'finished';
    const attemptText = result.attempts === 0
      ? 'without a guess'
      : `in ${result.attempts} ${result.attempts === 1 ? 'guess' : 'guesses'}`;
    const text = `Qurator ${GAME_TITLES[result.game]} · ${result.date} · ${outcome} ${attemptText}.`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        setShareLabel('Shared');
      } else {
        await navigator.clipboard.writeText(text);
        setShareLabel('Copied');
      }
    } catch {
      setShareLabel('Could not share');
    }
    window.setTimeout(() => setShareLabel('Share result'), 1800);
  };

  return (
    <section className="space-y-5" aria-live="polite">
      <div className={`p-5 sm:p-7 rounded-2xl border ${solved ? 'border-green-400/20 bg-green-400/[0.05]' : 'border-orange-300/20 bg-orange-300/[0.04]'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${solved ? 'bg-green-400/15' : 'bg-orange-300/15'}`}>
            {solved ? <Trophy className="w-5 h-5 text-green-300" /> : <Flame className="w-5 h-5 text-orange-200" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-foreground-faint font-bold mb-1">
              {solved ? 'Well solved' : 'Round complete'}
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              {solved ? 'You found it.' : 'Here’s the answer.'}
            </h2>
            <p className="text-sm text-foreground-muted mt-1">
              {result.attempts === 0 ? 'You finished without a guess.' : `${result.attempts} ${result.attempts === 1 ? 'guess' : 'guesses'} used.`}
            </p>
          </div>
        </div>

        <div className="mt-5 p-4 rounded-xl bg-black/[0.12] border border-white/[0.06]">
          <p className="text-[10px] uppercase tracking-widest text-foreground-faint font-bold mb-1">
            {result.game === 'number-trail' ? 'Target' : 'Answer'}
          </p>
          <p className="text-lg font-bold text-foreground break-words">
            {result.game === 'letter-ledger' ? result.answer.toUpperCase() : result.answer}
          </p>
          {result.game === 'number-trail' && result.solution && (
            <p className="mt-1 text-sm text-foreground-muted">One solution: <code className="text-foreground-secondary">{result.solution}</code></p>
          )}
        </div>

        <button type="button" onClick={shareResult} className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.06] text-sm font-medium text-foreground-secondary hover:bg-white/10 transition-colors">
          {shareLabel === 'Copied' || shareLabel === 'Shared' ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          {shareLabel}
        </button>
      </div>

      {user && result.stats ? (
        <div className="p-5 rounded-2xl border border-white/[0.07] bg-white/[0.025]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Your Qurator Games stats</h3>
              <p className="text-xs text-foreground-faint mt-1">
                {result.rewarded
                  ? result.alreadyRewarded ? 'This daily reward was already claimed.' : '+25 XP added to your Quobby profile.'
                  : 'Your result is linked to your profile.'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-green-300"><Zap className="w-4 h-4" /> Level {result.stats.level}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Stat value={result.stats.currentStreak} label="Games streak" icon={<Flame className="w-3.5 h-3.5" />} />
            <Stat value={result.stats.bestStreak} label="Best streak" icon={<Trophy className="w-3.5 h-3.5" />} />
            <Stat value={result.stats.totalCompleted.toLocaleString()} label="Games completed" icon={<Gamepad2 className="w-3.5 h-3.5" />} />
            <Stat value={result.stats.totalXp.toLocaleString()} label="Shared XP" icon={<Zap className="w-3.5 h-3.5" />} />
          </div>
          {result.rewardPending && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-orange-400/[0.07] border border-orange-300/15">
              <p className="text-xs text-foreground-muted">Your result is saved on this device. XP is waiting to sync.</p>
              <button type="button" onClick={onRetry} disabled={retrying} className="px-3 py-2 rounded-lg bg-accent text-black text-xs font-semibold disabled:opacity-40">
                {retrying ? 'Retrying…' : 'Retry XP claim'}
              </button>
            </div>
          )}
        </div>
      ) : user ? (
        <div className="p-5 rounded-2xl border border-orange-300/20 bg-orange-300/[0.04]">
          <h3 className="font-semibold text-foreground">Your result is saved</h3>
          <p className="text-sm text-foreground-muted mt-1 mb-4">Your profile session could not be confirmed for the XP claim. Retry to sync this round.</p>
          <button type="button" onClick={onRetry} disabled={retrying} className="px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold disabled:opacity-40">
            {retrying ? 'Retrying…' : 'Retry XP claim'}
          </button>
        </div>
      ) : (
        <div className="p-5 rounded-2xl border border-accent/20 bg-accent/[0.045]">
          <h3 className="font-semibold text-foreground">Save your result and earn 25 XP</h3>
          <p className="text-sm text-foreground-muted mt-1 mb-4">
            Sign in or create a profile to claim this round, add XP to your shared Quobby profile, and start your Games streak. Your result stays on this device while you continue as a guest.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void signIn('google')} className="px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold hover:bg-accent-light transition-colors">
              Create profile / Sign in
            </button>
            <button type="button" onClick={() => void signIn('apple')} className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm font-semibold text-foreground hover:bg-white/10 transition-colors">
              Continue with Apple
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ value, label, icon }: { value: string | number; label: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.035] text-center">
      <div className="flex justify-center text-foreground-faint mb-1">{icon}</div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] leading-tight text-foreground-faint">{label}</p>
    </div>
  );
}
