'use strict';
// OFFLINE PLANNING contract checks. No respondents or remote outcomes are created.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { compareScenarios } = require('../scripts/challenge-context.cjs');
const { createStateStore } = require('../scripts/challenge-state.cjs');
const { digest } = require('../scripts/challenge-safety.cjs');
const plan = require('../challenge/examples/offline-plan.json');

test('planning example is grounded in recalculated model context, preserving provenance and unknowns', () => {
  assert.deepEqual(plan.context, compareScenarios());
  for (const context of plan.context.scenarios) {
    assert.equal(context.source, 'carbon-twin-model');
    assert.equal(context.dataQuality, 'illustrative');
    assert.ok(context.modelVersion && context.inputHash && context.provenance.engineSource);
    assert.equal(context.metrics.permanentStoredMtCO2PerYear, null);
  }
  const combined = plan.context.scenarios[1];
  assert.notEqual(combined.metrics.avoidedMtCO2PerYear, combined.metrics.financeAvoidedMtCO2PerYear);
  assert.ok(combined.metrics.avoidedMtCO2PerYear > 0 && combined.metrics.npvMillionUsd < 0);
  assert.equal(plan.knowledgeBoundaries.participantOpinions, null);
});

test('first-round proposal has traceable decision uses and no assumed provider question IDs', () => {
  const uncertaintyIds = new Set(plan.uncertainties.map(u => u.id));
  assert.equal(uncertaintyIds.size, plan.uncertainties.length);
  assert.ok(plan.uncertainties.every(u => u.status === 'UNTESTED' && u.question && u.whyItMatters));
  const questionIds = new Set();
  const covered = new Set();
  for (const question of plan.round1.questions) {
    assert.ok(question.planningId && !questionIds.has(question.planningId));
    questionIds.add(question.planningId);
    assert.equal(question.type, 'text');
    assert.ok(question.prompt && question.rationale && question.decisionUse);
    assert.ok(question.uncertaintyIds.length > 0);
    for (const id of question.uncertaintyIds) {
      assert.ok(uncertaintyIds.has(id), 'Question must address a declared uncertainty');
      covered.add(id);
    }
  }
  assert.deepEqual(covered, uncertaintyIds);
  assert.equal(plan.round1.providerQuestionIds, null);
  assert.equal(plan.exposure.status, 'PROPOSED_NOT_FIELDED');
  assert.equal(plan.participants.consentVerified, false);
  assert.equal(plan.participants.recipientListVerified, false);
  assert.equal(plan.participants.recruitedCount, null);
});

test('planning does not grant external permission, invent evidence or predesign Round 2', () => {
  assert.equal(plan.mode, 'OFFLINE_PLANNING');
  assert.equal(plan.execution.localStateSourceType, 'test_fixture');
  assert.equal(plan.execution.intendedLiveSourceType, 'real_first_party');
  assert.equal(plan.execution.maxRounds, 2);
  assert.equal(plan.execution.maxSpendingUsd, null);
  assert.equal(plan.execution.externalActionsAuthorized, false);
  assert.deepEqual(plan.execution.remoteOperations, []);
  assert.deepEqual(plan.execution.findings, []);
  for (const key of ['surveyId', 'conversationId', 'panelId', 'remoteRunId', 'invitedCount',
    'completedRecords', 'retrievedAnswerRecords', 'usableAnswerRecords', 'responseEvidence', 'recommendation']) {
    assert.equal(plan.execution[key], null, key + ' must remain unknown in a planning-only example');
  }
  assert.equal(plan.analysisPlan.status, 'PROPOSED_NOT_EXECUTED');
  assert.equal(plan.round2.questions, null);
  assert.deepEqual(plan.round2.observedEvidenceRefs, []);
  assert.ok(plan.round2.requiredBeforeDesign.length > 0);
  assert.ok(plan.execution.approvalsRequiredLater.length > 0);
});

test('documented planning workflow persists actual context and plan references and resumes without remote actions', t => {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'carbonx-policy-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), temporaryRoot);
    assert.ok(path.basename(directory).startsWith('carbonx-policy-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const context = compareScenarios();
  fs.writeFileSync(path.join(directory, 'model-context.json'), JSON.stringify(context));
  fs.writeFileSync(path.join(directory, 'plan.json'), JSON.stringify(plan));
  const contextRef = 'model:' + context.scenarios[1].inputHash;
  const planRef = 'plan:' + digest(plan);
  const store = createStateStore({ directory });
  const initialized = store.initialize({ objective: plan.objective,
    sourceType: plan.execution.localStateSourceType, maxRounds: plan.execution.maxRounds,
    maxSpendingUsd: plan.execution.maxSpendingUsd });
  store.transition('MODEL_CONTEXT_READY', { modelContextRef: contextRef, reason: 'Loaded the actual local model context.' });
  store.transition('DRAFT_PLAN', { reason: 'Authored an objective-specific offline plan.' });
  store.recordDecision({ decision: 'PLAN_ROUND_1', reasoningSummary: 'Plan unaided comprehension and trade-off tasks, followed by scoped probes. No responses are available.',
    observedEvidenceRefs: [contextRef, planRef], selectedTool: null, outcome: 'OFFLINE_PLANNING', nextAction: 'Stop at Phase 4; no external action is authorized.' });
  const reopened = createStateStore({ directory });
  reopened.recover();
  const resumed = reopened.load();
  assert.equal(resumed.runId, initialized.runId);
  assert.equal(resumed.objective, plan.objective);
  assert.equal(resumed.stage, 'DRAFT_PLAN');
  assert.equal(resumed.modelContextRef, contextRef);
  assert.equal(resumed.activeRound, 1);
  assert.equal(resumed.pendingApproval, null);
  assert.deepEqual(resumed.actions, []);
  assert.deepEqual(resumed.approvalHistory, []);
  assert.equal(resumed.followup, null);
  assert.equal(resumed.rounds[0].evidence, null);
  for (const key of ['surveyId', 'conversationId', 'panelId', 'remoteRunId', 'invitedCount',
    'completedRecords', 'retrievedAnswerRecords', 'usableAnswerRecords']) assert.equal(resumed.rounds[0][key], null);
  const decision = reopened.events().find(event => event.decision === 'PLAN_ROUND_1');
  assert.deepEqual(decision.observedEvidenceRefs, [contextRef, planRef]);
  assert.equal(decision.selectedTool, null);
  assert.equal(decision.outcome, 'OFFLINE_PLANNING');
  assert.equal(Object.hasOwn(decision, 'records'), false);
  assert.equal(Object.hasOwn(decision, 'answers'), false);
  assert.throws(() => reopened.initialize({ objective: plan.objective }), { code: 'RUN_EXISTS' });
});
