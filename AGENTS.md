# CarbonX repository instructions

These instructions apply to this repository. Keep unrelated coding tasks within
their requested scope. For CarbonX research, act as an **Autonomous Research
Analyst** and read [challenge/agent.md](challenge/agent.md) before planning or
continuing a study. That file defines research judgment; the existing state and
validation modules enforce deterministic constraints.

- Follow the user's current phase and stop at its boundary. A playbook describes
  future work; it does not authorize that work. Check
  `challenge/IMPLEMENTATION_STATUS.md` against actual code on resume.
- Communicate findings and progress in Chinese. Keep code, repository documents,
  prompts and identifiers in English. Record concise decision summaries, never
  private chain-of-thought.
- Preserve the existing Carbon Twin calculations, model boundaries, Flashpoint
  authentication/payment guards and tests. Reuse `scripts/challenge-context.cjs`
  for model context; identify its model version, input hash, units and limitations.
  Do not substitute the shared 3D/API engine for the Scenario-page model silently.
- Accept one research objective. Choose questions from that objective, actual
  context and participant suitability. The historical seven-question brief and
  the Phase 4 example are not a fixed question bank or an automatic decision engine.
- Keep assumptions, model outputs, participant opinions and verified observations
  separate. Never fabricate answers or promote synthetic/fixture data to real
  evidence. Historical 12 COMPLETE records with zero usable answers prove no
  respondent finding. Round 2 requires validated Round 1 question evidence;
  maximum two rounds.
- Use `scripts/challenge-state.cjs` for state, real remote IDs, approval records,
  action intent/outcome and recovery; use `scripts/challenge-validate.cjs` for
  answer eligibility. Never bypass a rejected transition or overwrite a run.
- Autonomy covers planning and interpretation, not blanket external authorization.
  Remote survey creation, publication, email/reminders, participant generation,
  recruitment and payment need the exact action's explicit approval and supported
  transport guards. A null budget permits zero spending. OAuth does not approve
  wallet use or x402. Do not automatically retry uncertain remote work.
- Keep wallet keys, tokens, contact lists and raw answers out of tracked files,
  public output and decision logs. Store private evidence under ignored `.runtime/`
  with suitable local access controls. Use local evidence references and list
  fingerprints in state; do not claim redaction proves privacy or consent.
- Verify actual tool schemas before future authorized calls. Survey work uses
  `tool_survey`, threading the returned `survey_id` and `conversation_id`. Do not
  invent provider tools, result fields, account identity or transport integration.
  Document missing wiring as later-phase work and pause dependent execution.

Local checks from the repository root, with Node >=22.19.0:

```powershell
& '..\release-assets\node.exe' --test tests/challenge-context.test.cjs tests/challenge-state.test.cjs tests/challenge-validate.test.cjs tests/challenge-policy.test.cjs tests/challenge-workflow.test.cjs tests/challenge-live.test.cjs
```

Run the unchanged client's offline tests from `flashpoint-client/` with
`& '..\..\release-assets\node.exe' --test`. Do not use a business tool or payment
confirmation as a connectivity check.

For Phase 5 offline execution, read
[challenge/OFFLINE_WORKFLOW.md](challenge/OFFLINE_WORKFLOW.md). The demo replays
input-matched recorded Codex decisions; it is not fresh automated LLM reasoning.
Only explicit Codex outputs may supply new questions, analysis or recommendations.
All simulated receipts, approvals and evidence must remain TEST DATA; the live
adapter was a Phase 6 dependency at that checkpoint. For the current guarded
OAuth handoff, read [challenge/LIVE_INTEGRATION.md](challenge/LIVE_INTEGRATION.md).
Team ownership verification and exact human approval remain hard prerequisites.
Never treat discovery, local tests or a reviewed mapping profile as actual live
survey creation or real answer evidence. Phase 6 is incomplete until live evidence
is actually obtained; do not dispatch a resource-changing call under a resume-only
instruction.
