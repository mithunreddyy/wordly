export type LetterStatus = 'correct' | 'present' | 'absent';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/**
 * Two-pass scoring. Exact matches claim their answer letters first; the second
 * pass marks a letter present only while unclaimed copies of it remain, so a
 * guess with two Es against an answer with one E reports at most one hit.
 */
export function scoreGuess(guess: string, answer: string): LetterStatus[] {
  if (guess.length !== answer.length) {
    throw new Error(`Guess length ${guess.length} does not match answer length ${answer.length}`);
  }

  const result: LetterStatus[] = Array.from({ length: guess.length }, () => 'absent');
  const remaining = new Map<string, number>();

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct';
    } else {
      const letter = answer[i]!;
      remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    const letter = guess[i]!;
    const left = remaining.get(letter) ?? 0;
    if (left > 0) {
      result[i] = 'present';
      remaining.set(letter, left - 1);
    }
  }

  return result;
}

const RANK: Record<LetterStatus, number> = { absent: 0, present: 1, correct: 2 };

/** Best status seen for each letter across all scored guesses, for keyboard hints. */
export function letterHints(guesses: readonly string[], answer: string): Map<string, LetterStatus> {
  const hints = new Map<string, LetterStatus>();
  for (const guess of guesses) {
    scoreGuess(guess, answer).forEach((status, i) => {
      const letter = guess[i]!;
      const prev = hints.get(letter);
      if (!prev || RANK[status] > RANK[prev]) hints.set(letter, status);
    });
  }
  return hints;
}
