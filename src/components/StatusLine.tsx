import type { GameState } from '../game/game';
import { MAX_GUESSES } from '../game/score';

interface StatusLineProps {
  game: GameState;
  error: string | null;
  revealing: boolean;
  onShowResults: () => void;
}

/**
 * Always-visible status under the board. Errors stay until the guess is edited
 * instead of vanishing on a timer. Screen readers get the same messages from the
 * app's live region, so this line is not itself live.
 */
export function StatusLine({ game, error, revealing, onShowResults }: StatusLineProps) {
  if (error) {
    return (
      <div className="status status-error">
        <span className="status-mark" aria-hidden="true">!</span>
        <p>{error}</p>
      </div>
    );
  }

  if (game.status !== 'playing' && !revealing) {
    return (
      <div className="status status-done">
        <p>
          {game.status === 'won'
            ? `Solved in ${game.guesses.length}.`
            : `The word was ${game.puzzle.answer.toUpperCase()}.`}
        </p>
        <button type="button" className="primary-button" onClick={onShowResults}>
          Results
        </button>
      </div>
    );
  }

  const left = MAX_GUESSES - game.guesses.length;
  return (
    <div className="status">
      <p className="status-quiet">
        {game.status !== 'playing' ? ' ' : left === MAX_GUESSES ? 'Six guesses. Type a word to start.' : `${left} ${left === 1 ? 'guess' : 'guesses'} left`}
        {game.hardMode && game.status === 'playing' && <span className="status-tag"> · hard mode</span>}
      </p>
    </div>
  );
}
