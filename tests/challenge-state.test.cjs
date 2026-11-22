'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { createStateStore } = require('../scripts/challenge-state.cjs');
const { digest, redact } = require('../scripts/challenge-safety.cjs');
const { ids, evidence, fixture, plan, approve, success, awaiting, analyzed } = require('./challenge-fixtures.cjs');
const stateModule = path.resolve(__dirname, '../scripts/challenge-state.cjs');
const refs = store => store.load().rounds[0].evidence.questionEvidenceRefs;
function approvalStage(store) {
  plan(store); store.bindRemoteIds(ids(1), 'fixture:returned-ids');
  store.transition('DRAFT_SURVEY_CREATED'); store.transition('AWAITING_APPROVAL');
}

test('initialization creates a unique private run, null counts/budget, and cannot overwrite it', t => {
  const store = fixture(t), state = store.load(), another = fixture(t).load();
  assert.match(state.runId, /^[0-9a-f-]{36}$/); assert.notEqual(state.runId, another.runId);
  assert.equal(state.stage, 'NEW'); assert.equal(state.constraints.maxRounds, 2); assert.equal(state.constraints.maxSpendingUsd, null);
  assert.equal(state.rounds[0].completedRecords, null); assert.equal(state.rounds[0].surveyId, null);
  assert.equal(state.pendingJournal, null); assert.ok(Number.isFinite(Date.parse(state.updatedAt)));
  assert.throws(() => store.initialize({ objective: 'Overwrite' }), { code: 'RUN_EXISTS' });
  assert.deepEqual(store.load(), state); assert.equal(store.events().length, 1);
});

test('atomic persistence reloads IDs without temporary files or mutable caller aliases', t => {
  let tick = 0;
  const store = fixture(t, { now: () => new Date(1800000000000 + tick++ * 1000).toISOString() });
  const first = store.load(); plan(store); store.bindRemoteIds(ids(1), 'fixture:returned-ids');
  const reloaded = createStateStore({ directory: store.directory }).load();
  assert.deepEqual(reloaded.rounds[0].surveyId, ids(1).surveyId); assert.equal(reloaded.rounds[0].panelId, ids(1).panelId);
  assert.notEqual(reloaded.updatedAt, first.updatedAt); reloaded.rounds[0].surveyId = 'edited-copy';
  assert.equal(store.load().rounds[0].surveyId, ids(1).surveyId);
  assert.throws(() => store.bindRemoteIds({ surveyId: 'different' }, 'fixture:conflict'), { code: 'REMOTE_ID_CONFLICT' });
  assert.ok(!fs.readdirSync(store.directory).some(name => /\.tmp$|\.lock$/.test(name)));
});

test('illegal stage jumps and unconfirmed publication leave state unchanged', t => {
  const store = fixture(t), initial = store.load();
  for (const stage of ['COMPLETED', 'ROUND_1_ANALYZED', 'UNKNOWN_STAGE']) assert.throws(() => store.transition(stage));
  assert.deepEqual(store.load(), initial);
  plan(store); assert.throws(() => store.transition('DRAFT_SURVEY_CREATED'), { code: 'MISSING_REMOTE_IDS' });
  store.bindRemoteIds(ids(1), 'fixture:ids'); store.transition('DRAFT_SURVEY_CREATED'); store.transition('AWAITING_APPROVAL');
  assert.throws(() => store.transition('PUBLISHED'), { code: 'UNCONFIRMED_ACTION' });
});

test('pending approval requires explicit confirmation and binds the exact operation hash', t => {
  const store = fixture(t); approvalStage(store);
  const hash = digest('fixture-publication');
  const pending = store.requestApproval({ kind: 'publish', requestHash: hash, scopeDescription: 'Offline publication fixture' }).pendingApproval;
  const reopened = createStateStore({ directory: store.directory });
  assert.equal(reopened.load().pendingApproval.status, 'PENDING');
  assert.throws(() => reopened.beginAction({ kind: 'publish', requestHash: hash, approvalId: pending.id }), { code: 'APPROVAL_REQUIRED' });
  assert.throws(() => reopened.grantApproval(pending.id, { confirmed: false, sourceRef: 'operator:fixture' }), { code: 'APPROVAL_REQUIRED' });
  reopened.grantApproval(pending.id, { confirmed: true, sourceRef: 'operator:fixture' });
  assert.throws(() => reopened.beginAction({ kind: 'publish', requestHash: digest('changed'), approvalId: pending.id }), { code: 'APPROVAL_REQUIRED' });
  const intended = reopened.beginAction({ kind: 'publish', requestHash: hash, approvalId: pending.id });
  assert.equal(intended.actions.at(-1).status, 'IN_FLIGHT'); assert.equal(intended.pendingApproval, null);
  assert.equal(intended.approvalHistory.at(-1).status, 'CONSUMED');
  assert.throws(() => reopened.beginAction({ kind: 'publish', requestHash: hash, approvalId: pending.id }), { code: 'UNRESOLVED_ACTION' });
});

test('a null budget authorizes zero spend and cannot be converted into a payment approval', t => {
  const store = fixture(t); approvalStage(store);
  assert.throws(() => store.requestApproval({ kind: 'payment', requestHash: digest('payment'), maxChargeUsd: '.50', scopeDescription: 'Fixture' }), { code: 'INVALID_BUDGET' });
  assert.throws(() => store.requestApproval({ kind: 'payment', requestHash: digest('payment'), maxChargeUsd: '0.50', scopeDescription: 'Fixture' }), { code: 'SPENDING_NOT_AUTHORIZED' });
  assert.throws(() => store.requestApproval({ kind: 'payment', requestHash: digest('payment'), maxChargeUsd: '0.50', scopeDescription: 'Fixture' }), { code: 'SPENDING_NOT_AUTHORIZED' });
  assert.throws(() => store.requestApproval({ kind: 'payment', requestHash: digest('payment'), maxChargeUsd: null, scopeDescription: 'Fixture' }), { code: 'INVALID_BUDGET' });
  assert.equal(store.load().pendingApproval, null);
});

test('restart preserves remote IDs, marks in-flight outcomes unknown, and prevents replay', t => {
  const store = fixture(t); approvalStage(store);
  const started = store.beginAction(approve(store, 'publish')), actionId = started.actions.at(-1).id;
  const reopened = createStateStore({ directory: store.directory });
  const recovered = reopened.recover();
  assert.equal(recovered.stage, 'UNKNOWN_REMOTE_OUTCOME');
  assert.equal(recovered.rounds[0].conversationId, ids(1).conversationId);
  assert.equal(recovered.actions.at(-1).status, 'UNKNOWN_REMOTE_OUTCOME');
  assert.throws(() => reopened.resume(), { code: 'UNRESOLVED_ACTION' });
  assert.throws(() => reopened.requestApproval({ kind: 'publish', requestHash: digest('other'), scopeDescription: 'Fixture' }), { code: 'RUN_NOT_ACTIVE' });
  reopened.reconcileAction(actionId, { outcome: 'SUCCEEDED', sourceRef: 'fixture:remote-status' });
  reopened.resume();
  assert.throws(() => approve(reopened, 'publish'), { code: 'DUPLICATE_ACTION' });
  assert.equal(reopened.transition('PUBLISHED').stage, 'PUBLISHED');
});

test('a confirmed non-execution requires a fresh approval before retrying', t => {
  const store = fixture(t); approvalStage(store);
  const grant = approve(store, 'publish'), started = store.beginAction(grant), actionId = started.actions.at(-1).id;
  store.finishAction(actionId, { outcome: 'UNKNOWN_REMOTE_OUTCOME', sourceRef: 'fixture:timeout' });
  store.reconcileAction(actionId, { outcome: 'NOT_EXECUTED', sourceRef: 'fixture:verified-not-sent' });
  store.resume();
  assert.throws(() => store.beginAction(grant), { code: 'APPROVAL_REQUIRED' });
  const retry = store.beginAction(approve(store, 'publish'));
  assert.equal(retry.actions.length, 2); assert.equal(retry.actions[0].status, 'NOT_EXECUTED');
});

test('an existing survey cannot be recreated and actual remote IDs cannot be replaced', t => {
  const store = fixture(t); plan(store); store.bindRemoteIds(ids(1), 'fixture:existing-survey');
  assert.throws(() => approve(store, 'create_survey'), { code: 'EXISTING_SURVEY' });
  assert.throws(() => store.bindRemoteIds({ conversationId: 'different-thread' }, 'fixture:wrong-thread'), { code: 'REMOTE_ID_CONFLICT' });
});

test('insufficient evidence cannot progress to validation, analysis or final report', t => {
  const store = fixture(t); awaiting(store);
  const empty = evidence({ completedRecords: 12, responses: [] });
  const state = store.attachEvidence(empty);
  assert.equal(state.rounds[0].completedRecords, 12); assert.equal(state.rounds[0].usableAnswerRecords, 0);
  assert.equal(state.rounds[0].invitedCount, 2);
  store.transition('RESPONSES_RETRIEVED');
  assert.throws(() => store.transition('ANSWERS_VALIDATED'), { code: 'INSUFFICIENT_EVIDENCE' });
  assert.throws(() => store.transition('ROUND_1_ANALYZED'), { code: 'ILLEGAL_TRANSITION' });
  assert.throws(() => store.transition('FINAL_REPORT'), { code: 'ILLEGAL_TRANSITION' });
  store.transition('BLOCKED', { reason: 'No usable answers returned.' });
  assert.equal(createStateStore({ directory: store.directory }).load().lastError.code, 'BLOCKED');
  assert.equal(store.resume().stage, 'RESPONSES_RETRIEVED');
});

test('a valid round needs cited question evidence before STOP and completion', t => {
  const store = fixture(t); analyzed(store); store.transition('FOLLOWUP_DECISION');
  assert.throws(() => store.recordDecision({ decision: 'STOP', reasoningSummary: 'Fixture decision without evidence' }), { code: 'MISSING_EVIDENCE' });
  store.recordDecision({ decision: 'STOP', reasoningSummary: 'The fixture distribution resolves this test decision.', observedEvidenceRefs: [refs(store)[0]] });
  store.transition('FINAL_REPORT'); assert.equal(store.transition('COMPLETED').stage, 'COMPLETED');
  assert.throws(() => store.transition('PAUSED'), { code: 'ILLEGAL_TRANSITION' });
  assert.throws(() => store.recordDecision({ decision: 'RESTART', reasoningSummary: 'Fixture' }), { code: 'RUN_NOT_ACTIVE' });
});

test('the second round requires a first-round evidence trigger and no third round is possible', t => {
  const store = fixture(t); analyzed(store); store.transition('FOLLOWUP_DECISION');
  store.recordDecision({ decision: 'CREATE_FOLLOWUP', reasoningSummary: 'Fixture Q1 leaves one test uncertainty.', observedEvidenceRefs: [refs(store)[0]] });
  const second = store.startRound2();
  assert.equal(second.activeRound, 2); assert.equal(second.stage, 'DRAFT_PLAN'); assert.equal(second.rounds[1].surveyId, null);
  const secondData = evidence({ round: 2, surveyId: ids(2).surveyId, conversationId: ids(2).conversationId, panelId: ids(2).panelId,
    runId: ids(2).remoteRunId, retrievalSource: 'fixture:round-2' });
  secondData.responses.forEach(row => { row.run_id = ids(2).remoteRunId; });
  awaiting(store); store.attachEvidence(secondData); store.transition('RESPONSES_RETRIEVED'); store.transition('ANSWERS_VALIDATED');
  assert.throws(() => store.transition('ROUND_1_ANALYZED'), { code: 'WRONG_ROUND' });
  store.transition('ROUND_2_ANALYZED'); store.transition('FINAL_REPORT'); store.transition('COMPLETED');
  assert.equal(store.load().rounds.length, 2); assert.throws(() => store.startRound2());
});

test('a configured one-round limit prevents follow-up creation', t => {
  const store = fixture(t, { run: { maxRounds: 1 } }); analyzed(store); store.transition('FOLLOWUP_DECISION');
  assert.throws(() => store.recordDecision({ decision: 'CREATE_FOLLOWUP', reasoningSummary: 'Fixture follow-up', observedEvidenceRefs: [refs(store)[0]] }), { code: 'ROUND_LIMIT' });
});

test('state rejects other evidence sources and stores no individual answers or respondent IDs', t => {
  const store = fixture(t); awaiting(store);
  assert.throws(() => store.attachEvidence(evidence({ sourceType: 'synthetic' })), { code: 'EVIDENCE_SCOPE_MISMATCH' });
  const state = store.attachEvidence(evidence());
  assert.equal(state.rounds[0].evidence.status, 'VALID_ANSWERS');
  const serialized = fs.readFileSync(path.join(store.directory, 'run-state.json'), 'utf8');
  assert.ok(!serialized.includes('fixture-record-a')); assert.ok(!serialized.includes('Fixture explanation A')); assert.ok(!serialized.includes('"records"'));
});

test('aggregate-only findings can progress with explicit limits and unknown individual counts', t => {
  const store = fixture(t); awaiting(store);
  const payload = evidence({ responses: undefined, completedRecords: 12, aggregates: [{ questionId: 'Q1', denominator: 12, counts: { 1: 7, 2: 5 } }] });
  const state = store.attachEvidence(payload);
  assert.equal(state.rounds[0].usableAnswerRecords, null); assert.equal(state.rounds[0].evidence.status, 'AGGREGATE_ONLY');
  store.transition('RESPONSES_RETRIEVED'); store.transition('ANSWERS_VALIDATED'); store.transition('ROUND_1_ANALYZED');
  assert.ok(store.load().rounds[0].evidence.limitations.some(value => value.includes('Aggregates support only')));
});

test('consent changes invalidate pending invitation approval and reminders need their own approval', t => {
  const store = fixture(t); approvalStage(store); success(store, 'publish'); store.transition('PUBLISHED');
  const recipientsHash = digest('fixture-list-a');
  store.recordConsent({ recipientsHash, eligibleCount: 2, sourceRef: 'fixture:consent' });
  const grant = approve(store, 'email_send', { recipientsHash, recipientCount: 2 });
  store.recordConsent({ recipientsHash: digest('fixture-list-after-opt-out'), eligibleCount: 1, sourceRef: 'fixture:opt-out' });
  assert.throws(() => store.beginAction(grant), { code: 'CONSENT_CHANGED' });
  store.cancelApproval(grant.approvalId, 'Recipient withdrew consent in the fixture.');
  success(store, 'email_send', { recipientsHash: digest('fixture-list-after-opt-out'), recipientCount: 1 });
  store.transition('INVITATIONS_SENT'); store.transition('AWAITING_RESPONSES');
  assert.throws(() => store.beginAction({ ...grant, kind: 'email_reminder' }), { code: 'APPROVAL_REQUIRED' });
});

test('redacted append-only events preserve short decisions without secrets or respondent identities', t => {
  const store = fixture(t), before = fs.readFileSync(path.join(store.directory, 'events.jsonl'), 'utf8');
  const jwt = 'eyJmaXh0dXJl.eyJmaXh0dXJl.c2lnbmF0dXJl';
  const key = '0x' + 'a'.repeat(64);
  store.recordDecision({ decision: 'WAIT', reasoningSummary: `Fixture person@example.test Bearer opaque-secret ${jwt} ${key} signature=payment-secret https://example.test/invite/private +1 (212) 555-0100`,
    selectedTool: 'local_validation', outcome: 'Waiting for evidence', nextAction: 'Retrieve only after approval',
    respondentName: 'Private Fixture Name', response_id: 'private-respondent-id', privateKey: key });
  const log = fs.readFileSync(path.join(store.directory, 'events.jsonl'), 'utf8');
  assert.ok(log.startsWith(before));
  for (const secret of ['person@example.test', 'opaque-secret', jwt, key, 'payment-secret', 'example.test/invite', '212', 'Private Fixture Name', 'private-respondent-id']) assert.ok(!log.includes(secret));
  const event = store.events().at(-1);
  for (const field of ['timestamp', 'runId', 'stage', 'observedEvidenceRefs', 'decision', 'reasoningSummary', 'selectedTool', 'remoteIds', 'outcome', 'nextAction']) assert.ok(Object.hasOwn(event, field));
  assert.deepEqual(redact({ respondentName: 'Private Fixture Name', access_token: 'opaque', nested: { email: 'person@example.test' } }),
    { respondentName: '[REDACTED]', access_token: '[REDACTED]', nested: { email: '[REDACTED]' } });
  assert.throws(() => store.recordDecision({ decision: 'WAIT', reasoningSummary: 'Fixture', observedEvidenceRefs: [jwt] }), { code: 'INVALID_INPUT' });
});

test('a journal failure before append is recovered from the durable outbox', t => {
  const store = fixture(t), append = fs.appendFileSync;
  fs.appendFileSync = () => { throw Error('Injected offline append failure'); };
  try { assert.throws(() => store.recordDecision({ decision: 'WAIT', reasoningSummary: 'Offline recovery fixture' })); }
  finally { fs.appendFileSync = append; }
  assert.ok(store.load().pendingJournal);
  const reopened = createStateStore({ directory: store.directory }); reopened.recover();
  assert.equal(reopened.load().pendingJournal, null);
  assert.equal(reopened.events().filter(event => event.decision === 'WAIT').length, 1);
});

test('append acknowledgement loss does not duplicate journal events on recovery', t => {
  const store = fixture(t), append = fs.appendFileSync;
  fs.appendFileSync = (...args) => { append(...args); throw Error('Injected acknowledgement loss'); };
  try { assert.throws(() => store.recordDecision({ decision: 'WAIT', reasoningSummary: 'Offline acknowledgement fixture' })); }
  finally { fs.appendFileSync = append; }
  createStateStore({ directory: store.directory }).recover();
  assert.equal(store.events().filter(event => event.decision === 'WAIT').length, 1);
  assert.equal(new Set(store.events().map(event => event.eventId)).size, store.events().length);
});

test('a torn journal tail fails closed without deleting or rewriting history', t => {
  const store = fixture(t), logFile = path.join(store.directory, 'events.jsonl');
  fs.appendFileSync(logFile, '{'); const before = fs.readFileSync(logFile, 'utf8');
  assert.throws(() => store.recover(), { code: 'CORRUPT_LOG' });
  assert.equal(fs.readFileSync(logFile, 'utf8'), before);
});

test('budget accounting bounds actual charges and reserves spending across operations', t => {
  const store = fixture(t, { run: { maxSpendingUsd: '0.60' } }); approvalStage(store);
  const state = store.beginAction(approve(store, 'payment', { maxChargeUsd: '0.50' })), actionId = state.actions.at(-1).id;
  assert.throws(() => store.finishAction(actionId, { outcome: 'SUCCEEDED', sourceRef: 'fixture:receipt', actualChargeUsd: '0.51' }), { code: 'SPENDING_NOT_AUTHORIZED' });
  store.finishAction(actionId, { outcome: 'SUCCEEDED', sourceRef: 'fixture:receipt', actualChargeUsd: '0.40' });
  assert.throws(() => approve(store, 'publish', { maxChargeUsd: '0.21' }), { code: 'SPENDING_NOT_AUTHORIZED' });
  success(store, 'publish', { maxChargeUsd: '0.20' });
  assert.equal(store.load().actions.length, 2);
});

test('uncertain payments cannot be replayed or silently approved after restart', t => {
  const store = fixture(t, { run: { maxSpendingUsd: '1' } }); approvalStage(store);
  const grant = approve(store, 'payment', { maxChargeUsd: '0.50' });
  const started = store.beginAction(grant), actionId = started.actions.at(-1).id;
  store.finishAction(actionId, { outcome: 'UNKNOWN_REMOTE_OUTCOME', sourceRef: 'fixture:payment-timeout' });
  const reopened = createStateStore({ directory: store.directory }); reopened.recover();
  assert.throws(() => reopened.beginAction(grant), { code: 'RUN_NOT_ACTIVE' });
  reopened.reconcileAction(actionId, { outcome: 'SUCCEEDED', sourceRef: 'fixture:verified-receipt' }); reopened.resume();
  assert.throws(() => approve(reopened, 'payment', { maxChargeUsd: '0.50' }), { code: 'DUPLICATE_ACTION' });
});

test('a live writer lock cannot be cleared by recovery', t => {
  const store = fixture(t), file = path.join(store.directory, '.state.lock');
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, token: 'fixture-live-writer' }));
  try {
    assert.throws(() => store.recordDecision({ decision: 'WAIT', reasoningSummary: 'Fixture' }), { code: 'STATE_LOCKED' });
    assert.throws(() => store.recover({ clearStaleLock: true }), { code: 'STATE_LOCKED' });
    assert.ok(fs.existsSync(file));
  } finally { fs.unlinkSync(file); }
});

test('hard process interruption leaves a durable intent and requires verified dead-lock recovery', t => {
  const store = fixture(t); approvalStage(store); const grant = approve(store, 'publish');
  const code = "const fs=require('node:fs');const {createStateStore}=require(process.argv[1]);const store=createStateStore({directory:process.argv[2]});fs.appendFileSync=()=>process.exit(55);store.beginAction(JSON.parse(process.argv[3]));";
  const child = spawnSync(process.execPath, ['-e', code, stateModule, store.directory, JSON.stringify(grant)], { encoding: 'utf8' });
  assert.equal(child.status, 55);
  assert.equal(store.load().actions.at(-1).status, 'IN_FLIGHT');
  assert.throws(() => store.recover(), { code: 'STATE_LOCKED' });
  const recovered = store.recover({ clearStaleLock: true });
  assert.equal(recovered.stage, 'UNKNOWN_REMOTE_OUTCOME'); assert.equal(recovered.rounds[0].surveyId, ids(1).surveyId);
  assert.equal(store.events().filter(event => event.decision === 'ACTION_INTENDED').length, 1);
  assert.throws(() => store.resume(), { code: 'UNRESOLVED_ACTION' });
});

test('concurrent processes cannot reserve the same external action twice', async t => {
  const store = fixture(t); approvalStage(store); const grant = approve(store, 'publish');
  const code = "const {createStateStore}=require(process.argv[1]);try{createStateStore({directory:process.argv[2]}).beginAction(JSON.parse(process.argv[3]));process.exitCode=0}catch{process.exitCode=2}";
  const execute = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', code, stateModule, store.directory, JSON.stringify(grant)], { stdio: 'ignore', windowsHide: true });
    child.on('error', reject); child.on('close', resolve);
  });
  const codes = await Promise.all([execute(), execute()]);
  assert.deepEqual(codes.sort(), [0, 2]); assert.equal(store.load().actions.length, 1);
});

test('survey creation intent requires approval and returned IDs before success can be recorded', t => {
  const store = fixture(t); plan(store);
  const started = store.beginAction(approve(store, 'create_survey')), actionId = started.actions.at(-1).id;
  assert.throws(() => store.finishAction(actionId, { outcome: 'SUCCEEDED', sourceRef: 'fixture:create-result' }), { code: 'MISSING_REMOTE_IDS' });
  store.finishAction(actionId, { outcome: 'SUCCEEDED', sourceRef: 'fixture:create-result', remoteIds: ids(1) });
  store.transition('DRAFT_SURVEY_CREATED');
  const restored = createStateStore({ directory: store.directory }).load();
  assert.equal(restored.rounds[0].surveyId, ids(1).surveyId); assert.equal(restored.actions[0].status, 'SUCCEEDED');
});

test('evidence and follow-up events cite persisted question evidence without exposing answers', t => {
  const store = fixture(t); analyzed(store); store.transition('FOLLOWUP_DECISION');
  const questionRef = refs(store)[0];
  store.recordDecision({ decision: 'CREATE_FOLLOWUP', reasoningSummary: 'Fixture Q1 triggered follow-up.', observedEvidenceRefs: [questionRef] });
  store.startRound2();
  const log = store.events();
  assert.equal(log.find(event => event.decision === 'EVIDENCE_VALIDATED').outcome, 'VALID_ANSWERS');
  assert.deepEqual(log.at(-1).observedEvidenceRefs, [questionRef]);
  assert.ok(log.find(event => event.stage === 'ROUND_1_ANALYZED').observedEvidenceRefs.includes(questionRef));
  assert.ok(!JSON.stringify(log).includes('Fixture explanation A'));
});

test('an initially null spending limit changes only with explicit confirmation and grants no action approval', t => {
  const store = fixture(t); approvalStage(store);
  assert.throws(() => store.setSpendingLimit({ maxSpendingUsd: '0.50', confirmed: false, sourceRef: 'operator:fixture-limit' }), { code: 'APPROVAL_REQUIRED' });
  assert.equal(store.load().constraints.maxSpendingUsd, null);
  store.setSpendingLimit({ maxSpendingUsd: '0.50', confirmed: true, sourceRef: 'operator:fixture-limit' });
  assert.equal(store.load().pendingApproval, null);
  assert.throws(() => store.beginAction({ kind: 'payment', requestHash: digest('fixture'), approvalId: 'not-approved' }), { code: 'APPROVAL_REQUIRED' });
  success(store, 'payment', { maxChargeUsd: '0.50' });
  assert.throws(() => store.setSpendingLimit({ maxSpendingUsd: '0.49', confirmed: true, sourceRef: 'operator:fixture-reduction' }), { code: 'SPENDING_NOT_AUTHORIZED' });
  assert.equal(store.load().constraints.maxSpendingUsd, '0.50');
});
