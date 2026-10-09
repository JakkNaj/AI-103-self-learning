/* Isolated revision attempts; existing Topic Lab progress is not changed. */
(function () {
  'use strict';
  const bank = window.TOPIC_BANK, definitions = window.QUICK_TESTS, core = window.TopicCore;
  const main = document.getElementById('main');
  if (!bank || !definitions || !core) { main.textContent = 'Test data could not load. Open this page beside the Topic Lab files.'; return; }
  const questions = new Map(bank.questions.map(q => [q.id, q]));
  const topics = new Map(bank.topics.map(t => [t.id, t]));
  const tests = definitions.tests.map(test => ({ ...test, questions: test.questionIds.map(id => questions.get(id)) }));
  if (tests.some(test => test.questions.length !== 32 || test.questions.some(q => !q || q.scored === false || !['single', 'multi'].includes(q.type)))) {
    main.textContent = 'The test selection no longer matches the study bank.'; return;
  }
  const STORE = 'ai103-quick-tests-v1';
  const freshAttempt = () => ({ answers: {}, position: 0, submittedAt: null });
  let state = { version: definitions.version, bankVersion: bank.bankVersion, attempts: Object.fromEntries(tests.map(t => [t.id, freshAttempt()])) };
  let storageMessage = '', screen = 'questions';
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version === definitions.version && saved.bankVersion === bank.bankVersion && saved.attempts) {
        for (const test of tests) {
          const incoming = saved.attempts[test.id];
          if (!incoming || !incoming.answers || typeof incoming.answers !== 'object') continue;
          const attempt = freshAttempt();
          for (const q of test.questions) if (core.validAnswer(q, incoming.answers[q.id])) attempt.answers[q.id] = [...incoming.answers[q.id]];
          if (Number.isInteger(incoming.position)) attempt.position = Math.max(0, Math.min(31, incoming.position));
          if (typeof incoming.submittedAt === 'string' && Number.isFinite(Date.parse(incoming.submittedAt))) attempt.submittedAt = incoming.submittedAt;
          state.attempts[test.id] = attempt;
        }
      } else storageMessage = 'The question set has changed. These tests start with fresh answers.';
    }
  } catch (_) { storageMessage = 'Saved answers could not load. You can still take the tests.'; }
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rich = value => e(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const activeTest = () => tests.find(test => test.id === location.hash.slice(1));
  const complete = (q, attempt) => core.validAnswer(q, attempt.answers[q.id], true);
  const answered = (test, attempt) => test.questions.filter(q => complete(q, attempt)).length;
  const grade = (q, attempt) => complete(q, attempt) ? core.grade(q, attempt.answers[q.id]).earned : 0;
  const topicIds = test => [...new Set(test.questions.map(q => q.topicId))];
  const sourceName = q => q.sourceId === 'guide' ? 'Study-guide example' : 'Course practice';
  function orderedOptions(q, test) {
    const options = [...q.options];
    let seed = 2166136261;
    for (const char of test.id + q.id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
    for (let i = options.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  }
  function letter(q, test, id) { return String.fromCharCode(65 + orderedOptions(q, test).findIndex(o => o.id === id)); }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); document.getElementById('save-status').textContent = 'Answers saved on this device'; }
    catch (_) { document.getElementById('save-status').textContent = 'Saving unavailable · keep this page open'; }
  }
  const warning = () => storageMessage ? `<p class="test-warning" role="status">${e(storageMessage)}</p>` : '';
  const stem = q => rich(q.stem.replace(/\n+\*\*Choose two answers\.\*\*/gi, ''));
  function renderHome() {
    return `${warning()}<section class="test-intro"><p class="eyebrow">Before-exam revision</p><h1>Two quick checks.<br>Every topic covered.</h1><p>32 questions per test · two from each of the 16 topics · about 25–35 minutes.</p><p>Answer at your own pace. Submit the whole test to reveal your score, correct answers and explanations.</p></section><section class="test-cards" aria-label="Choose a test">${tests.map(test => {
      const attempt = state.attempts[test.id], count = answered(test, attempt);
      const status = attempt.submittedAt ? `${test.questions.reduce((sum, q) => sum + grade(q, attempt), 0)}/32 on your last attempt` : `${count}/32 answered`;
      return `<article class="test-card"><p class="eyebrow">16 topics · 32 distinct questions</p><h2>${e(test.title)}</h2><p>${e(test.description)}</p><p class="small">${e(status)}</p><div class="actions"><a class="pill primary" href="#${test.id}">${attempt.submittedAt ? 'Review' : count ? 'Continue' : 'Start'} ${e(test.title)}</a></div></article>`;
    }).join('')}</section><p class="test-note">The tests share no questions. Equal topic coverage; one practice point per question. Multiple-selection questions require the exact answer set. These raw scores are not Microsoft’s scaled exam scores.</p>`;
  }
  function header(test, description) {
    return `<div class="test-header"><div><p class="eyebrow">Before-exam revision</p><h1>${e(test.title)}</h1><p>${e(description)}</p></div><div class="actions"><a class="pill" href="#tests">All tests</a></div></div>`;
  }
  function questionNav(test, attempt) {
    return `<aside class="test-sidebar"><h2>Question navigator</h2><div class="test-question-nav" aria-label="Jump to a question">${test.questions.map((q, i) => `<button type="button" data-question="${i}" class="${complete(q, attempt) ? 'answered ' : ''}${i === attempt.position ? 'current' : ''}" aria-label="Question ${i + 1}, ${e(topics.get(q.topicId).title)}, ${complete(q, attempt) ? 'answered' : 'unanswered'}"${i === attempt.position ? ' aria-current="step"' : ''}>${i + 1}</button>`).join('')}</div><progress value="${answered(test, attempt)}" max="32" aria-label="Answered questions"></progress><p class="count" id="answered-count" aria-live="polite">${answered(test, attempt)} of 32 answered</p><p class="legend">Filled squares are answered. You can revisit any question before submitting.</p><button class="pill primary" type="button" data-action="review">Review and submit</button></aside>`;
  }
  function renderQuestion(test, attempt) {
    const q = test.questions[attempt.position], selected = attempt.answers[q.id] || [];
    return `${warning()}${header(test, 'Two questions per topic. Answers stay hidden until submission.')}<div class="test-layout"><div class="test-main"><p class="test-main-count">${answered(test, attempt)} of 32 answered</p><section class="test-question" aria-labelledby="question-heading"><p class="meta">QUESTION ${attempt.position + 1} / 32 · TOPIC ${q.topicId} · ${e(topics.get(q.topicId).title)}</p><h2 id="question-heading" tabindex="-1" style="white-space:pre-line">${stem(q)}</h2>${q.code ? `<pre class="question-code"><code>${e(q.code)}</code></pre>` : ''}<p class="selection-hint">${q.type === 'multi' ? `Choose exactly ${q.selectCount} answers.` : 'Choose one answer.'}</p><div class="options" role="group" aria-labelledby="question-heading">${orderedOptions(q, test).map((option, index) => `<label class="option${selected.includes(option.id) ? ' chosen' : ''}"><input type="${q.type === 'multi' ? 'checkbox' : 'radio'}" name="answer" value="${e(option.id)}"${selected.includes(option.id) ? ' checked' : ''}${q.type === 'multi' && selected.length >= q.selectCount && !selected.includes(option.id) ? ' disabled' : ''}><span class="option-letter">${String.fromCharCode(65 + index)}</span><span class="option-content">${rich(option.text)}</span></label>`).join('')}</div></section><div class="test-controls"><button class="pill" data-action="previous"${attempt.position === 0 ? ' disabled' : ''}>Previous</button><div class="actions"><button class="pill" data-action="clear"${selected.length ? '' : ' disabled'}>Clear answer</button><button class="pill primary" data-action="${attempt.position === 31 ? 'review' : 'next'}">${attempt.position === 31 ? 'Review and submit' : 'Next question'}</button></div></div></div>${questionNav(test, attempt)}</div>`;
  }
  function renderSubmission(test, attempt) {
    const count = answered(test, attempt), blanks = 32 - count;
    return `${header(test, 'Review your completion before revealing the answers.')}<section class="test-review-summary"><p class="eyebrow">Ready to submit?</p><h2>${count} of 32 answered</h2><p style="margin-top:16px">${blanks ? `${blanks} unanswered or incomplete question${blanks === 1 ? '' : 's'} will receive zero points.` : 'All questions are complete.'} Submission reveals the answers and locks this attempt.</p><div class="actions"><button class="pill" data-action="back">Keep answering</button><button class="pill primary" data-action="submit">Submit and reveal answers</button></div></section><div class="test-topic-results">${topicIds(test).map(id => {
      const qs = test.questions.filter(q => q.topicId === id), count = qs.filter(q => complete(q, attempt)).length;
      return `<a href="#${test.id}" data-question="${test.questions.indexOf(qs.find(q => !complete(q, attempt)) || qs[0])}"><span>${id} · ${e(topics.get(id).title)}</span><strong>${count}/2 answered</strong></a>`;
    }).join('')}</div>`;
  }
  function renderAnswer(q, test, attempt) {
    const selected = attempt.answers[q.id] || [], correctLetters = q.correct.map(id => letter(q, test, id)).sort().join(', ');
    const context = (q.explanation || '').match(/\*\*Context:\*\*\s*([\s\S]*)$/)?.[1];
    return `<p class="small">Correct answer${q.correct.length > 1 ? 's' : ''}: <strong>${e(correctLetters)}</strong></p><div class="test-answer-options">${orderedOptions(q, test).map((option, index) => {
      const expected = q.correct.includes(option.id), chosen = selected.includes(option.id);
      const why = q.optionReasoning?.[option.id] || option.why || (expected ? q.takeaway || q.answerReason || '' : '');
      return `<div class="test-answer-option${expected ? ' expected' : chosen ? ' wrong-choice' : ''}"><div class="answer-label">${String.fromCharCode(65 + index)}. ${rich(option.text)}${expected ? ' · Correct' : ''}${chosen ? ' · Your choice' : ''}</div>${why ? `<p>${rich(why)}</p>` : ''}</div>`;
    }).join('')}</div>${context ? `<p class="test-note">${rich(context)}</p>` : ''}<div class="references"><span>${e(sourceName(q))} · ${e(q.id)}</span>${(q.references || []).map(ref => `<a href="${e(ref.url)}" target="_blank" rel="noopener noreferrer">${e(ref.label)}</a>`).join('')}<a href="index.html#group=${encodeURIComponent(q.groupId)}&mode=learn">Revise this decision</a></div>`;
  }
  function renderResults(test, attempt) {
    const score = test.questions.reduce((sum, q) => sum + grade(q, attempt), 0);
    return `${header(test, 'Attempt submitted. Review your answers and the decisions you missed.')}<section class="test-review-summary"><p class="eyebrow">Your practice score</p><div class="score">${score}<span class="muted"> / 32</span></div><p>${Math.round(score / 32 * 100)}% correct · ${32 - answered(test, attempt)} unanswered or incomplete</p><p class="small">One point per question; multiple selections require the complete correct set. Raw revision score, not a scaled exam result.</p><div class="actions"><button class="pill" data-action="retake">Retake ${e(test.title)}</button><a class="pill primary" href="#${test.id === 'A' ? 'B' : 'A'}">Open Test ${test.id === 'A' ? 'B' : 'A'}</a></div></section><h2 style="font-size:26px;margin-bottom:14px">Results by topic</h2><div class="test-topic-results">${topicIds(test).map(id => {
      const qs = test.questions.filter(q => q.topicId === id), points = qs.reduce((sum, q) => sum + grade(q, attempt), 0);
      return `<a href="#${test.id}" data-scroll="result-${test.questions.indexOf(qs[0])}"><span>${id} · ${e(topics.get(id).title)}</span><strong>${points}/2</strong></a>`;
    }).join('')}</div><h2 style="font-size:26px">Answer review</h2>${test.questions.map((q, index) => {
      const correct = grade(q, attempt) === 1, selected = attempt.answers[q.id] || [];
      return `<article class="test-review-item" id="result-${index}"><p class="meta">QUESTION ${index + 1} · TOPIC ${q.topicId} · ${e(topics.get(q.topicId).title)}</p><h3>${stem(q)}</h3>${q.code ? `<pre class="question-code"><code>${e(q.code)}</code></pre>` : ''}<p class="verdict ${correct ? 'correct' : 'incorrect'}">${correct ? 'Correct · 1/1' : 'Incorrect · 0/1'} · Your answer: ${selected.length ? e(selected.map(id => letter(q, test, id)).sort().join(', ')) : 'Unanswered'}</p><details${correct ? '' : ' open'}><summary>Correct answer and reasoning</summary>${renderAnswer(q, test, attempt)}</details></article>`;
    }).join('')}`;
  }
  function render(focus = false) {
    const test = activeTest();
    main.innerHTML = !test ? renderHome() : state.attempts[test.id].submittedAt ? renderResults(test, state.attempts[test.id]) : screen === 'submission' ? renderSubmission(test, state.attempts[test.id]) : renderQuestion(test, state.attempts[test.id]);
    document.title = test ? `AI-103 · ${test.title}${state.attempts[test.id].submittedAt ? ' results' : ''}` : 'AI-103 · Before-exam tests';
    if (focus) { main.scrollIntoView({ block: 'start' }); (document.getElementById('question-heading') || main).focus({ preventScroll: true }); }
  }
  function refreshProgress(test, attempt) {
    const q = test.questions[attempt.position], selected = attempt.answers[q.id] || [];
    for (const input of main.querySelectorAll('input[name="answer"]')) {
      input.checked = selected.includes(input.value);
      input.disabled = q.type === 'multi' && selected.length >= q.selectCount && !input.checked;
      input.closest('label').classList.toggle('chosen', input.checked);
    }
    main.querySelector('[data-action="clear"]').disabled = !selected.length;
    for (const button of main.querySelectorAll('.test-question-nav button')) {
      const item = test.questions[Number(button.dataset.question)], done = complete(item, attempt);
      button.classList.toggle('answered', done);
      button.setAttribute('aria-label', `Question ${Number(button.dataset.question) + 1}, ${topics.get(item.topicId).title}, ${done ? 'answered' : 'unanswered'}`);
    }
    const count = answered(test, attempt);
    main.querySelector('progress').value = count;
    document.getElementById('answered-count').textContent = `${count} of 32 answered`;
    main.querySelector('.test-main-count').textContent = `${count} of 32 answered`;
  }
  main.addEventListener('change', event => {
    const test = activeTest();
    if (!test || event.target.name !== 'answer') return;
    const attempt = state.attempts[test.id];
    if (attempt.submittedAt || screen !== 'questions') return;
    const q = test.questions[attempt.position];
    attempt.answers[q.id] = [...main.querySelectorAll('input[name="answer"]:checked')].map(input => input.value);
    refreshProgress(test, attempt); save();
  });
  main.addEventListener('click', event => {
    const element = event.target.closest('[data-action], [data-question], [data-scroll]'), test = activeTest();
    if (!element || !test) return;
    event.preventDefault();
    const attempt = state.attempts[test.id];
    if (element.dataset.scroll) { document.getElementById(element.dataset.scroll)?.scrollIntoView({ block: 'start' }); return; }
    if (element.dataset.question !== undefined) {
      if (attempt.submittedAt) return;
      attempt.position = Number(element.dataset.question); screen = 'questions'; save(); render(true); return;
    }
    const action = element.dataset.action;
    if (attempt.submittedAt && action !== 'retake') return;
    if (action === 'retake') state.attempts[test.id] = freshAttempt();
    else if (action === 'previous') attempt.position = Math.max(0, attempt.position - 1);
    else if (action === 'next') attempt.position = Math.min(31, attempt.position + 1);
    else if (action === 'clear') { attempt.answers[test.questions[attempt.position].id] = []; refreshProgress(test, attempt); save(); return; }
    else if (action === 'review') screen = 'submission';
    else if (action === 'submit') attempt.submittedAt = new Date().toISOString();
    else if (action !== 'back') return;
    if (['retake', 'back'].includes(action)) screen = 'questions';
    save(); render(true);
  });
  document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); main.focus(); });
  window.addEventListener('hashchange', () => { screen = 'questions'; render(true); });
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const wasControlled = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!wasControlled || reloading) return;
      reloading = true; location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(registration => {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) registration.update().catch(() => {});
      });
    }).catch(() => {});
  }
})();
