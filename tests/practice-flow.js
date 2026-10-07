/* Browser regression: evaluate this script on a fresh localhost serve.py port.
 * Uses real controls in a 390px iframe. Never run against a personal notebook.
 */
(async function () {
  'use strict';
  const STORE = 'ai103-topic-lab-v1';
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) throw Error('Use an isolated localhost test port.');
  const existing = JSON.parse(localStorage.getItem(STORE) || '{}');
  if (Object.keys(existing.records || {}).length || existing.learnedGroupIds?.length) throw Error('Use a fresh test port with no existing progress.');
  let checks = 0;
  const assert = (ok, message) => { if (!ok) throw Error(message); checks++; };
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const pause = () => new Promise(resolve => setTimeout(resolve, 80));
  const frame = document.createElement('iframe');
  frame.style = 'position:fixed;top:0;left:0;width:390px;height:844px;border:0;z-index:1000;background:#fdfcfc';
  const loaded = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Test frame load timed out')), 5000);
    frame.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
  const initial = loaded(); frame.src = location.origin + '/#home'; document.body.append(frame);
  try {
    await initial;
    const w = frame.contentWindow, bank = w.TOPIC_BANK;
    const $ = selector => w.document.querySelector(selector);
    const read = q => JSON.parse(localStorage.getItem(STORE)).records[q.id];
    const displayed = () => [...w.document.querySelectorAll('.options input')].map(o => o.value);
    const current = () => bank.questions.find(q => q.id === $('[data-question-card]')?.dataset.questionCard);
    const routeFor = q => '#group=' + encodeURIComponent(q.groupId) + '&mode=practice&q=' + encodeURIComponent(q.id);
    const positioned = () => {
      const top = $('#practice-top').getBoundingClientRect().top;
      assert(top >= 0 && top <= 20, 'Counter and Jump should be at the top');
      assert(w.document.activeElement.id === 'practice-top', 'Navigation should focus the question counter');
    };
    const go = async hash => {
      if (w.location.hash === hash) { w.location.hash = '#home'; await pause(); }
      w.location.hash = hash; await pause();
    };
    const grade = async (q, destination = routeFor(q)) => {
      await go(destination); positioned();
      if (q.type === 'rows') {
        for (const row of q.rows) {
          const el = $(`[data-row="${row.id}"]`); el.value = q.correct[row.id]; el.dispatchEvent(new w.Event('change', { bubbles: true }));
        }
      } else if (q.type === 'ordering') {
        for (let i = 0; i < q.correct.length; i++) {
          let at = read(q).draft.indexOf(q.correct[i]);
          while (at > i) { $(`[data-action="move-step"][data-index="${at}"][data-dir="-1"]`).click(); at--; }
        }
      } else for (const id of q.correct) $(`.options input[value="${id}"]`).click();
      const order = read(q).presentation;
      $('.question-actions').scrollIntoView({ block: 'center', behavior: 'instant' });
      const y = w.scrollY; $('[data-action="check"]').click();
      assert(read(q).evaluation.correct, q.id + ' must grade by ID');
      assert(equal(order, read(q).presentation), 'Checking must preserve order');
      assert(w.scrollY === y, 'Checking must not jump to reasoning');
      const next = $('.question-next').getBoundingClientRect(), retry = $('[data-action="retry"]').getBoundingClientRect();
      assert(next.left >= retry.right, 'Next should be on the right of Try again');
      assert(next.bottom <= w.innerHeight && next.top >= 0, 'Next should remain in view after checking');
      assert(w.document.documentElement.scrollWidth <= w.innerWidth, 'No horizontal page overflow');
      return order;
    };

    // A canonical key can be displayed as D. Its ID/text/feedback must travel together.
    const single = bank.questions.find(q => q.id === 'WEB-pvejayan-1-abe9206a');
    const random = w.Math.random; w.Math.random = () => 0;
    await go(routeFor(single)); w.Math.random = random;
    assert($(`input[value="${single.correct[0]}"]`).closest('.option').querySelector('.option-letter').textContent === 'D', 'Controlled shuffle should move the correct answer to D');
    const singleOrder = await grade(single);
    const beforeFlag = read(single);
    $('[data-action="confused"]').click(); $('[data-action="bookmark"]').click();
    const note = $('[data-note]'); note.value = 'Browser regression note'; note.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert(equal(beforeFlag.evaluation, read(single).evaluation), 'Flags/notes must not change grading');
    assert(equal(singleOrder, read(single).presentation), 'Flags/notes must not reshuffle');
    const nextHref = $('.question-next').hash;
    $('.question-next').click(); await pause(); positioned();
    assert(w.location.hash === nextHref, 'Next must open its destination');
    await go(routeFor(single)); positioned();
    assert(equal(singleOrder.options, displayed()), 'Returning must keep the displayed order');
    const reload = loaded(); w.location.reload(); await reload;
    positioned();
    assert(equal(singleOrder.options, displayed()), 'Reload must keep the displayed order');
    assert(equal(read(single).draft, single.correct), 'Reload must keep selected IDs');
    assert(read(single).confused && read(single).bookmark && read(single).note === 'Browser regression note', 'Reload must preserve notebook fields');

    await go('#group=' + encodeURIComponent(single.groupId) + '&mode=compare&q=' + single.id);
    $('[data-action="reveal-compare"]').click();
    const expected = $('.comparison-grid .option.expected');
    assert(expected.querySelector('.option-letter').textContent === 'D', 'Comparison feedback must use the same displayed label');
    assert(expected.textContent.includes(single.options.find(o => o.id === single.correct[0]).text), 'Comparison feedback must retain the option text');

    for (const type of ['multi', 'rows', 'ordering']) {
      const q = bank.questions.find(q => q.type === type && q.scored !== false && !q.caseId);
      await grade(q);
    }

    const study = bank.cases.find(c => w.TopicCore.caseQuestions(bank, c.id).length > 1);
    const tasks = w.TopicCore.caseQuestions(bank, study.id);
    const caseRoute = q => '#case=' + encodeURIComponent(study.id) + '&mode=practice&q=' + encodeURIComponent(q.id);
    await go(caseRoute(tasks[0])); positioned();
    assert(!!$('.context-block'), 'Case task must keep scenario context');
    $('[data-action="confused"]').click();
    $('.question-next').click(); await pause(); positioned();
    assert(current().id === tasks[1].id, 'Case Next must preserve task order');
    await go(caseRoute(tasks[tasks.length - 1])); positioned();
    assert($('.question-next').textContent === 'Finish case study', 'Last case task must offer Finish');
    $('.question-next').click(); await pause();
    assert(!!$('.case-brief'), 'Finish must return to the shared case brief');

    await go(routeFor(single));
    const jump = $('#question-jump'); jump.value = jump.options[jump.options.length - 1].value;
    jump.dispatchEvent(new w.Event('change', { bubbles: true })); await pause(); positioned();
    assert($('.question-next').textContent === 'Finish this family', 'Last family question must offer Finish');

    await go('#practice=confused'); positioned();
    $('.question-next').click(); await pause(); positioned();
    assert(current().id === single.id || current().id === tasks[0].id, 'Review Next must stay in its flagged queue');
    let cleared = 0;
    while ($('[data-action="confused"]')) {
      const q = current(), before = read(q); $('[data-action="confused"]').click();
      assert(read(q).confused === false, 'Review must explicitly clear the flag');
      assert(equal(read(q).draft, before.draft) && equal(read(q).evaluation, before.evaluation), 'Clearing must preserve answer and score');
      if (++cleared > 3) throw Error('Confused review failed to advance');
    }
    assert($('.empty-state').textContent.includes('No confused questions'), 'Clearing the last mark must show the empty state');

    // A fresh retry may shuffle again. A narrower phone must still keep Next on the right.
    frame.style.width = '320px'; await go(routeFor(single));
    const oldRandom = w.Math.random; w.Math.random = () => .999;
    $('[data-action="retry"]').click(); w.Math.random = oldRandom;
    assert(!equal(singleOrder, read(single).presentation), 'Fresh retry should use its new controlled permutation');
    assert(equal(read(single).draft, []), 'Fresh retry should reset its draft');
    assert(read(single).bookmark && read(single).note === 'Browser regression note', 'Fresh retry must preserve notebook fields');
    await grade(single);
    // Whole topic: visible entry everywhere, mixed families, stable sequence and shared records.
    frame.style.width = '390px';
    const topic = bank.topics.find(t => t.id === '01');
    const topicQs = w.TopicCore.selectQuestions(bank, w.TopicCore.freshState(bank), { topicId: topic.id });
    const topicRoute = q => '#topic=' + topic.id + '&mode=practice' + (q ? '&q=' + encodeURIComponent(q.id) : '');
    const topicButton = () => $('.topic-practice-entry a');
    const queueIds = () => [...$('#question-jump').options].map(o => new URLSearchParams(o.value.slice(1)).get('q'));
    const seeded = initial => { let n = initial; return () => { n = (1664525 * n + 1013904223) >>> 0; return n / 4294967296; }; };
    for (const item of bank.topics) {
      await go('#topic=' + item.id);
      assert(topicButton()?.textContent === 'Test whole topic' && topicButton().hash === '#topic=' + item.id + '&mode=practice', 'Each topic must have the prominent whole-topic entry');
      assert($('.topic-practice-entry').nextElementSibling.classList.contains('family-list'), 'Test entry must sit immediately above families');
      assert(w.document.documentElement.scrollWidth <= w.innerWidth, 'Topic entry must fit a phone');
    }
    await go('#topic=' + topic.id);
    const mixingRandom = w.Math.random; w.Math.random = seeded(103);
    topicButton().click(); await pause(); w.Math.random = mixingRandom; positioned();
    const mixedIds = queueIds(), mixedQs = mixedIds.map(id => topicQs.find(q => q.id === id));
    assert(equal([...mixedIds].sort(), topicQs.map(q => q.id).sort()), 'Topic queue must include every family without duplicates');
    assert(equal(mixedIds, w.TopicCore.shuffle(topicQs.map(q => q.id), seeded(103))), 'Topic queue must use the controlled Fisher–Yates permutation');
    assert(!equal(mixedIds, topicQs.map(q => q.id)), 'Controlled topic shuffle must change family order');
    assert(!$('#related-filter'), 'Whole-topic practice should not pull unrelated topic questions');
    const boundary = mixedQs.findIndex(q => q.groupId !== mixedQs[0].groupId);
    await go(topicRoute(mixedQs[boundary - 1]));
    $('.question-next').click(); await pause(); positioned();
    assert(current().id === mixedQs[boundary].id, 'Next must cross family boundaries in the mixed sequence');
    assert(new URLSearchParams(w.location.hash.slice(1)).get('topic') === topic.id, 'Next must stay in the topic route');
    const topicQ = current(), topicOrder = await grade(topicQ, topicRoute(topicQ));
    const topicNote = $('[data-note]'); topicNote.value = 'Mixed-topic note'; topicNote.dispatchEvent(new w.Event('input', { bubbles: true }));
    $('[data-action="confused"]').click(); $('[data-action="confused"]').click();
    assert(equal(queueIds(), mixedIds), 'Checking, editing notes and flags must not remix the queue');
    await go(routeFor(topicQ));
    assert(equal(topicOrder, read(topicQ).presentation) && read(topicQ).evaluation.correct, 'Topic and family practice must share order and grade');
    await go('#topic=' + topic.id); topicButton().click(); await pause(); positioned();
    assert(current().id === topicQ.id, 'Topic entry must resume its independent saved position');
    const topicReload = loaded(); w.location.reload(); await topicReload;
    assert(current().id === topicQ.id && equal(topicOrder, read(topicQ).presentation), 'Topic position and order must survive reload');
    assert(equal(queueIds(), mixedIds), 'Reload must preserve the whole mixed question sequence');
    assert(equal(JSON.parse(localStorage.getItem(STORE)).topicOrders[topic.id], mixedIds), 'Question sequence must be included in backup state');
    assert(JSON.parse(localStorage.getItem(STORE)).topicPositions[topic.id] === topicQ.id, 'Topic position must be included in backup state');
    const lastTopic = mixedQs[mixedQs.length - 1];
    await go(topicRoute(lastTopic)); positioned();
    assert($('.question-next').textContent === 'Finish topic', 'Last topic question must offer Finish topic');
    $('.question-next').click(); await pause();
    assert(!!$('.family-list') && !!topicButton(), 'Finish topic must return to its overview');
    topicButton().click(); await pause();
    const source = $('#source-filter'); source.value = 'authored'; source.dispatchEvent(new w.Event('change', { bubbles: true }));
    const authored = mixedQs.filter(q => q.sourceId === 'authored');
    assert(equal(queueIds(), authored.map(q => q.id)), 'Topic source filter must cover all matching families');
    await go(topicRoute(authored[0])); $('[data-action="confused"]').click();
    const otherFamily = authored.find(q => q.groupId !== authored[0].groupId);
    await go(topicRoute(otherFamily)); $('[data-action="confused"]').click();
    const status = $('#status-filter'); status.value = 'confused'; status.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert(queueIds().length === 2, 'Topic Confused filter must include marks from different families');
    $('[data-action="confused"]').click();
    assert(!!$('[data-question-card]') && queueIds().length === 1, 'Clearing confusion must advance within the topic');
    assert(new URLSearchParams(w.location.hash.slice(1)).get('topic') === topic.id, 'Clearing confusion must preserve topic scope');
    $('[data-action="confused"]').click();
    assert(!!$('.empty-state'), 'Clearing the last topic mark must show an empty state');
    $('[data-action="clear-filters"]').click();
    assert(equal(queueIds(), mixedIds), 'Clearing filters must restore the saved mixed topic queue');
    const caseTopicQ = topicQs.find(q => q.caseId);
    await go(topicRoute(caseTopicQ));
    assert(!!$('.context-block'), 'Case questions in whole-topic practice must retain their scenario');
    const oldRecords = JSON.parse(localStorage.getItem(STORE)).records;
    const reshuffleRandom = w.Math.random; w.Math.random = seeded(2026);
    $('[data-action="mix-topic"]').click(); w.Math.random = reshuffleRandom;
    const newIds = queueIds(); positioned();
    assert(equal(newIds, w.TopicCore.shuffle(topicQs.map(q => q.id), seeded(2026))), 'Reshuffle must create the requested new controlled sequence');
    assert(!equal(newIds, mixedIds) && current().id === newIds[0], 'Reshuffle should begin at the first question of the new sequence');
    for (const [id, oldRecord] of Object.entries(oldRecords)) assert(equal(read({ id }), oldRecord), 'Reshuffle must preserve existing notebook fields and answer orders');
    const newReload = loaded(); w.location.reload(); await newReload;
    assert(equal(queueIds(), newIds), 'Explicit new sequence must survive reload');
    const limited = $('#source-filter'); limited.value = 'guide'; limited.dispatchEvent(new w.Event('change', { bubbles: true }));
    await go('#topic=' + topic.id); topicButton().click(); await pause();
    assert($('#source-filter').value === 'all' && equal(queueIds(), newIds), 'Whole-topic entry must include all questions even after a filtered session');
    frame.style.width = '320px'; await go('#topic=15');
    assert(!!topicButton() && w.document.documentElement.scrollWidth <= w.innerWidth, 'Requested topic entry must fit a narrow phone');
    return { passed: checks, widths: [390, 320], flows: 'Next/Jump/Finish, case/review context, shuffled grading, comparison, reload, notes/flags, retry, all-topic entries, mixed sequence/filters/resume/reshuffle' };
  } finally { frame.remove(); }
})();
