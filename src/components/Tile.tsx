import type { CSSProperties } from 'react';
import type { LetterStatus } from '../game/score';

/** 'rejected' marks typed letters in a guess the game refused (not a word, too short, hard-mode rule). */
export type TileState = 'empty' | 'filled' | 'rejected' | LetterStatus;

interface TileProps {
  letter: string;
  state: TileState;
  index: number;
  reveal?: boolean;
}

export function Tile({ letter, state, index, reveal = false }: TileProps) {
  return (
    <div
      className={`tile tile-${state}${reveal ? ' tile-reveal' : ''}`}
      style={{ '--i': index } as CSSProperties}
      aria-hidden="true"
    >
      {letter}
    </div>
  );
}
