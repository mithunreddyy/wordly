# Wordly

A daily five-letter word puzzle. Everyone gets the same word each UTC day and has six guesses to find it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the Vitest suite once |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b` |
| `npm run wordlists` | Regenerate `src/data/*.json` from SCOWL (see `WORDLISTS.md`) |

## Features

- Daily puzzle, rolling over at 00:00 UTC. The countdown shows both UTC and the player's local time.
- Archive: a calendar of every earlier day. Play any of them; results show on the calendar but never touch streaks or statistics.
- Works offline after the first visit (service worker in `public/sw.js`, production builds only).
- Physical and on-screen keyboards. Results are announced to screen readers, and every status has a non-color cue: a filled corner mark for the right spot, a ring for the wrong spot, a cross for a refused guess.
- Four tile colors: cobalt (right letter, right spot), saffron (right letter, wrong spot), plain clay (letter not in the word), and a red outline for a guess that isn't accepted, which stays until the guess is edited.
- An always-visible status line under the board: guesses left, the current error (kept until the guess is edited, never on a timer), or the result.
- Hard mode, which can only be toggled before the first guess.
- Statistics: games played, win rate, current and best streak, guess distribution.
- Spoiler-free result sharing (clipboard, with a manual-copy fallback).
- Definition of the answer from the Free Dictionary API once the puzzle is finished, with loading, not-found, and error states and a retry.
- Light and dark follow the system appearance. A high-contrast palette is a setting and also turns on with the system's Increase Contrast. Reduced motion turns off all animation.

Visual direction, tokens, and the reasons behind them are in `DESIGN.md`.

## How it is put together

```
src/game/        Rules and state transitions. No React, no network, no storage.
  score.ts         Two-pass scoring that handles repeated letters
  puzzle.ts        UTC day index, versioned puzzle ids, seeded answer order
  game.ts          Typing, submitting, hard mode, saved-state validation
  stats.ts         Streaks and distribution, recorded once per puzzle day
  share.ts         Share text
src/storage/     localStorage wrapper: a per-puzzle game library, stats, settings. Every entry is
                 validated on its own; failures fall back to in-memory play.
src/dictionary/  dictionaryapi.dev client: normalizes, encodes, validates, caches successes.
src/components/  React UI
src/App.tsx      Wires state, persistence, rollover, keyboard input, and announcements
```

### Puzzle identity

Each saved game stores a puzzle id such as `a1-305` (answer-list version, day index), never the answer, plus whether it is a daily or archive game. On load the answer is derived from that id and the status is recomputed from the guesses, so neither a refresh nor edited storage can change the word or fake a result. If the list version changes, old saves are rejected with a visible notice.

If the day rolls over while a puzzle is unfinished (tab left open, or reopened the next day), that puzzle stays on screen and a banner offers the new one. Switching is the player's choice.

### Dictionary

The API supplies definitions only. It never decides which guesses are valid or which words can be answers; those come from the word lists. A lookup starts only after the puzzle ends, times out after 8 seconds, and any failure (offline, timeout, server error, unexpected response shape) shows as "Definition unavailable" with a retry. The game result is never affected.

## Known limitations

- Keys on the on-screen keyboard are 56px tall but narrower than 44px on phones (about 31px at 375px wide), because ten keys share one row. That is above the HIG's 28pt minimum but below its 44pt default.
- There is no web app manifest or home-screen icon yet; that needs an app icon, which hasn't been designed.
- Offline support needs one online visit first, and the definition always needs the network.
- The guess list has 6,476 words (SCOWL up to size 70). Some valid but uncommon five-letter words will be rejected.
- Statistics live in one browser's storage and do not sync across devices.
- The Free Dictionary API is a free third-party service with no uptime guarantee; it was seen failing intermittently during testing, which the error state covers.
- Keystrokes sent within a few milliseconds of page load, before React attaches its listener, are dropped. Automated tests have to wait for the app to settle; people don't type that fast.
