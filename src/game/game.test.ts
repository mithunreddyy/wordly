import { describe, expect, it } from 'vitest';
import {
  deleteLetter,
  describeError,
  fromSaved,
  newGame,
  setHardMode,
  submitGuess,
  toSaved,
  typeLetter,
  type GameState,
} from './game';
import { puzzleForDay, type Puzzle } from './puzzle';

const puzzle = (answer: string): Puzzle => ({ ...puzzleForDay(0), answer });

function typeWord(state: GameState, word: string): GameState {
  return [...word].reduce(typeLetter, state);
}

function play(state: GameState, ...words: string[]) {
  let s = state;
  for (const w of words) {
    const result = submitGuess(typeWord(s, w));
    if (result.error) throw new Error(`${w}: ${describeError(result.error)}`);
    s = result.state;
  }
  return s;
}

describe('input', () => {
  it('accepts letters up to five and ignores other keys', () => {
    let s = newGame(puzzle('stone'), false);
    s = typeWord(s, 'ab1cd!efg');
    expect(s.input).toBe('abcde');
    s = deleteLetter(s);
    expect(s.input).toBe('abcd');
  });

  it('normalizes uppercase letters', () => {
    expect(typeLetter(newGame(puzzle('stone'), false), 'Q').input).toBe('q');
  });
});

describe('invalid guesses', () => {
  it('rejects a guess shorter than five letters without using a turn', () => {
    const s = typeWord(newGame(puzzle('stone'), false), 'sto');
    const r = submitGuess(s);
    expect(r.error).toEqual({ kind: 'too-short' });
    expect(r.state.guesses).toHaveLength(0);
  });

  it('rejects five letters that are not in the word list', () => {
    const r = submitGuess(typeWord(newGame(puzzle('stone'), false), 'qzxvb'));
    expect(r.error).toEqual({ kind: 'not-in-list' });
    expect(r.state.input).toBe('qzxvb');
  });
});

describe('win and loss', () => {
  it('wins when the answer is guessed and stops accepting input', () => {
    const s = play(newGame(puzzle('stone'), false), 'crane', 'stone');
    expect(s.status).toBe('won');
    expect(typeLetter(s, 'a').input).toBe('');
    expect(submitGuess(s).state).toBe(s);
  });

  it('loses after six wrong guesses', () => {
    const s = play(newGame(puzzle('stone'), false), 'crane', 'about', 'month', 'light', 'drink', 'puppy');
    expect(s.status).toBe('lost');
    expect(s.guesses).toHaveLength(6);
  });

  it('wins on the sixth guess', () => {
    const s = play(newGame(puzzle('stone'), false), 'crane', 'about', 'month', 'light', 'drink', 'stone');
    expect(s.status).toBe('won');
  });
});

describe('hard mode', () => {
  it('requires correct letters to stay in place', () => {
    const s = play(newGame(puzzle('stone'), true), 'store');
    const r = submitGuess(typeWord(s, 'crane'));
    expect(r.error).toEqual({ kind: 'hard-position', position: 1, letter: 's' });
  });

  it('requires present letters to be reused', () => {
    const s = play(newGame(puzzle('stone'), true), 'onset');
    const r = submitGuess(typeWord(s, 'stack'));
    expect(r.error?.kind).toBe('hard-missing');
  });

  it('accepts a guess that honours every revealed hint', () => {
    const s = play(newGame(puzzle('stone'), true), 'store', 'stoke');
    expect(s.guesses).toEqual(['store', 'stoke']);
  });

  it('can only be toggled before the first guess', () => {
    const fresh = newGame(puzzle('stone'), false);
    expect(setHardMode(fresh, true).hardMode).toBe(true);
    const started = play(fresh, 'crane');
    expect(setHardMode(started, true).hardMode).toBe(false);
  });
});

describe('saved state', () => {
  it('restores an in-progress game exactly (refresh persistence)', () => {
    const s = typeWord(play(newGame(puzzleForDay(10), false), 'crane'), 'sto');
    const restored = fromSaved(JSON.parse(JSON.stringify(toSaved(s))));
    expect(restored).toEqual(s);
  });

  it('derives the answer from the puzzle id, ignoring any stored answer', () => {
    const saved = { ...toSaved(newGame(puzzleForDay(10), false)), answer: 'crane' };
    expect(fromSaved(saved)?.puzzle.answer).toBe(puzzleForDay(10).answer);
  });

  it('recomputes status instead of trusting stored values', () => {
    const p = puzzleForDay(3);
    const saved = { puzzleId: p.id, guesses: [p.answer], input: '', hardMode: false, status: 'lost' };
    expect(fromSaved(saved)?.status).toBe('won');
  });

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['an unknown puzzle version', { puzzleId: 'old-3', guesses: [], input: '', hardMode: false }],
    ['a missing puzzle id', { guesses: [], input: '', hardMode: false }],
    ['guesses that are not words', { puzzleId: puzzleForDay(1).id, guesses: ['zzzzz'], input: '', hardMode: false }],
    ['too many guesses', { puzzleId: puzzleForDay(1).id, guesses: Array(7).fill('crane'), input: '', hardMode: false }],
    ['bad input', { puzzleId: puzzleForDay(1).id, guesses: [], input: 'TOOLONG', hardMode: false }],
    ['a non-boolean hard mode', { puzzleId: puzzleForDay(1).id, guesses: [], input: '', hardMode: 'yes' }],
  ])('rejects %s', (_label, data) => {
    expect(fromSaved(data)).toBeNull();
  });

  it('rejects guesses recorded after a win', () => {
    const p = puzzleForDay(5);
    const other = p.answer === 'crane' ? 'stone' : 'crane';
    expect(fromSaved({ puzzleId: p.id, guesses: [p.answer, other], input: '', hardMode: false })).toBeNull();
  });
});
