# AI-103 Self-learning · Topic Lab

[Open the learning app](https://jakknaj.github.io/AI-103-self-learning/)

Personal, unofficial study notebook: **970 questions, 16 topics, 108 decision families**, plus **10 case studies with 61 tasks**. Learn a rule, compare similar scenarios, then practice with answer reasoning. Works on desktop and mobile.

## Self-learning only · disclaimer

Author-created practice questions and scenarios are **made up from course/study materials and public documentation for self-learning purposes**. The bank also includes third-party practice material, clearly identified by source. Nothing is claimed to be an actual examination question or an official Microsoft answer key. This project is **not affiliated with, endorsed by, or sponsored by Microsoft**.

**Questions, answers and explanations can be wrong, incomplete, ambiguous or outdated.** A documented local review has revised weak material and excluded unresolved items; it cannot guarantee every key’s factual correctness. Azure services, role names, APIs and examination requirements can change; the material and answer keys may be revised later. Verify answers against current official documentation and use your own judgment.

Everything is provided **as is, without warranties of accuracy, completeness, fitness for purpose or examination results**. To the extent permitted by applicable law, the maintainer accepts no responsibility for errors or outcomes resulting from reliance on this material. Use it for personal learning, not as authoritative technical guidance or a guarantee of passing an exam.

## Study

- **Topics:** choose a narrow decision family, learn its rule, compare variants and practice.
- **Case studies:** read a shared scenario and answer only that case's tasks, in source order.
- **Review:** revisit confused questions independently of correctness, retry mistakes and practice saved questions. Source/topic filters narrow the queue.
- **Progress:** export a backup; import it on another device to merge answers and notes.

The case section uses the same question records as topic practice. It adds no duplicate questions or scores. Answer reasoning stays hidden until an explicit check or reveal. Practice points are not Microsoft's scaled exam score and do not predict a pass.

## Privacy, mobile and offline use

No login, model/API calls, analytics or synchronization service. Answers, notes, bookmarks and confusion marks stay in this browser's local storage; GitHub hosts the static files. Each device/browser has separate progress. Export/import backups to transfer it. Original published-bank backups migrate safely: revised attempts become history; notes/bookmarks/confusion survive. Unchanged questions retain valid progress. Confusion marks/clears merge by change time; missing older fields do not erase them. Unknown records remain in exports.

Answer order is shuffled once per fresh attempt and persists through checks, notes, navigation and reload. **Mark as confused** before or after answering; clear it explicitly when ready. Reuse the note field for what needs explaining.

The HTTPS app caches its files, guides and exhibits after a successful first load for offline use. Open it online once before going offline. Updates install a compatible bundle; close existing app tabs and reopen online to activate a new bundle. On a phone, you can add the page to your home screen through the browser's menu.

## Material and credits

- 200 authored practice questions.
- 65 authored guide/index examples.
- 30 earlier authored practice questions.
- 675 imported practice questions: 226 Sefstratiou, 419 Praba Vejayan and 30 ExamTopics.

Source attribution and immutable original versions are preserved. Current local revisions are identified separately. **970 reviewed: 886 rewritten, 82 retained, 2 unresolved/unscored (968 scored).** See [the review report](CONTENT-REVIEW.md) and [per-question audit](data/question-audit.json). Some reasoning is in Czech; questions are in English. Private course-note links, research snapshots, personal answers and backups are excluded from this repository.

See [the complete grouping map](GROUPED-QUESTION-MAP.md), [classification audit](data/classification-manifest.json), [source/license notices](THIRD_PARTY_NOTICES.txt) and [Inter font license](assets/INTER-LICENSE.txt). Third-party material remains subject to its original terms. [Microsoft's official study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103) is the authority for the current exam scope.

## Run locally and update

```sh
python3 serve.py --lan
```

Open `http://127.0.0.1:8767/`; use the computer's LAN IP from a phone on the same Wi-Fi. The local server is optional; GitHub Pages serves the static app without Python or a backend.

```sh
python3 scripts/build_bank.py
node verify.js
```

This checks all 968 scored keys, deterministic option shuffling/resume, feedback identity, row/ordering/case behavior, confusion filters/merges, older backups, material-revision history and generated-data consistency. It verifies the app's behavior against the stored keys; it does **not** prove that those keys are factually correct.

The public compiler combines `sources/bank.original.json` with `sources/revisions.json` and the per-ID review record. It regenerates both bank formats, classification/coverage, the grouped map and guide family summaries. Edit the revision patches and audit record, then run the two commands above. Keep the imported baseline immutable. The compiler maintains `sources/content-history.json` so later revisions retain known backup versions and historical definitions.

The compiled bank and local HTML guides are included. All app paths are relative. GitHub Pages publishes `main` from the repository root; `.nojekyll` keeps the files as a plain static site. After editing, commit and push to update the site. Keep bank IDs and content/version fingerprints stable unless the learning content changes, so saved progress remains compatible.
