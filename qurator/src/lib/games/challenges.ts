import 'server-only';

import { DAILY_WORDS } from './dictionary';
import { evaluateNumberExpression } from './validation';
import type { GameKey, StoredChallenge } from './types';

const TITLES: Record<GameKey, string> = {
  'letter-ledger': 'Letter Ledger',
  'number-trail': 'Number Trail',
  'riddle-master': 'Riddle Master',
};

const RIDDLES = [
  {
    prompt: 'I have a face and two hands, but no arms or legs. What am I?',
    answer: 'clock',
    aliases: ['timepiece'],
  },
  {
    prompt: 'I travel without feet and sing over stones. What am I?',
    answer: 'river',
    aliases: ['stream', 'brook'],
  },
  {
    prompt: 'I have many teeth but never take a bite. What am I?',
    answer: 'comb',
    aliases: ['hair comb'],
  },
  {
    prompt: 'Each time I help you see, I grow a little shorter. What am I?',
    answer: 'candle',
    aliases: ['wax candle'],
  },
  {
    prompt: 'You can tell me, play me, or crack me. What am I?',
    answer: 'joke',
    aliases: ['a joke'],
  },
  {
    prompt: 'The more steps you take, the more of me you leave behind. What am I?',
    answer: 'footprints',
    aliases: ['footprint', 'footsteps', 'tracks'],
  },
  {
    prompt: 'I show towns and roads, yet I contain no buildings. What am I?',
    answer: 'map',
    aliases: ['a map'],
  },
  {
    prompt: 'I have an eye, but I cannot see. What am I?',
    answer: 'needle',
    aliases: ['a needle'],
  },
  {
    prompt: 'I have keys, but no locks will open with them. What am I?',
    answer: 'piano',
    aliases: ['keyboard'],
  },
  {
    prompt: 'I get wetter while helping something else become dry. What am I?',
    answer: 'towel',
    aliases: ['a towel'],
  },
  {
    prompt: 'I am full of holes but can still carry water. What am I?',
    answer: 'sponge',
    aliases: ['a sponge'],
  },
  {
    prompt: 'I have a neck but no head. What am I?',
    answer: 'bottle',
    aliases: ['a bottle'],
  },
  {
    prompt: 'I have four legs but cannot take a step. What am I?',
    answer: 'table',
    aliases: ['chair', 'bed'],
  },
  {
    prompt: 'I cross the world while staying in one corner. What am I?',
    answer: 'stamp',
    aliases: ['postage stamp'],
  },
  {
    prompt: 'I can fill a room but take up no room at all. What am I?',
    answer: 'light',
    aliases: ['sunlight'],
  },
  {
    prompt: 'I contain many words but never speak. What am I?',
    answer: 'book',
    aliases: ['a book'],
  },
  {
    prompt: 'I am light enough to lift, yet hard to throw far. What am I?',
    answer: 'feather',
    aliases: ['a feather'],
  },
  {
    prompt: 'I have one head, one foot, and four legs. What am I?',
    answer: 'bed',
    aliases: ['a bed'],
  },
  {
    prompt: 'A maker does not need me, a buyer does not use me, and a user cannot see me. What am I?',
    answer: 'coffin',
    aliases: ['a coffin', 'casket'],
  },
  {
    prompt: 'I can be caught but never thrown. What am I?',
    answer: 'cold',
    aliases: ['a cold'],
  },
  {
    prompt: 'I go up each year and never come down. What am I?',
    answer: 'age',
    aliases: ['your age'],
  },
  {
    prompt: 'I grow beneath the ground and may be orange. What am I?',
    answer: 'carrot',
    aliases: ['a carrot'],
  },
  {
    prompt: 'I have a spine and many leaves, but I am not a tree. What am I?',
    answer: 'book',
    aliases: ['a book'],
  },
  {
    prompt: 'I am always ahead of you, though you cannot see me. What am I?',
    answer: 'future',
    aliases: ['the future'],
  },
  {
    prompt: 'I have four fingers and a thumb, but no bones. What am I?',
    answer: 'glove',
    aliases: ['a glove'],
  },
  {
    prompt: 'I am made of water, yet a little water can end me. What am I?',
    answer: 'ice',
    aliases: ['an ice cube'],
  },
  {
    prompt: 'I have a ring but no finger, and I can carry a voice. What am I?',
    answer: 'telephone',
    aliases: ['phone'],
  },
  {
    prompt: 'I have branches but neither leaves nor fruit. What am I?',
    answer: 'bank',
    aliases: ['a bank'],
  },
  {
    prompt: 'I am black when clean and white when covered in writing. What am I?',
    answer: 'blackboard',
    aliases: ['chalkboard'],
  },
  {
    prompt: 'I have a bed but never sleep, and I have a mouth but never eat. What am I?',
    answer: 'river',
    aliases: ['stream', 'brook'],
  },
] as const;

function hashSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const LETTER_LEDGER_WORD_DECK = (() => {
  const deck = [...DAILY_WORDS];
  const random = seededRandom(hashSeed('qurator:letter-ledger:word-order:v1'));

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
})();

function letterLedgerWordForDate(date: string) {
  const utcDay = Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 86_400_000);
  if (!Number.isFinite(utcDay)) throw new Error(`Invalid Letter Ledger date: ${date}`);
  const index =
    ((utcDay % LETTER_LEDGER_WORD_DECK.length) + LETTER_LEDGER_WORD_DECK.length) %
    LETTER_LEDGER_WORD_DECK.length;
  return LETTER_LEDGER_WORD_DECK[index];
}

function createNumberChallenge(date: string) {
  const random = seededRandom(hashSeed(`${date}:number-trail`));

  for (let attempt = 0; attempt < 2_000; attempt += 1) {
    const values = Array.from({ length: 5 }, () => 1 + Math.floor(random() * 9));
    const expressions = [
      `${values[0]} * ${values[1]} - ${values[2]} + ${values[3]} * ${values[4]}`,
      `(${values[0]} + ${values[1]}) * ${values[2]} - ${values[3]} - ${values[4]}`,
      `(${values[0]} + ${values[1]} + ${values[2]}) * ${values[3]} - ${values[4]}`,
      `${values[0]} * ${values[1]} + ${values[2]} * ${values[3]} + ${values[4]}`,
      `(${values[0]} * ${values[1]} + ${values[2]}) * ${values[3]} - ${values[4]}`,
      `(${values[0]} + ${values[1]}) * (${values[2]} + ${values[3]}) + ${values[4]}`,
      `(${values[0]} + ${values[1]}) * (${values[2]} + ${values[3]}) - ${values[4]}`,
      `${values[0]} + ${values[1]} + ${values[2]} + ${values[3]} + ${values[4]}`,
    ];
    const start = Math.floor(random() * expressions.length);

    for (let offset = 0; offset < expressions.length; offset += 1) {
      const expression = expressions[(start + offset) % expressions.length];
      if ((expression.match(/\d+/g)?.length ?? 0) !== values.length) continue;
      try {
        const result = evaluateNumberExpression(expression, values);
        if (result.denominator === 1 && result.numerator >= 10 && result.numerator <= 99) {
          return { values, target: result.numerator, expression };
        }
      } catch {
        // A candidate that reuses a value instance is not a valid witness.
      }
    }
  }

  const fallback = {
    values: [2, 3, 4, 5, 6],
    target: 44,
    expression: '(2 * 3 + 4) * 5 - 6',
  };
  const verified = evaluateNumberExpression(fallback.expression, fallback.values);
  if (
    (fallback.expression.match(/\d+/g)?.length ?? 0) !== fallback.values.length ||
    verified.denominator !== 1 ||
    verified.numerator !== fallback.target
  ) {
    throw new Error('Number Trail fallback solution must use every displayed number exactly once.');
  }
  return {
    ...fallback,
  };
}

export function createChallengeForDate(game: GameKey, date: string): StoredChallenge {
  const challengeId = `qurator:${game}:${date}`;
  const random = seededRandom(hashSeed(`${date}:${game}`));

  if (game === 'letter-ledger') {
    if (DAILY_WORDS.length === 0) throw new Error('The Letter Ledger answer pool is empty.');
    const entry = letterLedgerWordForDate(date);
    return {
      game,
      challengeId,
      date,
      title: TITLES[game],
      data: { hint: entry.hint, maxGuesses: 8 },
      solution: { answer: entry.word },
    };
  }

  if (game === 'number-trail') {
    const puzzle = createNumberChallenge(date);
    return {
      game,
      challengeId,
      date,
      title: TITLES[game],
      data: { values: puzzle.values, target: puzzle.target },
      solution: { answer: String(puzzle.target), expression: puzzle.expression },
    };
  }

  const riddle = RIDDLES[Math.floor(random() * RIDDLES.length)];
  return {
    game,
    challengeId,
    date,
    title: TITLES[game],
    data: { prompt: riddle.prompt, maxGuesses: 5 },
    solution: { answer: riddle.answer, aliases: [...riddle.aliases] },
  };
}

export function isGameKey(value: string): value is GameKey {
  return value === 'letter-ledger' || value === 'number-trail' || value === 'riddle-master';
}

export function getUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}
