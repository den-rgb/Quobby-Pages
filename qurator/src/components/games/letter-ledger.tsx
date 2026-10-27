'use client';

import type { LetterMark, WordChallengeData, WordFeedback } from '@/lib/games/types';
import { triedLettersFromGuesses } from '@/lib/games/letter-keyboard';
import { useEffect, useRef, useState, type FormEvent } from 'react';

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
  completed,
  onGuess,
  onGiveUp,
  onLetterMarkChange,
  onClearLetterMarks,
}: {
  data: WordChallengeData;
  feedback: WordFeedback[];
  letterMarks: Record<string, LetterMark>;
  busy: boolean;
  error: string | null;
  completed: boolean;
  onGuess: (guess: string) => Promise<boolean>;
  onGiveUp: () => void;
  onLetterMarkChange: (letterKey: string, mark: LetterMark | null) => void;
  onClearLetterMarks: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const focusAfterSubmit = useRef(false);
  const triedLetters = triedLettersFromGuesses(feedback.map((row) => row.guess));
  const triedLetterSummary = [...triedLetters].sort().join(', ') || 'none';
  const inputDisabled = busy || completed || feedback.length >= data.maxGuesses;

  useEffect(() => {
    if (busy || !focusAfterSubmit.current) return;
    focusAfterSubmit.current = false;
    if (!completed && !error && feedback.length < data.maxGuesses) inputRef.current?.focus();
  }, [busy, completed, data.maxGuesses, error, feedback.length]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const guess = value.trim().toLowerCase();
    if (!guess || inputDisabled) return;
    focusAfterSubmit.current = true;
    if (await onGuess(guess)) {
      setValue('');
    } else {
      focusAfterSubmit.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground-muted" aria-label="Color count key">
        <span><strong className="text-green-300">Green</strong> · right spot</span>
        <span><strong className="text-yellow-200">Yellow</strong> · misplaced</span>
        <span><strong className="text-red-300">Red</strong> · absent</span>
      </div>

      <div className="space-y-2.5" aria-live="polite" aria-label="Previous guesses and their letter counts">
        {feedback.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClearLetterMarks}
              disabled={busy || Object.keys(letterMarks).length === 0}
              className="min-h-11 px-3 rounded-lg text-sm font-semibold text-foreground-muted hover:text-foreground disabled:opacity-40"
            >
              Clear all
            </button>
          </div>
        )}
        {feedback.map((row, index) => (
          <div key={`${row.guess}-${index}`} className="flex min-w-0 items-center justify-between gap-0.5 p-1 sm:gap-3 sm:p-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
            <div className="flex min-w-0 shrink items-center gap-0.5 sm:gap-1.5" aria-label={`Guess ${row.guess.toUpperCase()}`}>
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
                    className={`w-8 h-11 sm:w-10 sm:h-11 shrink-0 rounded-lg border flex items-center justify-center font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-default ${currentMark ? letterMarkClasses[currentMark] : 'bg-white/[0.07] border-white/[0.08] text-foreground'}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
            <div className="flex shrink-0 gap-px sm:gap-2" aria-label={`${row.green} green, ${row.yellow} yellow, ${row.red} red`}>
              <span title="Correct position" className="w-[18px] h-8 sm:w-9 sm:h-9 sm:px-2 rounded-md sm:rounded-lg bg-green-500/20 text-green-300 flex flex-col items-center justify-center leading-none">
                <span className="text-[9px] uppercase font-bold">G</span><span className="text-xs font-bold">{row.green}</span>
              </span>
              <span title="Present, wrong position" className="w-[18px] h-8 sm:w-9 sm:h-9 sm:px-2 rounded-md sm:rounded-lg bg-yellow-400/20 text-yellow-200 flex flex-col items-center justify-center leading-none">
                <span className="text-[9px] uppercase font-bold">Y</span><span className="text-xs font-bold">{row.yellow}</span>
              </span>
              <span title="Absent" className="w-[18px] h-8 sm:w-9 sm:h-9 sm:px-2 rounded-md sm:rounded-lg bg-red-500/20 text-red-300 flex flex-col items-center justify-center leading-none">
                <span className="text-[9px] uppercase font-bold">R</span><span className="text-xs font-bold">{row.red}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] text-foreground-muted">Keyboard</p>
        <div className="space-y-1.5" role="group" aria-label={`Tried letters: ${triedLetterSummary}`}>
          {letterKeyboardRows.map((row) => (
            <div key={row} className="flex justify-center gap-0.5 sm:gap-1.5">
              {[...row].map((letter) => {
                const tried = triedLetters.has(letter.toUpperCase());
                return (
                  <button
                    key={letter}
                    type="button"
                    aria-label={`Add ${letter} to guess${tried ? ', already used' : ''}`}
                    disabled={inputDisabled || value.length >= 5}
                    onClick={() => setValue((current) => current.length < 5 ? `${current}${letter.toLowerCase()}` : current)}
                    className={`w-[6.5vw] min-w-[22px] max-w-[32px] h-10 shrink-0 rounded-md border flex items-center justify-center text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:cursor-default ${tried ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-white/[0.04] border-white/[0.07] text-foreground-faint'}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <form onSubmit={submit} className="space-y-3">
        <label className="sr-only" htmlFor="letter-ledger-guess">Five-letter guess</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={inputRef}
            id="letter-ledger-guess"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/[^a-z]/gi, '').slice(0, 5).toLowerCase())}
            maxLength={5}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Enter a five-letter word"
            className="min-w-0 flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-foreground placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50"
            disabled={inputDisabled}
          />
          <button
            type="submit"
            disabled={inputDisabled || value.length !== 5}
            className="px-5 py-3 rounded-xl bg-accent text-black font-semibold disabled:opacity-40 hover:bg-accent-light transition-colors"
          >
            {busy ? 'Checking…' : 'Check word'}
          </button>
        </div>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            aria-label="Delete last letter"
            onClick={() => setValue((current) => current.slice(0, -1))}
            disabled={inputDisabled || value.length === 0}
            className="min-h-10 px-4 rounded-lg border border-white/[0.1] bg-white/[0.04] text-sm font-semibold text-foreground-muted hover:bg-white/[0.08] disabled:opacity-40"
          >
            Backspace
          </button>
          <button
            type="submit"
            disabled={inputDisabled || value.length !== 5}
            className="min-h-10 px-6 rounded-lg border border-accent/30 bg-accent/10 text-sm font-bold text-accent hover:bg-accent/20 disabled:opacity-40"
          >
            Enter
          </button>
        </div>
      </form>
      <div className="flex items-center justify-between text-xs text-foreground-faint">
        <span>{Math.max(0, data.maxGuesses - feedback.length)} guesses left</span>
        <button type="button" onClick={onGiveUp} disabled={inputDisabled} className="min-h-11 px-2 underline underline-offset-4 hover:text-foreground disabled:opacity-40">Give up</button>
      </div>
    </div>
  );
}
