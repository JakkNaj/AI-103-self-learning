module.exports = function (bank, core) {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../data/quick-tests.js'), 'utf8'), context);
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  const tests = context.window.QUICK_TESTS.tests, seen = new Set();
  assert.equal(tests.length, 2);
  assert.equal(new Set(tests.map(test => test.id)).size, 2);
  for (const test of tests) {
    assert.equal(test.questionIds.length, 32);
    const counts = new Map();
    for (const id of test.questionIds) {
      const q = byId.get(id);
      assert(q && q.scored !== false && ['single', 'multi'].includes(q.type), id);
      assert(!seen.has(id), 'The quick tests must not repeat questions: ' + id);
      seen.add(id);
      counts.set(q.topicId, (counts.get(q.topicId) || 0) + 1);
      assert(['authored', 'guide'].includes(q.sourceId), id);
      assert(!q.caseId && !q.images?.length && !q.context, 'Standalone question needs all context: ' + id);
      assert(q.options.every(option => q.optionReasoning?.[option.id]), 'Every option needs reasoning: ' + id);
      assert.equal(core.grade(q, q.correct).earned, 1, id);
    }
    assert.equal(counts.size, bank.topics.length);
    for (const topic of bank.topics) assert.equal(counts.get(topic.id), 2, topic.id);
  }
};
