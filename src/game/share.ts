import type { GameState } from './game';
import { MAX_GUESSES, scoreGuess, type LetterStatus } from './score';

const SQUARE: Record<LetterStatus, string> = {
  correct: '🟦',
  present: '🟨',
  absent: '🟫',
};

/** Spoiler-free summary: the grid shows results, never letters. */
export function shareText(state: GameState): string {
  const { puzzle, guesses, status, hardMode } = state;
  const score = status === 'won' ? String(guesses.length) : 'X';
  const header = `Wordly #${puzzle.number} ${score}/${MAX_GUESSES}${hardMode ? '*' : ''}${state.mode === 'archive' ? ' (archive)' : ''}`;
  const grid = guesses.map((g) => scoreGuess(g, puzzle.answer).map((s) => SQUARE[s]).join(''));
  return [header, '', ...grid].join('\n');
}
