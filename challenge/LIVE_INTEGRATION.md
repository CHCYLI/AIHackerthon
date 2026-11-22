# Phase 6: guarded Codex OAuth handoff

Current status: **PHASE 6 TECHNICAL INTEGRATION DONE**. Survey `b579f71c-e720-4d34-8513-1ea2f468239d` remains active v1/revision17. One real developer submission is COMPLETE/retrieved/usable 1/1/1 with five valid answers. It used assisted wording and is not independent product research. Team remains USER_VERIFIED, not API-verified. Fresh Codex analysis selected STOP; no live Round2. The user explicitly skipped Phases7/8 and authorized Phase9 packaging. No new research/email/UI actions. See REAL_FIRST_PARTY_INTEGRATION_SUMMARY.md and the latest IMPLEMENTATION_STATUS.md; earlier checkpoints below are historical.

## Actual integration architecture

`createLiveAdapter()` in `scripts/challenge-live.cjs` implements the existing
asynchronous adapter contract. `createWorkflow()` reuses the original calculations,
state manager, approvals, validation and Codex judgment checkpoints. The offline
adapter/CLI and fixture tests remain separate. Live runs are `real_first_party`,
accept only fresh `CODEX_AUTHORED` judgments with `REAL_FIRST_PARTY` labels and reject
fixture replay. No hosted model, wallet, credential extraction or Node MCP login
was added.

The verified configured server is `flashpoint`, endpoint
`https://api.flashpoint.ai/mcp`. Its Codex runtime tool is
`mcp__flashpoint__tool_survey`. Do not substitute the separately connected
`mcp__codex_apps__flashpoint_tool_survey` account: identical tool schemas do not
establish identical OAuth identity/team. Node does not possess either runtime's
bearer. Its local CLI never invokes a remote business tool.

1. Codex authors a plan from the actual context/checkpoint. `requestAction()` saves
   a reviewable exact manifest, target account/team evidence, billing uncertainty,
   reversibility limits and duplicate risk. No operation is approved automatically.
2. Actual user confirmation grants only that exact manifest. Team ownership,
   authenticated discovery, unchanged account context, zero payment ceiling and
   recipient consent (for invitations) are required. Local flags are records of
   verification, not independent identity attestations; never set them speculatively.
3. `await workflow.execute()` durably consumes the approval and writes the existing
   `IN_FLIGHT` action before the live adapter queues `live-handoff/ID.request.json`.
4. `adapter.claim(ID)` writes an exclusive, fsynced one-shot marker before returning
   the exact tool/arguments for Codex. Codex may invoke that tool **once**, only
   after the specific real operation is authorized. The actual execution checkpoints
   below distinguish the blocked first call and successful additional call. A
   second claim for the same action is refused across process restarts.
5. Codex preserves the exact `CallToolResult` as private JSON, without evaluating
   provider text or copying it unsafely into a shell. `completeHandoff(ID, raw,
   profile?)` captures it and its receipt time. Missing/uncertain output mapping
   leaves `UNKNOWN_REMOTE_OUTCOME`, not successful creation or permission to retry.
6. Only a reviewed, response-hash-bound mapping can establish a draft, publication,
   send or answer result. Actual returned IDs are preserved. Publication requires
   actual question-ID/type/text/option mapping and separate approval. Unexpected
   ID changes, missing IDs or mismatched scope fail closed.

## Local entry points

Repository root, Node 22.23.5:

```powershell
& '..\release-assets\node.exe' scripts/challenge-live-run.cjs show --dir .runtime/challenge/phase6/carbonx-first-party --context .runtime/challenge/phase6/carbonx-first-party/account-context.json
& '..\release-assets\node.exe' --test tests/challenge-live.test.cjs
```

With supported Node on PATH: `npm run test:live`; `npm run challenge:live -- show
--dir PRIVATE_RUN --context PRIVATE_CONTEXT_JSON`. Every live control command needs
both private paths. `init --objective TEXT`, `checkpoint --kind PLAN`, `submit
--file CODEX_OUTPUT_JSON` and `request --kind create_survey` perform local preparation.
The existing run is at `AWAITING_APPROVAL`; do not initialize over it.

Later, **after verification and specific user approval**, `approve` requires
`--approval ID --hash HASH --user-ref LOCAL_APPROVAL_REFERENCE
--billing-acknowledged true`. Invitation approval additionally needs
`--consent-confirmed true`. `queue` writes the intent/outbox; `claim --action ID`
returns the exact Codex invocation. `capture --action ID --file RAW_RESULT_JSON
--profile REVIEWED_MAPPING_JSON` accepts the actual result. These commands are
documentation of capabilities, not permission to execute them now.

The CLI `read-proposal` previews the existing answer-data read. `authorize-read --user-ref
REFERENCE` records explicit authorization because agent/subscription billing cannot
be independently verified from discovery. `retrieve` queues one read; claim it
once, then `capture-read` preserves/maps the actual result, and a subsequent local
`retrieve` runs existing normalization/validation without another remote call.
A pending/unknown read blocks another authorization; `cancel-read` works only
before dispatch. There is no automatic polling, confirmation or charged retry.

For an unpublished draft, the API `workflow.prepareInspection()` previews a
read-only full-document request; `{confirmed:true,userApprovalRef}` records its
separate exact user approval. Use the same `adapter.retrieve(proposal)` outbox and
one-shot `claim`, then `workflow.completeInspection(actionId,raw,profile)` after
reviewing the actual response. This purpose is separate from answer retrieval;
it accepts only existing draft/awaiting-publication stages and current exact IDs.
No new CLI command or relaxed answer-stage guard is implied.

A reviewed JSON-fence parser accepts one complete actual JSON block from the
hash-bound original response; it never fills fields from the plan. The verified
instrument must match actual full text/types/subtypes/options, title, introduction
and stimulus and return actual version/revision. Conversation identity may be
explicitly mapped from the actual MCP envelope when absent from the document
getter. `INSTRUMENT_VERIFIED` adds a new receipt reference without modifying the
creation receipt. Publication binds its observed version/revision/content hash
and still needs a new exact approval. Missing optional API fields remain unknown.

`recover`, `reconcile --action ID` and `resume` retain the Phase 3 gates. An
unclaimed durable outbox can be explicitly reconciled as not executed under this
control protocol; a claimed operation needs the same actual receipt/status proof.
Fresh approval is required after verified non-execution. Corrupt/partial artifacts
fail closed. Local one-shot markers do not establish provider-side idempotency or
exactly-once behavior across a remote service.

## Fresh discovery and the earlier failure

Read-only discovery at `2026-11-22T06:30:59.930Z` (01:30:59 ET) returned OAuth,
Flashpoint.AI 1.30.0, ten tools, zero resources/templates and no identity resource.
The actual `tool_survey` input still requires `brief` and permits nullable optional
`survey_id` / `conversation_id`. Inputs match the saved Phase 2 snapshot. No
`whoami`/team/account tool is advertised. Configuration exposes the endpoint, not
an account/team identifier.

The same discovery script initially returned an empty server inventory in the
restricted execution context, then succeeded in the approved user context without
new login or business calls. This isolates the operational failure to execution
context visibility; the exact sandbox mechanism was not inspected. It is not
evidence of token expiry, missing OAuth, an initialization/schema error or a
network outage. Historical REST 401s remain a separate unresolved issue.

Diagnostics are private under `.runtime/challenge/phase6/`; no bearer, private key,
authorization header or respondent contact was printed. A local discovery artifact
must show OAuth and the expected schema, match the declared timestamp and be less
than one hour old before dispatch. That one-hour freshness rule is local policy,
not a claim about the token's expiry.

## Team ownership: manual prerequisite

The intended project/team is **CarbonX**. At the initial checkpoint it was unverified.
The user has since explicitly confirmed that the actual OAuth-selected team was
CarbonX. Record `teamVerificationStatus: USER_VERIFIED`, its confirmation evidence
and `teamApiVerified: false`; do not claim an independent API identity check. The
existing `teamVerified` readiness flag represents this accepted human confirmation,
not API attestation. Do not invent a team/account ID, decode/extract stored tokens or
infer ownership from connectivity. The official authentication flow includes a
team picker and binds authorization to the selected user/team; switching only the
dashboard's current team does not demonstrate that an older MCP grant changed.
[Official authentication flow](https://docs.flashpoint.ai/authentication).

The following operator steps are fallback instructions when confirmation is missing
or the account/team changes; do not repeat completed OAuth solely because an API
identity resource is unavailable. Outside the restricted agent shell:

1. Sign in at `https://app.flashpoint.ai` with the intended account and verify that
   it belongs to the intended CarbonX team. Record the actual visible team name
   and ID if the interface supplies one. If CarbonX is not available, stop; do not
   create a replacement team or resources.
2. Run `codex mcp login flashpoint` and, when prompted by the official browser
   authorization, explicitly select that team. If the client skips the picker
   because it retains a grant, intentionally disconnect/reconnect with
   `codex mcp logout flashpoint` followed by `codex mcp login flashpoint`, then
   select CarbonX. These commands are for the operator; the implementation did
   not log out, change the team or restart OAuth automatically.
3. Confirm the actual selected name/ID and account membership without sending a
   token or credential. Record a private local verification reference. Refresh
   read-only discovery in the approved user context.
4. Cancel the old unapproved manifest, resume locally, generate a new manifest
   bound to the verified context and request separate approval for **one draft**.
   If the run is already blocked, rejecting/cancelling the old pending approval
   must preserve its interruption stage. Do not reuse its old hash after changing
   account/team evidence. Creation approval authorizes no publication or send.

## Billing and real recipients

Official documentation distinguishes OAuth subscription usage from wallet x402
per-call USDC payments. The actual subscription, quota and creation permission of
this account are unverified. No direct payment is authorized; numeric zero payment
records do not prove that server credits/subscription usage are free.
[Official authentication and billing distinction](https://docs.flashpoint.ai/authentication).

The only recipient source is `.runtime/challenge/recipients.txt`. It now contains
only the user's own supplied address for a planned single-person integration test.
The adapter accepts no alternate recipient file/list. It validates a bounded regular
file, one address per line, no duplicates, fingerprints the exact list and rechecks
it immediately before dispatch. The user must confirm that every person explicitly
consented and opt-outs are reflected. No remote list was created and no addresses
were invented or printed. Local preparation is not sending approval. Publication,
list use/send, reminders, recruitment
and payments are distinct scopes; this OAuth bridge implements no paid path.

## Actual result mapping and evidence limits

`mappedReceipt()` is an explicit **local review contract**, not an invented provider
schema. `tests/challenge-live.test.cjs` contains mocked response examples only.
A real pre-creation blocker, draft-creation and full-instrument profile have now
been reviewed against their exact responses. The historical creation receipt's
questionMap remains null; the new inspection receipt supplies the verified map.
No production answer profile or answer evidence is verified yet.

A profile needs `reviewed`, the exact `responseHash`, a local `reviewRef`, an actual
`documentPointer` (optionally JSON text parsing), explicit ID pointers and a status
pointer/equality with an operation-specific interpretation. Draft question maps
must point to actual returned IDs/prompts/types/options. No narrative alone is
converted into rows or successful actions. Missing instrument readback blocks
publication even if actual draft IDs/status are available. Provider confirmation
requests remain uncertain/pending, preserve their conversation IDs and never cause
an automatic `confirm` or `payment_confirmation` call.

For answers, the profile identifies actual record/questionnaire/count/pagination
paths and row ID/status/answer paths. It must prove the selected response is
complete, preserve real response IDs privately and map only known question types
to the existing evidence contract. Malformed/duplicate/source-mismatched rows are
excluded by Phase 3; missing answers remain missing. Invited, completed, retrieved,
usable and per-question counts remain distinct. Twelve COMPLETE records with empty
answers remain `INSUFFICIENT_EVIDENCE`. Fixture history is never used as a fallback.

The actual provider output, pagination, source provenance, individual answers or
frequency/export fallback must be inspected after an authorized real operation.
Direct REST cannot assume that Codex OAuth is available to Node or interchangeable
with browser credentials. Local profile review/hash checks attest neither remote
authenticity nor ownership by themselves. All raw responses stay private; public
reports use redacted summaries with exact evidence references and limitations.

The current fresh five-question proposal is in [FIRST_SURVEY_REVIEW.md](FIRST_SURVEY_REVIEW.md).
It was authored from the actual current model, not replayed from Phase 5. No
Round 2 is designed. Team ownership is USER_VERIFIED, not API-verified. The first
authorized call stopped before survey creation; the separately approved corrected
same-conversation call created the draft and the separately approved read verified
its full content. Publication/distribution approval and real answers remain open
gates. The exact pending publication request and complete observed text are in
[SURVEY_PUBLICATION_REVIEW.md](SURVEY_PUBLICATION_REVIEW.md).

## Historical first production response and request correction

Exactly one authorized `tool_survey` call returned `isError: false` and
`/structuredContent/status: completed`, with actual conversation
`01a2040a-4289-7932-aefc-548080a59748`. Its survey ID at
`/structuredContent/result/survey_id` was null; the worker's actual
`/structuredContent/result/final_text` explicitly stopped before creation because
the old brief required independent team verification. The actual original
CallToolResult, task ID, usage counters, capture metadata and reviewed profile are
private in the run's `live-handoff/`. Do not infer survey creation from task
completion, or authentication expiry from this application-level blocker.

The exact response was mapped to pending/unknown first, then the creation action
was reconciled as `NOT_EXECUTED` using its explicit pre-creation statement. The
conversation was preserved separately. No retry or replacement survey occurred.

Draft request construction now explicitly transmits a verified user's attestation
as USER_VERIFIED, not API verification. Unverified teams still fail readiness;
contradicting identity, unavailable entitlement and payment requirements still
stop. The new request preserves the real conversation and existing reviewed
instrument, and requires returning existing IDs if that conversation already has
a survey. Its exact manifest requires a new approval because the original
one-call permission was consumed. See FIRST_SURVEY_REVIEW.md and the latest
IMPLEMENTATION_STATUS.md checkpoint for hashes and the pending approval.

## Historical successful additional creation call

The user separately approved the corrected request. One call returned real
survey ID `b579f71c-e720-4d34-8513-1ea2f468239d` in the unchanged conversation
`01a2040a-4289-7932-aefc-548080a59748`, an explicit draft-created statement and
a `draft` status row. The raw response and exact-hash-bound review/receipt are
saved privately for action `df23e00f-022b-4064-bffb-ef0fb9a184e9`. Creation was
recorded as `SUCCEEDED`; the same run reached `AWAITING_APPROVAL` with no pending
approval. The two consumed approvals authorize no third call.

Actual provider question IDs and reported prompts/types were saved from the
response's Markdown table as a labelled local extraction. No structured question
array was returned, introduction/stimulus are abbreviated and some question
suffixes are absent. The profile deliberately omits `questions`, preserving
`questionMap: null`; it does not infer exact fields from the intended plan.
Publication still fails `UNVERIFIED_INSTRUMENT`. A new scoped full-instrument read
would need separate authorization; no additional read was executed here.

Only token usage was returned, not monetary cost, remaining subscription balance
or invitation allowance. No survey quotas configured is a survey-design finding,
not proof of billing entitlement. No publication/send/payment or fixture response
occurred. See FIRST_SURVEY_REVIEW.md for the actual reported question list and
IMPLEMENTATION_STATUS.md for complete actual identifiers, usage and limitations.

## Current full-document verification and pending publication

The separately approved instrument read completed in the same conversation with
the actual draft title, version 1/revision17, all five full English questions and
their IDs/types/opt-outs, and full introduction/stimulus. The actual full fields
match the reviewed plan exactly; the older creation summary had abbreviated them.
Some independent description/required/instruction/condition and identity fields
were not returned and remain unknown. The response's one complete JSON block is
saved separately, with its exact raw-source hash and mapping review.

`INSTRUMENT_VERIFIED` now provides the effective map/version/hash and clears the
instrument gate for preparing a publication proposal. It does not authorize
publication. The current proposal is PENDING, for the same survey v1/revision17,
one business call, zero paid retries and zero additional payment. No publication
outbox/claim exists. The actual raw read is private at
`live-handoff/6218ca7f-7293-4e72-8eac-04aed9d4202a.raw.json`; full review and exact
proposed arguments are in SURVEY_PUBLICATION_REVIEW.md. Stop for explicit user
approval; further provider confirmation must be relayed, never automatic.
