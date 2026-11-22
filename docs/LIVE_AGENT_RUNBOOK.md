# Live Agent runbook

This is a Codex-mediated interactive workflow. The local Node code never signs in
as Codex, extracts its bearer, starts a hosted research agent or grants permission.
Start with the prominent trigger instructions in [README](../README.md).

## 1. Start a fresh authorized run

Install the verified Codex CLI, sign in to your own Codex account, configure the
official Flashpoint URL and complete its separate OAuth team selection. Run
`codex` from the repository root or use `codex -C PATH`. Read:

1. `AGENTS.md` — repository and authorization boundaries.
2. `challenge/agent.md` — research judgment and evidence policy.
3. `challenge/LIVE_INTEGRATION.md` — implementation contract and historical proof.
4. This runbook — current reproducible command sequence.

Give Codex the exact high-level objective from README. It must calculate current
context and author a fresh plan, not reuse the historical survey or fixture answers.

## 2. Record actual discovery and account/team evidence

From the normal authenticated operator environment:

```sh
node scripts/challenge-discover.cjs --output .runtime/challenge/my-study/discovery.json
```

The helper uses Codex 0.171.0's experimental app-server protocol:
initialize, initialized, then `mcpServerStatus/list` for `flashpoint`. It writes
sanitized actual OAuth/tool-schema metadata, creates no model turn and sends no
MCP business call. It refuses overwriting an existing file. Use a fresh filename
when refreshing and update the private reference; freshness is a local one-hour
policy, not a token-expiry claim.

On Windows it locates the npm-installed native executable; on other platforms it
uses `codex` on PATH. If needed, set `CODEX_EXECUTABLE` to your installed native
Codex executable. This selects a program, not a credential file. The helper was
verified on Windows x64, CLI0.171.0. Other client versions may change this
experimental protocol. A restricted agent shell can return server_not_found even
when the normal operator environment succeeds; stop rather than fabricate proof
or automatically change/log out of the account.

Codex writes run-local `account-context.json` and actual team-confirmation evidence.
Start with unverified fields; do not copy this demonstration's true flags or IDs:

```json
{
  "authentication": "codex_oauth",
  "runtimeTool": "mcp__flashpoint__tool_survey",
  "intendedTeam": "YOUR_AUTHORIZED_TEAM",
  "teamVerified": false,
  "teamName": null,
  "teamId": null,
  "teamVerificationStatus": null,
  "teamApiVerified": false,
  "teamEvidenceRef": null,
  "discoveryRef": "file:discovery.json",
  "discoveredAt": null
}
```

After actual discovery, use its exact checkedAt for discoveredAt. After the user
explicitly confirms the actual selected team, record the real name, evidence
reference, teamVerified=true and USER_VERIFIED, with teamApiVerified=false unless
independent API evidence really exists. Do not invent a team ID or authenticate
by copying a wallet. False/absent verification blocks external dispatch.

## 3. Local preparation commands

These are existing CLI commands. Codex creates actual UTF-8 private artifacts and
supplies their returned IDs/hashes; uppercase values below are placeholders, not
credentials or permission. Context JSON must exist before init.

```sh
node scripts/challenge-live-run.cjs init --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json --objective "Find the one change CarbonX should make first so a first-time user can understand our steel plant results and explain the trade-off to someone else."
node scripts/challenge-live-run.cjs checkpoint --kind PLAN --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
node scripts/challenge-live-run.cjs submit --file .runtime/challenge/my-study/codex-plan.json --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
node scripts/challenge-live-run.cjs request --kind create_survey --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
```

`checkpoint` produces the actual inputHash/basisHash. Codex authors schemaVersion1,
label REAL_FIRST_PARTY, origin CODEX_AUTHORED, kind PLAN and a compatible payload
bound to those hashes. `createWorkflow().checkpoint()/submit()` is the matching API.
There is no automatic question generator or `run-live` backend command.

## 4. Exact approval and one-shot execution

Present the actual manifest, team evidence, intended resource effect, cost
uncertainty, reversibility and duplicate risk. Wait for explicit permission.
Record its private source; flags only record permission that actually exists.

```sh
node scripts/challenge-live-run.cjs approve --approval APPROVAL_ID --hash MANIFEST_HASH --user-ref file:user-approval.json --billing-acknowledged true --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
node scripts/challenge-live-run.cjs queue --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
node scripts/challenge-live-run.cjs claim --action ACTION_ID --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
```

Now **Codex**, not Node, invokes the configured `mcp__flashpoint__tool_survey` once
with the exact claimed arguments. Do not substitute a separately connected app's
account. Preserve the original CallToolResult privately before interpreting it.
After reviewing its actual schema, capture with an exact response-hash-bound
profile; never accept an invented/sample receipt as the real response:

```sh
node scripts/challenge-live-run.cjs capture --action ACTION_ID --file .runtime/challenge/my-study/original-result.json --profile .runtime/challenge/my-study/reviewed-profile.json --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
```

Thread actual survey_id and conversation_id through all related calls. Task
status completed is not survey creation/publication. Missing IDs, instrument or
uncertain status block dependent work. Full draft inspection uses the actual APIs
`prepareInspection()` and `completeInspection()`; no same-named CLI is claimed.

Publication needs verified actual title/text/IDs/types and its own scope. The
live API binds observed version/revision/content hash. Invitations require the
sole accepted source `.runtime/challenge/recipients.txt`, one consented address per
line, no duplicate/opted-out recipient, exact fingerprint/count/consent revision
and explicit approved template/send scope. Approval additionally records
`--consent-confirmed true`. Never print or commit that list.

An approved multi-operation scope can cover publication and a specific send;
record those actions separately. Ordinary expected confirmations must match the
actual user permission. Unexpected findings/configuration acceptance or charges
stop for the user. Payments, wallet/x402/USDC and synthetic/paid recruitment are
not authorized by the normal OAuth bridge.

## 5. Real answer retrieval and analysis

After an actual submission and authorized scoped read, while at AWAITING_RESPONSES:

```sh
node scripts/challenge-live-run.cjs read-proposal --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
node scripts/challenge-live-run.cjs authorize-read --user-ref file:read-approval.json --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
node scripts/challenge-live-run.cjs retrieve --dir .runtime/challenge/my-study --context .runtime/challenge/my-study/account-context.json
```

Claim the returned read action once, have Codex perform the exact scoped MCP read,
preserve the original result, inspect actual record/question/source/pagination
fields and use `capture-read --action ID --file RAW --profile PROFILE` with the
same directory/context. A subsequent local `retrieve` consumes that captured
receipt, normalizes and validates it without another remote call.

The actual first-party response shape required a single detail object, an array
of question definitions and labelled answer objects containing question_id/value.
The live profile explicitly supports that observed shape. Only the reviewed
reserved DEVICE variable is metadata; other unknown IDs remain rejectable.
Profiles are local mapping contracts, not proof of a universal provider schema.
For a more specific read brief Codex may use `adapter.authorizeRead()/retrieve()`
with the same exact scope, then normalize/save the actual evidence and feed it
through `store.attachEvidence()` and the existing workflow's validated retrieval
path. No raw or inferred answer is accepted just because COMPLETE was reported.

Phase3 separates invited, complete, retrieved, usable and per-question counts.
Invalid/duplicate/preview/source-mismatched data is excluded; empty answers remain
INSUFFICIENT_EVIDENCE. Fresh ANALYSIS and FOLLOWUP checkpoints require current
evidence/hash references. Codex submits new reasoning, not offline replay. STOP
does not automatically close the remote survey or create another study.

## 6. Resume without duplicate actions

`codex resume --last` resumes the interactive session. Separately use local
`show`, `recover`, `reconcile --action ID` and `resume` with the same private paths.
Never initialize over an existing run or clear a live lock.

Recovery marks interrupted in-flight work UNKNOWN_REMOTE_OUTCOME. `reconcile`
uses an existing actual captured receipt or unclaimed-outbox proof; it is not a
new remote status getter. If a claimed remote result is missing, obtain an
authorized read-only status check and record verified SUCCEEDED/NOT_EXECUTED
through the state API before any new resource action. Never infer nonexecution
from a timeout and never resend or recreate an uncertain operation.

## 7. Locate final artifacts

The CLI prints its run directory; private `run-state.json` and `events.jsonl`
reference hash-named artifacts and original `live-handoff/` requests/claims/results.
Use UTF-8 JSON for private files. Analyst checkpoints can contain actual answers;
do not paste them into public logs or README.

For this completed demonstration, public artifacts are the explainer and
`challenge/REAL_FIRST_PARTY_INTEGRATION_SUMMARY.md`. Private raw answers/response ID
and fresh analysis remain ignored. The existing run is FOLLOWUP_DECISION/STOP,
not a starting template for another live call. No new developer inherits its
survey access, user permissions or private runtime files.
