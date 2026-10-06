(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function validAnswer(q, answer, complete = false) {
    if (q.type === 'rows') {
      if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return false;
      if (Object.keys(answer).some(id => !q.rows.some(row => row.id === id))) return false;
      for (const row of q.rows) {
        const value = answer[row.id];
        if (value !== undefined && !row.options.some(o => o.id === value)) return false;
        if (complete && value === undefined) return false;
      }
      return true;
    }
    if (!Array.isArray(answer) || new Set(answer).size !== answer.length || answer.some(id => !q.options.some(o => o.id === id))) return false;
    if (q.type === 'single' && answer.length > 1) return false;
    if (q.type === 'multi' && answer.length > q.selectCount) return false;
    if (q.type === 'ordering' && answer.length !== q.options.length) return false;
    if (!complete) return true;
    return q.type === 'multi' ? answer.length === q.selectCount : answer.length > 0;
  }
  function grade(q, answer) {
    if (!validAnswer(q, answer, true)) throw Error('Complete the required selections first.');
    let earned = 0, possible = 1;
    if (q.type === 'rows') {
      possible = q.rows.length;
      earned = q.rows.filter(row => answer[row.id] === q.correct[row.id]).length;
    } else {
      const selected = q.type === 'ordering' ? answer : [...answer].sort();
      const expected = q.type === 'ordering' ? q.correct : [...q.correct].sort();
      earned = equal(selected, expected) ? 1 : 0;
    }
    return { earned, possible, correct: earned === possible, selected: clone(answer), contentHash: q.contentHash, at: new Date().toISOString() };
  }
  const freshState = bank => ({ schemaVersion: 1, bankVersion: bank.bankVersion, records: {}, learnedGroupIds: [], positions: {}, preferences: { source: 'all', status: 'all', related: false }, lastGroup: null });
  function validateBackup(value, bank) {
    if (!value || value.schemaVersion !== 1 || value.bankVersion !== bank.bankVersion) throw Error('Backup is for a different bank version. Keep the matching app/bank.');
    const byId = new Map(bank.questions.map(q => [q.id, q]));
    const groupIds = new Set(bank.groups.map(g => g.id));
    if (!value.records || typeof value.records !== 'object' || Array.isArray(value.records) || Object.keys(value.records).length > bank.questions.length) throw Error('Invalid question records.');
    for (const [id, record] of Object.entries(value.records)) {
      const q = byId.get(id);
      if (!q || !record || typeof record !== 'object' || Array.isArray(record)) throw Error('Unknown or invalid question: ' + id);
      if (record.note !== undefined && (typeof record.note !== 'string' || record.note.length > 10000)) throw Error('Invalid note.');
      if (record.bookmark !== undefined && typeof record.bookmark !== 'boolean') throw Error('Invalid bookmark.');
      if (record.draft !== undefined && !validAnswer(q, record.draft)) throw Error('Invalid saved answer: ' + id);
      for (const k of ['attempts', 'correctCount', 'wrongCount']) if (record[k] !== undefined && (!Number.isSafeInteger(record[k]) || record[k] < 0)) throw Error('Invalid attempt count.');
      if (record.evaluation) {
        const e = record.evaluation;
        if (e.contentHash !== q.contentHash || !Number.isFinite(Date.parse(e.at))) throw Error('Answer content/version mismatch: ' + id);
        const computed = grade(q, e.selected);
        if (computed.earned !== e.earned || computed.possible !== e.possible || computed.correct !== e.correct) throw Error('Invalid stored evaluation: ' + id);
      }
    }
    if (!Array.isArray(value.learnedGroupIds) || new Set(value.learnedGroupIds).size !== value.learnedGroupIds.length || value.learnedGroupIds.some(id => !groupIds.has(id))) throw Error('Invalid learned families.');
    if (!value.positions || typeof value.positions !== 'object' || Array.isArray(value.positions)) throw Error('Invalid saved positions.');
    for (const [group, id] of Object.entries(value.positions)) if (!groupIds.has(group) || !byId.has(id)) throw Error('Invalid family position.');
    const p = value.preferences;
    if (!p || !['all', 'authored', 'guide', 'legacy', 'sefstratiou', 'pvejayan', 'examtopics'].includes(p.source) || !['all', 'unanswered', 'wrong', 'bookmarked'].includes(p.status) || typeof p.related !== 'boolean') throw Error('Invalid filters.');
    if (value.lastGroup !== null && !groupIds.has(value.lastGroup)) throw Error('Invalid last family.');
    // Return a whitelisted copy; never merge arbitrary JSON into app objects.
    const safe = freshState(bank);
    safe.learnedGroupIds = [...value.learnedGroupIds];
    safe.positions = Object.fromEntries(Object.entries(value.positions));
    safe.preferences = { source: p.source, status: p.status, related: p.related };
    safe.lastGroup = value.lastGroup;
    for (const [id, record] of Object.entries(value.records)) {
      safe.records[id] = Object.fromEntries(['draft', 'evaluation', 'bookmark', 'note', 'attempts', 'correctCount', 'wrongCount'].filter(k => record[k] !== undefined).map(k => [k, clone(record[k])]));
    }
    return safe;
  }
  function mergeStates(current, imported, bank) {
    const a = validateBackup(current, bank), b = validateBackup(imported, bank);
    for (const [id, incoming] of Object.entries(b.records)) {
      const local = a.records[id];
      if (!local) { a.records[id] = incoming; continue; }
      const newer = incoming.evaluation && (!local.evaluation || Date.parse(incoming.evaluation.at) > Date.parse(local.evaluation.at));
      const merged = newer ? { ...local, ...incoming } : { ...incoming, ...local };
      merged.bookmark = !!(local.bookmark || incoming.bookmark);
      merged.note = !local.note ? (incoming.note || '') : !incoming.note || local.note === incoming.note ? local.note : local.note + '\n\nImported note:\n' + incoming.note;
      if (merged.note.length > 10000) throw Error('Combined note exceeds 10,000 characters; shorten it before importing.');
      // Backups may overlap. Use max counts, never double-count shared history.
      for (const k of ['attempts', 'correctCount', 'wrongCount']) merged[k] = Math.max(local[k] || 0, incoming[k] || 0);
      a.records[id] = merged;
    }
    a.learnedGroupIds = [...new Set([...a.learnedGroupIds, ...b.learnedGroupIds])];
    a.positions = { ...b.positions, ...a.positions };
    return validateBackup(a, bank);
  }
  function selectQuestions(bank, state, { groupId, source = 'all', status = 'all', related = false, search = '' } = {}) {
    const group = bank.groups.find(g => g.id === groupId);
    const order = group ? group.questionIds : bank.groups.flatMap(g => g.questionIds);
    const byId = new Map(bank.questions.map(q => [q.id, q]));
    const ids = related && group ? [...order, ...bank.questions.filter(q => q.relatedGroupIds.includes(groupId)).map(q => q.id)] : order;
    return [...new Set(ids)].map(id => byId.get(id)).filter(q => {
      const record = state.records[q.id] || {};
      return (source === 'all' || q.sourceId === source) &&
        (status === 'all' || status === 'unanswered' && !record.evaluation || status === 'wrong' && record.evaluation?.correct === false || status === 'bookmarked' && record.bookmark) &&
        (!search || [q.stem, q.sourceLabel, q.code || '', ...q.options.map(o => o.text), ...(q.rows || []).map(r => r.text)].join(' ').toLowerCase().includes(search.toLowerCase()));
    });
  }
  function caseQuestions(bank, caseId) {
    const study = bank.cases.find(c => c.id === caseId);
    if (!study) return [];
    const order = new Map((study.questionIds || []).map((id, index) => [id, index]));
    return bank.questions.filter(q => q.caseId === caseId).sort((a, b) =>
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
      String(a.sourceQuestionId || a.id).localeCompare(String(b.sourceQuestionId || b.id), undefined, { numeric: true }));
  }
  root.TopicCore = { equal, clone, validAnswer, grade, freshState, validateBackup, mergeStates, selectQuestions, caseQuestions };
  if (typeof module !== 'undefined') module.exports = root.TopicCore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
