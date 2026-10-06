# AI-103 Self-learning · Topic Lab

[Open the learning app](https://jakknaj.github.io/AI-103-self-learning/)

Personal, unofficial study notebook: **970 questions, 16 topics, 108 decision families**, plus **10 case studies with 61 tasks**. Learn a rule, compare similar scenarios, then practice with answer reasoning. Works on desktop and mobile.

## Self-learning only · disclaimer

Author-created practice questions and scenarios are **made up from course/study materials and public documentation for self-learning purposes**. The bank also includes third-party practice material, clearly identified by source. Nothing is claimed to be an actual examination question or an official Microsoft answer key. This project is **not affiliated with, endorsed by, or sponsored by Microsoft**.

**Questions, answers and explanations can be wrong, incomplete, ambiguous or outdated.** Imported answer keys are not individually verified. Azure services, role names, APIs and examination requirements can change; the material and answer keys may be revised later. Verify answers against current official documentation and use your own judgment.

Everything is provided **as is, without warranties of accuracy, completeness, fitness for purpose or examination results**. To the extent permitted by applicable law, the maintainer accepts no responsibility for errors or outcomes resulting from reliance on this material. Use it for personal learning, not as authoritative technical guidance or a guarantee of passing an exam.

## Study

- **Topics:** choose a narrow decision family, learn its rule, compare variants and practice.
- **Case studies:** read a shared scenario and answer only that case's tasks, in source order.
- **Review:** retry mistakes and saved questions.
- **Progress:** export a backup; import it on another device to merge answers and notes.

The case section uses the same question records as topic practice. It adds no duplicate questions or scores. Answer reasoning stays hidden until an explicit check or reveal. Practice points are not Microsoft's scaled exam score and do not predict a pass.

## Privacy, mobile and offline use

No login, model/API calls, analytics or synchronization service. Answers, notes and bookmarks stay in this browser's local storage; GitHub hosts the static files. Each device/browser has separate progress. Export/import backups to transfer it. A backup from the matching local Topic Lab works here too.

The HTTPS app caches its files, guides and exhibits after a successful first load for offline use. Open it online once before going offline. On a phone, you can add the page to your home screen through the browser's menu.

## Material and credits

- 200 authored practice questions.
- 65 authored guide/index examples.
- 30 earlier authored practice questions.
- 675 imported practice questions: 226 Sefstratiou, 419 Praba Vejayan and 30 ExamTopics.

Source labels, explanations, caveats and original answer keys are preserved. Added grouping and decision rules are study guidance. Some reasoning is in Czech; questions are in English. Private course-note links, research snapshots, personal answers and backups are excluded from this repository.

See [the complete grouping map](GROUPED-QUESTION-MAP.md), [classification audit](data/classification-manifest.json), [source/license notices](THIRD_PARTY_NOTICES.txt) and [Inter font license](assets/INTER-LICENSE.txt). Third-party material remains subject to its original terms. [Microsoft's official study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103) is the authority for the current exam scope.

## Run locally and update

```sh
python3 serve.py --lan
```

Open `http://127.0.0.1:8767/`; use the computer's LAN IP from a phone on the same Wi-Fi. The local server is optional; GitHub Pages serves the static app without Python or a backend.

```sh
node verify.js
```

This checks grading behavior, all 970 keys, case-only membership/order, filters and backup compatibility. It verifies the app's behavior against the stored keys; it does **not** prove that those keys are factually correct.

The compiled bank and local HTML guides are included. All app paths are relative. GitHub Pages publishes `main` from the repository root; `.nojekyll` keeps the files as a plain static site. After editing, commit and push to update the site. Keep bank IDs and content/version fingerprints stable unless the learning content changes, so saved progress remains compatible.
