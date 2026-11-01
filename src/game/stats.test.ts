import { describe, expect, it } from 'vitest';
import { currentStreak, emptyStats, parseStats, recordResult } from './stats';

describe('recordResult', () => {
  it('counts wins, streaks, and the guess distribution', () => {
    let s = recordResult(emptyStats(), 10, true, 3);
    s = recordResult(s, 11, true, 4);
    expect(s).toMatchObject({ played: 2, won: 2, streak: 2, maxStreak: 2 });
    expect(s.distribution).toEqual([0, 0, 1, 1, 0, 0]);
  });

  it('restarts the streak after a skipped day and resets it on a loss', () => {
    let s = recordResult(emptyStats(), 10, true, 3);
    s = recordResult(s, 12, true, 3);
    expect(s.streak).toBe(1);
    s = recordResult(s, 13, false, 6);
    expect(s).toMatchObject({ streak: 0, maxStreak: 1, played: 3, won: 2 });
  });

  it('records each puzzle day only once', () => {
    const once = recordResult(emptyStats(), 10, true, 3);
    expect(recordResult(once, 10, true, 3)).toBe(once);
    expect(recordResult(once, 9, false, 6)).toBe(once);
  });
});

describe('currentStreak', () => {
  it('shows the streak while yesterday or today was won, and 0 after a missed day', () => {
    const s = recordResult(recordResult(emptyStats(), 10, true, 2), 11, true, 2);
    expect(currentStreak(s, 11)).toBe(2);
    expect(currentStreak(s, 12)).toBe(2);
    expect(currentStreak(s, 13)).toBe(0);
  });
});

describe('parseStats', () => {
  it('accepts stats it produced', () => {
    const s = recordResult(emptyStats(), 4, true, 5);
    expect(parseStats(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it.each([
    ['null', null],
    ['negative counts', { ...emptyStats(), played: -1 }],
    ['wins above played', { ...emptyStats(), won: 2, played: 1, distribution: [2, 0, 0, 0, 0, 0] }],
    ['a short distribution', { ...emptyStats(), distribution: [0, 0] }],
    ['a distribution that disagrees with wins', { ...emptyStats(), played: 1, won: 1 }],
    ['fractional days', { ...emptyStats(), lastWonDay: 1.5 }],
  ])('rejects %s', (_label, data) => {
    expect(parseStats(data)).toBeNull();
  });
});
