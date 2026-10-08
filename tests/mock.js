module.exports = function (bank, core) {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const byId = new Map(bank.questions.map(q => [q.id,q]));
  const mock = bank.practiceSets.find(s => s.kind === 'mock');
  const seeded = initial => { let n = initial; return () => { n = (1664525*n+1013904223)>>>0; return n/4294967296; }; };
  const noRandom = () => { throw Error('Resume must not draw another mock.'); };
  const assertCoverage = ids => {
    assert.equal(ids.length,mock.questionCount);
    assert.equal(new Set(ids).size,ids.length);
    for (const group of bank.groups) assert.equal(ids.filter(id => byId.get(id).groupId===group.id).length,2,group.id);
    for (const topic of bank.topics) assert.equal(ids.filter(id => byId.get(id).topicId===topic.id).length,topic.groupIds.length*2,topic.id);
    assert(ids.every(id => byId.get(id).scored !== false));
  };
  assert.equal(mock.id,'mock'); assert.equal(mock.questionsPerFamily,2); assert.equal(mock.questionCount,216);
  assert.equal(mock.questionCount,bank.groups.length*2);
  assert.deepEqual([...mock.questionIds].sort(),bank.questions.filter(q => q.scored!==false).map(q => q.id).sort());
  const supplemental = JSON.parse(fs.readFileSync(path.join(__dirname,'../sources/supplemental-questions.json')));
  assert.equal(supplemental.length,3);
  for (const q of supplemental) {
    const current=byId.get(q.id), group=bank.groups.find(g=>g.id===q.groupId);
    assert.equal(current.sourceId,'authored'); assert.equal(group.scoredQuestionCount,2);
    assert.equal(core.grade(current,current.correct).correct,true);
    assert(current.references.length && current.decisionRule && current.options.every(o=>current.optionReasoning[o.id]));
  }
  const guideFamilies = new Set();
  const guideDir = path.join(__dirname,'../guides');
  for (const name of fs.readdirSync(guideDir).filter(name=>name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(guideDir,name),'utf8');
    for (const match of html.matchAll(/#group=([^\"]+)\">[^<]+<\/a> — (\d+) scored questions/g)) {
      const group = bank.groups.find(g=>g.id===match[1]);
      assert(group && Number(match[2])===group.scoredQuestionCount,'Guide family count must match the compiled bank');
      guideFamilies.add(group.id);
    }
  }
  assert.equal(guideFamilies.size,bank.groups.length,'Every guide family summary is synchronized');
  const state = core.freshState(bank);
  const first=core.beginSetOrder(bank,state,'mock',false,seeded(103)); assertCoverage(first);
  assert.deepEqual(first,core.beginSetOrder(bank,core.freshState(bank),'mock',false,seeded(103)), 'Controlled sampling is reproducible');
  const second=core.beginSetOrder(bank,core.freshState(bank),'mock',true,seeded(9)); assertCoverage(second);
  assert.notDeepEqual(second,first);
  assert.notDeepEqual([...second].sort(),[...first].sort(),'Fresh mocks vary their family question selections');
  assert(first.some(id=>byId.get(id).caseId),'Controlled mock includes case tasks');
  for (const source of Object.keys(bank.sourceCounts)) assert.deepEqual(core.setQuestions(bank,state,'mock',{source,status:'confused'},noRandom).map(q=>q.id),first,'Mock coverage is independent of study filters');
  assert.deepEqual(core.beginSetOrder(bank,state,'mock',false,noRandom),first);
  const partial = core.clone(state); partial.setOrders.mock = first.slice(0,-1);
  const filled = core.beginSetOrder(bank,partial,'mock',false,seeded(4)); assertCoverage(filled);
  assert.deepEqual(filled.slice(0,-1),first.slice(0,-1),'A missing/retired item is replaced without rearranging saved questions');
  const excess = core.clone(state), group = bank.groups.find(g=>g.questionIds.filter(id=>byId.get(id).scored!==false).length>2);
  excess.setOrders.mock.push(group.questionIds.find(id=>!first.includes(id) && byId.get(id).scored!==false));
  assert.throws(()=>core.validateBackup(excess,bank),/mock family coverage/);
  assert.throws(()=>core.beginSetOrder(bank,excess,'mock',false,noRandom),/two distinct/);
  const insufficient = core.clone(bank), shortGroup = insufficient.groups[0];
  insufficient.practiceSets.find(s=>s.id==='mock').questionIds = mock.questionIds.filter(id=>byId.get(id).groupId!==shortGroup.id || id===shortGroup.questionIds[0]);
  assert.throws(()=>core.beginSetOrder(insufficient,core.freshState(insufficient),'mock',true,seeded(1)),/two distinct/);

  const oldQ=byId.get(first[0]), old=state.records[oldQ.id]={note:'Keep mock note',bookmark:true,confused:true,confusedAt:'2026-10-01T00:00:00Z'};
  core.beginAttempt(oldQ,old,false,seeded(4)); old.draft=core.clone(oldQ.correct); old.evaluation=core.grade(oldQ,old.draft); old.evaluation.at='2026-10-01T00:00:00Z'; old.attemptAt=old.draftAt=old.evaluation.at;
  state.setPositions.mock=oldQ.id;
  const resumed=core.validateBackup(core.clone(state),bank);
  assert.deepEqual(resumed.setOrders.mock,first); assert.equal(resumed.setPositions.mock,oldQ.id);
  assert.deepEqual(resumed.records[oldQ.id].presentation,old.presentation); assert(resumed.records[oldQ.id].evaluation.correct);
  const before=core.clone(state);
  const fresh=core.beginMockAttempt(bank,state,seeded(103)); assertCoverage(fresh);
  assert.deepEqual(fresh,first); assert.equal(state.setPositions.mock,first[0]);
  for (const id of fresh) {
    assert(!state.records[id].evaluation,'Fresh test must not reveal a previous key');
    assert(core.validPresentation(byId.get(id),state.records[id].presentation));
  }
  const reset=state.records[oldQ.id];
  assert.equal(reset.note,'Keep mock note'); assert(reset.bookmark && reset.confused);
  assert.equal(reset.history[0].evaluation.correct,true); assert.deepEqual(reset.history[0].draft,oldQ.correct);
  assert.deepEqual(reset.draft,oldQ.type==='rows'?{}:oldQ.type==='ordering'?reset.presentation.options:[]);
  assert(!core.mergeStates(state,before,bank).records[oldQ.id].evaluation,'Importing older answers must not undo the fresh attempt');
  assert.deepEqual(core.validateBackup(core.clone(state),bank).setOrders.mock,first);
  const oldBackup=core.clone(before);delete oldBackup.setOrders.mock;delete oldBackup.setPositions.mock;
  const merged=core.mergeStates(state,oldBackup,bank);assert.deepEqual(merged.setOrders.mock,first);
  assert(merged.records[oldQ.id].confused && merged.records[oldQ.id].bookmark && merged.records[oldQ.id].note==='Keep mock note');
  // Previous published bank version keeps every unchanged record and its exam queue.
  const previous=core.clone(before);previous.bankVersion='topics-2026-10-07-152a43096b19';delete previous.setOrders.mock;delete previous.setPositions.mock;
  const migrated=core.validateBackup(previous,bank);assert(migrated.records[oldQ.id].evaluation.correct);
  assert.equal(migrated.records[oldQ.id].note,'Keep mock note');assert.equal(migrated.records[oldQ.id].confused,true);
};
