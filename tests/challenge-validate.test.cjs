'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { validateResponses } = require('../scripts/challenge-validate.cjs');
const { evidence } = require('./challenge-fixtures.cjs');
const exclusions = result => Object.fromEntries(result.exclusions.map(row => [row.reason, row.count]));

test('12 COMPLETE records with empty answers produce insufficient evidence', () => {
  const payload = evidence({ completedRecords: 12, responses: Array.from({ length: 12 }, (_, i) => ({ response_id: 'fixture-' + i, run_id: 'fixture-provider-run-1', status: 'COMPLETE', data: {} })) });
  const result = validateResponses(payload);
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE'); assert.equal(result.analysisEligible, false);
  assert.equal(result.completedRecords, 12); assert.equal(result.retrievedAnswerRecords, 12); assert.equal(result.usableAnswerRecords, 0);
  assert.deepEqual(result.validAnswersPerQuestion, { Q1: 0, Q2: 0 });
});

test('valid answer normalization preserves original evidence and counts actual question codes', () => {
  const payload = evidence(), before = structuredClone(payload), result = validateResponses(payload);
  assert.deepEqual(payload, before); assert.equal(result.status, 'VALID_ANSWERS'); assert.equal(result.usableAnswerRecords, 2);
  assert.deepEqual(result.questionCounts[0], { questionId: 'Q1', denominator: 2, counts: { 1: 1, 2: 1 } });
  assert.equal(result.records[0].answers.Q1, '1'); assert.equal(result.records[0].answers.Q2, 'Fixture explanation A');
  assert.ok(!JSON.stringify(result).includes('fixture-record-a')); assert.match(result.evidenceRef, /^evidence:[a-f0-9]{64}$/);
});

test('duplicate, malformed, out-of-scope and unknown-question rows are excluded', () => {
  const source = evidence(), a = source.responses[0], b = source.responses[1];
  const rows = [a, { ...a, data: { Q1: '2' } }, b, null, { ...b, response_id: '../invalid' },
    { ...b, response_id: 'wrong-survey', survey_id: 'another-survey' }, { ...b, response_id: 'unknown-question', data: { MISSING: '1' } }];
  const result = validateResponses({ ...source, completedRecords: 12, responses: rows });
  assert.equal(result.retrievedAnswerRecords, 7); assert.equal(result.usableAnswerRecords, 1);
  assert.deepEqual(exclusions(result), { duplicate_record: 2, malformed_record: 1, invalid_response_id: 1, record_scope_mismatch: 1, unknown_question_id: 1 });
  assert.deepEqual(result.validAnswersPerQuestion, { Q1: 1, Q2: 1 });
});

test('per-question denominators use partial valid answers and exclude previews/incomplete records', () => {
  const source = evidence(), [a, b] = source.responses;
  const result = validateResponses({ ...source, completedRecords: 10, responses: [
    { ...a, data: { Q1: '1', Q2: ' ' } }, { ...b, data: { Q1: 'invalid', Q2: 'Fixture valid open end' } },
    { ...a, response_id: 'preview', is_preview: true }, { ...a, response_id: 'excluded', excluded: true },
    { ...a, response_id: 'incomplete', status: 'INCOMPLETE' }, { ...a, response_id: 'malformed-data', data: [] }
  ] });
  assert.equal(result.usableAnswerRecords, 2); assert.deepEqual(result.validAnswersPerQuestion, { Q1: 1, Q2: 1 });
  assert.equal(exclusions(result).preview_or_excluded, 2); assert.equal(exclusions(result).invalid_answer, 1);
});

test('real, synthetic and fixture classifications are explicit and never merged', () => {
  for (const sourceType of ['real_first_party', 'synthetic', 'test_fixture']) {
    const result = validateResponses(evidence({ sourceType })); assert.equal(result.sourceType, sourceType);
  }
  assert.throws(() => validateResponses(evidence({ sourceType: 'synthetic' }), { sourceType: 'real_first_party' }), { code: 'EVIDENCE_SCOPE_MISMATCH' });
  const input = evidence(); input.responses[0].source_type = 'synthetic';
  assert.equal(validateResponses(input).usableAnswerRecords, 1);
});

test('invalid survey IDs, timestamps and missing scope are rejected', () => {
  for (const patch of [{ surveyId: '../survey' }, { surveyId: '' }, { round: 3 }, { sourceType: 'unknown' }, { retrievedAt: 'not-a-date' }, { retrievalSource: 'https://example.com/private' }]) {
    assert.throws(() => validateResponses(evidence(patch)));
  }
  for (const key of ['surveyId', 'conversationId', 'panelId', 'runId', 'round']) {
    assert.throws(() => validateResponses(evidence(), { [key]: key === 'round' ? 2 : 'wrong-scope' }), { code: 'EVIDENCE_SCOPE_MISMATCH' });
  }
});

test('aggregate-only evidence keeps individual counts unknown and exposes denominators', () => {
  const input = evidence({ responses: undefined, completedRecords: 12, aggregates: [{ questionId: 'Q1', denominator: 5, counts: { 1: 2, 2: 3 } }] });
  const result = validateResponses(input);
  assert.equal(result.status, 'AGGREGATE_ONLY'); assert.equal(result.analysisEligible, true);
  assert.equal(result.usableAnswerRecords, null); assert.equal(result.retrievedAnswerRecords, null);
  assert.equal(result.validAnswersPerQuestion.Q1, 5); assert.equal(result.records.length, 0);
  assert.ok(result.limitations.some(value => value.includes('not individual or open-ended')));
});

test('aggregate distributions without valid denominators cannot justify findings', () => {
  for (const aggregate of [
    { questionId: 'Q1', counts: { 1: 2 } }, { questionId: 'Q1', denominator: -1, counts: {} },
    { questionId: 'Q1', denominator: 2, counts: { 1: 1 } }, { questionId: 'Q1', denominator: 2, counts: { invalid: 2 } },
    { questionId: 'Q1', denominator: 3, counts: { 1: 3 } }, { denominator: 1, counts: { 1: 1 } }
  ]) assert.equal(validateResponses(evidence({ responses: undefined, aggregates: [aggregate] })).status, 'INSUFFICIENT_EVIDENCE');
  const q = { questionId: 'Q1', denominator: 2, counts: { 1: 1, 2: 1 } };
  assert.equal(validateResponses(evidence({ responses: undefined, aggregates: [q, q] })).status, 'INSUFFICIENT_EVIDENCE');
});

test('unknown provider envelopes and malformed questionnaire definitions fail closed', () => {
  for (const bad of [null, [], { result: { status: 'COMPLETE' } }, evidence({ responses: {} }), evidence({ questionnaire: { Q1: null } }),
    evidence({ questionnaire: { Q1: { type: 'select/single' } } }), evidence({ questionnaire: { Q1: { type: 'unknown' } } })]) {
    assert.throws(() => validateResponses(bad), { code: 'INVALID_EVIDENCE' });
  }
  assert.throws(() => validateResponses(evidence({ aggregates: [{ questionId: 'Q1' }] })), { code: 'INVALID_EVIDENCE' });
});

test('missing question mappings and empty response arrays do not create answers', () => {
  assert.equal(validateResponses(evidence({ questionnaire: {} })).status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(validateResponses(evidence({ responses: [] })).retrievedAnswerRecords, 0);
  const countsOnly = validateResponses(evidence({ responses: undefined }));
  assert.equal(countsOnly.retrievedAnswerRecords, null); assert.equal(countsOnly.usableAnswerRecords, 0); assert.equal(countsOnly.analysisEligible, false);
});

test('multi-select duplicates are invalid, numeric zero remains a valid answer', () => {
  const input = evidence({ questionnaire: { Q1: { type: 'select/multiple', options: { 1: 'A', 2: 'B' } }, Q2: { type: 'number' } } });
  input.responses[0].data = { Q1: ['1', '2'], Q2: 0 }; input.responses[1].data = { Q1: ['1', '1'], Q2: Infinity };
  const result = validateResponses(input);
  assert.equal(result.usableAnswerRecords, 1); assert.equal(result.records[0].answers.Q2, 0);
  assert.deepEqual(result.questionCounts[0].counts, { 1: 1, 2: 1 }); assert.equal(exclusions(result).invalid_answer, 2);
});

test('supplied completed counts cannot contradict retrieved complete records', () => {
  assert.throws(() => validateResponses(evidence({ completedRecords: 1 })), { code: 'INVALID_EVIDENCE' });
  assert.equal(validateResponses(evidence({ completedRecords: undefined })).completedRecords, 2);
});
