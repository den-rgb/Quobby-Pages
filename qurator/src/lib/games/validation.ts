import 'server-only';

import { isValidWord } from './dictionary';
import type {
  GameOutcome,
  GuessFeedback,
  NumberChallengeData,
  NumberFeedback,
  RiddleChallengeData,
  RiddleFeedback,
  StoredChallenge,
  WordChallengeData,
  WordFeedback,
} from './types';

export class GameValidationError extends Error {}

interface Fraction {
  numerator: number;
  denominator: number;
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function fraction(numerator: number, denominator: number): Fraction {
  if (denominator === 0) throw new GameValidationError('Division by zero is not allowed.');
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: Math.abs(denominator) / divisor,
  };
}

function add(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function subtract(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiply(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

export function evaluateNumberExpression(expression: string, values: number[]): Fraction {
  if (expression.length > 160) throw new GameValidationError('Keep the expression under 160 characters.');
  const compact = expression
    .replace(/\s+/g, '')
    .replace(/[xX]/g, '*')
    .replace(/[×]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−]/g, '-');
  const tokens = compact.match(/\d+|[()+*/-]/g) ?? [];
  if (!compact || tokens.join('') !== compact || tokens.length > 40) {
    throw new GameValidationError('Use only the provided numbers, arithmetic signs, and parentheses.');
  }

  const used = values.map(() => false);
  let position = 0;
  let usedCount = 0;
  const peek = () => tokens[position];

  const parseExpression = (): Fraction => {
    let result = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const operator = tokens[position++];
      const right = parseTerm();
      result = operator === '+' ? add(result, right) : subtract(result, right);
    }
    return result;
  };

  const parseTerm = (): Fraction => {
    let result = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const operator = tokens[position++];
      const right = parseFactor();
      result = operator === '*' ? multiply(result, right) : divide(result, right);
    }
    return result;
  };

  const parseFactor = (): Fraction => {
    if (peek() === '+') {
      position += 1;
      return parseFactor();
    }
    if (peek() === '-') {
      position += 1;
      const value = parseFactor();
      return fraction(-value.numerator, value.denominator);
    }
    if (peek() === '(') {
      position += 1;
      const value = parseExpression();
      if (peek() !== ')') throw new GameValidationError('Close every opening parenthesis.');
      position += 1;
      return value;
    }

    const token = peek();
    if (!token || !/^\d+$/.test(token)) {
      throw new GameValidationError('The expression is incomplete.');
    }
    position += 1;
    const value = Number(token);
    const availableIndex = values.findIndex((candidate, index) => candidate === value && !used[index]);
    if (availableIndex < 0) {
      throw new GameValidationError('Use each displayed number no more than once.');
    }
    used[availableIndex] = true;
    usedCount += 1;
    return fraction(value, 1);
  };

  const result = parseExpression();
  if (position !== tokens.length) throw new GameValidationError('Check the expression syntax.');
  if (usedCount === 0) throw new GameValidationError('Use at least one displayed number.');
  return result;
}

export function formatFraction(value: Fraction): string {
  return value.denominator === 1
    ? String(value.numerator)
    : `${value.numerator}/${value.denominator}`;
}

export function scoreWordGuess(answer: string, rawGuess: string): WordFeedback {
  const guess = rawGuess.trim().toLowerCase();
  if (!isValidWord(guess)) {
    throw new GameValidationError('Enter a valid five-letter word with no repeated letters.');
  }
  const green = [...guess].reduce((count, letter, index) => count + Number(answer[index] === letter), 0);
  const yellow = [...guess].reduce(
    (count, letter, index) => count + Number(answer.includes(letter) && answer[index] !== letter),
    0,
  );
  return { guess, green, yellow, red: 5 - green - yellow };
}

function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(a|an|the) /, '');
}

type ActiveTranscript = {
  ended: false;
  feedback: GuessFeedback;
  guessesRemaining: number | null;
};

type FinishedTranscript = {
  ended: true;
  outcome: GameOutcome;
  attempts: number;
  answer: string;
  solution?: string;
  feedback: GuessFeedback;
};

export type TranscriptResult = ActiveTranscript | FinishedTranscript;

export function validateTranscript(
  challenge: StoredChallenge,
  guesses: string[],
  giveUp: boolean,
): TranscriptResult {
  if (guesses.length > 50) throw new GameValidationError('That round has too many guesses.');

  if (challenge.game === 'letter-ledger') {
    const data = challenge.data as WordChallengeData;
    const answer = String(challenge.solution.answer ?? '').toLowerCase();
    const feedback: WordFeedback[] = [];
    let won = false;
    for (const rawGuess of guesses) {
      if (feedback.length >= data.maxGuesses) {
        throw new GameValidationError('That round has used all of its guesses.');
      }
      if (won) throw new GameValidationError('A round cannot continue after a correct answer.');
      const result = scoreWordGuess(answer, rawGuess);
      feedback.push(result);
      won = result.green === 5;
    }
    const ended = won || giveUp || feedback.length >= data.maxGuesses;
    if (!ended) {
      return {
        ended: false,
        feedback,
        guessesRemaining: data.maxGuesses - feedback.length,
      };
    }
    return {
      ended: true,
      outcome: won ? 'won' : 'lost',
      attempts: feedback.length,
      answer,
      feedback,
    };
  }

  if (challenge.game === 'number-trail') {
    const data = challenge.data as NumberChallengeData;
    const answer = String(challenge.solution.answer ?? data.target);
    const solution = String(challenge.solution.expression ?? '');
    const feedback: NumberFeedback[] = [];
    let won = false;
    for (const rawExpression of guesses) {
      if (feedback.length >= 50) throw new GameValidationError('That round has too many guesses.');
      if (won) throw new GameValidationError('A round cannot continue after reaching the target.');
      const expression = rawExpression.trim();
      const result = evaluateNumberExpression(expression, data.values);
      const correct = result.denominator === 1 && result.numerator === data.target;
      feedback.push({ expression, correct, value: formatFraction(result) });
      won = correct;
    }
    if (!won && !giveUp) return { ended: false, feedback, guessesRemaining: null };
    return {
      ended: true,
      outcome: won ? 'won' : 'lost',
      attempts: feedback.length,
      answer,
      solution,
      feedback,
    };
  }

  const data = challenge.data as RiddleChallengeData;
  const answer = String(challenge.solution.answer ?? '');
  const aliases = Array.isArray(challenge.solution.aliases)
    ? challenge.solution.aliases.filter((alias): alias is string => typeof alias === 'string')
    : [];
  const acceptedAnswers = new Set([answer, ...aliases].map(normalizeAnswer));
  const feedback: RiddleFeedback[] = [];
  let won = false;
  for (const rawGuess of guesses) {
    if (feedback.length >= data.maxGuesses) {
      throw new GameValidationError('That round has used all of its guesses.');
    }
    if (rawGuess.trim().length > 80 || !rawGuess.trim()) {
      throw new GameValidationError('Enter an answer between 1 and 80 characters.');
    }
    if (won) throw new GameValidationError('A round cannot continue after a correct answer.');
    const correct = acceptedAnswers.has(normalizeAnswer(rawGuess));
    feedback.push({ guess: rawGuess.trim(), correct });
    won = correct;
  }
  const ended = won || giveUp || feedback.length >= data.maxGuesses;
  if (!ended) {
    return {
      ended: false,
      feedback,
      guessesRemaining: data.maxGuesses - feedback.length,
    };
  }
  return {
    ended: true,
    outcome: won ? 'won' : 'lost',
    attempts: feedback.length,
    answer,
    feedback,
  };
}
