import type { DefinitionState } from '../hooks/useDefinition';

const ERROR_TEXT = {
  offline: "Couldn't reach the dictionary. Check your connection.",
  timeout: 'The dictionary took too long to answer.',
  server: 'The dictionary service returned an error.',
  malformed: 'The dictionary sent a response Wordly could not read.',
} as const;

export function Definition({ word, state, onRetry }: { word: string; state: DefinitionState; onRetry: () => void }) {
  const upper = word.toUpperCase();

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <section className="definition" aria-busy="true" aria-live="polite">
        <p className="definition-status">Looking up {upper}…</p>
      </section>
    );
  }

  if (state.status === 'not-found') {
    return (
      <section className="definition" aria-live="polite">
        <p className="definition-status">No dictionary entry for {upper}. Your result is unaffected.</p>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="definition" aria-live="polite">
        <p className="definition-status">
          Definition unavailable. {ERROR_TEXT[state.reason]}
        </p>
        <button type="button" className="text-button" onClick={onRetry}>
          Try the lookup again
        </button>
      </section>
    );
  }

  const { entry } = state;
  return (
    <section className="definition" aria-live="polite">
      <p className="definition-word">
        <span lang="en">{entry.word}</span>
        {entry.phonetic && <span className="definition-phonetic">{entry.phonetic}</span>}
      </p>
      {entry.meanings.map((meaning, i) => (
        <div key={i} className="meaning">
          <p className="meaning-pos">{meaning.partOfSpeech}</p>
          <ol>
            {meaning.definitions.map((d, j) => (
              <li key={j}>
                {d.definition}
                {d.example && <span className="meaning-example"> “{d.example}”</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="fine">
        From the{' '}
        <a href="https://dictionaryapi.dev/" target="_blank" rel="noreferrer">
          Free Dictionary API
        </a>
        {entry.sourceUrls[0] && (
          <>
            , sourced from{' '}
            <a href={entry.sourceUrls[0]} target="_blank" rel="noreferrer">
              {new URL(entry.sourceUrls[0]).hostname}
            </a>
          </>
        )}
        {entry.license && (
          <>
            . License:{' '}
            <a href={entry.license.url} target="_blank" rel="noreferrer">
              {entry.license.name}
            </a>
          </>
        )}
        .
      </p>
    </section>
  );
}
