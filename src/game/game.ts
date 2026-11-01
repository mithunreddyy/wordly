import { puzzleFromId, type Puzzle } from './puzzle';
import { MAX_GUESSES, WORD_LENGTH, scoreGuess } from './score';
import { isAcceptedGuess } from './words';

export type GameStatus = 'playing' | 'won' | 'lost';

/** Archive games are replays of past days; they never touch stats or streaks. */
export type GameMode = 'daily' | 'archive';

export interface GameState {
  puzzle: Puzzle;
  guesses: string[];
  input: string;
  status: GameStatus;
  hardMode: boolean;
  mode: GameMode;
}

export type SubmitError =
  | { kind: 'too-short' }
  | { kind: 'not-in-list' }
  | { kind: 'hard-position'; position: number; letter: string }
  | { kind: 'hard-missing'; letter: string };

export function newGame(puzzle: Puzzle, hardMode: boolean, mode: GameMode = 'daily'): GameState {
  return { puzzle, guesses: [], input: '', status: 'playing', hardMode, mode };
}

export function statusFor(guesses: readonly string[], answer: string): GameStatus {
  if (guesses.includes(answer)) return 'won';
  return guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
}

export function typeLetter(state: GameState, key: string): GameState {
  if (state.status !== 'playing' || state.input.length >= WORD_LENGTH) return state;
  const letter = key.toLowerCase();
  if (!/^[a-z]$/.test(letter)) return state;
  return { ...state, input: state.input + letter };
}

export function deleteLetter(state: GameState): GameState {
  if (state.status !== 'playing' || state.input.length === 0) return state;
  return { ...state, input: state.input.slice(0, -1) };
}

/**
 * Hard mode: every letter revealed as correct must stay in its spot, and every
 * revealed letter must be reused at least as many times as it has been confirmed.
 */
export function hardModeViolation(guess: string, previous: readonly string[], answer: string): SubmitError | null {
  for (const prev of previous) {
    const scored = scoreGuess(prev, answer);
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (scored[i] === 'correct' && guess[i] !== prev[i]) {
        return { kind: 'hard-position', position: i + 1, letter: prev[i]! };
      }
    }
    const required = new Map<string, number>();
    scored.forEach((status, i) => {
      if (status !== 'absent') required.set(prev[i]!, (required.get(prev[i]!) ?? 0) + 1);
    });
    for (const [letter, count] of required) {
      if ([...guess].filter((c) => c === letter).length < count) {
        return { kind: 'hard-missing', letter };
      }
    }
  }
  return null;
}

export function submitGuess(state: GameState): { state: GameState; error: SubmitError | null } {
  if (state.status !== 'playing') return { state, error: null };
  const guess = state.input;
  if (guess.length < WORD_LENGTH) return { state, error: { kind: 'too-short' } };
  if (!isAcceptedGuess(guess)) return { state, error: { kind: 'not-in-list' } };
  if (state.hardMode) {
    const violation = hardModeViolation(guess, state.guesses, state.puzzle.answer);
    if (violation) return { state, error: violation };
  }
  const guesses = [...state.guesses, guess];
  return {
    state: { ...state, guesses, input: '', status: statusFor(guesses, state.puzzle.answer) },
    error: null,
  };
}

/** Hard mode may only change before the first guess, so it cannot be used to dodge its constraints. */
export function setHardMode(state: GameState, hardMode: boolean): GameState {
  if (state.guesses.length > 0 || state.status !== 'playing') return state;
  return { ...state, hardMode };
}

export function describeError(error: SubmitError): string {
  switch (error.kind) {
    case 'too-short':
      return 'Not enough letters';
    case 'not-in-list':
      return 'Not in the word list';
    case 'hard-position':
      return `Hard mode: letter ${error.position} must be ${error.letter.toUpperCase()}`;
    case 'hard-missing':
      return `Hard mode: guess must contain ${error.letter.toUpperCase()}`;
  }
}

export interface SavedGame {
  puzzleId: string;
  guesses: string[];
  input: string;
  hardMode: boolean;
  mode: GameMode;
}

export function toSaved(state: GameState): SavedGame {
  return {
    puzzleId: state.puzzle.id,
    guesses: state.guesses,
    input: state.input,
    hardMode: state.hardMode,
    mode: state.mode,
  };
}

/**
 * Rebuilds a game from untrusted saved data. The answer always comes from the
 * puzzle id and the status is recomputed, so edited storage cannot fake a win.
 */
export function fromSaved(data: unknown): GameState | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const puzzle = puzzleFromId(record.puzzleId);
  if (!puzzle) return null;

  const { guesses, input, hardMode } = record;
  // Saves from before archive play existed have no mode; they were all daily games.
  const mode = record.mode === undefined ? 'daily' : record.mode;
  if (mode !== 'daily' && mode !== 'archive') return null;
  if (!Array.isArray(guesses) || guesses.length > MAX_GUESSES) return null;
  if (!guesses.every((g): g is string => typeof g === 'string' && isAcceptedGuess(g))) return null;
  if (typeof input !== 'string' || !/^[a-z]{0,5}$/.test(input)) return null;
  if (typeof hardMode !== 'boolean') return null;

  // A guess after the winning one cannot happen in real play.
  const winAt = guesses.indexOf(puzzle.answer);
  if (winAt !== -1 && winAt !== guesses.length - 1) return null;

  const status = statusFor(guesses, puzzle.answer);
  return { puzzle, guesses, input: status === 'playing' ? input : '', status, hardMode, mode };
}
