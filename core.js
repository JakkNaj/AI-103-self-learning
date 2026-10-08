(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sources = ['all', 'authored', 'guide', 'legacy', 'sefstratiou', 'pvejayan', 'examtopics'];
  const statuses = ['all', 'unanswered', 'wrong', 'bookmarked', 'confused'];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const safeId = id => typeof id === 'string' && id.length <= 200 && !['__proto__', 'constructor', 'prototype'].includes(id);
  function validAnswer(q, answer, complete = false) {
    if (q.type === 'rows') {
      if (!object(answer) || Object.keys(answer).some(id => !q.rows.some(row => row.id === id))) return false;
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
    return !complete || (q.type === 'multi' ? answer.length === q.selectCount : answer.length > 0);
  }
  function grade(q, answer) {
    if (q.scored === false) throw Error('This question is unresolved and excluded from scored practice.');
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
  // Fisher–Yates. IDs move with their text; letters belong only to presentation.
  function shuffle(ids, random = Math.random) {
    const result = [...ids];
    for (let i = result.length - 1; i > 0; i--) {
      const n = random(); if (!(n >= 0 && n < 1)) throw Error('Invalid random value.');
      const j = Math.floor(n * (i + 1)); [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function newPresentation(q, random = Math.random) {
    return { contentHash: q.contentHash, options: shuffle(q.options.map(o => o.id), random),
      rows: Object.fromEntries((q.rows || []).map(row => [row.id, shuffle(row.options.map(o => o.id), random)])) };
  }
  const permutation = (ids, options) => Array.isArray(ids) && ids.length === options.length && new Set(ids).size === ids.length && ids.every(id => options.some(o => o.id === id));
  function validPresentation(q, p) {
    return object(p) && p.contentHash === q.contentHash && permutation(p.options, q.options) && object(p.rows) &&
      Object.keys(p.rows).length === (q.rows || []).length && (q.rows || []).every(row => permutation(p.rows[row.id], row.options));
  }
  function beginAttempt(q, record, fresh = false, random = Math.random) {
    if (fresh || !validPresentation(q, record.presentation)) {
      record.presentation = newPresentation(q, random); record.attemptAt = new Date().toISOString();
      if (fresh) record.draftAt = record.attemptAt;
    }
    record.contentHash = q.contentHash;
    if (fresh || record.draft === undefined) record.draft = q.type === 'rows' ? {} : q.type === 'ordering' ? [...record.presentation.options] : [];
    return record.presentation;
  }
  function presentedOptions(q, record, row) {
    const choices = row ? row.options : q.options, ids = row ? record.presentation.rows[row.id] : record.presentation.options;
    return ids.map((id, index) => ({ ...choices.find(o => o.id === id), label: String.fromCharCode(65 + index) }));
  }
  function toggleConfused(record, at = new Date().toISOString()) {
    if (!date(at)) throw Error('Invalid confusion timestamp.');
    record.confused = !record.confused;
    // Explicit false is a tombstone. Older/missing information cannot resurrect it.
    record.confusedAt = new Date(Math.max(Date.parse(at), (Date.parse(record.confusedAt || '') || 0) + 1)).toISOString(); return record.confused;
  }
  const freshState = bank => ({ schemaVersion: 2, bankVersion: bank.bankVersion, records: {}, retiredRecords: {}, learnedGroupIds: [], positions: {}, topicPositions: {}, topicOrders: {}, setPositions: {}, setOrders: {}, preferences: { source: 'all', status: 'all', related: false, reviewTopic: 'all' }, lastGroup: null });
  function definition(bank, q, hash) {
    return q.contentHash === hash ? q : (bank.contentHistory || []).find(old => old.id === q.id && old.contentHash === hash);
  }
  function checkedEvaluation(q, e) {
    if (!object(e) || e.contentHash !== q.contentHash || !date(e.at)) throw Error('Answer content/version mismatch: ' + q.id);
    const result = grade({ ...q, scored: true }, e.selected);
    if (result.earned !== e.earned || result.possible !== e.possible || result.correct !== e.correct) throw Error('Invalid stored evaluation: ' + q.id);
    return { ...result, at: e.at };
  }
  function safeRecord(record) {
    if (!object(record)) throw Error('Invalid question record.');
    const safe = {};
    if (record.note !== undefined) {
      if (typeof record.note !== 'string' || record.note.length > 10000) throw Error('Invalid note.'); safe.note = record.note;
    }
    for (const k of ['bookmark', 'confused']) if (record[k] !== undefined) {
      if (typeof record[k] !== 'boolean') throw Error('Invalid ' + k + '.'); safe[k] = record[k];
    }
    if (record.confusedAt !== undefined) {
      if (!date(record.confusedAt) || record.confused === undefined) throw Error('Invalid confusion change.'); safe.confusedAt = record.confusedAt;
    }
    for (const k of ['attemptAt', 'draftAt']) if (record[k] !== undefined) {
      if (!date(record[k])) throw Error('Invalid attempt timestamp.'); safe[k] = record[k];
    }
    for (const k of ['attempts', 'correctCount', 'wrongCount']) if (record[k] !== undefined) {
      if (!Number.isSafeInteger(record[k]) || record[k] < 0) throw Error('Invalid attempt count.'); safe[k] = record[k];
    }
    return safe;
  }
  function snapshot(q, record) {
    const item = { contentHash: q.contentHash };
    for (const k of ['draft', 'evaluation', 'presentation', 'attemptAt', 'draftAt', 'attempts', 'correctCount', 'wrongCount']) if (record[k] !== undefined) item[k] = clone(record[k]);
    return item;
  }
  function validateAttempt(q, value) {
    if (!object(value)) throw Error('Invalid attempt.');
    const safe = snapshot(q, safeRecord(value));
    if (value.draft !== undefined) {
      if (!validAnswer(q, value.draft)) throw Error('Invalid saved answer: ' + q.id); safe.draft = clone(value.draft);
    }
    if (value.evaluation !== undefined) safe.evaluation = checkedEvaluation(q, value.evaluation);
    if (value.presentation !== undefined) {
      if (!validPresentation(q, value.presentation)) throw Error('Invalid answer order: ' + q.id); safe.presentation = clone(value.presentation);
    }
    return safe;
  }
  function retiredRecord(value) {
    const safe = safeRecord(value);
    // Unknown/retired records are never graded. Preserve only bounded JSON data.
    for (const k of ['draft', 'evaluation', 'presentation', 'history', 'contentHash']) if (value[k] !== undefined) {
      const serialized = JSON.stringify(value[k]);
      if (serialized.length > 2000000) throw Error('Retired record is too large.');
      safe[k] = clone(value[k]);
    }
    return safe;
  }
  function validateBackup(value, bank) {
    if (!object(value) || ![1, 2].includes(value.schemaVersion) || ![bank.bankVersion, ...(bank.compatibleBankVersions || [])].includes(value.bankVersion)) throw Error('Unsupported backup bank/version. Keep this file; no data was replaced.');
    const byId = new Map(bank.questions.map(q => [q.id, q])), groupIds = new Set(bank.groups.map(g => g.id));
    if (!object(value.records) || Object.keys(value.records).length > 10000) throw Error('Invalid question records.');
    const safe = freshState(bank);
    if (value.retiredRecords !== undefined && (!object(value.retiredRecords) || Object.keys(value.retiredRecords).length > 10000)) throw Error('Invalid retired records.');
    for (const [id, r] of Object.entries(value.retiredRecords || {})) {
      if (!safeId(id)) throw Error('Invalid retired ID.'); safe.retiredRecords[id] = retiredRecord(r);
    }
    for (const [id, record] of Object.entries(value.records)) {
      if (!safeId(id)) throw Error('Invalid question ID.');
      const q = byId.get(id); if (!q) { safe.retiredRecords[id] = retiredRecord(record); continue; }
      const r = safeRecord(record), histories = record.history || [];
      if (!Array.isArray(histories) || histories.length > 10000) throw Error('Invalid history: ' + id);
      r.history = histories.map(h => {
        const old = object(h) && definition(bank, q, h.contentHash);
        if (!old) throw Error('Unknown historical content: ' + id); return validateAttempt(old, h);
      });
      const legacyHash = bank.migrationBanks?.[value.bankVersion]?.[id] || q.contentHash;
      const hash = record.contentHash || record.evaluation?.contentHash || (value.bankVersion !== bank.bankVersion ? legacyHash : q.contentHash);
      const old = definition(bank, q, hash); if (!old) throw Error('Unknown saved content: ' + id);
      const attempt = validateAttempt(old, record);
      r.contentHash = q.contentHash;
      if (old.contentHash !== q.contentHash || q.scored === false) {
        if (attempt.draft !== undefined || attempt.evaluation || attempt.attempts) r.history.push(attempt);
        // Notes, bookmarks and explicit confusion changes survive. Revised drafts do not.
        r.attempts = r.correctCount = r.wrongCount = 0;
        delete r.attemptAt; delete r.draftAt;
      } else Object.assign(r, attempt);
      safe.records[id] = r;
    }
    if (!Array.isArray(value.learnedGroupIds) || new Set(value.learnedGroupIds).size !== value.learnedGroupIds.length || value.learnedGroupIds.some(id => !groupIds.has(id))) throw Error('Invalid learned families.');
    // A manually learned family remains the user's assessment; question mastery is reset separately.
    safe.learnedGroupIds = [...value.learnedGroupIds];
    if (!object(value.positions)) throw Error('Invalid saved positions.');
    for (const [group, id] of Object.entries(value.positions)) {
      if (!groupIds.has(group) || typeof id !== 'string') throw Error('Invalid family position.');
      if (byId.has(id)) safe.positions[group] = id;
    }
    // Optional in older notebooks; topic progress is independent of family positions.
    const topicPositions = value.topicPositions === undefined ? {} : value.topicPositions;
    if (!object(topicPositions)) throw Error('Invalid topic positions.');
    for (const [topic, id] of Object.entries(topicPositions)) {
      if (!bank.topics.some(t => t.id === topic) || typeof id !== 'string' || byId.has(id) && byId.get(id).topicId !== topic) throw Error('Invalid topic position.');
      if (byId.has(id)) safe.topicPositions[topic] = id;
    }
    // Older notebooks have no mixed sequence. Answers are stored separately by ID.
    const topicOrders = value.topicOrders === undefined ? {} : value.topicOrders;
    if (!object(topicOrders)) throw Error('Invalid topic orders.');
    for (const [topic, ids] of Object.entries(topicOrders)) {
      if (!bank.topics.some(t => t.id === topic) || !Array.isArray(ids) || ids.length > 10000 || new Set(ids).size !== ids.length || ids.some(id => !safeId(id) || byId.has(id) && byId.get(id).topicId !== topic)) throw Error('Invalid topic order.');
      safe.topicOrders[topic] = ids.filter(id => byId.has(id) && byId.get(id).scored !== false);
    }
    const practiceSets = new Map((bank.practiceSets || []).map(s => [s.id, new Set(s.questionIds)]));
    for (const field of ['setPositions','setOrders']) {
      const values = value[field] === undefined ? {} : value[field];
      if (!object(values)) throw Error('Invalid practice set '+field+'.');
      for (const [setId, entry] of Object.entries(values)) {
        const members = practiceSets.get(setId), ids = field === 'setOrders' ? entry : [entry];
        if (!members || !Array.isArray(ids) || ids.length > 10000 || new Set(ids).size !== ids.length || ids.some(id => !safeId(id) || byId.has(id) && byId.get(id).scored !== false && !members.has(id))) throw Error('Invalid practice set '+field+'.');
        const kept = ids.filter(id => members.has(id));
        if (field === 'setOrders') safe[field][setId] = kept;
        else if (kept.length) safe[field][setId] = kept[0];
      }
    }
    const p = value.preferences;
    if (!object(p) || !sources.includes(p.source) || !statuses.includes(p.status) || typeof p.related !== 'boolean') throw Error('Invalid filters.');
    if (p.reviewTopic !== undefined && p.reviewTopic !== 'all' && !bank.topics.some(t => t.id === p.reviewTopic)) throw Error('Invalid review topic.');
    safe.preferences = { source: p.source, status: p.status, related: p.related, reviewTopic: p.reviewTopic || 'all' };
    if (value.lastGroup !== null && !groupIds.has(value.lastGroup)) throw Error('Invalid last family.'); safe.lastGroup = value.lastGroup;
    return safe;
  }
  function mergeRecord(local, incoming) {
    if (!local) return clone(incoming);
    const activity = r => Math.max(...[r.evaluation?.at, r.attemptAt, r.draftAt].map(v => Date.parse(v || '') || 0));
    const newer = activity(incoming) > activity(local) || (!activity(local) && local.draft === undefined && incoming.draft !== undefined);
    const merged = newer ? { ...local, ...incoming } : { ...incoming, ...local };
    // Keep a chosen draft and its presentation together, even when another backup has no evaluation.
    const chosen = newer ? incoming : local;
    for (const k of ['draft', 'presentation', 'evaluation', 'attemptAt', 'draftAt']) { delete merged[k]; if (chosen[k] !== undefined) merged[k] = clone(chosen[k]); }
    merged.bookmark = !!(local.bookmark || incoming.bookmark);
    merged.note = !local.note ? incoming.note || '' : !incoming.note || local.note === incoming.note ? local.note : local.note + '\n\nImported note:\n' + incoming.note;
    if (merged.note.length > 10000) throw Error('Combined note exceeds 10,000 characters; shorten it before importing.');
    const la = Date.parse(local.confusedAt || '') || 0, ia = Date.parse(incoming.confusedAt || '') || 0;
    const confusion = ia > la ? incoming : la > ia ? local : local.confused === false ? local : incoming.confused === false ? incoming : local.confused !== undefined ? local : incoming;
    delete merged.confused; delete merged.confusedAt;
    if (confusion.confused !== undefined) merged.confused = confusion.confused;
    if (confusion.confusedAt !== undefined) merged.confusedAt = confusion.confusedAt;
    for (const k of ['attempts', 'correctCount', 'wrongCount']) merged[k] = Math.max(local[k] || 0, incoming[k] || 0);
    const history = [...(local.history || []), ...(incoming.history || [])];
    const other = newer ? local : incoming;
    if ((other.evaluation || other.draft !== undefined) && !equal(snapshot({ contentHash: chosen.contentHash }, chosen), snapshot({ contentHash: other.contentHash }, other))) history.push(snapshot({ contentHash: other.contentHash }, other));
    merged.history = [...new Map(history.map(h => [JSON.stringify(h), h])).values()];
    return merged;
  }
  function mergeStates(current, imported, bank) {
    const a = validateBackup(current, bank), b = validateBackup(imported, bank);
    for (const field of ['records', 'retiredRecords']) for (const [id, incoming] of Object.entries(b[field])) a[field][id] = mergeRecord(a[field][id], incoming);
    a.learnedGroupIds = [...new Set([...a.learnedGroupIds, ...b.learnedGroupIds])]; a.positions = { ...b.positions, ...a.positions };
    a.topicPositions = { ...b.topicPositions, ...a.topicPositions };
    a.topicOrders = { ...b.topicOrders, ...a.topicOrders };
    a.setPositions = { ...b.setPositions, ...a.setPositions };
    a.setOrders = { ...b.setOrders, ...a.setOrders };
    return validateBackup(a, bank);
  }
  function matchesStatus(q, record, status) {
    return status === 'all' || status === 'unanswered' && !record.evaluation || status === 'wrong' && record.evaluation?.correct === false || status === 'bookmarked' && record.bookmark || status === 'confused' && record.confused === true;
  }
  function selectQuestions(bank, state, { groupId, source = 'all', status = 'all', related = false, search = '', topicId = 'all', includeUnresolved = false } = {}) {
    const group = bank.groups.find(g => g.id === groupId), order = group ? group.questionIds : bank.groups.flatMap(g => g.questionIds);
    const byId = new Map(bank.questions.map(q => [q.id, q]));
    const ids = related && group ? [...order, ...bank.questions.filter(q => (q.relatedGroupIds || []).includes(groupId)).map(q => q.id)] : order;
    return [...new Set(ids)].map(id => byId.get(id)).filter(q => q && (includeUnresolved || q.scored !== false) &&
      (!topicId || topicId === 'all' || q.topicId === topicId) && (source === 'all' || q.sourceId === source) && matchesStatus(q, state.records[q.id] || {}, status) &&
      (!search || [q.stem, q.sourceLabel, q.code || '', ...q.options.map(o => o.text), ...(q.rows || []).map(r => r.text)].join(' ').toLowerCase().includes(search.toLowerCase())));
  }
  function caseQuestions(bank, caseId, includeUnresolved = false) {
    const study = bank.cases.find(c => c.id === caseId); if (!study) return [];
    const order = new Map((study.questionIds || []).map((id, index) => [id, index]));
    return bank.questions.filter(q => q.caseId === caseId && (includeUnresolved || q.scored !== false)).sort((a, b) =>
      (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) || String(a.sourceQuestionId || a.id).localeCompare(String(b.sourceQuestionId || b.id), undefined, { numeric: true }));
  }
  function beginTopicOrder(bank, state, topicId, fresh = false, random = Math.random) {
    if (!bank.topics.some(t => t.id === topicId)) throw Error('Unknown topic.');
    const ids = selectQuestions(bank, state, { topicId }).map(q => q.id), eligible = new Set(ids);
    state.topicOrders ||= {};
    // Keep the saved sequence; newly added questions join its end. Filters never reshuffle it.
    const saved = fresh ? [] : (state.topicOrders[topicId] || []).filter(id => eligible.has(id));
    const seen = new Set(saved);
    state.topicOrders[topicId] = [...saved, ...shuffle(ids.filter(id => !seen.has(id)), random)];
    return state.topicOrders[topicId];
  }
  function topicQuestions(bank, state, topicId, { source = 'all', status = 'all' } = {}, random = Math.random) {
    const order = beginTopicOrder(bank, state, topicId, false, random);
    const selected = new Map(selectQuestions(bank, state, { topicId, source, status }).map(q => [q.id, q]));
    return order.filter(id => selected.has(id)).map(id => selected.get(id));
  }
  function beginSetOrder(bank, state, setId, fresh = false, random = Math.random) {
    const set = bank.practiceSets?.find(s => s.id === setId); if (!set) throw Error('Unknown practice set.');
    const eligible = new Set(selectQuestions(bank, state).map(q => q.id));
    const ids = set.questionIds.filter(id => eligible.has(id)); state.setOrders ||= {};
    const members = new Set(ids), saved = fresh ? [] : (state.setOrders[setId] || []).filter(id => members.has(id));
    const seen = new Set(saved);
    state.setOrders[setId] = [...saved, ...shuffle(ids.filter(id => !seen.has(id)), random)];
    return state.setOrders[setId];
  }
  function setQuestions(bank, state, setId, { source = 'all', status = 'all' } = {}, random = Math.random) {
    const order = beginSetOrder(bank, state, setId, false, random);
    const selected = new Map(selectQuestions(bank, state, { source, status }).map(q => [q.id,q]));
    return order.filter(id => selected.has(id)).map(id => selected.get(id));
  }
  root.TopicCore = { equal, clone, validAnswer, grade, shuffle, newPresentation, validPresentation, beginAttempt, presentedOptions, toggleConfused, snapshot, freshState, validateBackup, mergeStates, selectQuestions, caseQuestions, matchesStatus, beginTopicOrder, topicQuestions, beginSetOrder, setQuestions };
  if (typeof module !== 'undefined') module.exports = root.TopicCore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
