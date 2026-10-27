import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import { triedLettersFromGuesses } from './letter-keyboard.ts';

test('keyboard tried-letter set is case-insensitive', () => {
  assert.deepEqual(
    [...triedLettersFromGuesses(['plant', 'GHAST'])].sort(),
    ['A', 'G', 'H', 'L', 'N', 'P', 'S', 'T'],
  );
});
