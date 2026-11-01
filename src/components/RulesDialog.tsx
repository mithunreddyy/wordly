import { Dialog } from './Dialog';
import { Tile, type TileState } from './Tile';

function Example({ word, states, caption }: { word: string; states: TileState[]; caption: string }) {
  return (
    <figure className="example">
      <div className="board-row example-row" aria-hidden="true">
        {[...word].map((letter, i) => (
          <Tile key={i} letter={letter} state={states[i] ?? 'filled'} index={i} />
        ))}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} title="How to play" onClose={onClose}>
      <p className="sheet-lede">Find the five-letter word in six guesses. Each guess must be a real word from the Wordly list.</p>
      <p>When you enter a guess, every tile is fired. Letters in the word get a glaze; letters that aren’t stay plain.</p>
      <Example
        word="stone"
        states={['correct', 'filled', 'filled', 'filled', 'filled']}
        caption="Cobalt with a solid corner mark: S is in the word, in this spot."
      />
      <Example
        word="plant"
        states={['filled', 'filled', 'present', 'filled', 'filled']}
        caption="Saffron with a ring mark: A is in the word, in another spot."
      />
      <Example
        word="judge"
        states={['filled', 'filled', 'filled', 'filled', 'absent']}
        caption="Plain fired clay, no mark: E is not in the word."
      />
      <Example
        word="qzxvb"
        states={['rejected', 'rejected', 'rejected', 'rejected', 'rejected']}
        caption="Red edge with a cross: the guess wasn’t accepted, so it doesn’t use a turn. Edit it and try again."
      />
      <p>
        Each letter is marked once for every time it appears in the answer. Guess two Es when the answer has one, and only one E
        gets a glaze.
      </p>
      <h3>Every day</h3>
      <p>
        Everyone gets the same word. A new puzzle starts at 00:00 UTC. Missed one? Open the Archive to play any earlier day;
        those games don’t count toward your streak.
      </p>
      <h3>Hard mode</h3>
      <p>
        Glazed letters must be used again in every later guess, and cobalt letters must stay in place. Switch it on in Settings
        before your first guess.
      </p>
      <h3>Offline and saving</h3>
      <p>
        Progress is saved in this browser. After your first visit Wordly opens and plays without a connection; only the
        definition needs the internet.
      </p>
      <h3>Credits</h3>
      <p className="fine">
        Word lists are built from{' '}
        <a href="http://wordlist.aspell.net/" target="_blank" rel="noreferrer">
          SCOWL
        </a>{' '}
        by Kevin Atkinson. Definitions come from the{' '}
        <a href="https://dictionaryapi.dev/" target="_blank" rel="noreferrer">
          Free Dictionary API
        </a>
        , which draws on Wiktionary.
      </p>
    </Dialog>
  );
}
