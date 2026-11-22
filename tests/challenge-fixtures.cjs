'use strict';
// OFFLINE TEST FIXTURES ONLY. No historical survey IDs or authentic answers.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const { createStateStore } = require('../scripts/challenge-state.cjs');
const { digest } = require('../scripts/challenge-safety.cjs');
const ids = round => ({ surveyId: 'fixture-survey-' + round, conversationId: 'fixture-conversation-' + round,
  panelId: 'fixture-panel-' + round, remoteRunId: 'fixture-provider-run-' + round });
function evidence(extra = {}) {
  return { schemaVersion: 1, sourceType: 'test_fixture', round: 1, surveyId: ids(1).surveyId,
    conversationId: ids(1).conversationId, panelId: ids(1).panelId, runId: ids(1).remoteRunId,
    retrievalSource: 'fixture:round-1', retrievedAt: '2026-11-22T00:00:00.000Z', completedRecords: 2,
    questionnaire: { Q1: { type: 'select/single', options: { 1: 'Fixture A', 2: 'Fixture B' } }, Q2: { type: 'text' } },
    responses: [
      { response_id: 'fixture-record-a', run_id: ids(1).remoteRunId, status: 'COMPLETE', data: { Q1: 1, Q2: 'Fixture explanation A' } },
      { response_id: 'fixture-record-b', run_id: ids(1).remoteRunId, status: 'COMPLETE', data: { Q1: '2', Q2: 'Fixture explanation B' } }
    ], ...extra };
}
function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'carbonx-phase3-'));
  t.after(() => {
    const target = fs.realpathSync(directory), parent = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(target).toLowerCase(), parent.toLowerCase());
    assert.ok(path.basename(target).startsWith('carbonx-phase3-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const store = createStateStore({ directory, ...options });
  store.initialize({ objective: 'OFFLINE FIXTURE: evaluate interface clarity', sourceType: 'test_fixture', ...(options.run || {}) });
  return store;
}
function plan(store) {
  store.transition('MODEL_CONTEXT_READY', { modelContextRef: 'fixture:model-context' });
  return store.transition('DRAFT_PLAN');
}
function approve(store, kind, extra = {}) {
  const requestHash = digest({ kind, round: store.load().activeRound, fixture: true, ...extra });
  const pending = store.requestApproval({ kind, requestHash, scopeDescription: 'OFFLINE FIXTURE only', ...extra }).pendingApproval;
  store.grantApproval(pending.id, { confirmed: true, sourceRef: 'operator:fixture-approval' });
  return { kind, requestHash, approvalId: pending.id };
}
function success(store, kind, extra = {}) {
  const started = store.beginAction(approve(store, kind, extra));
  return store.finishAction(started.actions.at(-1).id, { outcome: 'SUCCEEDED', sourceRef: 'fixture:receipt' });
}
function awaiting(store) {
  const round = store.load().activeRound;
  if (store.load().stage === 'NEW') plan(store);
  store.bindRemoteIds(ids(round), 'fixture:returned-ids');
  store.transition('DRAFT_SURVEY_CREATED'); store.transition('AWAITING_APPROVAL');
  success(store, 'publish'); store.transition('PUBLISHED');
  const recipientsHash = digest(['fixture-consenting-recipient-a', 'fixture-consenting-recipient-b']);
  store.recordConsent({ recipientsHash, eligibleCount: 2, sourceRef: 'fixture:consent-file' });
  success(store, 'email_send', { recipientsHash, recipientCount: 2 });
  store.transition('INVITATIONS_SENT'); return store.transition('AWAITING_RESPONSES');
}
function analyzed(store, data = evidence()) {
  awaiting(store); store.attachEvidence(data); store.transition('RESPONSES_RETRIEVED'); store.transition('ANSWERS_VALIDATED');
  return store.transition(store.load().activeRound === 1 ? 'ROUND_1_ANALYZED' : 'ROUND_2_ANALYZED');
}
module.exports = { ids, evidence, fixture, plan, approve, success, awaiting, analyzed };
