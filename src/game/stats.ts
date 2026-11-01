import { MAX_GUESSES } from './score';

export interface Stats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  /** distribution[i] counts wins in i + 1 guesses. */
  distribution: number[];
  lastWonDay: number | null;
  lastRecordedDay: number | null;
}

export function emptyStats(): Stats {
  return {
    played: 0,
    won: 0,
    streak: 0,
    maxStreak: 0,
    distribution: Array.from({ length: MAX_GUESSES }, () => 0),
    lastWonDay: null,
    lastRecordedDay: null,
  };
}

/** Records one finished puzzle. Each puzzle day counts once, even if the result is replayed. */
export function recordResult(stats: Stats, day: number, won: boolean, guessCount: number): Stats {
  if (stats.lastRecordedDay !== null && day <= stats.lastRecordedDay) return stats;

  const next: Stats = { ...stats, distribution: [...stats.distribution], lastRecordedDay: day };
  next.played += 1;
  if (won) {
    next.won += 1;
    next.streak = stats.lastWonDay === day - 1 ? stats.streak + 1 : 1;
    next.maxStreak = Math.max(stats.maxStreak, next.streak);
    next.lastWonDay = day;
    const slot = Math.min(Math.max(guessCount, 1), MAX_GUESSES) - 1;
    next.distribution[slot] = (next.distribution[slot] ?? 0) + 1;
  } else {
    next.streak = 0;
  }
  return next;
}

/** A streak is only live while yesterday's or today's puzzle was won. */
export function currentStreak(stats: Stats, today: number): number {
  if (stats.lastWonDay === null || stats.lastWonDay < today - 1) return 0;
  return stats.streak;
}

const nonNegativeInt = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const dayOrNull = (v: unknown): v is number | null => v === null || nonNegativeInt(v);

export function parseStats(data: unknown): Stats | null {
  if (typeof data !== 'object' || data === null) return null;
  const r = data as Record<string, unknown>;
  if (![r.played, r.won, r.streak, r.maxStreak].every(nonNegativeInt)) return null;
  if (!dayOrNull(r.lastWonDay) || !dayOrNull(r.lastRecordedDay)) return null;
  if (!Array.isArray(r.distribution) || r.distribution.length !== MAX_GUESSES) return null;
  if (!r.distribution.every(nonNegativeInt)) return null;

  const stats: Stats = {
    played: r.played as number,
    won: r.won as number,
    streak: r.streak as number,
    maxStreak: r.maxStreak as number,
    distribution: r.distribution as number[],
    lastWonDay: r.lastWonDay,
    lastRecordedDay: r.lastRecordedDay,
  };
  const winsInDistribution = stats.distribution.reduce((a, b) => a + b, 0);
  if (stats.won > stats.played || winsInDistribution !== stats.won || stats.streak > stats.maxStreak) {
    return null;
  }
  return stats;
}
