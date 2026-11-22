'use strict';
// Explicit LOCAL interchange contract. No live answer-output schema is verified.
// Row data matches the existing saved-report adapter; unknown MCP envelopes fail.
const { fail, object, id, digest, reference } = require('./challenge-safety.cjs');
const SOURCES = Object.freeze(['real_first_party', 'synthetic', 'test_fixture']);
function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_EVIDENCE', 'Invalid ' + label);
  return value;
}
function validateResponses(raw, expected = {}) {
  if (!object(raw) || raw.schemaVersion !== 1 || !SOURCES.includes(raw.sourceType)) {
    fail('INVALID_EVIDENCE', 'Expected local evidence schemaVersion 1 and explicit sourceType');
  }
  id(raw.surveyId, 'survey ID');
  if (![1, 2].includes(raw.round)) fail('INVALID_EVIDENCE', 'Round must be 1 or 2');
  for (const key of ['surveyId', 'sourceType', 'round', 'panelId', 'runId', 'conversationId']) {
    if (expected[key] != null && raw[key] !== expected[key]) fail('EVIDENCE_SCOPE_MISMATCH', 'Evidence scope mismatch: ' + key);
    if (raw[key] != null && key.endsWith('Id')) id(raw[key], key);
  }
  reference(raw.retrievalSource);
  if (typeof raw.retrievedAt !== 'string' || !Number.isFinite(Date.parse(raw.retrievedAt))) fail('INVALID_EVIDENCE', 'retrievedAt is required');
  const invitedCount = raw.invitedCount == null ? null : count(raw.invitedCount, 'invitedCount');
  const suppliedCompleted = raw.completedRecords == null ? null : count(raw.completedRecords, 'completedRecords');
  const questionnaire = raw.questionnaire ?? {};
  if (!object(questionnaire) || Object.keys(questionnaire).length > 100) fail('INVALID_EVIDENCE', 'Invalid questionnaire');
  const types = ['select/single', 'select/multiple', 'text', 'number'];
  for (const [key, q] of Object.entries(questionnaire)) {
    id(key, 'question ID');
    if (!object(q) || !types.includes(q.type)) fail('INVALID_EVIDENCE', 'Unsupported question definition');
    if (q.type.startsWith('select/')) {
      if (!object(q.options) || !Object.keys(q.options).length) fail('INVALID_EVIDENCE', 'Question option mapping is required');
      Object.keys(q.options).forEach(code => id(code, 'option code'));
    }
  }
  if (raw.responses != null && !Array.isArray(raw.responses)) fail('INVALID_EVIDENCE', 'responses must be an array');
  if (raw.aggregates != null && !Array.isArray(raw.aggregates)) fail('INVALID_EVIDENCE', 'aggregates must be an array');
  const rows = raw.responses ?? [], aggregates = raw.aggregates ?? [];
  if (rows.length > 10000 || aggregates.length > 100) fail('INVALID_EVIDENCE', 'Evidence exceeds local MVP limits');
  if (rows.length && aggregates.length) fail('INVALID_EVIDENCE', 'Provide individual or aggregate evidence separately');
  const excluded = {}, exclude = reason => { excluded[reason] = (excluded[reason] || 0) + 1; };
  const questions = new Map(Object.entries(questionnaire).map(([questionId, q]) => [questionId,
    { questionId, denominator: 0, ...(q.type.startsWith('select/') ? { counts: Object.fromEntries(Object.keys(q.options).map(code => [code, 0])) } : {}) }]));
  const duplicates = new Map();
  for (const row of rows) if (object(row) && typeof row.response_id === 'string') duplicates.set(row.response_id, (duplicates.get(row.response_id) || 0) + 1);
  let completed = 0;
  const records = [];
  for (const row of rows) {
    if (!object(row)) { exclude('malformed_record'); continue; }
    try { id(row.response_id, 'response ID'); } catch { exclude('invalid_response_id'); continue; }
    if (duplicates.get(row.response_id) > 1) { exclude('duplicate_record'); continue; }
    if ((row.survey_id != null && row.survey_id !== raw.surveyId) || (raw.runId != null && row.run_id !== raw.runId)) { exclude('record_scope_mismatch'); continue; }
    if (row.source_type != null && row.source_type !== raw.sourceType) { exclude('source_type_mismatch'); continue; }
    if (row.status !== 'COMPLETE') { exclude('not_complete'); continue; }
    completed++;
    if (row.is_preview === true || row.excluded === true) { exclude('preview_or_excluded'); continue; }
    if (!object(row.data)) { exclude('malformed_answers'); continue; }
    if (Object.keys(row.data).some(key => !questions.has(key))) { exclude('unknown_question_id'); continue; }
    const answers = {};
    for (const [questionId, q] of Object.entries(questionnaire)) {
      const value = row.data[questionId];
      if (value == null || value === '' || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)) continue;
      let valid = false;
      if (q.type === 'text') valid = typeof value === 'string' && value.length <= 10000;
      if (q.type === 'number') valid = typeof value === 'number' && Number.isFinite(value);
      if (q.type === 'select/single') valid = ['string', 'number'].includes(typeof value) && Object.hasOwn(q.options, String(value));
      if (q.type === 'select/multiple') valid = Array.isArray(value) && value.every(v => ['string', 'number'].includes(typeof v) && Object.hasOwn(q.options, String(v))) && new Set(value.map(String)).size === value.length;
      if (!valid) { exclude('invalid_answer'); continue; }
      answers[questionId] = q.type === 'select/single' ? String(value) : q.type === 'select/multiple' ? value.map(String) : value;
      const result = questions.get(questionId); result.denominator++;
      if (result.counts) for (const code of Array.isArray(answers[questionId]) ? answers[questionId] : [answers[questionId]]) result.counts[code]++;
    }
    if (!Object.keys(answers).length) { exclude('empty_answers'); continue; }
    records.push({ recordRef: digest([raw.surveyId, row.response_id]), answers });
  }
  if (suppliedCompleted != null && suppliedCompleted < completed) fail('INVALID_EVIDENCE', 'Completed count is smaller than retrieved scoped COMPLETE records');
  const aggregateIds = new Map();
  for (const q of aggregates) if (object(q)) aggregateIds.set(q.questionId, (aggregateIds.get(q.questionId) || 0) + 1);
  for (const aggregate of aggregates) {
    if (!object(aggregate) || !questions.has(aggregate.questionId)) { exclude('unknown_question_id'); continue; }
    if (aggregateIds.get(aggregate.questionId) > 1) { exclude('duplicate_aggregate'); continue; }
    const q = questionnaire[aggregate.questionId];
    if (aggregate.denominator == null) { exclude('missing_denominator'); continue; }
    if (!Number.isSafeInteger(aggregate.denominator) || aggregate.denominator < 0 || !object(aggregate.counts) || !q.type.startsWith('select/')) { exclude('malformed_aggregate'); continue; }
    const n = aggregate.denominator, counts = aggregate.counts;
    if (Object.keys(counts).some(code => !Object.hasOwn(q.options, code)) || Object.values(counts).some(v => !Number.isSafeInteger(v) || v < 0 || v > n)
      || (q.type === 'select/single' && Object.values(counts).reduce((a, b) => a + b, 0) !== n)
      || (suppliedCompleted != null && n > suppliedCompleted)) { exclude('malformed_aggregate'); continue; }
    questions.set(aggregate.questionId, { questionId: aggregate.questionId, denominator: n,
      counts: Object.fromEntries(Object.keys(q.options).map(code => [code, counts[code] ?? 0])) });
  }
  const questionCounts = [...questions.values()];
  const aggregateOnly = aggregates.length > 0;
  const eligible = records.length > 0 || (aggregateOnly && questionCounts.some(q => q.denominator > 0));
  return {
    schemaVersion: 1, sourceType: raw.sourceType, round: raw.round, surveyId: raw.surveyId,
    conversationId: raw.conversationId ?? null, panelId: raw.panelId ?? null, runId: raw.runId ?? null,
    retrievedAt: new Date(raw.retrievedAt).toISOString(), retrievalSource: raw.retrievalSource,
    evidenceRef: 'evidence:' + digest(raw),
    status: !eligible ? 'INSUFFICIENT_EVIDENCE' : aggregateOnly ? 'AGGREGATE_ONLY' : 'VALID_ANSWERS',
    analysisEligible: eligible,
    invitedCount, completedRecords: suppliedCompleted ?? (raw.responses != null ? completed : null),
    retrievedAnswerRecords: raw.responses != null ? rows.length : null,
    usableAnswerRecords: aggregateOnly ? null : records.length,
    validAnswersPerQuestion: Object.fromEntries(questionCounts.map(q => [q.questionId, q.denominator])),
    questionCounts,
    questionEvidenceRefs: questionCounts.filter(q => q.denominator > 0).map(q => 'evidence:' + digest(raw) + ':' + q.questionId),
    exclusions: Object.entries(excluded).map(([reason, count]) => ({ reason, count })),
    limitations: [
      'Local structural validation does not verify provider authenticity, survey ownership, consent or source classification.',
      'Retrieved record count includes malformed and duplicate rows; denominators count only validated answers. Duplicate IDs are excluded entirely.',
      ...(aggregateOnly ? ['Individual usable answer count is unknown. Aggregates support only their reported question distributions, not individual or open-ended analysis.'] : []),
      ...(!eligible ? ['No usable question-level evidence. Completion counts alone cannot support findings.'] : []),
      ...(raw.sourceType !== 'real_first_party' ? ['This evidence is ' + raw.sourceType + '; it is not real first-party respondent evidence.'] : [])
    ],
    // Private result only: callers must not put these answers in events or state.
    records
  };
}
module.exports = { validateResponses, SOURCES };
