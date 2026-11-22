# CarbonX exact survey and publication review

Current checkpoint: **ACTIVE v1/revision17; one invitation submitted**. Actual
publication: 12:25:13 ET; actual send count: one at 12:28:20 ET, sending/queued,
not confirmed delivered. The user explicitly authorized both operations and
accepted no quotas. The proposal below is historical, not a new approval request.
See IMPLEMENTATION_STATUS.md for actual receipts and AWAITING_RESPONSES state.
Do not publish or send again.

Verified November 22, 2026 (America/New_York), by ONE explicitly authorized read-only `mcp__flashpoint__tool_survey` call. No publication, edits, invitations, recruitment, test data or payments were performed.

## Existing survey

- Actual title: **CarbonX steel results: first-time understanding and trust**.
- Survey ID: `b579f71c-e720-4d34-8513-1ea2f468239d`.
- Conversation ID: `01a2040a-4289-7932-aefc-548080a59748`, preserved in the MCP envelope. The document getter itself does not return conversation IDs.
- Actual status: `draft`; stage: `design`; version: **1**; revision: **17**; language: `en`.
- Two blocks, five open-ended answer questions and two non-answer transition items (seven total items).
- Intended OAuth team: **CarbonX, USER_VERIFIED** from the user's explicit team-picker confirmation. Independent API team verification is false; no team ID was returned.

## Complete actual respondent content

These full strings were returned in the existing survey document and match the reviewed intended plan exactly. Earlier truncated creation-table prompts were summaries; their suffixes are present in the actual fields.

### Introduction

ID: `1abd96b1-989c-470f-a8b6-d594ba28e601`; type: `transition`.

Participation is voluntary. You may skip a question or say you are unsure. Please do not include names, contact details or confidential information. We are studying how this explanation reads to a first-time user, not testing engineering expertise.

### Stimulus

ID: `facad709-c3ac-41de-b681-a28c92be1e45`; type: `transition`.

CarbonX compares illustrative steel-plant decarbonization scenarios. In the 2050 model snapshot, Baseline net emissions are 2.316 Mt CO2/year and Combined net emissions are 0.996 Mt CO2/year, a modeled reduction of 1.320 Mt CO2/year. Combined captures 0.909 Mt CO2/year; capture and avoided emissions are different quantities. Modeled capital investment is 796.4 million constant 2025 USD. NPV is -134.6 million constant 2025 USD, representing discounted net cash flow over the modeled period, not an annual expense. These depend on scenario assumptions and are not measured plant results or investment advice. Permanent CO2 storage is not established by this model. This study asks about understanding this summary; you do not need industrial investment expertise.

### Q1

ID: `c29c6fa7-27bb-4d03-9380-9a2d220424c5`; type: `text/single`.

Using your own words, what would you tell someone who has not seen this summary about the trade-off? Two or three sentences are enough; it is fine to say what is unclear.

### Q2

ID: `11afa662-4b8f-497c-868a-64ddf90804ec`; type: `text/single`.

Which one figure would you choose to support your explanation, and what does it mean to you? Include the units or time period if you can; uncertainty is a valid answer.

### Q3

ID: `443937b9-ea8d-4514-a5a0-554fe33d34b3`; type: `text/single`.

What, if anything, would you need to know before you felt comfortable repeating these results to someone else? Nothing additional is a valid answer.

### Q4

ID: `0283aa00-51de-481a-882f-1bef436e2f98`; type: `text/single`.

What, if anything, could someone easily misunderstand when explaining this summary? Please describe one example, or say that none comes to mind.

### Q5

ID: `a67e68b6-0cd5-46a3-9a3c-5e8f55cd95f5`; type: `text/single`.

What one change or addition, if any, would most help you explain this summary clearly, and why? No change is a valid answer.

All five questions return `optout.allowed: true` and `I am not sure / prefer not to answer`. Their option, skip and validation arrays are empty. No separate description or explicit required flag was returned; do not infer such fields are empty/false. Question-level instruction/display-condition fields were marked unavailable by the agent. The complete actual text includes the intended explanatory suffixes without relying on those missing fields.

## Participant/content review

The study can be answered from the supplied introduction and stimulus, without the Carbon Twin app, previous CarbonX knowledge or industrial investment expertise. Questions ask for the participant's explanation, uncertainty and suggestions. This is an analyst's text review, not empirical proof of novice comprehension or a rendered UI test.

The opening explicitly labels the scenarios illustrative; modeled quantities and the assumption/not-measured/not-investment-advice disclaimer cover all displayed figures. Annual CO2 and constant-2025-USD units are retained; capture and avoidance are separated; NPV is explained as discounted net cash flow rather than annual expense; permanent storage is not claimed. Minor readability caveat: `Mt CO2/year` is not expanded as million tonnes per year. No change was made or authorized in this read-only step.

## Publication proposal - PENDING, not authorized

Publish **only this existing version 1 / revision 17 draft**. Do not edit, create another survey, distribute, send even one invitation, recruit, generate respondents/test data, approve payments or retry. Verify title/version/revision before publication; stop if changed. Reviewed document SHA-256: `e40205de2162723fa85f812884cb4e4ec60a90ccc54e9b7a1fe37deed303c2fd`.

Approval ID: `371df0ba-ff51-4486-81a6-81b6d528b380`.
Manifest SHA-256: `8b595441dcc881b225b77445294a265b94c3ccf37a0d9f8662634cf9b27b22c9`.
Business calls proposed: **one**; paid retries: **zero**; additional payment ceiling: **USD 0**. No publication action/claim has been created. User approval of publication would not approve an automatic second confirmation call.

Exact runtime tool: `mcp__flashpoint__tool_survey`. Exact MCP name/arguments:

```json
{
  "tool": "tool_survey",
  "arguments": {
    "brief": "Publish only this reviewed existing survey in the verified team CarbonX (USER_VERIFIED, not independently API-verified). Do not create or edit a survey, send emails/invitations, distribute, recruit, generate responses/test data, authorize payment, confirm charges or perform additional work. Additional payment authorization is zero. Stop on a payment requirement or any additional provider confirmation; do not automatically relay confirm or retry. Before publishing, verify the existing draft still has the reviewed title \"CarbonX steel results: first-time understanding and trust\", version 1 and revision 17. Stop if it differs; do not fix or replace it. Reviewed document SHA-256: e40205de2162723fa85f812884cb4e4ec60a90ccc54e9b7a1fe37deed303c2fd.",
    "survey_id": "b579f71c-e720-4d34-8513-1ea2f468239d",
    "conversation_id": "01a2040a-4289-7932-aefc-548080a59748"
  }
}
```

Publication changes DRAFT to ACTIVE, making the survey available through open distribution channels. It does not send invitations. Official documentation supports pausing new arrivals while people already responding may finish, resuming and permanently completing collection. No return-to-never-published state is established by the official state diagram; the worker reports publication cannot be undone. These reversibility statements were not exercised. Pause/complete/delete would each need separate authorization. See [official lifecycle](https://docs.flashpoint.ai/surveys-lifecycle).

The agent requires a same-conversation confirmation before publishing. If the proposed call returns a confirmation request, preserve it and ask the user; do not automatically call again or send `confirm`. See [official MCP confirmation pattern](https://docs.flashpoint.ai/api-reference#confirm-pattern).

## Billing and test scope

The read reports no additional payment required and no charged action. It returned input 11, output 3,605, cache creation 118,311 and cache read 116,069 tokens. No monetary amount, remaining subscription credits or invitation allowance was returned. Empty survey quotas are design metadata, not available billing quota. Publication cost/entitlement remains unverified. Stop on any payment or additional-charge requirement; OAuth does not authorize a wallet transaction.

One user-owned recipient is prepared privately, with no address in this document. Sending remains separately approved. Eventual answers must be labelled **SINGLE_PERSON_INTEGRATION_TEST, n=1**, not multi-respondent research evidence.

## Private evidence

Run: `.runtime/challenge/phase6/carbonx-first-party/`.
Original read: `live-handoff/6218ca7f-7293-4e72-8eac-04aed9d4202a.raw.json`.
Raw SHA-256: `1315060090a74657c1e888f422749d94070ee475c9cc54f5997084c16217795b`.
Full document: `verified-survey-document.json`; reviewed mapping: `instrument-read-mapping-profile.json`; content/unknown-field review: `instrument-verification-review.json`; exact proposed arguments: `publication-mcp-request.json`; publication manifest and pending approval summary are saved privately.

Existing creation receipts are immutable. The new `INSTRUMENT_VERIFIED` event points to the actual inspection receipt and provides the effective question map and version/hash. No survey answers or findings exist.
