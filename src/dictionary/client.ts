import { readJson, writeJson, KEYS } from '../storage/storage';

/**
 * Client for https://dictionaryapi.dev (Free Dictionary API). It only supplies
 * definitions for a finished puzzle's answer; it never decides what counts as a
 * valid guess or answer.
 *
 * Observed response shapes (checked 2026-11-01):
 * - 200: array of entries { word, phonetic?, phonetics[], meanings[], license, sourceUrls[] }
 * - 404: object { title: "No Definitions Found", message, resolution }
 */
export const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const MAX_MEANINGS = 3;
const MAX_DEFINITIONS = 2;

export interface Meaning {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  meanings: Meaning[];
  license?: { name: string; url: string };
  sourceUrls: string[];
}

export type LookupResult =
  | { status: 'found'; entry: DictionaryEntry }
  | { status: 'not-found' }
  | { status: 'error'; reason: 'offline' | 'timeout' | 'server' | 'malformed' };

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isHttpsUrl = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};
const asRecord = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function parseMeaning(raw: unknown): Meaning | null {
  const m = asRecord(raw);
  if (!m || !isString(m.partOfSpeech) || !Array.isArray(m.definitions)) return null;
  const definitions = m.definitions
    .map(asRecord)
    .filter((d): d is Record<string, unknown> => d !== null && isString(d.definition))
    .slice(0, MAX_DEFINITIONS)
    .map((d) => ({
      definition: (d.definition as string).trim(),
      ...(isString(d.example) ? { example: d.example.trim() } : {}),
    }));
  return definitions.length ? { partOfSpeech: m.partOfSpeech.trim(), definitions } : null;
}

/** Picks only the fields the UI shows and validates their types. Returns null if nothing usable remains. */
export function parseEntries(data: unknown, word: string): DictionaryEntry | null {
  if (!Array.isArray(data)) return null;
  const entries = data.map(asRecord).filter((e): e is Record<string, unknown> => e !== null);
  const matching = entries.filter((e) => isString(e.word) && e.word.toLowerCase() === word);
  if (!matching.length) return null;

  const meanings = matching
    .flatMap((e) => (Array.isArray(e.meanings) ? e.meanings : []))
    .map(parseMeaning)
    .filter((m): m is Meaning => m !== null)
    .slice(0, MAX_MEANINGS);
  if (!meanings.length) return null;

  const first = matching[0]!;
  let phonetic = isString(first.phonetic) ? first.phonetic.trim() : undefined;
  if (!phonetic && Array.isArray(first.phonetics)) {
    const withText = first.phonetics.map(asRecord).find((p) => p && isString(p.text));
    if (withText) phonetic = (withText.text as string).trim();
  }

  const license = asRecord(first.license);
  const sourceUrls = [...new Set(matching.flatMap((e) => (Array.isArray(e.sourceUrls) ? e.sourceUrls : [])))]
    .filter(isHttpsUrl);

  return {
    word,
    ...(phonetic ? { phonetic } : {}),
    meanings,
    ...(license && isString(license.name) && isHttpsUrl(license.url)
      ? { license: { name: license.name, url: license.url } }
      : {}),
    sourceUrls,
  };
}

const memoryCache = new Map<string, DictionaryEntry>();

function readCache(word: string): DictionaryEntry | null {
  const hit = memoryCache.get(word);
  if (hit) return hit;
  const stored = readJson(KEYS.dictionary);
  if (stored.kind !== 'ok') return null;
  const record = asRecord(stored.value);
  // Cached entries are re-validated with the same parser as live responses.
  const entry = record && record.word === word ? parseEntries([record.entry], word) : null;
  if (entry) memoryCache.set(word, entry);
  return entry;
}

function writeCache(entry: DictionaryEntry) {
  memoryCache.set(entry.word, entry);
  // Only the latest answer is persisted; older words are not worth the storage.
  writeJson(KEYS.dictionary, { word: entry.word, entry: { ...entry } });
}

export function clearMemoryCache() {
  memoryCache.clear();
}

export interface LookupOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Never throws. Network, timeout, server, and shape failures all come back as `status: 'error'`. */
export async function lookupDefinition(rawWord: string, options: LookupOptions = {}): Promise<LookupResult> {
  const word = rawWord.trim().toLowerCase();
  if (!/^[a-z]+$/.test(word)) return { status: 'not-found' };

  const cached = readCache(word);
  if (cached) return { status: 'found', entry: cached };

  const { fetchImpl = globalThis.fetch, timeoutMs = 8000, signal } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetchImpl(API_BASE + encodeURIComponent(word), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return { status: 'not-found' };
    if (!response.ok) return { status: 'error', reason: 'server' };

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return { status: 'error', reason: 'malformed' };
    }
    const entry = parseEntries(data, word);
    if (!entry) return { status: 'error', reason: 'malformed' };
    writeCache(entry);
    return { status: 'found', entry };
  } catch {
    if (controller.signal.aborted && controller.signal.reason === 'timeout') {
      return { status: 'error', reason: 'timeout' };
    }
    return { status: 'error', reason: 'offline' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
