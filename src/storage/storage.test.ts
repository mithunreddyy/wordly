import { afterEach, describe, expect, it, vi } from 'vitest';
import { newGame, toSaved, typeLetter } from '../game/game';
import { puzzleForDay } from '../game/puzzle';
import { recordResult, emptyStats } from '../game/stats';
import {
  DEFAULT_SETTINGS,
  KEYS,
  loadActiveId,
  loadLibrary,
  loadSettings,
  loadStats,
  saveActiveId,
  saveLibrary,
  saveStats,
} from './storage';

afterEach(() => vi.restoreAllMocks());

describe('game library', () => {
  it('is empty and undamaged when nothing is saved', () => {
    expect(loadLibrary()).toEqual({ games: {}, damaged: false });
  });

  it('round-trips daily and archive games', () => {
    const daily = typeLetter(newGame(puzzleForDay(7), true), 'a');
    const archive = newGame(puzzleForDay(3), false, 'archive');
    saveLibrary({ [daily.puzzle.id]: daily, [archive.puzzle.id]: archive });
    expect(loadLibrary()).toEqual({ games: { [daily.puzzle.id]: daily, [archive.puzzle.id]: archive }, damaged: false });
  });

  it('keeps valid entries and flags the damage when one entry is bad', () => {
    const good = newGame(puzzleForDay(2), false);
    localStorage.setItem(
      KEYS.games,
      JSON.stringify({ [good.puzzle.id]: toSaved(good), 'a1-9': { puzzleId: 'a1-9', guesses: 'nope' } }),
    );
    expect(loadLibrary()).toEqual({ games: { [good.puzzle.id]: good }, damaged: true });
  });

  it('rejects an entry filed under the wrong puzzle id', () => {
    const game = newGame(puzzleForDay(2), false);
    localStorage.setItem(KEYS.games, JSON.stringify({ 'a1-5': toSaved(game) }));
    expect(loadLibrary()).toEqual({ games: {}, damaged: true });
  });

  it('reports damage for invalid JSON', () => {
    localStorage.setItem(KEYS.games, '{not json');
    expect(loadLibrary().damaged).toBe(true);
  });

  it('migrates a v1 single-game save as a daily game', () => {
    const p = puzzleForDay(4);
    localStorage.setItem(KEYS.legacyGame, JSON.stringify({ puzzleId: p.id, guesses: [], input: 'ab', hardMode: false }));
    const { games } = loadLibrary();
    expect(games[p.id]).toMatchObject({ input: 'ab', mode: 'daily' });
  });

  it('round-trips the active puzzle id', () => {
    expect(loadActiveId()).toBeNull();
    saveActiveId('a1-12');
    expect(loadActiveId()).toBe('a1-12');
  });

  it('keeps working when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(loadLibrary()).toEqual({ games: {}, damaged: false });
    expect(saveLibrary({})).toBe(false);
  });
});

describe('stats storage', () => {
  it('round-trips stats and rejects tampered ones', () => {
    const s = recordResult(emptyStats(), 3, true, 2);
    saveStats(s);
    expect(loadStats()).toEqual({ kind: 'ok', value: s });
    localStorage.setItem(KEYS.stats, JSON.stringify({ ...s, won: 99 }));
    expect(loadStats()).toEqual({ kind: 'corrupt' });
  });
});

describe('settings storage', () => {
  it('falls back field by field and ignores the retired theme field', () => {
    localStorage.setItem(KEYS.settings, JSON.stringify({ hardMode: true, theme: 'dark', highContrast: 1 }));
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, hardMode: true });
    localStorage.setItem(KEYS.settings, 'garbage');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
