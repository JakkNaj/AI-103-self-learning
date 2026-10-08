# Content review · 2026-10-08

**973 reviewed · 887 rewritten · 84 retained · 2 unresolved · 971 scored.**

Rewritten includes **692 material scenario/option/code revisions** and **195 feedback/reference/clarification revisions** that retain the original progress fingerprint. The two unresolved items also receive revision history and remain outside scored practice. Question, family and case IDs remain stable. There are still 16 topics, 108 families and 61 tasks in 10 cases.

| Source | Reviewed | Rewritten | Retained | Unresolved | Material scored revisions |
|---|---:|---:|---:|---:|---:|
| Current authored | 203 | 182 | 20 | 1 | 181 |
| Guide examples | 65 | 65 | 0 | 0 | 46 |
| Earlier practice | 30 | 25 | 5 | 0 | 25 |
| Sefstratiou | 226 | 198 | 28 | 0 | 28 |
| Praba Vejayan | 419 | 408 | 11 | 0 | 405 |
| ExamTopics | 30 | 9 | 20 | 1 | 9 |

## Audit method and evidence

Items were inventoried by source, question type and decision family; repeated stems, implausible peers, code/API mismatches and generic feedback were inspected together. GUIDE-09-Q1 supplies the standard: intersect the workload, processing boundary and billing constraints, then eliminate each credible deployment alternative by the requirement it fails. Foundational literal-reading and useful matching/ordering exercises remain introductory.

The large Praba collection now varies the deciding requirement within each family. Other revisions repair weak alternatives, ambiguous scope, invalid code fragments, misleading row feedback and stale answer-letter references. Questions remain English; established English/Czech explanation conventions are preserved. Changed feedback names option text and preserves its stable ID association.

The [per-question audit](data/question-audit.json) records every reviewed ID, outcome, reason and relevant primary evidence. [Classification](data/classification-manifest.json), [coverage](data/coverage-report.json), [grouped map](GROUPED-QUESTION-MAP.md) and guide family summaries describe the current runtime bank. Original imported versions and source/license attribution are preserved in [the immutable baseline](sources/bank.original.json); [local patches](sources/revisions.json) distinguish revisions from those imports.

Technical checks used current Microsoft documentation, primary protocol references and documented SDK contracts. Classic agent samples explicitly pin their classic SDK/API surface; current agent-version examples use their corresponding surface. Successful link resolution alone was not treated as factual verification. Representative primary contents were checked against the claims, including deployment types, Search data actions, tool selection, Speech migration, output/evaluation dimensions and modality/version constraints.

## Representative before/after changes

- **AI103-D1-025:** retrieval failure previously contrasted microphone sampling and a tenant display name. It now contrasts retrieval evaluation with groundedness, response relevance and completeness; the missing expected document decides the retrieval-stage metric.
- **AI103-D2-010:** CSS and chat-title alternatives replaced with project, inference, ARM and Search endpoint/authentication configurations. The specified AIProjectClient/Entra development workload selects the project surface.
- **Praba #301/#319/#337/#355/#373:** one planning scenario formerly repeated with five different closing sentences. Variants now test measured small-classifier latency, grounded/tool-supported procurement reasoning, nearest-neighbor embeddings, visual spatial evidence and a compact model already qualified against an SLA. The required output/capability changes the choice.
- **Sefstratiou #135:** an isolated `diarizationEnabled` blank became a whole nested speaker-configuration choice for `2025-10-15`, including `enabled` and `maxSpeakers`. [Speech migration](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/migrate-2024-11-15), [batch request contract](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription-create).
- **Sefstratiou #143:** `min(delay, 30)` no longer truncates a server-requested wait. The bounded example sleeps the accepted full delay or raises/defers when the retry budget is insufficient; non-429 exceptions propagate. It explicitly assumes numeric-seconds Retry-After. [Throttling guidance](https://learn.microsoft.com/en-us/azure/well-architected/design-guides/throttling).
- **ExamTopics #20/#27:** mandatory retrieval is an explicit prerequisite before generation, rather than generic `required` among multiple tools. The evaluator item now asks specifically about evidence-supported claims, so groundedness covers its complete scope. [Tool-choice semantics](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/tool-best-practice), [RAG evaluators](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/rag-evaluators).
- **AI103-D1-053:** Search Index Data Contributor can read documents; it is rejected for a read-only requirement because its write/delete permissions exceed least privilege. [Search roles](https://learn.microsoft.com/en-us/azure/search/search-security-rbac).
- **ExamTopics #10:** conflicting historical project-reference wording replaced with the current documented `datasets`/`baseModel` model-training request. The item now distinguishes training datasets from base models and inference endpoints. [Models Create, 2025-10-15](https://learn.microsoft.com/en-us/rest/api/speechtotext/models/create?view=rest-speechtotext-2025-10-15).

## Unresolved, explicitly unscored

- **AI103-D3-017** and **WEB-examtopics-5-b2341361**: retired Content Understanding standard/pro multi-file claims could not be substantiated for their original version. Current agentic preview initially accepts one input file; that does not validate the archived multi-file key. Their reasons and preserved notes are visible under Progress → unresolved questions. [Version changes](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/whats-new), [current agentic mode](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/concepts/agentic-mode).

No pending audit IDs remain. This is a documented self-learning review, not an official answer key or a guarantee of factual completeness. Service capabilities and preview contracts may change. Azure service calls were not executed against a paid subscription; software grading checks establish consistency, while documentation checks provide the separate technical evidence.

## Attempts, confusion and backup compatibility

Fisher–Yates shuffles stable option IDs once per fresh attempt. A/B/C/D are assigned afterward; IDs carry text, selection, feedback and grading. Unordered row choices shuffle independently; row/case identities and case order remain intact. Ordering tasks shuffle their initial arrangement while retaining the canonical solution. Presentation, draft and attempt timestamps persist across rerenders, navigation and refresh.

Confusion is independent of scores, completion and bookmarks. Mark/clear saves immediately, and retries/correct answers leave the flag alone. Review exposes its count and a dedicated queue with source/topic filters. The existing note can describe the confusion. Clearing advances to the next flagged question or a keyboard-focusable empty state.

Schema-1 backups from the original published bank and schema-2 backups from known builds are validated and migrated. The compiler preserves known bank versions and historical definitions in `sources/content-history.json`, including later content revisions. Unchanged progress remains active. Material revisions archive attempts/drafts under their original content hash, retain notes/bookmarks/confusion and require a fresh current answer; old answers are never regraded against new options. Unknown records survive as retired records in exports. Unsupported versions are rejected without overwriting storage.

Confusion merges use its small ISO change timestamp; explicit `false` is a clear tombstone. Missing legacy fields supply no information. Older imports cannot erase a newer mark or resurrect a newer clear. This comparison assumes reasonably accurate device clocks. Notes merge, saved bookmarks are retained and coherent newer attempts keep their selections/order together. Progress is browser-local; transfer it with a JSON backup.

## Validation

`node verify.js` exercises all 968 scored keys; deterministic ID permutations, single/multi/row/ordering grading and feedback identity; saved order/selection resume; confusion/filter/merge independence; older-state migration and historical attempts; 61 ordered case tasks; runtime/source/classification consistency; and named technical regressions. It is deterministic and does not demand balanced random answer positions.

Actual Chromium browser DOM flows passed at 1402px desktop and a measured 390px mobile iframe: answer/check, mark confusion, note/bookmark, compare/reveal, review/source/topic filtering, clear/empty-state focus, refresh/resume, multi-selection, row answers, ordering and shared case context/order. The mobile toggle measures 44px and A/B/C/D align without shifting after grading; no page-level horizontal overflow was observed. Exported JSON and actual file-input current/legacy imports preserved flags, notes, bookmarks, unchanged progress, revised history and unknown records. With the local HTTP server stopped, reload, confused review/clearing and a guide fetch still worked from the compatible service-worker cache. The final v6 bundle also reloaded offline with a migrated historical attempt, current correct result, note and confusion flag intact.

The native preview host could not capture screenshots or apply its requested viewport resize reliably; mobile checks therefore used an actual 390px same-origin iframe and measured the rendered DOM. Native-phone gestures and a visual screenshot review remain untested. The service worker installs code/data/guides/media as one compatible cache bundle. Existing open clients retain their old bundle until closed; reopen the app online to activate the installed update. Local study progress is preserved.

## 2026-10-08 · Exam-part and completion practice

All 970 questions receive one primary official-domain mapping; 95 guide/legacy items have explicit local assignments. 968 scored questions enter five exam-part queues. The 46-question/105-blank code-completion set excludes complete-code reading and concept matching. Mapping source: `sources/exam-blueprint.json`; primary evidence: [EXAM-SECTIONS.md](EXAM-SECTIONS.md).

**WEB-examtopics-30-6a709e3f:** replaced the old classic run image with a current Responses request. The requirement is at least one tool call, not a specific retrieval tool or automatic client-function execution. Row option identities/key preserved; full per-row explanation repaired. The changed runtime/code requires a fresh attempt and keeps prior results as history. [Microsoft Responses contract](https://learn.microsoft.com/en-us/rest/api/aifoundry/project/responses).

`node verify.js` passes all 968 scored keys, 11 exam/code queue memberships, deterministic permutations, saved-order/filter/import behavior and the newly revised exercise's historical migration. The real browser suite passes 628 assertions at 320px, 390px and 1402px, including all five exam parts, six code queues, code blanks/exhibit, shared notebook state, reload and clearing the final confusion flag. Desktop/mobile screenshots were inspected. With the HTTP server stopped, cached reload restored the code queue, correct result and note; confusion changes saved and the exam evidence page loaded offline. The completed Responses template also parses as valid Python. These update checks supersede the older screenshot/cache-activation limitations above; physical-device touch testing remains outside this verification.

## 2026-10-08 · All-family mock

Each new mock samples two distinct scored questions from every primary family, then shuffles the complete 216-question set. All 16 topics and 108 families are represented. Related-family links do not duplicate questions; sampled case tasks retain their narrative. Resume, reload and backup/import preserve the sample, option order and position. Starting another mock preserves previous drafts/results as history and keeps notes, bookmarks and explicit confusion marks. The mock is equal family coverage, not the official exam weighting.

Three new original scenarios, stored separately in `sources/supplemental-questions.json`, fill the only families that previously had one scored question. They are retained after checking their key, requirement and per-option explanation against primary documentation:

- **MOCK-client-fit-001:** direct document query client vs index administration, project operations and model inference. [SearchClient](https://learn.microsoft.com/en-us/python/api/azure-search-documents/azure.search.documents.searchclient?view=azure-python), [SearchIndexClient](https://learn.microsoft.com/en-us/python/api/azure-search-documents/azure.search.documents.indexes.searchindexclient?view=azure-python), [Foundry SDK scope](https://learn.microsoft.com/en-us/azure/foundry/how-to/develop/sdk-overview).
- **MOCK-a2a-tasks-001:** continue an input-required task with the same task/context IDs, rather than polling without supplying input or starting duplicate work. [A2A protocol specification](https://a2a-protocol.org/latest/specification/).
- **MOCK-bounds-001:** combine early approval termination with a coordinator-enforced iteration ceiling. [Agent Framework termination and iteration limits](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/group-chat).

The existing 970 question definitions and grading hashes are unchanged. The previous published bank version remains accepted; classifications now carry the actual current content hashes. Runtime and source data, coverage and guide counts are synchronized. `node verify.js` passes all 971 scored keys and deterministic mock coverage/resume/backup/history tests. The browser suite passes 955 assertions at 320px, 390px and 1402px, including mock start/resume/Next/Finish/new sample, case context and independent confusion state.

With the local HTTP server stopped, the mock reloaded offline with all 216 sampled IDs, current position, option presentation, correct result, note and confusion mark unchanged. Desktop and mobile screenshots were also inspected.
