import { describe, expect, it } from 'vitest';
import { letterHints, scoreGuess } from './score';

const short = (s: ReturnType<typeof scoreGuess>) =>
  s.map((x) => (x === 'correct' ? 'C' : x === 'present' ? 'P' : '.')).join('');

describe('scoreGuess', () => {
  it('marks a full match as all correct', () => {
    expect(short(scoreGuess('sheep', 'sheep'))).toBe('CCCCC');
  });

  it('marks letters in the wrong spot as present', () => {
    expect(short(scoreGuess('heart', 'earth'))).toBe('PPPPP');
  });

  it('marks letters not in the answer as absent', () => {
    expect(short(scoreGuess('bumpy', 'sheet'))).toBe('.....');
  });

  it('mixes exact and misplaced matches', () => {
    expect(short(scoreGuess('stare', 'start'))).toBe('CCCC.');
    expect(short(scoreGuess('crane', 'react'))).toBe('PPC.P');
  });

  it('does not report a repeated guess letter beyond the answer count', () => {
    // One E in "spend": the exact E claims it, so the second guess E is absent.
    expect(short(scoreGuess('sheep', 'spend'))).toBe('C.C.P');
    // Two Es in "rebel": one exact, one left over for the first guess E only.
    expect(short(scoreGuess('eerie', 'rebel'))).toBe('PCP..');
  });

  it('gives exact matches priority over earlier misplaced copies', () => {
    // "those" has one E, at the end. The exact final E claims it before the
    // earlier guess Es are considered, so they stay absent.
    expect(short(scoreGuess('geese', 'those'))).toBe('...CC');
    expect(short(scoreGuess('geese', 'lever'))).toBe('.CP..');
  });

  it('reports each repeated answer letter when the guess has enough copies', () => {
    expect(short(scoreGuess('speed', 'erase'))).toBe('P.PP.');
  });

  it('rejects mismatched lengths', () => {
    expect(() => scoreGuess('four', 'fiver')).toThrow();
  });
});

describe('letterHints', () => {
  it('keeps the strongest status seen for each letter', () => {
    const hints = letterHints(['stare', 'start'], 'start');
    expect(hints.get('t')).toBe('correct');
    expect(hints.get('e')).toBe('absent');
  });
});
