/* Offline on localhost/HTTPS; relative scope also works under GitHub Pages. */
const CACHE_PREFIX = 'ai103-topic-lab-';
const CACHE = CACHE_PREFIX + '2026-10-06-v2';
const shell = ['.','index.html','styles.css','core.js','app.js','data/bank.js','manifest.webmanifest','assets/icon.svg','assets/paper-grain.svg','assets/color-grain.svg','assets/inter-latin.woff2','README.md','GROUPED-QUESTION-MAP.md','THIRD_PARTY_NOTICES.txt'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(shell);
    const response = await fetch('data/bank.json');
    if (!response.ok) throw Error('Offline study bank unavailable');
    await cache.put('data/bank.json', response.clone());
    const bank = await response.json();
    const media = [...new Set(bank.questions.flatMap(q => (q.images || []).map(img => img.src)))];
    const guides = bank.topics.filter(t => t.guide).map(t => 'guides/' + t.guide.replace('.md','.html'));
    await cache.addAll([...media, ...guides]);
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
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return cache.match('index.html');
      return new Response('Unavailable offline', { status: 503 });
    }
  })());
});
