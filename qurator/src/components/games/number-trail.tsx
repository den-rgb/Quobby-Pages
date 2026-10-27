'use client';

import type { NumberChallengeData, NumberFeedback } from '@/lib/games/types';
import { useState, type FormEvent } from 'react';

export function NumberTrail({
  data,
  feedback,
  busy,
  error,
  onGuess,
  onGiveUp,
}: {
  data: NumberChallengeData;
  feedback: NumberFeedback[];
  busy: boolean;
  error: string | null;
  onGuess: (expression: string) => Promise<boolean>;
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
      <section className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5 p-5 sm:p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07]">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-foreground-faint font-bold mb-3">Available numbers</p>
          <div className="flex flex-wrap gap-2">
            {data.values.map((number, index) => (
              <span key={`${number}-${index}`} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-sky-400/10 border border-sky-300/20 flex items-center justify-center text-lg font-bold text-sky-200">
                {number}
              </span>
            ))}
          </div>
        </div>
        <span className="text-foreground-faint text-lg">→</span>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-foreground-faint font-bold mb-2">Target</p>
          <p className="text-4xl sm:text-5xl font-extrabold text-foreground">{data.target}</p>
        </div>
      </section>

      <p className="text-sm text-foreground-muted leading-relaxed">
        Use each displayed number at most once. Multiplication accepts <code className="text-foreground">x</code>, <code className="text-foreground">×</code>, or <code className="text-foreground">*</code>; division accepts <code className="text-foreground">÷</code> or <code className="text-foreground">/</code>. Parentheses are allowed. You can keep trying or give up to see one solution.
      </p>

      {feedback.length > 0 && (
        <div className="space-y-2" aria-live="polite" aria-label="Previous expressions">
          {feedback.map((row, index) => (
            <div key={`${row.expression}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <code className="min-w-0 truncate text-sm text-foreground-secondary">{row.expression}</code>
              <span className={`shrink-0 text-xs font-semibold ${row.correct ? 'text-green-300' : 'text-foreground-muted'}`}>
                {row.correct ? 'Target reached' : `= ${row.value}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
        <label className="sr-only" htmlFor="number-trail-expression">Arithmetic expression</label>
        <input
          id="number-trail-expression"
          value={value}
          onChange={(event) => setValue(event.target.value.slice(0, 160))}
          maxLength={160}
          autoComplete="off"
          spellCheck={false}
          placeholder="Example: (8 + 4) x 2"
          className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-accent/50"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !value.trim()} className="px-5 py-3 rounded-xl bg-accent text-black font-semibold disabled:opacity-40 hover:bg-accent-light transition-colors">
          {busy ? 'Checking…' : 'Try expression'}
        </button>
      </form>
      <div className="flex items-center justify-between text-xs text-foreground-faint">
        <span>{feedback.length} {feedback.length === 1 ? 'attempt' : 'attempts'} · no timer</span>
        <button type="button" onClick={onGiveUp} disabled={busy} className="min-h-11 px-2 underline underline-offset-4 hover:text-foreground disabled:opacity-40">Give up</button>
      </div>
    </div>
  );
}
