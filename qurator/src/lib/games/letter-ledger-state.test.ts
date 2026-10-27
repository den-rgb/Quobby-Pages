import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import {
  automaticLetterLedgerRedMark,
  canSubmitLetterLedgerGuess,
  letterLedgerDisplayDistribution,
  letterLedgerKnownAbsentLetters,
  letterLedgerManualMarkingKeys,
  normalizeLetterLedgerGuess,
  resolveLetterLedgerMarks,
} from './letter-ledger-state.ts';

test('uses server letter marks and supports legacy all-red feedback', () => {
  assert.deepEqual(
    resolveLetterLedgerMarks({ guess: 'allay', green: 1, yellow: 1, red: 3, marks: ['yellow', 'green', 'red', 'red', 'red'] }),
    ['yellow', 'green', 'red', 'red', 'red'],
  );
  assert.deepEqual(
    resolveLetterLedgerMarks({ guess: 'poker', green: 0, yellow: 0, red: 5, marks: [] }),
    ['red', 'red', 'red', 'red', 'red'],
  );
});

test('automatically marks all-red letters across earlier guesses', () => {
  const rows = [
    [],
    ['red', 'red', 'red', 'red', 'red'],
  ] as const;
  const absent = letterLedgerKnownAbsentLetters(['apple', 'poker'], rows, 0);
  assert.equal(automaticLetterLedgerRedMark(rows, 0, 'P', absent), true);
  assert.equal(automaticLetterLedgerRedMark(rows, 1, 'P'), true);
  assert.equal(automaticLetterLedgerRedMark(rows, 0, 'Z', absent), false);
});

test('applies a manual mark to matching letters in earlier guesses', () => {
  assert.deepEqual(
    letterLedgerManualMarkingKeys(['crane', 'tears'], 1, 2),
    ['0:2', '1:2'],
  );
});

test('normalizes blank tiles and prevents their submission', () => {
  assert.equal(normalizeLetterLedgerGuess('A b_c!de'), 'a_b_c');
  assert.equal(normalizeLetterLedgerGuess('abcdef'), 'abcde');
  assert.equal(canSubmitLetterLedgerGuess('a_bcd'), false);
  assert.equal(canSubmitLetterLedgerGuess('abcde'), true);
});

test('adds the current win only when the returned distribution has not recorded it', () => {
  assert.deepEqual(letterLedgerDisplayDistribution([], 4, false), [0, 0, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual(letterLedgerDisplayDistribution([0, 1], 2, true), [0, 1, 0, 0, 0, 0, 0, 0]);
});
