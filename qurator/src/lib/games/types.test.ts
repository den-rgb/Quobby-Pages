import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import * as gameTypes from './types.ts';

test('removes Letter Ledger answer-category hints from public challenge data', () => {
  const toPublicChallengeData = (gameTypes as unknown as {
    toPublicChallengeData?: (game: string, data: Record<string, unknown>) => Record<string, unknown>;
  }).toPublicChallengeData;

  assert.equal(typeof toPublicChallengeData, 'function');
  assert.deepEqual(
    toPublicChallengeData?.('letter-ledger', { hint: 'A natural word', maxGuesses: 8 }),
    { maxGuesses: 8 },
  );
});

test('groups Letter Ledger wins into one through eight attempt buckets', () => {
  const distribution = (gameTypes as {
    letterLedgerWinDistribution?: (attempts: Array<number | null | undefined>) => number[];
  }).letterLedgerWinDistribution;

  assert.equal(typeof distribution, 'function');
  assert.deepEqual(distribution?.([1, 1, 3, 8, 9, null, 0]), [2, 0, 1, 0, 0, 0, 0, 1]);
});
