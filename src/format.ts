import { scoreGuess, type LetterStatus } from './game/score';

export const STATUS_WORDS: Record<LetterStatus, string> = {
  correct: 'correct',
  present: 'in the word, wrong spot',
  absent: 'not in the word',
};

/** Screen-reader description of a scored guess, e.g. "S correct, T not in the word, ...". */
export function describeGuess(guess: string, answer: string): string {
  return scoreGuess(guess, answer)
    .map((status, i) => `${guess[i]!.toUpperCase()} ${STATUS_WORDS[status]}`)
    .join(', ');
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
