'use client';

import type { LetterMark, WordChallengeData, WordFeedback } from '@/lib/games/types';
import { useState, type FormEvent } from 'react';

const letterMarkClasses: Record<LetterMark, string> = {
  red: 'bg-red-500/20 border-red-400/40 text-red-200',
  yellow: 'bg-yellow-400/20 border-yellow-300/40 text-yellow-100',
  green: 'bg-green-500/20 border-green-400/40 text-green-200',
};

const letterKeyboardRows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function nextLetterMark(mark?: LetterMark): LetterMark | null {
  if (!mark) return 'red';
  if (mark === 'red') return 'yellow';
  if (mark === 'yellow') return 'green';
  return null;
}

export function LetterLedger({
  data,
  feedback,
  letterMarks,
  busy,
  error,
  onGuess,
  onGiveUp,
  onLetterMarkChange,
}: {
  data: WordChallengeData;
  feedback: WordFeedback[];
  letterMarks: Record<string, LetterMark>;
  busy: boolean;
  error: string | null;
  onGuess: (guess: string) => Promise<boolean>;
  onGiveUp: () => void;
  onLetterMarkChange: (letterKey: string, mark: LetterMark | null) => void;
}) {
  const [value, setValue] = useState('');
  const triedLetters = new Set(feedback.flatMap((row) => [...row.guess]));
  const triedLetterSummary = [...triedLetters].sort().join(', ') || 'none';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const guess = value.trim().toLowerCase();
    if (!guess) return;
    if (await onGuess(guess)) setValue('');
  };

  return (
    <div className="space-y-6">
      <div className="p-4 sm:p-5 rounded-2xl border border-accent/20 bg-accent/5">
        <p className="text-[10px] uppercase tracking-widest text-accent font-bold mb-2">Today’s hint</p>
        <p className="text-sm sm:text-base text-foreground-secondary">{data.hint}</p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-muted" aria-label="Color count key">
        <span><strong className="text-green-300">Green</strong> · correct spot</span>
        <span><strong className="text-yellow-200">Yellow</strong> · wrong spot</span>
        <span><strong className="text-red-300">Red</strong> · absent</span>
      </div>

      <p className="text-[11px] text-foreground-faint">
        Tap any guessed letter to cycle your notes: red, yellow, green, then clear. The counts are the game’s feedback.
      </p>

      <div className="space-y-2.5" aria-live="polite" aria-label="Previous guesses and their letter counts">
        {feedback.map((row, index) => (
          <div key={`${row.guess}-${index}`} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
            <div className="flex gap-1.5" aria-label={`Guess ${row.guess.toUpperCase()}`}>
              {[...row.guess.toUpperCase()].map((letter, letterIndex) => {
                const key = `${index}:${letterIndex}`;
                const currentMark = letterMarks[key];
                const nextMark = nextLetterMark(currentMark);

                return (
                  <button
                    key={`${letter}-${letterIndex}`}
                    type="button"
                    aria-pressed={Boolean(currentMark)}
                    aria-label={`Letter ${letter}, ${currentMark ?? 'unmarked'}. Click to ${nextMark ? `mark ${nextMark}` : 'clear the mark'}.`}
                    title={`Your note: ${currentMark ?? 'unmarked'}`}
                    disabled={busy}
                    onClick={() => onLetterMarkChange(key, nextMark)}
                    className={`w-9 h-10 sm:w-10 sm:h-11 rounded-lg border flex items-center justify-center font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-default ${currentMark ? letterMarkClasses[currentMark] : 'bg-white/[0.07] border-white/[0.08] text-foreground'}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5 sm:gap-2" aria-label={`${row.green} green, ${row.yellow} yellow, ${row.red} red`}>
              <span title="Correct position" className="min-w-9 h-9 px-2 rounded-lg bg-green-500/20 text-green-300 flex flex-col items-center justify-center leading-none">
                <span className="text-[9px] uppercase font-bold">G</span><span className="text-xs font-bold">{row.green}</span>
              </span>
              <span title="Present, wrong position" className="min-w-9 h-9 px-2 rounded-lg bg-yellow-400/20 text-yellow-200 flex flex-col items-center justify-center leading-none">
                <span className="text-[9px] uppercase font-bold">Y</span><span className="text-xs font-bold">{row.yellow}</span>
              </span>
              <span title="Absent" className="min-w-9 h-9 px-2 rounded-lg bg-red-500/20 text-red-300 flex flex-col items-center justify-center leading-none">
                <span className="text-[9px] uppercase font-bold">R</span><span className="text-xs font-bold">{row.red}</span>
              </span>
            </div>
          </div>
        ))}
        {feedback.length === 0 && (
          <div className="border border-dashed border-white/[0.1] rounded-2xl p-7 text-center text-sm text-foreground-faint">
            Your guesses and their three color counts will appear here.
          </div>
        )}
      </div>

      <div className="space-y-2" role="group" aria-label={`Tried letters: ${triedLetterSummary}`}>
        <p className="text-[11px] text-foreground-muted">Letter tracker <span className="text-foreground-faint">· used letters are highlighted</span></p>
        <div className="space-y-1.5" aria-hidden="true">
          {letterKeyboardRows.map((row) => (
            <div key={row} className="flex justify-center gap-0.5 sm:gap-1.5">
              {[...row].map((letter) => {
                const tried = triedLetters.has(letter.toLowerCase());
                return (
                  <span
                    key={letter}
                    className={`w-5 h-8 sm:w-7 sm:h-9 shrink-0 rounded-md border flex items-center justify-center text-xs sm:text-sm font-semibold transition-colors ${tried ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-white/[0.04] border-white/[0.07] text-foreground-faint'}`}
                  >
                    {letter}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
        <label className="sr-only" htmlFor="letter-ledger-guess">Five-letter guess</label>
        <input
          id="letter-ledger-guess"
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^a-z]/gi, '').slice(0, 5).toLowerCase())}
          maxLength={5}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Enter a five-letter word"
          className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-accent/50"
          disabled={busy || feedback.length >= data.maxGuesses}
        />
        <button
          type="submit"
          disabled={busy || value.length !== 5 || feedback.length >= data.maxGuesses}
          className="px-5 py-3 rounded-xl bg-accent text-black font-semibold disabled:opacity-40 hover:bg-accent-light transition-colors"
        >
          {busy ? 'Checking…' : 'Check word'}
        </button>
      </form>
      <div className="flex items-center justify-between text-xs text-foreground-faint">
        <span>{Math.max(0, data.maxGuesses - feedback.length)} guesses left · every word has unique letters</span>
        <button type="button" onClick={onGiveUp} disabled={busy} className="min-h-11 px-2 underline underline-offset-4 hover:text-foreground disabled:opacity-40">Give up</button>
      </div>
    </div>
  );
}
