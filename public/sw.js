// Offline cache for Wordly. Bump CACHE when this file's strategy changes;
// built assets have hashed names, so new releases need no bump.
const CACHE = 'wordly-shell-v2';
const SHELL = './index.html';

async function precache() {
  const cache = await caches.open(CACHE);
  const response = await fetch(SHELL, { cache: 'no-cache' });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(SHELL, response);

  // The page's own hashed scripts and styles, plus the Latin font files the styles load.
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => new URL(m[1], self.location).href);
  for (const url of assets.filter((u) => u.endsWith('.css'))) {
    const css = await (await fetch(url)).text();
    for (const m of css.matchAll(/url\(([^)]+latin[^)]*\.woff2)\)/g)) {
      assets.push(new URL(m[1].replace(/["']/g, ''), url).href);
    }
  }
  await cache.addAll([...new Set(assets)]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Only this site's files. Dictionary lookups go to the network and fail visibly when offline.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Network first so a new release shows up; the cached page covers offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy));
          return response;
        })
        .catch(() => caches.match(SHELL, { ignoreVary: true })),
    );
    return;
  }

  event.respondWith(
    // Module scripts are requested with an Origin header; servers that answer with
    // "Vary: Origin" would otherwise never match the precached copy.
    caches.match(request, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
