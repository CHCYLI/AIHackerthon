# CarbonX first survey review - REAL DRAFT CREATED, NOT PUBLISHED

The existing survey `b579f71c-e720-4d34-8513-1ea2f468239d` is now verified by a separately authorized full-document read: `draft`, version 1, revision 17, original conversation `01a2040a-4289-7932-aefc-548080a59748`. All five complete English question fields, title, introduction and stimulus match the reviewed plan. See [SURVEY_PUBLICATION_REVIEW.md](SURVEY_PUBLICATION_REVIEW.md) for the full actual text, API omissions and exact pending publication request. Target team remains CarbonX, **USER_VERIFIED**, not independently API-verified. Publication, sending and additional payment are not authorized. The prior creation summaries and first-call history below are retained as historical checkpoints.

## Historical creation result and abbreviated question table

Created by the one additional call, completed November 22, 2026, 11:42:03 ET.
Provider reports version 1, two blocks and seven items: two transitions and five
open-ended questions. The following prompts and types are exactly the question
table returned by the worker, not inferred from the proposed instrument.

| Label | Actual question ID | Reported type | Returned prompt |
| --- | --- | --- | --- |
| Q1 | `c29c6fa7-27bb-4d03-9380-9a2d220424c5` | `text/single` | Using your own words, what would you tell someone who has not seen this summary about the trade-off? |
| Q2 | `11afa662-4b8f-497c-868a-64ddf90804ec` | `text/single` | Which one figure would you choose to support your explanation, and what does it mean to you? |
| Q3 | `443937b9-ea8d-4514-a5a0-554fe33d34b3` | `text/single` | What, if anything, would you need to know before you felt comfortable repeating these results to someone else? |
| Q4 | `0283aa00-51de-481a-882f-1bef436e2f98` | `text/single` | What, if anything, could someone easily misunderstand when explaining this summary? |
| Q5 | `a67e68b6-0cd5-46a3-9a3c-5e8f55cd95f5` | `text/single` | What one change or addition, if any, would most help you explain this summary clearly, and why? |

Returned transition IDs: INTRO `1abd96b1-989c-470f-a8b6-d594ba28e601`,
STIM `facad709-c3ac-41de-b681-a28c92be1e45`. Their text is abbreviated in the
response. The worker reports an opt-out on all five questions:
`I am not sure / prefer not to answer`. It reports no publication, distribution,
payment or test data, and zero QA blockers/errors. No survey quotas are configured;
Defender is off. Neither finding reports actual subscription/invitation allowance.

Full field text/options/types are not returned as structured data. Some reviewed
question suffixes are absent from this table; whether the worker shortened its
summary or the actual fields is unknown. The current receipt has `questionMap:
null`, so the publication guard remains `UNVERIFIED_INSTRUMENT`. A separately
authorized read of this existing survey is the next verification step. Do not
recreate it or treat the intended text below as observed field content.

Original response: private run `live-handoff/df23e00f-022b-4064-bffb-ef0fb9a184e9.raw.json`.
Actual result review and extracted table: `additional-draft-result-review.json`
and `actual-draft-question-summary.json`. Token usage: input 21, output 3,114,
cache creation 210,297, cache read 1,141,480; monetary cost/remaining quota unknown.

## Reviewed intended instrument (preserved proposal)

Survey title: **CarbonX steel results: first-time understanding and trust**.

Objective: Find the one change CarbonX should make first so a first-time user can understand our steel plant results and explain the trade-off to someone else.

## Participant introduction

Participation is voluntary. You may skip a question or say you are unsure. Please do not include names, contact details or confidential information. We are studying how this explanation reads to a first-time user, not testing engineering expertise.

## Proposed text stimulus

CarbonX compares illustrative steel-plant decarbonization scenarios. In the 2050 model snapshot, Baseline net emissions are 2.316 Mt CO2/year and Combined net emissions are 0.996 Mt CO2/year, a modeled reduction of 1.320 Mt CO2/year. Combined captures 0.909 Mt CO2/year; capture and avoided emissions are different quantities. Modeled capital investment is 796.4 million constant 2025 USD. NPV is -134.6 million constant 2025 USD, representing discounted net cash flow over the modeled period, not an annual expense. These depend on scenario assumptions and are not measured plant results or investment advice. Permanent CO2 storage is not established by this model. This study asks about understanding this summary; you do not need industrial investment expertise.

## Independently authored Round 1 questions

1. Using your own words, what would you tell someone who has not seen this summary about the trade-off? Two or three sentences are enough; it is fine to say what is unclear.

Rationale: Observe a first explanation without prescribing an improvement or asking for an investment decision.

2. Which one figure would you choose to support your explanation, and what does it mean to you? Include the units or time period if you can; uncertainty is a valid answer.

Rationale: Reveal the participant-selected metric and boundary interpretation instead of assuming an NPV or carbon-label problem.

3. What, if anything, would you need to know before you felt comfortable repeating these results to someone else? Nothing additional is a valid answer.

Rationale: Elicit information/provenance needs without treating participant trust as evidence of engineering validity.

4. What, if anything, could someone easily misunderstand when explaining this summary? Please describe one example, or say that none comes to mind.

Rationale: Check possible communication errors without supplying a preferred error or assuming one occurred.

5. What one change or addition, if any, would most help you explain this summary clearly, and why? No change is a valid answer.

Rationale: Collect a concrete suggestion to compare with actual comprehension and dissent, not a popularity vote proving effectiveness.

Round 2 questions: not designed. This is a text-summary comprehension study; it does not test an implemented UI change.

Model: original-ccus-4f14b05433a1; input hash: 7b6e07a30c5f1a2f091d5fbbca50ef158439e6427a8c601a84498304fb426c3f. Display values are rounded; exact outputs and assumptions are preserved privately in the run.

## Consumed first call and actual blocker

Exact runtime tool: `mcp__flashpoint__tool_survey` (MCP name `tool_survey`), called once with the original saved complete `brief`, omitting initial survey/conversation IDs. The user approved that single call and it has been consumed. No automatic retry occurred.

Historical request: `.runtime/challenge/phase6/carbonx-first-party/first-draft-mcp-request.json`. Manifest SHA-256: `176795e9030cdbb8970f64fa5d43f637f573a085db2e8b27a96a7a3cafa9ede9`; its approval is CONSUMED. The actual worker stopped before creation because this legacy brief asked for independent team verification but did not relay the user's already accepted USER_VERIFIED confirmation. This does not establish an authentication failure.

Actual `conversation_id`: `01a2040a-4289-7932-aefc-548080a59748`. Actual `survey_id`: **null**. Task status `completed` is not survey status. The original MCP envelope is private in `.runtime/challenge/phase6/carbonx-first-party/live-handoff/ca3e5ed2-03b1-4995-9fd9-618ca9268a57.raw.json`. Creation was explicitly reconciled as `NOT_EXECUTED` from that response. The five questions above remain a reviewed proposal, not an actual created instrument.

## Corrected same-conversation operation - now consumed

Exact runtime tool: `mcp__flashpoint__tool_survey`, **one additional call only**, with `brief` and `conversation_id: "01a2040a-4289-7932-aefc-548080a59748"`. The corrected brief relayed the explicit USER_VERIFIED attestation without claiming API verification, requested one DRAFT and forbade publishing, distribution, email, recruitment, synthetic responses and payment. The user explicitly approved this request and its one call was executed successfully. No further call is approved.

Exact complete tool/arguments: `.runtime/challenge/phase6/carbonx-first-party/followup-draft-mcp-request.json`. Manifest SHA-256: `3279f7e58c9a9a5e1f1d40e7018b3391de19507bb6f6bc043350ca20f54c23b6`; approval ID `4894dd8c-22a9-4707-a105-4c8dd47d0fba` is **CONSUMED**. Action `df23e00f-022b-4064-bffb-ef0fb9a184e9` is **SUCCEEDED**; no retry or new conversation occurred.

Authorized direct-payment ceiling in this proposal: zero. Existing subscription/credit/quota consumption is unverified; the call is not promised free. Stop at a payment or additional confirmation request. Do not publish, distribute, email, recruit, generate synthetic/test respondents, confirm charges or authorize payments. Paid retries: zero.

Draft deletion/undo has not been verified. If the call times out or its outcome is uncertain, preserve the result/IDs and reconcile before any further action; do not retry automatically.

Next gate: separately authorized full-instrument readback for the actual existing survey. Publication, invitations and any paid action require separate approvals. Do not repeat team confirmation solely because the API has no identity endpoint or recreate the existing draft.

## Single-person email test: preparation only

The sole user-supplied address is in ignored `.runtime/challenge/recipients.txt`; do not copy it into this document, logs or tool briefs before the specific list/send review. Intended sample: **one**, labelled `SINGLE_PERSON_INTEGRATION_TEST`, not independent research evidence. No remote email list, publication or invitation has been created. The actual draft now exists; field-level instrument verification remains the publication prerequisite.

Proposed template (local only):

```json
{
  "subject": "CarbonX: one-person survey integration test",
  "body": "Hi,\n\nPlease complete {{SURVEY_NAME}} once to test our survey and answer-retrieval integration. This is a single-person technical test, not a multi-respondent research study.\n\n{{SURVEY_LINK}}\n\nParticipation is voluntary. Please do not include personal or confidential information.\n\nThanks,\nCarbonX",
  "cta_text": "Complete the test"
}
```

The official template accepts `subject`, `body` and `cta_text`; the body requires
`{{SURVEY_LINK}}`. See [Flashpoint email distribution](https://docs.flashpoint.ai/distribute-email).

Planned operations, all blocked pending full-instrument verification and separate approvals:

1. Verify returned survey ID, DRAFT status and actual question IDs/types/prompts.
2. Present the exact existing-survey publication request via `tool_survey`, with
   actual survey/conversation IDs. Its agent's `publish_survey` operation changes
   the survey to ACTIVE and needs separate confirmation. Obtain specific user
   approval; do not combine publication with distribution.
3. After verified publication, review a single survey-scoped email list containing
   only the private allowlist and the template above. The supported agent workflow
   uses `create_email_list` then `send_email_list`; these are agent capabilities,
   not separately discovered top-level MCP tools. Obtain approval for the exact
   list/template and exactly one invitation before any remote list/send operation.
   Relay any additional provider confirmation instead of confirming automatically.
4. Do not send reminders or retry an uncertain send. Preserve returned recipient/
   invitation/status information and reconcile uncertainty before further work.
5. Once the invitation is verified, the user opens their personalized link,
   completes the questions in their own words and submits once. Do not fabricate
   completion or submit on their behalf.
6. With separately scoped read authorization, retrieve actual response/question
   data for the same survey, inspect completeness/pagination, save raw results
   privately and validate through Phase 3. Keep invited, submitted, retrieved,
   usable and question-level counts distinct; missing answers remain missing.
   The outcome is n=1 integration evidence only, not a multi-person finding.

Official documentation describes a default limit of 100 invitations/reminders per
team/week and 50 per survey/conversation. Actual account entitlement, remaining
quota and monetary cost are unverified; the creation response returned only token
usage. No additional payment is approved. Recheck actual preview/quota information
before asking approval; stop on any payment requirement or uncertain result.
