import type { LetterMark, WordFeedback } from './types';

export function resolveLetterLedgerMarks(feedback: WordFeedback): LetterMark[] {
  if (feedback.marks.length > 0) return feedback.marks;
  if (feedback.green === 0 && feedback.yellow === 0 && feedback.red === feedback.guess.length) {
    return Array.from({ length: feedback.guess.length }, () => 'red');
  }
  return [];
}

export function isAllRedLetterLedgerWord(row: readonly LetterMark[]): boolean {
  return row.length === 5 && row.every((mark) => mark === 'red');
}

export function letterLedgerKnownAbsentLetters(
  guesses: readonly string[],
  rows: readonly (readonly LetterMark[])[],
  beforeRowIndex: number,
): Set<string> {
  const letters = new Set<string>();
  rows.forEach((row, rowIndex) => {
    if (rowIndex > beforeRowIndex && isAllRedLetterLedgerWord(row) && guesses[rowIndex]) {
      for (const letter of guesses[rowIndex].toUpperCase()) letters.add(letter);
    }
  });
  return letters;
}

export function automaticLetterLedgerRedMark(
  rows: readonly (readonly LetterMark[])[],
  rowIndex: number,
  letter: string,
  knownAbsentLetters: ReadonlySet<string> = new Set(),
): boolean {
  return isAllRedLetterLedgerWord(rows[rowIndex] ?? []) || knownAbsentLetters.has(letter.toUpperCase());
}

export function letterLedgerManualMarkingKeys(
  guesses: readonly string[],
  selectedRowIndex: number,
  selectedLetterIndex: number,
): string[] {
  const selectedLetter = guesses[selectedRowIndex]?.toUpperCase()[selectedLetterIndex];
  if (!selectedLetter) return [];

  const keys: string[] = [];
  guesses.slice(0, selectedRowIndex).forEach((guess, rowIndex) => {
    [...guess.toUpperCase()].forEach((letter, letterIndex) => {
      if (letter === selectedLetter) keys.push(`${rowIndex}:${letterIndex}`);
    });
  });
  keys.push(`${selectedRowIndex}:${selectedLetterIndex}`);
  return keys;
}

export function normalizeLetterLedgerGuess(input: string): string {
  let normalized = '';
  for (const character of input.toLowerCase()) {
    if (normalized.length === 5) break;
    if (character === ' ' || character === '_') normalized += '_';
    else if (character >= 'a' && character <= 'z') normalized += character;
  }
  return normalized;
}

export function canSubmitLetterLedgerGuess(guess: string): boolean {
  return guess.length > 0 && !guess.includes('_');
}

export function letterLedgerDisplayDistribution(
  distribution: readonly number[],
  attempts: number,
  currentWinRecorded: boolean,
): number[] {
  const buckets = Array.from({ length: 8 }, (_, index) => Math.max(0, distribution[index] ?? 0));
  if (!currentWinRecorded && attempts >= 1 && attempts <= buckets.length) buckets[attempts - 1] += 1;
  return buckets;
}
