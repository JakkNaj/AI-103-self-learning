// Meaningful grading, partial-credit, filter and backup integrity checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./core.js');
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/bank.json')));
let checked = 0;
for (const q of bank.questions) {
  if (q.scored === false) { assert.throws(() => core.grade(q, q.correct)); continue; }
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
const scoredCount = bank.questions.filter(q => q.scored !== false).length;
assert.equal(core.selectQuestions(bank, all).length, scoredCount);
assert.equal(new Set(bank.groups.flatMap(g => g.questionIds)).size, 970);
for (const group of bank.groups) assert.equal(core.selectQuestions(bank, all, { groupId: group.id }).length, group.questionIds.filter(id => bank.questions.find(q => q.id === id).scored !== false).length);
for (const source of Object.keys(bank.sourceCounts)) assert.equal(core.selectQuestions(bank, all, { source }).length, bank.questions.filter(q => q.sourceId === source && q.scored !== false).length);
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
assert.equal(core.selectQuestions(bank, all, { status: 'unanswered' }).length, scoredCount - 1);
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
  x => x.learnedGroupIds.push('unknown'),
  x => x.preferences.source = 'unknown',
  x => x.records[single.id].note = 'x'.repeat(10001),
]) {
  const invalid = core.clone(all); mutate(invalid);
  assert.throws(() => core.validateBackup(invalid, bank));
}
assert.deepEqual(core.validateBackup(core.clone(merged), bank), merged);
/* Legacy console report replaced by full regression report below. */
// console.log(`Passed: ${checked} grading keys; wrong selections/partial rows; source/family filters; 61 case-only tasks in source order; backup validation/merge.`);

const vm = require('node:vm');
const runtime = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'data/bank.js'), 'utf8'), runtime);
assert.equal(JSON.stringify(runtime.window.TOPIC_BANK), JSON.stringify(bank), 'runtime/source bank');
const audit = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources/question-audit.json')));
assert.deepEqual(audit, JSON.parse(fs.readFileSync(path.join(__dirname, 'data/question-audit.json'))));
const patches = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources/revisions.json')));
for (const q of bank.questions) {
  for (const [key, value] of Object.entries(patches[q.id]?.patch || {})) assert.deepEqual(q[key], value, 'compiled patch: ' + q.id + '/' + key);
}
const lineage = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources/content-history.json')));
assert.deepEqual(bank.migrationBanks, lineage.banks);
assert.deepEqual(bank.contentHistory, lineage.definitions);
assert.equal(Object.keys(audit).length, bank.questions.length);
assert(Object.values(audit).every(x => ['rewritten', 'retained', 'unresolved'].includes(x.status)));
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/classification-manifest.json')));
assert.equal(manifest.length, bank.questions.length);
for (const item of manifest) {
  const q = bank.questions.find(q => q.id === item.id);
  assert.equal(item.stem, q.stem); assert.equal(item.groupId, q.groupId);
  assert.equal(item.scored, q.scored !== false);
}
const coverage = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/coverage-report.json')));
assert.equal(coverage.scoredTotal, scoredCount);
assert.deepEqual(coverage.qualityReview.counts, bank.qualityCounts);
assert.equal(coverage.variantClusters,bank.variants.filter(v => v.questionIds.length > 1).length);
for (const v of bank.variants) for (const id of v.questionIds) {
  const q = bank.questions.find(q => q.id === id); assert.equal(q.variantId,v.id); assert.equal(q.groupId,v.groupId);
}
const ids = new Set();
for (const q of bank.questions) {
  assert(!ids.has(q.id)); ids.add(q.id);
  assert.equal(new Set(q.options.map(o => o.id)).size, q.options.length, q.id);
  if (q.type === 'rows') {
    assert.equal(new Set(q.rows.map(r => r.id)).size, q.rows.length);
    for (const row of q.rows) {
      assert.equal(new Set(row.options.map(o => o.id)).size, row.options.length);
      assert(row.options.some(o => o.id === q.correct[row.id]), q.id);
    }
  } else {
    assert(q.correct.every(id => q.options.some(o => o.id === id)), q.id);
    assert.equal(q.correct.length, q.type === 'single' ? 1 : q.type === 'multi' ? q.selectCount : q.options.length, q.id);
  }
  if (q.localRevision && q.scored !== false) {
    assert(q.references.some(r => r.url.startsWith('https://learn.microsoft.com')), 'primary evidence: ' + q.id);
    assert(q.decisionRule || q.type === 'ordering', 'decision rule: ' + q.id);
    if (q.type === 'single' || q.type === 'multi') for (const o of q.options) assert(q.optionReasoning?.[o.id], 'option feedback: ' + q.id + '/' + o.id);
    if (q.type === 'rows') for (const row of q.rows) for (const o of row.options) {
      const rr = q.rowReasoning?.[row.id]; assert(rr?.[o.id] || rr?.alternatives?.[o.id], 'row feedback: ' + q.id + '/' + row.id + '/' + o.id);
    }
  }
  const prose = [q.explanation, q.explanationHtml, ...Object.values(q.optionReasoning || {})].join(' ');
  assert(!/Correct answers?:\s*[A-D](?:[.,<]|\s+and\s+[A-D]\b)/i.test(prose), 'stale presentation label: ' + q.id);
  assert(!prose.includes('This is a plausible adjacent choice'), 'generic feedback: ' + q.id);
}
// Controlled permutations prove associations, not a flaky distribution assertion.
assert.deepEqual(core.shuffle(['a','b','c','d'], () => 0), ['b','c','d','a']);
assert.deepEqual(core.shuffle(['a','b','c','d'], () => .999), ['a','b','c','d']);
assert.throws(() => core.shuffle(['a','b'], () => 1));
let seed = 7;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
for (const q of bank.questions.filter(q => q.scored !== false)) {
  const r = {}; core.beginAttempt(q, r, false, random);
  assert(core.validPresentation(q, r.presentation));
  const presentation = core.clone(r.presentation);
  if (q.type === 'rows') {
    r.draft = {};
    for (const row of q.rows) {
      const presented = core.presentedOptions(q, r, row);
      const choice = presented.find(o => o.id === q.correct[row.id]);
      assert.equal(choice.text, row.options.find(o => o.id === choice.id).text);
      r.draft[row.id] = choice.id;
    }
  } else if (q.type === 'ordering') {
    assert.deepEqual(r.draft, r.presentation.options);
    r.draft = [...q.correct]; // canonical sequence is unchanged by initial randomization
  } else {
    const presented = core.presentedOptions(q, r);
    assert.deepEqual(presented.map(o => o.label), q.options.map((_, i) => String.fromCharCode(65 + i)));
    for (const o of presented) {
      assert.equal(o.text, q.options.find(x => x.id === o.id).text);
      assert.equal(o.why, q.options.find(x => x.id === o.id).why);
      assert.equal(q.optionReasoning[o.id], q.optionReasoning[q.options.find(x => x.id === o.id).id]);
    }
    r.draft = presented.filter(o => q.correct.includes(o.id)).map(o => o.id);
  }
  r.evaluation = core.grade(q, r.draft); assert(r.evaluation.correct, q.id);
  core.beginAttempt(q, r, false, () => { throw Error('Unexpected reshuffle'); });
  r.note = 'Reason before reveal'; core.toggleConfused(r, '2099-01-01T00:00:00Z');
  assert.deepEqual(r.presentation, presentation);
  const saved = core.freshState(bank); saved.records[q.id] = r;
  const resumed = core.validateBackup(JSON.parse(JSON.stringify(saved)), bank).records[q.id];
  assert.deepEqual(resumed.presentation, presentation); assert.deepEqual(resumed.draft, r.draft);
  const before = core.clone(resumed); core.toggleConfused(resumed, '2099-01-02T00:00:00Z');
  assert.deepEqual(resumed.draft, before.draft); assert.deepEqual(resumed.evaluation, before.evaluation);
  assert.deepEqual(resumed.presentation, before.presentation);
  assert.equal(resumed.confused, false);
  const afterToggle = core.clone(resumed);
  core.beginAttempt(q, resumed, true, random);
  assert.equal(resumed.confused, afterToggle.confused); assert.equal(resumed.note, afterToggle.note);
  assert(core.validPresentation(q, resumed.presentation));
}
// Confusion is independent, persisted, scoped and explicitly clearable.
const flags = core.freshState(bank), q0 = single, q1 = bank.questions.find(q => q.sourceId === 'pvejayan' && q.scored !== false);
for (const q of [q0, q1]) {
  flags.records[q.id] = {}; core.beginAttempt(q, flags.records[q.id]);
  flags.records[q.id].draft = core.clone(q.correct); flags.records[q.id].evaluation = core.grade(q, q.correct);
  core.toggleConfused(flags.records[q.id], '2099-01-01T00:00:00Z');
}
assert.equal(core.selectQuestions(bank, flags, { status: 'confused' }).length, 2);
assert.equal(core.selectQuestions(bank, flags, { status: 'confused', source: 'pvejayan' }).length, 1);
assert.equal(core.selectQuestions(bank, flags, { status: 'confused', topicId: q0.topicId }).filter(q => q.id === q0.id).length, 1);
assert.equal(core.selectQuestions(bank, flags, { status: 'wrong' }).length, 0);
const oldFlags = core.clone(flags);
for (const q of [q0,q1]) core.toggleConfused(flags.records[q.id], '2099-01-02T00:00:00Z');
assert.equal(core.selectQuestions(bank, flags, { status: 'confused' }).length, 0);
assert.equal(core.mergeStates(flags, oldFlags, bank).records[q0.id].confused, false, 'older mark must not resurrect clear');
const legacyFlags = core.clone(oldFlags); delete legacyFlags.records[q0.id].confused; delete legacyFlags.records[q0.id].confusedAt;
assert.equal(core.mergeStates(oldFlags, legacyFlags, bank).records[q0.id].confused, true, 'missing legacy field is absent information');
const newMark = core.clone(oldFlags); core.toggleConfused(newMark.records[q0.id], '2099-01-03T00:00:00Z'); core.toggleConfused(newMark.records[q0.id], '2099-01-04T00:00:00Z');
assert.equal(core.mergeStates(flags, newMark, bank).records[q0.id].confused, true, 'newer mark wins');
// An older checked backup cannot undo a newer retry or separate its draft/order.
const stale = core.clone(flags), retry = core.clone(flags);
stale.records[q0.id].evaluation.at = '2099-01-01T00:00:00Z';
const rr = retry.records[q0.id]; delete rr.evaluation; core.beginAttempt(q0, rr, true, () => 0); rr.attemptAt = '2099-01-05T00:00:00Z'; rr.draft = [];
const retriedMerge = core.mergeStates(retry, stale, bank).records[q0.id];
assert.equal(retriedMerge.evaluation, undefined); assert.deepEqual(retriedMerge.draft, []);
assert.deepEqual(retriedMerge.presentation, rr.presentation); assert(retriedMerge.history.some(h => h.evaluation));
// Existing schema-1 browser notebooks and backups migrate against their original definitions.
const original = JSON.parse(fs.readFileSync(path.join(__dirname, 'sources/bank.original.json')));
const legacy = core.freshState(original); legacy.schemaVersion = 1; delete legacy.retiredRecords;
const changed = bank.questions.find(q => q.localRevision?.material), unchanged = bank.questions.find(q => !q.localRevision);
for (const q of [changed,unchanged]) {
  const oq = original.questions.find(x => x.id === q.id);
  legacy.records[q.id] = { draft: core.clone(oq.correct), evaluation: core.grade(oq, oq.correct), attempts: 1, correctCount: 1, bookmark: true, note: 'Keep this original note' };
}
legacy.records[changed.id].confused = true; legacy.records[changed.id].confusedAt = '2099-01-01T00:00:00Z';
legacy.records[changed.id].attemptAt = '2099-01-02T00:00:00Z'; legacy.records[changed.id].draftAt = '2099-01-03T00:00:00Z';
legacy.records['retired-example'] = { note: 'Do not discard me', bookmark: true, draft: ['obsolete-option'], attempts: 2 };
const migrated = core.validateBackup(legacy, bank);
const cm = migrated.records[changed.id], um = migrated.records[unchanged.id];
assert.equal(cm.evaluation, undefined); assert.equal(cm.draft, undefined); assert.equal(cm.attempts, 0);
assert.equal(cm.attemptAt, undefined); assert.equal(cm.draftAt, undefined, 'retired attempt times must not outrank current progress');
assert.equal(cm.history[0].draftAt, '2099-01-03T00:00:00Z');
assert.equal(cm.history[0].evaluation.contentHash, original.questions.find(q => q.id === changed.id).contentHash);
assert.equal(cm.history[0].evaluation.correct, true); assert.equal(cm.history[0].attempts, 1);
assert.equal(cm.note, 'Keep this original note'); assert.equal(cm.bookmark, true); assert.equal(cm.confused, true);
assert.equal(um.evaluation.correct, true); assert.equal(um.attempts, 1); assert.equal(um.note, 'Keep this original note');
assert.equal(migrated.retiredRecords['retired-example'].note, 'Do not discard me');
assert.deepEqual(core.validateBackup(core.clone(migrated), bank), migrated, 'migration is idempotent');
// A subsequent material revision retains the already revised definition as well.
const nextBank = core.clone(bank), previouslyRevised = nextBank.questions.find(q => q.id === changed.id);
nextBank.contentHistory.push(core.clone(previouslyRevised)); nextBank.compatibleBankVersions.push(bank.bankVersion);
nextBank.migrationBanks[bank.bankVersion] = Object.fromEntries(bank.questions.map(q => [q.id, q.contentHash]));
nextBank.bankVersion = 'controlled-next-revision'; previouslyRevised.contentHash = 'controlled-next-content';
const beforeNext = core.freshState(bank), currentDefinition = bank.questions.find(q => q.id === changed.id);
beforeNext.records[changed.id] = { draft: core.clone(currentDefinition.correct), evaluation: core.grade(currentDefinition,currentDefinition.correct), note:'Later revision note', bookmark:true, confused:true, confusedAt:'2099-02-01T00:00:00Z' };
const afterNext = core.validateBackup(beforeNext,nextBank).records[changed.id];
assert.equal(afterNext.evaluation,undefined); assert.equal(afterNext.history[0].contentHash,currentDefinition.contentHash);
assert.equal(afterNext.note,'Later revision note'); assert.equal(afterNext.bookmark,true); assert.equal(afterNext.confused,true);
const malformedOrder = core.clone(oldFlags); malformedOrder.records[q0.id].presentation.options.fill(q0.options[0].id);
assert.throws(() => core.validateBackup(malformedOrder, bank));
const malformedConfusion = core.clone(oldFlags); malformedConfusion.records[q0.id].confused = 'yes'; assert.throws(() => core.validateBackup(malformedConfusion, bank));
assert.throws(() => core.validateBackup({...flags, records: JSON.parse('{"__proto__": {}}')}, bank));
// Regression evidence for known technical repairs.
const findQ = id => bank.questions.find(q => q.id === id);
assert.match(findQ('WEB-sefstratiou-135-04492891').code, /\{\{speaker_configuration\}\}/);
assert(findQ('WEB-sefstratiou-135-04492891').rows.flatMap(r => r.options).some(o => o.text.includes('"diarization":') && o.text.includes('"enabled": true')));
assert(!findQ('WEB-sefstratiou-143-dfb11805').code.includes('min(delay, 30)'));
assert.match(findQ('WEB-sefstratiou-143-dfb11805').code, /time.sleep\(delay\)/);
assert(findQ('WEB-examtopics-20-c7e10c9f').rows[0].options.find(o => o.id === findQ('WEB-examtopics-20-c7e10c9f').correct.r1).text.toLowerCase().includes('retrieval'));
assert.match(findQ('WEB-examtopics-27-0ad71346').stem, /support|supported/i);
assert.match(JSON.stringify(roleQ.rowReasoning), /provést může/);
console.log(`Passed: ${checked} scored keys; deterministic ID shuffling/resume for every scored item; rows, multi, ordering, 61 case tasks; confusion/filter/merge; schema-1 revision/history migration; runtime/source/classification consistency; known-fix regressions. ${bank.qualityCounts.unresolved} unscored.`);
