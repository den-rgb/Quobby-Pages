export function triedLettersFromGuesses(guesses: Iterable<string>): Set<string> {
  return new Set([...guesses].flatMap((guess) => [...guess.toUpperCase()]));
}
