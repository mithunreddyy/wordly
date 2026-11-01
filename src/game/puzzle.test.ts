import { describe, expect, it } from 'vitest';
import { ANSWERS_VERSION, dayIndex, nextRolloverAt, puzzleForDate, puzzleForDay, puzzleFromId } from './puzzle';
import { ANSWERS } from './words';

describe('puzzle dates (UTC boundary)', () => {
  it('starts at day 0 on the epoch', () => {
    expect(dayIndex(new Date('2026-01-01T00:00:00Z'))).toBe(0);
    expect(puzzleForDate(new Date('2026-01-01T12:00:00Z')).number).toBe(1);
  });

  it('keeps the same puzzle until the last millisecond of the UTC day', () => {
    const start = puzzleForDate(new Date('2026-11-01T00:00:00.000Z'));
    const end = puzzleForDate(new Date('2026-11-01T23:59:59.999Z'));
    expect(end.id).toBe(start.id);
    expect(end.answer).toBe(start.answer);
  });

  it('advances exactly at 00:00 UTC', () => {
    const before = puzzleForDate(new Date('2026-11-01T23:59:59.999Z'));
    const after = puzzleForDate(new Date('2026-11-02T00:00:00.000Z'));
    expect(after.day).toBe(before.day + 1);
  });

  it('gives players in different timezones the same puzzle at the same instant', () => {
    // 2026-11-01 20:30 in New York and 2026-11-02 09:30 in Tokyo are the same moment.
    const ny = new Date('2026-11-01T20:30:00-04:00');
    const tokyo = new Date('2026-11-02T09:30:00+09:00');
    expect(puzzleForDate(ny).id).toBe(puzzleForDate(tokyo).id);
  });

  it('reports the next rollover as the following UTC midnight', () => {
    expect(nextRolloverAt(new Date('2026-11-01T17:45:00Z')).toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(nextRolloverAt(new Date('2026-11-02T00:00:00Z')).toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });

  it('clamps dates before the epoch to the first puzzle', () => {
    expect(puzzleForDate(new Date('2025-06-01T00:00:00Z')).day).toBe(0);
  });
});

describe('answer selection', () => {
  it('is deterministic and drawn from the curated answer list', () => {
    const a = puzzleForDay(305);
    const b = puzzleForDay(305);
    expect(a).toEqual(b);
    expect(ANSWERS).toContain(a.answer);
  });

  it('does not repeat an answer within one full cycle of the list', () => {
    const seen = new Set<string>();
    for (let day = 0; day < ANSWERS.length; day++) seen.add(puzzleForDay(day).answer);
    expect(seen.size).toBe(ANSWERS.length);
  });

  it('is not simply alphabetical', () => {
    const firstTen = Array.from({ length: 10 }, (_, d) => puzzleForDay(d).answer);
    expect(firstTen).not.toEqual([...firstTen].sort());
  });
});

describe('puzzle ids', () => {
  it('round-trips a versioned id', () => {
    const p = puzzleForDay(42);
    expect(p.id).toBe(`${ANSWERS_VERSION}-42`);
    expect(puzzleFromId(p.id)).toEqual(p);
  });

  it('rejects ids from another list version or malformed ids', () => {
    expect(puzzleFromId('zz-42')).toBeNull();
    expect(puzzleFromId(`${ANSWERS_VERSION}--1`)).toBeNull();
    expect(puzzleFromId(`${ANSWERS_VERSION}-4.2`)).toBeNull();
    expect(puzzleFromId(42)).toBeNull();
    expect(puzzleFromId(null)).toBeNull();
  });
});
