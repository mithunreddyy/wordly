import type { ReactNode } from 'react';
import type { GameState } from '../game/game';
import { PUZZLE_EPOCH_UTC } from '../game/puzzle';
import { ArchiveIcon, RulesIcon, SettingsIcon, StatsIcon } from './Icons';

const puzzleDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

export type Panel = 'rules' | 'archive' | 'results' | 'settings';

interface HeaderProps {
  game: GameState;
  onOpen: (panel: Panel) => void;
  onBackToToday: () => void;
}

function ToolButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="tool-button" aria-label={label} title={label} onClick={onClick}>
      {icon}
    </button>
  );
}

export function Header({ game, onOpen, onBackToToday }: HeaderProps) {
  const archive = game.mode === 'archive';
  return (
    <header className="masthead">
      <div className="masthead-title">
        <h1 className="wordmark">Wordly</h1>
        <p className="puzzle-label">No. {game.puzzle.number}</p>
      </div>
      {archive && (
        <div className="archive-bar">
          <p>
            Archive · {puzzleDate.format(new Date(PUZZLE_EPOCH_UTC + game.puzzle.day * 86_400_000))}
          </p>
          <button type="button" className="text-button" onClick={onBackToToday}>
            Back to today
          </button>
        </div>
      )}
      <nav className="toolbar" aria-label="Game menu">
        <ToolButton label="Rules" icon={<RulesIcon />} onClick={() => onOpen('rules')} />
        <ToolButton label="Archive" icon={<ArchiveIcon />} onClick={() => onOpen('archive')} />
        <ToolButton label="Stats" icon={<StatsIcon />} onClick={() => onOpen('results')} />
        <ToolButton label="Settings" icon={<SettingsIcon />} onClick={() => onOpen('settings')} />
      </nav>
    </header>
  );
}
