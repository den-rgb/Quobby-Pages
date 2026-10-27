export const GAME_KEYS = [
  'letter-ledger',
  'number-trail',
  'riddle-master',
] as const;

export type GameKey = (typeof GAME_KEYS)[number];
export type GameOutcome = 'won' | 'lost';
export type LetterMark = 'red' | 'yellow' | 'green';

export interface WordChallengeData {
  maxGuesses: 8;
}

export interface StoredWordChallengeData extends WordChallengeData {
  hint: string;
}

export interface NumberChallengeData {
  values: number[];
  target: number;
}

export interface RiddleChallengeData {
  prompt: string;
  maxGuesses: 5;
}

export type PublicChallengeData =
  | WordChallengeData
  | NumberChallengeData
  | RiddleChallengeData;

export type StoredChallengeData =
  | StoredWordChallengeData
  | NumberChallengeData
  | RiddleChallengeData;

export interface PublicChallenge {
  game: GameKey;
  challengeId: string;
  date: string;
  title: string;
  data: PublicChallengeData;
}

export interface StoredChallenge {
  game: GameKey;
  challengeId: string;
  date: string;
  title: string;
  data: StoredChallengeData;
  solution: Record<string, unknown>;
}

export function toPublicChallengeData(game: GameKey, data: StoredChallengeData): PublicChallengeData {
  if (game === 'letter-ledger') {
    const wordData = data as StoredWordChallengeData;
    return { maxGuesses: wordData.maxGuesses };
  }
  return data;
}

export interface WordFeedback {
  guess: string;
  green: number;
  yellow: number;
  red: number;
  marks: LetterMark[];
}

export interface NumberFeedback {
  expression: string;
  correct: boolean;
  value: string;
}

export interface RiddleFeedback {
  guess: string;
  correct: boolean;
  hint?: string;
}

function riddleHintHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function riddleHintRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function riddleHintForIncorrectGuesses(
  answer: string,
  challengeId: string,
  incorrectGuesses: number,
): string | undefined {
  const characters = Array.from(answer.trim());
  const letterIndexes = characters.flatMap((character, index) => /[a-z]/i.test(character) ? [index] : []);
  const revealCount = Math.min(Math.max(0, incorrectGuesses), Math.max(0, letterIndexes.length - 1));
  if (revealCount === 0) return undefined;

  const randomizedIndexes = [...letterIndexes];
  const random = riddleHintRandom(riddleHintHash(`${challengeId}:riddle-hints`));
  for (let index = randomizedIndexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [randomizedIndexes[index], randomizedIndexes[swapIndex]] = [randomizedIndexes[swapIndex], randomizedIndexes[index]];
  }
  const revealedIndexes = new Set(randomizedIndexes.slice(0, revealCount));

  return characters
    .map((character, index) => !/[a-z]/i.test(character) || revealedIndexes.has(index) ? character.toUpperCase() : '_')
    .join(' ');
}

export function riddleFeedbackForGuess(
  answer: string,
  challengeId: string,
  guess: string,
  correct: boolean,
  incorrectGuesses: number,
): RiddleFeedback {
  if (correct) return { guess, correct };
  return {
    guess,
    correct,
    hint: riddleHintForIncorrectGuesses(answer, challengeId, incorrectGuesses),
  };
}

export type GuessFeedback =
  | WordFeedback[]
  | NumberFeedback[]
  | RiddleFeedback[];

export interface GameProfileStats {
  totalXp: number;
  level: number;
  currentStreak: number;
  bestStreak: number;
  totalCompleted: number;
}

export interface GameProfileStatsResponse extends GameProfileStats {
  completedToday: GameKey[];
  letterLedgerWinDistribution: number[];
}

export function letterLedgerWinDistribution(attempts: Array<number | null | undefined>): number[] {
  const buckets = Array.from({ length: 8 }, () => 0);
  for (const attempt of attempts) {
    if (typeof attempt === 'number' && Number.isInteger(attempt) && attempt >= 1 && attempt <= 8) {
      buckets[attempt - 1] += 1;
    }
  }
  return buckets;
}

export interface DailyGameResponse extends PublicChallenge {
  profileCompletion: null | { outcome: GameOutcome };
}

export interface RoundResult {
  game: GameKey;
  challengeId: string;
  date: string;
  outcome: GameOutcome;
  attempts: number;
  answer: string;
  solution?: string;
  feedback: GuessFeedback;
  claimable: boolean;
  rewardPending: boolean;
  rewarded: boolean;
  alreadyRewarded?: boolean;
  xpAwarded: number;
  stats?: GameProfileStats;
  letterLedgerWinDistribution?: number[];
}
