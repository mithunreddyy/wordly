import { useState, type CSSProperties } from 'react';
import { PUZZLE_EPOCH_UTC, dayIndex, puzzleForDay, type Puzzle } from '../game/puzzle';
import type { Library } from '../storage/storage';
import { Dialog } from './Dialog';
import { ChevronLeft, ChevronRight } from './Icons';

interface ArchiveDialogProps {
  open: boolean;
  onClose: () => void;
  today: Puzzle;
  library: Library;
  activeId: string;
  onPick: (day: number) => void;
}

interface MonthKey {
  year: number;
  month: number;
}

const EPOCH = new Date(PUZZLE_EPOCH_UTC);
const monthOf = (d: Date): MonthKey => ({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
const monthIndex = (m: MonthKey) => m.year * 12 + m.month;
const dateForDay = (day: number) => new Date(PUZZLE_EPOCH_UTC + day * 86_400_000);

const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const weekdayShort = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
// 2024-01-01 was a Monday; the grid starts weeks on Monday.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => weekdayShort.format(new Date(Date.UTC(2024, 0, 1 + i))));

function describe(library: Library, day: number): { state: string; label: string; guesses?: number } {
  const game = library[puzzleForDay(day).id];
  if (!game) return { state: 'unplayed', label: 'not played' };
  if (game.status === 'won') {
    const n = game.guesses.length;
    return { state: 'won', label: `solved in ${n} ${n === 1 ? 'guess' : 'guesses'}`, guesses: n };
  }
  if (game.status === 'lost') return { state: 'lost', label: 'not solved' };
  if (game.guesses.length > 0) return { state: 'started', label: `in progress, ${game.guesses.length} of 6 guesses used` };
  return { state: 'unplayed', label: 'not played' };
}

export function ArchiveDialog({ open, onClose, today, library, activeId, onPick }: ArchiveDialogProps) {
  const current = monthOf(dateForDay(today.day));
  const activeDay = Number(activeId.split('-')[1]);
  // Opens on the month of the puzzle being played; the parent remounts this on every open.
  const [shown, setShown] = useState<MonthKey>(() =>
    Number.isSafeInteger(activeDay) && activeDay <= today.day ? monthOf(dateForDay(activeDay)) : current,
  );
  const first = monthOf(EPOCH);
  const canBack = monthIndex(shown) > monthIndex(first);
  const canForward = monthIndex(shown) < monthIndex(current);

  const firstOfMonth = new Date(Date.UTC(shown.year, shown.month, 1));
  const daysInMonth = new Date(Date.UTC(shown.year, shown.month + 1, 0)).getUTCDate();
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7;

  const solved = Object.values(library).filter((g) => g.status === 'won').length;
  const available = today.day + 1;

  function shift(by: number) {
    const i = monthIndex(shown) + by;
    setShown({ year: Math.floor(i / 12), month: i % 12 });
  }

  return (
    <Dialog open={open} title="Archive" onClose={onClose}>
      <p className="sheet-lede">
        Play any earlier puzzle. Archive games don’t change your streak or statistics.
      </p>
      <p className="archive-summary">
        {solved === 0
          ? `${available} puzzles so far. None solved yet.`
          : `Solved ${solved} of ${available} puzzles so far.`}
      </p>

      <div className="month-bar">
        <button type="button" className="icon-button" onClick={() => shift(-1)} disabled={!canBack} aria-label="Previous month">
          <ChevronLeft />
        </button>
        <h3 aria-live="polite">{monthName.format(firstOfMonth)}</h3>
        <button type="button" className="icon-button" onClick={() => shift(1)} disabled={!canForward} aria-label="Next month">
          <ChevronRight />
        </button>
      </div>

      <div className="calendar" role="group" aria-label={`Puzzles in ${monthName.format(firstOfMonth)}`}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="calendar-weekday" aria-hidden="true">
            {w}
          </span>
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = new Date(Date.UTC(shown.year, shown.month, i + 1));
          const day = dayIndex(date);
          const style = i === 0 ? ({ gridColumnStart: leadingBlanks + 1 } as CSSProperties) : undefined;
          if (day < 0 || day > today.day) {
            return (
              <span key={i} className="calendar-day calendar-future" style={style} aria-hidden="true">
                {i + 1}
              </span>
            );
          }
          const info = describe(library, day);
          const puzzle = puzzleForDay(day);
          const isToday = day === today.day;
          const isActive = puzzle.id === activeId;
          return (
            <button
              key={i}
              type="button"
              style={style}
              className={`calendar-day calendar-${info.state}${isToday ? ' calendar-today' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              aria-label={`${longDate.format(date)}${isToday ? ', today' : ''}: puzzle ${puzzle.number}, ${info.label}`}
              onClick={() => onPick(day)}
            >
              <span className="calendar-date">{i + 1}</span>
              {info.guesses !== undefined && <span className="calendar-score">{info.guesses}</span>}
            </button>
          );
        })}
      </div>

      <ul className="calendar-key" aria-label="Key">
        <li>
          <span className="calendar-swatch calendar-won" aria-hidden="true" /> Solved (number of guesses)
        </li>
        <li>
          <span className="calendar-swatch calendar-lost" aria-hidden="true" /> Not solved
        </li>
        <li>
          <span className="calendar-swatch calendar-started" aria-hidden="true" /> In progress
        </li>
      </ul>
    </Dialog>
  );
}
