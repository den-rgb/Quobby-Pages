export function isValidGuess(
  value: string,
  dictionary: ReadonlySet<string>,
  isProfane: (word: string) => boolean,
): boolean {
  const word = value.trim().toLowerCase();
  return /^[a-z]{5}$/.test(word) && dictionary.has(word) && !isProfane(word);
}

export function isValidAnswer(
  value: string,
  dictionary: ReadonlySet<string>,
  isProfane: (word: string) => boolean,
): boolean {
  const word = value.trim().toLowerCase();
  return isValidGuess(word, dictionary, isProfane) && new Set(word).size === 5;
}

export function scoreWordFeedback(answer: string, guess: string): {
  guess: string;
  green: number;
  yellow: number;
  red: number;
  marks: ('red' | 'yellow' | 'green')[];
} {
  const remainingLetters = new Map<string, number>();
  const marks: ('red' | 'yellow' | 'green')[] = Array.from({ length: guess.length }, () => 'red');
  let green = 0;
  let yellow = 0;

  for (let index = 0; index < answer.length; index += 1) {
    if (answer[index] === guess[index]) {
      green += 1;
      marks[index] = 'green';
    } else {
      const letter = answer[index];
      remainingLetters.set(letter, (remainingLetters.get(letter) ?? 0) + 1);
    }
  }

  for (let index = 0; index < guess.length; index += 1) {
    if (answer[index] === guess[index]) continue;
    const letter = guess[index];
    const count = remainingLetters.get(letter) ?? 0;
    if (count > 0) {
      yellow += 1;
      marks[index] = 'yellow';
      remainingLetters.set(letter, count - 1);
    }
  }

  return { guess, green, yellow, red: guess.length - green - yellow, marks };
}
