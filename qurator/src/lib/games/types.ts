export const GAME_KEYS = [
  'letter-ledger',
  'number-trail',
  'riddle-master',
] as const;

export type GameKey = (typeof GAME_KEYS)[number];
export type GameOutcome = 'won' | 'lost';
export type LetterMark = 'red' | 'yellow' | 'green';

export interface WordChallengeData {
  hint: string;
  maxGuesses: 8;
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

export interface PublicChallenge {
  game: GameKey;
  challengeId: string;
  date: string;
  title: string;
  data: PublicChallengeData;
}

export interface StoredChallenge extends PublicChallenge {
  solution: Record<string, unknown>;
}

export interface WordFeedback {
  guess: string;
  green: number;
  yellow: number;
  red: number;
}

export interface NumberFeedback {
  expression: string;
  correct: boolean;
  value: string;
}

export interface RiddleFeedback {
  guess: string;
  correct: boolean;
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
}
