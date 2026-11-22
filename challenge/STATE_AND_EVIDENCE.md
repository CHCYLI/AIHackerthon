# Local research state and evidence contract

Phase 3 provides offline bookkeeping and validation. It makes no HTTP request, starts no research agent, signs nothing and grants no permission by itself. Future execution code must use these checks before dispatch and record the actual outcome afterwards. A local status is a caller-reported workflow fact, not independent proof of a remote operation.

## Files and commands

Default private directory: `.runtime/challenge/`, already ignored by Git.

- `run-state.json`: current run, round IDs/counts, approvals, consent fingerprints, action history and recovery state.
- `events.jsonl`: append-only sanitized decision/execution metadata. No individual answer text is stored here.
- `.state.lock`: exclusive local writer lock; `.recovery.lock` serializes explicit stale-lock cleanup.

With Node >=22.19.0 on PATH:

```sh
node scripts/challenge-state.cjs init "The actual high-level research objective"
node scripts/challenge-state.cjs show
npm run test:state
npm run test:challenge
```

The CLI intentionally exposes only initialization and a short status view. All other operations use `createStateStore()` from `scripts/challenge-state.cjs`. Tests supply separate temporary directories, use explicit fixtures and clean them up. No production run was initialized during implementation.

## Store API and stages

`createStateStore({directory?, now?})` exports `initialize`, `load`, `events`, `transition`, `bindRemoteIds`, `attachEvidence`, `recordDecision`, `startRound2`, `recordConsent`, `setSpendingLimit`, `requestApproval`, `grantApproval`, `cancelApproval`, `beginAction`, `finishAction`, `reconcileAction`, `recover` and `resume`.

Initialization requires the objective. `sourceType` defaults to `real_first_party`; other supported values are `synthetic` and `test_fixture`. That classification is fixed for a run. `maxRounds` is one or two, default two. All remote IDs begin null. `maxSpendingUsd: null` authorizes zero spending. Amounts use exact decimal arithmetic with at most six decimal places.

Normal stages:

```text
NEW -> MODEL_CONTEXT_READY -> DRAFT_PLAN -> DRAFT_SURVEY_CREATED
 -> AWAITING_APPROVAL -> PUBLISHED -> INVITATIONS_SENT
 -> AWAITING_RESPONSES -> RESPONSES_RETRIEVED -> ANSWERS_VALIDATED
 -> ROUND_1_ANALYZED -> FOLLOWUP_DECISION
    STOP -> FINAL_REPORT -> COMPLETED
    CREATE_FOLLOWUP -> DRAFT_PLAN (round 2) -> ... -> ANSWERS_VALIDATED
      -> ROUND_2_ANALYZED -> FINAL_REPORT -> COMPLETED
```

`PAUSED`, `BLOCKED`, `ERROR` and `UNKNOWN_REMOTE_OUTCOME` retain the interrupted stage. Resume returns only to that saved stage after uncertain actions have been reconciled. `COMPLETED` is terminal. Publication/invitation stages require recorded successful approved actions. Analysis and completion require usable question evidence; a completion counter alone fails with `INSUFFICIENT_EVIDENCE`.

`MODEL_CONTEXT_READY` requires a model-context reference. `DRAFT_SURVEY_CREATED` requires survey and conversation IDs. `bindRemoteIds(ids, sourceRef)` accepts only `surveyId`, `conversationId`, `panelId` and `remoteRunId` and refuses replacing an already known ID. The adapter must supply actual returned IDs and a traceable local artifact reference.

A follow-up decision is `STOP` or `CREATE_FOLLOWUP` with a brief `reasoningSummary` and references to validated first-round questions. `startRound2()` preserves the first round, creates blank second-round IDs and permits no third round. It does not generate questions or observations.

## Approval, consent and action lifecycle

Supported action kinds: `create_survey`, `publish`, `email_send`, `email_reminder`, `payment`, `paid_recruitment`, `synthetic_panel`. Each requires a separately requested and explicitly confirmed approval bound to run/round, survey, kind, exact request hash and charge ceiling. Pass the hash of the reviewed request, using the existing client's `requestHash` when integrating its approved path; do not reconstruct a different request after approval.

```javascript
// Illustrative API shape only; no network operation is shown or authorized.
const { createStateStore } = require('../scripts/challenge-state.cjs');
const store = createStateStore();
const pending = store.requestApproval({
  kind: 'publish', requestHash: reviewedRequestHash,
  maxChargeUsd: '0', scopeDescription: 'The exact proposed publication'
}).pendingApproval;
// Only after actual explicit operator confirmation:
store.grantApproval(pending.id, { confirmed: true, sourceRef: actualApprovalRef });
const updated = store.beginAction({kind: 'publish', requestHash: reviewedRequestHash, approvalId: pending.id});
const actionId = updated.actions.at(-1).id;
// Future caller dispatches exactly once, then records actual evidence via finishAction.
```

The module does not dispatch operations. Existing payment guards must remain in the actual transport. Budget is checked both when requesting/granting approval and when reserving intent. In-flight/unknown actions reserve their ceiling. Confirmed success uses the actual charge, or conservatively the ceiling when no actual charge is supplied. An initially null budget can change via `setSpendingLimit({maxSpendingUsd, confirmed: true, sourceRef})` only after actual operator confirmation. This never approves an individual action and cannot reduce the limit below recorded spending/reservations.

`recordConsent({recipientsHash, eligibleCount, sourceRef})` stores only a reviewed list fingerprint/count/reference. Email approvals bind to that exact list and consent revision; a withdrawal/list change invalidates unused approvals. Callers must derive these fields from the actual consented, opt-out-filtered file. This layer neither stores addresses nor verifies the content of a fingerprinted list. Reminders require their own approval.

`beginAction()` consumes approval and durably writes `IN_FLIGHT` before returning. One unresolved/successful operation per action kind per round is allowed; changing the request hash does not bypass this restriction. Creating a replacement survey when one is already known is refused.

`finishAction(actionId, {outcome, sourceRef, remoteIds?, actualChargeUsd?})` accepts `SUCCEEDED` or `UNKNOWN_REMOTE_OUTCOME`. Creation success requires actual returned survey/conversation IDs. A timeout is unknown, not permission to retry.

On restart, call `recover()`. In-flight actions become unknown; nothing is replayed. `reconcileAction(actionId, {outcome, sourceRef, remoteIds?})` requires an explicit remote-check reference and either `SUCCEEDED` or `NOT_EXECUTED`. Only the latter permits a new attempt, after a fresh approval. `resume()` alone never repeats an operation. There is no claim of provider-side idempotency.

## Durability and journal recovery

Each mutation takes a writer lock, flushes any pending journal event, validates the change, fsyncs a temporary JSON state file and atomically renames it. The state contains a redacted event outbox before the event is appended and flushed. Recovery deduplicates an already appended event by its event ID and content, then clears the outbox. Thus a lost append acknowledgement does not duplicate the journal event or erase an action intent.

`recover({clearStaleLock: true})` may remove a state writer lock only after the recorded owner process is confirmed absent. A live or unverifiable owner remains locked. A torn/malformed journal or conflicting event fails closed and preserves history for manual reconciliation; the library does not truncate evidence. A crashed recovery-lock owner also requires operator inspection. Atomic rename/fsync provide local filesystem protection, not a distributed transaction or a guarantee against hardware/storage failure. Windows permissions depend on the directory ACL; POSIX mode bits alone do not establish Windows access controls.

Events contain timestamp, run ID, stage/round, evidence references, decision, concise reasoning summary, selected tool, remote IDs, outcome and next action. Only this whitelist is accepted for events. Credential patterns, emails, phone numbers and URLs in free text are redacted; structured respondent/contact fields are omitted. Do not put names, raw answer text or private model reasoning into free-text summaries: redaction is defense in depth, not a general PII detector.

## Explicit evidence input contract

`validateResponses(raw, expectedScope?)` in `scripts/challenge-validate.cjs` accepts **local schemaVersion 1**, not an arbitrary vendor response. Tool input schemas were discovered in Phase 2, but authentic per-question output payloads remain unverified. The row layout below follows the existing saved-report interchange convention; a live adapter must be checked against actual returned data before using it.

```javascript
// TEST FIXTURE shape only. These are not actual survey IDs or responses.
{
  schemaVersion: 1, sourceType: 'test_fixture', round: 1,
  surveyId: 'fixture-survey', conversationId: 'fixture-conversation',
  panelId: 'fixture-panel', runId: 'fixture-provider-run',
  retrievalSource: 'fixture:private-response-file', retrievedAt: '2026-11-22T00:00:00.000Z',
  invitedCount: null, completedRecords: 1,
  questionnaire: {Q1: {type: 'select/single', options: {'1': 'Fixture option'}}},
  responses: [{response_id: 'fixture-record', run_id: 'fixture-provider-run', status: 'COMPLETE', data: {Q1: '1'}}]
}
```

Supported question types are `select/single`, `select/multiple`, `text` and finite `number`. Provider IDs are treated as opaque nonempty identifiers, not assumed UUIDs. Unsupported types/envelopes fail closed. Current MVP limits are 100 questions, 10,000 input rows and 100 aggregate entries.

Counts remain distinct:

- `invitedCount`: explicit source count or confirmed local send count; unknown is null.
- `completedRecords`: supplied total, or scoped unique COMPLETE records when only rows are available.
- `retrievedAnswerRecords`: received array length before exclusions, or null when no individual rows were returned.
- `usableAnswerRecords`: distinct completed records with at least one valid answer, excluding duplicate IDs, malformed/out-of-scope/source-mismatched rows, previews and exclusions.
- `validAnswersPerQuestion` / `questionCounts`: each question's actual denominator; valid partial answers contribute only to questions answered.

All copies of a duplicate response ID are excluded. No demographic metadata, completion flag or prose summary is converted into answers. Classification and scope must match the run, and real/synthetic/fixture denominators are never combined.

For aggregate-only input, omit individual rows and supply `aggregates: [{questionId, denominator, counts: {optionCode: count}}]`. Denominators and option/count consistency are validated. Individual usable counts remain null, and `AGGREGATE_ONLY` permits only the supported question distributions, not individual/open-ended findings. Missing denominators or no usable evidence produce `INSUFFICIENT_EVIDENCE`. Twelve COMPLETE records with zero usable answers cannot pass the analysis gate.

The validator returns private normalized `records` with hashed record references and answer values. `attachEvidence()` reruns validation and persists only the summary/counts/limitations, never those individual records. Callers must preserve authentic raw evidence privately and keep its local reference; local structural validation does not establish authenticity, ownership, consent or scientific validity.

## Verification

At the Phase 3 checkpoint: 39 state/evidence tests passed, plus 9 context tests and 26 Flashpoint client tests (74 total, zero failures). Tests include a hard-killed writer, concurrent processes, journal append/acknowledgement failures, uncertain payments, explicit budget updates, source separation and the 12 COMPLETE / zero usable regression. No Flashpoint request was made. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for subsequent checkpoints and [agent.md](agent.md) for the Phase 4 research policy; these local interfaces remain unchanged.
