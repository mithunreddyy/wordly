import { ANSWERS } from './words';

/**
 * Puzzle days roll over at 00:00 UTC so every player worldwide has the same
 * answer at the same moment, whatever their local timezone.
 */
export const PUZZLE_EPOCH_UTC = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Identifies the answer list ordering. Bump it whenever answers.json or the
 * shuffle seed changes, so saved games from an older list are rejected instead
 * of silently resolving to a different word.
 */
export const ANSWERS_VERSION = 'a1';
const SHUFFLE_SEED = 0x5eed_2026;

export interface Puzzle {
  id: string;
  day: number;
  number: number;
  answer: string;
}

export function dayIndex(now: Date): number {
  return Math.floor((now.getTime() - PUZZLE_EPOCH_UTC) / DAY_MS);
}

export function nextRolloverAt(now: Date): Date {
  return new Date(PUZZLE_EPOCH_UTC + (dayIndex(now) + 1) * DAY_MS);
}

// mulberry32: small deterministic PRNG so the answer order is fixed per release.
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let order: readonly string[] | null = null;
function answerOrder(): readonly string[] {
  if (!order) {
    const shuffled = [...ANSWERS];
    const rand = seededRandom(SHUFFLE_SEED);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    order = shuffled;
  }
  return order;
}

export function puzzleForDay(day: number): Puzzle {
  if (!Number.isSafeInteger(day) || day < 0) {
    throw new RangeError(`Invalid puzzle day: ${day}`);
  }
  const list = answerOrder();
  return {
    id: `${ANSWERS_VERSION}-${day}`,
    day,
    number: day + 1,
    answer: list[day % list.length]!,
  };
}

export function puzzleForDate(now: Date): Puzzle {
  return puzzleForDay(Math.max(0, dayIndex(now)));
}

/** Resolves a stored puzzle id. Returns null for ids from another list version or malformed ids. */
export function puzzleFromId(id: unknown): Puzzle | null {
  if (typeof id !== 'string') return null;
  const match = /^([a-z0-9]+)-(\d{1,7})$/.exec(id);
  if (!match || match[1] !== ANSWERS_VERSION) return null;
  return puzzleForDay(Number(match[2]));
}
