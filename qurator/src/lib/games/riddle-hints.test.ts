import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import * as gameTypes from './types.ts';

const riddleHintForIncorrectGuesses = (gameTypes as {
  riddleHintForIncorrectGuesses?: (answer: string, challengeId: string, incorrectGuesses: number) => string | undefined;
}).riddleHintForIncorrectGuesses;
const riddleFeedbackForGuess = (gameTypes as {
  riddleFeedbackForGuess?: (
    answer: string,
    challengeId: string,
    guess: string,
    correct: boolean,
    incorrectGuesses: number,
  ) => { guess: string; correct: boolean; hint?: string };
}).riddleFeedbackForGuess;

test('reveals one deterministic answer letter after each incorrect riddle guess', () => {
  assert.equal(typeof riddleHintForIncorrectGuesses, 'function');
  const firstHint = riddleHintForIncorrectGuesses?.('clock', 'qurator:riddle-master:2026-11-09', 1);
  const secondHint = riddleHintForIncorrectGuesses?.('clock', 'qurator:riddle-master:2026-11-09', 2);
  const replayHint = riddleHintForIncorrectGuesses?.('clock', 'qurator:riddle-master:2026-11-09', 2);

  assert.equal(firstHint?.replaceAll(' ', '').replaceAll('_', '').length, 1);
  assert.equal(secondHint?.replaceAll(' ', '').replaceAll('_', '').length, 2);
  assert.equal(secondHint, replayHint);
});

test('keeps at least one answer letter hidden', () => {
  const hint = riddleHintForIncorrectGuesses?.('ice', 'qurator:riddle-master:2026-11-09', 5);
  assert.equal(hint?.replaceAll(' ', '').replaceAll('_', '').length, 2);
});

test('adds a hint only to incorrect riddle feedback', () => {
  assert.equal(typeof riddleFeedbackForGuess, 'function');
  const incorrect = riddleFeedbackForGuess?.('clock', 'qurator:riddle-master:2026-11-09', 'watch', false, 1);
  const correct = riddleFeedbackForGuess?.('clock', 'qurator:riddle-master:2026-11-09', 'clock', true, 1);

  assert.equal(incorrect?.hint?.replaceAll(' ', '').replaceAll('_', '').length, 1);
  assert.deepEqual(correct, { guess: 'clock', correct: true });
});
