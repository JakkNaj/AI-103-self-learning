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
    const grade = async q => {
      await go(routeFor(q)); positioned();
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
    return { passed: checks, widths: [390, 320], flows: 'Next/Jump/Finish, case/review context, shuffled grading, comparison, reload, notes/flags, retry' };
  } finally { frame.remove(); }
})();
