'use strict';
// Phase 5 orchestration. Codex supplies judgments; this module validates/executes.
const fs = require('node:fs');
const path = require('node:path');
const { compareScenarios } = require('./challenge-context.cjs');
const { createStateStore, INTERRUPTED } = require('./challenge-state.cjs');
const { validateResponses } = require('./challenge-validate.cjs');
const { fail, object, id, text, digest, reference, redact } = require('./challenge-safety.cjs');
const { surveyRequest, assertMock: assertOffline, returnedIds: offlineIds, normalizeAnswers: offlineAnswers } = require('./challenge-mcp.cjs');
const { isLiveAdapter } = require('./challenge-live.cjs');

function createWorkflow({ directory, adapter }) {
  if (!directory || (adapter?.mode !== 'offline' && !isLiveAdapter(adapter))) fail('LIVE_ADAPTER_UNAVAILABLE', 'Use the existing offline adapter or the explicitly guarded live handoff adapter');
  const live = isLiveAdapter(adapter), label = live ? 'REAL_FIRST_PARTY' : 'TEST DATA', sourceType = live ? 'real_first_party' : 'test_fixture';
  const assertMock = live ? adapter.assertReceipt : assertOffline;
  const returnedIds = live ? adapter.returnedIds : offlineIds;
  const normalizeAnswers = live ? adapter.normalizeAnswers : offlineAnswers;
  directory = path.resolve(directory);
  const store = createStateStore({ directory });
  function save(value) {
    const folder = path.join(directory, 'artifacts');
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    if (fs.lstatSync(folder).isSymbolicLink()) fail('UNSAFE_PATH', 'Artifact directory must not be a link');
    const ref = 'file:artifacts/' + digest(value) + '.json';
    const file = path.join(directory, ref.slice(5));
    if (fs.existsSync(file)) {
      if (digest(read(ref)) !== digest(value)) fail('CORRUPT_ARTIFACT', 'Existing artifact differs');
      return ref;
    }
    const fd = fs.openSync(file, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return ref;
  }
  function read(ref) {
    reference(ref);
    const match = /^file:artifacts\/([a-f0-9]{64})\.json$/.exec(ref);
    if (!match) fail('INVALID_ARTIFACT_REF', 'Expected an immutable run-local artifact reference');
    const file = path.join(directory, ref.slice(5));
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('UNSAFE_PATH', 'Artifact must be a regular private file');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (digest(value) !== match[1]) fail('CORRUPT_ARTIFACT', 'Artifact content hash differs');
    return value;
  }
  function state() {
    const value = store.load();
    if (value.sourceType !== sourceType) fail('SOURCE_MISMATCH', 'Adapter and saved run source types must match exactly');
    return value;
  }
  const current = () => state().rounds.at(-1);
  const retrievalRequest = scope => surveyRequest('Retrieve existing answer data only for this exact survey and run. Return individual question-level answers and their questionnaire mapping. Do not create, publish, distribute, generate respondents, recruit, charge or perform additional work. Provider run: ' + scope.remoteRunId + '; analytics panel: ' + scope.panelId + '.', scope);
  function event(decision, round = state().activeRound) {
    return store.events().findLast(e => e.decision === decision && e.round === round);
  }
  function agentDecision(kind, round = state().activeRound) {
    const entry = event('AGENT_' + kind, round);
    return entry ? read(entry.observedEvidenceRefs.find(ref => ref.startsWith('file:artifacts/'))) : null;
  }
  const plan = (round = state().activeRound) => agentDecision('PLAN', round)?.payload;
  function roundReceipt(round) {
    const action = state().actions.find(a => a.round === round && a.kind === 'create_survey' && a.status === 'SUCCEEDED');
    if (!action) fail('MISSING_DRAFT', 'No successful draft receipt for this round');
    let receipt = assertMock(read(action.outcomeRef));
    const research = plan(round);
    const inspection=live?event('INSTRUMENT_VERIFIED',round):null;
    if(inspection){
      const verified=assertMock(read(inspection.observedEvidenceRefs[0]));
      if(verified.operation!=='inspect_survey'||verified.outcome!=='SUCCEEDED'||verified.ids.surveyId!==receipt.ids.surveyId||verified.ids.conversationId!==receipt.ids.conversationId)fail('INSTRUMENT_MISMATCH','Verified inspection must belong to the same actually created survey');
      receipt={...receipt,questionMap:verified.questionMap,instrument:verified.instrument};
    }
    if (live && receipt.questionMap == null) return receipt;
    if (!object(receipt.questionMap) || !research || Object.keys(receipt.questionMap).length !== research.questions.length) fail('INVALID_QUESTION_MAP', 'Draft receipt needs an exact planning-to-provider question map');
    const mapped = research.questions.map(q => id(receipt.questionMap[q.id], 'provider question ID'));
    if (new Set(mapped).size !== mapped.length) fail('INVALID_QUESTION_MAP', 'Provider question IDs must be unique');
    return receipt;
  }
  function questionnaire(round) {
    const mapping = roundReceipt(round).questionMap;
    if (!mapping) fail('UNVERIFIED_INSTRUMENT', 'Inspect actual draft question IDs/types/options before publication or retrieval');
    return Object.fromEntries(plan(round).questions.map(q => [mapping[q.id], { type: q.type, ...(q.options ? { options: q.options } : {}) }]));
  }
  function evidence(round) {
    const entry = event('RETRIEVAL_SAVED', round);
    if (!entry) return null;
    const raw = read(entry.observedEvidenceRefs[0]);
    const scope = state().rounds[round - 1];
    return { raw, validated: validateResponses(raw, { sourceType, round,
      surveyId: scope.surveyId, conversationId: scope.conversationId, panelId: scope.panelId, runId: scope.remoteRunId }) };
  }
  function evidenceView(round) {
    const found = evidence(round);
    if (!found) return null;
    const mapping = roundReceipt(round).questionMap;
    const inverse = Object.fromEntries(Object.entries(mapping).map(([a, b]) => [b, a]));
    const v = found.validated;
    return { round, sourceType, status: v.status, analysisEligible: v.analysisEligible,
      counts: { invited: v.invitedCount, complete: v.completedRecords, retrieved: v.retrievedAnswerRecords, usable: v.usableAnswerRecords,
        perQuestion: Object.fromEntries(v.questionCounts.map(q => [inverse[q.questionId], q.denominator])) },
      exclusions: v.exclusions, limitations: v.limitations,
      questionRefs: Object.fromEntries(v.questionEvidenceRefs.map(ref => [inverse[ref.split(':').at(-1)], ref])),
      records: v.records.map(record => ({ recordRef: record.recordRef, answers: Object.fromEntries(Object.entries(record.answers).map(([q, answer]) => [inverse[q], answer])) })) };
  }
  function resolveSupport(support, { currentRoundOnly = false } = {}) {
    if (!Array.isArray(support) || !support.length) fail('MISSING_EVIDENCE', 'Judgment must cite validated question evidence');
    return support.map(item => {
      if (!object(item) || !Number.isInteger(item.round) || item.round < 1 || item.round > state().activeRound || (currentRoundOnly && item.round !== state().activeRound)) fail('MISSING_EVIDENCE', 'Invalid supporting round');
      const ref = evidenceView(item.round)?.questionRefs[item.questionId];
      if (!ref) fail('MISSING_EVIDENCE', 'Supporting question has no usable evidence');
      return ref;
    });
  }
  function validatePlan(payload, followup = false) {
    if (!object(payload)) fail('INVALID_AGENT_OUTPUT', 'Plan payload is required');
    text(payload.interpretation, 'objective interpretation'); text(payload.participants, 'participant rationale');
    text(payload.analysisCriteria, 'analysis criteria', 5000);
    if (!Array.isArray(payload.uncertainties) || !payload.uncertainties.length) fail('INVALID_AGENT_OUTPUT', 'Declare research uncertainties');
    const uncertainties = payload.uncertainties.map(u => { text(u.rationale, 'uncertainty rationale'); return id(u.id); });
    if (new Set(uncertainties).size !== uncertainties.length) fail('INVALID_AGENT_OUTPUT', 'Uncertainty IDs must be unique');
    if (!Array.isArray(payload.questions) || !payload.questions.length || payload.questions.length > 100) fail('INVALID_AGENT_OUTPUT', 'Authored questions are required');
    const ids = new Set();
    for (const q of payload.questions) {
      id(q.id, 'planning question ID'); text(q.prompt, 'question prompt', 4000); text(q.rationale, 'question rationale');
      if (ids.has(q.id) || !['text', 'number', 'select/single', 'select/multiple'].includes(q.type)) fail('INVALID_AGENT_OUTPUT', 'Duplicate question ID or unsupported answer type');
      ids.add(q.id);
      if (!Array.isArray(q.uncertaintyIds) || !q.uncertaintyIds.length || q.uncertaintyIds.some(u => !uncertainties.includes(u))) fail('INVALID_AGENT_OUTPUT', 'Questions must trace to declared uncertainties');
      if (q.type.startsWith('select/')) {
        if (!object(q.options) || !Object.keys(q.options).length) fail('INVALID_AGENT_OUTPUT', 'Select questions require option codes');
        for (const [key, value] of Object.entries(q.options)) { id(key); text(value, 'option'); }
      }
      if (followup) resolveSupport(q.support, { currentRoundOnly: true });
      else if (q.support?.length) fail('INVALID_AGENT_OUTPUT', 'Round 1 has no prior respondent evidence');
    }
    return payload;
  }
  function checkpoint(kind) {
    const s = state();
    const allowed = { PLAN: ['DRAFT_PLAN'], ANALYSIS: ['ANSWERS_VALIDATED'], FOLLOWUP: ['ROUND_1_ANALYZED'], FINAL: ['FOLLOWUP_DECISION', 'ROUND_2_ANALYZED', 'FINAL_REPORT'] };
    if (!allowed[kind]?.includes(s.stage) || (kind === 'PLAN' && s.activeRound !== 1)) fail('INVALID_AGENT_STAGE', 'This Codex decision is not available at the saved stage');
    if (kind === 'FINAL' && s.activeRound === 1 && s.followup?.decision !== 'STOP') fail('MISSING_DECISION', 'An evidence-grounded STOP is required');
    if (kind !== 'PLAN' && !current().evidence?.analysisEligible) fail('INSUFFICIENT_EVIDENCE', 'No usable question-level evidence for a judgment');
    const views = s.rounds.map(r => evidenceView(r.round)).filter(Boolean);
    const plans = s.rounds.map(r => plan(r.round)).filter(Boolean);
    const analyses = s.rounds.map(r => agentDecision('ANALYSIS', r.round)?.payload).filter(Boolean);
    const context = read(s.modelContextRef);
    const semantic = { kind, objective: s.objective, context, round: s.activeRound, plans, analyses, ...(live ? { sourceType } : {}),
      evidence: views.map(v => ({ round: v.round, sourceType: v.sourceType, status: v.status, counts: v.counts,
        exclusions: v.exclusions, answers: v.records.map(r => r.answers) })) };
    const input = { label, runtime: 'CODEX', runId: s.runId, stage: s.stage, ...semantic, evidence: views };
    return { ...input, basisHash: digest(semantic), inputHash: digest(input) };
  }
  function recordOutput(kind, output) {
    const packet = checkpoint(kind);
    if (output?.schemaVersion !== 1 || output.label !== label || !(live ? ['CODEX_AUTHORED'] : ['CODEX_AUTHORED', 'RECORDED_CODEX_REPLAY']).includes(output.origin)
      || output.kind !== kind || output.inputHash !== packet.inputHash || output.basisHash !== packet.basisHash || !object(output.payload)) {
      fail('STALE_AGENT_OUTPUT', 'Codex output must bind this exact checkpoint and semantic input; no automatic LLM is called');
    }
    return { packet, output: { ...redact(output), inputHash: output.inputHash, basisHash: output.basisHash } };
  }
  function logOutput(kind, output, refs = []) {
    const questions = kind === 'FOLLOWUP' ? output.payload.plan?.questions : kind === 'PLAN' && state().activeRound === 2 ? output.payload.questions : null;
    const questionEvidenceRefs = questions ? Object.fromEntries(questions.map(q => [q.id, resolveSupport(q.support)])) : {};
    const ref = save({ ...output, questionEvidenceRefs });
    store.recordDecision({ decision: 'AGENT_' + kind, reasoningSummary: 'Validated a ' + kind.toLowerCase() + ' decision supplied by Codex; delivery: ' + output.origin + '.',
      observedEvidenceRefs: [ref, ...new Set([...refs, ...Object.values(questionEvidenceRefs).flat()])], selectedTool: null, outcome: output.origin, nextAction: 'Continue only with existing state and approval guards.' });
    return ref;
  }
  function settleStages() {
    const s = state();
    const successful = kind => s.actions.some(a => a.round === s.activeRound && a.kind === kind && a.status === 'SUCCEEDED');
    if (s.stage === 'DRAFT_PLAN' && successful('create_survey')) {
      roundReceipt(s.activeRound);
      store.transition('DRAFT_SURVEY_CREATED', { reason: live ? 'Actual returned draft status and IDs mapped from the captured MCP receipt.' : 'TEST DATA draft receipt and actual simulator IDs verified.' });
    }
    if (state().stage === 'DRAFT_SURVEY_CREATED') store.transition('AWAITING_APPROVAL', { reason: label + ' draft recorded; publication needs a separate approval.' });
    if (state().stage === 'AWAITING_APPROVAL' && successful('publish')) store.transition('PUBLISHED', { reason: label + ' publication receipt verified.' });
    if (state().stage === 'PUBLISHED' && successful('email_send')) store.transition('INVITATIONS_SENT', { reason: live ? 'Actual invitation operation receipt verified; delivery/completion is not inferred.' : 'TEST DATA invitation receipt verified; no email sent.' });
    if (state().stage === 'INVITATIONS_SENT') store.transition('AWAITING_RESPONSES', { reason: 'Await scoped ' + label + ' answer retrieval.' });
    return state();
  }
  function report(output) {
    const s = state();
    const views = s.rounds.map(r => evidenceView(r.round));
    const result = { label, mode: live ? 'LIVE FIRST-PARTY RESEARCH' : 'OFFLINE DEMONSTRATION', runId: s.runId,
      disclaimer: live ? 'Participant opinions are limited to actual retrieved and validated answers from this run. They do not validate the industrial model or establish population effects. Platform subscription/credit consumption is unverified; recorded USD values denote no authorized direct payment, not proof of zero platform cost.' : 'All participant findings, approvals and platform receipts are simulated test data, not real research conclusions. No network, payment or real email operation occurred.',
      objective: s.objective, context: read(s.modelContextRef), reasoningDelivery: output.origin,
      rounds: views.map(v => ({ round: v.round, counts: v.counts, status: v.status, questionRefs: v.questionRefs,
        exclusions: v.exclusions, analysis: agentDecision('ANALYSIS', v.round).payload })),
      followup: s.followup, recommendation: output.payload, supportRefs: resolveSupport(output.payload.support),
      actions: s.actions.map(a => ({ kind: a.kind, round: a.round, status: a.status, mock: !live, receiptRef: a.outcomeRef, actualChargeUsd: a.actualChargeUsd })),
      completionTarget: 'COMPLETED' };
    const reportRef = save(result);
    const markdown = [live ? '# CarbonX first-party research report' : '# TEST DATA — CarbonX offline workflow demonstration', '', result.disclaimer, '',
      'Objective: ' + s.objective, '', 'Reasoning delivery: ' + output.origin + ' (no hosted LLM call).', '',
      ...result.rounds.flatMap(r => ['## ' + (live ? 'Round ' : 'Simulated Round ') + r.round, '',
        'Invited / COMPLETE / retrieved / usable: ' + [r.counts.invited, r.counts.complete, r.counts.retrieved, r.counts.usable].map(n => n ?? 'unknown').join(' / '),
        'Valid answers per question: ' + JSON.stringify(r.counts.perQuestion), '',
        ...r.analysis.findings.map(f => '- ' + label + ' observation: ' + f.claim), '']),
      live ? '## Evidence-grounded recommendation' : '## Simulated recommendation', '', output.payload.recommendation, '',
      'Supporting question references: ' + result.supportRefs.join(', '), '',
      'Counterevidence: ' + output.payload.counterevidence, '',
      'Limitations: ' + output.payload.limitations.join(' '), '', 'Next check: ' + output.payload.nextCheck, '',
      'Structured report: ' + reportRef, ''].join('\n');
    const reportFile = path.join(directory, 'report.md');
    if (fs.existsSync(reportFile) && fs.readFileSync(reportFile, 'utf8') !== markdown) fail('REPORT_CONFLICT', 'Existing report differs; inspect rather than overwrite');
    if (!fs.existsSync(reportFile)) fs.writeFileSync(reportFile, markdown, { flag: 'wx', mode: 0o600, flush: true });
    store.recordDecision({ decision: 'FINAL_REPORT_SAVED', reasoningSummary: 'Saved a clearly labeled ' + label + ' report with scoped counts, counterevidence and limitations.',
      observedEvidenceRefs: [reportRef, ...result.supportRefs], outcome: live ? 'LIVE_EVIDENCE_REPORT' : 'SIMULATED_REPORT', nextAction: live ? 'Complete this supported report; further external work needs separate authorization.' : 'Mark this offline run complete; no live research is authorized.' });
    store.transition('COMPLETED', { reason: label + ' report durably saved; two-round/evidence guards passed.' });
    return result;
  }
  return {
    directory, store, state, readArtifact: read, checkpoint,
    initialize({ objective }) {
      store.initialize({ objective, sourceType, maxRounds: 2, maxSpendingUsd: null });
      return this.prepareContext();
    },
    prepareContext() {
      const s = state();
      if (s.stage === 'NEW') store.transition('MODEL_CONTEXT_READY', { modelContextRef: save(compareScenarios()), reason: 'Loaded actual Carbon Twin calculations, not fixture metrics.' });
      if (state().stage === 'MODEL_CONTEXT_READY') store.transition('DRAFT_PLAN', { reason: 'Waiting for an explicit Codex-authored plan.' });
      return state();
    },
    submit(output) {
      const kind = output?.kind;
      const checked = recordOutput(kind, output);
      output = checked.output;
      const payload = output.payload;
      if (kind === 'PLAN') {
        if (plan() || current().surveyId || state().pendingApproval) fail('PLAN_SEALED', 'The recorded plan cannot be silently replaced');
        validatePlan(payload); logOutput(kind, output); return state();
      }
      if (kind === 'ANALYSIS') {
        if (!Array.isArray(payload.findings) || !payload.findings.length || !Array.isArray(payload.unresolved) || !Array.isArray(payload.limitations)) fail('INVALID_AGENT_OUTPUT', 'Provide actual evidence interpretation, unresolved uncertainty and limits');
        const refs = payload.findings.flatMap(f => { text(f.claim, 'finding'); return resolveSupport(f.support, { currentRoundOnly: true }); });
        text(payload.counterevidence, 'counterevidence');
        payload.limitations.forEach(value => text(value, 'limitation'));
        for (const item of payload.unresolved) { text(item.question, 'unresolved uncertainty'); refs.push(...resolveSupport(item.support, { currentRoundOnly: true })); }
        logOutput(kind, output, [...new Set(refs)]);
        store.transition(state().activeRound === 1 ? 'ROUND_1_ANALYZED' : 'ROUND_2_ANALYZED', { reason: 'Codex interpreted validated ' + label + ', distinct from deterministic eligibility checks.' });
        return state();
      }
      if (kind === 'FOLLOWUP') {
        if (!['STOP', 'CREATE_FOLLOWUP'].includes(payload.decision)) fail('INVALID_DECISION', 'Choose STOP or CREATE_FOLLOWUP');
        text(payload.reasoningSummary, 'follow-up summary', 1000);
        const refs = resolveSupport(payload.support, { currentRoundOnly: true });
        if (payload.decision === 'CREATE_FOLLOWUP') validatePlan(payload.plan, true);
        else if (payload.plan != null) fail('INVALID_AGENT_OUTPUT', 'STOP must not predesign another survey');
        logOutput(kind, output, refs);
        store.transition('FOLLOWUP_DECISION', { reason: 'Codex supplied an evidence-dependent follow-up decision.' });
        store.recordDecision({ decision: payload.decision, reasoningSummary: payload.reasoningSummary, observedEvidenceRefs: refs,
          outcome: output.origin, nextAction: payload.decision === 'STOP' ? 'Await Codex recommendation.' : 'Start one approved follow-up round, maximum two.' });
        if (payload.decision === 'CREATE_FOLLOWUP') {
          store.startRound2();
          const next = { ...output, kind: 'PLAN', payload: payload.plan, derivedFromRound: 1 };
          logOutput('PLAN', next, refs);
        }
        return state();
      }
      if (kind === 'FINAL') {
        text(payload.recommendation, 'one recommendation', 4000); text(payload.counterevidence, 'counterevidence'); text(payload.nextCheck, 'next check');
        if (!Array.isArray(payload.limitations) || !payload.limitations.length) fail('INVALID_AGENT_OUTPUT', 'Recommendation limitations are required');
        payload.limitations.forEach(value => text(value, 'limitation'));
        const refs = resolveSupport(payload.support);
        if (state().stage !== 'FINAL_REPORT') store.transition('FINAL_REPORT', { reason: 'Evidence-backed ' + label + ' recommendation supplied; saving report before completion.' });
        logOutput(kind, output, refs);
        return report(output);
      }
      fail('INVALID_AGENT_OUTPUT', 'Unknown Codex decision kind');
    },
    requestAction(kind, { maxChargeUsd = '0', recipientIds = [] } = {}) {
      if (!['create_survey', 'publish', 'email_send'].includes(kind)) fail('PAYMENT_NOT_AUTHORIZED', 'Phase 5 dispatches no payments, recruitment, panels or reminders');
      const s = state(), research = plan();
      if (!research) fail('MISSING_PLAN', 'Codex must author a plan before request preparation');
      const scope = current();
      if (live) {
        if (maxChargeUsd !== '0' || recipientIds.length) fail('PAYMENT_NOT_AUTHORIZED', 'Live OAuth handoff permits no payment and no alternate recipient source');
        if (kind === 'publish') questionnaire(s.activeRound);
        const instrument=kind==='publish'?roundReceipt(s.activeRound).instrument:null;
        const list = kind === 'email_send' ? adapter.recipients() : null;
        if (list) store.recordConsent({ recipientsHash: list.recipientsHash, eligibleCount: list.recipientCount, sourceRef: save({ label, note: 'Allowlist fingerprint only; actual consent needs explicit confirmation.', recipientsHash: list.recipientsHash }) });
        const request = adapter.prepareRequest({ kind, scope, research, context: { objective: s.objective, model: read(s.modelContextRef),instrument } });
        const manifest = { schemaVersion: 1, label, mock: false, runId: s.runId, round: s.activeRound, kind, maxChargeUsd, request,
          scope: kind === 'create_survey' ? null : { surveyId: scope.surveyId, conversationId: scope.conversationId, panelId: scope.panelId, remoteRunId: scope.remoteRunId },
          planHash: digest(research), recipientCount: list?.recipientCount ?? null, recipientsHash: list?.recipientsHash ?? null,
          ...adapter.approvalDetails(), ...(instrument?{instrument}:{}),businessCalls: 1, paidRetries: 0 };
        const requestHash = digest(manifest), manifestRef = save(manifest);
        store.requestApproval({ kind, requestHash, maxChargeUsd, recipientCount: manifest.recipientCount, recipientsHash: manifest.recipientsHash,
          scopeDescription: 'LIVE ' + kind + ': verify team, billing uncertainty, reversibility and duplicate risk in the exact manifest; no wallet/payment authorization.' });
        store.recordDecision({ decision: 'REQUEST_PREPARED', reasoningSummary: 'Prepared an exact live request for explicit user review; no operation is authorized.', observedEvidenceRefs: [manifestRef], selectedTool: 'tool_survey', outcome: 'PENDING_AUTHORIZATION', nextAction: 'Resolve team ownership and obtain exact action approval before dispatch.' });
        return { approval: state().pendingApproval, manifestRef, manifest };
      }
      let brief;
      if (kind === 'create_survey') brief = 'Prepare a DRAFT survey. Do not publish. Do not distribute, email, recruit, generate respondents, authorize payment or do additional work. Use only this reviewed instrument: ' + JSON.stringify(research);
      if (kind === 'publish') brief = 'Publish only the reviewed existing survey. Do not send invitations, recruit, generate respondents, authorize payment or perform additional work.';
      if (kind === 'email_send') {
        if (!recipientIds.length || new Set(recipientIds).size !== recipientIds.length || recipientIds.some(value => !/^TEST-recipient-[a-zA-Z0-9_-]+$/.test(value))) fail('INVALID_RECIPIENTS', 'Offline invites accept only unique TEST recipient IDs, never addresses');
        const consent = { label: 'TEST DATA', simulatedConsent: true, recipientIds, optOutsApplied: true };
        const sourceRef = save(consent);
        store.recordConsent({ recipientsHash: digest(recipientIds), eligibleCount: recipientIds.length, sourceRef });
        brief = 'TEST DATA distribution specification only: send the reviewed invitation to the separately approved recipient list. Do not recruit, generate respondents, charge, send reminders or do additional work. Live recipient delivery is an unresolved adapter dependency.';
      }
      const request = surveyRequest(brief, kind === 'create_survey' ? null : scope);
      const manifest = { label: 'TEST DATA', mock: true, schemaVersion: 1, runId: s.runId, round: s.activeRound, kind, maxChargeUsd,
        request, scope: kind === 'create_survey' ? null : { surveyId: scope.surveyId, conversationId: scope.conversationId, panelId: scope.panelId, remoteRunId: scope.remoteRunId },
        planHash: digest(research), recipientCount: kind === 'email_send' ? recipientIds.length : null,
        recipientsHash: kind === 'email_send' ? digest(recipientIds) : null, businessCalls: 1, paidRetries: 0 };
      const hash = digest(manifest), ref = save(manifest);
      store.requestApproval({ kind, requestHash: hash, maxChargeUsd, recipientCount: manifest.recipientCount,
        recipientsHash: manifest.recipientsHash, scopeDescription: 'TEST DATA only: ' + kind + '; one call, zero retries, no real-world authorization.' });
      store.recordDecision({ decision: 'REQUEST_PREPARED', reasoningSummary: 'Prepared exact TEST DATA request; execution remains blocked pending simulated approval.',
        observedEvidenceRefs: [ref], selectedTool: 'tool_survey', outcome: 'PENDING_AUTHORIZATION', nextAction: 'Inspect manifest and approve or reject this exact hash.' });
      return { approval: state().pendingApproval, manifestRef: ref, manifest };
    },
    approve({ approvalId, requestHash, simulate = false, reject = false, confirmed = false, userApprovalRef = null, consentConfirmed = false, billingAcknowledged = false }) {
      const s = state(), pending = s.pendingApproval;
      if (live) {
        if (simulate || !pending || pending.id !== approvalId || pending.requestHash !== requestHash || confirmed !== true || !userApprovalRef) fail('APPROVAL_REQUIRED', 'Actual explicit approval of this exact live request is required');
        reference(userApprovalRef);
        if (reject) { store.cancelApproval(approvalId, 'User rejected the live operation.'); return INTERRUPTED.includes(state().stage) ? state() : store.transition('PAUSED', { reason: 'Live operation rejected.' }); }
        const reviewed=store.events().filter(e=>e.decision==='REQUEST_PREPARED'&&e.round===s.activeRound).map(e=>read(e.observedEvidenceRefs[0])).find(value=>digest(value)===pending.requestHash);
        if(!reviewed)fail('REQUEST_MISMATCH','The exact reviewed live manifest is unavailable');
        adapter.assertReady(reviewed);
        if (!billingAcknowledged || (pending.kind === 'email_send' && !consentConfirmed)) fail('APPROVAL_REQUIRED', 'Acknowledge billing uncertainty and actual recipient consent where relevant');
        return store.grantApproval(approvalId, { confirmed: true, sourceRef: save({ label, approvalId, requestHash, userApprovalRef, billingAcknowledged, consentConfirmed, maxChargeUsd: '0', note: 'Explicit action approval only; no payment or future action authorized.' }) });
      }
      if (!simulate || !pending || pending.id !== approvalId || pending.requestHash !== requestHash) fail('APPROVAL_REQUIRED', 'Explicit exact TEST DATA approval is required');
      if (reject) { store.cancelApproval(approvalId, 'TEST DATA approval rejected; no operation dispatched.'); return store.transition('PAUSED', { reason: 'TEST DATA approval rejected.' }); }
      return store.grantApproval(approvalId, { confirmed: true, sourceRef: save({ label: 'TEST DATA', mock: true, approvalId, requestHash,
        note: 'Simulator approval only, not actual human consent or live authorization.' }) });
    },
    async execute({ interruptAfterDispatch = false } = {}) {
      const s = state(), pending = s.pendingApproval;
      if (!pending || pending.status !== 'APPROVED') fail('APPROVAL_REQUIRED', 'No matching approved action');
      const prepared = store.events().filter(e => e.decision === 'REQUEST_PREPARED' && e.round === s.activeRound).reverse()
        .map(e => ({ ref: e.observedEvidenceRefs[0], value: read(e.observedEvidenceRefs[0]) })).find(item => digest(item.value) === pending.requestHash);
      if (!prepared || prepared.value.runId !== s.runId || prepared.value.round !== s.activeRound || prepared.value.kind !== pending.kind) fail('REQUEST_MISMATCH', 'Reviewed manifest is missing or changed');
      const manifest = prepared.value;
      if (live) adapter.assertReady(manifest);
      const started = store.beginAction({ kind: pending.kind, requestHash: pending.requestHash, approvalId: pending.id });
      const action = started.actions.at(-1);
      let receipt;
      try {
        receipt = await adapter.execute({ actionId: action.id, operation: action.kind, request: manifest.request, round: s.activeRound,
          scope: manifest.scope, questions: plan().questions, recipientCount: manifest.recipientCount, manifest });
        if (interruptAfterDispatch) fail('SIMULATED_PROCESS_INTERRUPTION', 'TEST DATA process interrupted after adapter receipt, before state acknowledgement');
        assertMock(receipt);
        const sourceRef = save(receipt);
        if (live && receipt.status === 'handoff_required') return state();
        if (receipt.outcome === 'SUCCEEDED') {
          const remoteIds = returnedIds(receipt);
          if (action.kind !== 'create_survey' && Object.entries(remoteIds).some(([key, value]) => current()[key] !== value)) fail('REMOTE_ID_CONFLICT', 'Receipt changed the stored IDs');
          if (action.kind === 'create_survey') {
            if (!remoteIds.surveyId || !remoteIds.conversationId || (!live && !object(receipt.questionMap))) fail('INVALID_RECEIPT', 'Creation needs verified IDs and the applicable question mapping');
            if (receipt.questionMap) { const mapped = plan().questions.map(q => id(receipt.questionMap[q.id], 'provider question ID'));
              if (Object.keys(receipt.questionMap).length !== mapped.length || new Set(mapped).size !== mapped.length) fail('INVALID_QUESTION_MAP', 'Exact unique provider question mapping required'); }
          }
          store.finishAction(action.id, { outcome: 'SUCCEEDED', sourceRef, remoteIds, actualChargeUsd: receipt.actualChargeUsd });
          return settleStages();
        }
        store.finishAction(action.id, { outcome: 'UNKNOWN_REMOTE_OUTCOME', sourceRef });
        if (receipt.outcome === 'NOT_EXECUTED') store.reconcileAction(action.id, { outcome: 'NOT_EXECUTED', sourceRef });
        return state();
      } catch (error) {
        if (error.code === 'SIMULATED_PROCESS_INTERRUPTION') throw error;
        if (state().actions.find(a => a.id === action.id)?.status === 'IN_FLIGHT') {
          store.finishAction(action.id, { outcome: 'UNKNOWN_REMOTE_OUTCOME', sourceRef: save({ label, operation: action.kind, code: error.code || 'ADAPTER_ERROR', outcome: 'UNKNOWN_REMOTE_OUTCOME' }) });
        } else if (!INTERRUPTED.includes(state().stage)) {
          store.transition('BLOCKED', { reason: 'Confirmed ' + label + ' receipt saved; local postprocessing failed: ' + (error.code || 'LOCAL_ERROR') });
        }
        return state();
      }
    },
    async retrieve({ refresh = false } = {}) {
      const s = state();
      if (!['AWAITING_RESPONSES', 'RESPONSES_RETRIEVED'].includes(s.stage)) fail('INVALID_STAGE', 'Answer retrieval is not available at this stage');
      const scope = current();
      try {
        let raw;
        if (!refresh && event('RETRIEVAL_SAVED') && current().evidence) raw = evidence(s.activeRound).raw;
        else {
          const request = retrievalRequest(scope);
          const receipt = assertMock(await adapter.retrieve({ request, scope, round: s.activeRound, questionMap: roundReceipt(s.activeRound).questionMap, questionnaire: questionnaire(s.activeRound), invitedCount: scope.invitedCount }));
          const receiptRef = save(receipt);
          if (live && receipt.status === 'handoff_required') {
            store.recordDecision({ decision: 'READ_HANDOFF_READY', reasoningSummary: 'Scoped live read queued for one Codex OAuth invocation; no answer evidence yet.', observedEvidenceRefs: [receiptRef], selectedTool: 'tool_survey', outcome: 'PENDING_HANDOFF', nextAction: 'Claim once, invoke through Codex, preserve raw output and review actual mapping.' });
            return state();
          }
          if (receipt.status === 'pending') {
            store.recordDecision({ decision: 'RESPONSES_PENDING', reasoningSummary: 'TEST DATA responses delayed; no automatic poll or reminder.', observedEvidenceRefs: [receiptRef],
              selectedTool: 'tool_survey', outcome: 'WAITING', nextAction: 'Perform a separate explicit read later.' });
            return state();
          }
          raw = normalizeAnswers(receipt, { round: s.activeRound, scope, questionnaire: questionnaire(s.activeRound), retrievalSource: receiptRef });
          validateResponses(raw, { sourceType, round: s.activeRound, surveyId: scope.surveyId, conversationId: scope.conversationId, panelId: scope.panelId, runId: scope.remoteRunId });
          store.recordDecision({ decision: 'RETRIEVAL_SAVED', reasoningSummary: 'Saved private ' + label + ' answer envelope; no individual answers enter the journal.', observedEvidenceRefs: [save(raw)],
            selectedTool: 'tool_survey', outcome: 'RETRIEVED', nextAction: 'Run existing scoped evidence validation.' });
        }
        store.attachEvidence(raw);
        if (state().stage === 'AWAITING_RESPONSES') store.transition('RESPONSES_RETRIEVED', { reason: 'Private scoped answer envelope saved and validated.' });
        if (!current().evidence.analysisEligible) return store.transition('BLOCKED', { reason: 'INSUFFICIENT_EVIDENCE: COMPLETE records contain no usable question-level answers. No findings or follow-up can be generated.' });
        return store.transition('ANSWERS_VALIDATED', { reason: 'Existing deterministic validator found usable ' + label + ' answers; Codex interpretation is still required.' });
      } catch (error) {
        const code = error.code || 'RETRIEVAL_ERROR';
        store.recordDecision({ decision: 'RETRIEVAL_BLOCKED', reasoningSummary: label + ' retrieval/normalization failed: ' + code + '. No answers were inferred.', outcome: code, nextAction: 'Inspect the saved scope and source; do not recreate the survey or retry automatically.' });
        return store.transition('BLOCKED', { reason: 'Retrieval/validation blocker: ' + code });
      }
    },
    completeInspection(actionId,raw,profile) {
      if(!live||!['DRAFT_SURVEY_CREATED','AWAITING_APPROVAL'].includes(state().stage))fail('INVALID_STAGE','Verify the existing unpublished live survey only');
      const receipt=adapter.capture(actionId,raw,profile,plan());
      if(receipt.operation!=='inspect_survey'||receipt.outcome!=='SUCCEEDED'||!receipt.questionMap||!receipt.instrument)fail('UNVERIFIED_INSTRUMENT','Full mapped inspection is required; do not infer missing fields');
      if(receipt.ids.surveyId!==current().surveyId||receipt.ids.conversationId!==current().conversationId)fail('INSTRUMENT_MISMATCH','Inspection changed the existing study IDs');
      store.recordDecision({decision:'INSTRUMENT_VERIFIED',reasoningSummary:'Captured the exact read-only response and matched actual full question text/types/IDs, title, introduction and stimulus against the reviewed plan. Publication remains separately approved.',observedEvidenceRefs:[save(receipt)],selectedTool:'tool_survey',outcome:'INSTRUMENT_VERIFIED',nextAction:'Review participant suitability and remaining metadata limits; prepare publication proposal without granting approval.'});
      return receipt;
    },
    prepareInspection({ confirmed = false, userApprovalRef = null } = {}) {
      const s=state();
      if(!live || !['DRAFT_SURVEY_CREATED','AWAITING_APPROVAL'].includes(s.stage)) fail('INVALID_STAGE','Draft inspection requires an existing unpublished live survey');
      const round=current(),scope={surveyId:round.surveyId,conversationId:round.conversationId,panelId:round.panelId,remoteRunId:round.remoteRunId};
      if(!scope.surveyId || !scope.conversationId) fail('MISSING_REMOTE_IDS','Inspect only the actual existing survey and conversation');
      const brief='Read the complete existing survey draft only. Use only supported read-only getters for this exact survey in this existing conversation. The user confirmed the OAuth-selected team is '+JSON.stringify(adapter.accountContext.teamName)+' (USER_VERIFIED, not independently API-verified); do not invent a team ID or repeat the already supplied attestation. Return the complete exact persisted survey as JSON in your final response, not an abbreviated summary: actual survey ID, title, description, status, version, block IDs/titles/descriptions/order, full introduction and stimulus/transition text, all five question IDs/labels/raw types/subtypes/full text/descriptions/required/skip settings and actual option IDs/values/text, plus any displayed instructions or logic. Preserve full strings/HTML and suffixes without ellipses. Do not reconstruct missing fields from the intended plan; mark unavailable fields explicitly. Also report any already available publication effects, reversibility or billing/quota metadata without executing publication or changing resources. Do not create, edit, update, publish, pause, resume, distribute, send emails or invitations, recruit, generate respondents/test data, submit responses, authorize payment, confirm charges, create exports/reports or perform any resource-changing operation. Do not auto-fix or run a modifying validation operation. If retrieval requires a resource change, payment, additional confirmation or uncertain action, stop and return the precise blocker. Additional payment authorization is zero. No retries.';
      const request=surveyRequest(brief,scope),proposal={label,operation:'inspect_survey',purpose:'instrument',round:s.activeRound,request,scope,billing:'Agent/subscription billing is unverified; no additional payment or retries authorized.'};
      if(!confirmed)return proposal;
      const permit=adapter.authorizeRead({...proposal,confirmed,userApprovalRef});
      store.recordDecision({decision:'INSTRUMENT_READ_AUTHORIZED',reasoningSummary:'Explicit user approval binds one read-only full-draft inspection to the existing survey/conversation. No modification, publication, invitation or payment authorized.',observedEvidenceRefs:[save(permit)],selectedTool:'tool_survey',outcome:'AUTHORIZED_READ',nextAction:'Queue and claim once; preserve the actual response and stop on any resource-changing requirement.'});
      return permit;
    },
    prepareRead({ confirmed = false, userApprovalRef = null } = {}) {
      if (!live || !['AWAITING_RESPONSES', 'RESPONSES_RETRIEVED'].includes(state().stage)) fail('INVALID_STAGE', 'A live answer read requires a distributed run at the response stage');
      const round = current(), scope = { surveyId: round.surveyId, conversationId: round.conversationId, panelId: round.panelId, remoteRunId: round.remoteRunId };
      const request = retrievalRequest(round), proposal = { label, operation: 'retrieve', round: state().activeRound, request, scope,
        billing: 'Agent/subscription billing is unverified; no payment or automatic retry is allowed.' };
      if (!confirmed) return proposal;
      const permit = adapter.authorizeRead({ ...proposal, confirmed, userApprovalRef });
      store.recordDecision({ decision: 'READ_AUTHORIZED', reasoningSummary: 'Recorded explicit user authorization of one exact live read; no remote call yet.',
        observedEvidenceRefs: [save(permit)], selectedTool: 'tool_survey', outcome: 'AUTHORIZED_READ', nextAction: 'Queue/claim once through Codex and preserve the actual result.' });
      return permit;
    },
    async completeHandoff(actionId, raw, profile = null) {
      if (!live) fail('LIVE_ADAPTER_UNAVAILABLE', 'Handoff capture is for the live adapter only');
      const action = state().actions.find(a => a.id === actionId);
      if (!action || !['IN_FLIGHT', 'UNKNOWN_REMOTE_OUTCOME'].includes(action.status)) fail('INVALID_OUTCOME', 'Capture requires the same uncertain/in-flight action');
      let receipt;
      try { receipt = adapter.capture(actionId, raw, profile); }
      catch (error) {
        if (action.status === 'IN_FLIGHT') store.finishAction(actionId, { outcome: 'UNKNOWN_REMOTE_OUTCOME', sourceRef: save({ label, actionId, code: error.code || 'CAPTURE_ERROR', rawCaptureRef: 'file:live-handoff/' + actionId + '.raw.json' }) });
        throw error;
      }
      const sourceRef = save(receipt);
      if (receipt.outcome !== 'SUCCEEDED') {
        if (action.status === 'IN_FLIGHT') store.finishAction(actionId, { outcome: 'UNKNOWN_REMOTE_OUTCOME', sourceRef });
        return state();
      }
      const remoteIds = returnedIds(receipt);
      if (action.status === 'IN_FLIGHT') store.finishAction(actionId, { outcome: 'SUCCEEDED', sourceRef, remoteIds, actualChargeUsd: '0' });
      else store.reconcileAction(actionId, { outcome: 'SUCCEEDED', sourceRef, remoteIds });
      if (state().stage === 'UNKNOWN_REMOTE_OUTCOME') store.resume();
      return settleStages();
    },
    recover() { state(); return store.recover(); },
    async reconcile(actionId) {
      const s = state(), action = s.actions.find(a => a.id === actionId);
      if (!action || !['IN_FLIGHT', 'UNKNOWN_REMOTE_OUTCOME'].includes(action.status)) fail('INVALID_OUTCOME', 'Only uncertain actions can be reconciled');
      const receipt = assertMock(await adapter.inspectAction(actionId));
      if (receipt.actionId !== actionId || (receipt.outcome === 'SUCCEEDED' && receipt.operation !== action.kind)) fail('INVALID_RECEIPT', 'Reconciliation receipt does not match the uncertain action');
      if (!['SUCCEEDED', 'NOT_EXECUTED'].includes(receipt.outcome)) fail('UNRESOLVED_ACTION', 'Simulator still has an unknown outcome; no retry is allowed');
      if (receipt.outcome === 'SUCCEEDED') {
        const ids = returnedIds(receipt);
        if (action.kind !== 'create_survey' && Object.entries(ids).some(([key, value]) => current()[key] !== value)) fail('REMOTE_ID_CONFLICT', 'Reconciliation changed the stored IDs');
        if (action.kind === 'create_survey') {
          if (!ids.surveyId || !ids.conversationId || (!live && !object(receipt.questionMap))) fail('INVALID_RECEIPT', 'Creation reconciliation requires verified IDs and applicable question mapping');
          if (receipt.questionMap) { const mapped = plan().questions.map(q => id(receipt.questionMap[q.id], 'provider question ID'));
            if (Object.keys(receipt.questionMap).length !== mapped.length || new Set(mapped).size !== mapped.length) fail('INVALID_QUESTION_MAP', 'Creation reconciliation needs unique question IDs'); }
        }
      }
      return store.reconcileAction(actionId, { outcome: receipt.outcome, sourceRef: save(receipt), remoteIds: receipt.outcome === 'SUCCEEDED' ? returnedIds(receipt) : {} });
    },
    resume() {
      if (INTERRUPTED.includes(state().stage)) store.resume();
      this.prepareContext();
      settleStages();
      const round = state().activeRound;
      if (state().stage === 'ANSWERS_VALIDATED' && agentDecision('ANALYSIS', round)) {
        store.transition(round === 1 ? 'ROUND_1_ANALYZED' : 'ROUND_2_ANALYZED', { reason: 'Recovered a persisted Codex analysis; no tool dispatch.' });
      }
      const followup = agentDecision('FOLLOWUP', 1);
      if (state().stage === 'ROUND_1_ANALYZED' && followup) store.transition('FOLLOWUP_DECISION', { reason: 'Recovered a persisted Codex follow-up decision.' });
      if (state().stage === 'FOLLOWUP_DECISION' && followup && !state().followup) {
        store.recordDecision({ decision: followup.payload.decision, reasoningSummary: followup.payload.reasoningSummary,
          observedEvidenceRefs: resolveSupport(followup.payload.support, { currentRoundOnly: true }), outcome: followup.origin, nextAction: 'Continue the recorded decision without repeating remote work.' });
      }
      if (state().stage === 'FOLLOWUP_DECISION' && state().followup?.decision === 'CREATE_FOLLOWUP') store.startRound2();
      if (state().activeRound === 2 && state().stage === 'DRAFT_PLAN' && !plan(2) && followup?.payload.plan) {
        logOutput('PLAN', { ...followup, kind: 'PLAN', payload: followup.payload.plan, derivedFromRound: 1 }, state().followup.observedEvidenceRefs);
      }
      if (state().stage === 'FINAL_REPORT' && agentDecision('FINAL')) return report(agentDecision('FINAL'));
      return state();
    },
    report() {
      const entry = event('FINAL_REPORT_SAVED');
      return entry ? read(entry.observedEvidenceRefs[0]) : null;
    }
  };
}
module.exports = { createWorkflow };
