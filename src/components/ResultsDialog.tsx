import { useState } from 'react';
import { formatCountdown } from '../format';
import type { GameState } from '../game/game';
import { nextRolloverAt } from '../game/puzzle';
import { shareText } from '../game/share';
import { currentStreak, type Stats } from '../game/stats';
import type { DefinitionState } from '../hooks/useDefinition';
import { Definition } from './Definition';
import { Dialog } from './Dialog';

interface ResultsDialogProps {
  open: boolean;
  onClose: () => void;
  game: GameState;
  stats: Stats;
  today: number;
  now: Date;
  definition: DefinitionState;
  onRetryDefinition: () => void;
}

type ShareState = { kind: 'idle' } | { kind: 'copied' } | { kind: 'manual'; text: string };

function ShareButton({ game }: { game: GameState }) {
  const [share, setShare] = useState<ShareState>({ kind: 'idle' });

  async function copy() {
    const text = shareText(game);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setShare({ kind: 'copied' });
    } catch {
      setShare({ kind: 'manual', text });
    }
  }

  return (
    <div className="share">
      <button type="button" className="primary-button" onClick={copy}>
        Copy result
      </button>
      <p className="share-status" role="status">
        {share.kind === 'copied' && 'Copied. The grid shows colors only, never letters.'}
        {share.kind === 'manual' && "Your browser blocked copying. Select the text below and copy it."}
      </p>
      {share.kind === 'manual' && (
        <textarea
          className="share-text"
          readOnly
          value={share.text}
          rows={share.text.split('\n').length}
          aria-label="Result to copy"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  );
}

export function ResultsDialog({ open, onClose, game, stats, today, now, definition, onRetryDefinition }: ResultsDialogProps) {
  const finished = game.status !== 'playing';
  const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxBar = Math.max(1, ...stats.distribution);
  const rollover = nextRolloverAt(now);
  const localRollover = rollover.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <Dialog open={open} title={finished ? `Puzzle ${game.puzzle.number}` : 'Statistics'} onClose={onClose}>
      {game.mode === 'archive' && (
        <p className="sheet-lede">This is an archive puzzle, so it isn’t counted in the statistics below.</p>
      )}
      {finished && (
        <div className="result">
          <p className="result-line">
            {game.status === 'won'
              ? `Solved in ${game.guesses.length} of 6${game.hardMode ? ', hard mode' : ''}.`
              : 'Out of guesses this time.'}
          </p>
          <p>
            The word was <strong className="result-word">{game.puzzle.answer.toUpperCase()}</strong>.
          </p>
          <Definition word={game.puzzle.answer} state={definition} onRetry={onRetryDefinition} />
          <ShareButton game={game} />
          <p className="countdown">
            Next puzzle in{' '}
            <time dateTime={rollover.toISOString()} className="countdown-time">
              {formatCountdown(rollover.getTime() - now.getTime())}
            </time>
            <span className="fine"> (00:00 UTC, {localRollover} your time)</span>
          </p>
        </div>
      )}

      <h3>{finished ? 'Your statistics' : 'Your record'}</h3>
      {stats.played === 0 ? (
        <p className="empty">No finished puzzles yet. Your record starts after your first game.</p>
      ) : (
        <>
          <dl className="stat-grid">
            <div>
              <dt>Played</dt>
              <dd>{stats.played}</dd>
            </div>
            <div>
              <dt>Win rate</dt>
              <dd>{winRate}%</dd>
            </div>
            <div>
              <dt>Current streak</dt>
              <dd>{currentStreak(stats, today)}</dd>
            </div>
            <div>
              <dt>Best streak</dt>
              <dd>{stats.maxStreak}</dd>
            </div>
          </dl>
          <h3>Wins by number of guesses</h3>
          <ol className="distribution">
            {stats.distribution.map((count, i) => {
              const isToday = game.status === 'won' && game.guesses.length === i + 1;
              return (
                <li key={i} className={isToday ? 'distribution-today' : undefined}>
                  <span className="distribution-label" aria-hidden="true">{i + 1}</span>
                  <span className="distribution-track" aria-hidden="true">
                    <span className="distribution-bar" style={{ width: `${Math.max(8, (count / maxBar) * 100)}%` }}>
                      {count}
                    </span>
                  </span>
                  <span className="visually-hidden">
                    {count} {count === 1 ? 'win' : 'wins'} in {i + 1} {i === 0 ? 'guess' : 'guesses'}
                    {isToday ? ', including today' : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Dialog>
  );
}
