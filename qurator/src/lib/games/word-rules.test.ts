import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import { isValidAnswer, isValidGuess, scoreWordFeedback } from './word-rules.ts';

const dictionary = new Set(['ghast', 'eerie', 'allay', 'plant']);
const neverProfane = () => false;

test('accepts the reported archaic word and valid repeated-letter guesses', () => {
  assert.equal(isValidGuess('ghast', dictionary, neverProfane), true);
  assert.equal(isValidGuess('eerie', dictionary, neverProfane), true);
});

test('keeps repeated-letter words out of the answer pool', () => {
  assert.equal(isValidAnswer('plant', dictionary, neverProfane), true);
  assert.equal(isValidAnswer('eerie', dictionary, neverProfane), false);
});

test('rejects malformed or profane guesses', () => {
  assert.equal(isValidGuess('abcde', dictionary, neverProfane), false);
  assert.equal(isValidGuess('allay', dictionary, (word) => word === 'allay'), false);
});

test('does not count a target letter more than once in repeated-letter feedback', () => {
  assert.deepEqual(scoreWordFeedback('plant', 'allay'), {
    guess: 'allay', green: 1, yellow: 1, red: 3,
  });
});

test('reserves green matches before considering repeated letters for yellow', () => {
  assert.deepEqual(scoreWordFeedback('plant', 'alaaa'), {
    guess: 'alaaa', green: 2, yellow: 0, red: 3,
  });
});

test('generated guess list excludes words blocked by the profanity predicate', async () => {
  // @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
  const { containsProfanity } = await import('../profanity.ts');
  const list = JSON.parse(readFileSync(new URL('./scowl-guess-word-list.json', import.meta.url), 'utf8')) as { words: string[] };
  assert.deepEqual(list.words.filter(containsProfanity), []);
});
