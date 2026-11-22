'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createWorkflow } = require('./challenge-workflow.cjs');
const { createOfflineAdapter, CASES } = require('./challenge-offline.cjs');
const { fail } = require('./challenge-safety.cjs');
const OBJECTIVE = 'Find the one change CarbonX should make first so a first-time user can understand our steel plant results and explain the trade-off to someone else.';
const recordings = path.resolve(__dirname, '../challenge/fixtures/codex-decisions');
const recipients = Array.from({ length: 12 }, (_, i) => 'TEST-recipient-' + (i + 1));

function replayDecision(workflow, recording) {
  const packet = workflow.checkpoint(recording.kind);
  if (recording.label !== 'TEST DATA' || recording.basisHash !== packet.basisHash) fail('REPLAY_INPUT_MISMATCH', 'Recorded Codex judgment does not match this objective, context, plan and validated answer values; request a fresh Codex decision');
  return workflow.submit({ schemaVersion: 1, label: 'TEST DATA', origin: 'RECORDED_CODEX_REPLAY', kind: recording.kind,
    basisHash: packet.basisHash, inputHash: packet.inputHash, payload: recording.payload });
}
function replayFile(workflow, name) {
  return replayDecision(workflow, JSON.parse(fs.readFileSync(path.join(recordings, name + '.json'), 'utf8')));
}
async function simulatedAction(workflow, kind) {
  const prepared = workflow.requestAction(kind, { recipientIds: kind === 'email_send' ? recipients : [] });
  workflow.approve({ approvalId: prepared.approval.id, requestHash: prepared.approval.requestHash, simulate: true });
  return workflow.execute();
}
async function executeRound(workflow, { pauseAtApproval = false } = {}) {
  const prepared = workflow.requestAction('create_survey');
  if (pauseAtApproval) return workflow.state();
  workflow.approve({ approvalId: prepared.approval.id, requestHash: prepared.approval.requestHash, simulate: true });
  await workflow.execute();
  if (workflow.state().stage !== 'AWAITING_APPROVAL') return workflow.state();
  await simulatedAction(workflow, 'publish');
  await simulatedAction(workflow, 'email_send');
  return workflow.retrieve();
}
function summary(workflow) {
  const state = workflow.state();
  return { label: 'TEST DATA', mode: 'OFFLINE DEMONSTRATION', directory: workflow.directory, runId: state.runId,
    stage: state.stage, sourceType: state.sourceType, round: state.activeRound, events: workflow.store.events().length,
    actions: state.actions.map(a => ({ kind: a.kind, round: a.round, status: a.status, mock: true })),
    pendingApproval: state.pendingApproval ? { id: state.pendingApproval.id, requestHash: state.pendingApproval.requestHash, status: state.pendingApproval.status } : null,
    rounds: state.rounds.map(r => ({ round: r.round, surveyId: r.surveyId, conversationId: r.conversationId, panelId: r.panelId, providerRunId: r.remoteRunId,
      invited: r.invitedCount, complete: r.completedRecords, retrieved: r.retrievedAnswerRecords, usable: r.usableAnswerRecords, evidenceStatus: r.evidence?.status ?? null,
      perQuestion: r.evidence?.validAnswersPerQuestion ?? null })),
    blocker: state.lastError, reportFile: workflow.report() ? path.join(workflow.directory, 'report.md') : null,
    recommendation: workflow.report()?.recommendation.recommendation ?? null,
    realOperations: 0, realSpendingUsd: '0', reasoning: 'Explicit Codex output or input-matched recording replay; no automatic LLM call.' };
}
async function runDemo({ directory, fixtureCase = 'valid' }) {
  const adapter = createOfflineAdapter({ directory, fixtureCase });
  const workflow = createWorkflow({ directory, adapter });
  if (fs.existsSync(path.join(directory, 'run-state.json')) || fs.existsSync(path.join(directory, 'events.jsonl'))) {
    if (workflow.state().stage === 'COMPLETED') return summary(workflow);
    fail('RUN_EXISTS_USE_RESUME', 'Existing incomplete run preserved. Inspect show/checkpoint/recover; do not recreate or automatically redispatch.');
  }
  workflow.initialize({ objective: OBJECTIVE });
  replayFile(workflow, 'plan-r1');
  await executeRound(workflow, { pauseAtApproval: fixtureCase === 'pending' });
  if (workflow.state().stage !== 'ANSWERS_VALIDATED') return summary(workflow);
  replayFile(workflow, 'analysis-r1');
  replayFile(workflow, 'followup-r1');
  if (workflow.state().activeRound === 2) {
    await executeRound(workflow);
    if (workflow.state().stage !== 'ANSWERS_VALIDATED') return summary(workflow);
    replayFile(workflow, 'analysis-r2');
    replayFile(workflow, 'final-r2');
  } else replayFile(workflow, 'final-r1');
  return summary(workflow);
}

const usage = 'Usage: node scripts/challenge-run.cjs demo|init|show|checkpoint|submit|request|approve|reject|execute|retrieve|recover|reconcile|resume --dir <private-directory> [--case <case>] [--kind <kind>] [--file <Codex-output.json>] [--objective <objective>] [--approval <id> --hash <hash>] [--action <id>]';
async function main(argv) {
  const [command, ...args] = argv;
  const options = {};
  const allowed = ['dir', 'case', 'kind', 'file', 'objective', 'approval', 'hash', 'action'];
  if (!command || args.length % 2) fail('USAGE', usage);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !allowed.includes(key) || options[key] != null) fail('USAGE', usage);
    options[key] = args[i + 1];
  }
  const directory = options.dir ? path.resolve(options.dir) : path.resolve(__dirname, '../.runtime/challenge/phase5/' + randomUUID());
  if (!options.dir && command !== 'demo') fail('USAGE', 'An explicit --dir is required except for a fresh demo');
  const fixtureCase = options.case || 'valid';
  if (!CASES.includes(fixtureCase)) fail('USAGE', 'Unknown fixture case');
  if (command === 'demo') return runDemo({ directory, fixtureCase });
  const adapter = createOfflineAdapter({ directory, fixtureCase });
  const workflow = createWorkflow({ directory, adapter });
  if (command === 'init') workflow.initialize({ objective: options.objective || OBJECTIVE });
  else if (command === 'show') return summary(workflow);
  else if (command === 'checkpoint') return workflow.checkpoint(options.kind);
  else if (command === 'submit') workflow.submit(JSON.parse(fs.readFileSync(path.resolve(options.file), 'utf8')));
  else if (command === 'request') return workflow.requestAction(options.kind, { recipientIds: options.kind === 'email_send' ? recipients : [] });
  else if (['approve', 'reject'].includes(command)) workflow.approve({ approvalId: options.approval, requestHash: options.hash, simulate: true, reject: command === 'reject' });
  else if (command === 'execute') await workflow.execute();
  else if (command === 'retrieve') await workflow.retrieve();
  else if (command === 'recover') workflow.recover();
  else if (command === 'reconcile') await workflow.reconcile(options.action);
  else if (command === 'resume') workflow.resume();
  else fail('USAGE', usage);
  return summary(workflow);
}
if (require.main === module) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
    console.error((error.code || 'WORKFLOW_ERROR') + ': ' + (error.code ? error.message : 'Offline workflow failed; inspect local artifacts.'));
    process.exitCode = 1;
  });
}
module.exports = { OBJECTIVE, replayDecision, simulatedAction, executeRound, summary, runDemo, main };
