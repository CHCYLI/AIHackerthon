'use strict';
// TEST DATA simulator. This module has no network, wallet or LLM dependency.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { fail, digest } = require('./challenge-safety.cjs');
const { validateToolRequest, assertMock } = require('./challenge-mcp.cjs');
const sample = require('../challenge/fixtures/workflow-responses.json');
const CASES = ['valid', 'empty', 'create-fail', 'pending', 'delayed', 'unknown', 'retrieval-fail', 'invalid', 'payment-required'];
function createOfflineAdapter({ directory, fixtureCase = 'valid', fixture = sample } = {}) {
  if (!CASES.includes(fixtureCase) || fixture.label !== 'TEST DATA') fail('INVALID_FIXTURE', 'Expected a labeled known offline case');
  directory = path.resolve(directory);
  const file = path.join(directory, 'offline-adapter.json');
  function load() {
    const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { label: 'TEST DATA', fixtureCase, fixtureHash: digest(fixture), calls: [], reads: 0 };
    if (data.label !== 'TEST DATA' || data.fixtureCase !== fixtureCase || data.fixtureHash !== digest(fixture)) fail('FIXTURE_CHANGED', 'Resume must use the original simulator configuration');
    return data;
  }
  load();
  function update(change) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const lock = path.join(directory, '.adapter.lock');
    const fd = fs.openSync(lock, 'wx', 0o600);
    try {
      const data = load();
      if (data.fixtureCase !== fixtureCase || data.fixtureHash !== digest(fixture)) fail('FIXTURE_CHANGED', 'Resume must use the original simulator configuration');
      const value = change(data);
      const temporary = path.join(directory, randomUUID() + '.adapter.tmp');
      const out = fs.openSync(temporary, 'wx', 0o600);
      try { fs.writeFileSync(out, JSON.stringify(data, null, 2)); fs.fsyncSync(out); } finally { fs.closeSync(out); }
      fs.renameSync(temporary, file);
      return structuredClone(value);
    } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  const envelope = operation => ({ label: 'TEST DATA', mock: true, adapter: 'offline-flashpoint-v1', operation });
  function ids(round) {
    return { survey_id: 'TEST-survey-r' + round, conversation_id: 'TEST-conversation-r' + round,
      panel_id: 'TEST-analytics-panel-r' + round, research_run_id: 'TEST-provider-run-r' + round };
  }
  function checkScope(request, scope) {
    if (!scope || request.arguments.survey_id !== scope.surveyId || request.arguments.conversation_id !== scope.conversationId) fail('EVIDENCE_SCOPE_MISMATCH', 'Request must thread the stored survey and conversation IDs');
  }
  return {
    mode: 'offline', fixtureCase,
    execute({ actionId, operation, request, round, scope, questions, recipientCount }) {
      validateToolRequest(request);
      if (!['create_survey', 'publish', 'email_send'].includes(operation) || request.tool !== 'tool_survey') fail('UNSUPPORTED_OPERATION', 'Unsupported offline business operation');
      if (operation !== 'create_survey') checkScope(request, scope);
      return update(data => {
        if (data.calls.some(call => call.actionId === actionId)) fail('DUPLICATE_DISPATCH', 'Simulator never silently replays an action ID');
        const receipt = { ...envelope(operation), actionId, ...ids(round), outcome: 'SUCCEEDED', actualChargeUsd: '0' };
        if (operation === 'create_survey') {
          if (fixtureCase === 'create-fail') receipt.outcome = 'NOT_EXECUTED';
          if (fixtureCase === 'unknown') receipt.outcome = 'UNKNOWN_REMOTE_OUTCOME';
          if (fixtureCase === 'payment-required') { receipt.outcome = 'NOT_EXECUTED'; receipt.httpStatus = 402; receipt.paymentSignatureCreated = false; }
          receipt.questionMap = Object.fromEntries(questions.map(q => [q.id, 'TEST_R' + round + '_' + q.id]));
        }
        if (operation === 'email_send') receipt.invitedCount = recipientCount;
        data.calls.push({ actionId, operation, requestHash: digest(request), receipt });
        return receipt;
      });
    },
    retrieve({ request, scope, round, questionMap, invitedCount }) {
      validateToolRequest(request); checkScope(request, scope);
      return update(data => {
        data.reads++;
        if (fixtureCase === 'retrieval-fail') fail('RETRIEVAL_FAILED', 'TEST DATA retrieval failed; no remote request was made');
        if (fixtureCase === 'delayed' && data.reads === 1) return { ...envelope('retrieve'), ...ids(round), status: 'pending' };
        const receipt = { ...envelope('retrieve'), ...ids(round), status: 'completed', sourceType: 'test_fixture',
          retrievedAt: '2026-11-22T12:00:00.000Z', invitedCount };
        if (fixtureCase === 'empty') {
          receipt.completedRecords = 12;
          receipt.responses = Array.from({ length: 12 }, (_, index) => ({ response_id: 'TEST-empty-' + index, run_id: scope.remoteRunId, status: 'COMPLETE', data: {} }));
        } else {
          const source = fixture.rounds[String(round)];
          if (!source) fail('INVALID_FIXTURE', 'No fixture responses for this round');
          receipt.completedRecords = source.completedRecords;
          receipt.responses = source.records.map(row => {
            if (row === null) return null;
            const answers = {};
            for (const [key, value] of Object.entries(row.answers || {})) {
              if (!questionMap[key]) fail('FIXTURE_PLAN_MISMATCH', 'Fixture answer has no matching authored question: ' + key);
              answers[questionMap[key]] = value;
            }
            return { response_id: row.id, run_id: scope.remoteRunId, survey_id: scope.surveyId,
              source_type: 'test_fixture', status: row.status || 'COMPLETE', is_preview: row.preview === true, data: answers };
          });
        }
        if (fixtureCase === 'invalid') receipt.survey_id = 'TEST-wrong-survey';
        data.lastRetrieval = receipt;
        return receipt;
      });
    },
    status(request) {
      validateToolRequest(request);
      if (request.tool !== 'panel') fail('UNSUPPORTED_OPERATION', 'Expected known-job panel status');
      return { ...envelope('status'), job_id: request.arguments.job_id, status: 'completed', note: 'Mock job status, not evidence of answers.' };
    },
    inspectAction(actionId) {
      const receipt = load().calls.find(call => call.actionId === actionId)?.receipt;
      return receipt ? structuredClone(assertMock(receipt)) : { ...envelope('reconcile'), actionId, outcome: 'NOT_EXECUTED' };
    },
    history: () => structuredClone(load())
  };
}
module.exports = { createOfflineAdapter, CASES };
