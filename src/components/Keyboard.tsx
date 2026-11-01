import type { MouseEvent } from 'react';
import type { LetterStatus } from '../game/score';
import { STATUS_WORDS } from '../format';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

interface KeyboardProps {
  hints: ReadonlyMap<string, LetterStatus>;
  disabled: boolean;
  onLetter: (letter: string) => void;
  onEnter: () => void;
  onDelete: () => void;
}

/**
 * Pointer clicks drop focus afterwards so a later physical Enter submits the
 * guess instead of re-pressing the last on-screen key. Keyboard activation
 * (detail === 0) keeps focus where the user put it.
 */
function blurIfPointer(e: MouseEvent<HTMLButtonElement>) {
  if (e.detail > 0) e.currentTarget.blur();
}

export function Keyboard({ hints, disabled, onLetter, onEnter, onDelete }: KeyboardProps) {
  return (
    <div className="keyboard" role="group" aria-label="On-screen keyboard">
      {ROWS.map((row, r) => (
        <div className="keyboard-row" key={row}>
          {r === 2 && (
            <button
              type="button"
              className="key key-wide"
              disabled={disabled}
              onClick={(e) => {
                onEnter();
                blurIfPointer(e);
              }}
            >
              Enter
            </button>
          )}
          {[...row].map((letter) => {
            const hint = hints.get(letter);
            return (
              <button
                type="button"
                key={letter}
                className={`key${hint ? ` key-${hint}` : ''}`}
                disabled={disabled}
                aria-label={hint ? `${letter.toUpperCase()}, ${STATUS_WORDS[hint]}` : letter.toUpperCase()}
                onClick={(e) => {
                  onLetter(letter);
                  blurIfPointer(e);
                }}
              >
                {letter}
              </button>
            );
          })}
          {r === 2 && (
            <button
              type="button"
              className="key key-wide"
              disabled={disabled}
              aria-label="Delete letter"
              onClick={(e) => {
                onDelete();
                blurIfPointer(e);
              }}
            >
              <span aria-hidden="true">⌫</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
