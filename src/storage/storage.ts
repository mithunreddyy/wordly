import { fromSaved, toSaved, type GameState } from '../game/game';
import { emptyStats, parseStats, type Stats } from '../game/stats';

const PREFIX = 'wordly:v1:';
export const KEYS = {
  /** Single-game save from before the archive existed; read once for migration. */
  legacyGame: `${PREFIX}game`,
  games: 'wordly:v2:games',
  active: 'wordly:v2:active',
  stats: `${PREFIX}stats`,
  settings: `${PREFIX}settings`,
  dictionary: `${PREFIX}dictionary`,
} as const;

/** Distinguishes "nothing saved" from "saved data was unreadable" so the UI can say which. */
export type Loaded<T> = { kind: 'ok'; value: T } | { kind: 'empty' } | { kind: 'corrupt' };

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Some browsers throw on access when site data is blocked.
    return null;
  }
}

export function readJson(key: string): Loaded<unknown> {
  const storage = getStorage();
  if (!storage) return { kind: 'empty' };
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { kind: 'empty' };
  }
  if (raw === null) return { kind: 'empty' };
  try {
    return { kind: 'ok', value: JSON.parse(raw) as unknown };
  } catch {
    return { kind: 'corrupt' };
  }
}

/** Returns false when storage is unavailable or full; callers keep working in memory. */
export function writeJson(key: string, value: unknown): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function parseWith<T>(loaded: Loaded<unknown>, parse: (data: unknown) => T | null): Loaded<T> {
  if (loaded.kind !== 'ok') return loaded;
  const value = parse(loaded.value);
  return value === null ? { kind: 'corrupt' } : { kind: 'ok', value };
}

export type Library = Record<string, GameState>;

export interface LoadedLibrary {
  games: Library;
  /** Some saved data was unreadable and was dropped. */
  damaged: boolean;
}

/**
 * Every puzzle the player has touched, keyed by puzzle id. Each entry is
 * validated on its own, so one bad record does not cost the rest.
 */
export function loadLibrary(): LoadedLibrary {
  const games: Library = {};
  let damaged = false;

  const stored = readJson(KEYS.games);
  if (stored.kind === 'corrupt') damaged = true;
  if (stored.kind === 'ok') {
    const record = stored.value;
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      damaged = true;
    } else {
      for (const [id, raw] of Object.entries(record)) {
        const game = fromSaved(raw);
        if (game && game.puzzle.id === id) games[id] = game;
        else damaged = true;
      }
    }
  }

  const legacy = parseWith(readJson(KEYS.legacyGame), fromSaved);
  if (legacy.kind === 'corrupt') damaged = true;
  if (legacy.kind === 'ok' && !games[legacy.value.puzzle.id]) games[legacy.value.puzzle.id] = legacy.value;

  return { games, damaged };
}

export function saveLibrary(games: Library): boolean {
  const record: Record<string, ReturnType<typeof toSaved>> = {};
  for (const [id, game] of Object.entries(games)) record[id] = toSaved(game);
  return writeJson(KEYS.games, record);
}

export function loadActiveId(): string | null {
  const loaded = readJson(KEYS.active);
  return loaded.kind === 'ok' && typeof loaded.value === 'string' ? loaded.value : null;
}

export const saveActiveId = (id: string): boolean => writeJson(KEYS.active, id);

export function loadStats(): Loaded<Stats> {
  return parseWith(readJson(KEYS.stats), parseStats);
}
export const saveStats = (stats: Stats): boolean => writeJson(KEYS.stats, stats);
export { emptyStats };

export interface Settings {
  hardMode: boolean;
  highContrast: boolean;
  /** The rules open automatically until the player has seen them once. */
  seenRules: boolean;
}

export const DEFAULT_SETTINGS: Settings = { hardMode: false, highContrast: false, seenRules: false };

/** Settings are low stakes, so each valid field is kept and anything else falls back to its default. */
export function parseSettings(data: unknown): Settings {
  if (typeof data !== 'object' || data === null) return DEFAULT_SETTINGS;
  const r = data as Record<string, unknown>;
  return {
    hardMode: typeof r.hardMode === 'boolean' ? r.hardMode : DEFAULT_SETTINGS.hardMode,
    highContrast: typeof r.highContrast === 'boolean' ? r.highContrast : DEFAULT_SETTINGS.highContrast,
    seenRules: typeof r.seenRules === 'boolean' ? r.seenRules : DEFAULT_SETTINGS.seenRules,
  };
}

export function loadSettings(): Settings {
  const loaded = readJson(KEYS.settings);
  return loaded.kind === 'ok' ? parseSettings(loaded.value) : DEFAULT_SETTINGS;
}
export const saveSettings = (settings: Settings): boolean => writeJson(KEYS.settings, settings);
