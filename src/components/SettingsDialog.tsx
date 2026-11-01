import type { Settings } from '../storage/storage';
import { Dialog } from './Dialog';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  hardModeLocked: boolean;
  onChange: (next: Partial<Settings>) => void;
}

export function SettingsDialog({ open, onClose, settings, hardModeLocked, onChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} title="Settings" onClose={onClose}>
      <div className="setting">
        <label className="setting-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={settings.hardMode}
            disabled={hardModeLocked}
            aria-describedby="hard-mode-help"
            onChange={(e) => onChange({ hardMode: e.target.checked })}
          />
          <span>Hard mode</span>
        </label>
        <p id="hard-mode-help" className="setting-help">
          {hardModeLocked
            ? 'Locked until the next puzzle: hard mode can only change before your first guess.'
            : 'Revealed letters must be used in every later guess, and correct letters must stay in place.'}
        </p>
      </div>

      <div className="setting">
        <label className="setting-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={settings.highContrast}
            aria-describedby="contrast-help"
            onChange={(e) => onChange({ highContrast: e.target.checked })}
          />
          <span>High-contrast colors</span>
        </label>
        <p id="contrast-help" className="setting-help">
          Orange for the right spot, blue for the wrong spot. Turns on by itself when your device’s Increase Contrast
          setting is on. The corner marks stay either way.
        </p>
      </div>

      <p className="setting-note">Light and dark appearance follow your device settings.</p>
    </Dialog>
  );
}
