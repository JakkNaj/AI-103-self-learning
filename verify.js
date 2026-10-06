// Meaningful grading, partial-credit, filter and backup integrity checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./core.js');
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/bank.json')));
let checked = 0;
for (const q of bank.questions) {
  const result = core.grade(q, q.correct);
  assert.equal(result.correct, true, q.id);
  assert.equal(result.earned, result.possible, q.id);
  assert.equal(core.validAnswer(q, q.type === 'rows' ? {} : [], true), false, q.id);
  if (q.type === 'rows') {
    for (const row of q.rows) {
      const alternative = row.options.find(o => o.id !== q.correct[row.id]);
      const answer = { ...q.correct, [row.id]: alternative.id };
      const partial = core.grade(q, answer);
      assert.equal(partial.correct, false, q.id);
      assert.equal(partial.earned, q.rows.length - 1, q.id);
    }
  } else if (q.type === 'ordering') {
    const wrong = [...q.correct]; [wrong[0], wrong[1]] = [wrong[1], wrong[0]];
    assert.equal(core.grade(q, wrong).earned, 0, q.id);
    assert.equal(core.validAnswer(q, q.correct.slice(1)), false, q.id);
  } else {
    const other = q.options.find(o => !q.correct.includes(o.id));
    if (other) {
      const wrong = [other.id, ...q.correct.slice(1)];
      assert.equal(core.grade(q, wrong).earned, 0, q.id);
    }
    if (q.type === 'multi') {
      assert.equal(core.grade(q, [...q.correct].reverse()).earned, 1, q.id);
      assert.equal(core.validAnswer(q, q.correct.slice(1), true), false, q.id);
      assert.equal(core.validAnswer(q, [...q.correct, q.correct[0]]), false, q.id);
    }
  }
  checked++;
}
// Concrete Search role matrix: one mistaken write role loses exactly one row.
const roleQ = bank.questions.find(q => q.id === 'AI103-D1-053');
const correctRole = row => roleQ.rows.find(r => r.text.startsWith(row));
const queryRow = correctRole('Query'), writeRow = correctRole('Upload');
const reader = roleQ.options.find(o => o.text === 'Search Index Data Reader').id;
const writer = roleQ.options.find(o => o.text === 'Search Index Data Contributor').id;
assert.equal(roleQ.correct[queryRow.id], reader);
assert.equal(roleQ.correct[writeRow.id], writer);
assert.equal(core.grade(roleQ, { ...roleQ.correct, [writeRow.id]: reader }).earned, 3);

const all = core.freshState(bank);
assert.equal(core.selectQuestions(bank, all).length, 970);
assert.equal(new Set(bank.groups.flatMap(g => g.questionIds)).size, 970);
for (const group of bank.groups) assert.equal(core.selectQuestions(bank, all, { groupId: group.id }).length, group.questionIds.length);
for (const source of Object.keys(bank.sourceCounts)) assert.equal(core.selectQuestions(bank, all, { source }).length, bank.sourceCounts[source]);
const caseIds = bank.cases.flatMap(study => {
  const tasks = core.caseQuestions(bank, study.id);
  assert(tasks.length > 0, study.id);
  assert(tasks.every(q => q.caseId === study.id), study.id);
  if (study.questionIds) assert.deepEqual(tasks.map(q => q.id), study.questionIds, study.id);
  else assert.deepEqual(tasks.map(q => Number(q.sourceQuestionId)), tasks.map(q => Number(q.sourceQuestionId)).sort((a, b) => a - b), study.id);
  return tasks.map(q => q.id);
});
assert.equal(bank.cases.length, 10);
assert.equal(caseIds.length, 61);
assert.equal(new Set(caseIds).size, 61);
assert.deepEqual(new Set(caseIds), new Set(bank.questions.filter(q => q.caseId).map(q => q.id)));
assert.deepEqual(core.caseQuestions(bank, 'unknown'), []);
const misleading = { ...bank, cases: [{ id: 'case-support', questionIds: [bank.questions.find(q => !q.caseId).id] }] };
assert(core.caseQuestions(misleading, 'case-support').every(q => q.caseId === 'case-support'));
const single = bank.questions.find(q => q.id === 'AI103-D1-001');
const wrong = [single.options.find(o => !single.correct.includes(o.id)).id];
all.records[single.id] = { draft: wrong, evaluation: core.grade(single, wrong), attempts: 1, wrongCount: 1, bookmark: true, note: 'Small model meets constraints.' };
assert.equal(core.selectQuestions(bank, all, { status: 'wrong' }).length, 1);
assert.equal(core.selectQuestions(bank, all, { status: 'bookmarked' }).length, 1);
assert.equal(core.selectQuestions(bank, all, { status: 'unanswered' }).length, 969);
const imported = core.clone(all);
imported.records[single.id].draft = single.correct;
imported.records[single.id].evaluation = core.grade(single, single.correct);
imported.records[single.id].evaluation.at = '2099-01-01T00:00:00.000Z';
imported.records[single.id].note = 'Prefer capability evidence over model size.';
imported.learnedGroupIds = [single.groupId];
const merged = core.mergeStates(all, imported, bank);
assert.equal(merged.records[single.id].evaluation.correct, true);
assert.equal(merged.records[single.id].attempts, 1);
assert.match(merged.records[single.id].note, /Small model/);
assert.match(merged.records[single.id].note, /capability evidence/);
assert.equal(merged.records[single.id].bookmark, true);
assert.deepEqual(merged.learnedGroupIds, [single.groupId]);
assert.equal(core.selectQuestions(bank, merged, { status: 'wrong' }).length, 0);
for (const mutate of [
  x => x.bankVersion = 'unknown',
  x => x.records[single.id].draft = ['unknown'],
  x => x.records[single.id].evaluation.earned = 99,
  x => x.records[single.id].evaluation.contentHash = 'changed',
  x => x.records['unknown'] = {},
  x => x.learnedGroupIds.push('unknown'),
  x => x.preferences.source = 'unknown',
  x => x.records[single.id].note = 'x'.repeat(10001),
]) {
  const invalid = core.clone(all); mutate(invalid);
  assert.throws(() => core.validateBackup(invalid, bank));
}
assert.deepEqual(core.validateBackup(core.clone(merged), bank), merged);
console.log(`Passed: ${checked} grading keys; wrong selections/partial rows; source/family filters; 61 case-only tasks in source order; backup validation/merge.`);
