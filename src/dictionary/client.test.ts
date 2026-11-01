import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, clearMemoryCache, lookupDefinition, parseEntries } from './client';

const sample = [
  {
    word: 'crane',
    phonetic: '/kɹeɪn/',
    phonetics: [{ text: '/kɹeɪn/', audio: 'https://example.test/crane.mp3' }],
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [
          { definition: 'A large bird with long legs.', synonyms: [] },
          { definition: 'A lifting machine.', example: 'The crane lifted the beam.' },
          { definition: 'A third sense that is trimmed.' },
        ],
      },
      { partOfSpeech: 'verb', definitions: [{ definition: 'To extend (one’s neck).' }] },
    ],
    license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0' },
    sourceUrls: ['https://en.wiktionary.org/wiki/crane'],
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  clearMemoryCache();
  localStorage.clear();
});

describe('lookupDefinition', () => {
  it('returns the parsed entry on success and requests the encoded, normalized word', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(sample));
    const result = await lookupDefinition('  CRANE ', { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(API_BASE + 'crane', expect.anything());
    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    expect(result.entry.phonetic).toBe('/kɹeɪn/');
    expect(result.entry.meanings).toHaveLength(2);
    expect(result.entry.meanings[0]!.definitions).toHaveLength(2);
    expect(result.entry.meanings[0]!.definitions[1]!.example).toBe('The crane lifted the beam.');
    expect(result.entry.license?.name).toBe('CC BY-SA 3.0');
    expect(result.entry.sourceUrls).toEqual(['https://en.wiktionary.org/wiki/crane']);
  });

  it('reports not-found for a 404', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ title: 'No Definitions Found', message: 'Sorry pal', resolution: '' }, 404),
    );
    expect(await lookupDefinition('qzxvb', { fetchImpl })).toEqual({ status: 'not-found' });
  });

  it('treats a 200 with the wrong shape as malformed, not as a successful lookup', async () => {
    for (const body of [{ word: 'crane' }, [], [{ word: 'crane', meanings: 'nope' }], [{ word: 'other', meanings: [] }]]) {
      const fetchImpl = vi.fn(async () => jsonResponse(body));
      expect(await lookupDefinition('crane', { fetchImpl })).toEqual({ status: 'error', reason: 'malformed' });
    }
  });

  it('treats a non-JSON body as malformed', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>oops</html>', { status: 200 }));
    expect(await lookupDefinition('crane', { fetchImpl })).toEqual({ status: 'error', reason: 'malformed' });
  });

  it('reports a server error for other failing statuses', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503));
    expect(await lookupDefinition('crane', { fetchImpl })).toEqual({ status: 'error', reason: 'server' });
  });

  it('reports offline when the network request fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await lookupDefinition('crane', { fetchImpl })).toEqual({ status: 'error', reason: 'offline' });
  });

  it('times out a slow request', async () => {
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    expect(await lookupDefinition('crane', { fetchImpl, timeoutMs: 10 })).toEqual({
      status: 'error',
      reason: 'timeout',
    });
  });

  it('caches successful lookups and does not cache failures', async () => {
    const failing = vi.fn(async () => jsonResponse({}, 500));
    await lookupDefinition('crane', { fetchImpl: failing });
    await lookupDefinition('crane', { fetchImpl: failing });
    expect(failing).toHaveBeenCalledTimes(2);

    const ok = vi.fn(async () => jsonResponse(sample));
    await lookupDefinition('crane', { fetchImpl: ok });
    await lookupDefinition('Crane', { fetchImpl: ok });
    expect(ok).toHaveBeenCalledTimes(1);

    // Survives a reload via storage, re-validated on read.
    clearMemoryCache();
    const result = await lookupDefinition('crane', { fetchImpl: ok });
    expect(ok).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('found');
  });

  it('ignores a corrupt cached entry and fetches again', async () => {
    localStorage.setItem('wordly:v1:dictionary', JSON.stringify({ word: 'crane', entry: { word: 'crane' } }));
    const ok = vi.fn(async () => jsonResponse(sample));
    expect((await lookupDefinition('crane', { fetchImpl: ok })).status).toBe('found');
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe('parseEntries', () => {
  it('drops unsafe source URLs and invalid license data', () => {
    const entry = parseEntries(
      [{ ...sample[0], sourceUrls: ['javascript:alert(1)', 'https://ok.test/x'], license: { name: 'X', url: 'ftp://x' } }],
      'crane',
    );
    expect(entry?.sourceUrls).toEqual(['https://ok.test/x']);
    expect(entry?.license).toBeUndefined();
  });
});
