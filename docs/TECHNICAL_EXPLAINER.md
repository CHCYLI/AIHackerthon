# CarbonX — Autonomous Research Agent

**Flashpoint MCP Challenge | Team CarbonX | November 2026**

## The idea

Industrial decarbonization involves emissions reductions, capital investment,
financial feasibility and how people understand those trade-offs. CarbonX combines
an interactive steel-plant carbon digital twin with a research workflow grounded
in its actual model context. A simulation can calculate an outcome; it cannot by
itself establish that a person understands the result or trusts its assumptions.

Our Agent uses Codex for research judgment and Flashpoint MCP for authorized real
survey execution. Deterministic Node modules handle calculations, durable state,
approval scope, consent fingerprints, recovery and evidence validation.

## How the Agent Was Triggered

We opened the repository in an authenticated Codex environment and asked it to
read `AGENTS.md`, `challenge/agent.md` and `challenge/LIVE_INTEGRATION.md` before
continuing the research workflow. The high-level objective was:

> Find the one change CarbonX should make first so a first-time user can
> understand our steel plant results and explain the trade-off to someone else.

Codex loaded `scripts/challenge-context.cjs`, interpreted the objective, selected
uncertainties and authored a fresh five-question plan. The local workflow produced
reviewable manifests and private state. After explicit user approvals, Codex
claimed each local handoff, invoked the configured Flashpoint `tool_survey` and
preserved the actual returned result for reviewed local mapping.

This was active Codex reasoning plus tool execution, not a standalone backend
launched by a sentence in a normal terminal. The offline CLI is different: it
replays recorded Codex judgments against artificial fixtures and makes no LLM or
Flashpoint call. A new developer's exact install, working-directory, prompt and
handoff steps are prominent in [README](../README.md#how-to-run--trigger-the-autonomous-agent)
and detailed in [the runbook](LIVE_AGENT_RUNBOOK.md).

## Components and responsibilities

| Component | Responsibility |
| --- | --- |
| Existing Carbon Twin | Deterministic illustrative emissions/finance scenarios and provenance |
| OpenAI Codex | Objective interpretation, research questions, tool choice, evidence analysis and STOP/follow-up judgment |
| Flashpoint MCP | Real survey creation, publication, invitation and response retrieval when authorized |
| `challenge-workflow.cjs` | Fresh judgment checkpoints, local orchestration and legal transitions |
| `challenge-live.cjs` | Guarded one-shot Codex handoff and reviewed real-result normalization |
| `challenge-state.cjs` | Durable IDs, approvals, consent/count metadata, intent/outcome/recovery |
| `challenge-validate.cjs` | Question-level structural eligibility, exclusions and denominators |

Node never inherits the Codex OAuth bearer. A local queue is not a remote success;
a claimed action cannot be replayed after interruption. Unknown outcomes are
preserved and reconciled using actual receipts/status before another action.
There is no custom hosted LLM backend or second autonomous decision engine.

## Model context and research design

The Agent recalculated the Scenario-page model rather than replacing its formulas
or copying an old fixture. The illustrative 2050 context included approximately
1.320 million tonnes CO2/year of physical avoided emissions, 796.4 million constant
2025 USD of investment and -134.6 million constant 2025 USD NPV. Capture, avoidance,
capital cost and discounted lifetime value were distinguished. Permanent CO2
storage was not claimed. The separate shared API/3D model has different boundaries;
its outputs were not silently substituted.

Five open-ended prompts tested retelling the trade-off, interpreting a chosen
figure, information needed before repeating the result, possible misunderstandings
and a suggested first explanation change. Participants received a self-contained
text stimulus, so they could answer without operating the Carbon Twin UI.

## What actually happened

1. **Planning:** Codex used the objective and actual model context to author a new
   plan; the historical question set and offline recordings were not replayed.
2. **Draft:** One real survey was created and its actual title, full text, question
   IDs and types were read back and matched to the reviewed instrument.
3. **Publication:** The user approved the exact survey and explicitly accepted
   the platform's no-quota finding. The survey became ACTIVE, version1/revision17.
4. **Invitation:** One private consented own-address list and the reviewed template
   were used. The real send receipt records actual_sent=1, initially queued/sending.
   The developer personally confirmed receiving/opening the email and submitting.
   No independent delivery-webhook receipt was returned.
5. **Readback:** An authorized read continued the same survey/conversation. The
   worker reported survey/status/analytics/list/detail getters and returned one
   COMPLETE record with its real response ID and all five exact answer values.
6. **Validation:** The response was non-preview, non-platform-test and not
   excluded. The mapped data passed the unchanged Phase3 validator: invited1,
   completed1, retrieved1, usable1, five denominators each1, no rejected record.

The reserved DEVICE variable was retained privately as metadata, not counted as
a sixth answer. Unknown question IDs and duplicates remain rejectable. COMPLETE
counts alone would not have passed: the earlier synthetic 12-COMPLETE/0-usable
study still remains insufficient and separate.

See [the sanitized evidence summary](../challenge/REAL_FIRST_PARTY_INTEGRATION_SUMMARY.md)
for actual survey/question identifiers, count definitions, source references and
integrity hashes. Exact respondent text, identifiers, device fingerprints,
contacts, personal links and credentials are not published.

## Why Codex selected STOP

The only respondent was the project developer conducting an integration test,
with assistance drafting some wording. Fresh CODEX_AUTHORED analysis consumed the
actual validated answers and retained question evidence references. It did not
reuse recorded offline analysis or rely on a programmed sample-size threshold.

The evidence proves the live plumbing works; it does not resolve familiarity,
wording-assistance or sampling bias. A further developer-only round would not
establish independent product demand or identify a validated first product change.
Codex therefore selected **STOP**, with no Round2 instrument or external action.
Potential comprehension topics remain test observations, not externally validated
recommendations. Independent participants and an appropriate baseline would be
needed for a meaningful research recommendation.

The workflow reached FOLLOWUP_DECISION with STOP. Phase6 is complete in its
verified **technical** scope; independent research is not marked complete. The
user then skipped Phases7/8 and requested submission packaging directly.

## Reproducibility and limits

The public repository contains source, policy, mocked boundary tests and fixture
demonstrations. Basic app use and offline tests need no account. Live execution
requires a signed-in Codex runtime, authorized Flashpoint team access, fresh actual
tool discovery and explicit scopes for consequential operations. The new discovery
helper exports protocol metadata only; it is not an unattended research service.

The demonstrated team selection was USER_VERIFIED, not independently API-verified.
Provider data was observed through the authenticated agent response, not a signed
REST export. Current list status counters and historical send counts are retained
separately. The survey remains active without quotas; it was not paused or closed.
The worker reports no charge, but no independent billing ledger was available.
No live Round2, paid recruitment, synthetic participants, payment or USDC spend
occurred in this first-party test. The existing app still shows its historical
synthetic snapshot; no new UI feature or data substitution is claimed.

The contribution is an auditable loop from domain context to real execution and
validated evidence, including a justified decision not to make an unsupported
product recommendation.
