import answersJson from '../data/answers.json';
import guessesJson from '../data/guesses.json';

// Sources and licenses for both lists are recorded in WORDLISTS.md.
export const ANSWERS: readonly string[] = answersJson;
const GUESSES: ReadonlySet<string> = new Set([...guessesJson, ...answersJson]);

export function normalizeWord(input: string): string {
  return input.trim().toLowerCase();
}

export function isAcceptedGuess(word: string): boolean {
  return GUESSES.has(word);
}
