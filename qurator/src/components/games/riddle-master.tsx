'use client';

import type { RiddleChallengeData, RiddleFeedback } from '@/lib/games/types';
import { useState, type FormEvent } from 'react';

export function RiddleMaster({
  data,
  feedback,
  busy,
  error,
  onGuess,
  onGiveUp,
}: {
  data: RiddleChallengeData;
  feedback: RiddleFeedback[];
  busy: boolean;
  error: string | null;
  onGuess: (guess: string) => Promise<boolean>;
  onGiveUp: () => void;
}) {
  const [value, setValue] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) return;
    if (await onGuess(value.trim())) setValue('');
  };

  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-8 rounded-2xl border border-yellow-300/15 bg-yellow-300/[0.04]">
        <p className="text-[10px] uppercase tracking-widest text-yellow-200/70 font-bold mb-3">Today’s riddle</p>
        <p className="text-xl sm:text-2xl text-foreground leading-relaxed">{data.prompt}</p>
      </div>

      {feedback.length > 0 && (
        <div className="space-y-2" aria-live="polite" aria-label="Previous answers">
          {feedback.map((row, index) => (
            <div key={`${row.guess}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="truncate text-sm text-foreground-secondary">{row.guess}</span>
              <span className="shrink-0 text-xs font-semibold text-red-300">Not quite</span>
            </div>
          ))}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
        <label className="sr-only" htmlFor="riddle-master-answer">Your answer</label>
        <input
          id="riddle-master-answer"
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, 80))}
          maxLength={80}
          autoComplete="off"
          placeholder="What do you think it is?"
          className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-accent/50"
          disabled={busy || feedback.length >= data.maxGuesses}
        />
        <button type="submit" disabled={busy || !value.trim() || feedback.length >= data.maxGuesses} className="px-5 py-3 rounded-xl bg-accent text-black font-semibold disabled:opacity-40 hover:bg-accent-light transition-colors">
          {busy ? 'Checking…' : 'Submit answer'}
        </button>
      </form>
      <div className="flex items-center justify-between text-xs text-foreground-faint">
        <span>{Math.max(0, data.maxGuesses - feedback.length)} guesses left</span>
        <button type="button" onClick={onGiveUp} disabled={busy} className="min-h-11 px-2 underline underline-offset-4 hover:text-foreground disabled:opacity-40">Give up</button>
      </div>
    </div>
  );
}
