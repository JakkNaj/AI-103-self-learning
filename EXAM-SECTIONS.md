# AI-103 exam-section and code-completion research

Checked 2026-10-08 against current Microsoft documentation and `data/bank.json`. This note accompanies the application changes; it does not import questions or certify every existing answer.

## Official exam outline

The [Microsoft study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103) states skills effective **April 16, 2026**. Its visible publication/update date is **April 14, 2026**. Page metadata also contains a July 7, 2026 publishing timestamp; that is not a new skills-effective date.

| ID | Official domain | Weight |
|---|---|---|
| D1 | Plan and manage an Azure AI solution | 25–30% |
| D2 | Implement generative AI and agentic solutions | 30–35% |
| D3 | Implement computer vision solutions | 10–15% |
| D4 | Implement text analysis solutions | 10–15% |
| D5 | Implement information extraction solutions | 10–15% |

Concise paraphrase of the sub-objective scope; use the [full official outline](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103#skills-measured-as-of-april-16-2026) for its complete bullet wording:

- **D1:** Service/model/retrieval/integration selection; infrastructure/deployment/CI/CD; quotas/cost/monitoring/search-health/security; safety/evaluators/auditing/oversight.
- **D2:** Model consumption/RAG/workflows/evaluation/SDK integration/project connections; agent goals/state/tools/memory/orchestration/approvals/error analysis; prompts/parameters/reflection/observability/hybrid orchestration.
- **D3:** Image/video generation/editing/controls; visual analysis/captions/QA/accessibility/Content Understanding modes/regions/video; visual safety/injection/watermarks/policy.
- **D4:** Entity/topic/summary/JSON extraction; sentiment/safety/translation/domain customization; speech recognition/synthesis/customization/audio reasoning/translation.
- **D5:** Multimodal ingestion/indexing; semantic/hybrid/vector retrieval; skills/OCR/agent integration; document layout/fields/Content Understanding/structured/markdown output.

The percentages are **ranges**, not a fixed number of questions per domain. Preserve those ranges in the interface. A local weighted mixed test must label its chosen integer allocation as a study approximation; it must not imply Microsoft promises that exact distribution.

## Original code-completion inventory

Before this update, the bank contains **970 questions**. The strict completion set is **46 questions and 105 selectable blanks**:

- **44 text-template completion questions, 101 blanks:** 42 Sefstratiou questions (`type="rows"`, `format="code"`, `{{row-id}}` placeholders), plus Praba Vejayan #703 and #705 (`type="rows"`, `format="dropdown"`, `[[drop1]]`/`[[drop2]]` placeholders).
- **2 image-backed completion questions, 4 blanks:** `WEB-examtopics-6-57c535b2` (`assets/image7.png`, credential and Responses method), and `WEB-examtopics-30-6a709e3f` (`assets/image23.png`, run-payload property/value).

Both images were inspected. The existing row options make their blanks interactive even though these two records have no `code` field.

Do **not** classify every code-bearing question as completion. `WEB-pvejayan-84-01be3f8b` contains `{{vector_store_id}}`, but this is a real structured-input placeholder within already-complete Foundry code. The question asks the learner to identify the required input; it is code reading. Other Praba snippets likewise ask learners to interpret finished code. `WEB-examtopics-7-ab15227c` selects complete Power Fx expressions; it can have a separate expression-selection category. `WEB-examtopics-8-040a54cc` matches guardrails/storage access and is not code completion.

| Existing source-domain tag | Completion questions |
|---|---:|
| D1 | 11 |
| D2 | 16 |
| D3 | 6 |
| D4 | 8 |
| D5 | 5 |

| Existing topic | Completion questions |
|---|---:|
| Agents & orchestration | 5 |
| Tools & API calls | 7 |
| Prompting, RAG & training | 2 |
| Search & indexing | 4 |
| Document Intelligence | 1 |
| Content Understanding | 1 |
| Roles & least privilege | 3 |
| Deployment & operations | 2 |
| Safety & safeguards | 2 |
| Language & translation | 3 |
| Speech & Voice Live | 5 |
| Vision, images & video | 6 |
| Credentials & authentication | 5 |

Counts above include the two image-backed questions and use each question's primary topic/domain. They are a bank inventory, not a statement of complete official-objective coverage.

## Representative completion exercises and evidence

| Existing question ID | Skill | Supporting current primary source |
|---|---|---|
| `WEB-sefstratiou-107-ed199d58` | Construct a project client with endpoint and credential | [Foundry SDKs/endpoints](https://learn.microsoft.com/en-us/azure/foundry/how-to/develop/sdk-overview) shows `AIProjectClient`, a project endpoint and `DefaultAzureCredential`. |
| `WEB-examtopics-6-57c535b2` | Keyless project authentication and a new Responses call | [Foundry SDKs/endpoints](https://learn.microsoft.com/en-us/azure/foundry/how-to/develop/sdk-overview) demonstrates `get_openai_client()` followed by `responses.create()`. |
| `WEB-pvejayan-703-38746cb7` | Chat Completions JSON mode | [JSON mode](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/json-mode) documents `response_format={"type":"json_object"}`, an explicit JSON instruction, and the absence of fixed-schema guarantees. |
| `WEB-pvejayan-705-14acdeba` | One-shot Speech SDK recognition | [Recognize speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech) demonstrates `SpeechRecognizer` and `recognize_once_async().get()`, separately explaining continuous recognition. |
| `WEB-sefstratiou-135-04492891` | Modern batch-transcription diarization | [Speech API migration](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/migrate-2024-11-15) replaces `diarizationEnabled` with nested `diarization` containing `enabled` and optional `maxSpeakers`, and identifies `2025-10-15` as the current GA version. |
| `WEB-sefstratiou-126-9561f51c` | Vector-index field configuration | [Create a vector index](https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-create-index) describes vector field searchability, dimensions and named vector-search profiles. |

These checks support the listed operations, not every line, distractor or unrelated question in the bank. API/SDK contracts remain version-sensitive.

## Classification and implementation cautions

- `domain` is present for **875** records; **30 legacy + 65 guide questions** need an explicit local domain assignment. Preserve original attribution and record the assignment basis separately.
- Topic and official domain are different axes. Search appears in D1 service selection/operations, D2 application RAG and D5 ingestion/retrieval. Safety spans D1 governance, D3 visual safety and D4 text analysis. Credentials can test D1 security or D2 SDK integration. Do not assign entire topics to one official domain automatically.
- Existing source-domain tags are convenient inherited classifications, not Microsoft-approved item mappings. Prefer the actual decision being tested when reviewing a doubtful assignment. Related-family links must not produce duplicates in a mixed test.
- Preserve case context when mixing questions; include the applicable case narrative even if only one task is selected.
- Code-practice selection should use explicit completion criteria/IDs, not `q.code` alone and not a broad regex across prose.
- The original image for `WEB-examtopics-30-6a709e3f` contains a **classic** agent run payload (`assistant_id`). [Current tool guidance](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/tool-best-practice) supports `tool_choice="required"` for one-or-more calls in the newer Responses contract, but that alone does not validate the older image's exact runtime contract. The [classic tool overview](https://learn.microsoft.com/en-us/azure/foundry-classic/agents/how-to/tools-classic/overview) uses a specific named-tool object to force a call; the [classic SDK mode enum](https://learn.microsoft.com/en-us/python/api/azure-ai-agents/azure.ai.agents.models.agentstoolchoiceoptionmode?view=azure-python) lists AUTO/NONE. The [primary classic TypeSpec definition](https://github.com/Azure/azure-rest-api-specs/blob/main/specification/ai/data-plane/AIAgents/tools/models.tsp) likewise names only `none`/`auto`, while permitting an open string. This does not prove the service rejects `required`, but does not establish the needed guarantee either. Recommended repair: replace the classic image with a current `openai_client.responses.create(..., tools=tool_definitions, {{r1}}="{{r2}}")` completion and pin that runtime in the stem. The [current project Responses reference](https://learn.microsoft.com/en-us/rest/api/aifoundry/project/responses) explicitly documents `required` as one-or-more tool calls. Preserve row IDs, option meanings and attribution; mark the changed runtime/code as a material revision.

Existing completion material satisfies the user's conditional request. No new scraping/import is needed to create its dedicated practice test.

## Implemented update

The locally revised #30 now uses a text Responses template and two selectable blanks; its former classic run image is not used for scoring. Completion inventory remains **46 questions / 105 blanks**, now **45 text templates and one image-backed exercise**. The primary domain mapping, five exam-part tests, five corresponding code subsets and one combined code test are generated from `sources/exam-blueprint.json`; source domains are preserved and 95 supplemental items have explicit assignments. Notes/flags survive the material #30 revision, while prior attempts become history.
