import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { clearMemoryCache } from './dictionary/client';
import { puzzleForDate, puzzleForDay } from './game/puzzle';
import { KEYS } from './storage/storage';

const NOW = new Date('2026-11-01T12:00:00Z');
const today = puzzleForDate(NOW);
const wrong = today.answer === 'stone' ? 'about' : 'stone';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  clearMemoryCache();
  localStorage.setItem(KEYS.settings, JSON.stringify({ seenRules: true }));
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({}, 503));
  vi.stubGlobal('fetch', fetchMock);
  // Reduced motion keeps the end-of-game timing short.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const announcer = () => screen.getByText((_, el) => el?.classList.contains('visually-hidden') && el.tagName === 'P' || false);

describe('main flow', () => {
  it('plays a winning game with the physical keyboard and announces each result', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard(`${wrong}{Enter}`);
    expect(screen.getByRole('group', { name: /^Guess 1: / })).toBeInTheDocument();
    expect(announcer()).toHaveTextContent(/^Guess 1: /);

    await user.keyboard(`${today.answer}{Enter}`);
    expect(announcer()).toHaveTextContent('Solved in 2.');
    expect(screen.getByRole('group', { name: /^Guess 2: / })).toHaveAccessibleName(
      `Guess 2: ${[...today.answer].map((c) => `${c.toUpperCase()} correct`).join(', ')}`,
    );

    const stats = JSON.parse(localStorage.getItem(KEYS.stats)!);
    expect(stats).toMatchObject({ played: 1, won: 1, streak: 1 });
    expect(stats.distribution[1]).toBe(1);

    const dialog = await screen.findByRole('dialog', { name: `Puzzle ${today.number}` }, { timeout: 2000 });
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByText(/Solved in 2 of 6/)).toBeInTheDocument();
  });

  it('accepts input from the on-screen keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const letter of wrong) await user.click(screen.getByRole('button', { name: letter.toUpperCase() }));
    await user.click(screen.getByRole('button', { name: 'Delete letter' }));
    expect(screen.getByRole('group', { name: /typing/ })).toHaveAccessibleName(
      `Guess 1, typing ${wrong.slice(0, 4).toUpperCase().split('').join(' ')}`,
    );
    await user.click(screen.getByRole('button', { name: wrong.at(-1)!.toUpperCase() }));
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    expect(screen.getByRole('group', { name: /^Guess 1: / })).toBeInTheDocument();
  });

  it('rejects a word outside the list without using a turn', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('qzxvb{Enter}');
    expect(screen.getByText('Not in the word list', { selector: '.status-error p' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Guess 1: / })).not.toBeInTheDocument();
  });

  it('marks a refused guess as rejected until it is edited', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.keyboard('qzxvb{Enter}');
    expect(screen.getByRole('group', { name: 'Guess 1, typing Q Z X V B, not accepted' })).toBeInTheDocument();
    expect(container.querySelectorAll('.board .tile-rejected')).toHaveLength(5);
    await user.keyboard('{Backspace}');
    expect(screen.getByRole('group', { name: 'Guess 1, typing Q Z X V' })).toBeInTheDocument();
    expect(container.querySelectorAll('.board .tile-rejected')).toHaveLength(0);
  });

  it('keeps an error visible until the guess is edited, with no timer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('qzx{Enter}');
    const visible = { selector: '.status-error p' };
    expect(screen.getByText('Not enough letters', visible)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 2600));
    expect(screen.getByText('Not enough letters', visible)).toBeInTheDocument();
    await user.keyboard('{Backspace}');
    expect(screen.queryByText('Not enough letters', visible)).not.toBeInTheDocument();
    expect(screen.getByText('Six guesses. Type a word to start.')).toBeInTheDocument();
  });

  it('reveals the answer after six misses', async () => {
    const user = userEvent.setup();
    const misses = ['about', 'stone', 'light', 'drink', 'puppy', 'chess', 'month'].filter((w) => w !== today.answer);
    render(<App />);
    for (const w of misses.slice(0, 6)) await user.keyboard(`${w}{Enter}`);
    expect(announcer()).toHaveTextContent(`The word was ${today.answer.toUpperCase()}.`);
    expect(JSON.parse(localStorage.getItem(KEYS.stats)!)).toMatchObject({ played: 1, won: 0 });
  });
});

describe('persistence', () => {
  it('restores guesses and typed letters after a refresh', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.keyboard(`${wrong}{Enter}ab`);
    unmount();

    render(<App />);
    expect(screen.getByRole('group', { name: /^Guess 1: / })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Guess 2, typing A B' })).toBeInTheDocument();
  });

  it('starts fresh with a visible notice when saved progress is corrupt', () => {
    localStorage.setItem(KEYS.games, '{"a1-12": ');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent("Some saved progress couldn't be read");
    expect(screen.getByRole('group', { name: 'Guess 1, empty' })).toBeInTheDocument();
  });

  it('keeps an unfinished puzzle from yesterday and offers today’s', async () => {
    const yesterday = puzzleForDay(today.day - 1);
    const guess = yesterday.answer === 'stone' ? 'about' : 'stone';
    localStorage.setItem(
      KEYS.games,
      JSON.stringify({ [yesterday.id]: { puzzleId: yesterday.id, guesses: [guess], input: '', hardMode: false, mode: 'daily' } }),
    );
    localStorage.setItem(KEYS.active, JSON.stringify(yesterday.id));
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText(`No. ${yesterday.number}`)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /^Guess 1: / })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Play No. ${today.number}` }));
    expect(screen.getByText(`No. ${today.number}`)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Guess 1, empty' })).toBeInTheDocument();
  });
});

describe('dictionary on the results screen', () => {
  async function win() {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard(`${today.answer}{Enter}`);
    const dialog = await screen.findByRole('dialog', { name: `Puzzle ${today.number}` }, { timeout: 2000 });
    return { user, dialog };
  }

  it('shows the definition with attribution on success', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        {
          word: today.answer,
          phonetic: '/test/',
          meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A test sense.' }] }],
          license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0' },
          sourceUrls: [`https://en.wiktionary.org/wiki/${today.answer}`],
        },
      ]),
    );
    const { dialog } = await win();
    expect(await within(dialog).findByText('A test sense.')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'CC BY-SA 3.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/3.0',
    );
    expect(within(dialog).getByRole('link', { name: 'en.wiktionary.org' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says so when there is no entry', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'No Definitions Found' }, 404));
    const { dialog } = await win();
    expect(await within(dialog).findByText(/No dictionary entry/)).toBeInTheDocument();
  });

  it('shows a retryable error when the network fails, without touching the result', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { user, dialog } = await win();
    expect(await within(dialog).findByText(/Definition unavailable/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Solved in 1 of 6/)).toBeInTheDocument();

    fetchMock.mockResolvedValue(jsonResponse({ title: 'No Definitions Found' }, 404));
    await user.click(within(dialog).getByRole('button', { name: 'Try the lookup again' }));
    expect(await within(dialog).findByText(/No dictionary entry/)).toBeInTheDocument();
  });

  it('does not call the dictionary while the puzzle is in progress', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard(`${wrong}{Enter}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('dialogs and settings', () => {
  it('shows the rules on the first visit only', async () => {
    localStorage.removeItem(KEYS.settings);
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    const rules = screen.getByRole('dialog', { name: 'How to play' });
    expect(rules).toHaveAttribute('open');
    await user.click(within(rules).getByRole('button', { name: 'Close' }));
    expect(rules).not.toHaveAttribute('open');
    unmount();

    render(<App />);
    expect(screen.queryByRole('dialog', { name: 'How to play' })).not.toBeInTheDocument();
  });

  it('locks hard mode once a guess is made', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const hard = screen.getByRole('switch', { name: 'Hard mode' });
    await user.click(hard);
    expect(hard).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    // Focus is back on the Settings button; typing must still let Enter submit.
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
    await user.keyboard(`${wrong}{Enter}`);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('switch', { name: 'Hard mode' })).toBeDisabled();
  });

  it('applies high contrast and leaves appearance to the system', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'High-contrast colors' }));
    expect(document.documentElement.dataset.contrast).toBe('high');
    await user.click(screen.getByRole('switch', { name: 'High-contrast colors' }));
    expect(document.documentElement.dataset.contrast).toBeUndefined();
  });

  it('shows an empty state in stats before any game is finished', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Stats' }));
    expect(screen.getByText(/No finished puzzles yet/)).toBeInTheDocument();
  });
});

describe('archive', () => {
  it('plays a past puzzle without touching stats, then returns to today', async () => {
    const past = puzzleForDay(today.day - 3);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    const archive = screen.getByRole('dialog', { name: 'Archive' });
    // The fixed test date is November 1, so three days back is in October.
    await user.click(within(archive).getByRole('button', { name: 'Previous month' }));
    await user.click(within(archive).getByRole('button', { name: new RegExp(`puzzle ${past.number}, not played`) }));

    expect(screen.getByText(/^Archive · /)).toBeInTheDocument();
    await user.keyboard(`${past.answer}{Enter}`);
    expect(announcer()).toHaveTextContent('Solved in 1.');
    expect(localStorage.getItem(KEYS.stats)).toBeNull();

    const results = await screen.findByRole('dialog', { name: `Puzzle ${past.number}` }, { timeout: 2000 });
    expect(within(results).getByText(/archive puzzle/)).toBeInTheDocument();
    await user.click(within(results).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(
      within(screen.getByRole('dialog', { name: 'Archive' })).getByRole('button', {
        name: new RegExp(`puzzle ${past.number}, solved in 1 guess`),
      }),
    ).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog', { name: 'Archive' })).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Back to today' }));
    expect(screen.queryByText(/^Archive · /)).not.toBeInTheDocument();
    expect(screen.getByText(`No. ${today.number}`)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Guess 1, empty' })).toBeInTheDocument();
  });

  it('resumes an unfinished archive puzzle after a refresh', async () => {
    const past = puzzleForDay(today.day - 10);
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    const archive = screen.getByRole('dialog', { name: 'Archive' });
    await user.click(within(archive).getByRole('button', { name: 'Previous month' }));
    await user.click(within(archive).getByRole('button', { name: 'Next month' }));
    // Puzzle 10 days back may sit in the previous month.
    const target =
      within(archive).queryByRole('button', { name: new RegExp(`puzzle ${past.number},`) }) ??
      (await (async () => {
        await user.click(within(archive).getByRole('button', { name: 'Previous month' }));
        return within(archive).getByRole('button', { name: new RegExp(`puzzle ${past.number},`) });
      })());
    await user.click(target);
    await user.keyboard(`${wrong === past.answer ? 'about' : wrong}{Enter}`);
    unmount();

    render(<App />);
    expect(screen.getByText(`No. ${past.number}`, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /^Guess 1: / })).toBeInTheDocument();
  });

  it('does not offer future days', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    const archive = screen.getByRole('dialog', { name: 'Archive' });
    expect(within(archive).getByRole('button', { name: 'Next month' })).toBeDisabled();
    expect(within(archive).getByRole('button', { name: new RegExp(`puzzle ${today.number}, `) })).toHaveAccessibleName(
      /today/,
    );
    expect(within(archive).queryByRole('button', { name: new RegExp(`puzzle ${today.number + 1},`) })).toBeNull();
  });
});
