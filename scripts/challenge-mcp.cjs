'use strict';
// Verified INPUT boundary. No HTTP, wallet or Flashpoint client is imported.
const { fail, object, id, text } = require('./challenge-safety.cjs');
const contract = require('../challenge/flashpoint-tool-contract.json');

function matches(value, schema) {
  if (schema.anyOf) return schema.anyOf.some(part => matches(value, part));
  if (schema.type === 'null') return value === null;
  if (schema.type === 'integer') return Number.isSafeInteger(value);
  if (schema.type === 'object') return object(value);
  return typeof value === schema.type;
}
function validateToolRequest(request) {
  const schema = contract.toolSchemas[request?.tool];
  if (!schema || !object(request.arguments)) fail('UNSUPPORTED_TOOL', 'Only saved, verified tool input contracts are supported');
  for (const key of schema.required) if (!Object.hasOwn(request.arguments, key)) fail('INVALID_TOOL_INPUT', 'Missing required tool argument: ' + key);
  for (const [key, value] of Object.entries(request.arguments)) {
    if (!schema.properties[key] || !matches(value, schema.properties[key])) fail('INVALID_TOOL_INPUT', 'Unsupported tool argument or type: ' + key);
  }
  if (request.tool === 'tool_survey') text(request.arguments.brief, 'brief', 50000);
  if (request.tool === 'panel' && (request.arguments.action !== 'status' || !request.arguments.job_id)) {
    fail('UNSUPPORTED_OPERATION', 'Phase 5 permits only the known-job panel status input');
  }
  return request;
}
function surveyRequest(brief, scope = null) {
  const args = { brief };
  if (scope) {
    args.survey_id = id(scope.surveyId, 'survey ID');
    args.conversation_id = id(scope.conversationId, 'conversation ID');
  }
  return validateToolRequest({ tool: 'tool_survey', arguments: args });
}
function panelStatusRequest(jobId, conversationId = null) {
  const args = { action: 'status', job_id: id(jobId, 'job ID') };
  if (conversationId) args.conversation_id = id(conversationId, 'conversation ID');
  return validateToolRequest({ tool: 'panel', arguments: args });
}
function assertMock(receipt) {
  if (!object(receipt) || receipt.label !== 'TEST DATA' || receipt.mock !== true || receipt.adapter !== 'offline-flashpoint-v1') {
    fail('UNVERIFIED_RESPONSE_SCHEMA', 'Only explicitly labeled offline simulator receipts can be normalized; live output mapping is a Phase 6 blocker');
  }
  return receipt;
}
function returnedIds(receipt) {
  assertMock(receipt);
  const result = {};
  for (const [remote, local] of Object.entries({ survey_id: 'surveyId', conversation_id: 'conversationId', panel_id: 'panelId', research_run_id: 'remoteRunId' })) {
    if (receipt[remote] != null) result[local] = id(receipt[remote], local);
  }
  return result;
}
function normalizeAnswers(receipt, { round, scope, questionnaire, retrievalSource }) {
  assertMock(receipt);
  if (receipt.operation !== 'retrieve' || receipt.status !== 'completed' || receipt.sourceType !== 'test_fixture') fail('INVALID_EVIDENCE', 'Expected completed TEST DATA response receipt');
  const ids = returnedIds(receipt);
  for (const key of ['surveyId', 'conversationId', 'panelId', 'remoteRunId']) {
    if (scope[key] != null && ids[key] !== scope[key]) fail('EVIDENCE_SCOPE_MISMATCH', 'Simulator response scope differs: ' + key);
  }
  return { schemaVersion: 1, sourceType: 'test_fixture', round, ...ids,
    runId: ids.remoteRunId, retrievalSource, retrievedAt: receipt.retrievedAt,
    invitedCount: receipt.invitedCount, completedRecords: receipt.completedRecords,
    questionnaire, responses: receipt.responses };
}
module.exports = { validateToolRequest, surveyRequest, panelStatusRequest, assertMock, returnedIds, normalizeAnswers };
