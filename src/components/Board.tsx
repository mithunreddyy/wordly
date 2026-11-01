import { describeGuess } from '../format';
import { MAX_GUESSES, WORD_LENGTH, scoreGuess } from '../game/score';
import { Tile } from './Tile';

interface BoardProps {
  guesses: readonly string[];
  input: string;
  answer: string;
  revealRow: number | null;
  shakeKey: number;
  /** The current guess was refused; its letters stay marked until the player edits it. */
  rejected: boolean;
}

export function Board({ guesses, input, answer, revealRow, shakeKey, rejected }: BoardProps) {
  const rows = Array.from({ length: MAX_GUESSES }, (_, row) => {
    const n = row + 1;
    if (row < guesses.length) {
      const guess = guesses[row]!;
      const scored = scoreGuess(guess, answer);
      return (
        <div key={row} className="board-row" role="group" aria-label={`Guess ${n}: ${describeGuess(guess, answer)}`}>
          {scored.map((status, i) => (
            <Tile key={i} letter={guess[i]!} state={status} index={i} reveal={revealRow === row} />
          ))}
        </div>
      );
    }
    if (row === guesses.length && guesses.length < MAX_GUESSES) {
      const typed = input ? `Guess ${n}, typing ${input.toUpperCase().split('').join(' ')}` : `Guess ${n}, empty`;
      const label = rejected && input ? `${typed}, not accepted` : typed;
      const filled = rejected ? 'rejected' : 'filled';
      return (
        <div key={`${row}-${shakeKey}`} className={`board-row${shakeKey ? ' board-row-shake' : ''}`} role="group" aria-label={label}>
          {Array.from({ length: WORD_LENGTH }, (_, i) => (
            <Tile key={i} letter={input[i] ?? ''} state={input[i] ? filled : 'empty'} index={i} />
          ))}
        </div>
      );
    }
    return (
      <div key={row} className="board-row" role="group" aria-label={`Guess ${n}, empty`}>
        {Array.from({ length: WORD_LENGTH }, (_, i) => (
          <Tile key={i} letter="" state="empty" index={i} />
        ))}
      </div>
    );
  });

  return (
    <div className="board" aria-label="Guesses">
      {rows}
    </div>
  );
}
