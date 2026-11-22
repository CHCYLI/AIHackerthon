'use strict';
// OAuth remains in Codex. Node writes one-shot requests and ingests raw MCP results.
// This module imports no network transport, credential store, wallet or LLM.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createStateStore } = require('./challenge-state.cjs');
const { validateResponses } = require('./challenge-validate.cjs');
const { fail, object, id, text, digest, reference } = require('./challenge-safety.cjs');
const { validateToolRequest, surveyRequest } = require('./challenge-mcp.cjs');
const contract = require('../challenge/flashpoint-tool-contract.json');
const liveAdapters = new WeakSet();
const recipientsFile = path.resolve(__dirname, '../.runtime/challenge/recipients.txt');

function pointer(document, location) {
  if (location === '') return document;
  if (typeof location !== 'string' || !location.startsWith('/')) fail('INVALID_MAPPING', 'Use an explicit JSON pointer into the captured response');
  let value = document;
  for (const encoded of location.slice(1).split('/')) {
    const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
    if (value == null || !Object.hasOwn(value, key)) fail('INVALID_MAPPING', 'Mapped response field is absent');
    value = value[key];
  }
  return value;
}
function toolDocument(raw, profile) {
  if (!object(raw) || (!Array.isArray(raw.content) && !object(raw.structuredContent))) fail('MALFORMED_MCP', 'Expected an actual MCP CallToolResult envelope');
  if (raw.content != null && (!Array.isArray(raw.content) || raw.content.some(block => !object(block) || (block.type === 'text' && typeof block.text !== 'string')))) fail('MALFORMED_MCP', 'MCP content blocks are malformed');
  if (raw.isError === true) {
    const message = (raw.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    if (/\b401\b|unauthori[sz]ed/i.test(message)) fail('AUTHENTICATION_REQUIRED', 'MCP reported authentication/authorization failure; expiry is not established');
    if (/\b402\b|x402_payment_required|payment.required/i.test(message)) fail('PAYMENT_REQUIRED', 'MCP reported payment required; no signing or retry is allowed');
    fail('MCP_TOOL_ERROR', 'MCP returned an error; preserve the raw private receipt');
  }
  let document = pointer(raw, profile.documentPointer);
  if (profile.parseJsonFence === true) {
    const blocks=typeof document==='string'?[...document.matchAll(/```json\s*\n([\s\S]*?)\n```/g)]:[];
    if(blocks.length!==1)fail('MALFORMED_MCP','Require one complete JSON block from the exact captured provider text');
    try{document=JSON.parse(blocks[0][1]);}catch{fail('MALFORMED_MCP','The captured JSON block is not a valid document');}
  }
  if (profile.parseJson === true) {
    try { document = JSON.parse(document); } catch { fail('MALFORMED_MCP', 'Selected MCP text is not JSON; no narrative was converted into evidence'); }
  }
  if (!object(document)) fail('UNVERIFIED_RESPONSE_SCHEMA', 'The selected provider document must be structured data');
  if (document.mock === true || document.label === 'TEST DATA' || ['test_fixture', 'synthetic'].includes(document.sourceType)) fail('SOURCE_MISMATCH', 'Fixture/synthetic envelopes cannot enter a first-party live run');
  return document;
}
function mappedReceipt(raw, profile, context) {
  // A LOCAL mapping contract, never a claim about the provider's unknown output schema.
  if (!object(profile) || profile.reviewed !== true || profile.responseHash !== digest(raw)) fail('UNVERIFIED_RESPONSE_SCHEMA', 'Inspect the actual response and bind a reviewed mapping to its exact hash');
  reference(profile.reviewRef);
  const document = toolDocument(raw, profile);
  const value = key => key==='conversationId' && profile.envelopeFields?.conversationId
    ? pointer(raw,profile.envelopeFields.conversationId) : profile.fields?.[key] == null ? null : pointer(document, profile.fields[key]);
  const ids = {};
  for (const key of ['surveyId', 'conversationId', 'panelId', 'remoteRunId']) if (value(key) != null) ids[key] = id(value(key), key);
  if (profile.status?.meaning === 'APPROVAL_REQUESTED') {
    if (pointer(document, profile.status.pointer) !== profile.status.equals || !ids.conversationId) fail('UNVERIFIED_REMOTE_STATUS', 'Confirmation request needs actual status and conversation evidence');
    return { label: 'REAL_FIRST_PARTY', mock: false, adapter: 'codex-oauth-handoff-v1', operation: context.operation,
      actionId: context.actionId, outcome: 'UNKNOWN_REMOTE_OUTCOME', status: 'AWAITING_PROVIDER_CONFIRMATION', ids, rawHash: digest(raw),
      note: 'Provider confirmation is not user approval. Preserve IDs and verify whether any resource exists before a further request.' };
  }
  if (!ids.surveyId || !ids.conversationId) fail('MISSING_REMOTE_IDS', 'Confirmed results need actual survey and conversation IDs; partial IDs remain in the raw capture');
  if (context.scope) for (const [key, expected] of Object.entries(context.scope)) {
    if (expected != null && ids[key] !== expected) fail('EVIDENCE_SCOPE_MISMATCH', 'Provider response does not match the stored ' + key);
  }
  if (!object(profile.status) || !Object.hasOwn(profile.status, 'equals') || pointer(document, profile.status.pointer) !== profile.status.equals) fail('UNVERIFIED_REMOTE_STATUS', 'Reviewed operation-status evidence is missing or changed');
  const receipt = { label: 'REAL_FIRST_PARTY', mock: false, adapter: 'codex-oauth-handoff-v1', operation: context.operation,
    actionId: context.actionId, outcome: 'SUCCEEDED', ids, rawHash: digest(raw), mappingReviewRef: profile.reviewRef,
    actualChargeUsd: '0', platformBillingVerified: false, status: context.operation === 'retrieve' ? 'completed' : profile.status.meaning };
  const meanings = { create_survey: 'DRAFT_CREATED', publish: 'PUBLISHED', email_send: 'INVITATIONS_SENT', retrieve: 'ANSWERS_RETURNED', inspect_survey:'INSTRUMENT_RETURNED' };
  if (profile.status.meaning !== meanings[context.operation]) fail('UNVERIFIED_REMOTE_STATUS', 'An explicit operation-specific interpretation is required');
  if (['create_survey','inspect_survey'].includes(context.operation)) {
    receipt.questionMap = null;
    if(context.operation==='inspect_survey' && (!Array.isArray(profile.questions)||!Array.isArray(context.questions)||!context.questions.length))fail('UNVERIFIED_INSTRUMENT','Full inspection needs the actual question mapping and current reviewed plan');
    if (profile.questions) {
      const mapping = {};
      for (const q of context.questions) {
        const source = profile.questions.find(item => item.planningId === q.id);
        if (!source || pointer(document, source.promptPointer) !== q.prompt || pointer(document, source.typePointer) !== q.type) fail('INSTRUMENT_MISMATCH', 'Actual draft instrument must match the reviewed question text/type');
        if(context.operation==='inspect_survey' && (pointer(document,source.subtypePointer)!==source.subtypeValue || (q.type==='text' && (!Array.isArray(pointer(document,source.optionsPointer)) || pointer(document,source.optionsPointer).length))))fail('INSTRUMENT_MISMATCH','Inspect the actual subtype and text-question option fields explicitly');
        if (q.options && digest(pointer(document, source.optionsPointer)) !== digest(q.options)) fail('INSTRUMENT_MISMATCH', 'Actual option codes/labels differ from the reviewed instrument');
        mapping[q.id] = id(pointer(document, source.idPointer), 'provider question ID');
      }
      if (profile.questions.length !== context.questions.length || new Set(Object.values(mapping)).size !== context.questions.length) fail('INVALID_QUESTION_MAP', 'Exact unique question mapping is required');
      receipt.questionMap = mapping;
    }
    if(context.operation==='inspect_survey'){
      const spec=profile.instrument,research=context.research;
      if(!object(spec)||!research||profile.status.equals!=='draft')fail('UNVERIFIED_INSTRUMENT','Only an explicitly reviewed existing draft instrument can be verified');
      for(const [field,location] of [['title','titlePointer'],['participantIntroduction','introductionPointer'],['stimulus','stimulusPointer']])if(typeof research[field]!=='string'||pointer(document,spec[location])!==research[field])fail('INSTRUMENT_MISMATCH','Actual title, introduction and stimulus must match the reviewed instrument');
      const version=pointer(document,spec.versionPointer),revision=pointer(document,spec.revisionPointer);
      if(!Number.isSafeInteger(version)||version<1||!Number.isSafeInteger(revision)||revision<1)fail('UNVERIFIED_INSTRUMENT','Actual draft version and revision are required');
      receipt.instrument={title:research.title,version,revision,documentHash:digest(pointer(document,spec.contentPointer)),rawHash:digest(raw)};
    }
  }
  if (context.operation === 'email_send' && value('invitedCount') !== context.recipientCount) fail('RECIPIENT_MISMATCH', 'Actual send count differs from the approved recipient count');
  if (context.operation === 'retrieve') {
    const spec = profile.answers;
    if (!object(spec) || !object(spec.pagination) || pointer(document, spec.pagination.pointer) !== spec.pagination.equals) fail('UNVERIFIED_PAGINATION', 'Actual response completeness/pagination needs an explicit reviewed proof');
    const selected = pointer(document, spec.recordsPointer),rows=spec.singleRecord===true?[selected]:selected;
    if (!Array.isArray(rows)) fail('INVALID_EVIDENCE', 'Actual answer rows are required');
    let questionnaire = pointer(document, spec.questionnairePointer);
    if(spec.questionDefinition){
      if(!Array.isArray(questionnaire))fail('INVALID_EVIDENCE','Mapped question definitions must be the actual returned array');
      const definitions={};
      for(const q of questionnaire){const key=id(pointer(q,spec.questionDefinition.id),'question ID');if(Object.hasOwn(definitions,key))fail('INVALID_QUESTION_MAP','Duplicate returned question definition');definitions[key]={type:pointer(q,spec.questionDefinition.type)};}
      questionnaire=definitions;
    }
    if (digest(questionnaire) !== digest(context.questionnaire)) fail('INSTRUMENT_MISMATCH', 'Retrieved question/option definitions differ from the confirmed draft');
    const evidence = { schemaVersion: 1, sourceType: 'real_first_party', round: context.round, surveyId: ids.surveyId,
      conversationId: ids.conversationId, panelId: ids.panelId ?? null, runId: ids.remoteRunId ?? null,
      retrievalSource: context.rawRef, retrievedAt: context.capturedAt, invitedCount: spec.invitedPointer?pointer(document,spec.invitedPointer):context.invitedCount,
      completedRecords: spec.completedPointer == null ? null : pointer(document, spec.completedPointer), questionnaire,
      responses: rows.map(row => {
        if(!object(row)) return null;
        const field = location => { try { return pointer(row,location); } catch(error) { if(error.code==='INVALID_MAPPING') return undefined; throw error; } };
        let answers=field(spec.row.answers);
        if(spec.answerObjects && object(answers)){
          const values={};
          for(const [key,answer] of Object.entries(answers)){
            const questionId=pointer(answer,spec.answerObjects.id);
            if(spec.answerObjects.metadata?.some(m=>m.key===key&&m.questionId===questionId)){
              (receipt.excludedAuxiliaryMetadata??=[]).push({key,reason:'Explicitly reviewed platform-reserved non-question variable; value retained only in raw response'});continue;
            }
            id(questionId,'question ID');if(Object.hasOwn(values,questionId))fail('INVALID_EVIDENCE','Duplicate actual answer question ID');
            values[questionId]=pointer(answer,spec.answerObjects.value);
          }
          answers=values;
        }
        return { response_id: field(spec.row.id),
          ...(ids.remoteRunId ? { run_id: field(spec.row.runId) } : {}),
          ...(spec.row.surveyId ? { survey_id: field(spec.row.surveyId) } : {}),
          ...(spec.row.sourceType ? { source_type: field(spec.row.sourceType) } : {}),
          status: field(spec.row.status) === spec.completeValue ? 'COMPLETE' : 'INCOMPLETE',
          ...(spec.row.preview || spec.row.isTest ? { is_preview: (spec.row.preview&&field(spec.row.preview)===true)||(spec.row.isTest&&field(spec.row.isTest)===true) } : {}),
          ...(spec.row.excluded ? { excluded: field(spec.row.excluded) } : {}),
          data: answers };
      }) };
    validateResponses(evidence, { sourceType: 'real_first_party', round: context.round, ...ids, runId: ids.remoteRunId });
    receipt.evidence = evidence;
  }
  return receipt;
}
function readRecipients() {
  if (!fs.existsSync(recipientsFile)) fail('RECIPIENTS_MISSING', 'Only .runtime/challenge/recipients.txt may supply real recipients; it is absent');
  const stat = fs.lstatSync(recipientsFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 100000) fail('UNSAFE_RECIPIENTS', 'Allowlist must be a regular bounded private file');
  const recipients = fs.readFileSync(recipientsFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  if (!recipients.length || recipients.some(email => !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email))
    || new Set(recipients.map(email => email.toLowerCase())).size !== recipients.length) fail('INVALID_RECIPIENTS', 'Allowlist is empty, malformed or duplicated; addresses are withheld');
  return { recipients, recipientsHash: digest(recipients), recipientCount: recipients.length };
}
function createLiveAdapter({ directory, accountContext = {}, invokeTool = null } = {}) {
  directory = path.resolve(directory);
  const folder = path.join(directory, 'live-handoff');
  const store = createStateStore({ directory });
  function file(operationId, suffix) { id(operationId, 'handoff ID'); return path.join(folder, operationId + '.' + suffix + '.json'); }
  function put(operationId, suffix, value) {
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    if (fs.lstatSync(folder).isSymbolicLink()) fail('UNSAFE_PATH', 'Handoff folder cannot be a link');
    const location = file(operationId, suffix);
    if (fs.existsSync(location)) {
      if (digest(get(operationId, suffix)) !== digest(value)) fail('HANDOFF_CONFLICT', 'An existing one-shot handoff artifact cannot be changed');
      return value;
    }
    const fd = fs.openSync(location, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(value, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return value;
  }
  function get(operationId, suffix) {
    const location = file(operationId, suffix), stat = fs.lstatSync(location);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('UNSAFE_PATH', 'Handoff artifact must be a regular file');
    return JSON.parse(fs.readFileSync(location, 'utf8'));
  }
  const has = (operationId, suffix) => fs.existsSync(file(operationId, suffix));
  function ready(context) {
    if (context?.teamVerified !== true || !context.teamName || !context.teamEvidenceRef || context.authentication !== 'codex_oauth') fail('TEAM_UNVERIFIED', 'Verify the actual OAuth account/team belongs to intended CarbonX before any resource creation');
    text(context.teamName, 'verified team'); reference(context.teamEvidenceRef);
    if (!context.discoveryRef || !Number.isFinite(Date.parse(context.discoveredAt)) || Date.now() - Date.parse(context.discoveredAt) > 3600000 || Date.parse(context.discoveredAt) > Date.now() + 60000) fail('STALE_DISCOVERY', 'Refresh authenticated schema discovery before dispatch');
    reference(context.discoveryRef);
    if (!context.discoveryRef.startsWith('file:')) fail('UNVERIFIED_DISCOVERY', 'Use an actual run-local sanitized discovery artifact');
    const relative = context.discoveryRef.slice(5), location = path.resolve(directory, relative);
    if (path.relative(directory, location).startsWith('..') || path.isAbsolute(path.relative(directory, location))) fail('UNVERIFIED_DISCOVERY', 'Discovery must remain inside the private run');
    const discovery = JSON.parse(fs.readFileSync(location, 'utf8'));
    if (discovery.authStatus !== 'oAuth' || discovery.checkedAt !== context.discoveredAt || !object(discovery.toolSchemas?.tool_survey) || digest(discovery.toolSchemas.tool_survey) !== digest(contract.toolSchemas.tool_survey)) fail('UNVERIFIED_DISCOVERY', 'Current OAuth discovery and schema proof do not match');
  }
  function checkState() {
    const state = store.load();
    if (state.sourceType !== 'real_first_party') fail('SOURCE_MISMATCH', 'Live adapter cannot use fixture or synthetic runs');
    return state;
  }
  function claim(operationId) {
    const request = get(operationId, 'request'), state = checkState();
    ready(request.accountContext);
    if(has(operationId,'cancelled')) fail('APPROVAL_REQUIRED','This unclaimed read was cancelled');
    if (digest(request.accountContext) !== digest(accountContext)) fail('APPROVAL_SCOPE_MISMATCH', 'OAuth/team context changed after the exact request was approved');
    if (request.runId !== state.runId || request.round !== state.activeRound) fail('HANDOFF_SCOPE_MISMATCH', 'Handoff belongs to another run or round');
    if (!['retrieve', 'inspect_survey'].includes(request.operation)) {
      const action = state.actions.find(a => a.id === operationId);
      if (!action || action.status !== 'IN_FLIGHT' || action.requestHash !== request.requestHash) fail('APPROVAL_REQUIRED', 'A consumed exact approval and in-flight state intent are required');
    } else {
      const stages = request.operation === 'inspect_survey' ? ['DRAFT_SURVEY_CREATED', 'AWAITING_APPROVAL'] : ['AWAITING_RESPONSES', 'RESPONSES_RETRIEVED'];
      if (!stages.includes(state.stage)) fail('INVALID_STAGE', 'This scoped read is not allowed at this stage');
      const round=state.rounds.at(-1);
      for(const key of ['surveyId','conversationId','panelId','remoteRunId']) if(request.scope[key]!==round[key]) fail('HANDOFF_SCOPE_MISMATCH','Read permit no longer matches the current study');
    }
    if (request.operation === 'email_send' && readRecipients().recipientsHash !== request.recipientsHash) fail('CONSENT_CHANGED', 'Allowlist changed before dispatch; stop and reconcile non-execution');
    validateToolRequest(request.request);
    if (has(operationId, 'claim')) fail('DUPLICATE_DISPATCH', 'This exact handoff was already claimed; inspect its outcome, never replay');
    // O_EXCL is the cross-process one-shot boundary; write it before calling Codex.
    const fd = fs.openSync(file(operationId, 'claim'), 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify({ operationId, requestHash: request.requestHash, claimedAt: new Date().toISOString() })); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return { operationId, tool: request.request.tool, arguments: request.request.arguments, requestHash: request.requestHash,
      runtimeTool: 'mcp__flashpoint__tool_survey', note: 'Invoke once through the verified configured Flashpoint MCP OAuth connection, then capture the exact raw result. Node has no OAuth token. Do not substitute a separately connected app account.' };
  }
  function capture(operationId, raw, profile = null, research = null) {
    const request = get(operationId, 'request'); checkState();
    if (!has(operationId, 'claim')) fail('UNCLAIMED_HANDOFF', 'A result cannot be attached before the exact one-shot dispatch was claimed');
    put(operationId, 'raw', raw);
    if (!has(operationId,'capture-meta')) put(operationId,'capture-meta',{capturedAt:new Date().toISOString()});
    if (!profile) return { operationId, outcome: 'UNKNOWN_REMOTE_OUTCOME', blocker: 'UNVERIFIED_RESPONSE_SCHEMA', rawHash: digest(raw) };
    const rawRef = 'file:live-handoff/' + operationId + '.raw.json';
    const capturedAt = get(operationId, 'capture-meta').capturedAt;
    const receipt = mappedReceipt(raw, profile, { ...request, actionId: operationId, rawRef, capturedAt,
      ...(request.operation==='inspect_survey'?{questions:research?.questions,research}:{}) });
    put(operationId, 'profile', profile); put(operationId, 'receipt', receipt);
    return receipt;
  }
  async function dispatch(request) {
    put(request.actionId, 'request', request);
    if (has(request.actionId, 'claim')) fail('DUPLICATE_DISPATCH', 'Already claimed; reconciliation is required');
    if (!invokeTool) return { label: 'REAL_FIRST_PARTY', mock: false, adapter: 'codex-oauth-handoff-v1', status: 'handoff_required',
      operation: request.operation, actionId: request.actionId, outcome: 'PENDING_HANDOFF', handoffRef: 'file:live-handoff/' + request.actionId + '.request.json' };
    const call = claim(request.actionId);
    const raw = await invokeTool(call.tool, call.arguments);
    capture(request.actionId, raw);
    return { label: 'REAL_FIRST_PARTY', mock: false, adapter: 'codex-oauth-handoff-v1', operation: request.operation,
      actionId: request.actionId, outcome: 'UNKNOWN_REMOTE_OUTCOME', rawHash: digest(raw) };
  }
  const adapter = {
    mode: 'live', label: 'REAL_FIRST_PARTY', sourceType: 'real_first_party', accountContext,
    assertReady: manifest => { ready(accountContext); if(manifest && digest(manifest.accountContext)!==digest(accountContext)) fail('APPROVAL_SCOPE_MISMATCH','Account/team context changed after review'); }, claim, capture,
    assertReceipt(receipt) {
      if (!object(receipt) || receipt.label !== 'REAL_FIRST_PARTY' || receipt.mock !== false || receipt.adapter !== 'codex-oauth-handoff-v1') fail('SOURCE_MISMATCH', 'Expected a reviewed live receipt, never TEST DATA');
      return receipt;
    },
    returnedIds: receipt => receipt.ids || {},
    normalizeAnswers(receipt, { retrievalSource }) {
      adapter.assertReceipt(receipt);
      if (!receipt.evidence) fail('UNVERIFIED_RESPONSE_SCHEMA', 'Actual answer mapping has not been reviewed');
      return { ...receipt.evidence, retrievalSource };
    },
    approvalDetails: () => ({ accountContext, billing: 'Subscription/credit consumption is unverified; no payment or wallet authorization is permitted.', reversible: 'Draft deletion/undo has not been verified; no automatic rollback.', duplicateRisk: 'One-shot local intent; remote idempotency is unverified. Never retry an uncertain operation.' }),
    prepareRequest({ kind, scope, research, context }) {
      let brief;
      if (kind === 'create_survey') {
        const team = accountContext.teamName || accountContext.intendedTeam || '[TEAM_UNVERIFIED]';
        const identity = accountContext.teamVerified === true && accountContext.teamVerificationStatus === 'USER_VERIFIED'
          ? 'The user has explicitly confirmed that the team selected during Flashpoint MCP OAuth is ' + team + '. Accept this as USER_VERIFIED ownership based on the user attestation, not independent API verification. Do not require an unavailable team-identity API lookup or ask the user to repeat this confirmed fact. If available platform context explicitly contradicts that team, stop and report the mismatch. '
          : 'Before creating anything, verify the authenticated account and selected team match the intended team ' + team + '. If identity cannot be verified, return the blocker and do not create. ';
        brief = 'Prepare a DRAFT survey. Do not publish. ' + identity + 'Create exactly one draft using the reviewed instrument. If this conversation already has a survey, return its existing IDs instead of creating another. If entitlement or the no-additional-payment scope cannot be satisfied, stop and return the blocker. Do not distribute, email, recruit, generate synthetic/test responses, authorize payment, confirm charges or do additional work. Return the actual survey_id, conversation_id, survey status, actual question IDs/types/prompts and any usage/quota information available. Show respondents only the participantIntroduction, stimulus and question prompts; do not expose internal analysis criteria or plan rationale. Use this objective, actual illustrative model context and independently authored plan: ' + JSON.stringify({ objective: context.objective, model: context.model, research });
      }
      else if (kind === 'publish') brief = 'Publish only this reviewed existing survey in the verified team ' + accountContext.teamName + ' (USER_VERIFIED, not independently API-verified). Do not create or edit a survey, send emails/invitations, distribute, recruit, generate responses/test data, authorize payment, confirm charges or perform additional work. Additional payment authorization is zero. Stop on a payment requirement or any additional provider confirmation; do not automatically relay confirm or retry.' + (context.instrument ? ' Before publishing, verify the existing draft still has the reviewed title '+JSON.stringify(context.instrument.title)+', version '+context.instrument.version+' and revision '+context.instrument.revision+'. Stop if it differs; do not fix or replace it. Reviewed document SHA-256: '+context.instrument.documentHash+'.' : '');
      else if (kind === 'email_send') {
        const list = readRecipients();
        brief = 'Send this survey invitation exactly once only to the following explicitly approved and consenting addresses: ' + JSON.stringify(list.recipients) + '. Do not add other recipients, send reminders, recruit, generate responses, authorize payment or do additional work.';
      } else fail('UNSUPPORTED_OPERATION', 'Unsupported live operation');
      if (kind !== 'create_survey') return surveyRequest(brief, scope);
      const args = { brief };
      if (scope.conversationId) args.conversation_id = scope.conversationId;
      return validateToolRequest({ tool: 'tool_survey', arguments: args });
    },
    recipients: readRecipients,
    async execute(input) {
      const state = checkState(); ready(accountContext);
      const action = state.actions.find(a => a.id === input.actionId);
      if (!action || action.status !== 'IN_FLIGHT' || digest(input.manifest) !== action.requestHash || input.manifest.kind !== input.operation) fail('APPROVAL_REQUIRED', 'Reviewed manifest must match the existing in-flight action exactly');
      if (digest(input.manifest.accountContext) !== digest(accountContext)) fail('APPROVAL_SCOPE_MISMATCH', 'Account/team context changed after request review');
      if (input.manifest.maxChargeUsd !== '0' || input.manifest.businessCalls !== 1 || input.manifest.paidRetries !== 0) fail('PAYMENT_NOT_AUTHORIZED', 'OAuth handoff supports one call and zero authorized payments/retries');
      return dispatch({ ...input, runId: state.runId, requestHash: action.requestHash, accountContext,
        recipientsHash: input.manifest.recipientsHash, request: input.manifest.request });
    },
    authorizeRead({ request, scope, round, confirmed, userApprovalRef, purpose = 'answers' }) {
      const state=checkState(); ready(accountContext); validateToolRequest(request);
      if(!['answers','instrument'].includes(purpose)) fail('INVALID_READ_PURPOSE','Use an explicit supported read purpose');
      const stages=purpose==='instrument'?['DRAFT_SURVEY_CREATED','AWAITING_APPROVAL']:['AWAITING_RESPONSES','RESPONSES_RETRIEVED'];
      if(round!==state.activeRound || !stages.includes(state.stage)) fail('INVALID_STAGE','Read purpose must match the current round and stage');
      if(purpose==='instrument' && !request.arguments.brief.startsWith('Read the complete existing survey draft only.')) fail('INVALID_READ_PURPOSE','Instrument reads require the reviewed read-only draft instruction');
      const current=state.rounds.at(-1);
      if(['surveyId','conversationId','panelId','remoteRunId'].some(key=>scope[key]!==current[key]) || request.arguments.survey_id!==current.surveyId || request.arguments.conversation_id!==current.conversationId) fail('HANDOFF_SCOPE_MISMATCH','Read authorization must bind the actual current study IDs');
      if (confirmed !== true) fail('APPROVAL_REQUIRED', 'An explicit scoped read authorization is required because agent billing is unverified');
      reference(userApprovalRef);
      if(fs.existsSync(folder)) for(const name of fs.readdirSync(folder).filter(name=>name.endsWith('.read-permit.json'))) {
        const existingId=name.slice(0,-'.read-permit.json'.length),permit=get(existingId,'read-permit');
        if(permit.runId===state.runId && permit.round===round && !has(existingId,'receipt') && !has(existingId,'cancelled')) fail('UNRESOLVED_ACTION','An existing live read needs capture/reconciliation, or explicit cancellation before dispatch; no duplicate read authorization');
      }
      const actionId = randomUUID();
      return put(actionId, 'read-permit', { actionId, runId: checkState().runId, operation: purpose==='instrument'?'inspect_survey':'retrieve', round, request, scope,
        userApprovalRef, accountContext, requestHash: digest({ request, scope, round }), authorizedAt: new Date().toISOString() });
    },
    async retrieve(input) {
      const state = checkState(); ready(accountContext);
      const hash = digest({ request: input.request, scope: { surveyId: input.scope.surveyId, conversationId: input.scope.conversationId,
        panelId: input.scope.panelId, remoteRunId: input.scope.remoteRunId }, round: input.round });
      const permits = fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => name.endsWith('.read-permit.json')).map(name => get(name.slice(0, -'.read-permit.json'.length), 'read-permit')).filter(p => p.requestHash === hash && p.runId === state.runId && !has(p.actionId,'cancelled')).sort((a,b) => b.authorizedAt.localeCompare(a.authorizedAt)) : [];
      if (!permits.length) fail('READ_APPROVAL_REQUIRED', 'Prepare and explicitly authorize this exact read; it is not assumed free');
      const permit = permits[0];
      if (has(permit.actionId, 'receipt')) return get(permit.actionId, 'receipt');
      if (has(permit.actionId, 'claim')) fail('UNRESOLVED_ACTION', 'Read outcome requires capture/mapping, not another agent call');
      return dispatch({ ...input, ...permit, questionnaire: input.questionnaire, invitedCount: input.scope.invitedCount });
    },
    cancelRead(actionId,userApprovalRef) {
      checkState();reference(userApprovalRef);get(actionId,'read-permit');
      if(has(actionId,'claim'))fail('UNRESOLVED_ACTION','A claimed read must be reconciled, not cancelled or replayed');
      return put(actionId,'cancelled',{actionId,userApprovalRef,cancelledAt:new Date().toISOString()});
    },
    inspectAction(actionId) {
      if (has(actionId, 'receipt')) return get(actionId, 'receipt');
      if (has(actionId, 'request') && !has(actionId, 'claim')) return { label: 'REAL_FIRST_PARTY', mock: false, adapter: 'codex-oauth-handoff-v1',
        operation: get(actionId, 'request').operation, actionId, outcome: 'NOT_EXECUTED', proof: 'Durable request exists and no dispatch claim was created.' };
      return { label: 'REAL_FIRST_PARTY', mock: false, adapter: 'codex-oauth-handoff-v1', actionId, outcome: 'UNKNOWN_REMOTE_OUTCOME' };
    }
  };
  liveAdapters.add(adapter); return adapter;
}
module.exports = { createLiveAdapter, isLiveAdapter: adapter => liveAdapters.has(adapter), mappedReceipt, readRecipients, pointer };
