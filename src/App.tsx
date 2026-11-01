import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArchiveDialog } from './components/ArchiveDialog';
import { Board } from './components/Board';
import { Header, type Panel } from './components/Header';
import { Keyboard } from './components/Keyboard';
import { ResultsDialog } from './components/ResultsDialog';
import { RulesDialog } from './components/RulesDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { StatusLine } from './components/StatusLine';
import { describeGuess } from './format';
import {
  deleteLetter,
  describeError,
  newGame,
  setHardMode,
  submitGuess,
  typeLetter,
  type GameState,
} from './game/game';
import { puzzleForDate, puzzleForDay } from './game/puzzle';
import { WORD_LENGTH, letterHints } from './game/score';
import { recordResult, type Stats } from './game/stats';
import { useDefinition } from './hooks/useDefinition';
import { useNow } from './hooks/useNow';
import { useReducedMotion } from './hooks/useReducedMotion';
import {
  emptyStats,
  loadActiveId,
  loadLibrary,
  loadSettings,
  loadStats,
  saveActiveId,
  saveLibrary,
  saveSettings,
  saveStats,
  type Library,
  type Settings,
} from './storage/storage';

const REVEAL_STEP_MS = 220;
const REVEAL_MS = REVEAL_STEP_MS * (WORD_LENGTH - 1) + 380;

interface Boot {
  library: Library;
  activeId: string;
  stats: Stats;
  settings: Settings;
  notices: string[];
}

/** Daily results count toward stats; archive replays never do. */
function withResult(stats: Stats, game: GameState): Stats {
  if (game.mode !== 'daily' || game.status === 'playing') return stats;
  return recordResult(stats, game.puzzle.day, game.status === 'won', game.guesses.length);
}

/**
 * Picks the puzzle to show on load. An unfinished game the player left open (an
 * archive replay, or yesterday's daily puzzle past midnight) is resumed; its
 * answer comes from its own id, so a refresh never swaps the word.
 */
function boot(now: Date): Boot {
  const settings = loadSettings();
  const today = puzzleForDate(now);
  const notices: string[] = [];

  const loadedStats = loadStats();
  if (loadedStats.kind === 'corrupt') notices.push("Your saved statistics couldn't be read, so they were reset.");
  let stats = loadedStats.kind === 'ok' ? loadedStats.value : emptyStats();

  const { games, damaged } = loadLibrary();
  if (damaged) notices.push("Some saved progress couldn't be read and was skipped.");
  const library: Library = { ...games };

  const last = loadActiveId();
  const lastGame = last ? library[last] : undefined;
  const resume =
    lastGame !== undefined &&
    lastGame.puzzle.day <= today.day &&
    lastGame.status === 'playing' &&
    (lastGame.mode === 'archive' || lastGame.guesses.length > 0);

  const activeId = resume ? lastGame.puzzle.id : today.id;
  if (!library[activeId]) library[activeId] = newGame(today, settings.hardMode);

  // Covers a daily game that finished but whose stats never got saved.
  const recorded = withResult(stats, library[activeId]!);
  if (recorded !== stats) {
    saveStats(recorded);
    stats = recorded;
  }
  return { library, activeId, stats, settings, notices };
}

export default function App() {
  const now = useNow();
  const reducedMotion = useReducedMotion();
  const [initial] = useState(() => boot(new Date()));
  const [library, setLibrary] = useState(initial.library);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [stats, setStats] = useState(initial.stats);
  const [settings, setSettings] = useState(initial.settings);
  const [notices, setNotices] = useState(initial.notices);
  const [panel, setPanel] = useState<Panel | null>(initial.settings.seenRules ? null : 'rules');
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [archiveOpens, setArchiveOpens] = useState(0);
  const storageWarned = useRef(false);
  const resultsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const game = library[activeId]!;
  const today = puzzleForDate(now);
  const newPuzzleReady = game.mode === 'daily' && today.day > game.puzzle.day;
  const finished = game.status !== 'playing';
  const revealing = revealRow !== null && !reducedMotion;
  const { state: definition, retry: retryDefinition } = useDefinition(finished ? game.puzzle.answer : null);

  useEffect(() => {
    const ok = saveLibrary(library) && saveActiveId(activeId);
    if (!ok && !storageWarned.current) {
      storageWarned.current = true;
      setNotices((n) => [...n, "This browser isn't saving progress (storage is blocked or full). You can still play."]);
    }
  }, [library, activeId]);

  useEffect(() => {
    saveSettings(settings);
    const root = document.documentElement;
    if (settings.highContrast) root.dataset.contrast = 'high';
    else delete root.dataset.contrast;
  }, [settings]);

  useEffect(() => {
    if (revealRow === null) return;
    const id = setTimeout(() => setRevealRow(null), reducedMotion ? 0 : REVEAL_MS);
    return () => clearTimeout(id);
  }, [revealRow, reducedMotion]);

  useEffect(() => () => clearTimeout(resultsTimer.current), []);

  const updateGame = useCallback(
    (change: (g: GameState) => GameState) => setLibrary((lib) => ({ ...lib, [activeId]: change(lib[activeId]!) })),
    [activeId],
  );

  const onLetter = useCallback(
    (letter: string) => {
      setError(null);
      updateGame((g) => typeLetter(g, letter));
    },
    [updateGame],
  );

  const onDelete = useCallback(() => {
    setError(null);
    updateGame((g) => deleteLetter(g));
  }, [updateGame]);

  const onEnter = useCallback(() => {
    const { state: next, error: problem } = submitGuess(game);
    if (problem) {
      const text = describeError(problem);
      setError(text);
      setAnnouncement(text);
      setShakeKey((k) => k + 1);
      return;
    }
    if (next === game) return;
    setError(null);
    setLibrary((lib) => ({ ...lib, [next.puzzle.id]: next }));
    setRevealRow(next.guesses.length - 1);

    const guess = next.guesses[next.guesses.length - 1]!;
    let line = `Guess ${next.guesses.length}: ${describeGuess(guess, next.puzzle.answer)}.`;
    if (next.status === 'won') line += ` Solved in ${next.guesses.length}.`;
    if (next.status === 'lost') line += ` Out of guesses. The word was ${next.puzzle.answer.toUpperCase()}.`;
    setAnnouncement(line);

    if (next.status !== 'playing') {
      const recorded = withResult(stats, next);
      if (recorded !== stats) {
        saveStats(recorded);
        setStats(recorded);
      }
      clearTimeout(resultsTimer.current);
      resultsTimer.current = setTimeout(() => setPanel('results'), reducedMotion ? 300 : REVEAL_MS + 500);
    }
  }, [game, stats, reducedMotion]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.repeat && e.key === 'Enter')) return;
      if (document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      // Let Enter and Space activate a focused button natively.
      if ((e.key === 'Enter' || e.key === ' ') && target?.closest('button, a')) return;

      const editing = e.key === 'Backspace' || /^[a-zA-Z]$/.test(e.key);
      // Typing means the player is back on the puzzle. Drop focus from a menu
      // button (e.g. where it lands after a dialog closes) so Enter submits.
      if (editing && target instanceof HTMLElement && target.closest('button, a')) target.blur();

      if (e.key === 'Enter') {
        e.preventDefault();
        onEnter();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        onDelete();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        onLetter(e.key);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEnter, onDelete, onLetter]);

  const hints = useMemo(() => {
    // Keep keyboard hints hidden until the row's tiles have finished firing.
    const visible = revealing ? game.guesses.slice(0, -1) : game.guesses;
    return letterHints(visible, game.puzzle.answer);
  }, [game.guesses, game.puzzle.answer, revealing]);

  function openPuzzle(day: number) {
    const puzzle = puzzleForDay(day);
    const isToday = day === today.day;
    setLibrary((lib) => {
      const existing = lib[puzzle.id];
      // A past daily puzzle that was never started becomes an archive game, so it can't count toward stats late.
      const untouchedPastDaily = existing?.mode === 'daily' && !isToday && existing.guesses.length === 0;
      if (existing && !untouchedPastDaily) return lib;
      return { ...lib, [puzzle.id]: newGame(puzzle, settings.hardMode, isToday ? 'daily' : 'archive') };
    });
    setActiveId(puzzle.id);
    setRevealRow(null);
    setError(null);
    clearTimeout(resultsTimer.current);
    setPanel(null);
    setAnnouncement(`Puzzle ${puzzle.number}${isToday ? ', today' : ', from the archive'}.`);
  }

  function openPanel(next: Panel) {
    if (next === 'archive') setArchiveOpens((n) => n + 1);
    setPanel(next);
  }

  function changeSettings(patch: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...patch }));
    if (patch.hardMode !== undefined) updateGame((g) => setHardMode(g, patch.hardMode!));
  }

  function closePanel() {
    if (panel === 'rules' && !settings.seenRules) setSettings((s) => ({ ...s, seenRules: true }));
    setPanel(null);
  }

  const hardModeLocked = game.status === 'playing' && game.guesses.length > 0;

  return (
    <div className="app">
      <Header game={game} onOpen={openPanel} onBackToToday={() => openPuzzle(today.day)} />

      <main className="play">
        {newPuzzleReady && (
          <div className="banner" role="status">
            <p>
              {finished
                ? `Puzzle ${today.number} is ready.`
                : `Puzzle ${today.number} is out. Finish No. ${game.puzzle.number} first, or switch now and leave it unfinished.`}
            </p>
            <button type="button" className="primary-button" onClick={() => openPuzzle(today.day)}>
              Play No. {today.number}
            </button>
          </div>
        )}

        {notices.map((text, i) => (
          <div className="banner banner-notice" role="alert" key={text}>
            <p>{text}</p>
            <button type="button" className="text-button" onClick={() => setNotices((n) => n.filter((_, j) => j !== i))}>
              Dismiss
            </button>
          </div>
        ))}

        <div className="board-wrap">
          <Board
            guesses={game.guesses}
            input={game.input}
            answer={game.puzzle.answer}
            revealRow={reducedMotion ? null : revealRow}
            shakeKey={reducedMotion ? 0 : shakeKey}
            rejected={error !== null}
          />
          <StatusLine game={game} error={error} revealing={revealing} onShowResults={() => setPanel('results')} />
        </div>

        <p className="visually-hidden" aria-live="polite">
          {announcement}
        </p>
      </main>

      <Keyboard hints={hints} disabled={finished} onLetter={onLetter} onEnter={onEnter} onDelete={onDelete} />

      <RulesDialog open={panel === 'rules'} onClose={closePanel} />
      <ArchiveDialog
        key={archiveOpens}
        open={panel === 'archive'}
        onClose={closePanel}
        today={today}
        library={library}
        activeId={activeId}
        onPick={openPuzzle}
      />
      <ResultsDialog
        open={panel === 'results'}
        onClose={closePanel}
        game={game}
        stats={stats}
        today={today.day}
        now={now}
        definition={definition}
        onRetryDefinition={retryDefinition}
      />
      <SettingsDialog
        open={panel === 'settings'}
        onClose={closePanel}
        settings={{ ...settings, hardMode: finished ? settings.hardMode : game.hardMode }}
        hardModeLocked={hardModeLocked}
        onChange={changeSettings}
      />
    </div>
  );
}
