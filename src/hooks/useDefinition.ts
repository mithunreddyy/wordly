import { useCallback, useEffect, useState } from 'react';
import { lookupDefinition, type LookupResult } from '../dictionary/client';

export type DefinitionState = { status: 'idle' } | { status: 'loading' } | LookupResult;

/** Looks up `word` once it is non-null. A failed lookup can be retried; it never affects the game. */
export function useDefinition(word: string | null): { state: DefinitionState; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ key: string; result: LookupResult } | null>(null);
  const key = word ? `${word}:${attempt}` : null;

  useEffect(() => {
    if (!word || !key) return;
    const controller = new AbortController();
    lookupDefinition(word, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setSettled({ key, result });
    });
    return () => controller.abort();
  }, [word, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!key) return { state: { status: 'idle' }, retry };
  if (settled?.key !== key) return { state: { status: 'loading' }, retry };
  return { state: settled.result, retry };
}
