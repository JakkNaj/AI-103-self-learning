/* Topic Lab: static, local-first, no account or backend. */
(function () {
  'use strict';
  // This hash router positions practice at its counter instead of restoring a previous page offset.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const bank = window.TOPIC_BANK, core = window.TopicCore;
  const main = document.getElementById('main');
  if (!bank || !core) { main.textContent = 'Study data could not load. Check that data/bank.js and core.js are beside the app.'; return; }
  const questions = new Map(bank.questions.map(q => [q.id, q]));
  const groups = new Map(bank.groups.map(g => [g.id, g]));
  const topics = new Map(bank.topics.map(t => [t.id, t]));
  const cases = new Map(bank.cases.map(c => [c.id, c]));
  const STORE = 'ai103-topic-lab-v1';
  let state = core.freshState(bank), storageError = '', importMessage = '';
  try {
    const saved = localStorage.getItem(STORE);
    if (saved) {
      const value = JSON.parse(saved);
      state = core.validateBackup(value, bank);
    }
  }
  catch (error) { storageError = 'Saved data could not load: ' + error.message + ' Export the existing backup before replacing it.'; }
  let route, queue = null, queueKey = '', compareIds = [], compareRevealed = false;
  let expandedList = false, sessionFeedback = new Set(), toastTimer;
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const heading = value => e(value).replace(/([a-z])([A-Z])/g, '$1<wbr>$2');
  const rich = text => e(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const textBlock = text => '<p style="white-space:pre-line">' + rich(text) + '</p>';
  const record = q => state.records[q.id] || {};
  const sourceNames = { authored: 'Current authored', guide: 'Guide examples', legacy: 'Earlier practice', sefstratiou: 'Sefstratiou', pvejayan: 'Praba Vejayan', examtopics: 'ExamTopics' };
  const statusNames = { all: 'All questions', unanswered: 'Unanswered', wrong: 'Needs review', bookmarked: 'Saved questions', confused: 'Confused' };
  const isImported = q => ['sefstratiou', 'pvejayan', 'examtopics'].includes(q.sourceId);
  const path = (group, mode = 'learn', q) => '#group=' + encodeURIComponent(group) + '&mode=' + mode + (q ? '&q=' + encodeURIComponent(q) : '');
  const topicPath = (id, mode = 'learn', q) => '#topic=' + encodeURIComponent(id) + (mode === 'practice' ? '&mode=practice' : '') + (q ? '&q=' + encodeURIComponent(q) : '');
  const casePath = (id, mode = 'read', q) => '#case=' + encodeURIComponent(id) + '&mode=' + mode + (q ? '&q=' + encodeURIComponent(q) : '');
  const caseTitle = study => study.title.replace(/^Case study:\s*/i, '');
  const pill = (href, label, primary = false) => `<a class="pill${primary ? ' primary' : ''}" href="${e(href)}">${e(label)}</a>`;
  const topicTestLink = id => `<a class="pill primary" data-action="test-topic" href="${e(topicPath(id, 'practice'))}">Test whole topic</a>`;
  const frameLine = () => '<div class="frame-line" aria-hidden="true"><span></span><span></span></div>';
  function detailHero(label, title, description, actions = '') {
    return `<section class="page-title detail-hero"><div class="detail-copy"><p class="eyebrow">${e(label)}</p><h1>${heading(title)}</h1><p>${e(description)}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div><div class="notebook-art detail-art" aria-hidden="true"><div class="orbit"></div><div class="sphere"></div><span class="art-caption">ONE DISTINCTION AT A TIME.</span></div></section>${frameLine()}`;
  }
  function toast(message) {
    const element = document.getElementById('toast'); element.textContent = message; element.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('visible'), 3800);
  }
  function save() {
    if (storageError) { document.getElementById('save-status').textContent = 'Storage issue · export a backup'; return; }
    try { localStorage.setItem(STORE, JSON.stringify(state)); document.getElementById('save-status').textContent = 'Progress saved on this device'; }
    catch (error) { document.getElementById('save-status').textContent = 'Saving unavailable · export a backup'; toast('Could not save on this device. Export a backup from Progress.'); }
  }
  function parseRoute() {
    const hash = location.hash.slice(1), params = new URLSearchParams(hash);
    if (hash === 'cases') return { kind: 'cases' };
    if (params.has('case')) return { kind: 'case', case: params.get('case'), mode: params.get('mode') === 'practice' ? 'practice' : 'read', q: params.get('q') };
    if (params.has('group')) return { kind: 'group', group: params.get('group'), mode: ['learn', 'practice', 'compare'].includes(params.get('mode')) ? params.get('mode') : 'learn', q: params.get('q') };
    if (params.has('topic')) return { kind: 'topic', topic: params.get('topic'), mode: params.get('mode') === 'practice' ? 'practice' : 'learn', q: params.get('q') };
    if (hash === 'progress') return { kind: 'progress' };
    if (hash === 'review' || params.has('review')) return { kind: 'review' };
    if (params.has('practice')) return { kind: 'review-practice', status: ['wrong', 'bookmarked', 'unanswered', 'confused'].includes(params.get('practice')) ? params.get('practice') : 'wrong', q: params.get('q') };
    return { kind: 'home' };
  }
  function stats(ids) {
    const qs = ids.map(id => questions.get(id)).filter(q => q && q.scored !== false);
    return { total: qs.length, checked: qs.filter(q => record(q).evaluation).length, wrong: qs.filter(q => record(q).evaluation?.correct === false).length, saved: qs.filter(q => record(q).bookmark).length, confused: qs.filter(q => record(q).confused).length };
  }
  function groupStats(group) { return stats(group.questionIds); }
  function topicStats(topic) { return stats(topic.groupIds.flatMap(id => groups.get(id).questionIds)); }
  function crumbs(topic, group) {
    return `<div class="breadcrumbs"><a href="#home">All topics</a>${topic ? ` <span>/</span> <a href="#topic=${e(topic.id)}">${e(topic.title)}</a>` : ''}${group ? ` <span>/</span> <span>${e(group.title)}</span>` : ''}</div>`;
  }
  function topicRow(topic) {
    const s = topicStats(topic), learned = topic.groupIds.filter(id => state.learnedGroupIds.includes(id)).length;
    return `<a class="topic-row" href="#topic=${e(topic.id)}"><span class="topic-no">${e(topic.id)}</span><div><h3>${e(topic.title)}</h3><p>${e(topic.description)}</p><span class="meta">${s.total} questions · ${topic.groupIds.length} families${learned ? ` · ${learned} learned` : ''}${s.wrong ? ` · ${s.wrong} to review` : ''}</span></div><span class="arrow" aria-hidden="true">↗</span></a>`;
  }
  function familyRow(group, index) {
    const s = groupStats(group), learned = state.learnedGroupIds.includes(group.id);
    return `<a class="family-row" href="${e(path(group.id))}"><span class="learned-dot${learned ? ' done' : ''}" aria-label="${learned ? 'Learned' : 'Not yet marked learned'}">${learned ? '✓' : String(index + 1).padStart(2, '0')}</span><div><h3>${e(group.title)}</h3><p>${e(group.cue)}</p>${s.wrong ? `<p>${s.wrong} to review</p>` : ''}</div><span class="counter">${s.total} questions ↗</span></a>`;
  }
  function caseRow(study, index) {
    const qs = core.caseQuestions(bank, study.id), s = stats(qs.map(q => q.id));
    const sources = [...new Set(qs.map(q => sourceNames[q.sourceId]))].join(' · ');
    return `<a class="family-row" href="${e(casePath(study.id))}"><span class="topic-no">${String(index + 1).padStart(2, '0')}</span><div><h3>${e(caseTitle(study))}</h3><p>${e(sources)} · ${s.checked} checked${s.wrong ? ` · ${s.wrong} to review` : ''}</p></div><span class="counter">${s.total} tasks ↗</span></a>`;
  }
  function renderCases() {
    const ids = bank.cases.flatMap(study => core.caseQuestions(bank, study.id).map(q => q.id)), s = stats(ids);
    return `<div class="breadcrumbs"><a href="#home">All topics</a><span>/</span><span>Case studies</span></div><div class="page-title"><div class="grain-ribbon" aria-hidden="true"></div><p class="eyebrow">${bank.cases.length} scenarios · ${ids.length} case-study tasks</p><h1>Keep the whole<br>scenario in view.</h1><p>Read the shared background and requirements, then work through the tasks for that case.</p></div><div class="topic-tools"><span class="meta">${s.checked} tasks checked</span><span class="meta">${s.wrong} need review</span><span class="meta">${s.saved} saved</span></div><div class="family-list">${bank.cases.map(caseRow).join('')}</div>`;
  }
  function caseContent(study) {
    return study.tabs ? study.tabs.map(tab => `<section><h3>${e(tab.label)}</h3>${tab.content.map(textBlock).join('')}</section>`).join('') : textBlock(study.background);
  }
  function renderCase(study) {
    const qs = core.caseQuestions(bank, study.id), s = stats(qs.map(q => q.id));
    return `<div class="breadcrumbs"><a href="#cases">Case studies</a><span>/</span><span>${e(caseTitle(study))}</span></div>${detailHero(`Case study · ${qs.length} tasks`, caseTitle(study), `${s.checked} checked · ${s.wrong} need review. Answers and notes also appear in topic practice.`)}<nav class="tabs" aria-label="Case study modes"><a class="pill tab${route.mode === 'read' ? ' active' : ''}" href="${e(casePath(study.id))}"${route.mode === 'read' ? ' aria-current="page"' : ''}>Read the scenario</a><a class="pill tab${route.mode === 'practice' ? ' active' : ''}" href="${e(casePath(study.id, 'practice', route.q))}"${route.mode === 'practice' ? ' aria-current="page"' : ''}>Practice case tasks</a></nav>${route.mode === 'practice' ? renderPractice(null, null, study) : `<section class="case-brief"><p class="eyebrow">Shared background & requirements</p>${caseContent(study)}</section><section class="question-list"><div class="section-head"><h2>Case-study tasks</h2>${pill(casePath(study.id, 'practice'), 'Begin case study', true)}</div>${qs.map(q => questionRow(q, false, casePath(study.id, 'practice', q.id))).join('')}</section>`}`;
  }
  function renderHome() {
    const s = stats(bank.questions.map(q => q.id));
    const next = state.lastGroup && groups.get(state.lastGroup) || groups.get('08/runtime');
    return `<section class="hero"><div><p class="eyebrow">Your AI-103 study notebook</p><h1>Learn the<br>difference.</h1><div class="stat-line"><span><strong>${bank.questions.length}</strong> questions</span><span><strong>${bank.topics.length}</strong> topics</span><span><strong>${bank.groups.length}</strong> decision families</span></div></div><div class="hero-copy"><p>Same topic. Different wording.<br>Clearer decisions.</p><p>Learn the rule, compare similar questions, then practice them together. Study credible alternatives, keep your notes, and revisit anything that still feels unclear.</p></div></section>${frameLine()}
      <section class="study-feature"><div><p class="eyebrow">${state.lastGroup ? 'Continue your notebook' : 'A good place to begin'}</p><h2>${heading(next.title)}</h2><p>${e(next.rule)}</p><div class="actions">${pill(path(next.id), state.lastGroup ? 'Continue learning' : 'Start with roles', true)}${s.wrong ? pill('#review', `Review ${s.wrong} mistakes`) : pill('#topic=16', 'Choosing the right service')}</div></div><div class="notebook-art" aria-hidden="true"><div class="orbit"></div><div class="sphere"></div><span class="art-caption">SMALL DIFFERENCES. CLEAR DECISIONS.</span></div></section>
      <section class="case-entry"><div class="gradient-swatch" aria-hidden="true"></div><div><p class="eyebrow">Study the shared scenario</p><h2>Case studies.</h2><p>${bank.cases.length} scenarios · ${bank.questions.filter(q => cases.has(q.caseId)).length} case-study tasks, kept together.</p></div>${pill('#cases', 'Browse case studies')}</section>${frameLine()}
      <section><div class="section-head"><div><p class="eyebrow">The syllabus, reorganized</p><h2>Choose a topic.</h2></div><label class="search-wrap"><span>Find a topic or question</span><input id="home-search" type="search" placeholder="Roles, speech, tool_choice…" autocomplete="off"></label></div><div id="home-results"><div class="topic-list">${bank.topics.map(topicRow).join('')}</div></div></section>
      <p class="notice">200 current authored · 675 source-attributed · 65 guide examples · 30 earlier practice. English questions and original Czech/English reasoning. Local revisions preserve source attribution; unresolved items are excluded from scoring. ${s.confused} confused questions ready to revisit.</p>`;
  }
  function renderTopic(topic) {
    const s = topicStats(topic), siblings = topic.groupIds.map(id => groups.get(id));
    const actions = route.mode === 'practice' ? pill(topicPath(topic.id), 'Back to families') : topicTestLink(topic.id) + pill(path(siblings[0].id), 'Learn by family');
    return `${crumbs(topic)}${detailHero(`Topic ${topic.id} · ${s.total} questions`, topic.title, topic.description, actions + (topic.guide ? pill('guides/' + topic.guide.replace('.md', '.html'), 'Read full summary') : ''))}
      <div class="topic-tools"><span class="meta">${siblings.length} decision families</span><span class="meta">${s.checked} questions checked</span><span class="meta">${s.wrong} need review</span><span class="meta">${siblings.filter(g => state.learnedGroupIds.includes(g.id)).length} families learned</span></div>
      ${route.mode === 'practice' ? renderPractice(null, null, null, topic) : `<section class="rule-card topic-practice-entry" aria-label="Whole-topic test"><div><p class="eyebrow">Mix every decision family</p><h2>Test the whole topic.</h2><p>All ${s.total} questions from ${siblings.length} families, in a mixed order. Your place and answers are saved.</p></div>${topicTestLink(topic.id)}</section><div class="family-list">${siblings.map(familyRow).join('')}</div>`}`;
  }
  function filters(includeRelated = true, wholeTopic) {
    const p = state.preferences;
    return `<div class="filter-bar"><label class="field">Question source<select id="source-filter"><option value="all">All sources</option>${Object.entries(sourceNames).map(([key, value]) => `<option value="${key}"${p.source === key ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label class="field">Show<select id="status-filter">${Object.entries(statusNames).map(([key, value]) => `<option value="${key}"${p.status === key ? ' selected' : ''}>${value}</option>`).join('')}</select></label>${includeRelated ? `<label class="check-label"><input id="related-filter" type="checkbox"${p.related ? ' checked' : ''}>Include related questions</label>` : ''}${wholeTopic ? '<button class="pill small-pill" data-action="mix-topic">Reshuffle questions</button>' : ''}${(p.source !== 'all' || p.status !== 'all' || includeRelated && p.related) ? '<button class="pill small-pill" data-action="clear-filters">Clear filters</button>' : ''}</div>`;
  }
  function familyQuestions(group) { return core.selectQuestions(bank, state, { groupId: group.id, ...state.preferences }); }
  function questionRow(q, review = false, targetOverride) {
    const r = record(q), status = r.evaluation ? (r.evaluation.correct ? '✓ Correct' : '↻ Review') : 'New';
    const target = targetOverride || (review ? '#practice=wrong&q=' + encodeURIComponent(q.id) : path(route.group || q.groupId, 'practice', q.id));
    return `<div class="question-row"><a href="${e(target)}"><span class="meta">${e(q.sourceLabel)}${r.bookmark ? ' · Saved' : ''}${r.confused ? ' · Confused' : ''}${q.scored === false ? ' · Unresolved · unscored' : ''}</span><p>${rich(q.stem.split('\n\n')[0])}</p></a><span class="state-label">${status}</span></div>`;
  }
  function emptyQuestions() {
    return '<div class="empty-state"><h2>No questions in this view.</h2><p>Try all sources or clear your progress filters.</p><div class="actions"><button class="pill primary" data-action="clear-filters">Show all questions</button></div></div>';
  }
  const comparisonRows = {
    '08': [['Invoke one agent', 'Foundry Agent Consumer · supported agent scope'], ['Build and test', 'Foundry User · appropriate project/resource scope'], ['Publish agents', 'Foundry Project Manager · resource scope'], ['Query index documents', 'Search Index Data Reader'], ['Write index documents', 'Search Index Data Contributor'], ['Manage Search objects', 'Search Service Contributor'], ['Read blob contents', 'Storage Blob Data Reader'], ['View subscription quota', 'Cognitive Services Usages Reader · subscription scope']],
    '15': [['Authenticate a caller', 'A credential obtains authentication proof'], ['Authorize an action', 'A data-role assignment at the applicable scope'], ['Select among supported credential sources', 'DefaultAzureCredential chain'], ['Wrap a supplied key', 'AzureKeyCredential'], ['401', 'Credential/token audience/expiry and endpoint first'], ['403 with a valid token', 'Actual principal, data actions, scope and access restrictions']],
    '16': [['Analyze a supplied image', 'Vision/image-analysis capability or multimodal model'], ['Create a new image', 'Image generation'], ['Audio → text', 'Speech to text'], ['Text → audio', 'Text to speech'], ['Real-time voice in both directions', 'Voice Live / supported live audio solution'], ['Known invoice fields', 'Document Intelligence prebuilt invoice'], ['Varied multimodal typed fields', 'Content Understanding analyzer'], ['Find relevant indexed passages', 'Azure AI Search / retrieval tool'], ['Analyze entities, sentiment, PII', 'Azure Language / appropriate text-analysis tool']],
    '01': [['Ordered stages depend on previous output', 'Sequential'], ['Independent specialists, then merge', 'Concurrent'], ['Transfer active responsibility', 'Handoff'], ['Agents discuss and take turns', 'Group chat'], ['Planner revises an unknown path', 'Magentic'], ['Current interaction context', 'Conversation/session state'], ['User preference across sessions', 'Isolated durable memory'], ['Facts from manuals', 'Knowledge retrieval']],
    '10': [['Claims unsupported by evidence', 'Groundedness'], ['Answers a different question', 'Relevance'], ['Misses required information', 'Completeness/response completeness'], ['Wrong evidence selected', 'Retrieval evaluation'], ['One run is slow', 'Correlated traces and spans'], ['Cost rose with unchanged traffic', 'Input/output tokens and tool-driven rounds'], ['Wrong tool or arguments', 'Tool-specific and task-success evaluation']],
    '13': [['Live partial transcript', 'Real-time recognition · recognizing events'], ['Large stored recording backlog', 'Batch transcription'], ['Quick supported recorded-audio job', 'Fast transcription'], ['Pauses and pronunciation', 'TTS with SSML'], ['A few unfamiliar names', 'Phrase list'], ['Persistent domain recognition errors', 'Custom Speech + reference evaluation'], ['Expired custom endpoint model', 'Documented same-locale base-model fallback'], ['Batch names expired model', '4xx; select nonexpired model or documented default'], ['Interrupt a talking assistant', 'Live voice session + barge-in handling']],
    '04': [['Current private facts', 'RAG'], ['Clearer role, format, evidence rules', 'Prompting'], ['Stable behavior from examples', 'SFT'], ['Preferred vs rejected response pairs', 'DPO'], ['Grader rewards during training', 'RFT'], ['Parseable JSON', 'Syntax only'], ['Required fields/types', 'Schema validation'], ['Values supported by source', 'Factual/business validation']],
    '06': [['Text', 'Read'], ['Tables and selection marks', 'Layout'], ['Typical invoice fields', 'Prebuilt invoice'], ['Labeled varied layouts', 'Evaluate custom neural extraction'], ['Mixed types need routing', 'Version-appropriate classifier/composition'], ['SDK analysis still running', 'Poller; obtain result after success']],
    '05': [['Exact literal terms', 'Keyword retrieval'], ['Conceptual similarity', 'Vector retrieval'], ['Both retrieval paths', 'Hybrid search'], ['Fuse ranked lists', 'RRF'], ['Rerank text-rich candidates', 'Semantic ranker'], ['Pull source data on schedule', 'Indexer'], ['Multiple searchable child chunks', 'Index projections'], ['Stored/query vectors changed', 'Check dimensions and embedding space'], ['Only authorized documents', 'Caller-specific retrieval filter']],
    '11': [['Harmful content', 'Moderation'], ['Malicious user instructions', 'Direct-attack checks'], ['Malicious retrieved/media instructions', 'Indirect/document attack checks'], ['Personal identifiers', 'PII detection + appropriate redaction'], ['Consequential action', 'Authorization and required approval before execution'], ['Possibly committed timed-out write', 'Backend idempotency'], ['Prohibited logos or required watermarks', 'Explicit visual policy enforcement']],
    '12': [['People, organizations, locations', 'NER'], ['Overall tone', 'Sentiment'], ['Sentiment about specific aspects', 'Opinion mining'], ['Obscure recognized identifiers', 'PII redacted text'], ['Different language', 'Translation'], ['Different script, same language', 'Transliteration'], ['Mixed-language text gives partial output', 'Segment → translate → recombine']],
    '14': [['Answer about an existing image', 'Multimodal evidence-based analysis'], ['Describe image accessibly', 'Alt text + extended description where needed'], ['New illustration', 'Image generation'], ['Bounded source-image modification', 'Source + compatible mask/edit workflow'], ['Inline b64_json', 'Decode base64 to bytes'], ['Queued generated clip', 'Poll to success/failure before download'], ['Existing video event sequence', 'Video analysis with time-aligned evidence']],
  };
  function decisionTable(group) {
    const rows = comparisonRows[group.topicId] || topics.get(group.topicId).groupIds.map(id => { const g = groups.get(id); return [g.cue, g.title]; });
    return `<div class="compare-table"><h3>When the requirement changes</h3><div class="table-scroll"><table><thead><tr><th>Question clue</th><th>Think of</th></tr></thead><tbody>${rows.map(([a, b]) => `<tr><td>${e(a)}</td><td>${e(b)}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function ruleCard(group) {
    return `<div class="rule-card"><p class="eyebrow">The decision to learn</p><h2>${heading(group.title)}</h2><div class="cue"><span class="rule-label">Recognize the clue</span>${e(group.cue)}</div><p>${e(group.rule)}</p><div class="contrast"><span class="rule-label">The distinction</span><p>${e(group.contrast)}</p></div></div>`;
  }
  function renderLearn(group) {
    const qs = familyQuestions(group), variantCount = bank.variants.filter(v => v.groupId === group.id && v.questionIds.length > 1).length;
    return `<div class="learn-layout"><div>${ruleCard(group)}${decisionTable(group)}</div><aside class="learn-aside"><div class="aside-note"><h3>A short study loop.</h3><ol><li>Say the selection rule without looking.</li><li>Compare two nearby questions. Identify the changed requirement.</li><li>Practice this family, then explain why each distractor fits a different task.</li><li>Revisit mistakes before mixing topics.</li></ol><div class="actions">${pill(path(group.id, 'compare'), 'Compare questions')}${pill(path(group.id, 'practice'), 'Practice this family', true)}</div></div><div class="aside-note"><h3>${variantCount ? variantCount + ' close-variant clusters' : 'One decision, several scenarios'}</h3><p>Similar scenarios stay next to each other, across sources. Mixed questions have links to the other decisions they test.</p><p style="margin-top:12px">“Learned” means you can explain this distinction; it is your own check, separate from question scores.</p></div><div class="aside-note"><h3>Keep the context.</h3><p>Read case requirements, code and qualifiers. Imported answer keys may be incomplete or version-sensitive; use the caveats and linked documentation.</p></div></aside></div>
      ${filters()}<section class="question-list"><div class="section-head"><h3>${qs.length} questions in this view</h3><a href="${e(path(group.id, 'compare'))}">Compare side by side ↗</a></div>${qs.length ? qs.slice(0, expandedList ? qs.length : 12).map(q => questionRow(q)).join('') : emptyQuestions()}${qs.length > 12 && !expandedList ? '<button class="pill" data-action="show-all">Show all ' + qs.length + ' questions</button>' : ''}</section>`;
  }
  function contextHtml(q) {
    let content = q.context || '', c = cases.get(q.caseId);
    if (c) {
      content = c.tabs ? c.tabs.map(tab => `<h4>${e(tab.label)}</h4>${tab.content.map(textBlock).join('')}`).join('') : textBlock(c.background);
    } else content = textBlock(content);
    return q.context || c ? `<details class="context-block"><summary>${e(c?.title || 'Scenario context')} · read before answering</summary><div class="context-content">${content}</div></details>` : '';
  }
  function caveatHtml(q) {
    return (q.caveats || []).length ? `<div class="caveat"><strong>Answer / version caveat</strong>${q.caveats.map(textBlock).join('')}</div>` : '';
  }
  function sourceLine(q) {
    return `<div class="source-line">${q.localRevision ? 'Locally revised · original attribution preserved' : isImported(q) ? 'Imported practice material' : 'Authored practice answer'}${q.flags?.includes('version-sensitive') ? ' · version-sensitive' : ''}<br>Reasoning: ${e(q.explanationAuthor || q.provenance?.author || 'Course study workspace')}</div>`;
  }
  function expectedText(q) {
    if (q.type === 'rows') return q.rows.map(row => row.text + ' → ' + row.options.find(o => o.id === q.correct[row.id]).text).join('\n');
    return q.correct.map(id => q.options.find(o => o.id === id).text).join(q.type === 'ordering' ? '\n→ ' : '\n');
  }
  function attempt(q) {
    state.records[q.id] ||= {};
    const r = record(q), needsSave = !core.validPresentation(q, r.presentation) || r.draft === undefined;
    core.beginAttempt(q, r);
    if (needsSave) save();
    return r;
  }
  function defaultDraft(q) { return core.clone(attempt(q).draft); }
  function choices(q, row) { return core.presentedOptions(q, attempt(q), row); }
  function evaluationVisible(q) {
    const r = record(q); return !!r.evaluation && core.equal(r.draft, r.evaluation.selected);
  }
  function questionHtml(q, readOnly = false, revealed = false, next = '') {
    const r = attempt(q), draft = r.draft;
    const show = readOnly ? revealed : evaluationVisible(q);
    let options = '';
    if (q.type === 'rows') {
      options = q.rows.map((row, i) => `<fieldset class="row-question"><legend>${i + 1}. ${rich(row.text)}</legend>${readOnly ? `<p class="small muted">Choices: ${choices(q, row).map(o => e(o.text)).join(' · ')}</p>` : `<select aria-label="${e(row.text)}" data-question="${e(q.id)}" data-row="${e(row.id)}"><option value="">Choose an answer</option>${choices(q, row).map(o => `<option value="${e(o.id)}"${draft[row.id] === o.id ? ' selected' : ''}>${e(o.text)}</option>`).join('')}</select>`}${show ? `<span class="answer-tag">${!readOnly && draft[row.id] !== q.correct[row.id] ? 'Your selection differs. ' : ''}Answer: ${e(row.options.find(o => o.id === q.correct[row.id]).text)}</span>` : ''}</fieldset>`).join('');
    } else if (q.type === 'ordering') {
      const ordered = readOnly ? (show ? q.correct : r.presentation.options) : draft;
      options = `<ol class="order-list">${ordered.map((id, i) => `<li><span class="meta">${i + 1}</span><span class="step-text">${rich(q.options.find(o => o.id === id).text)}</span>${readOnly ? '' : `<button class="pill" data-action="move-step" data-id="${e(q.id)}" data-index="${i}" data-dir="-1" aria-label="Move step ${i + 1} up"${i === 0 ? ' disabled' : ''}>↑</button><button class="pill" data-action="move-step" data-id="${e(q.id)}" data-index="${i}" data-dir="1" aria-label="Move step ${i + 1} down"${i === ordered.length - 1 ? ' disabled' : ''}>↓</button>`}</li>`).join('')}</ol>`;
    } else {
      options = `<div class="options">${choices(q).map(o => {
        const selected = draft.includes(o.id), expected = q.correct.includes(o.id);
        const className = 'option' + (selected && !readOnly ? ' selected' : '') + (show && expected ? ' expected' : '') + (show && selected && !expected && !readOnly ? ' wrong' : '');
        return `<${readOnly ? 'div' : 'label'} class="${className}">${readOnly ? '' : `<input type="${q.type === 'multi' ? 'checkbox' : 'radio'}" name="answer-${e(q.id)}" value="${e(o.id)}" data-question="${e(q.id)}"${selected ? ' checked' : ''}>`}<span class="option-letter">${e(o.label)}</span><span class="option-content">${rich(o.text)}${show && expected ? '<span class="answer-tag">✓ Expected answer</span>' : show && selected && !readOnly ? '<span class="answer-tag">Your selection</span>' : ''}</span></${readOnly ? 'div' : 'label'}>`;
      }).join('')}</div>`;
    }
    const instruction = q.type === 'multi' ? `Choose ${q.selectCount} answers.` : q.type === 'rows' ? 'Answer every row. Choices may be reused unless the scenario says otherwise.' : q.type === 'ordering' ? 'Move the steps into order, then check the complete sequence.' : 'Choose one answer.';
    const complete = core.validAnswer(q, draft, true);
    return `<article class="question-card" data-question-card="${e(q.id)}"><div class="question-meta"><span class="meta">${e(q.sourceLabel)}</span><button class="pill small-pill" data-action="bookmark" data-id="${e(q.id)}" aria-pressed="${!!r.bookmark}" aria-label="${r.bookmark ? 'Unsave' : 'Save'} question ${e(q.sourceLabel)}">${r.bookmark ? '✓ Saved' : '+ Save'}</button><button class="pill small-pill" data-action="confused" data-id="${e(q.id)}" aria-pressed="${!!r.confused}" aria-label="${r.confused ? 'Remove confusion mark' : 'Mark as confused'}: ${e(q.sourceLabel)}">${r.confused ? 'Confused · clear' : 'Mark as confused'}</button></div>${r.history?.length ? `<details class="attempt-history"><summary class="small muted">${r.history.length} previous attempt records · preserved history</summary>${r.history.map(h => `<p class="small muted">${e(h.evaluation?.at || 'Unchecked draft')} · ${h.evaluation ? `${h.evaluation.earned}/${h.evaluation.possible} points` : 'Saved draft'}${h.contentHash !== q.contentHash ? ' · earlier content; fresh answer required' : ' · earlier attempt'}</p>`).join('')}</details>` : ''}${contextHtml(q)}<h2>${rich(q.stem)}</h2><p class="question-instruction">${instruction}</p>${q.code ? `<pre class="question-code"><code>${e(q.code)}</code></pre>` : ''}${q.images?.length ? `<div class="question-images">${q.images.map(img => `<a href="${e(img.src)}" target="_blank" rel="noopener" aria-label="Open question exhibit full size"><img src="${e(img.src)}" alt="${e(img.alt || 'Question exhibit')}" loading="lazy"></a>`).join('')}</div>` : ''}${q.scored === false ? `<p class="notice" role="status">Unresolved · excluded from scored practice. ${e(q.unresolvedReason)}</p>` : ''}${caveatHtml(q)}${options}${readOnly ? '' : `<div class="question-actions"><div class="actions"><button class="pill primary" data-action="check" data-id="${e(q.id)}"${!complete || show || q.scored === false ? ' disabled' : ''}>${show ? 'Answer checked' : 'Check answer'}</button>${show ? `<button class="pill" data-action="retry" data-id="${e(q.id)}">Try again</button>` : ''}</div>${next ? `<a class="pill primary question-next" href="${e(next.href)}">${e(next.label)}</a>` : ''}</div>`}${q.relatedGroupIds.length ? `<div class="related-links"><span class="meta">Also tests:</span>${q.relatedGroupIds.map(id => `<a href="${e(path(id))}">${e(groups.get(id).title)}</a>`).join('')}</div>` : ''}${`<label class="notes"><span class="small muted">Your note · what changed your decision?</span><textarea data-note="${e(q.id)}" maxlength="10000" placeholder="The key clue was…">${e(r.note || '')}</textarea></label>`}</article>`;
  }
  function rowReason(q, row) {
    const rr = q.rowReasoning?.[row.id];
    const why = rr?.why || rr?.[q.correct[row.id]] || '';
    const alternatives = choices(q, row).map(o => {
      const entry = rr?.alternatives?.[o.id];
      const reason = typeof entry === 'string' ? entry : entry ? entry.why + (entry.whenFits ? ' When it fits: ' + entry.whenFits : '') : rr?.[o.id];
      return reason ? `<div class="option-reason"><strong>${e(o.text)}</strong><p>${rich(reason)}</p></div>` : '';
    }).join('');
    return `<div class="option-reason"><h4>${rich(row.text)}</h4>${why ? textBlock(why) : ''}${alternatives ? `<details><summary class="small" style="cursor:pointer;margin-top:10px">Why the choices differ</summary>${alternatives}</details>` : ''}</div>`;
  }
  function reasoningHtml(q, readOnly = false) {
    const r = record(q), show = readOnly || evaluationVisible(q), group = groups.get(q.groupId);
    if (!show) return `<aside class="reasoning-panel empty"><p class="eyebrow">Reason before reveal</p><h3>Which clue decides it?</h3><p>Choose your answer first. Then compare the reasoning with the rule you learned.</p><p style="margin-top:16px" class="small muted">${e(group.cue)}</p></aside>`;
    const evaluation = r.evaluation;
    let details = q.type === 'rows' ? q.rows.map(row => rowReason(q, row)).join('') : choices(q).map(o => {
      const reason = q.optionReasoning?.[o.id];
      return reason ? `<div class="option-reason"><strong class="small">${e(o.label)} · ${e(o.text)}</strong><p>${rich(reason)}</p></div>` : '';
    }).join('');
    return `<aside class="reasoning-panel"><div class="answer-result" role="status">${readOnly ? 'Answer & reasoning' : evaluation.correct ? 'Correct.' : 'A useful distinction.'}</div>${!readOnly ? `<p class="small muted">${evaluation.earned} / ${evaluation.possible} ${evaluation.possible > 1 ? 'rows correct' : 'question points'}</p>` : ''}${sourceLine(q)}<div class="answer-line"><span class="rule-label">Expected ${q.type === 'ordering' ? 'sequence' : 'answer'}</span>${e(expectedText(q))}</div>${q.explanationHtml || textBlock(q.explanation)}${details ? `<details style="margin-top:20px"${!readOnly && q.type !== 'rows' ? ' open' : ''}><summary class="small" style="cursor:pointer;min-height:36px">Reasoning by ${q.type === 'rows' ? 'row' : 'option'}</summary>${details}</details>` : '<p class="small muted" style="margin-top:18px">This source supplies an overall explanation. Use the decision rule below to contrast the remaining choices.</p>'}<div class="rule-card"><span class="rule-label">Decision rule · study guidance</span><p>${e(q.decisionRule || group.rule)}</p><p style="margin-top:10px">${e(group.contrast)}</p></div><div class="source-links">${(q.references || []).filter(ref => /^(https?:\/\/|guides\/|#)/.test(ref.url)).map(ref => `<a href="${e(ref.url)}"${ref.url.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${e(ref.label || 'Primary documentation')} ↗</a>`).join('')}</div></aside>`;
  }
  function prepareQueue(group, reviewStatus, study, wholeTopic) {
    const key = study ? 'case:' + study.id : (wholeTopic ? 'topic:' + wholeTopic.id : reviewStatus ? 'review:' + reviewStatus : group.id) + JSON.stringify(state.preferences);
    if (queueKey !== key || !queue) {
      queue = study ? core.caseQuestions(bank, study.id).map(q => q.id) : wholeTopic ? core.topicQuestions(bank, state, wholeTopic.id, state.preferences).map(q => q.id) : reviewStatus ? core.selectQuestions(bank, state, { status: reviewStatus, source: state.preferences.source, topicId: state.preferences.reviewTopic }).map(q => q.id) : familyQuestions(group).map(q => q.id);
      queueKey = key;
    }
    return queue;
  }
  function renderPractice(group, reviewStatus, study, wholeTopic) {
    const ids = prepareQueue(group, reviewStatus, study, wholeTopic);
    if (!ids.length) { save(); return reviewStatus ? reviewFilters() + `<div class="empty-state"><h2>${reviewStatus === 'confused' ? 'No confused questions in this view.' : 'Nothing to review yet.'}</h2><p>Marked questions stay here until you clear them. Try another source or topic.</p><div class="actions">${pill('#home', 'Choose a topic', true)}</div></div>` : filters(!wholeTopic, wholeTopic) + emptyQuestions(); }
    const savedId = wholeTopic ? state.topicPositions[wholeTopic.id] : group ? state.positions[group.id] : null;
    let id = route.q && ids.includes(route.q) ? route.q : ids.includes(savedId) ? savedId : ids[0];
    const q = questions.get(id), index = ids.indexOf(id), qgroup = groups.get(q.groupId), topic = topics.get(q.topicId);
    state.positions[group?.id || qgroup.id] = id; state.lastGroup = group?.id || qgroup.id;
    if (wholeTopic) state.topicPositions[wholeTopic.id] = id;
    save();
    const jump = target => study ? casePath(study.id, 'practice', target) : wholeTopic ? topicPath(wholeTopic.id, 'practice', target) : reviewStatus ? '#practice=' + reviewStatus + '&q=' + encodeURIComponent(target) : path(group.id, 'practice', target);
    const next = index < ids.length - 1
      ? { href: jump(ids[index + 1]), label: 'Next question →' }
      : { href: study ? casePath(study.id) : wholeTopic ? topicPath(wholeTopic.id) : reviewStatus ? '#review' : '#topic=' + group.topicId, label: study ? 'Finish case study' : wholeTopic ? 'Finish topic' : reviewStatus ? 'Finish review' : 'Finish this family' };
    return `${reviewStatus ? crumbs(topic, qgroup) + `<div class="page-title"><p class="eyebrow">Review · topics kept together</p><h1>${e(qgroup.title)}</h1><p>${e(statusNames[reviewStatus])} · Clear a confusion mark whenever the distinction makes sense.</p></div>` + reviewFilters() : study ? '' : filters(!wholeTopic, wholeTopic)}<div class="practice-top" id="practice-top" tabindex="-1" aria-label="Question navigation"><span class="meta">${index + 1} / ${ids.length} · ${study ? 'Case-study task' : e(qgroup.title)}</span><label class="field">Jump to question<select id="question-jump">${ids.map((qid, i) => `<option value="${e(jump(qid))}"${qid === id ? ' selected' : ''}>${i + 1} · ${wholeTopic ? e(groups.get(questions.get(qid).groupId).title) + ' · ' : ''}${e(questions.get(qid).sourceLabel)}</option>`).join('')}</select></label></div><div class="question-progress" aria-hidden="true"><span style="width:${100 * (index + 1) / ids.length}%"></span></div><div class="practice-layout">${questionHtml(q, false, false, next)}${reasoningHtml(q)}</div><div class="practice-bottom"><a href="${e(path(qgroup.id, 'compare', q.id))}">Compare within this family ↗</a><div class="actions">${index > 0 ? pill(jump(ids[index - 1]), '← Previous') : '<span></span>'}</div></div>${index === ids.length - 1 && !reviewStatus && !study && !wholeTopic ? `<div class="notice">Family complete? If you can explain the distinction without looking, mark it learned above. You can repeat missed questions through the “Needs review” filter.</div>` : ''}`;
  }
  function renderCompare(group) {
    const qs = familyQuestions(group);
    if (!qs.length) return filters() + emptyQuestions();
    if (!compareIds.length || !qs.some(q => q.id === compareIds[0])) {
      const first = route.q && qs.find(q => q.id === route.q) || qs[0];
      const sibling = qs.find(q => q.id !== first.id && q.variantId === first.variantId) || qs.find(q => q.id !== first.id);
      compareIds = [first.id, sibling?.id].filter(Boolean);
    }
    compareIds = compareIds.filter(id => qs.some(q => q.id === id));
    const select = index => `<label class="field">${index === 0 ? 'First question' : 'Compare with'}<select data-compare="${index}">${qs.map(q => `<option value="${e(q.id)}"${compareIds[index] === q.id ? ' selected' : ''}${compareIds[1 - index] === q.id ? ' disabled' : ''}>${e(q.sourceLabel)} · ${e(q.stem.slice(0, 72))}</option>`).join('')}</select></label>`;
    const close = compareIds.length === 2 && questions.get(compareIds[0]).variantId === questions.get(compareIds[1]).variantId;
    return `${filters()}<div class="compare-intro"><p class="eyebrow">${close ? 'Close variants · same scenario family' : 'Same decision family · different scenarios'}</p><h3>Read the requirement, then compare.</h3><p>${e(group.rule)}</p><p>${e(group.contrast)}</p><p class="small muted">Identify the requested action, input/output, qualifiers and version. The answer letter may change while the underlying rule stays the same.</p></div><div class="compare-toolbar">${select(0)}${qs.length > 1 ? select(1) : ''}<button class="pill primary" data-action="reveal-compare">${compareRevealed ? 'Hide answers' : qs.length > 1 ? 'Reveal both answers' : 'Reveal answer'}</button></div><div class="comparison-grid">${compareIds.map(id => `<div>${questionHtml(questions.get(id), true, compareRevealed)}${compareRevealed ? reasoningHtml(questions.get(id), true) : `<div class="actions" style="margin-top:16px">${pill(path(group.id, 'practice', id), 'Practice this question')}</div>`}</div>`).join('')}</div><div style="margin-top:32px">${decisionTable(group)}</div>${qs.length === 1 ? '<p class="notice">This family has one primary question. “Include related questions” can add mixed-topic questions; the table contrasts the adjacent decisions.</p>' : ''}`;
  }
  function renderGroup(group) {
    const topic = topics.get(group.topicId), learned = state.learnedGroupIds.includes(group.id);
    state.lastGroup = group.id; save();
    return `${crumbs(topic, group)}${detailHero(`Decision family · ${group.questionIds.length} questions`, group.title, group.cue, `<button class="pill${learned ? ' primary' : ''}" data-action="learned" data-group="${e(group.id)}" aria-pressed="${learned}">${learned ? '✓ I can explain this' : 'Mark as learned'}</button>` + (topic.guide ? pill('guides/' + topic.guide.replace('.md', '.html'), 'Read full summary') : ''))}<nav class="tabs" aria-label="Study modes">${['learn', 'compare', 'practice'].map(mode => `<a class="pill tab${route.mode === mode ? ' active' : ''}" href="${e(path(group.id, mode, mode === 'practice' ? route.q : undefined))}"${route.mode === mode ? ' aria-current="page"' : ''}>${mode === 'learn' ? 'Learn the rule' : mode === 'compare' ? 'Compare variants' : 'Practice'}</a>`).join('')}</nav>${route.mode === 'practice' ? renderPractice(group) : route.mode === 'compare' ? renderCompare(group) : renderLearn(group)}`;
  }
  function reviewFilters() {
    return `<div class="filter-bar"><label class="field">Question source<select id="source-filter"><option value="all">All sources</option>${Object.entries(sourceNames).map(([key, value]) => `<option value="${key}"${state.preferences.source === key ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label class="field">Topic<select id="review-topic-filter"><option value="all">All topics</option>${bank.topics.map(t => `<option value="${e(t.id)}"${state.preferences.reviewTopic === t.id ? ' selected' : ''}>${e(t.title)}</option>`).join('')}</select></label></div>`;
  }
  function renderReview() {
    const options = { source: state.preferences.source, topicId: state.preferences.reviewTopic };
    const missed = core.selectQuestions(bank, state, { ...options, status: 'wrong' }), saved = core.selectQuestions(bank, state, { ...options, status: 'bookmarked' }), confused = core.selectQuestions(bank, state, { ...options, status: 'confused' });
    const marked = [...new Map([...confused, ...missed].map(q => [q.id, q])).values()];
    const ordered = bank.groups.filter(g => marked.some(q => q.groupId === g.id));
    return `${crumbs()}${detailHero('Your next useful repetition', 'Return to the distinction.', 'Confusion is independent of your score. Mark guesses or unclear answers, then revisit them until you understand.')}<div class="dashboard"><div class="metric"><strong>${confused.length}</strong><p>Confused questions</p></div><div class="metric"><strong>${missed.length}</strong><p>Questions to retry</p></div><div class="metric"><strong>${saved.length}</strong><p>Saved questions</p></div></div>${reviewFilters()}<div class="actions">${pill('#practice=confused', 'Review confused questions', true)}${missed.length ? pill('#practice=wrong', 'Retry missed questions') : ''}${saved.length ? pill('#practice=bookmarked', 'Practice saved questions') : ''}${pill('#home', 'All topics')}</div>${marked.length ? `<div class="family-list" style="margin-top:32px">${ordered.map((g, i) => `<div>${familyRow(g, i)}<div class="review-question-list">${marked.filter(q => q.groupId === g.id).map(q => questionRow(q, true, '#practice=' + (record(q).confused ? 'confused' : 'wrong') + '&q=' + encodeURIComponent(q.id))).join('')}</div></div>`).join('')}</div>` : '<div class="empty-state"><h2>A clean page.</h2><p>No confused or missed questions in this view. Mark a question while studying, even when your answer is correct.</p></div>'}`;
  }
  function renderProgress() {
    const s = stats(bank.questions.map(q => q.id));
    return `${crumbs()}<div class="page-title"><p class="eyebrow">Your notebook, on this device</p><h1>See what is taking shape.</h1><p>Question results and your own “I can explain this” checks measure different things. Use both to decide what to revisit.</p></div><div class="dashboard"><div class="metric"><strong>${s.checked}<span class="small"> / ${s.total}</span></strong><p>Questions checked at least once</p></div><div class="metric"><strong>${state.learnedGroupIds.length}<span class="small"> / ${bank.groups.length}</span></strong><p>Families you can explain</p></div><div class="metric"><strong>${s.wrong}</strong><p>Latest answers needing review · ${s.confused} confused</p></div></div><div class="topic-list">${bank.topics.map(topicRow).join('')}</div><p class="notice">${Object.keys(state.retiredRecords).length} retired/unknown records preserved in your backup. ${Object.values(state.records).reduce((n, r) => n + (r.history?.length || 0), 0)} historical attempt records retained. Revised content requires a fresh answer. Practice results are raw points, not Microsoft's scaled exam score or a pass prediction. Progress is stored separately in each browser/device.</p><details class="backup-box"><summary>${bank.questions.filter(q => q.scored === false).length} unresolved questions · excluded from scoring</summary>${bank.questions.filter(q => q.scored === false).map(q => `<section class="question-row"><div><span class="meta">${e(q.sourceLabel)} · ${e(q.id)}</span><p>${rich(q.stem)}</p><p class="notice">${e(q.unresolvedReason)}</p><div class="source-links">${q.references.filter(ref => ref.url.startsWith('https://')).map(ref => `<a href="${e(ref.url)}" target="_blank" rel="noopener">${e(ref.label)} ↗</a>`).join('')}</div><label class="notes"><span class="small muted">Preserved note</span><textarea data-note="${e(q.id)}" maxlength="10000">${e(record(q).note || '')}</textarea></label></div></section>`).join('')}</details><div class="backup-box"><h2>Take your notebook with you.</h2><p>Export a JSON backup, then import it on your other device. Imports merge progress and notes; shared attempt counts are not added twice. Nothing syncs to an account.</p><div class="actions"><button class="pill primary" data-action="export">Export backup</button><button class="pill" data-action="import">Import & merge</button><a class="pill" href="GROUPED-QUESTION-MAP.md">Full grouped question map</a></div>${importMessage ? `<p role="status" style="margin-top:16px">${e(importMessage)}</p>` : ''}</div>${storageError ? `<div class="notice">${e(storageError)}<div class="actions" style="margin-top:12px"><button class="pill" data-action="export-existing">Download existing saved data</button><button class="pill" data-action="recover-storage">Use current notebook for future saves</button></div></div>` : ''}`;
  }
  function render(keepScroll = false) {
    const y = window.scrollY;
    route = parseRoute();
    document.querySelectorAll('.site-header nav a').forEach(a => a.classList.toggle('active', a.hash === (route.kind === 'case' || route.kind === 'cases' ? '#cases' : route.kind === 'review' || route.kind === 'review-practice' ? '#review' : route.kind === 'progress' ? '#progress' : '#home')));
    let content;
    if (route.kind === 'case' && cases.has(route.case)) content = renderCase(cases.get(route.case));
    else if (route.kind === 'cases' || route.kind === 'case') content = renderCases();
    else if (route.kind === 'group' && groups.has(route.group)) content = renderGroup(groups.get(route.group));
    else if (route.kind === 'topic' && topics.has(route.topic)) content = renderTopic(topics.get(route.topic));
    else if (route.kind === 'review') content = renderReview();
    else if (route.kind === 'review-practice') content = renderPractice(null, route.status);
    else if (route.kind === 'progress') content = renderProgress();
    else content = renderHome();
    main.innerHTML = content;
    document.title = (route.kind === 'case' && cases.has(route.case) && caseTitle(cases.get(route.case)) || route.kind === 'cases' && 'Case studies' || route.kind === 'group' && groups.get(route.group)?.title || route.kind === 'topic' && topics.get(route.topic)?.title || 'Learn the difference') + ' · AI-103 Topic Lab';
    if (keepScroll) window.scrollTo({ top: y, behavior: 'instant' });
    else {
      const start = document.getElementById('practice-top');
      (start || main).focus({ preventScroll: true });
      if (start) start.scrollIntoView({ block: 'start', behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  function updateDraft(q, draft, focus) {
    state.records[q.id] ||= {}; state.records[q.id].draft = draft; state.records[q.id].draftAt = new Date().toISOString(); sessionFeedback.delete(q.id); save(); render(true);
    if (focus) main.querySelector(focus)?.focus({ preventScroll: true });
  }
  main.addEventListener('change', event => {
    const el = event.target;
    if (el.id === 'source-filter' || el.id === 'status-filter' || el.id === 'related-filter' || el.id === 'review-topic-filter') {
      state.preferences[el.id === 'source-filter' ? 'source' : el.id === 'status-filter' ? 'status' : el.id === 'review-topic-filter' ? 'reviewTopic' : 'related'] = el.type === 'checkbox' ? el.checked : el.value;
      queue = null; compareIds = []; compareRevealed = false; expandedList = false; save(); render(true); document.getElementById(el.id)?.focus({ preventScroll: true }); return;
    }
    if (el.id === 'question-jump') { location.hash = el.value; return; }
    if (el.dataset.compare !== undefined) { compareIds[Number(el.dataset.compare)] = el.value; compareRevealed = false; render(true); return; }
    if (el.dataset.question) {
      const q = questions.get(el.dataset.question), draft = core.clone(record(q).draft || defaultDraft(q));
      if (el.dataset.row) { if (el.value) draft[el.dataset.row] = el.value; else delete draft[el.dataset.row]; updateDraft(q, draft, `[data-question="${q.id}"][data-row="${el.dataset.row}"]`); }
      else if (q.type === 'multi') {
        const next = el.checked ? [...draft, el.value] : draft.filter(id => id !== el.value);
        if (next.length > q.selectCount) { el.checked = false; toast('Choose exactly ' + q.selectCount + ' answers.'); return; }
        updateDraft(q, next, `[data-question="${q.id}"][value="${el.value}"]`);
      } else updateDraft(q, [el.value], `[data-question="${q.id}"][value="${el.value}"]`);
    }
  });
  main.addEventListener('input', event => {
    const el = event.target;
    if (el.dataset.note) { state.records[el.dataset.note] ||= {}; state.records[el.dataset.note].note = el.value; save(); }
    if (el.id === 'home-search') {
      const query = el.value.trim().toLowerCase(), container = document.getElementById('home-results');
      if (!query) { container.innerHTML = '<div class="topic-list">' + bank.topics.map(topicRow).join('') + '</div>'; return; }
      const matches = bank.topics.filter(t => [t.title, t.description, ...t.groupIds.map(id => { const g = groups.get(id); return g.title + ' ' + g.cue; })].join(' ').toLowerCase().includes(query));
      const qs = core.selectQuestions(bank, state, { search: query });
      container.innerHTML = (matches.length ? '<div class="topic-list">' + matches.map(topicRow).join('') + '</div>' : '') + `<div class="question-list"><p class="meta">${qs.length} matching questions${qs.length > 30 ? ' · showing first 30' : ''}</p>${qs.slice(0, 30).map(q => questionRow(q)).join('')}</div>`;
    }
  });
  function download(value, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  main.addEventListener('click', event => {
    const el = event.target.closest('[data-action]'); if (!el) return;
    const q = questions.get(el.dataset.id), action = el.dataset.action;
    if (action === 'check') {
      const draft = record(q).draft || defaultDraft(q);
      try {
        const result = core.grade(q, draft); state.records[q.id] ||= {}; const r = state.records[q.id];
        if (r.evaluation) { r.history ||= []; r.history.push(core.snapshot(q, r)); }
        r.draft = core.clone(draft); r.evaluation = result; r.attempts = (r.attempts || 0) + 1;
        const key = result.correct ? 'correctCount' : 'wrongCount'; r[key] = (r[key] || 0) + 1;
        sessionFeedback.add(q.id); save(); render(true);
        main.querySelector('[data-action="retry"]')?.focus({ preventScroll: true });
        toast(result.correct ? 'Correct. Reasoning is available below or beside the question.' : 'Answer checked. Review the reasoning below or beside the question.');
      } catch (error) { toast(error.message); }
    } else if (action === 'retry') {
      const r = attempt(q); if (r.evaluation) { r.history ||= []; r.history.push(core.snapshot(q, r)); }
      delete r.evaluation; core.beginAttempt(q, r, true); sessionFeedback.delete(q.id); save(); render(true);
    } else if (action === 'confused') {
      const r = record(q); state.records[q.id] ||= {}; core.toggleConfused(state.records[q.id]);
      const reviewingConfusion = route.kind === 'review-practice' && route.status === 'confused' || route.kind === 'group' && state.preferences.status === 'confused' || route.kind === 'topic' && route.mode === 'practice' && state.preferences.status === 'confused';
      if (!r.confused && reviewingConfusion && queue) {
        const index = queue.indexOf(q.id); queue = queue.filter(id => record(questions.get(id)).confused);
        const next = queue[Math.min(Math.max(index, 0), queue.length - 1)];
        if (next) { route.q = next; history.replaceState(null, '', route.kind === 'review-practice' ? '#practice=confused&q=' + encodeURIComponent(next) : route.kind === 'topic' ? topicPath(route.topic, 'practice', next) : path(route.group, 'practice', next)); }
      }
      save(); render(true);
      (main.querySelector(`[data-action="confused"][data-id="${q.id}"]`) || main.querySelector('[data-action="confused"]') || main.querySelector('.empty-state a'))?.focus({ preventScroll: true });
    }
    else if (action === 'test-topic') {
      // The overview promises every family/question; explicit filters can narrow the test afterwards.
      state.preferences.source = state.preferences.status = 'all'; queue = null; save();
    }
    else if (action === 'mix-topic' && route.kind === 'topic' && route.mode === 'practice') {
      core.beginTopicOrder(bank, state, route.topic, true); queue = null;
      const first = core.topicQuestions(bank, state, route.topic, state.preferences)[0];
      route.q = first?.id || null;
      if (first) state.topicPositions[route.topic] = first.id;
      history.replaceState(null, '', topicPath(route.topic, 'practice', route.q));
      save(); render(); toast('Question sequence reshuffled. Your answers and notes are kept.');
    }
    else if (action === 'bookmark') { state.records[q.id] ||= {}; state.records[q.id].bookmark = !record(q).bookmark; save(); render(true); }
    else if (action === 'learned') { const id = el.dataset.group; state.learnedGroupIds = state.learnedGroupIds.includes(id) ? state.learnedGroupIds.filter(g => g !== id) : [...state.learnedGroupIds, id]; save(); render(true); }
    else if (action === 'clear-filters') { state.preferences = { source: 'all', status: 'all', related: false, reviewTopic: 'all' }; queue = null; compareIds = []; save(); render(true); }
    else if (action === 'show-all') { expandedList = true; render(true); }
    else if (action === 'reveal-compare') { compareRevealed = !compareRevealed; render(true); }
    else if (action === 'move-step') {
      const draft = [...(record(q).draft || defaultDraft(q))], index = Number(el.dataset.index), next = index + Number(el.dataset.dir);
      if (next >= 0 && next < draft.length) { [draft[index], draft[next]] = [draft[next], draft[index]]; updateDraft(q, draft, `[data-action="move-step"][data-index="${next}"][data-dir="${el.dataset.dir}"]`); }
    } else if (action === 'export') { download(state, 'ai103-topic-lab-backup-' + new Date().toISOString().slice(0, 10) + '.json'); toast('Backup exported. Import it on your other device.'); }
    else if (action === 'import') document.getElementById('backup-file').click();
    else if (action === 'export-existing') {
      try { download(JSON.parse(localStorage.getItem(STORE)), 'ai103-existing-saved-data.json'); } catch (error) { toast('Existing saved data could not be read.'); }
    } else if (action === 'recover-storage') { storageError = ''; save(); render(true); toast('Current notebook now saves on this device.'); }
  });
  document.getElementById('backup-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 25000000) throw Error('Backup is too large.');
      const imported = core.validateBackup(JSON.parse(await file.text()), bank);
      state = core.mergeStates(state, imported, bank); save(); importMessage = `Backup merged. Notes, bookmarks and confusion changes preserved; revised answers retained as history. ${Object.keys(state.retiredRecords).length} retired/unknown records kept.`; render(true); toast(importMessage);
    } catch (error) { importMessage = 'Import failed: ' + error.message; render(true); toast(importMessage); }
    event.target.value = '';
  });
  window.addEventListener('hashchange', () => { compareIds = []; compareRevealed = false; expandedList = false; render(); });
  save(); render();
  // A late font swap can move the heading above the initial scroll target.
  // Align again only while this untouched practice view still has navigation focus.
  const initialStart = document.getElementById('practice-top');
  if (initialStart && document.fonts) {
    let touched = false;
    const touch = () => { touched = true; }, inputs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    inputs.forEach(type => window.addEventListener(type, touch, { once: true, passive: true }));
    document.fonts.ready.then(() => requestAnimationFrame(() => {
      inputs.forEach(type => window.removeEventListener(type, touch));
      if (!touched && initialStart.isConnected && document.activeElement === initialStart)
        initialStart.scrollIntoView({ block: 'start', behavior: 'instant' });
    }));
  }
  if (storageError) { document.getElementById('save-status').textContent = 'Storage issue · open Progress'; toast('Existing progress could not load. Open Progress to recover it.'); }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    // Reload the complete cached bundle on updates; drafts and answer orders are already saved.
    const wasControlled = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!wasControlled || reloading) return;
      reloading = true; location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(registration => {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) registration.update().catch(() => { /* Keep the cached app when offline. */ });
      });
    }).catch(() => { /* Online use remains available. */ });
  }
})();
