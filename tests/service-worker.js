/* Only activate after every part of the offline bundle is cached. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = async function verifyServiceWorker() {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const bank = JSON.parse(fs.readFileSync(path.join(root, 'data/bank.json')));
  const origin = 'https://example.test', scope = origin + '/study/';
  function worker(failMedia = false) {
    const events = {}, steps = [], deleted = []; let currentCache;
    const cache = {
      addAll: async requests => {
        assert(requests.every(r => r.cache === 'reload'), 'Update must bypass stale HTTP assets');
        steps.push(requests.map(r => r.url));
        if (failMedia && steps.length === 2) throw Error('Incomplete bundle');
      },
      match: async (request, options) => {
        if (request === 'data/bank.json') return { json: async () => bank };
        assert(options.ignoreSearch, 'Versioned shell URLs should use the active bundle');
        return 'cached response';
      },
    };
    const self = {
      location: { origin }, registration: { scope },
      addEventListener: (name, fn) => { events[name] = fn; },
      skipWaiting: async () => { steps.push('activate-ready'); },
      clients: { claim: async () => { steps.push('claim'); } },
    };
    const context = vm.createContext({
      self, URL, Response,
      Request: class { constructor(url, options) { this.url = url; this.cache = options.cache; } },
      caches: {
        open: async () => cache,
        keys: async () => ['other-app', 'ai103-topic-lab-2026-10-07-v6', currentCache],
        delete: async key => { deleted.push(key); },
      },
      fetch: async () => { throw Error('Offline'); },
    });
    vm.runInContext(source, context); currentCache = vm.runInContext('CACHE', context);
    const run = async name => { let pending; events[name]({ waitUntil: task => { pending = task; } }); await pending; };
    return { events, steps, deleted, run };
  }
  const ready = worker(); await ready.run('install');
  assert(ready.steps[0].includes('app.js') && ready.steps[0].includes('data/bank.js'));
  for (const asset of ['quick-tests.html', 'quick-tests.css', 'quick-tests.js', 'data/quick-tests.js']) {
    assert(ready.steps[0].includes(asset), 'Quick tests must be available in the complete offline bundle: ' + asset);
  }
  assert(ready.steps[1].includes('guides/' + bank.topics.find(t => t.guide).guide.replace('.md', '.html')));
  assert.equal(ready.steps[2], 'activate-ready', 'Activation must follow both cache stages');
  const incomplete = worker(true);
  await assert.rejects(incomplete.run('install'), /Incomplete bundle/);
  assert(!incomplete.steps.includes('activate-ready'), 'Failed update must leave the old worker active');
  await ready.run('activate');
  assert.deepEqual(ready.deleted, ['ai103-topic-lab-2026-10-07-v6']);
  let response;
  ready.events.fetch({ request: { method: 'GET', url: scope + 'app.js?v=7' }, respondWith: task => { response = task; } });
  assert.equal(await response, 'cached response', 'Active bundle must work offline');
  for (const request of [{ method: 'POST', url: scope }, { method: 'GET', url: origin + '/other/' }, { method: 'GET', url: 'https://other.test/study/' }]) {
    ready.events.fetch({ request, respondWith: () => { throw Error('Intercepted unrelated request'); } });
  }
};
