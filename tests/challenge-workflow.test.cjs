'use strict';
// TEST DATA integration contracts; no external business tool or LLM is invoked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createWorkflow } = require('../scripts/challenge-workflow.cjs');
const { createOfflineAdapter } = require('../scripts/challenge-offline.cjs');
const { surveyRequest, panelStatusRequest, validateToolRequest, normalizeAnswers } = require('../scripts/challenge-mcp.cjs');
const { OBJECTIVE, replayDecision, executeRound, simulatedAction, runDemo } = require('../scripts/challenge-run.cjs');
const { compareScenarios } = require('../scripts/challenge-context.cjs');
const responses = require('../challenge/fixtures/workflow-responses.json');
const decisions = Object.fromEntries(['plan-r1', 'analysis-r1', 'followup-r1', 'analysis-r2', 'final-r2'].map(name => [name, require('../challenge/fixtures/codex-decisions/' + name + '.json')]));

function setup(t, fixtureCase = 'valid', fixture = responses) {
  const root = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(root, 'carbonx-workflow-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), root);
    assert.ok(path.basename(directory).startsWith('carbonx-workflow-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const adapter = createOfflineAdapter({ directory, fixtureCase, fixture });
  const workflow = createWorkflow({ directory, adapter });
  return { directory, adapter, workflow };
}
function planned(t, fixtureCase = 'valid', fixture = responses) {
  const value = setup(t, fixtureCase, fixture);
  value.workflow.initialize({ objective: OBJECTIVE });
  replayDecision(value.workflow, decisions['plan-r1']);
  return value;
}
function supplied(workflow, kind, payload) {
  const input = workflow.checkpoint(kind);
  return { schemaVersion: 1, label: 'TEST DATA', origin: 'CODEX_AUTHORED', kind,
    inputHash: input.inputHash, basisHash: input.basisHash, payload };
}
function approved(workflow, kind = 'create_survey') {
  const request = workflow.requestAction(kind);
  workflow.approve({ approvalId: request.approval.id, requestHash: request.approval.requestHash, simulate: true });
  return request;
}

test('MCP boundary uses saved tool_survey/panel inputs and rejects invented names, fields and types', () => {
  assert.deepEqual(Object.keys(surveyRequest('Draft only').arguments), ['brief']);
  assert.equal(panelStatusRequest('TEST-job').arguments.job_id, 'TEST-job');
  assert.throws(() => validateToolRequest({ tool: 'publish_survey', arguments: {} }), { code: 'UNSUPPORTED_TOOL' });
  assert.throws(() => validateToolRequest({ tool: 'tool_survey', arguments: { brief: 'Read', response_id: 'x' } }), { code: 'INVALID_TOOL_INPUT' });
  assert.throws(() => validateToolRequest({ tool: 'tool_survey', arguments: { brief: 12 } }), { code: 'INVALID_TOOL_INPUT' });
  assert.throws(() => validateToolRequest({ tool: 'panel', arguments: { action: 'create_and_run' } }), { code: 'UNSUPPORTED_OPERATION' });
});

test('unknown live response envelopes and live adapters fail closed rather than being fabricated', () => {
  assert.throws(() => normalizeAnswers({ survey_id: 'real-looking' }, {}), { code: 'UNVERIFIED_RESPONSE_SCHEMA' });
  assert.throws(() => createWorkflow({ directory: '.', adapter: { mode: 'live' } }), { code: 'LIVE_ADAPTER_UNAVAILABLE' });
});

test('objective/model are actual inputs; a different objective cannot reuse the recorded plan', async t => {
  const { workflow } = setup(t);
  workflow.initialize({ objective: 'Understand a different product decision' });
  assert.deepEqual(workflow.checkpoint('PLAN').context, compareScenarios());
  assert.throws(() => replayDecision(workflow, decisions['plan-r1']), { code: 'REPLAY_INPUT_MISMATCH' });
  assert.throws(() => workflow.requestAction('create_survey'), { code: 'MISSING_PLAN' });
  const invalid = supplied(workflow, 'PLAN', decisions['plan-r1'].payload);
  invalid.inputHash = 'stale';
  assert.throws(() => workflow.submit(invalid), { code: 'STALE_AGENT_OUTPUT' });
});

test('pending authorization and wrong exact hash prevent dispatch', async t => {
  const { workflow, adapter } = planned(t, 'pending');
  const request = workflow.requestAction('create_survey');
  assert.equal(request.manifest.request.tool, 'tool_survey');
  assert.match(request.manifest.request.arguments.brief, /^Prepare a DRAFT survey/);
  await assert.rejects(() => workflow.execute(), { code: 'APPROVAL_REQUIRED' });
  assert.throws(() => workflow.approve({ approvalId: request.approval.id, requestHash: 'bad', simulate: true }), { code: 'APPROVAL_REQUIRED' });
  assert.equal(adapter.history().calls.length, 0);
  assert.equal(workflow.state().rounds[0].surveyId, null);
});

test('approval rejection pauses without a simulated or real action', async t => {
  const { workflow, adapter } = planned(t);
  const request = workflow.requestAction('create_survey');
  workflow.approve({ approvalId: request.approval.id, requestHash: request.approval.requestHash, simulate: true, reject: true });
  assert.equal(workflow.state().stage, 'PAUSED');
  assert.equal(workflow.state().pendingApproval, null);
  assert.equal(adapter.history().calls.length, 0);
  await assert.rejects(() => workflow.execute(), { code: 'APPROVAL_REQUIRED' });
});

test('null budget rejects positive charge through Phase 3 and payment dispatch is unsupported', async t => {
  const { workflow, adapter } = planned(t);
  assert.throws(() => workflow.requestAction('create_survey', { maxChargeUsd: '0.01' }), { code: 'SPENDING_NOT_AUTHORIZED' });
  assert.throws(() => workflow.requestAction('payment'), { code: 'PAYMENT_NOT_AUTHORIZED' });
  assert.equal(adapter.history().calls.length, 0);
  assert.equal(workflow.state().constraints.maxSpendingUsd, null);
});

test('two-round end-to-end run persists scoped evidence, actual fixture counts and a labeled recommendation', async t => {
  const { directory, adapter, workflow } = setup(t);
  const originalFetch = global.fetch;
  global.fetch = () => { throw Error('External fetch is forbidden in Phase 5'); };
  let result;
  try { result = await runDemo({ directory }); } finally { global.fetch = originalFetch; }
  assert.equal(result.stage, 'COMPLETED');
  assert.equal(result.realOperations, 0);
  assert.equal(result.realSpendingUsd, '0');
  assert.deepEqual(result.rounds.map(r => [r.complete, r.retrieved, r.usable]), [[6, 8, 4], [3, 3, 3]]);
  assert.equal(result.rounds[0].perQuestion.TEST_R1_change, 3);
  assert.equal(result.rounds[0].perQuestion.TEST_R1_finance, 4);
  assert.equal(adapter.history().calls.length, 6);
  assert.notEqual(result.rounds[0].surveyId, result.rounds[1].surveyId);
  const report = workflow.report();
  assert.equal(report.label, 'TEST DATA');
  assert.equal(report.reasoningDelivery, 'RECORDED_CODEX_REPLAY');
  assert.ok(report.supportRefs.every(ref => ref.startsWith('evidence:')));
  assert.match(fs.readFileSync(result.reportFile, 'utf8'), /not real research conclusions/);
  assert.ok(workflow.store.events().some(e => e.decision === 'CREATE_FOLLOWUP' && e.observedEvidenceRefs.length > 0));
  const followupPlanEvent = workflow.store.events().find(e => e.decision === 'AGENT_PLAN' && e.round === 2);
  const followupPlan = workflow.readArtifact(followupPlanEvent.observedEvidenceRefs[0]);
  for (const question of followupPlan.payload.questions) {
    assert.ok(followupPlan.questionEvidenceRefs[question.id].length > 0);
    assert.ok(followupPlan.questionEvidenceRefs[question.id].every(ref => Object.values(report.rounds[0].questionRefs).includes(ref)));
  }
  assert.throws(() => workflow.store.startRound2(), error => ['ROUND_LIMIT', 'RUN_NOT_ACTIVE'].includes(error.code));
  const journal = fs.readFileSync(path.join(directory, 'events.jsonl'), 'utf8');
  assert.doesNotMatch(journal, /annual expense|"answers"|"response_id"|TEST-recipient-/);
});

test('rerunning a completed directory returns the saved result without actions or journal changes', async t => {
  const { directory, adapter, workflow } = setup(t);
  await runDemo({ directory });
  const before = fs.readFileSync(path.join(directory, 'events.jsonl'), 'utf8');
  const again = await runDemo({ directory });
  assert.equal(again.runId, workflow.state().runId);
  assert.equal(adapter.history().calls.length, 6);
  assert.equal(fs.readFileSync(path.join(directory, 'events.jsonl'), 'utf8'), before);
  assert.throws(() => workflow.initialize({ objective: OBJECTIVE }), { code: 'RUN_EXISTS' });
});

test('saved survey/conversation/panel/run IDs survive reopen and duplicate creation/invites cannot dispatch', async t => {
  const { directory, adapter, workflow } = planned(t);
  await executeRound(workflow);
  const reopened = createWorkflow({ directory, adapter: createOfflineAdapter({ directory }) });
  assert.deepEqual(reopened.state().rounds, workflow.state().rounds);
  assert.throws(() => reopened.requestAction('create_survey'), error => ['INVALID_ACTION_STAGE', 'EXISTING_SURVEY'].includes(error.code));
  await assert.rejects(() => simulatedAction(reopened, 'email_send'), error => ['INVALID_ACTION_STAGE', 'DUPLICATE_ACTION'].includes(error.code));
  assert.equal(adapter.history().calls.filter(call => call.operation === 'email_send').length, 1);
  for (const call of adapter.history().calls.filter(c => c.operation !== 'create_survey')) {
    assert.equal(call.receipt.survey_id, reopened.state().rounds[0].surveyId);
    assert.equal(call.receipt.conversation_id, reopened.state().rounds[0].conversationId);
  }
});

test('12 COMPLETE but zero usable answers blocks analysis, follow-up and recommendation', async t => {
  const { directory, workflow } = setup(t, 'empty');
  const result = await runDemo({ directory, fixtureCase: 'empty' });
  assert.equal(result.stage, 'BLOCKED');
  assert.equal(result.rounds[0].evidenceStatus, 'INSUFFICIENT_EVIDENCE');
  assert.deepEqual([result.rounds[0].complete, result.rounds[0].retrieved, result.rounds[0].usable], [12, 12, 0]);
  assert.equal(result.recommendation, null);
  assert.equal(result.reportFile, null);
  assert.equal(workflow.state().followup, null);
  assert.throws(() => workflow.checkpoint('FOLLOWUP'));
  assert.throws(() => workflow.store.startRound2());
  assert.match(result.blocker.message, /question-level answers/);
});

test('changed fixture values cannot trigger replay of an old analysis or universal Round 2', async t => {
  const fixture = structuredClone(responses);
  fixture.rounds['1'].records[0].answers.finance = 'I understand discounted project value and its units.';
  const { workflow } = planned(t, 'valid', fixture);
  await executeRound(workflow);
  assert.throws(() => replayDecision(workflow, decisions['analysis-r1']), { code: 'REPLAY_INPUT_MISMATCH' });
  assert.equal(workflow.state().activeRound, 1);
  assert.equal(workflow.state().followup, null);
});

test('Round 2 requires each authored question to cite actual positive-denominator Round 1 evidence', async t => {
  const { workflow } = planned(t);
  await executeRound(workflow); replayDecision(workflow, decisions['analysis-r1']);
  const payload = structuredClone(decisions['followup-r1'].payload);
  payload.plan.questions[0].support = [{ round: 1, questionId: 'not-retrieved' }];
  assert.throws(() => workflow.submit(supplied(workflow, 'FOLLOWUP', payload)), { code: 'MISSING_EVIDENCE' });
  payload.plan.questions[0].support = [];
  assert.throws(() => workflow.submit(supplied(workflow, 'FOLLOWUP', payload)), { code: 'MISSING_EVIDENCE' });
  assert.equal(workflow.state().activeRound, 1);
});

test('an explicit evidence-backed STOP can finish after one round without creating a second survey', async t => {
  const { workflow, adapter } = planned(t);
  await executeRound(workflow); replayDecision(workflow, decisions['analysis-r1']);
  workflow.submit(supplied(workflow, 'FOLLOWUP', { decision: 'STOP', reasoningSummary: 'TEST DATA contract case: sufficient for a bounded provisional recommendation; report remaining uncertainty instead of following up.', support: [{ round: 1, questionId: 'finance' }], plan: null }));
  const final = structuredClone(decisions['final-r2'].payload);
  final.recommendation = 'TEST DATA only: provisionally explain NPV sign/time units first, subject to the observed carbon/no-change counterevidence and untested real-world effect.';
  final.support = [{ round: 1, questionId: 'finance' }];
  workflow.submit(supplied(workflow, 'FINAL', final));
  assert.equal(workflow.state().stage, 'COMPLETED');
  assert.equal(workflow.state().rounds.length, 1);
  assert.equal(adapter.history().calls.filter(c => c.operation === 'create_survey').length, 1);
});

test('known creation non-execution remains interrupted and needs fresh approval before any retry', async t => {
  const { workflow, adapter } = planned(t, 'create-fail');
  approved(workflow); await workflow.execute();
  assert.equal(workflow.state().stage, 'UNKNOWN_REMOTE_OUTCOME');
  assert.equal(workflow.state().actions[0].status, 'NOT_EXECUTED');
  assert.equal(workflow.state().rounds[0].surveyId, null);
  workflow.resume();
  await assert.rejects(() => workflow.execute(), { code: 'APPROVAL_REQUIRED' });
  assert.equal(adapter.history().calls.length, 1);
});

test('unknown creation outcome cannot resume or be re-created without actual reconciliation', async t => {
  const { workflow, adapter } = planned(t, 'unknown');
  approved(workflow); await workflow.execute(); workflow.recover();
  assert.throws(() => workflow.resume(), { code: 'UNRESOLVED_ACTION' });
  await assert.rejects(() => workflow.reconcile(workflow.state().actions[0].id), { code: 'UNRESOLVED_ACTION' });
  assert.throws(() => workflow.requestAction('create_survey'));
  assert.equal(adapter.history().calls.length, 1);
});

test('process restart after dispatch preserves intent and reconciles the same receipt without replay', async t => {
  const { directory, workflow } = planned(t);
  approved(workflow);
  const moduleRoot = path.resolve(__dirname, '../scripts');
  const script = 'const {createWorkflow}=require(process.argv[1]+"/challenge-workflow.cjs"); const {createOfflineAdapter}=require(process.argv[1]+"/challenge-offline.cjs"); const directory=process.argv[2]; const workflow=createWorkflow({directory,adapter:createOfflineAdapter({directory})}); (async()=>{try {await workflow.execute({interruptAfterDispatch:true});} catch(e) {if(e.code!=="SIMULATED_PROCESS_INTERRUPTION")throw e;process.exit(23);}})();';
  assert.throws(() => execFileSync(process.execPath, ['-e', script, moduleRoot, directory], { stdio: 'pipe' }), error => error.status === 23);
  const adapter = createOfflineAdapter({ directory });
  const reopened = createWorkflow({ directory, adapter });
  assert.equal(reopened.state().actions[0].status, 'IN_FLIGHT');
  reopened.recover();
  assert.equal(reopened.state().stage, 'UNKNOWN_REMOTE_OUTCOME');
  assert.throws(() => reopened.resume(), { code: 'UNRESOLVED_ACTION' });
  await reopened.reconcile(reopened.state().actions[0].id);
  reopened.resume();
  assert.equal(reopened.state().stage, 'AWAITING_APPROVAL');
  assert.equal(reopened.state().rounds[0].surveyId, 'TEST-survey-r1');
  assert.equal(reopened.state().rounds[0].conversationId, 'TEST-conversation-r1');
  assert.equal(adapter.history().calls.length, 1);
});

test('mock 402 stops without a signature, payment or automatic retry', async t => {
  const { workflow, adapter } = planned(t, 'payment-required');
  approved(workflow); await workflow.execute();
  const receipt = adapter.history().calls[0].receipt;
  assert.equal(receipt.httpStatus, 402);
  assert.equal(receipt.paymentSignatureCreated, false);
  assert.equal(workflow.state().actions[0].status, 'NOT_EXECUTED');
  assert.equal(adapter.history().calls.length, 1);
});

test('failed retrieval leaves a blocker and does not invent answers or recreate the survey', async t => {
  const { workflow, adapter } = planned(t, 'retrieval-fail');
  await executeRound(workflow);
  assert.equal(workflow.state().stage, 'BLOCKED');
  assert.match(workflow.state().lastError.message, /RETRIEVAL_FAILED/);
  assert.equal(workflow.state().rounds[0].evidence, null);
  assert.equal(adapter.history().calls.length, 3);
  assert.equal(workflow.report(), null);
});

test('invalid evidence scope blocks normalization and cannot become a finding', async t => {
  const { workflow } = planned(t, 'invalid');
  await executeRound(workflow);
  assert.equal(workflow.state().stage, 'BLOCKED');
  assert.match(workflow.state().lastError.message, /EVIDENCE_SCOPE_MISMATCH/);
  assert.equal(workflow.state().rounds[0].usableAnswerRecords, null);
});

test('delayed responses require a separate explicit read and no automatic polling/reminder', async t => {
  const { workflow, adapter } = planned(t, 'delayed');
  await executeRound(workflow);
  assert.equal(workflow.state().stage, 'AWAITING_RESPONSES');
  assert.equal(adapter.history().reads, 1);
  assert.equal(adapter.history().calls.length, 3);
  await workflow.retrieve();
  assert.equal(workflow.state().stage, 'ANSWERS_VALIDATED');
  assert.equal(adapter.history().reads, 2);
});

test('simulator configuration and immutable decision artifacts cannot silently change on resume', async t => {
  const { directory, workflow } = planned(t);
  approved(workflow); await workflow.execute();
  assert.throws(() => createOfflineAdapter({ directory, fixtureCase: 'empty' }), { code: 'FIXTURE_CHANGED' });
  const ref = workflow.store.events().find(e => e.decision === 'AGENT_PLAN').observedEvidenceRefs[0];
  const file = path.join(directory, ref.slice('file:'.length));
  const altered = workflow.readArtifact(ref);
  altered.payload.interpretation = 'Changed without a new decision.';
  fs.writeFileSync(file, JSON.stringify(altered));
  assert.throws(() => workflow.checkpoint('FINAL'), error => ['INVALID_AGENT_STAGE', 'CORRUPT_ARTIFACT'].includes(error.code));
  assert.throws(() => workflow.readArtifact(ref), { code: 'CORRUPT_ARTIFACT' });
});

test('known-job panel status is only a labeled mock progress receipt, never answer evidence', async t => {
  const { adapter } = setup(t);
  const status = adapter.status(panelStatusRequest('TEST-job', 'TEST-conversation-r1'));
  assert.equal(status.label, 'TEST DATA');
  assert.equal(status.mock, true);
  assert.equal(status.job_id, 'TEST-job');
  assert.throws(() => normalizeAnswers(status, {}), { code: 'INVALID_EVIDENCE' });
});

test('restart finishes a persisted Codex analysis without redispatching business tools', async t => {
  const { directory, workflow, adapter } = planned(t);
  await executeRound(workflow);
  const transition = workflow.store.transition;
  workflow.store.transition = (stage, options) => {
    if (stage === 'ROUND_1_ANALYZED') throw Object.assign(Error('TEST interruption'), { code: 'TEST_INTERRUPTION' });
    return transition(stage, options);
  };
  assert.throws(() => replayDecision(workflow, decisions['analysis-r1']), { code: 'TEST_INTERRUPTION' });
  const reopened = createWorkflow({ directory, adapter });
  reopened.recover(); reopened.resume();
  assert.equal(reopened.state().stage, 'ROUND_1_ANALYZED');
  assert.equal(adapter.history().calls.length, 3);
});

test('restart finishes a persisted follow-up decision and restores its exact new question plan', async t => {
  const { directory, workflow, adapter } = planned(t);
  await executeRound(workflow); replayDecision(workflow, decisions['analysis-r1']);
  const transition = workflow.store.transition;
  workflow.store.transition = (stage, options) => {
    if (stage === 'FOLLOWUP_DECISION') throw Object.assign(Error('TEST interruption'), { code: 'TEST_INTERRUPTION' });
    return transition(stage, options);
  };
  assert.throws(() => replayDecision(workflow, decisions['followup-r1']), { code: 'TEST_INTERRUPTION' });
  const reopened = createWorkflow({ directory, adapter });
  reopened.recover(); reopened.resume();
  assert.equal(reopened.state().activeRound, 2);
  assert.equal(reopened.state().stage, 'DRAFT_PLAN');
  assert.equal(reopened.state().rounds[1].surveyId, null);
  const request = reopened.requestAction('create_survey');
  assert.match(request.manifest.request.arguments.brief, /npv-explanation/);
  assert.equal(adapter.history().calls.length, 3);
});

test('interrupted report acknowledgement reuses the saved report and never repeats tools', async t => {
  const { directory, workflow, adapter } = planned(t);
  await executeRound(workflow); replayDecision(workflow, decisions['analysis-r1']);
  workflow.submit(supplied(workflow, 'FOLLOWUP', { decision: 'STOP', reasoningSummary: 'TEST DATA: stop with a provisional interpretation and explicit limits.', support: [{ round: 1, questionId: 'finance' }], plan: null }));
  const final = structuredClone(decisions['final-r2'].payload);
  final.recommendation = 'TEST DATA: explain NPV units and sign provisionally; no actual UI improvement is established.';
  final.support = [{ round: 1, questionId: 'finance' }];
  const transition = workflow.store.transition;
  workflow.store.transition = (stage, options) => {
    if (stage === 'COMPLETED') throw Object.assign(Error('TEST interruption'), { code: 'TEST_INTERRUPTION' });
    return transition(stage, options);
  };
  assert.throws(() => workflow.submit(supplied(workflow, 'FINAL', final)), { code: 'TEST_INTERRUPTION' });
  const saved = fs.readFileSync(path.join(directory, 'report.md'), 'utf8');
  const reopened = createWorkflow({ directory, adapter });
  reopened.recover(); reopened.resume();
  assert.equal(reopened.state().stage, 'COMPLETED');
  assert.equal(fs.readFileSync(path.join(directory, 'report.md'), 'utf8'), saved);
  assert.equal(adapter.history().calls.length, 3);
});

test('replaceable asynchronous adapter preserves approval-before-dispatch and normalization', async t => {
  const { directory, adapter } = setup(t);
  const asynchronous = { ...adapter,
    execute: async input => adapter.execute(input),
    retrieve: async input => adapter.retrieve(input),
    inspectAction: async actionId => adapter.inspectAction(actionId) };
  const workflow = createWorkflow({ directory, adapter: asynchronous });
  workflow.initialize({ objective: OBJECTIVE }); replayDecision(workflow, decisions['plan-r1']);
  await executeRound(workflow);
  assert.equal(workflow.state().stage, 'ANSWERS_VALIDATED');
  assert.equal(workflow.state().rounds[0].usableAnswerRecords, 4);
  assert.equal(adapter.history().calls.length, 3);
});

test('documented CLI emits a reproducible JSON result and refuses to overwrite an incomplete run', async t => {
  const { directory } = setup(t, 'empty');
  const cli = path.resolve(__dirname, '../scripts/challenge-run.cjs');
  const args = [cli, 'demo', '--dir', directory, '--case', 'empty'];
  const result = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
  assert.equal(result.stage, 'BLOCKED');
  assert.equal(result.rounds[0].evidenceStatus, 'INSUFFICIENT_EVIDENCE');
  assert.throws(() => execFileSync(process.execPath, args, { stdio: 'pipe' }), error => error.status === 1 && /RUN_EXISTS_USE_RESUME/.test(error.stderr.toString()));
});
