# CarbonX implementation status

Updated: November 22, 2026 (America/New_York).
Repository: `AIHackerthon-submit`, branch `main`, base commit `3bbbafc`.

## Phase status

| Phase | Status | Verified scope |
| --- | --- | --- |
| 0: Repository audit | DONE | Inspected current model/API/client code, local saved evidence, runtime and ignore rules. The preceding audit passed 25 read-only checks and 45 source syntax checks. |
| 1: Reusable local model context | DONE | Added the context CLI and verified baseline, Combined, direct browser-engine agreement and local HTTP API behavior. |
| 2: Flashpoint connectivity/authentication | DONE | Locked client dependencies restored; all 26 existing client tests pass. Human OAuth and production tool discovery verified, including panel schemas. Historical retrieval evidence reviewed; the exact REST authorization/storage cause remains unresolved. |
| 3: State, decision logging and response validation | DONE | Offline state/approval/action ledger, atomic writes, recoverable redacted journal and scoped evidence validation. 39 new tests pass; existing context/client tests remain passing. |
| 4: Agent instructions and research policy | DONE | Scoped AGENTS.md, autonomous decision/workflow instructions and an actual-model OFFLINE PLANNING example. Four new policy-contract tests pass; 78 total tests pass. No external action or live orchestration added. |
| 5: End-to-end offline integration | DONE | Executable Codex decision checkpoints, guarded async adapter boundary, deterministic TEST DATA simulator, evidence-dependent two-round replay and report generation. 27 new integration tests pass; no live work. |
| 6: Live MCP adapter and first-party evidence | DONE — TECHNICAL INTEGRATION ONLY | Actual COMPLETE/retrieved/usable counts 1/1/1; all five question denominators 1, no rejected records. Active v1/revision17. Developer participant with assisted wording; no independent product finding. Fresh Codex analysis chose STOP. |
| 7-8 | SKIPPED BY USER | Explicit decision to stop further surveys and skip these phases; no new UI or research actions. |
| 9: Public repository and submission | FINAL CHECKS PASSED — PREPARING PUSH | README, explainer, trigger/runbook and submission checklist ready. Final npm run test:all: 133 passed; valid/empty/pending demos passed. Current/index and sanitized publication-history audit completed before push; original local history retained. |

## Phase 1 implementation

- `scripts/challenge-context.cjs`: wraps the existing `apps/api/research.cjs#brief` without changing model formulas. Exports `evaluateScenario`, `getBaseline`, `getCombined` and `compareScenarios`.
- `tests/challenge-context.test.cjs`: nine offline tests, including independent loading of the browser model and loopback HTTP comparisons.
- `package.json`: adds `challenge:context` and `test:challenge`; startup scripts are unchanged.
- This status file records the verified checkpoint. Recheck actual code and commands on resume.

Default context is recalculated from `data/flashpoint-seed/scenario-brief.json#inputs`. Saved metrics and prewritten survey prompts are not used as calculated results. Baseline uses the current Scenario model defaults at 2050. The CLI writes JSON to stdout and creates no run files.

JSON includes `source`, `dataQuality`, `scenarioId`, `modelVersion`, a deterministic `inputHash`, `year`, `provenance`, normalized `assumptions`, `units`, `metrics` and `limitations`. It does not include a survey objective or question bank.

The active Scenario/research model is extracted by the existing helper from the first two inline scripts in `apps/web/scenario.html`. Its version is `original-ccus-4f14b05433a1`. The shared 3D/API engine is a separate existing model, `illustrative-v0.3-chain-1`. The adapter identifies the Scenario model explicitly; it does not reconcile or replace either model.

Physical avoidance and finance-adjusted avoidance remain separate fields. Capture, gross injection and the physical retention proxy are distinct. Permanent storage remains `null` because the existing model does not establish it. Numeric IRR retains the rounding of the existing percent display; undefined or ambiguous IRR remains `null` and the original display is preserved.

## Verified commands and results

Run from the repository root. Use Node >=22.19.0. The default PATH runtime was 22.10.0; the already available workspace runtime below is 22.23.5.

```powershell
& '..\release-assets\node.exe' scripts/challenge-context.cjs
& '..\release-assets\node.exe' scripts/challenge-context.cjs --baseline
& '..\release-assets\node.exe' scripts/challenge-context.cjs --compare
& '..\release-assets\node.exe' --test tests/challenge-context.test.cjs
git diff --check
```

- CLI default, baseline and comparison modes returned valid JSON. Tests also exercised these modes from a different working directory with OpenAI, Anthropic and Flashpoint environment settings removed.
- Test result: 9 passed, 0 failed. Includes same-input browser calculations, research HTTP brief, shared API run/compare, input validation, deterministic hashes and preservation of unknown storage/IRR values.
- `git diff --check`: passed.
- The actual package start entry point, `apps/api/server.cjs`, was started with the workspace runtime on loopback port 3127. `GET /api/v1/health` returned HTTP 200 and `status: ok`; the service was stopped after verification.

With a supported Node on PATH, equivalent convenience commands are `npm run challenge:context`, `npm run challenge:context -- --compare`, and `npm run test:challenge`.

Calculated Scenario-model comparison (illustrative assumptions, not facility measurements):

| 2050 metric | Baseline | Combined |
| --- | ---: | ---: |
| Physical avoidance, Mt CO2/year | 0 | 1.3198900320000004 |
| Finance-adjusted avoidance, Mt CO2/year | 0 | 1.3153445820000005 |
| Gross CAPEX, million constant 2025 USD | 0 | 796.36305 |
| NPV, million constant 2025 USD | 0 | -134.6275490285887 |
| IRR, percent at model display precision | null | 0.5 |

Combined assumptions include CCS enabled, 90% capture, 15% efficiency improvement, 80% low-carbon electricity, 8% discount rate, USD 75/t carbon price and 0.5% transport loss. Full normalized assumptions are emitted in the JSON. No output number is hardcoded in the adapter.

## Remaining blockers after Phase 1

- At the Phase 1 boundary, the Flashpoint client lacked dependencies and a confirmed wallet configuration. Its four test files failed to load during Phase 0. Phase 2 subsequently restored dependencies and passed all 26 client tests, as recorded below; a confirmed local wallet configuration is still absent.
- Saved synthetic evidence for survey `fafab667-...` still reports 12 COMPLETE records, zero usable answer sets and blocked analysis. No fresh remote retrieval was attempted. The actual location/availability of answers and the historical REST 401 cause remain unverified.
- The old result importer is specific to a fixed synthetic survey, twelve records and Q1-Q7. General first-party evidence normalization and durable research state belong to later phases.
- Phase 2 should inspect supported client setup, current tool schemas and the correct identity/team/billing route before any business call. A configured tool is not proof of authenticated access.
- No survey creation/publication, emails, recruitment, payments or external model calls occurred in Phase 1. No live action is approved by this status file.

## Phase 2: read-only connectivity and authentication inspection

Status: **DONE** for connectivity and authenticated tool discovery. The OAuth continuation below verified login, server initialization metadata and the upstream tool inventory. The operator confirmed completing account authorization and team selection. Account/team names and IDs were not exposed by discovery and remain unverified as identifiers; earlier survey ownership and business-tool entitlement are also untested.

### Existing client capabilities

- `flashpoint-client/flashpoint.mjs` already implements `connect()` and `listTools()`: official wallet challenge, validation of `flashpoint-mcp-auth:<nonce>`, EIP-191 authentication signature, wallet-token exchange, MCP `initialize`, optional session-header preservation, `notifications/initialized`, and `tools/list`. The bearer stays in memory. Reuse these functions after resolving local setup.
- `wallet-store.mjs` requires a confirmed local `.env`, a valid key and matching pinned public address. It rejects conflicting process credentials and linked configuration files. The local `.env` is absent. Dependencies were initially absent and have now been restored in this checkout. No actual wallet was generated, copied, replaced or reconfigured; wallet tests use deterministic public fixtures in temporary directories.
- Ordinary `callTool()` rejects business calls. `x402-policy.mjs` rejects payment creation and signed payment headers. The separate `approved-draft.mjs` enforces exact request hash, a positive USDC ceiling, supported operation scope, one business call, zero paid retries and a durable consumption marker before signing. It was inspected but not executed.
- `panel-status.mjs` has an unsigned, no-payment status path that stops on 402. It was not called: no panel status or survey business call was required for this phase.
- A source-level diagnostic limitation remains: `rpc()` labels any 401 as session expiration. That message is not proof of expiration; missing, invalid and expired credentials must be distinguished using actual context. No client behavior was changed in this phase.

### Commands and observed results

Run from the repository root:

| Command / check | Observed result |
| --- | --- |
| `codex --version` | `codex-cli 0.171.0-alpha.13` |
| `codex mcp --help` | Supports `list`, `get`, `add`, `remove`, `login`, `logout`; OAuth login is available. |
| `codex mcp list` and `codex mcp list --json` | Initial pass: no CLI-configured MCP servers. After the authorized OAuth continuation: `flashpoint`, enabled, official URL, `auth_status: o_auth`. |
| `codex mcp list --help`, `codex mcp get --help`, `codex mcp add --help`, `codex mcp login --help` | Verified supported syntax, Streamable HTTP URL configuration and OAuth login options, including `--no-browser`. Add/login results are recorded below. |
| `& '..\release-assets\node.exe' flashpoint-client/flashpoint.mjs tools` | Initially failed on missing `viem`. After restoration, module loading succeeds and the wallet guard stops with `Replacement wallet is not confirmed...` before authentication/network access. This guard text is not a new finding of wallet compromise. |
| Workspace Node `--check` on `flashpoint.mjs`, `wallet-store.mjs`, `x402-policy.mjs`, `approved-draft.mjs`, `panel-status.mjs` | All five syntax checks passed. The later full client test run passed all 26 tests. |

The initial unauthenticated probes used Node's standard `fetch`, no credentials, no payment wrapper, redirects disabled and a 20-second timeout. These were the initial discovery requests; no `tools/call` was sent:

| Request | Actual response |
| --- | --- |
| `POST https://api.flashpoint.ai/mcp`, JSON-RPC `initialize`, protocol `2025-06-18` | HTTP 401, JSON content type. `WWW-Authenticate` advertises Bearer realm `flashpoint-mcp` and resource metadata at `https://api.flashpoint.ai/.well-known/oauth-protected-resource`. No initialization result. |
| `GET https://api.flashpoint.ai/.well-known/oauth-protected-resource` | HTTP 200; resource `https://api.flashpoint.ai/mcp`, authorization server `https://api.flashpoint.ai`, bearer via header. |
| `GET https://api.flashpoint.ai/.well-known/oauth-authorization-server` | HTTP 200; issuer `https://api.flashpoint.ai`; authorize/token/register endpoints under `/oauth/`; authorization-code grant and PKCE `S256`. |
| `POST https://api.flashpoint.ai/mcp`, JSON-RPC `tools/list` without credentials | HTTP 401 with the same Bearer metadata challenge. No upstream tool list or schema returned. |

The first sandboxed network attempt failed with `EACCES`. The permitted unsandboxed initialization and discovery requests reached the server and returned the statuses above. The 401 results were obtained without a bearer, so they do not demonstrate an expired token. No 402 was observed. The OAuth continuation resolved the unauthenticated discovery blocker. Wallet JWT lifetime, explicit account/team identifiers, billing entitlement and access to the earlier survey remain unverified.

### Tool schema and ID continuity

The initial pass inspected Codex **Flashpoint connector tool definitions** independently of the local CLI server list. The subsequent authenticated discovery returned the same ten names directly through Codex's MCP connection: `chat`, `demographics`, `panel`, `presentation`, `payment_confirmation`, `tool_survey`, `tool_qual`, plus deprecated aliases `create_panel`, `get_demographics`, `surveys_agent`.

The authenticated server returned `tool_surveyArguments`: an object with required `brief: string`; optional `survey_id` and `conversation_id`, each string-or-null with default null. This agrees with the connector input contract:

```typescript
{
  brief: string;
  survey_id?: string | null;
  conversation_id?: string | null;
}
```

`brief` is required. Preserve the exact server-returned `survey_id` for actions on that survey, and thread the returned `conversation_id` through related design, retrieval and confirmation calls. A confirmation must continue the same conversation. Store returned IDs and status immediately after a future authorized call; never infer a new ID or silently start a replacement survey. No survey tool was called to obtain these definitions.

### Authenticated OAuth continuation

- The operator's instruction to continue authorized the proposed configuration/login step. `codex mcp add flashpoint --url https://api.flashpoint.ai/mcp` added the global server and detected OAuth. Its first login flow timed out waiting for a callback; configuration remained installed and `auth_status` was `not_logged_in`.
- `codex mcp login flashpoint` started a new flow. The operator confirmed completing authorization and selecting a team. The CLI then returned `Successfully logged in to MCP server 'flashpoint'.` with exit code 0. A read-only `codex mcp list --json` check showed `flashpoint`, enabled, `https://api.flashpoint.ai/mcp`, `auth_status: o_auth`.
- The sandboxed CLI view did not show the newly added global entry, while the permitted unsandboxed view did. Validation therefore used the same actual user environment as the successful login. This discrepancy was not treated as an authentication failure.
- Inspected the installed app-server protocol schema with `codex app-server generate-json-schema --out .runtime/challenge/diagnostics/app-server-schema`. It confirmed the read-only `mcpServerStatus/list` request and `serverName` / `detail` parameters, consistent with [Codex App Server documentation](https://learn.chatgpt.com/docs/app-server).
- Ran `& '..\release-assets\node.exe' .runtime/challenge/diagnostics/list-flashpoint-tools.cjs` in the authenticated user environment. The local helper starts `codex app-server --stdio`, sends only `initialize`, `initialized`, then `mcpServerStatus/list` for `serverName: flashpoint`, `detail: toolsAndAuthOnly`. It creates no thread or model turn and sends no MCP business-tool call. The helper stops its own app-server process after discovery.
- Discovery at `2026-11-22T04:21:10.048Z` (November 21, 11:21 PM ET) returned `authStatus: oAuth`, server `Flashpoint.AI` version `1.30.0`, advertised tools/resources/prompts capabilities and ten tools. The actual `tool_survey` JSON schema is saved locally. `runtimeStatus` was null because no thread runtime was created; successful discovery is evidenced by server initialization metadata and the returned tool inventory.
- Sanitized evidence: `.runtime/challenge/diagnostics/flashpoint-authenticated-discovery.json`. The helper, generated protocol schemas and discovery output are Git-ignored. No token, callback URL, PKCE verifier, wallet secret or respondent data was saved to the repository or discovery report. OAuth credentials remain managed by Codex.

### Identity, remaining limits and next safe action

- **Working authentication: human OAuth**, verified by CLI login and authenticated server discovery. Team selection is operator-confirmed; its name/ID and the account identity were not returned by the discovery API. There is no dedicated read-only identity/team tool in the ten-tool inventory and `toolListMeta` is empty. Do not infer that this identity owns the historical survey; verify that scope before any future survey action.
- Official documentation distinguishes human MCP OAuth from wallet JWT/x402: [Authentication](https://docs.flashpoint.ai/authentication). This login is not a demonstration of wallet-based USDC billing. The [API reference](https://docs.flashpoint.ai/api-reference) agrees on the three survey parameters and conversation continuity. Actual business-tool entitlement and billing for this account were not tested.
- Global CLI configuration and Codex-managed OAuth credentials were created through the authorized login workflow. No wallet was used, and no new permission to publish, send, recruit or pay was granted.
- The wallet route remains unavailable because the confirmed local wallet configuration is absent; dependency restoration is complete. If wallet/x402 proof is later required, prepare an authorized existing wallet locally and reuse `connect()`/`listTools()` with payment guards intact. Never paste secrets into chat or generate/replace a wallet as an implied recovery step.
- The earlier synthetic-answer retrieval issue is unchanged. This phase did not query respondent data or diagnose the historical REST 401 with a current token.
- Repository source changes are confined to this status file; ignored local diagnostics and global authentication setup are listed above. Phase 1 tests were not rerun. Before/after SHA-256 snapshots matched for all seven checked files: the package manifest, Phase 1 adapter and tests, Scenario HTML, research helper, and shared carbon/financial engines. `git diff --check` passed.
- Survey creation/publication, email sends, synthetic participants, recruitment, payment signatures, USDC spending and external model calls: **none**. No approval for those actions is implied by future authentication.

### Phase 2 supplement: dependency restoration and retrieval investigation

The operator explicitly requested restoring the existing client and investigating historical response retrieval while remaining in Phase 2. No application or client source, existing tests, package manifest or lockfile was changed.

#### Locked dependency restoration and tests

`flashpoint-client/package.json` uses npm with a version-3 `package-lock.json`. The available workspace Node is `22.23.5`, satisfying the declared `>=22.19.0` requirement. Commands from `flashpoint-client/`:

```powershell
& '..\..\release-assets\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000 --cache '..\.runtime\npm-cache'
& '..\..\release-assets\node.exe' --test
& '..\..\release-assets\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' ls --depth=0
& '..\..\release-assets\node.exe' flashpoint.mjs tools
```

- The initial sandboxed install encountered `EACCES` and ended with npm's `Exit handler never called` error. The permitted unsandboxed retry used the same lockfile, disabled installation scripts and installed 18 packages in 32 seconds. No audit/fix or dependency upgrade was run.
- Installed direct versions: `@x402/evm@2.31.0`, `@x402/fetch@2.31.0`, `undici@8.12.4`, `viem@2.58.0`.
- Existing client tests: **26 passed, 0 failed**, across all four unchanged test files. These are offline tests using fake transports/signers and temporary wallet fixtures. They prove parser/authentication protocol behavior and payment guards; they are not evidence of live wallet authentication or settlement.
- Covered guards include exact approval hash and ceiling, scoped analysis, one call/zero paid retries, replay refusal, stop on ambiguous transport outcomes, unsigned status checks and refusal of invalid wallet configuration.
- The CLI `tools` command now reaches its wallet-configuration guard. No actual wallet authentication signature, payment signature or wallet edit occurred.
- All 17 before/after file hashes matched, covering Phase 1, calculation sources, both client manifests, authentication/payment implementations and all four client tests. Phase 1 tests were preserved and were not rerun. Installed modules and npm cache remain Git-ignored.

#### Current production discovery and schemas

Reused the existing ignored diagnostic helper with `codex app-server --stdio` and `mcpServerStatus/list`. The request now uses `detail: full`, which adds resource inventory discovery but does not call business tools. Full schemas for all ten tools and their advertised descriptions are saved locally.

- Discovery at `2026-11-22T04:41:49.179Z` (November 21, 11:41 PM ET): `Flashpoint.AI 1.30.0`, `authStatus: oAuth`, ten tools, zero resources and zero resource templates. No identity resource is available. No fresh sign-in was needed.
- `tool_survey`: required `brief: string`; optional nullable `survey_id` and `conversation_id`, default null. Continue related work with the exact returned conversation and survey IDs.
- `panel`: required `action: string`; optional nullable `name`, `num_respondents` (integer), `research_objective`, `context`, `audience` (object), `survey_id`, `panel_id`, `provider`, `request`, `conversation_id`, `job_id`. The live description defines `create`, `run`, `create_and_run`, `status`, `recruit`; status uses `job_id` and run actions return asynchronous jobs. Conditional requirements come from that description, not JSON Schema's required array.
- `payment_confirmation`: required `intent_id: string`. `chat`: required `message: string`, optional nullable `conversation_id`.
- The public API reference's panel run/status description differs from the live tool description. Future code must follow the discovered server contract and inspect actual return values; no panel action was executed to resolve that documentation drift.
- Safe local/read-only functions remain `configuredWallet` (local validation only), `parseRpcText`, `connect` (authentication, not payment), `listTools`, `balance` (chain read only), and unsigned `readPanelStatus` for a known job. Authentication reads/requires secrets; they must never be logged. Ordinary `callTool` refuses business work. The approval-enabled wrapper and `payment_confirmation` must not be used as connectivity probes.
- OAuth is the working identity path. The operator previously confirmed team selection, but account/team names or IDs are still not independently available from discovery. OAuth success does not establish ownership of the older wallet-created survey or prove wallet/x402 billing.

#### Historical answer-retrieval findings

Reviewed the current saved workflow for survey `fafab667-...`, its conversation/panel/run linkage, the blocked analysis and the historical `response-detail-auth-diagnostic.json` under the sibling modular project's `docs/flashpoint/` directory. Only safe metadata, statuses and counts were inspected; no respondent answers or credential material were printed.

- Saved survey/scenario IDs, analytics panel IDs and run IDs are consistent across the workflow, normalized record and analysis report. The panel's library ID differs from its analytics panel ID; the existing scope uses the analytics ID. No local scope warning is present. This checks local linkage, not remote ownership.
- The saved synthetic study remains 12 COMPLETE records, zero usable answer sets and zero question distributions. The analysis worker reports 12 rows as `NOT STORED`; that narrative is not an independent inspection of database storage.
- The historical diagnostic at `2026-11-21T06:15:13.164Z` records a wallet JWT with 3600-second lifetime, `notExpiredAtInspection: true` and `notExpiredAfterRequests: true`. Wallet authentication and MCP initialization succeeded; discovery returned ten tools both before and after REST GETs returned 401 for the survey and one response detail.
- That log makes ordinary expiry an unsupported explanation for this specific attempt. Failure occurred on the REST access path while MCP discovery worked. Token validation differences between surfaces, authorization/team scoping and other server-side causes remain possibilities; the exact cause is not established. Historical ownership was not verified, and no full response detail was obtained. Missing data in storage is therefore still unproven.

Supported retrieval routes, verified against official documentation but **not executed** in this supplement:

| Evidence needed | Supported path |
| --- | --- |
| Response metadata/list | `GET /api/v1/surveys/{survey_id}/responses?status=complete&limit=50&offset=0` |
| Individual answer content | `GET /api/v1/surveys/{survey_id}/responses/{response_id}` |
| Question-level distributions | `GET /api/v1/surveys/{survey_id}/analytics/frequencies` (or append the question label) |
| Response-data export | `GET /api/v1/surveys/{survey_id}/exports/csv` or `/exports/xlsx` |
| MCP-managed retrieval | Existing `tool_survey`, with the verified survey/conversation IDs and a retrieval-only brief; the server's internal analysis/export tools are not separate client MCP tools. |

Sources: [Analyze](https://docs.flashpoint.ai/surveys-analyze), [Import & export](https://docs.flashpoint.ai/surveys-import-export), [Authentication](https://docs.flashpoint.ai/authentication). A response list is not proof of readable answers; PDF/DOCX instrument exports are not response exports. REST requires credentials valid for that surface and access to the exact survey; do not assume that a working MCP bearer is interchangeable with a REST credential.

The next smallest retrieval diagnostic is to confirm the old survey's owning account/team and use the supported response-detail or frequency path with appropriate authorization. If retrieval must go through the provider agent or an export job, confirm that action's scope and charge behavior before executing it. No paid agent call, export, new survey, new panel or payment was used to investigate this issue. Do not rerun the synthetic panel as a speculative repair.

Local evidence is saved in `.runtime/challenge/diagnostics/flashpoint-authenticated-discovery.json` (all tool schemas) and `response-scope-check.json` (local linkage checks), both ignored by Git. Existing historical diagnostics were left unchanged.

## Phase 3: durable research state, decisions and evidence validation

Status: **DONE**. Implemented and tested an offline bookkeeping layer without modifying Carbon Twin calculations, frontend code, the Phase 1 adapter/tests or the existing Flashpoint client/tests. No live run or approval was initialized; fixtures used isolated temporary directories only.

Files added:

- `scripts/challenge-state.cjs`: private state store, legal stages, one/two-round cap, persisted remote IDs/counts, explicit approvals, consent-list fingerprints, action intent/outcome ledger, crash recovery and a minimal init/show CLI.
- `scripts/challenge-validate.cjs`: explicit local evidence schema, scoped response validation, duplicate/malformed/preview exclusion, separate source types and question denominators, and aggregate-only limits.
- `scripts/challenge-safety.cjs`: identifier/reference validation, exact fingerprints and redaction helpers.
- `tests/challenge-fixtures.cjs`: clearly labeled reusable offline fixtures and isolated test stores.
- `tests/challenge-state.test.cjs` and `tests/challenge-validate.test.cjs`: focused Phase 3 tests.
- `challenge/STATE_AND_EVIDENCE.md`: interfaces, input contract, recovery behavior and practical limitations.

Files modified: `package.json` (adds `challenge:state` and `test:state`; preserves existing scripts) and this status file.

Verified commands from the repository root:

```powershell
& '..\release-assets\node.exe' --test --test-reporter=spec tests/challenge-context.test.cjs tests/challenge-state.test.cjs tests/challenge-validate.test.cjs
```

Result: **48 passed, 0 failed** (39 new Phase 3 tests + 9 existing context tests).

From `flashpoint-client/`:

```powershell
& '..\..\release-assets\node.exe' --test --test-reporter=spec
```

Result: **26 passed, 0 failed**. Total **74 passed, 0 failed**. Syntax checks passed for all six new JavaScript files. `git diff --check` passed. Runtime state and events remain covered by `.gitignore`.

Confirmed behavior:

- A state write uses an fsynced temporary file and atomic rename. A durable redacted event outbox and append-only JSONL journal recover missing/acknowledgement-lost appends without duplicating events.
- A hard process interruption preserves in-flight intent and remote IDs. Recovery marks unknown outcomes, refuses blind replay, and clears only a verified dead writer lock on explicit request. Concurrent-process tests permit one intent only.
- Every supported external action needs an exact, explicit approval. Null budget permits zero spending. Invitation approvals bind to the reviewed recipient-list fingerprint and consent revision; changes invalidate pending grants. This module does not dispatch external operations or replace transport payment guards.
- No usable answer evidence blocks analysis and final completion. The 12 COMPLETE / zero usable regression produces `INSUFFICIENT_EVIDENCE`. Real/synthetic/fixture data stays separate. Aggregate-only results retain unknown individual counts and restricted inference scope.
- Decision logs retain short summaries and question evidence references, omit respondent/answer objects, and redact credential/email/URL patterns. Raw individual answers are not saved in state or event logs.

Remaining limitations:

- Authentic Flashpoint answer-output schemas, current survey ownership and live readback remain unverified. The local evidence contract follows existing saved-report row conventions and does not guess unknown MCP envelopes. A future live adapter must validate actual output before conversion.
- Local references, consent fingerprints and recorded remote outcomes depend on callers supplying authentic artifacts; the offline layer cannot attest remote truth, identity or human consent. Exact transport integration belongs to later phases.
- Torn/corrupt journals fail closed for manual reconciliation. Filesystem durability is local, and Windows access control depends on the private directory ACL. Free-text redaction is not a universal PII detector.
- No external survey, invitation, participant generation, payment, Flashpoint call or external model call occurred in Phase 3. No Phase 4 work was performed.

At the Phase 3 checkpoint, the next incomplete work was Phase 4, agent instructions and autonomous research policy. The real answer readback gate remained unproven. That checkpoint stopped at Phase 3; the subsequent authorized work is recorded below.

## Phase 4: agent instructions and autonomous research policy

Status: **DONE**. Codex's role is an Autonomous Research Analyst for CarbonX,
with objective-driven question selection, evidence-dependent follow-up and a
maximum of two rounds. This is an instruction/policy checkpoint and local planning
demonstration, not a completed research study or an automatic live runner.

Reviewed the playbook Operating Contract and phase requirements, existing status
and state/evidence documentation, actual context/state/validation/safety exports,
client authentication and approval code, and saved authenticated MCP discovery.
No pre-existing repository/ancestor AGENTS.md was found. Existing unrelated
implementation and tests were preserved.

Files added:

- `AGENTS.md`: repository-scoped instructions, research-role routing, model/evidence
  boundaries, current-phase limits, approvals, privacy, recovery and local checks.
- `challenge/agent.md`: judgment policy and exact existing interfaces for
  initialization/resume, context/plan logging, reviewed requests, approvals/action
  intent/outcome, real ID preservation, validation, follow-up and reporting. It
  distinguishes local capabilities from missing transport/answer-output wiring.
- `challenge/examples/offline-plan.json`: one-off **OFFLINE PLANNING** artifact,
  containing a recalculated model snapshot, objective interpretation, ranked
  uncertainties, participant suitability, six independently proposed Round 1
  questions/reasons, proposed coding criteria and unfulfilled approval gates.
  It is not loaded as runtime policy or a fixed question bank.
- `tests/challenge-policy.test.cjs`: four offline contract tests for model grounding,
  question/uncertainty traceability, no invented evidence/permission/follow-up, and
  the documented planning/persistence/reopen sequence using actual modules.

Files modified:

- `package.json`: adds only `test:policy` in this phase; prior scripts are preserved.
- `challenge/STATE_AND_EVIDENCE.md`: labels the 74-test total as its historical
  Phase 3 checkpoint and links the subsequent policy/status; interfaces unchanged.
- `challenge/IMPLEMENTATION_STATUS.md`: this Phase 4 checkpoint and phase table.

### Confirmed offline planning result

Objective: "Find the one change CarbonX should make first so a first-time user
can understand our steel plant results and explain the trade-off to someone else."

Loaded `compareScenarios()` from the existing adapter. The Combined snapshot uses
model `original-ccus-4f14b05433a1`, input hash
`7b6e07a30c5f1a2f091d5fbbca50ef158439e6427a8c601a84498304fb426c3f`, year
2050. It retains physical avoidance 1.3198900320000004 Mt CO2/year, finance-adjusted
avoidance 1.3153445820000005 Mt CO2/year, gross CAPEX 796.36305 million constant
2025 USD and NPV -134.6275490285887 million constant 2025 USD. Permanent storage
remains null. These are illustrative model outputs, not respondent evidence or
verified plant measurements.

The proposed study concerns first-time users' comprehension and ability to
explain the trade-off. Its six questions address unaided page purpose, an unaided
handoff explanation, carbon meaning, financial meaning, specific friction and
one requested change. Each question links to an uncertainty and a possible
decision use. Neither the historical Q1-Q7 brief nor a preselected design change
determines the plan. A proposed 3-5-person consenting convenience sample is a
planning target only: no participants were recruited, verified or contacted.

Executed the local sequence with an isolated `test_fixture` state under
`.runtime/challenge/offline-phase4/37b98d3a-3d1f-4ad7-b7e4-3ec5ebf08ee8/`:

`NEW -> MODEL_CONTEXT_READY -> DRAFT_PLAN -> PLAN_ROUND_1` decision event.
The decision is an event, not a new stage. Four events were persisted. The
directory contains the exact model context, plan, state, journal and execution
summary. It is Git-ignored. The default production `run-state.json` was not
initialized or overwritten. Final stage: `DRAFT_PLAN`; actions: 0; pending
approval: null; IDs, response counts and evidence: null. No participant findings
or recommendation were generated. Round 2 questions are null, awaiting actual
validated Round 1 question evidence and a consequential unresolved uncertainty.

The policy requires fresh review/approval for actual draft creation, publication,
consented recipient distribution/reminders and any paid/x402 action with a specific
amount and budget impact. None is requested or granted by this phase. Before a
future live study, verify account/team, exact recipients/consent, UI exposure,
transport guards and answer retrieval. OAuth discovery is not wallet payment
approval or historical survey ownership proof.

### Verification

Executed from the repository root with the existing Node 22.23.5 runtime:

```powershell
& '..\release-assets\node.exe' --test --test-reporter=spec tests/challenge-context.test.cjs tests/challenge-state.test.cjs tests/challenge-validate.test.cjs tests/challenge-policy.test.cjs
& '..\release-assets\node.exe' --check tests/challenge-policy.test.cjs
git diff --check
```

Result: **52 passed, 0 failed** (9 context + 39 state/evidence + 4 policy).

From `flashpoint-client/`:

```powershell
& '..\..\release-assets\node.exe' --test --test-reporter=spec
```

Result: **26 passed, 0 failed**. Total: **78 passed, 0 failed**. The context test
includes loopback-only HTTP checks; no external Flashpoint or model request was
made. New test syntax and tracked diff whitespace checks passed.

SHA-256 preservation check: **20 of 20 files unchanged**, covering Phase 1-3
modules/tests/fixtures, both existing calculation engines, Scenario/research
sources, client auth/payment code, client manifests and all four client tests.
The first hash-check command encountered a Windows native-argument quoting error;
the corrected native PowerShell `Get-FileHash` comparison passed. This affected no
source file or test. Runtime state/journal paths were confirmed Git-ignored.

### Remaining dependencies and Phase 5 readiness

- The policy and local planning path are ready for a separately authorized Phase
  5 offline orchestration/report dry-run. Phase 5 has not started. No full runner,
  automatic question generator or report exporter was added in Phase 4.
- Existing approval state and `approved-draft.mjs` are not connected into one
  dispatcher. The latter's narrow wallet-based draft/synthetic paths do not
  provide general first-party publication/email/readback. Do not bypass the ledger
  through a connector or claim that complete live execution already works.
- The current state path requires publication and a recorded email send before
  response analysis. Direct-link/import/synthetic-only lifecycles would need
  explicit later design/tests; do not forge ledger entries or skip stages.
- Actual team/account identity, survey ownership, authentic answer-output schemas,
  provider question-ID mapping/pagination and the real answer readback gate remain
  unresolved for Phase 6. Historical REST 401s do not establish session expiry or
  missing storage. Historical 12 COMPLETE / zero usable records remain excluded.
- Phase 4 made no live MCP/tool calls, created/published no surveys, sent no emails,
  generated no synthetic respondents, signed no payments and spent no USDC.

Stop at **Phase 4** and wait for the user's next instruction before Phase 5.

## Phase 5: executable offline research integration

Status: **DONE**. Implemented an executable workflow from the specified objective
through actual Carbon Twin context, explicit Codex planning, reviewed draft request,
approval, simulated platform execution, ID persistence, normalized answers,
validation, evidence-dependent follow-up and a clearly labeled final report.
Only TEST DATA was executed; Phase 6 has not started.

Reviewed the current AGENTS/policy, implementation status, state/evidence contract,
Phase 4 planning example, actual exported Phase 1-3 interfaces, current client and
wallet/x402 approval architecture, and authenticated Phase 2 schema artifacts.
The original Downloads playbook path is no longer present and no matching copy
was found under Downloads/workspace. The complete supplied Phase 5 request and
existing Operating Contract/policy from the preceding phases provided the task
scope; no missing-document content was invented.

### Files

Added:

- `scripts/challenge-workflow.cjs`: minimal orchestration over existing context,
  state, safety and validation modules; immutable private artifacts; exact approval
  manifests; asynchronous execute/retrieve/reconcile; Codex checkpoints; stage
  acknowledgements/recovery; structured and Markdown report generation.
- `scripts/challenge-mcp.cjs`: verified input-schema boundary, survey request and
  known-job panel-status builders, TEST DATA receipt/ID checks and explicit local
  answer-envelope normalization. Unknown live response envelopes fail closed.
- `scripts/challenge-offline.cjs`: deterministic, durable, replaceable simulator;
  labeled creation/publication/invitation/status/retrieval receipts and deliberate
  failure/pending/empty/delay/unknown/402 cases. No network/wallet/LLM imports.
- `scripts/challenge-run.cjs`: executable offline demo and individual workflow
  commands; input-matched recorded Codex replay; concise safe run summaries.
- `challenge/flashpoint-tool-contract.json`: exact relevant Phase 2 schema and
  description snapshot (`tool_survey`, `panel`), with discovery provenance. This
  is an input contract snapshot, not current live authentication/output proof.
- `challenge/fixtures/workflow-responses.json`: explicitly labeled TEST DATA,
  question-level answers, duplicate/malformed/preview rows and a follow-up fixture.
- `challenge/fixtures/codex-decisions/{plan-r1,analysis-r1,followup-r1,analysis-r2,final-r2}.json`:
  Codex-authored decisions from this session, bound to their observed inputs.
  These are replay artifacts for this specific demo, not a universal question bank.
- `tests/challenge-workflow.test.cjs`: 27 integration/boundary/recovery tests.
- `challenge/OFFLINE_WORKFLOW.md`: executable entry points, interfaces, reasoning
  contracts, TEST DATA boundaries, replay/recovery behavior and Phase 6 gaps.

Modified: `package.json` (adds `challenge:offline` and `test:workflow`), `AGENTS.md`
(routes offline work and includes integration checks), `challenge/agent.md`
(links implemented offline path while retaining live boundaries), and this status.
No existing Phase 1-4 implementation/test or model/client file was changed.

### Exact entry points

From the repository root, Node 22.23.5:

```powershell
& '..\release-assets\node.exe' scripts/challenge-run.cjs demo
& '..\release-assets\node.exe' scripts/challenge-run.cjs demo --case empty
& '..\release-assets\node.exe' scripts/challenge-run.cjs demo --case pending
```

Each creates a new private ignored run directory unless `--dir` is provided.
With supported Node on PATH, `npm run challenge:offline` and
`npm run test:workflow` are equivalent convenience entries. Individual commands
are `init`, `show`, `checkpoint`, `submit`, `request`, `approve`, `reject`,
`execute`, `retrieve`, `recover`, `reconcile`, `resume`; arguments/examples and
the explicit simulated approval boundary are documented in OFFLINE_WORKFLOW.md.
Rerunning a completed demo returns its saved result without new actions/events.
Rerunning an incomplete demo refuses overwrite and requires explicit inspection.

### Actual executions and evidence

The authoring run first loaded actual `compareScenarios()` output, then Codex
wrote Round 1's five questions. After retrieval and existing validation, Codex
inspected the actual fixture values/counts, wrote the analysis and chose a targeted
Round 2. Only then were its two questions authored, citing Round 1 evidence. Codex
inspected Round 2 answers before writing its analysis and final recommendation.
The authoring run used `CODEX_AUTHORED`; reproduction is clearly labeled
`RECORDED_CODEX_REPLAY`, not a new automatic LLM decision.

Latest successful executable replay:

- Directory: `.runtime/challenge/phase5/verified-valid/`.
- Internal run ID: `d22bbc07-b3f7-4745-b454-a3c6b506e7ba`.
- State: `COMPLETED`; two rounds; **67 persisted events**, six successful mock
  actions (create/publish/invite per round), no pending approval, no actual charge.
- `run-state.json`, `events.jsonl`, private immutable `artifacts/`, durable
  `offline-adapter.json` and `report.md` are present and Git-ignored.
- Fixture IDs returned/preserved include `TEST-survey-r1/r2`,
  `TEST-conversation-r1/r2`, `TEST-analytics-panel-r1/r2` and
  `TEST-provider-run-r1/r2`. These are explicitly mock platform IDs, not real IDs.
- Planning-to-provider question maps are stored in draft receipts. Each follow-up
  question has persisted exact Round 1 `questionEvidenceRefs`; state/events also
  retain the decision's triggering references and concise justification.

| TEST DATA case | COMPLETE | Retrieved rows | Usable records | Valid question denominators | Result |
| --- | ---: | ---: | ---: | --- | --- |
| Valid Round 1 | 6 | 8 | 4 | handoff/carbon/finance/friction: 4 each; change: 3 | VALID_ANSWERS |
| Valid Round 2 | 3 | 3 | 3 | Both questions: 3 | VALID_ANSWERS; bounded simulated report |
| Empty-answer Round 1 | 12 | 12 | 0 | All zero | INSUFFICIENT_EVIDENCE; BLOCKED |

Round 1 excluded both duplicate copies, one malformed row and one preview. Its
actual fixture values include two NPV sign/time misunderstandings out of four
finance answers, one carbon-boundary concern and a no-change answer. The follow-up
therefore examines a proposed NPV explanation while permitting the carbon concern
to challenge that priority. The **simulated** recommendation is a short NPV
sign/time/units explanation. It claims no real user need, effective UI change,
population inference or engineering/financial validation.

Case A ran at `.runtime/challenge/phase5/final-empty/` (run
`67650dd1-2893-4be2-911d-45c354bfa65f`): **29 events**, `BLOCKED`, zero usable
answers, no analysis/follow-up/recommendation/report. The blocker identifies
missing question-level answer data. A pending-approval demo made zero mock
business calls. Optional one-round STOP was separately tested without a second
survey. No third round is possible.

### Reasoning, mocks and checks

Codex supplies objective interpretation, uncertainties, participant suitability,
questions, qualitative coding, follow-up judgment and recommendation. The code
requires a labeled output with exact checkpoint `inputHash` and semantic
`basisHash`, validates structure/scope/support, then logs the output reference.
Changing objective, context or actual answer values rejects an old recording and
requires fresh Codex input. The simulator never chooses a question or conclusion.

Deterministic code performs model calculation, hashing, tool-input checks, exact
approval matching, consent-list fingerprints, durable intent/outcome bookkeeping,
ID/mapping preservation, normalization, evidence eligibility/denominators, legal
stages, two-round limit and report rendering. Structural validation cannot attest
authorship, ownership, consent or scientific validity.

All platform actions, receipts, approvals/consent, participants and answers remain
mocked. Only the model calculations and local execution/persistence are actual.
The final report explicitly labels every participant finding as TEST DATA. Neither
raw answer text nor TEST recipient IDs enter the decision journal. All live adapter
and unknown response envelopes are refused rather than treated as provider output.

Verified commands:

```powershell
& '..\release-assets\node.exe' --test --test-reporter=spec tests/challenge-context.test.cjs tests/challenge-state.test.cjs tests/challenge-validate.test.cjs tests/challenge-policy.test.cjs tests/challenge-workflow.test.cjs
```

The final root suite covers 9 Phase 1 + 39 Phase 3 + 4 Phase 4 + 27 Phase 5 tests.
From `flashpoint-client/`, ran the unchanged existing suite with:

```powershell
& '..\..\release-assets\node.exe' --test --test-reporter=spec
```

Client: **26 passed**. New integration suite: **27 passed**. All existing 78
tests remain passing. Total: **105 passed, zero failures**. Five new JavaScript
files passed syntax checks; `git diff --check` and added-file whitespace checks
passed. SHA-256 preservation check: **25/25 existing files unchanged**, including
all earlier modules/tests, calculation engines, client auth/wallet/x402 files and
both client manifests. The default production run was not initialized/overwritten.

Integration tests include exact pending/rejected approval, absent spend permission,
duplicate creation/invitations, restored IDs, mock unsigned 402, empty/duplicate/
malformed/preview/invalid evidence, changed-input replay refusal, retrieval failure,
delays without automatic polling, unknown outcomes, actual child-process restart,
reconciliation without replay, interrupted Codex/report acknowledgements and async
adapter substitution. The complete demo also passes with external fetch forbidden.

During the initial authoring run, a local `EPERM` write error interrupted a stage
acknowledgement after answers were saved. The state blocked and retained evidence;
explicit local resume/read completed without duplicate draft/publication/invitation
actions. The exact OS/storage cause was not established. Later fresh full replays
passed. An initial test-only mismatch in expected replay error-code names was
corrected; the final guards and tests pass.

### Exact Phase 6 blockers and readiness

**Not ready to create the first real survey through this orchestrator.** The
offline end-to-end gate is ready; live execution still requires:

1. A reviewed live adapter integrating the existing narrow approved client or
   connector with the state intent/outcome ledger, exact action scope, one-shot
   transport markers and x402 ceilings. This phase imports no live dispatch code.
2. Fresh supported authentication/discovery and verification of the actual
   account/team and survey access. OAuth connectivity alone neither identifies
   the selected team independently nor authorizes wallet payment.
3. Authentic creation/answer response schemas, returned IDs/question maps,
   pagination/completeness and a proven individual-answer or distribution readback.
   The historical REST 401 cause and unusable 12-record synthetic result remain
   unresolved; the simulator does not repair or replace that evidence.
4. Actual first-party eligibility, consent/opt-out list, approved recipient scope,
   reproducible UI exposure and supported live invitation routing. The current
   email request is an offline distribution specification, not implemented delivery.
5. The user's separate Phase 6 authorization and exact approval for real creation,
   publication/distribution or any charged call, including the maximum amount,
   currency/network, budget impact and zero paid retries. Nothing in Phase 5
   authorizes these actions.

No real survey was created/published, no real invitation sent, no paid respondent
generated, no wallet transaction signed and no USDC spent. Stop at **Phase 5**;
wait for the user's next instruction before any live research.

## Phase 6: resumed guarded live integration

Status: **IN PROGRESS, blocked before resource creation by TEAM_UNVERIFIED**.
The interrupted four-file implementation was inspected and preserved, then verified
and completed at the local adapter boundary. No full Phase 6 completion is claimed.
The latest resume request authorizes local implementation/testing and safe read-only
diagnostics only; it does not approve a real survey or any other resource change.

### Verified state distinctions

| Checkpoint | Actual result |
| --- | --- |
| OFFLINE TESTED | YES: all 128 tests pass, including 23 new live-boundary tests with mocked transport. |
| MCP CONNECTED | YES: authenticated read-only discovery at 2026-11-22T06:30:59.930Z, OAuth, Flashpoint.AI 1.30.0, ten tools. |
| TEAM VERIFIED | NO: intended team is CarbonX; actual OAuth account/team name/ID remains unknown. |
| LIVE SURVEY CREATED | NO: no tool_survey business call, no survey ID or conversation ID. |
| LIVE DISTRIBUTED | NO: no publication, list creation or invitation; recipients.txt is absent. |
| LIVE RESPONSES RETRIEVED | NO: no real response, answer distribution or export; no findings/recommendation. |

### Files and actual integration

Implemented/completed:

- `scripts/challenge-live.cjs`: branded asynchronous adapter using the Phase 5
  interface, explicit team/discovery gates, exact approved manifests, durable
  request/claim/raw/profile/receipt handoff, optional mocked invoker for tests,
  scoped read authorization, first-party-only explicit result mapping and recovery.
- `scripts/challenge-live-run.cjs`: local CLI to prepare/review/approve/queue/claim/
  capture/reconcile the handoff. It invokes no remote business tool and reads no
  OAuth credential or wallet key. Actual approvals must reference the user action.
- `scripts/challenge-workflow.cjs`: narrow integration hooks for the approved live
  adapter, separate real/fixture labels, no live decision replay, verified result
  intake, exact real recipient-list source, one-shot reads and correct report labels.
  Existing context/state/validation modules and offline adapter/CLI remain intact.
- `tests/challenge-live.test.cjs`: 23 explicit TEST DATA protocol/transport tests.
  Their mocked response shapes are not a verified provider output schema.
- `challenge/LIVE_INTEGRATION.md`: actual architecture, commands, limits, discovery
  diagnosis, manual team verification and future approval/readback requirements.
- `challenge/FIRST_SURVEY_REVIEW.md`: freshly authored five-question local proposal
  with a self-contained actual-model stimulus for novices and no Round 2 questions.

Also updated `package.json` (`challenge:live`, `test:live`), `AGENTS.md`,
`challenge/agent.md`, `challenge/OFFLINE_WORKFLOW.md` (historical checkpoint note)
and this status. Earlier uncommitted work was retained; no reset/revert/commit/push
or model/client credential change was performed.

Node does not inherit Codex OAuth. The chosen handoff targets the configured
server's actual runtime tool, `mcp__flashpoint__tool_survey`, after a durable exact
approval/intent and one-shot dispatch claim. It must not silently substitute the
separately connected Apps tool with the same schema. Codex remains the only
research reasoning runtime; no hosted LLM or second decision engine was added.

Unknown/malformed/approval-only results are captured privately and do not become
successful resources or findings. A reviewed profile must bind to the exact raw
response hash, actual status/ID pointers and, before publication, actual question
IDs/prompts/types/options. Missing instrument mapping blocks publication. Real
answer mappings identify actual fields/completeness and call the unchanged Phase
3 validator. They cannot turn an empty completion counter into answers. Actual
provider creation/answer profiles remain unverified until authorized live work.

### Read-only discovery and the failed attempt

Executed `codex --version` (0.171.0-alpha.13), `codex mcp --help`, filtered
`codex mcp list --json`, read-only login/logout help, non-sensitive configuration
metadata, and the existing app-server discovery helper adapted to a separate
Phase 6 diagnostic directory. Configuration contains the official endpoint
`https://api.flashpoint.ai/mcp`, with no exposed account/team metadata. No OAuth
bearer, key, header value or private token claim was printed/extracted.

The restricted execution context returned an empty MCP inventory:
`server_not_found`, serverCount 0, businessCalls 0. The same script was then run
in the approved user context and returned OAuth plus ten tools without a new
login. The operational difference is execution-context visibility; the exact
sandbox isolation mechanism was not established. This does not demonstrate an
expired session, missing authentication, network failure, bad MCP initialization
or tool-schema mismatch. The historical REST 401 diagnosis remains separate and
unresolved.

Successful command from the repository root (approved user execution context):

```powershell
& '..\release-assets\node.exe' .runtime/challenge/phase6/list-flashpoint-tools.cjs
```

Discovered tools: `chat`, `tool_qual`, `get_demographics`, `create_panel`,
`surveys_agent`, `panel`, `payment_confirmation`, `demographics`, `presentation`,
`tool_survey`. The live survey schema still requires only `brief`, with nullable
optional `survey_id` and `conversation_id`. Survey/panel schema hashes match the
Phase 2 snapshot. Resources/templates: 0/0; identity resources: 0. No advertised
account/team identity query is available. Discovery establishes advertised survey
capability, not this account's creation entitlement, subscription or quota.

Actual remote work was protocol initialization, discovery and resource inventory
only. **Business tools invoked: 0; wallet/payment signatures: 0.** Diagnostic
evidence is private under `.runtime/challenge/phase6/discovery.json` and
`connectivity-diagnostic.json`; previous Phase 2 diagnostics were preserved.

Official authentication documentation confirms that human OAuth grants are bound
to the user/team chosen in the browser picker, while human usage is subscription
based and wallet x402 is a different path. Current account plan/quota and credit
consumption are still unverified; zero authorized direct payment is not proof of
zero platform cost. See [official authentication](https://docs.flashpoint.ai/authentication).
No business probe, payment_confirmation, wallet login or token extraction was used.

### Fresh first-party planning and actual persisted state

Loaded actual `compareScenarios()` output in a new isolated private live-intent
run, not from the Phase 4 plan or Phase 5 decisions. Model remains
`original-ccus-4f14b05433a1`, Combined input hash
`7b6e07a30c5f1a2f091d5fbbca50ef158439e6427a8c601a84498304fb426c3f`.
The stimulus identifies annual Mt CO2, million constant 2025 USD, illustrative
assumptions and the distinction between capture/avoidance and CAPEX/discounted NPV.
Permanent storage remains unknown. Display rounding does not modify calculations.

Codex newly authored five open questions: retell the trade-off, interpret a
participant-selected figure, identify information needed for trust, describe a
possible misunderstanding, and suggest one first change or no change. The study
concerns comprehension of a text summary; it does not pretend to have tested an
implemented UI change or recruited industrial investment experts. No Round 2,
answers, findings or preferred product change has been prefilled.

- Directory: `.runtime/challenge/phase6/carbonx-first-party/`.
- Internal run ID: `4a801839-55e0-4ee3-a092-37750489f0bf`.
- Actual source: `real_first_party` (intended study type, not a claim of received
  evidence). Stage: `BLOCKED`, resumeStage `DRAFT_PLAN`; readiness `TEAM_UNVERIFIED`.
  TEAM_UNVERIFIED is a decision/blocker, not an invented Phase 3 stage.
- Eight persisted events; zero action intents/remote operations. Local draft
  approval is PENDING and has not been granted. Team name/ID and all remote IDs
  and response counts are null. The default production run was not overwritten.
- Model input/context, fresh Codex output, exact review manifest and sanitized
  discovery/account context are saved privately. No recipient file was created.

Read-only local inspection:

```powershell
& '..\release-assets\node.exe' scripts/challenge-live-run.cjs show --dir .runtime/challenge/phase6/carbonx-first-party --context .runtime/challenge/phase6/carbonx-first-party/account-context.json
```

### Exact tests and preservation results

```powershell
& '..\release-assets\node.exe' --test --test-reporter=spec tests/challenge-context.test.cjs tests/challenge-state.test.cjs tests/challenge-validate.test.cjs tests/challenge-policy.test.cjs tests/challenge-workflow.test.cjs tests/challenge-live.test.cjs
```

Root suite: **102 passed, zero failed** (9 context + 39 state/evidence + 4 policy
+ 27 offline workflow + 23 live-boundary). From `flashpoint-client/`:

```powershell
& '..\..\release-assets\node.exe' --test --test-reporter=spec
```

Client suite: **26 passed, zero failed**. Total **128 passed, zero failed**;
all original 105 tests remain passing. Four added/modified JavaScript files passed
syntax validation. `git diff --check` passed; public-file whitespace and runtime
ignore checks were also verified.

Coverage includes unverified team, changed account/discovery context, exact real
versus simulated approval, missing/incorrect IDs, malformed MCP, mocked 401/402
without retries/signing, raw unmapped output, provider confirmation, immutable
one-shot claims, recovery without duplicate creation, no alternate recipients,
explicit scoped reads, pagination/scope/source mismatch and 12 COMPLETE/zero
answers. A mocked read runs through handoff, normalization, Phase 3 validation and
the Codex evidence checkpoint; this is OFFLINE TESTED, not LIVE RESPONSES RETRIEVED.

SHA-256 audit against the 29-file pre-Phase-6 capture: **28 unchanged**, with only
the intentionally extended `scripts/challenge-workflow.cjs` changed. Both calculation
engines, context/state/validation/safety modules, offline adapter/CLI, every earlier
test and all existing client/auth/wallet/payment files/manifests remain unchanged.
The capture was restored from the earlier sanitized hash output after volatile
session storage was unavailable; the final persisted audit contains all 29 hashes,
not an empty baseline. No assertion was weakened to obtain a test pass.

### Remaining blockers, readiness and next authorization

The guarded adapter boundary is locally executable and tested. It is **not yet a
verified live research loop**, and full Phase 6 is not DONE:

1. **TEAM_UNVERIFIED:** the user confirmed CarbonX is the intended team but has
   not verified the actual OAuth-selected account/team. No API identity resource
   was found. Follow the exact operator steps in LIVE_INTEGRATION.md: verify
   membership, reconnect through the supported OAuth team picker if needed and
   confirm the actual selected name/ID (where visible), without sending credentials.
   No hardcoded or invented team ID is used.
2. **No resource-changing approval:** the current resume permits local/read-only
   work only. After verified team context and fresh discovery, cancel the old
   unapproved manifest, resume locally and prepare a new exact one-draft request.
   Obtain the user's specific creation approval with billing uncertainty disclosed.
   Do not reuse an old hash or automatically relay a provider confirmation.
3. **No authentic output/readback:** actual draft result/instrument, ownership,
   returned IDs, answer schema/pagination and individual/frequency/export readback
   still need observation after approval. Unknown output remains a blocker rather
   than guessed fields. REST access is not inherited from Codex OAuth.
4. **No real allowlist/consent:** `.runtime/challenge/recipients.txt` is absent.
   Distribution requires that exact private, consented/opt-out-filtered list and
   a separate publication/list-use/send approval. No synthetic or paid substitute.
5. **Billing/entitlements:** current account subscription/quota and optional paid
   capabilities are unverified. No wallet/x402 or other payment path is authorized
   or implemented by this OAuth bridge; paid operations require a separate review.

The next user action is manual team/account verification. The next external
resource-changing action requiring authorization, after that prerequisite, is
**creating exactly one reviewed survey draft in the verified CarbonX team**.
Publication, invitations and any charged operation remain separate approvals.
No real survey, email, paid job, synthetic respondent, payment or USDC spend
occurred. Stop before that first real operation; Phase 7 has not started.

## Phase 6: user-confirmed team and first draft approval boundary

This checkpoint supersedes the earlier TEAM_UNVERIFIED readiness state; it does
not change the historical discovery or test evidence above and does not mark
Phase 6 DONE.

- The user explicitly confirmed that the team actually selected during Flashpoint
  MCP OAuth was CarbonX. Ownership is now **USER_VERIFIED**, based on that user
  statement. Independent API verification is **false**; team/account IDs remain
  unknown. The private confirmation artifact explicitly grants no survey creation,
  publication, invitation or payment permission.
- Confirmed installed `codex-cli 0.171.0`. Refreshed protocol-only OAuth discovery
  with that installed native executable at `2026-11-22T15:44:28.600Z` (10:44:28 ET):
  Flashpoint.AI 1.30.0, ten tools, zero identity resources, unchanged survey input
  schema, zero business calls. The default PowerShell `.ps1` launcher was blocked
  by execution policy and the sandboxed npm wrapper encountered EPERM; the approved
  native-executable check succeeded. No execution-policy change or new login occurred.
- Recomputed the current Carbon Twin context and confirmed it matches the saved
  study context exactly. Retained the existing independently authored five-question
  plan/title/stimulus; no fixture decision, new model calculation rule or Round 2
  was introduced.
- Preserved the same internal run `4a801839-55e0-4ee3-a092-37750489f0bf`. Cancelled
  only the stale, unapproved creation proposal; resumed local planning and recorded
  `TEAM_USER_VERIFIED` with the user confirmation and fresh discovery references.
- Current legal stage: **DRAFT_PLAN**, with one `create_survey` approval **PENDING**.
  Thirteen journal events, zero action intents, no remote IDs and no answer counts.
  The user's team confirmation was not treated as survey-creation approval.
- Refreshed manifest: `file:artifacts/176795e9030cdbb8970f64fa5d43f637f573a085db2e8b27a96a7a3cafa9ede9.json`;
  approval ID `cc19b220-8a93-494a-a66b-15b84ec6fa21`. Exact runtime operation is
  `mcp__flashpoint__tool_survey` with only the saved full `brief` argument. First-call
  survey/conversation IDs are omitted, one business call, zero paid retries, zero
  authorized direct payment. The exact request is saved privately as
  `.runtime/challenge/phase6/carbonx-first-party/first-draft-mcp-request.json`.
- Subscription/credit/quota consumption remains unverified; the proposed call is
  not promised free. A payment or additional provider confirmation must stop and
  be relayed to the user. No wallet/x402 permission is implied. Draft deletion/undo
  is unverified and uncertain execution must be reconciled before a further call.
- Updated FIRST_SURVEY_REVIEW.md and LIVE_INTEGRATION.md for the new provenance and
  review boundary. Application/calculation/client code was not modified; local
  source hashes, context equality, schema, exact request and pending/no-action
  invariants were checked. No earlier phase or full test suite was restarted.

Next action: present the title/questions, CarbonX USER_VERIFIED provenance, cost
uncertainty and exact request, then obtain the user's explicit approval for **one
real draft**. Stop at that boundary. No publication, emails, synthetic respondents,
payments, remote creation or Phase 7 work occurred in this preparation turn.

## Phase 6: actual first call and single-person test preparation

This checkpoint supersedes the preceding no-business-call/approval-pending
checkpoint. Phase 6 remains incomplete. The user authorized exactly one real
draft-only `mcp__flashpoint__tool_survey` call, zero additional payments and no
automatic retries. That call has been consumed; no second call was made.

### Actual result, not a simulated receipt

- Action ID: `ca3e5ed2-03b1-4995-9fd9-618ca9268a57`.
- MCP completed at `2026-11-22T16:15:27.955569Z` (11:15:27 ET); task status
  `completed`, `isError: false`, server duration 16,961 ms.
- Actual `conversation_id`: `01a2040a-4289-7932-aefc-548080a59748`.
- Actual task ID: `01a2040a-4289-7932-aefc-549f2869ee7a`; this is a surveys-agent
  task ID, not a research/panel run ID.
- Actual `survey_id`: **null**. The worker explicitly stopped before creation
  because the legacy brief required independent team verification, while its
  available tools did not expose team identity. Task completion is not draft
  creation. No authentic survey status, question IDs or created instrument exist.
- Cause: the old brief did not propagate the user's already accepted
  USER_VERIFIED CarbonX confirmation. This is a request-construction issue, not
  observed OAuth expiry, 401, 402 or evidence of a different selected team.
- Original response, capture metadata, reviewed mapping and reconciliation are
  private under `.runtime/challenge/phase6/carbonx-first-party/live-handoff/`.
  Raw file: `ca3e5ed2-03b1-4995-9fd9-618ca9268a57.raw.json`; response SHA-256:
  `eab62bb2b5b4fa1ae3e20f9343c92ceed655d299f18a3752a1225077a5a74729`.
- The action was first preserved as uncertain, then explicitly reconciled to
  `NOT_EXECUTED` for survey creation using the actual pre-creation blocker and
  null ID. The real conversation was bound separately without inventing a survey
  ID. Review evidence: `file:draft-create-result-review.json`.
- Returned usage: input 12, output 605, cache creation 106,749 and cache read
  213,021 tokens. These are token counters, not prices. Monetary cost, remaining
  subscription credits and invitation quota were not returned. No payment,
  wallet signature, USDC transaction, publication or distribution was executed.

### Corrected next request; not authorized or dispatched

The live adapter now propagates explicit USER_VERIFIED ownership without claiming
independent API verification or requiring an unavailable identity endpoint. It
still stops on conflicting platform identity, entitlement/payment problems and
unverified team context. It requests one DRAFT only and returns an existing survey
instead of creating another if the conversation already contains one. The model,
objective, stimulus and five reviewed questions are unchanged.

- Same internal run: `4a801839-55e0-4ee3-a092-37750489f0bf`; stage `DRAFT_PLAN`.
- Next exact request: `.runtime/challenge/phase6/carbonx-first-party/followup-draft-mcp-request.json`.
  Arguments: full corrected `brief` and the actual `conversation_id` above;
  `survey_id` omitted because none exists.
- Manifest SHA-256: `3279f7e58c9a9a5e1f1d40e7018b3391de19507bb6f6bc043350ca20f54c23b6`.
- Approval ID: `4894dd8c-22a9-4707-a105-4c8dd47d0fba`, **PENDING**.
  No intent/claim/call has been created for this proposal. The consumed earlier
  approval cannot authorize it. Proposed scope is one additional draft-only
  call, zero paid retries, zero additional payment; publication/send excluded.

### First-party integration test, not research evidence

The user supplied their own address and requested a once-only integration test.
The sole recipient is saved only in ignored `.runtime/challenge/recipients.txt`;
state/decision records contain its fingerprint and count, not the address.
Consent is for preparation; invitation sending is not approved. The private
`single-person-integration-test.json` and
`publication-and-single-email-plan.json` explicitly label the intended result
`SINGLE_PERSON_INTEGRATION_TEST`, n=1, not independent multi-respondent evidence.

The proposed official-format template is saved privately as
`invitation-template-proposed.json` (`subject`, `body`, `cta_text`, including
`{{SURVEY_LINK}}`). No remote list exists. Actual draft/instrument verification
must precede a separately reviewed publication request; a separate exact-recipient
list/send approval must precede one invitation. No reminders or uncertain-send
retries are allowed. Publication/list/send operations are not executable yet.
See [FIRST_SURVEY_REVIEW.md](FIRST_SURVEY_REVIEW.md) for the template and gates.

### Local validation of the correction

```powershell
& '..\release-assets\node.exe' --check scripts/challenge-live.cjs
& '..\release-assets\node.exe' --check tests/challenge-live.test.cjs
& '..\release-assets\node.exe' --test --test-reporter=spec tests/challenge-live.test.cjs
& '..\release-assets\node.exe' --test --test-reporter=spec tests/challenge-context.test.cjs tests/challenge-workflow.test.cjs
git diff --check
```

Live boundary suite: **24 passed, zero failed**, including the new same-conversation
USER_VERIFIED regression. Existing context/workflow checks: **36 passed, zero
failed** (9 context + 27 offline workflow). Total checked in this checkpoint:
**60 passed, zero failed**. Syntax, whitespace and private-runtime ignore checks
passed. The original client suite was not unnecessarily rerun; its previous
26-pass result remains historical. Production code changes in this checkpoint
are limited to draft-request construction in `challenge-live.cjs`; calculation,
original client/authentication/payment and earlier workflow code remain intact.
Final state inspection confirms 25 persisted events, one action reconciled as
`NOT_EXECUTED`, the actual conversation, a null survey ID and exactly one pending
new approval. Unknown response counts remain null, not fabricated zeros/answers.

Next boundary: request new explicit approval for **one additional draft-only call
in the preserved conversation**. A draft does not yet exist, so publication and
email approval must wait for its actual instrument/status. No Phase 7 work.

## Phase 6: additional authorized call created the real draft

This checkpoint supersedes the preceding additional-approval-pending and null
survey state. The user explicitly approved exactly one additional draft-only
call, using the corrected request and the existing conversation. The approval
was consumed once; no additional business or read call was made.

### Confirmed creation and actual identifiers

- Action ID: `df23e00f-022b-4064-bffb-ef0fb9a184e9`.
- Exact approved manifest: `3279f7e58c9a9a5e1f1d40e7018b3391de19507bb6f6bc043350ca20f54c23b6`.
  Approval `4894dd8c-22a9-4707-a105-4c8dd47d0fba` is now consumed.
- Actual survey ID: `b579f71c-e720-4d34-8513-1ea2f468239d`.
- Actual conversation ID: `01a2040a-4289-7932-aefc-548080a59748`, unchanged.
- Actual surveys-agent task ID: `01a20421-fdbb-74b1-8274-b4cc58bdb2dd`.
- Completed at `2026-11-22T16:42:03.590671Z` (11:42:03 ET); server duration
  57,348 ms; task status `completed`, `isError: false`.
- Creation is supported by the returned structured survey/conversation IDs and
  the worker's explicit draft-created statement and `draft` status row. The
  response reports version 1, two blocks, seven items (two transitions and five
  open-ended questions), estimated length about 2.3 minutes. This is verification
  from the actual creation response; no independent second read was authorized.
- Requested title remains `CarbonX steel results: first-time understanding and
  trust`; the response did not independently echo a survey-title field.
- Team provenance remains CarbonX **USER_VERIFIED**, not independently
  API-verified; no team/account ID was inferred.

The unchanged original response is private at
`.runtime/challenge/phase6/carbonx-first-party/live-handoff/df23e00f-022b-4064-bffb-ef0fb9a184e9.raw.json`.
Response SHA-256:
`210f25c667c6f20e1162a101b4b7afc7080420b329decb5d01d9b02dee875e5a`.
Capture metadata, exact-hash-bound profile/receipt and
`additional-draft-result-review.json` preserve the actual evidence. The text
content's JSON and `structuredContent` were compared and agree exactly.

### Actual question readback and remaining instrument limitation

The real returned question IDs/types/prompts are transcribed without invented
fields in [FIRST_SURVEY_REVIEW.md](FIRST_SURVEY_REVIEW.md). Private extraction:
`actual-draft-question-summary.json`, explicitly labelled provider-reported text,
not a structured questionnaire export. The response reports each type as
`text/single` and an opt-out, `I am not sure / prefer not to answer`.

Introduction/stimulus are abbreviated in the response. Several question-table
prompts omit the reviewed instruction suffixes; it is unknown whether this is
agent summarization or actual field shortening. Full field text, types and opt-out
options have not been exported. Do not substitute the intended plan for these
missing fields or silently normalize provider types. The local receipt therefore
has `questionMap: null`; publication remains blocked by `UNVERIFIED_INSTRUMENT`.
The next verification would require a separately authorized, same-survey,
same-conversation read of the full instrument. No draft recreation is needed.

### Billing, quota and safety results

- Actual returned token usage: input 21, output 3,114, cache creation 210,297,
  cache read 1,141,480. No monetary cost, subscription balance or remaining
  invitation allowance was returned. No claim of a free operation is made.
- Worker reported zero blockers/errors; findings were no survey quotas configured
  and Defender off. The survey-quota finding is not a billing-quota measurement.
- Worker explicitly reported no publication, distribution, payment or test data.
  No invitation, recruitment, synthetic respondent, wallet signature, USDC payment,
  payment confirmation or extra remote read was invoked by this workflow.
- Direct-payment authorization remained zero. The existing receipt's numeric USD
  zero records the direct-payment scope, with `platformBillingVerified: false`;
  it does not establish the server's monetary cost.

### Persisted state and local checks

Same internal run `4a801839-55e0-4ee3-a092-37750489f0bf`; stage
`AWAITING_APPROVAL`; 32 persisted events. Two historical creation action records:
the first `NOT_EXECUTED`, the additional call `SUCCEEDED`. There is exactly one
real survey ID, the original conversation, no pending approval, no publication or
send action and no answer evidence. Unknown invited/completed/retrieved/usable
counts remain null. The n=1 single-person test classification and sole private
recipient remain unchanged; no remote email list exists.

Local checks verified the exact manifest/request/approval hash, USER_VERIFIED
attestation, original conversation, zero payment/retry scope, one-shot claim,
raw-response consistency, unique returned question IDs, state and private-runtime
ignore rules. `git diff --check` passed. No production code or model calculations
were changed in this execution turn; the preceding 60-test local check is not
represented as a new test run. No mock receipt or fixture answer entered this run.

Stop here. Full instrument verification needs its own scoped authorization;
publication and even one email invitation require separate exact approvals.
No Phase 7 work or automatic follow-up call.

## Phase 6: one authorized full-draft inspection; publication boundary

This checkpoint supersedes the earlier unverified-instrument gate. The user
authorized exactly one read-only survey MCP operation and preparation of a
publication proposal. That one operation was executed, with both actual IDs;
no retry, additional business read or resource-changing action occurred.

### Actual read and content verification

- Read action/permit ID: `6218ca7f-7293-4e72-8eac-04aed9d4202a`.
- Survey `b579f71c-e720-4d34-8513-1ea2f468239d`; unchanged conversation
  `01a2040a-4289-7932-aefc-548080a59748`.
- Actual title: **CarbonX steel results: first-time understanding and trust**.
- Actual state: `draft`, design stage, English, version **1**, revision **17**.
  Five `text`/`single` questions plus two transition items, in two blocks.
- Actual question IDs and FULL text, introduction and stimulus match the reviewed
  plan exactly. Earlier missing suffixes were absent from the creation summary,
  not from the fields now retrieved. All five return optout allowed, empty option,
  skip and validation arrays. No independent description/required field was
  returned; instruction/condition and identity metadata remain unavailable.
- The text is self-contained and covers the model quantities/units without app
  access. The stimulus explicitly labels scenarios illustrative and all numbers
  assumption-dependent, not measured plant results or investment advice. It
  distinguishes capture/avoidance, CAPEX/discounted NPV and unknown permanence.
- Content review supports use for the planned n=1 integration test. Actual novice
  comprehension/rendering has not been observed. `Mt CO2/year` is not expanded and
  may be unfamiliar. No editing, copy changes or new survey were authorized/made.
- API omissions remain unknown, not fabricated blanks. Envelope conversation ID
  is real and preserved; the document getter does not expose it or a team ID.
  CarbonX ownership remains USER_VERIFIED, not independently API-verified.

Original private response: `live-handoff/6218ca7f-7293-4e72-8eac-04aed9d4202a.raw.json`.
SHA-256: `1315060090a74657c1e888f422749d94070ee475c9cc54f5997084c16217795b`.
Task `01a20435-45cc-7bd1-8cca-fbcb2e6c50e0`, completed
`2026-11-22T17:02:57.751840Z` (12:02:57 ET), duration 47,877 ms. The exact fenced
JSON document was extracted separately without replacing the original response;
its reviewed mappings preserve actual content and IDs. Content hash:
`e40205de2162723fa85f812884cb4e4ec60a90ccc54e9b7a1fe37deed303c2fd`.

See [SURVEY_PUBLICATION_REVIEW.md](SURVEY_PUBLICATION_REVIEW.md) for every full
English question, the full introduction/stimulus, missing-field limits and exact
publication arguments. Private files include `verified-survey-document.json`,
`instrument-verification-review.json` and `instrument-read-mapping-profile.json`.

### Guarded integration and local validation

The adapter previously allowed answer reads only after distribution. Added a
separate instrument-read purpose at unpublished-draft stages; answer read stages
remain unchanged. It binds actual IDs, current OAuth context and explicit approval,
uses the existing atomic one-shot claim and refuses another unresolved read.
No generic stage bypass or new state stage was added.

`prepareInspection()` prepares/authorizes the scoped read; the local adapter
queues/claims it. `completeInspection()` validates a hash-bound mapping of the
actual complete JSON block, question types/subtypes/options, full text, title,
introduction and stimulus. A new `INSTRUMENT_VERIFIED` event supplies the effective
question map/version/hash; original creation receipts are unchanged. Publication
proposals bind the observed title/version/revision/content hash and stop on
changes, payment requirements or another provider confirmation. The read does not
grant publication or answer access.

```powershell
codex.cmd --version
& '..\release-assets\node.exe' .runtime/challenge/phase6/approval-preparation/list-flashpoint-tools.cjs
& '..\release-assets\node.exe' --test --test-reporter=spec tests/challenge-live.test.cjs
& '..\release-assets\node.exe' --test --test-reporter=spec tests/challenge-context.test.cjs tests/challenge-workflow.test.cjs
git diff --check
```

Fresh protocol discovery at `2026-11-22T17:00:12.540Z`: CLI 0.171.0, OAuth,
Flashpoint.AI 1.30.0, ten tools, expected schema, zero business calls. No re-login,
token extraction or account switch. The next SINGLE business call was the actual
survey inspection, not a connectivity probe.

Final live suite: **27 passed, zero failed**; unchanged context/offline workflow:
**36 passed, zero failed**; total **63 passed**. The initial new test fixture
attempted to replace a sealed plan and was correctly rejected; the fixture was
changed to supply its fields before initial submission, preserving PLAN_SEALED.
Syntax/whitespace/runtime ignore checks passed. No calculation, original wallet/
client/payment, state or response-validator module was changed. Fixture data was
used only in isolated local tests, never in the actual run.

### Pending exact publication proposal and current state

- Stage: `AWAITING_APPROVAL`; **39 events**. Original two creation action records
  unchanged; one additional read permit/claim/receipt. No publication action.
- Pending approval: `371df0ba-ff51-4486-81a6-81b6d528b380`, kind `publish`,
  status **PENDING**. Request/manifest hash:
  `8b595441dcc881b225b77445294a265b94c3ccf37a0d9f8662634cf9b27b22c9`.
- Exact request: `.runtime/challenge/phase6/carbonx-first-party/publication-mcp-request.json`;
  runtime `mcp__flashpoint__tool_survey`, one proposed call, actual survey and
  conversation IDs, reviewed title/v1/revision17/hash. Paid retries zero;
  additional payment ceiling USD 0. No approval granted, queue or claim for publish.
- Publication changes draft to active and enables respondent access; it does not
  send invitations. Official lifecycle supports pausing new arrivals while those
  already responding may finish; no return-to-never-published state is established.
  The worker reports publication cannot be undone. No reversibility operation was
  exercised. Official agent confirmation may require another user interaction;
  never automatically issue an additional call or `confirm`.
- The read reports no extra payment required/no charged action and returns token
  usage input 11/output 3,605/cache creation 118,311/cache read 116,069. No monetary
  amount or remaining subscription/invitation allowance was returned. Survey quotas
  are empty; that is not billing entitlement. Publication cost remains unverified;
  stop on any additional payment/charge requirement.

The only next authorization requested is publication of this exact survey.
Email list use/send, reminders, recruitment, respondent generation, payments and
all additional remote calls remain separate. Stop at this approval boundary.
The planned result remains SINGLE_PERSON_INTEGRATION_TEST, n=1; no real answers,
research findings or Phase 7 work exist.

## Phase 6: ACTIVE and one actual invitation submitted

The latest user authorized publication and one own-address invitation without
another approval between them, then explicitly accepted no respondent quotas.
That warning means collection is uncapped until manually paused/closed. The
standard publication and send confirmations added no scope or charge and were
completed under actual existing user approval. Gate-only actions were reconciled
NOT_EXECUTED from real receipts; no uncertain operation was retried.

- Survey `b579f71c-e720-4d34-8513-1ea2f468239d`; original conversation
  `01a2040a-4289-7932-aefc-548080a59748` throughout.
- Actual status **active**, version **1**, revision **17**, unchanged title/text.
  Published `2026-11-22T17:25:13.881314+00:00` (12:25:13 ET).
- Actual publication response: private run
  `live-handoff/7662f87b-3b20-4756-b5c2-2b1539c8eae5.raw.json`;
  extracted `actual-publication-receipt.json`, review `publication-success-review.json`.
- Exactly one private approved address, fingerprint verified. Actual returned
  subject/body/CTA match the approved template. No address appears in public
  documents or the decision log. The user's subsequent address question was
  checked against the actual send receipt and confirmed an exact match.
- Actual list ID: `f4ed4429-a443-48ad-8b44-8544c09bb16a`.
- Actual invitation count **1**, status **sending / queued**, not confirmed
  delivered. No bounce at send time; zero reminders. Sent timestamp
  `2026-11-22T17:28:20.331949+00:00` (12:28:20 ET). Per-invitation/provider-message
  IDs were not returned; none invented.
- Actual send response:
  `live-handoff/0e0f67db-b16f-4617-90b2-09620fe2547e.raw.json`;
  SHA-256 `37206f6461febbb4654a617126d7fa5e151ed62727571df12a2a144986def8a9`.
  Full private receipt: `actual-invitation-send-receipt-private.json`;
  sanitized review: `invitation-send-result-review.json`.
- Platform quoted email cost USD 0 and reports no billing charge. No independent
  billing ledger/remaining allowance was returned. No wallet, x402, USDC, payment
  authorization, paid recruitment, synthetic respondent, extra invitation or resend.

State is **AWAITING_RESPONSES**, **79 events**, invitedCount **1**, no pending
approval or unresolved in-flight action. Completed/retrieved/usable counts remain
**null** until actual submission/readback; no fixture answers or findings exist.
`post-submission-retrieval-plan.json` saves the scoped proposal and existing user
read authorization. Dispatch only after the user confirms actual submission;
then preserve real response/question IDs and raw evidence and validate through
Phase 3 without asking for redundant approval. Evidence label remains
**SINGLE_PERSON_INTEGRATION_TEST, n=1**, not independent multi-person research.

The user should check inbox/spam for **CarbonX: one-person survey integration
test**, follow the personalized email link and submit once. Do not resend if slow.
No Phase 7 work. No architecture/refactoring or broad test rerun was performed.
A one-line receipt-mapping extension permits the actual send document to take
conversation ID from its same original MCP envelope; all hash/scope/count checks
remain. Actual live capture verified the send count and legal state transitions;
the previous 63-test result remains historical.

## Phase 6 final technical checkpoint and Phase 9 authorization

**REAL FIRST-PARTY SURVEY — n=1 TECHNICAL INTEGRATION TEST.** The user personally
received the invitation and submitted five answers; some wording was assisted.
The actual platform record is not a fixture or generated respondent. It is also
not independent, unbiased external user feedback.

- One authorized read continued survey `b579f71c-e720-4d34-8513-1ea2f468239d` and
  conversation `01a2040a-4289-7932-aefc-548080a59748`. Actual status remains active,
  version1/revision17. No survey changes, pause/close, mail or paid action.
- Worker reports using read-only `get_survey`, `get_email_list_stats`,
  `get_analytics`, `list_responses`, `get_response`. Detail retrieval returned
  the real response ID and all five complete answer values; no export/fallback.
- Analytics COMPLETE=1; list completed=1; listed=1; fully retrieved=1; usable=1.
  Each actual question ID has one valid answer. Phase3 status VALID_ANSWERS,
  exclusions []; no duplicate or malformed record. Pagination explicitly reports
  all records retrieved. Record flags: COMPLETE, not preview/test/excluded.
- Exact reserved DEVICE metadata is omitted from the five-answer denominator,
  with its original value private. Unknown question IDs remain rejectable and
  duplicate answer IDs fail; the original validator is unchanged.
- Current list stats sent=0/completed=1 and the historical send receipt
  actual_sent=1 are preserved separately. Do not equate those counter semantics
  or resend. A delivery webhook is unavailable; actual receipt/opening/submission
  is user-confirmed and platform completed=1 is observed.

Original private MCP:
`live-handoff/32f3a825-63f5-4468-b451-1e937c97e611.raw.json` under the existing run.
SHA-256 `b40094069d52fa4a1f3ebb36f4edeaa4934550c7dbfa70cf88448beefbc1f38b`.
The real response ID, original answers, normalized evidence and full validator
output are private. Public evidence:
[REAL_FIRST_PARTY_INTEGRATION_SUMMARY.md](REAL_FIRST_PARTY_INTEGRATION_SUMMARY.md).

Fresh CODEX_AUTHORED ANALYSIS/FOLLOWUP decisions bind actual checkpoint hashes and
question evidence, not offline replay. The workflow reached ANSWERS_VALIDATED,
ROUND_1_ANALYZED and FOLLOWUP_DECISION with **STOP**; 91 journal events. No pending
approval or unresolved action. No Round2 questions/resources were created. A
generic phase-status event was correctly rejected in FOLLOWUP_DECISION; its
supported STOP remains intact and the bounded completion checkpoint is a separate
private file, not a weakened state guard or unsupported research COMPLETED claim.

Phase6 is technically DONE: real creation, publication, one invitation, actual
submission/readback and evidence validation. Independent participants are needed
before a meaningful product recommendation. No real answers are published and
the old synthetic 12-COMPLETE/0-usable frontend snapshot remains separate.
Root full tests 107 passed and client 26 passed, total 133; this is the preceding
Phase6 verification, to be rerun for the final Phase9 submission. Original Carbon
Twin calculations, state/validator and wallet/payment guards remain in place.

The user's latest explicit instruction skips Phases7/8 and authorizes Phase9,
including final Git commit/push to the supplied repository. Phase9 introduces no
new research, UI, participants, email or payment. The original master-roadmap file
was not present at its former Downloads path; the explicit current submission
instructions govern this work. No need to reopen the skipped phases.

## Phase 9 final verification

README now prominently documents how to install/login, open the working directory,
load the actual instruction files and paste the exact high-level objective. The
written explainer records how this real Agent was triggered. It distinguishes
active Codex reasoning and MCP execution from offline recorded-decision replay,
and identifies the real private handoff/artifact/recovery steps. No always-on or
one-command standalone backend Agent is claimed.

Verified installed CLI0.171.0 help for login, MCP add/login, working-root -C and
session resume. Added a bounded public protocol-only discovery helper for fresh
developers; actual authenticated discovery succeeded with ten tools, zero model
turns/business calls/payments. Restricted context server_not_found is documented,
not misreported as token expiry. A draft-inspection wording fix now uses the
verified current account-context team name rather than hardcoding the demo team.
No calculation, wallet, state or validator rule was refactored.

Final `npm run test:all`: **133 passed, zero failed**, using Node22.23.5. Offline
valid reaches COMPLETED with two simulated rounds; empty reaches BLOCKED with
INSUFFICIENT_EVIDENCE; pending remains DRAFT_PLAN with PENDING approval and zero
actions. All three have realOperations=0 and realSpendingUsd=0. Syntax/whitespace
checks passed. Documentation files and package commands match actual exports.

Public origin/default branch were verified through GitHub metadata. Audit found
no credentials or known private evidence in current files/index; six old commit
identity records contained the private contact address. A local sanitized branch
preserves all seven original file trees while redacting that identity. Original
local main remains available, and an exact expected-head lease protects remote
replacement. One old signature cannot be retained after rewriting metadata.
Previously public caches/clones cannot be revoked by a branch update. See
[security audit](../docs/SECURITY_AUDIT.md). Final commit/push results are recorded
after remote verification; no further research or UI work is included.
