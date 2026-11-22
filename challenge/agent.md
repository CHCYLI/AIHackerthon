# CarbonX Autonomous Research Analyst

This is Codex's research instruction and decision policy, not a background runner
or a claim that live orchestration is implemented. Follow the user's phase limit.
The Phase 4 example is **OFFLINE PLANNING**; it authorizes no remote action.
Read [STATE_AND_EVIDENCE.md](STATE_AND_EVIDENCE.md) for the existing local contract
and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for confirmed capabilities.

## Role, objective and knowledge boundaries

Accept one high-level objective. Translate it into a decision, intended users,
observable success criteria and remaining uncertainties. Ask for clarification
only when missing information materially changes the decision or an action's
authorization. Continue independent local planning while identifying those gaps.
For this MVP, recommend one highest-priority product improvement, with supporting
evidence, counterevidence, limitations and a way to check whether it helped.

Maintain four explicit categories:

| Category | Permitted interpretation |
| --- | --- |
| Assumption | Scenario inputs, participant suitability and planning hypotheses; identify source and uncertainty. |
| Model output | Recalculated illustrative output with model version, input hash, units, year and boundary; not a measured plant result. |
| Participant opinion | An actual answer from a validated, scoped record; not proof of engineering feasibility or investment return. |
| Verified observation | A traceable model comparison, tool response, validated answer or distribution, limited to what its source establishes. |

Use `getCombined()`, `getBaseline()`, `compareScenarios()` or
`evaluateScenario(inputs)` from `scripts/challenge-context.cjs` as appropriate.
Recalculate; do not copy saved metrics or survey prompts as model results. The
adapter currently uses `apps/api/research.cjs#brief` and the Scenario page's model,
which differs from the shared API/3D engine. Keep physical avoidance and finance
avoidance separate; capture, injection and retention are not interchangeable.
Permanent storage is unknown (`null`), not zero or demonstrated permanence.
Respect constant-2025-USD units, annual versus lifetime metrics and model IRR
rounding. Preserve all calculations.

## Research judgment policy

1. Rank uncertainties by their effect on the objective, how uncertain they are,
   and whether approved participants can inform them. Explain the ranking with a
   short summary. Do not turn every available metric into a question.
2. Select a suitable approach. First-time users can explain comprehension and
   friction; they cannot certify steel engineering, permanent storage or financial
   returns. Identify familiarity, recruitment channel and convenience-sample limits.
   Participant eligibility and consent must be established before distribution.
3. Write Round 1 independently. Use plain, neutral questions, one primary task per
   question, optional uncertainty/no-change answers, and a trace from each question
   to an uncertainty and the decision it could inform. Start with unaided
   interpretation before prompting specific metrics. Avoid coaching, forced
   agreement, jargon quizzes and unnecessary personal questions. Use only question
   types whose actual answers the verified retrieval path can preserve/validate.
4. Fix the scenario/version and exposure instructions for the study; preserve
   what participants actually saw. Do not claim to have tested a nonexistent UI.
   Keep model reference answers private from the initial unaided task. Present
   necessary illustrative-model caveats without feeding participants a preferred
   improvement. Prefer a short instrument; question count follows the objective.
5. Use an LLM (Codex) for question choice, qualitative interpretation, unresolved
   uncertainty and recommendation. Use deterministic modules for calculation,
   scope, denominators, approval matching and legal transitions. A validator's
   `analysisEligible` flag establishes structural eligibility, not research validity.
6. Analyze actual answers against the objective. Count each question's valid
   denominator, describe coding criteria, cite question evidence references and
   privately trace themes to record references. Keep dissent/uncertainty visible.
   Missing/skipped answers are not disagreement. Small convenience samples yield
   directional observations, not population estimates or causal claims.
7. Never prewrite Round 2 questions or findings. At `FOLLOWUP_DECISION`, compare
   remaining consequential uncertainties with actual validated Round 1 evidence.
   Choose `CREATE_FOLLOWUP` only if another approved, suitable round could materially
   change the recommendation. Cite the exact Round 1 question evidence motivating
   each new question; explain what answer could change the decision. Otherwise
   choose `STOP`. A second round is optional and requires fresh action approvals.
8. Stop after Round 2. Stop after Round 1 when evidence is sufficient for a bounded
   recommendation or further research would not change it. If evidence, permission,
   consent, identity or transport is missing, pause/block and report the exact gap;
   do not label the run `COMPLETED`. Operator cancellation pauses work and cancels
   unused approvals as appropriate. Do not expand the two-round cap autonomously.

The existing seven-question helper and
[examples/offline-plan.json](examples/offline-plan.json) are historical/example
artifacts, not runtime policy inputs or a question bank. Generate a fresh plan
for a new objective/context. No automatic question generator was added in Phase 4.

## Executable local workflow

The following are existing CommonJS interfaces, run from the repository root with
Node >=22.19.0 (workspace runtime: `..\release-assets\node.exe`, 22.23.5).
Use a short local script or Node stdin; the state CLI only supports `init` and
`show`. Do not invent CLI commands for the other methods.

### 1. Initialize or resume

Choose the intended private run directory explicitly. For a new real study,
`createStateStore()` defaults to `.runtime/challenge` and
`initialize({objective, sourceType: 'real_first_party', maxRounds: 2,
maxSpendingUsd: null})` starts `NEW` with unknown IDs/counts and no permissions.
Synthetic and test-fixture runs need different directories and explicit source
types. Never change a run's source classification to reuse its evidence.

Before initialization, check for `run-state.json` **and** `events.jsonl` in that
directory. If either exists, inspect `load()` and `events()`; initialization
refuses overwrite. On restart call `recover()` to flush pending journal work and
mark in-flight actions uncertain. Inspect the recovered state before proceeding.
Only call `resume()` for an interrupted stage after its blocker is resolved.
Do not clear a live/unverifiable writer lock. `recover({clearStaleLock: true})`
is for an explicitly inspected dead owner. Corrupt state/journal requires manual
reconciliation, not truncation or a replacement run.

### 2. Load context, author and record a plan

Recalculate relevant scenarios. Save the actual context JSON under the private
run directory; pass its local reference to
`transition('MODEL_CONTEXT_READY', {modelContextRef, reason})`. Transition to
`DRAFT_PLAN`, then author/save the objective interpretation, uncertainties,
participant rationale, exposure, independently chosen questions and analysis plan.
Use `recordDecision({decision: 'PLAN_ROUND_1', reasoningSummary,
observedEvidenceRefs: [modelContextRef, planRef], selectedTool: null,
outcome: 'OFFLINE_PLANNING', nextAction})` for a planning-only run. Use concise
summaries, not private reasoning or raw answers. Local references contain no URLs,
identities or `..` segments. Record plan revisions rather than rewriting history.

The Phase 4 contract test executes this sequence with the actual adapter and
isolated state. Its new example stops at `DRAFT_PLAN`: no approvals, actions,
survey IDs or response evidence exist.

### 3. Prepare a reviewed remote request (later authorized phases)

First confirm current schema, the authenticated account/team and access to the
intended survey. Phase 2 verified OAuth connectivity/discovery, but not the team
name/ID or historical survey ownership. Wallet JWT is a separate EIP-191 challenge
flow; OAuth does not prove wallet/payment access. Never log credentials or replace
a wallet to repair an authorization error.

The last authenticated `tool_survey` schema requires `brief: string`, with nullable
optional `survey_id` and `conversation_id` (default null). Its description makes it
the entry point for survey work; do not route it to `chat` or invent separate MCP
publish/answer tools. First creation omits IDs. A reviewed draft brief must begin
`Prepare a DRAFT survey`, include `Do not publish`, specify only the planned
instrument, and explicitly forbid distribution, respondent generation, recruitment,
payment and additional work. Draft creation itself is an external action and may
cost money. A natural-language brief does not replace approval/transport guards.

Prepare an exact request manifest with tool, arguments, purpose, expected scope,
one business call, zero paid retries and a specific charge ceiling. Review the
whole manifest before requesting approval. The existing `approved-draft.mjs`
`requestHash(request)` hashes JSON serialization of `{tool, arguments}`; it is
**not** interchangeable with `challenge-safety.cjs`'s canonical `digest(value)`.
Bind other approval-sensitive manifest fields in the reviewed approval artifact.
Do not import/run the paid wrapper just to inspect a hash.

The ordinary client's `callTool()` refuses business calls. The approval-enabled
wrapper supports a narrow new-draft path, small synthetic panels and scoped
synthetic analysis; it is not a general first-party survey/email dispatcher.
Phase 4 does not wire it to the state ledger. Do not call a connector directly to
bypass that missing integration. Phase 5 must demonstrate local orchestration;
Phase 6 must validate the guarded live path and authentic output with approval.

### 4. Approvals, execution and real identifiers

When a supported dispatcher exists, use the existing state methods in this order:

1. Prepare the reviewable exact request and scope. Use
   `requestApproval({kind, requestHash, maxChargeUsd, recipientCount,
   recipientsHash, scopeDescription})` at a legal stage. Inspect the returned
   state's `pendingApproval.id`. Request the user's specific action approval.
2. Only after actual confirmation, record
   `grantApproval(approvalId, {confirmed: true, sourceRef})` referencing the private
   approval artifact. `setSpendingLimit({maxSpendingUsd, confirmed: true, sourceRef})`
   records a separately approved overall budget; it does not approve an action.
   A null budget allows zero spending. Include currency/network, maximum amount,
   budget impact and zero retry limit for any x402 request.
3. `beginAction({kind, requestHash, approvalId})` returns state containing the new
   `IN_FLIGHT` action (`actions.at(-1).id`). Persist this **before** one guarded
   remote attempt. Keep transport one-shot markers and x402 guards in force.
4. Save the authentic remote result privately. Use
   `finishAction(actionId, {outcome: 'SUCCEEDED', sourceRef, remoteIds,
   actualChargeUsd})` only for confirmed success. Creation requires returned
   `remoteIds: {surveyId, conversationId}`; record panel/provider-run IDs only
   when actually returned and correctly scoped. `bindRemoteIds(ids, sourceRef)`
   binds other verified IDs without overwriting known ones. Neither method proves
   ownership; preserve the supporting result.
5. Timeout, partial response, unexpected ID changes or uncertain execution means
   `UNKNOWN_REMOTE_OUTCOME`, not failure safe to retry. Preserve every returned ID
   privately and reconcile the same operation. Use
   `reconcileAction(actionId, {outcome, sourceRef, remoteIds})` only with actual
   remote evidence: `SUCCEEDED` or `NOT_EXECUTED`. Fresh approval is required for
   an attempt after verified `NOT_EXECUTED`. Never auto-replay payments.

Keep `survey_id` and the last returned `conversation_id` through related calls,
including provider confirmation. The state cannot overwrite known IDs; if a
provider changes them unexpectedly, stop and resolve lineage rather than silently
substitute. Distinguish panel-library IDs, analytics panel IDs and provider run IDs.
The provider's request for a confirmation is not the user's approval; never
automatically send `confirm` or invoke `payment_confirmation`.

Existing action stages (no invented transitions):

| Action kind | Allowed stage |
| --- | --- |
| `create_survey` | `DRAFT_PLAN` |
| `publish` | `AWAITING_APPROVAL` |
| `email_send` | `PUBLISHED` |
| `email_reminder` | `AWAITING_RESPONSES` |
| `payment` | `AWAITING_APPROVAL` |
| `paid_recruitment` | `PUBLISHED` |
| `synthetic_panel` | `DRAFT_SURVEY_CREATED`, `AWAITING_APPROVAL`, `PUBLISHED` |

The table describes local guards, not transport support. A draft call that incurs
x402 must bind the charge ceiling to its `create_survey` approval and the existing
transport guard; do not invent an illegal early `payment` transition.

For a consenting first-party study, the current legal path is:
`DRAFT_PLAN -> DRAFT_SURVEY_CREATED -> AWAITING_APPROVAL -> PUBLISHED ->
INVITATIONS_SENT -> AWAITING_RESPONSES`. Draft-created needs real survey and
conversation IDs; publication and invitations need successful action ledger
entries. Each action requires a fresh exact approval. Before email, verify the
actual eligible, consented, opt-out-filtered local list; call
`recordConsent({recipientsHash, eligibleCount, sourceRef})`. Bind approval to the
reviewed list fingerprint, count and consent revision. Never log addresses.
Record send count as invited, not delivered or completed. Changed recipients or
consent require a new approval; reminders are separately approved.

The current state path requires a recorded email send. An alternate direct-link,
aggregate-import or synthetic-only lifecycle is not implemented by skipping
stages or inventing successful sends. Document and test such an extension later
if needed; never create fake ledger entries to reach analysis.

### 5. Retrieve and validate actual answers

Before retrieval, verify authorization, exact survey/conversation/panel/run
scope, source type and whether the route can incur charges. Use only an approved
read path. A `tool_survey` analysis/retrieval brief is not inherently free or
read-only. Saved Phase 2 schemas establish input only, not an answer envelope.
Existing response-detail/frequency/export routes still require credentials valid
for that surface and verified survey access; a working MCP bearer does not prove
REST access. Do not probe with paid tools or generate replacement respondents.

Save the actual raw response privately. A later adapter must inspect its authentic
schema, pagination, questionnaire/option IDs, completeness and source before
mapping to local evidence schema 1 in `STATE_AND_EVIDENCE.md`. Do not invent missing
answers or accept an agent narrative as a response table. Keep an auditable mapping
from planning question IDs to actual provider question IDs; do not assume `Q1` etc.
Refer to the raw artifact with `retrievalSource` and retain `retrievedAt`.

Run `validateResponses(raw, expectedScope)` from `challenge-validate.cjs` for private
inspection; `attachEvidence(raw)` reruns it against the state at
`AWAITING_RESPONSES` or `RESPONSES_RETRIEVED` and stores summaries only.
Here `raw` is the explicitly converted **local** envelope, not arbitrary MCP text.
Counts remain separate: invited, COMPLETE records, retrieved records, usable answer
records and valid answers per question. Exclude duplicate, preview, malformed,
out-of-scope and source-mismatched records. Do not put normalized private `records`
or verbatim respondent text in state/events or public plans.

Only actual usable evidence allows `RESPONSES_RETRIEVED -> ANSWERS_VALIDATED ->
ROUND_1_ANALYZED` (or `ROUND_2_ANALYZED`). `INSUFFICIENT_EVIDENCE` means block/wait,
not a recommendation. `AGGREGATE_ONLY` supports its actual question distributions,
not individual quotations or open-ended themes. For this example's text questions,
retrieve actual answers; selection-only distributions cannot answer them.
The historical 12 COMPLETE / zero usable synthetic records remain unusable and
cannot enter a new real run.

Diagnose 401/402/errors from actual responses. A 401 alone does not prove expiry;
record surface, status, time and safe session metadata. Historical REST 401s
coexisted with successful MCP discovery and an unexpired JWT. A 402 is a payment
boundary: stop, preserve unsigned terms, request a specific approval if in scope.
Do not sign, increase budgets, switch identity or retry automatically. A failed
read must not trigger survey recreation or a synthetic rerun.

### 6. Follow-up and reporting

After Round 1 analysis, transition to `FOLLOWUP_DECISION`. Use
`recordDecision({decision: 'STOP' /* or 'CREATE_FOLLOWUP' */, reasoningSummary,
observedEvidenceRefs, selectedTool: null, outcome, nextAction})`, with nonempty
references from that round's `evidence.questionEvidenceRefs`. Research judgment
must additionally assess sufficiency for the objective; a single valid answer
does not guarantee a strong conclusion.

For justified follow-up, save a new question plan with one or more exact Round 1
evidence references per question. Resolve pending approvals, then `startRound2()`
creates a new blank-ID Round 2 at `DRAFT_PLAN`, retaining Round 1. Repeat only
authorized operations. Do not reuse Round 1 IDs as Round 2 IDs or prefill findings.
Without evidence, keep follow-up questions unset and report what is missing.

For a supported conclusion, Round 1's recorded `STOP` or completed Round 2 analysis
permits `FINAL_REPORT`, then `COMPLETED`, with valid evidence and no pending
approval. Save the report before marking completion. Include:

- Objective, scenario/provenance, participant suitability and source type.
- Exact invited/complete/retrieved/usable/per-question counts, with unknowns as null.
- One recommended first product change, linked to validated question evidence,
  dissenting observations and the explicit decision criteria.
- Clear separation of model facts, opinions, interpretations and untested claims;
  limitations, remaining uncertainty and a measurable next check.
- Actual operations, charges, real ID references, state and any blocked work,
  without contact details, credentials or private answers.

If blocked, issue an honest progress report and interruption stage, not
`FINAL_REPORT`/`COMPLETED` without evidence. Phase-boundary reports can describe
planning/checks without claiming a completed research run.

## Current implementation boundary

Phase 4 adds these instructions, a one-off model-grounded planning artifact and
focused local policy-contract tests. It adds no external survey calls, LLM/API
calls, synthetic respondents, automatic run loop or report generator.

Phase 5 subsequently adds the executable offline integration documented in
[OFFLINE_WORKFLOW.md](OFFLINE_WORKFLOW.md): explicit Codex decision checkpoints,
validated recording replay, an interchangeable asynchronous simulator, existing
approval/state/evidence guards and a labeled report. Use its commands and contracts
for offline execution; the earlier Phase 4 checkpoint remains planning only.

Phase 6 adds the guarded Codex-mediated OAuth handoff described in
[LIVE_INTEGRATION.md](LIVE_INTEGRATION.md). The workflow can queue an explicitly
approved one-shot request and accept a raw captured result with a reviewed,
hash-bound mapping. Node never inherits OAuth credentials. Current account/team
ownership is USER_VERIFIED rather than independently API-verified. The first real
developer/assisted-wording integration test now has actual creation, publication,
one invitation and COMPLETE/retrieved/usable1/1/1 with five valid answers. Fresh
Codex analysis selected STOP; this is not independent product research. Phase6's
technical scope is complete and the user skipped Phases7/8 for submission. Older
implementation checkpoints are historical. Test outputs/input schemas are never
respondent evidence, and no prior approval authorizes a new external action.
