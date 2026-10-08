// Exam membership, stable mixed queues, backup compatibility and the repaired code exercise.
module.exports = function (bank, core) {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', name)));
  const blueprint = read('sources/exam-blueprint.json'), coverage = read('data/coverage-report.json');
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  const parts = bank.practiceSets.filter(s => s.kind === 'exam');
  const code = bank.practiceSets.find(s => s.id === 'code');
  const sorted = ids => [...ids].sort();
  const seeded = initial => { let n = initial; return () => { n = (1664525 * n + 1013904223) >>> 0; return n / 4294967296; }; };
  const noRandom = () => { throw Error('Saved exam order must not consume randomness.'); };
  assert.equal(parts.length, 5);
  assert.equal(bank.practiceSets.length, 11);
  assert.equal(new Set(bank.practiceSets.map(s => s.id)).size, 11);
  assert.deepEqual(parts.map(s => [s.id, s.weightMin, s.weightMax]), [['D1',25,30],['D2',30,35],['D3',10,15],['D4',10,15],['D5',10,15]]);
  assert.equal(bank.examOutline.outlineUrl, blueprint.outlineUrl);
  assert.equal(bank.examOutline.skillsEffective, '2026-04-16');
  const all = parts.flatMap(s => s.questionIds), scored = bank.questions.filter(q => q.scored !== false);
  assert.equal(new Set(all).size, all.length, 'An exam question has exactly one primary domain');
  assert.deepEqual(sorted(all), sorted(scored.map(q => q.id)), 'Every scored question appears in an exam part');
  for (const q of bank.questions) {
    assert.equal(q.examDomainId, q.domain || blueprint.additionalAssignments[q.id], q.id);
    assert(parts.some(s => s.id === q.examDomainId));
    assert.equal(q.isCodeCompletion, q.type === 'rows' && (!!q.code || blueprint.codeCompletionExhibitIds.includes(q.id)), q.id);
  }
  assert.equal(code.questionIds.length, 46);
  assert.equal(code.questionIds.reduce((n, id) => n + byId.get(id).rows.length, 0), 105);
  assert(code.questionIds.includes('WEB-examtopics-6-57c535b2'));
  assert(code.questionIds.includes('WEB-examtopics-30-6a709e3f'));
  for (const id of ['WEB-pvejayan-84-01be3f8b','WEB-examtopics-7-ab15227c','WEB-examtopics-8-040a54cc']) assert(!code.questionIds.includes(id), 'Code reading/matching is not completion');
  for (const part of parts) {
    const subset = bank.practiceSets.find(s => s.id === part.id + '-code');
    assert.equal(subset.parentId, part.id);
    assert.deepEqual(subset.questionIds, part.questionIds.filter(id => byId.get(id).isCodeCompletion));
    assert(part.questionIds.every(id => byId.get(id).examDomainId === part.id));
  }
  assert.deepEqual(sorted(code.questionIds), sorted(scored.filter(q => q.isCodeCompletion).map(q => q.id)));
  assert.deepEqual(coverage.examPractice.sets, Object.fromEntries(bank.practiceSets.map(s => [s.id, s.questionIds.length])));
  assert.equal(coverage.examPractice.codeCompletionBlanks, 105);

  const state = core.freshState(bank);
  for (const set of bank.practiceSets) {
    const order = core.beginSetOrder(bank, state, set.id, false, seeded(103));
    assert.deepEqual(order, core.shuffle(set.questionIds, seeded(103)), set.id + ' Fisher–Yates');
    assert.deepEqual(sorted(order), sorted(set.questionIds));
    assert.deepEqual(core.setQuestions(bank, state, set.id, {}, noRandom).map(q => q.id), order);
    for (const source of Object.keys(bank.sourceCounts)) assert.deepEqual(core.setQuestions(bank, state, set.id, { source }, noRandom).map(q => q.id), order.filter(id => byId.get(id).sourceId === source));
    state.setPositions[set.id] = order[order.length - 1];
  }
  const q = byId.get(state.setOrders.D2[0]), record = state.records[q.id] = { note: 'Exam-part note', bookmark: true };
  core.beginAttempt(q, record, false, seeded(9)); record.draft = core.clone(q.correct); record.evaluation = core.grade(q, q.correct);
  core.toggleConfused(record, '2099-01-01T00:00:00Z');
  assert.deepEqual(core.setQuestions(bank, state, 'D2', { status:'confused' }, noRandom).map(q => q.id), [q.id]);
  const resumed = core.validateBackup(core.clone(state), bank);
  assert.deepEqual(resumed.setOrders, state.setOrders);
  assert.deepEqual(resumed.setPositions, state.setPositions);
  assert.deepEqual(resumed.records[q.id].presentation, record.presentation);
  assert.deepEqual(resumed.records[q.id].draft, record.draft);
  assert(resumed.records[q.id].evaluation.correct && resumed.records[q.id].bookmark && resumed.records[q.id].confused);
  assert.equal(resumed.records[q.id].note, record.note);
  const old = core.clone(state); delete old.setPositions; delete old.setOrders;
  const migrated = core.validateBackup(old, bank);
  assert.deepEqual(migrated.setPositions, {}); assert.deepEqual(migrated.setOrders, {});
  assert.deepEqual(migrated.records, resumed.records, 'Older notebooks lose no answers or notes');
  assert.deepEqual(core.mergeStates(state, migrated, bank).setOrders, state.setOrders);
  const incoming = core.freshState(bank);
  core.beginSetOrder(bank, incoming, 'D2', true, seeded(4)); incoming.setPositions.D2 = incoming.setOrders.D2[1];
  assert.deepEqual(core.mergeStates(state, incoming, bank).setOrders, state.setOrders, 'Local saved queues win on import');
  assert.deepEqual(core.mergeStates(state, incoming, bank).setPositions, state.setPositions);
  assert.deepEqual(core.mergeStates(migrated, incoming, bank).setOrders.D2, incoming.setOrders.D2, 'Missing local queues import');
  const other = byId.get(parts.find(s => s.id === 'D1').questionIds[0]);
  for (const field of ['setOrders','setPositions']) {
    for (const value of [null, [], { unknown: field === 'setOrders' ? [] : q.id }, { D2: field === 'setOrders' ? [other.id] : other.id }, { D2: field === 'setOrders' ? ['__proto__'] : '__proto__' }]) {
      const bad = core.clone(state); bad[field] = value;
      assert.throws(() => core.validateBackup(bad, bank), /practice set/);
    }
  }
  const duplicated = core.clone(state); duplicated.setOrders.D2.push(q.id);
  assert.throws(() => core.validateBackup(duplicated, bank), /practice set/);
  const retired = core.clone(state); retired.setOrders.D2.push('retired-exam-item'); retired.records['retired-exam-item'] = { note:'Retired exam note', bookmark:true };
  const kept = core.validateBackup(retired, bank);
  assert(!kept.setOrders.D2.includes('retired-exam-item')); assert.equal(kept.retiredRecords['retired-exam-item'].note, 'Retired exam note');
  const previous = core.clone(state);
  const next = core.beginSetOrder(bank, state, 'D2', true, seeded(7));
  assert.notDeepEqual(next, previous.setOrders.D2);
  assert.deepEqual(state.records, previous.records, 'Remixing does not reset answers or presentations');
  assert.deepEqual(state.setPositions, previous.setPositions);
  const expanded = core.clone(bank), added = { ...core.clone(q), id:'added-exam-item' };
  expanded.questions.push(added); expanded.groups.find(g => g.id === added.groupId).questionIds.push(added.id);
  expanded.practiceSets.find(s => s.id === 'D2').questionIds.push(added.id);
  assert.deepEqual(core.beginSetOrder(expanded, state, 'D2', false, seeded(2)), [...next, added.id]);
  assert.deepEqual(core.beginSetOrder(bank, state, 'D2', false, noRandom), next);
  assert.throws(() => core.beginSetOrder(bank, state, 'unknown'), /Unknown/);
  for (const caseQ of scored.filter(q => q.caseId)) assert(all.includes(caseQ.id) && bank.cases.some(c => c.id === caseQ.caseId), 'Mixed case tasks retain their resolvable narrative');

  // The previously published #30 key must never become mastery of its new runtime.
  const repaired = byId.get('WEB-examtopics-30-6a709e3f');
  const oldVersion = 'topics-2026-10-07-a6821885d9a1';
  const oldHash = bank.migrationBanks[oldVersion][repaired.id];
  const original = bank.contentHistory.find(x => x.id === repaired.id && x.contentHash === oldHash);
  assert(original && original.contentHash !== repaired.contentHash);
  assert(repaired.localRevision.material && repaired.localRevision.date === '2026-10-08');
  assert(!repaired.images?.length && repaired.code.includes('openai_client.responses.create'));
  assert(repaired.references.some(r => r.url === 'https://learn.microsoft.com/en-us/rest/api/aifoundry/project/responses'));
  const filled = repaired.code.replace(/\{\{(.*?)\}\}/g, (_, id) => repaired.rows.find(r => r.id === id).options.find(o => o.id === repaired.correct[id]).text);
  assert(filled.includes('tool_choice="required"'));
  assert(filled.includes('model=deployment_name') && !filled.includes('assistant_id'));
  const backup = core.freshState(bank); backup.bankVersion = oldVersion; delete backup.setOrders; delete backup.setPositions;
  backup.records[repaired.id] = { draft:core.clone(original.correct), evaluation:core.grade(original, original.correct), attempts:1, correctCount:1, bookmark:true, note:'Old code note', confused:true, confusedAt:'2099-01-01T00:00:00Z' };
  const unchanged = byId.get(parts[0].questionIds[0]);
  backup.records[unchanged.id] = { draft:core.clone(unchanged.correct), evaluation:core.grade(unchanged, unchanged.correct), bookmark:true, note:'Unchanged note' };
  const updated = core.validateBackup(backup, bank);
  const preserved = updated.records[repaired.id];
  assert.equal(preserved.evaluation, undefined); assert.equal(preserved.draft, undefined); assert.equal(preserved.attempts, 0);
  assert.equal(preserved.history[0].contentHash, oldHash); assert(preserved.history[0].evaluation.correct);
  assert(preserved.confused && preserved.bookmark); assert.equal(preserved.note, 'Old code note');
  assert(updated.records[unchanged.id].evaluation.correct); assert.equal(updated.records[unchanged.id].note, 'Unchanged note');
  assert.deepEqual(core.validateBackup(core.clone(updated), bank), updated);
};
