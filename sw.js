/* Install a complete version together; never mix cached code and question data. */
const CACHE_PREFIX = 'ai103-topic-lab-';
const CACHE = CACHE_PREFIX + '2026-10-07-v9';
const shell = ['.','index.html','styles.css','core.js','app.js','data/bank.js','data/bank.json','data/question-audit.json','manifest.webmanifest','assets/icon.svg','assets/paper-grain.svg','assets/color-grain.svg','assets/inter-latin.woff2','README.md','GROUPED-QUESTION-MAP.md','CONTENT-REVIEW.md','THIRD_PARTY_NOTICES.txt'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Bypass HTTP caches while preparing the next compatible application bundle.
    await cache.addAll(shell.map(url => new Request(url, { cache: 'reload' })));
    const response = await cache.match('data/bank.json');
    const bank = await response.json();
    const media = [...new Set(bank.questions.flatMap(q => (q.images || []).map(img => img.src)))];
    const guides = bank.topics.filter(t => t.guide).map(t => 'guides/' + t.guide.replace('.md','.html'));
    await cache.addAll([...media, ...guides].map(url => new Request(url, { cache: 'reload' })));
    // The complete bundle is ready. UI-only release; bank and storage schema unchanged.
    // Activate even when another app tab is open, so reload cannot remain on old shuffling code.
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(request); }
    catch (_) {
      if (request.mode === 'navigate') return cache.match('index.html');
      return new Response('Unavailable offline', { status: 503 });
    }
  })());
});
