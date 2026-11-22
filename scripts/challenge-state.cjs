'use strict';
// Local bookkeeping only. This module never sends a request or signs anything.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { fail, object, id, text, redactText, digest, reference } = require('./challenge-safety.cjs');
const { validateResponses, SOURCES } = require('./challenge-validate.cjs');

const NEXT = Object.freeze({
  NEW: ['MODEL_CONTEXT_READY'], MODEL_CONTEXT_READY: ['DRAFT_PLAN'],
  DRAFT_PLAN: ['DRAFT_SURVEY_CREATED'], DRAFT_SURVEY_CREATED: ['AWAITING_APPROVAL'],
  AWAITING_APPROVAL: ['PUBLISHED'], PUBLISHED: ['INVITATIONS_SENT'],
  INVITATIONS_SENT: ['AWAITING_RESPONSES'], AWAITING_RESPONSES: ['RESPONSES_RETRIEVED'],
  RESPONSES_RETRIEVED: ['ANSWERS_VALIDATED'], ANSWERS_VALIDATED: ['ROUND_1_ANALYZED', 'ROUND_2_ANALYZED'],
  ROUND_1_ANALYZED: ['FOLLOWUP_DECISION'], FOLLOWUP_DECISION: ['FINAL_REPORT'],
  ROUND_2_ANALYZED: ['FINAL_REPORT'], FINAL_REPORT: ['COMPLETED'], COMPLETED: []
});
Object.values(NEXT).forEach(Object.freeze);
const INTERRUPTED = Object.freeze(['PAUSED', 'BLOCKED', 'ERROR', 'UNKNOWN_REMOTE_OUTCOME']);
const ACTION_STAGES = Object.freeze({
  create_survey: ['DRAFT_PLAN'], publish: ['AWAITING_APPROVAL'], email_send: ['PUBLISHED'],
  email_reminder: ['AWAITING_RESPONSES'], payment: ['AWAITING_APPROVAL'], paid_recruitment: ['PUBLISHED'],
  synthetic_panel: ['DRAFT_SURVEY_CREATED', 'AWAITING_APPROVAL', 'PUBLISHED']
});
const clone = value => structuredClone(value);
const cleanText = (value, label, max = 1000) => redactText(text(value, label, max));
function sha(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('INVALID_HASH', 'A SHA-256 fingerprint is required');
  return value;
}
function usd(value) {
  if (value == null) return 0n;
  const input = String(value);
  if (!/^\d+(?:\.\d{1,6})?$/.test(input)) fail('INVALID_BUDGET', 'USD must be nonnegative with at most six decimal places');
  const [whole, fraction = ''] = input.split('.');
  return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
}
function amount(value) { usd(value); return value == null ? null : String(value); }
function newRound(round) {
  return { round, surveyId: null, conversationId: null, panelId: null, remoteRunId: null,
    invitedCount: null, completedRecords: null, retrievedAnswerRecords: null, usableAnswerRecords: null,
    evidence: null, analyzedAt: null };
}
function createStateStore({ directory = path.resolve(__dirname, '../.runtime/challenge'), now = () => new Date().toISOString() } = {}) {
  directory = path.resolve(directory);
  const stateFile = path.join(directory, 'run-state.json'), logFile = path.join(directory, 'events.jsonl');
  const lockFile = path.join(directory, '.state.lock');
  const current = state => state.rounds[state.activeRound - 1];
  const timestamp = () => { const value = now(); if (!Number.isFinite(Date.parse(value))) fail('INVALID_TIME', 'Invalid clock'); return new Date(value).toISOString(); };
  function regular(file) {
    if (!fs.existsSync(file)) return;
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('UNSAFE_PATH', 'Runtime file must be an unlinked regular file');
  }
  function prepare() {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (fs.lstatSync(directory).isSymbolicLink()) fail('UNSAFE_PATH', 'Runtime directory must not be a symbolic link');
  }
  function locked(fn) {
    prepare(); regular(lockFile);
    const token = randomUUID(); let fd;
    try { fd = fs.openSync(lockFile, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') fail('STATE_LOCKED', 'State writer is locked; inspect recovery before retrying'); throw error; }
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token })); fs.fsyncSync(fd);
      return fn();
    } finally {
      fs.closeSync(fd);
      if (JSON.parse(fs.readFileSync(lockFile, 'utf8')).token === token) fs.unlinkSync(lockFile);
    }
  }
  function atomic(state) {
    regular(stateFile);
    const temporary = path.join(directory, randomUUID() + '.tmp');
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(state, null, 2)); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    try { fs.renameSync(temporary, stateFile); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  function load() {
    regular(stateFile);
    if (!fs.existsSync(stateFile)) fail('NO_RUN', 'No saved research run');
    let state;
    try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
    catch { fail('CORRUPT_STATE', 'Saved state is not valid JSON; no action was attempted'); }
    if (state.schemaVersion !== 1 || !SOURCES.includes(state.sourceType) || ![1, 2].includes(state.constraints?.maxRounds)
      || !Array.isArray(state.rounds) || state.rounds.length < 1 || state.rounds.length > state.constraints.maxRounds
      || state.activeRound !== state.rounds.length || ![...Object.keys(NEXT), ...INTERRUPTED].includes(state.stage)
      || !Array.isArray(state.actions) || !Number.isSafeInteger(state.revision)) fail('CORRUPT_STATE', 'Unsupported or corrupt research state');
    id(state.runId, 'run ID'); usd(state.constraints.maxSpendingUsd);
    return state;
  }
  function events() {
    regular(logFile);
    if (!fs.existsSync(logFile)) return [];
    const contents = fs.readFileSync(logFile, 'utf8');
    if (contents && !contents.endsWith('\n')) fail('CORRUPT_LOG', 'Incomplete journal tail; preserve files for manual reconciliation');
    try {
      const entries = contents.split('\n').filter(Boolean).map(line => JSON.parse(line));
      if (entries.some(entry => !object(entry) || typeof entry.eventId !== 'string' || !entry.runId || !entry.stage || !Number.isFinite(Date.parse(entry.timestamp)))) throw Error('Invalid event');
      return entries;
    }
    catch { fail('CORRUPT_LOG', 'Journal is malformed; no history was rewritten'); }
  }
  function flush(state) {
    if (!state.pendingJournal) return;
    const pending = state.pendingJournal;
    const existing = events().find(event => event.eventId === pending.eventId);
    if (existing && digest(existing) !== digest(pending)) fail('CORRUPT_LOG', 'Journal event conflicts with pending state');
    if (!existing) fs.appendFileSync(logFile, JSON.stringify(pending) + '\n', { mode: 0o600, flush: true });
    state.pendingJournal = null; atomic(state);
  }
  function commit(state, details = {}) {
    state.revision++; state.updatedAt = timestamp();
    const round = current(state);
    state.pendingJournal = {
      eventId: state.runId + ':' + state.revision, timestamp: state.updatedAt, runId: state.runId,
      stage: state.stage, round: state.activeRound,
      observedEvidenceRefs: (details.observedEvidenceRefs || []).map(reference),
      decision: cleanText(details.decision || 'STATE_UPDATED', 'decision', 100),
      reasoningSummary: cleanText(details.reasoningSummary || 'Local research bookkeeping update.', 'reasoning summary'),
      selectedTool: details.selectedTool == null ? null : id(details.selectedTool, 'tool'),
      remoteIds: { surveyId: round.surveyId, conversationId: round.conversationId, panelId: round.panelId, remoteRunId: round.remoteRunId },
      outcome: cleanText(details.outcome || 'recorded', 'outcome', 300),
      nextAction: cleanText(details.nextAction || 'Await the next explicit local operation.', 'next action', 300)
    };
    atomic(state); flush(state);
    return clone(state);
  }
  function update(decision, change, details = {}) {
    return locked(() => {
      const state = load(); flush(state);
      const resultDetails = change(state) || {};
      return commit(state, { ...details, ...resultDetails, decision });
    });
  }
  function active(state) {
    if (state.stage === 'COMPLETED' || INTERRUPTED.includes(state.stage)) fail('RUN_NOT_ACTIVE', 'Run must be active; reconcile and resume first');
    if (state.actions.some(a => ['IN_FLIGHT', 'UNKNOWN_REMOTE_OUTCOME'].includes(a.status))) fail('UNRESOLVED_ACTION', 'An external outcome needs reconciliation');
  }
  function bind(state, ids) {
    if (!object(ids) || !Object.keys(ids).length) fail('INVALID_INPUT', 'Remote identifiers are required');
    const round = current(state);
    for (const [key, value] of Object.entries(ids)) {
      if (!['surveyId', 'conversationId', 'panelId', 'remoteRunId'].includes(key)) fail('INVALID_INPUT', 'Unsupported remote identifier');
      id(value, key);
      if (round[key] && round[key] !== value) fail('REMOTE_ID_CONFLICT', 'Existing remote IDs cannot be replaced');
      round[key] = value;
    }
  }
  function analysisReady(state) {
    const e = current(state).evidence;
    if (!e?.analysisEligible || !e.questionCounts.some(q => q.denominator > 0)
      || (e.status === 'VALID_ANSWERS' && !(e.usableAnswerRecords > 0))
      || !['VALID_ANSWERS', 'AGGREGATE_ONLY'].includes(e.status)) fail('INSUFFICIENT_EVIDENCE', 'Usable question-level evidence is required');
  }
  function actionAllowed(state, kind) {
    active(state);
    if (!Object.hasOwn(ACTION_STAGES, kind) || !ACTION_STAGES[kind].includes(state.stage)) fail('INVALID_ACTION_STAGE', 'Action is not allowed at this stage');
    const round = current(state);
    if (kind === 'create_survey' && round.surveyId) fail('EXISTING_SURVEY', 'Inspect the existing survey instead of recreating it');
    if (kind !== 'create_survey' && (!round.surveyId || !round.conversationId)) fail('MISSING_REMOTE_IDS', 'Survey and conversation IDs are required');
    if (state.actions.some(a => a.round === state.activeRound && a.kind === kind && a.status !== 'NOT_EXECUTED')) {
      fail('DUPLICATE_ACTION', 'Operation is already recorded; no blind replay is permitted');
    }
  }
  function budget(state, cap) {
    const used = state.actions.reduce((sum, a) => sum + (['IN_FLIGHT', 'UNKNOWN_REMOTE_OUTCOME'].includes(a.status)
      ? usd(a.maxChargeUsd) : a.status === 'SUCCEEDED' ? usd(a.actualChargeUsd ?? a.maxChargeUsd) : 0n), 0n);
    if (used + usd(cap) > usd(state.constraints.maxSpendingUsd)) fail('SPENDING_NOT_AUTHORIZED', 'Spending cap is absent or exhausted');
  }
  function approvalMatches(state, approval) {
    if (approval.round !== state.activeRound || approval.surveyId !== current(state).surveyId) fail('APPROVAL_SCOPE_MISMATCH', 'Approval belongs to a different scope');
    if (['email_send', 'email_reminder'].includes(approval.kind)) {
      if (!state.consent || approval.consentRevision !== state.consent.revision
        || approval.recipientsHash !== state.consent.recipientsHash || approval.recipientCount !== state.consent.eligibleCount) {
        fail('CONSENT_CHANGED', 'Recipients/opt-outs changed; a fresh explicit approval is required');
      }
    }
    budget(state, approval.maxChargeUsd);
  }
  function clearDeadLock() {
    prepare();
    const recoveryFile = path.join(directory, '.recovery.lock');
    const fd = fs.openSync(recoveryFile, 'wx', 0o600);
    try {
      regular(lockFile);
      if (!fs.existsSync(lockFile)) return;
      const owner = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) fail('STATE_LOCKED', 'Cannot verify lock owner');
      let dead = false;
      try { process.kill(owner.pid, 0); } catch (error) { dead = error.code === 'ESRCH'; }
      if (!dead) fail('STATE_LOCKED', 'Lock owner is alive or cannot be verified');
      fs.unlinkSync(lockFile);
    } finally { fs.closeSync(fd); fs.unlinkSync(recoveryFile); }
  }
  return {
    directory, load,
    events,
    initialize({ objective, sourceType = 'real_first_party', maxRounds = 2, maxSpendingUsd = null }) {
      return locked(() => {
        if (fs.existsSync(stateFile) || fs.existsSync(logFile)) fail('RUN_EXISTS', 'Existing run must be resumed, not overwritten');
        if (!SOURCES.includes(sourceType) || ![1, 2].includes(maxRounds)) fail('INVALID_INPUT', 'Invalid source type or round limit');
        const at = timestamp();
        const state = { schemaVersion: 1, runId: randomUUID(), objective: cleanText(objective, 'objective', 4000), sourceType,
          stage: 'NEW', revision: 0, createdAt: at, updatedAt: at, activeRound: 1,
          constraints: { maxRounds, maxSpendingUsd: amount(maxSpendingUsd), requireExplicitApproval: true, approvedRecipientsOnly: true },
          modelContextRef: null, rounds: [newRound(1)], pendingApproval: null, approvalHistory: [],
          consent: null, actions: [], followup: null, resumeStage: null, lastError: null, pendingJournal: null };
        return commit(state, { decision: 'INITIALIZE', reasoningSummary: 'Initialized a local run; no external action is authorized.' });
      });
    },
    transition(stage, { reason = 'Validated local stage transition.', modelContextRef = null } = {}) {
      return update('TRANSITION', state => {
        if (![...Object.keys(NEXT), ...INTERRUPTED].includes(stage)) fail('INVALID_STAGE', 'Unknown stage');
        if (INTERRUPTED.includes(stage)) {
          if (state.stage === 'COMPLETED' || INTERRUPTED.includes(state.stage)) fail('ILLEGAL_TRANSITION', 'Cannot interrupt this stage');
          state.resumeStage = state.stage; state.stage = stage;
          state.lastError = { code: stage, message: cleanText(reason, 'reason'), at: timestamp() }; return;
        }
        active(state);
        if (!NEXT[state.stage]?.includes(stage)) fail('ILLEGAL_TRANSITION', 'Illegal stage transition');
        const round = current(state);
        if (stage === 'MODEL_CONTEXT_READY') state.modelContextRef = reference(modelContextRef);
        if (stage === 'DRAFT_SURVEY_CREATED' && (!round.surveyId || !round.conversationId)) fail('MISSING_REMOTE_IDS', 'Survey and conversation IDs are required');
        if (stage === 'PUBLISHED' && !state.actions.some(a => a.round === state.activeRound && a.kind === 'publish' && a.status === 'SUCCEEDED')) fail('UNCONFIRMED_ACTION', 'Publication has not been confirmed');
        if (stage === 'INVITATIONS_SENT' && !state.actions.some(a => a.round === state.activeRound && a.kind === 'email_send' && a.status === 'SUCCEEDED')) fail('UNCONFIRMED_ACTION', 'Invitation send has not been confirmed');
        if (stage === 'RESPONSES_RETRIEVED' && !round.evidence) fail('MISSING_EVIDENCE', 'Record actual retrieval evidence first');
        if (['ANSWERS_VALIDATED', 'ROUND_1_ANALYZED', 'ROUND_2_ANALYZED', 'FINAL_REPORT', 'COMPLETED'].includes(stage)) analysisReady(state);
        if (stage === 'ROUND_1_ANALYZED' && state.activeRound !== 1 || stage === 'ROUND_2_ANALYZED' && state.activeRound !== 2) fail('WRONG_ROUND', 'Analysis stage belongs to another round');
        if (stage === 'FINAL_REPORT' && state.activeRound === 1 && state.followup?.decision !== 'STOP') fail('MISSING_DECISION', 'Record an evidence-grounded stop decision');
        if (['FINAL_REPORT', 'COMPLETED'].includes(stage) && state.pendingApproval) fail('APPROVAL_PENDING', 'Resolve pending approvals before final reporting');
        if (['ROUND_1_ANALYZED', 'ROUND_2_ANALYZED'].includes(stage)) round.analyzedAt = timestamp();
        state.stage = stage;
        return { observedEvidenceRefs: round.evidence?.questionEvidenceRefs || (stage === 'MODEL_CONTEXT_READY' ? [state.modelContextRef] : []) };
      }, { reasoningSummary: reason });
    },
    bindRemoteIds(ids, sourceRef) {
      return update('REMOTE_IDS_RECORDED', state => { active(state); bind(state, ids); }, { observedEvidenceRefs: [reference(sourceRef)] });
    },
    attachEvidence(raw) {
      return update('EVIDENCE_VALIDATED', state => {
        active(state);
        if (!object(raw)) fail('INVALID_EVIDENCE', 'Evidence must be an object');
        if (!['AWAITING_RESPONSES', 'RESPONSES_RETRIEVED'].includes(state.stage)) fail('INVALID_STAGE', 'Retrieval evidence is not accepted at this stage');
        const round = current(state);
        if (raw.invitedCount != null && round.invitedCount != null && raw.invitedCount !== round.invitedCount) fail('EVIDENCE_SCOPE_MISMATCH', 'Invitation count conflicts with the recorded send');
        const result = validateResponses({ ...raw, invitedCount: raw.invitedCount ?? round.invitedCount }, { sourceType: state.sourceType, round: state.activeRound, surveyId: round.surveyId,
          conversationId: round.conversationId, panelId: round.panelId, runId: round.remoteRunId });
        const { records, ...summary } = result;
        round.evidence = summary;
        round.lastVerifiedAt = summary.retrievedAt;
        for (const key of ['invitedCount', 'completedRecords', 'retrievedAnswerRecords', 'usableAnswerRecords']) round[key] = summary[key];
        return { observedEvidenceRefs: [summary.evidenceRef], outcome: summary.status };
      });
    },
    recordDecision({ decision, reasoningSummary, observedEvidenceRefs = [], selectedTool = null, outcome = 'recorded', nextAction = 'Await next step.' }) {
      return update(decision, state => {
        active(state);
        if (state.stage === 'FOLLOWUP_DECISION') {
          analysisReady(state);
          if (!['STOP', 'CREATE_FOLLOWUP'].includes(decision)) fail('INVALID_DECISION', 'Choose STOP or CREATE_FOLLOWUP');
          const allowed = current(state).evidence.questionEvidenceRefs;
          if (!observedEvidenceRefs.length || observedEvidenceRefs.some(ref => !allowed.includes(ref))) fail('MISSING_EVIDENCE', 'Follow-up decisions must cite validated question evidence');
          if (decision === 'CREATE_FOLLOWUP' && state.constraints.maxRounds < 2) fail('ROUND_LIMIT', 'Round limit is one');
          state.followup = { decision, reasoningSummary: cleanText(reasoningSummary, 'reasoning summary'), observedEvidenceRefs: [...observedEvidenceRefs] };
        }
      }, { reasoningSummary, observedEvidenceRefs, selectedTool, outcome, nextAction });
    },
    startRound2() {
      return update('START_ROUND_2', state => {
        active(state); analysisReady(state);
        if (state.stage !== 'FOLLOWUP_DECISION' || state.activeRound !== 1 || state.constraints.maxRounds !== 2 || state.followup?.decision !== 'CREATE_FOLLOWUP') fail('ROUND_LIMIT', 'A second round needs the recorded evidence-dependent decision');
        if (state.pendingApproval) fail('APPROVAL_PENDING', 'Resolve first-round approvals before starting a second round');
        state.rounds.push(newRound(2)); state.activeRound = 2; state.stage = 'DRAFT_PLAN';
        return { observedEvidenceRefs: state.followup.observedEvidenceRefs, reasoningSummary: state.followup.reasoningSummary };
      });
    },
    recordConsent({ recipientsHash, eligibleCount, sourceRef }) {
      return update('CONSENT_UPDATED', state => {
        active(state);
        if (!Number.isSafeInteger(eligibleCount) || eligibleCount < 0) fail('INVALID_INPUT', 'Invalid eligible recipient count');
        state.consent = { recipientsHash: sha(recipientsHash), eligibleCount, sourceRef: reference(sourceRef), revision: (state.consent?.revision || 0) + 1 };
      }, { observedEvidenceRefs: [reference(sourceRef)] });
    },
    setSpendingLimit({ maxSpendingUsd, confirmed, sourceRef }) {
      return update('SPENDING_LIMIT_UPDATED', state => {
        active(state);
        if (confirmed !== true) fail('APPROVAL_REQUIRED', 'Changing the spending limit requires explicit operator confirmation');
        state.constraints.maxSpendingUsd = amount(maxSpendingUsd);
        budget(state, '0');
      }, { observedEvidenceRefs: [reference(sourceRef)], reasoningSummary: 'Recorded an explicitly confirmed overall spending limit; individual actions still require approval.' });
    },
    requestApproval({ kind, requestHash, maxChargeUsd = '0', recipientCount = null, recipientsHash = null, scopeDescription }) {
      return update('APPROVAL_REQUESTED', state => {
        actionAllowed(state, kind);
        if (state.pendingApproval) fail('APPROVAL_PENDING', 'Resolve the pending approval first');
        if (recipientCount != null && (!Number.isSafeInteger(recipientCount) || recipientCount < 0)) fail('INVALID_INPUT', 'Invalid recipient count');
        if (recipientsHash != null) sha(recipientsHash);
        if (['email_send', 'email_reminder'].includes(kind) && !(recipientCount > 0)) fail('INVALID_INPUT', 'Sending requires a positive approved recipient count');
        if (kind === 'payment' && usd(maxChargeUsd) === 0n) fail('INVALID_BUDGET', 'A payment needs an explicit positive ceiling');
        const approval = { id: randomUUID(), kind, requestHash: sha(requestHash), round: state.activeRound,
          surveyId: current(state).surveyId, maxChargeUsd: amount(maxChargeUsd), recipientCount,
          recipientsHash, consentRevision: state.consent?.revision ?? null,
          scopeDescription: cleanText(scopeDescription, 'scope description'), status: 'PENDING', requestedAt: timestamp() };
        approvalMatches(state, approval); state.pendingApproval = approval;
      });
    },
    grantApproval(approvalId, { confirmed, sourceRef }) {
      return update('APPROVAL_GRANTED', state => {
        active(state); const approval = state.pendingApproval;
        if (!approval || approval.id !== approvalId || approval.status !== 'PENDING' || confirmed !== true) fail('APPROVAL_REQUIRED', 'Explicit confirmation of this pending approval is required');
        approvalMatches(state, approval);
        approval.status = 'APPROVED'; approval.approvedAt = timestamp(); approval.approvalRef = reference(sourceRef);
      }, { observedEvidenceRefs: [reference(sourceRef)] });
    },
    cancelApproval(approvalId, reason) {
      return update('APPROVAL_CANCELLED', state => {
        if (state.pendingApproval?.id !== approvalId) fail('APPROVAL_REQUIRED', 'No matching pending approval');
        state.approvalHistory.push({ ...state.pendingApproval, status: 'CANCELLED' }); state.pendingApproval = null;
      }, { reasoningSummary: reason });
    },
    beginAction({ kind, requestHash, approvalId }) {
      return update('ACTION_INTENDED', state => {
        actionAllowed(state, kind);
        const approval = state.pendingApproval;
        if (!approval || approval.id !== approvalId || approval.status !== 'APPROVED' || approval.kind !== kind || approval.requestHash !== requestHash) fail('APPROVAL_REQUIRED', 'A matching explicit approval is required');
        approvalMatches(state, approval);
        state.actions.push({ id: randomUUID(), fingerprint: digest([state.runId, state.activeRound, kind, requestHash]), kind,
          round: state.activeRound, surveyId: current(state).surveyId, requestHash, approvalId,
          maxChargeUsd: approval.maxChargeUsd, recipientCount: approval.recipientCount, status: 'IN_FLIGHT', intendedAt: timestamp() });
        state.approvalHistory.push({ ...approval, status: 'CONSUMED' }); state.pendingApproval = null;
      });
    },
    finishAction(actionId, { outcome, sourceRef, remoteIds = {}, actualChargeUsd = null }) {
      return update('ACTION_OUTCOME', state => {
        const action = state.actions.find(a => a.id === actionId);
        if (!action || action.status !== 'IN_FLIGHT' || !['SUCCEEDED', 'UNKNOWN_REMOTE_OUTCOME'].includes(outcome)) fail('INVALID_OUTCOME', 'An in-flight action and explicit outcome are required');
        if (usd(actualChargeUsd) > usd(action.maxChargeUsd)) fail('SPENDING_NOT_AUTHORIZED', 'Actual charge exceeds the approved ceiling');
        if (outcome === 'SUCCEEDED') {
          if (action.kind === 'create_survey' && (!remoteIds.surveyId || !remoteIds.conversationId)) fail('MISSING_REMOTE_IDS', 'Successful creation requires actual returned IDs');
          if (Object.keys(remoteIds).length) bind(state, remoteIds);
          action.actualChargeUsd = actualChargeUsd == null ? action.maxChargeUsd : amount(actualChargeUsd);
          if (action.kind === 'email_send') current(state).invitedCount = action.recipientCount;
        } else {
          if (!INTERRUPTED.includes(state.stage)) state.resumeStage = state.stage;
          state.stage = 'UNKNOWN_REMOTE_OUTCOME';
          state.lastError = { code: 'UNKNOWN_REMOTE_OUTCOME', message: 'Inspect the same remote IDs before any retry.', at: timestamp() };
        }
        action.status = outcome; action.outcomeRef = reference(sourceRef); action.updatedAt = timestamp();
      }, { observedEvidenceRefs: [reference(sourceRef)], outcome });
    },
    reconcileAction(actionId, { outcome, sourceRef, remoteIds = {} }) {
      return update('ACTION_RECONCILED', state => {
        const action = state.actions.find(a => a.id === actionId);
        if (!action || !['IN_FLIGHT', 'UNKNOWN_REMOTE_OUTCOME'].includes(action.status) || !['SUCCEEDED', 'NOT_EXECUTED'].includes(outcome)) fail('INVALID_OUTCOME', 'Only uncertain actions can be reconciled from remote evidence');
        if (outcome === 'SUCCEEDED') {
          if (action.kind === 'create_survey' && (!remoteIds.surveyId || !remoteIds.conversationId)) fail('MISSING_REMOTE_IDS', 'Creation reconciliation requires actual returned IDs');
          if (Object.keys(remoteIds).length) bind(state, remoteIds);
          action.actualChargeUsd = action.maxChargeUsd;
          if (action.kind === 'email_send') current(state).invitedCount = action.recipientCount;
        }
        action.status = outcome; action.outcomeRef = reference(sourceRef); action.updatedAt = timestamp();
      }, { observedEvidenceRefs: [reference(sourceRef)], outcome });
    },
    recover({ clearStaleLock = false } = {}) {
      if (clearStaleLock) clearDeadLock();
      return update('RECOVER', state => {
        const pending = state.actions.filter(a => a.status === 'IN_FLIGHT');
        for (const action of pending) action.status = 'UNKNOWN_REMOTE_OUTCOME';
        if (pending.length) {
          if (!INTERRUPTED.includes(state.stage)) state.resumeStage = state.stage;
          state.stage = 'UNKNOWN_REMOTE_OUTCOME';
          state.lastError = { code: 'UNKNOWN_REMOTE_OUTCOME', message: 'Interrupted actions require remote reconciliation, not replay.', at: timestamp() };
        }
      });
    },
    resume() {
      return update('RESUME', state => {
        if (!INTERRUPTED.includes(state.stage) || !NEXT[state.resumeStage]) fail('ILLEGAL_TRANSITION', 'There is no interrupted stage to resume');
        if (state.actions.some(a => ['IN_FLIGHT', 'UNKNOWN_REMOTE_OUTCOME'].includes(a.status))) fail('UNRESOLVED_ACTION', 'Reconcile external outcomes first');
        state.stage = state.resumeStage; state.resumeStage = null; state.lastError = null;
      });
    }
  };
}

if (require.main === module) {
  try {
    const [command, ...args] = process.argv.slice(2), store = createStateStore();
    if (command === 'init' && args.length === 1) store.initialize({ objective: args[0] });
    else if (command !== 'show' || args.length) fail('USAGE', 'Usage: node scripts/challenge-state.cjs init "objective" | show');
    const state = store.load();
    console.log(JSON.stringify({ runId: state.runId, stage: state.stage, activeRound: state.activeRound, sourceType: state.sourceType, revision: state.revision }, null, 2));
  } catch (error) { console.error(error.code ? error.code + ': ' + error.message : 'Local state operation failed.'); process.exitCode = 1; }
}
module.exports = { createStateStore, NEXT, INTERRUPTED };
