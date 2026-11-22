'use strict';
// TEST DATA: mocked MCP transport/output examples, not verified provider schemas.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createWorkflow}=require('../scripts/challenge-workflow.cjs');
const {createLiveAdapter,mappedReceipt,readRecipients}=require('../scripts/challenge-live.cjs');
const {digest}=require('../scripts/challenge-safety.cjs');
const {validateResponses}=require('../scripts/challenge-validate.cjs');
function setup(t,{verified=true,invokeTool=null,researchFields={}}={}){
  const root=path.resolve(os.tmpdir()),directory=fs.mkdtempSync(path.join(root,'carbonx-live-test-'));
  t.after(()=>{assert.equal(path.dirname(directory),root);assert.ok(path.basename(directory).startsWith('carbonx-live-test-'));fs.rmSync(directory,{recursive:true,force:true});});
  const accountContext={authentication:'codex_oauth',teamName:verified?'TEST CarbonX':null,teamVerified:verified,teamVerificationStatus:verified?'USER_VERIFIED':null,teamApiVerified:false,
    teamEvidenceRef:'test:team-metadata',discoveryRef:'file:test-discovery.json',discoveredAt:new Date().toISOString()};
  fs.writeFileSync(path.join(directory,'test-discovery.json'),JSON.stringify({authStatus:'oAuth',checkedAt:accountContext.discoveredAt,toolSchemas:require('../challenge/flashpoint-tool-contract.json').toolSchemas}));
  const adapter=createLiveAdapter({directory,accountContext,invokeTool}),workflow=createWorkflow({directory,adapter});
  workflow.initialize({objective:'TEST DATA objective: explain the current CarbonX model trade-off.'});
  const packet=workflow.checkpoint('PLAN');
  const payload={interpretation:'TEST DATA planning contract.',participants:'TEST DATA participants; no real people.',analysisCriteria:'Inspect only scoped answer evidence.',
    uncertainties:[{id:'explain',rationale:'TEST DATA uncertainty.'}],questions:[{id:'explain',type:'text',prompt:'Explain the displayed result in your own words.',rationale:'TEST DATA prompt.',uncertaintyIds:['explain']}],...researchFields};
  workflow.submit({schemaVersion:1,label:'REAL_FIRST_PARTY',origin:'CODEX_AUTHORED',kind:'PLAN',inputHash:packet.inputHash,basisHash:packet.basisHash,payload});
  return {directory,accountContext,adapter,workflow,payload};
}
function approve(workflow){const request=workflow.requestAction('create_survey');workflow.approve({approvalId:request.approval.id,requestHash:request.approval.requestHash,confirmed:true,userApprovalRef:'test:explicit-user',billingAcknowledged:true});return request;}
function draft(payload){return {content:[],structuredContent:{state:'DRAFT',survey:'TEST-LIVE-survey',conversation:'TEST-LIVE-conversation',questions:[{key:'TEST-provider-question',kind:'text',prompt:payload.questions[0].prompt}]}};}
function profile(raw){return {reviewed:true,responseHash:digest(raw),reviewRef:'test:reviewed-mock-output',documentPointer:'/structuredContent',
  fields:{surveyId:'/survey',conversationId:'/conversation'},status:{pointer:'/state',equals:'DRAFT',meaning:'DRAFT_CREATED'},
  questions:[{planningId:'explain',idPointer:'/questions/0/key',promptPointer:'/questions/0/prompt',typePointer:'/questions/0/kind'}]};}
test('unverified team blocks actual approval and dispatch before any external intent',async t=>{
  const {workflow}=setup(t,{verified:false});const request=workflow.requestAction('create_survey');
  assert.throws(()=>workflow.approve({approvalId:request.approval.id,requestHash:request.approval.requestHash,confirmed:true,userApprovalRef:'test:user',billingAcknowledged:true}),{code:'TEAM_UNVERIFIED'});
  await assert.rejects(()=>workflow.execute(),{code:'APPROVAL_REQUIRED'});assert.deepEqual(workflow.state().actions,[]);
});

test('user-confirmed ownership is propagated into the same-conversation draft request without inventing API verification',t=>{
  const {workflow}=setup(t);
  workflow.store.bindRemoteIds({conversationId:'TEST-existing-thread'},'test:actual-prior-conversation');
  const proposal=workflow.requestAction('create_survey');
  assert.equal(proposal.manifest.request.arguments.conversation_id,'TEST-existing-thread');
  assert.equal(Object.hasOwn(proposal.manifest.request.arguments,'survey_id'),false);
  assert.match(proposal.manifest.request.arguments.brief,/USER_VERIFIED ownership based on the user attestation, not independent API verification/);
  assert.match(proposal.manifest.request.arguments.brief,/return its existing IDs instead of creating another/);
  assert.doesNotMatch(proposal.manifest.request.arguments.brief,/Before creating anything, verify the authenticated account/);
  assert.equal(proposal.approval.status,'PENDING');assert.equal(workflow.state().actions.length,0);
});
test('live run rejects offline decisions, replay origins and simulated approvals',t=>{
  const {workflow}=setup(t);const packet=workflow.checkpoint('PLAN');
  assert.throws(()=>workflow.submit({...packet,schemaVersion:1,label:'TEST DATA',origin:'RECORDED_CODEX_REPLAY',payload:{}}),{code:'STALE_AGENT_OUTPUT'});
  const request=workflow.requestAction('create_survey');
  assert.throws(()=>workflow.approve({approvalId:request.approval.id,requestHash:request.approval.requestHash,simulate:true}),{code:'APPROVAL_REQUIRED'});
});
test('queue creates a durable intent and claim is one-shot; Node has no authenticated transport',async t=>{
  const {workflow,adapter,directory}=setup(t);approve(workflow);await workflow.execute();
  const action=workflow.state().actions[0];assert.equal(action.status,'IN_FLIGHT');
  const call=adapter.claim(action.id);assert.equal(call.tool,'tool_survey');assert.match(call.arguments.brief,/Prepare a DRAFT survey/);
  assert.deepEqual(Object.keys(call.arguments),['brief']);assert.ok(fs.existsSync(path.join(directory,'live-handoff',action.id+'.claim.json')));
  assert.throws(()=>adapter.claim(action.id),{code:'DUPLICATE_DISPATCH'});
});
test('unapproved invocation and unclaimed result ingestion are refused',async t=>{
  const {workflow,adapter,payload}=setup(t);await assert.rejects(()=>workflow.execute(),{code:'APPROVAL_REQUIRED'});
  approve(workflow);await workflow.execute();const action=workflow.state().actions[0];
  assert.throws(()=>adapter.capture(action.id,draft(payload)),{code:'UNCLAIMED_HANDOFF'});
});
test('raw capture without a reviewed output mapping remains unknown and cannot trigger another creation',async t=>{
  const {workflow,adapter,payload}=setup(t);approve(workflow);await workflow.execute();const action=workflow.state().actions[0];adapter.claim(action.id);
  await workflow.completeHandoff(action.id,draft(payload));assert.equal(workflow.state().stage,'UNKNOWN_REMOTE_OUTCOME');
  assert.equal(workflow.state().rounds[0].surveyId,null);assert.throws(()=>workflow.resume(),{code:'UNRESOLVED_ACTION'});
  assert.throws(()=>workflow.requestAction('create_survey'));
});
test('reviewed capture binds actual returned IDs and instrument while preserving independent publication approval',async t=>{
  const {workflow,adapter,payload}=setup(t);approve(workflow);await workflow.execute();const action=workflow.state().actions[0];adapter.claim(action.id);
  const raw=draft(payload);await workflow.completeHandoff(action.id,raw,profile(raw));
  assert.equal(workflow.state().stage,'AWAITING_APPROVAL');assert.equal(workflow.state().rounds[0].surveyId,raw.structuredContent.survey);
  assert.equal(workflow.state().rounds[0].conversationId,raw.structuredContent.conversation);
  const request=workflow.requestAction('publish');assert.equal(request.manifest.request.arguments.survey_id,raw.structuredContent.survey);
  assert.equal(request.manifest.request.arguments.conversation_id,raw.structuredContent.conversation);
  await assert.rejects(()=>workflow.execute(),{code:'APPROVAL_REQUIRED'});
});
test('missing actual instrument permits recording a draft but blocks publication',async t=>{
  const {workflow,adapter,payload}=setup(t);approve(workflow);await workflow.execute();const action=workflow.state().actions[0];adapter.claim(action.id);
  const raw=draft(payload),mapping=profile(raw);delete mapping.questions;
  await workflow.completeHandoff(action.id,raw,mapping);assert.equal(workflow.state().stage,'AWAITING_APPROVAL');
  assert.throws(()=>workflow.requestAction('publish'),{code:'UNVERIFIED_INSTRUMENT'});
});

test('draft inspection has its own exact scoped one-shot read permission and never grants publication',async t=>{
  const {workflow,adapter,payload}=setup(t);approve(workflow);await workflow.execute();const action=workflow.state().actions[0];adapter.claim(action.id);
  const raw=draft(payload),mapping=profile(raw);delete mapping.questions;await workflow.completeHandoff(action.id,raw,mapping);
  const proposal=workflow.prepareInspection();
  assert.equal(proposal.request.arguments.survey_id,'TEST-LIVE-survey');assert.equal(proposal.request.arguments.conversation_id,'TEST-LIVE-conversation');
  assert.match(proposal.request.arguments.brief,/Do not create, edit, update, publish/);
  assert.match(proposal.request.arguments.brief,/OAuth-selected team is "TEST CarbonX"/);
  assert.throws(()=>workflow.prepareRead({confirmed:true,userApprovalRef:'test:answers-before-distribution'}),{code:'INVALID_STAGE'});
  await assert.rejects(()=>adapter.retrieve(proposal),{code:'READ_APPROVAL_REQUIRED'});
  assert.throws(()=>adapter.authorizeRead({...proposal,confirmed:false,userApprovalRef:'test:unapproved'}),{code:'APPROVAL_REQUIRED'});
  assert.throws(()=>adapter.authorizeRead({...proposal,scope:{...proposal.scope,surveyId:'TEST-other'},confirmed:true,userApprovalRef:'test:wrong-survey'}),{code:'HANDOFF_SCOPE_MISMATCH'});
  const permit=workflow.prepareInspection({confirmed:true,userApprovalRef:'test:one-draft-read'});
  const receipt=await adapter.retrieve(proposal);assert.equal(receipt.status,'handoff_required');assert.equal(receipt.operation,'inspect_survey');
  const call=adapter.claim(permit.actionId);assert.equal(call.arguments.survey_id,'TEST-LIVE-survey');
  assert.throws(()=>adapter.claim(permit.actionId),{code:'DUPLICATE_DISPATCH'});
  assert.throws(()=>workflow.prepareInspection({confirmed:true,userApprovalRef:'test:no-retry'}),{code:'UNRESOLVED_ACTION'});
  assert.throws(()=>workflow.requestAction('publish'),{code:'UNVERIFIED_INSTRUMENT'});
  assert.equal(workflow.state().actions.length,1);assert.equal(workflow.state().pendingApproval,null);
});

function inspectedDraft(payload){
  const document={survey:'TEST-LIVE-survey',status:'draft',name:payload.title,version:1,revision:3,document:{intro:payload.participantIntroduction,stimulus:payload.stimulus,questions:[{key:'TEST-provider-question',kind:'text',subtype:'single',options:[],prompt:payload.questions[0].prompt}]}};
  return {structuredContent:{conversation:'TEST-LIVE-conversation',report:'Actual document:\n```json\n'+JSON.stringify(document)+'\n```'}};
}
function inspectionProfile(raw){return {reviewed:true,responseHash:digest(raw),reviewRef:'test:reviewed-full-instrument',documentPointer:'/structuredContent/report',parseJsonFence:true,
  fields:{surveyId:'/survey'},envelopeFields:{conversationId:'/structuredContent/conversation'},status:{pointer:'/status',equals:'draft',meaning:'INSTRUMENT_RETURNED'},
  questions:[{planningId:'explain',idPointer:'/document/questions/0/key',promptPointer:'/document/questions/0/prompt',typePointer:'/document/questions/0/kind',subtypePointer:'/document/questions/0/subtype',subtypeValue:'single',optionsPointer:'/document/questions/0/options'}],
  instrument:{titlePointer:'/name',introductionPointer:'/document/intro',stimulusPointer:'/document/stimulus',versionPointer:'/version',revisionPointer:'/revision',contentPointer:'/document'}};}

test('actual JSON instrument verification supplies a version-bound publication proposal without rewriting the creation receipt',async t=>{
  const {workflow,adapter,payload,directory}=setup(t,{researchFields:{title:'TEST title',participantIntroduction:'TEST voluntary introduction',stimulus:'TEST illustrative stimulus'}});
  approve(workflow);await workflow.execute();const action=workflow.state().actions[0];adapter.claim(action.id);
  const created=draft(payload),creationProfile=profile(created);delete creationProfile.questions;await workflow.completeHandoff(action.id,created,creationProfile);
  const proposal=workflow.prepareInspection(),permit=workflow.prepareInspection({confirmed:true,userApprovalRef:'test:read-exact-instrument'});await adapter.retrieve(proposal);adapter.claim(permit.actionId);
  const raw=inspectedDraft(payload),receipt=workflow.completeInspection(permit.actionId,raw,inspectionProfile(raw));
  assert.equal(receipt.questionMap.explain,'TEST-provider-question');assert.equal(receipt.instrument.revision,3);
  const publication=workflow.requestAction('publish');assert.equal(publication.approval.status,'PENDING');assert.equal(publication.manifest.instrument.documentHash,receipt.instrument.documentHash);
  assert.match(publication.manifest.request.arguments.brief,/version 1 and revision 3/);assert.match(publication.manifest.request.arguments.brief,/Do not create or edit a survey, send emails\/invitations/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'live-handoff',action.id+'.receipt.json'),'utf8')).questionMap,null);
  await assert.rejects(()=>workflow.execute(),{code:'APPROVAL_REQUIRED'});assert.equal(workflow.state().actions.length,1);
});

test('instrument profiles reject mismatched content, changed IDs and ambiguous JSON instead of filling from the plan',()=>{
  const research={title:'TEST title',participantIntroduction:'TEST intro',stimulus:'TEST stimulus',questions:[{id:'explain',type:'text',prompt:'TEST prompt'}]};
  const raw=inspectedDraft(research),context={operation:'inspect_survey',actionId:'TEST-read',scope:{surveyId:'TEST-LIVE-survey',conversationId:'TEST-LIVE-conversation'},questions:research.questions,research};
  const changed=inspectedDraft({...research,stimulus:'TEST different stimulus'});
  assert.throws(()=>mappedReceipt(changed,inspectionProfile(changed),context),{code:'INSTRUMENT_MISMATCH'});
  assert.throws(()=>mappedReceipt(raw,inspectionProfile(raw),{...context,scope:{...context.scope,surveyId:'TEST-other'}}),{code:'EVIDENCE_SCOPE_MISMATCH'});
  const ambiguous=structuredClone(raw);ambiguous.structuredContent.report+='\n```json\n{}\n```';
  assert.throws(()=>mappedReceipt(ambiguous,inspectionProfile(ambiguous),context),{code:'MALFORMED_MCP'});
});
test('missing IDs and changed output hashes cannot be accepted as created resources',async t=>{
  const {workflow,adapter,payload}=setup(t);approve(workflow);await workflow.execute();const action=workflow.state().actions[0];adapter.claim(action.id);
  const raw=draft(payload);delete raw.structuredContent.survey;const mapping=profile(raw);
  await assert.rejects(()=>workflow.completeHandoff(action.id,raw,mapping),{code:'INVALID_MAPPING'});
  assert.equal(workflow.state().stage,'UNKNOWN_REMOTE_OUTCOME');assert.equal(workflow.state().rounds[0].surveyId,null);
  assert.throws(()=>mappedReceipt(draft(payload),{...mapping,responseHash:'stale'},{operation:'create_survey'}),{code:'UNVERIFIED_RESPONSE_SCHEMA'});
});
for(const [code,message] of [['AUTHENTICATION_REQUIRED','HTTP 401 Unauthorized'],['PAYMENT_REQUIRED','HTTP 402 payment required']]){
  test(code+' preserves raw errors and never retries, signs or invents expiry',async t=>{
    let calls=0;const raw={isError:true,content:[{type:'text',text:message}]};
    const {workflow}=setup(t,{invokeTool:async()=>{calls++;return raw;}});approve(workflow);await workflow.execute();
    const action=workflow.state().actions[0];assert.equal(calls,1);assert.equal(workflow.state().stage,'UNKNOWN_REMOTE_OUTCOME');
    await assert.rejects(()=>workflow.completeHandoff(action.id,raw,{reviewed:true,responseHash:digest(raw),reviewRef:'test:review',documentPointer:''}),{code});
    await assert.rejects(()=>workflow.execute(),{code:'APPROVAL_REQUIRED'});assert.equal(calls,1);
  });
}
test('malformed MCP text and fixture envelopes fail closed',()=>{
  const base={reviewed:true,reviewRef:'test:review',documentPointer:'/content/0/text',parseJson:true};
  const raw={content:[{type:'text',text:'survey created, trust me'}]};
  assert.throws(()=>mappedReceipt(raw,{...base,responseHash:digest(raw)},{}),{code:'MALFORMED_MCP'});
  const fixture={content:[],structuredContent:{label:'TEST DATA',mock:true}};
  assert.throws(()=>mappedReceipt(fixture,{...base,parseJson:false,documentPointer:'/structuredContent',responseHash:digest(fixture)},{}),{code:'SOURCE_MISMATCH'});
});
test('provider confirmation stays separate from user approval and retains partial IDs privately',()=>{
  const raw={structuredContent:{state:'NEEDS_CONFIRMATION',conversation:'TEST-confirm-thread'}};
  const receipt=mappedReceipt(raw,{reviewed:true,responseHash:digest(raw),reviewRef:'test:review',documentPointer:'/structuredContent',fields:{conversationId:'/conversation'},status:{pointer:'/state',equals:'NEEDS_CONFIRMATION',meaning:'APPROVAL_REQUESTED'}},{operation:'create_survey',actionId:'TEST-action'});
  assert.equal(receipt.status,'AWAITING_PROVIDER_CONFIRMATION');assert.equal(receipt.outcome,'UNKNOWN_REMOTE_OUTCOME');assert.equal(receipt.ids.conversationId,'TEST-confirm-thread');
});
test('recovery of a claimed call requires the same receipt rather than a second dispatch',async t=>{
  const {workflow,adapter,payload,directory,accountContext}=setup(t);approve(workflow);await workflow.execute();const action=workflow.state().actions[0];adapter.claim(action.id);
  const reopenedAdapter=createLiveAdapter({directory,accountContext}),reopened=createWorkflow({directory,adapter:reopenedAdapter});reopened.recover();
  assert.throws(()=>reopened.resume(),{code:'UNRESOLVED_ACTION'});assert.throws(()=>reopenedAdapter.claim(action.id),{code:'APPROVAL_REQUIRED'});
  const raw=draft(payload);await reopened.completeHandoff(action.id,raw,profile(raw));assert.equal(reopened.state().stage,'AWAITING_APPROVAL');
  assert.equal(reopened.state().actions.length,1);
});
test('an unclaimed durable request can be explicitly reconciled as non-executed; fresh approval remains required',async t=>{
  const {workflow}=setup(t);approve(workflow);await workflow.execute();workflow.recover();const action=workflow.state().actions[0];
  await workflow.reconcile(action.id);assert.equal(workflow.state().actions[0].status,'NOT_EXECUTED');workflow.resume();
  await assert.rejects(()=>workflow.execute(),{code:'APPROVAL_REQUIRED'});
});
test('no wallet or positive payment scope is available in the OAuth bridge',t=>{
  const {workflow}=setup(t);assert.throws(()=>workflow.requestAction('create_survey',{maxChargeUsd:'1'}),{code:'PAYMENT_NOT_AUTHORIZED'});
  assert.throws(()=>workflow.requestAction('payment'),{code:'PAYMENT_NOT_AUTHORIZED'});
});
test('the absent real allowlist is an explicit distribution blocker and no alternate recipient input is accepted',t=>{
  const {workflow}=setup(t);assert.throws(()=>workflow.requestAction('email_send',{recipientIds:['TEST-recipient-1']}),{code:'PAYMENT_NOT_AUTHORIZED'});
  const actual=path.resolve(__dirname,'../.runtime/challenge/recipients.txt');
  if(!fs.existsSync(actual))assert.throws(()=>readRecipients(),{code:'RECIPIENTS_MISSING'});
});
function answerContext(){return {operation:'retrieve',actionId:'TEST-read',round:1,scope:{surveyId:'TEST-survey',conversationId:'TEST-thread'},
  rawRef:'test:captured-raw',capturedAt:'2026-11-22T12:00:00Z',invitedCount:12,questionnaire:{actualQ:{type:'text'}}};}
function answers(rows){return {structuredContent:{state:'ANSWERS',survey:'TEST-survey',thread:'TEST-thread',more:false,complete:12,questionnaire:{actualQ:{type:'text'}},rows}};}
function answersProfile(raw){return {reviewed:true,responseHash:digest(raw),reviewRef:'test:answer-review',documentPointer:'/structuredContent',fields:{surveyId:'/survey',conversationId:'/thread'},
  status:{pointer:'/state',equals:'ANSWERS',meaning:'ANSWERS_RETURNED'},answers:{pagination:{pointer:'/more',equals:false},recordsPointer:'/rows',questionnairePointer:'/questionnaire',completedPointer:'/complete',completeValue:'done',row:{id:'/key',status:'/state',answers:'/values'}}};}

test('single response detail and labelled answer objects map actual question IDs while retaining reserved metadata only in raw data',()=>{
  const raw={structuredContent:{survey:'TEST-survey',thread:'TEST-thread',invited:1,complete:1,questions:[{id:'actualQ',type:'text'}],response:{id:'TEST-real-shaped-detail',status:'COMPLETE',preview:false,test:false,excluded:false,all:true,answers:{Q1:{id:'actualQ',value:'TEST submitted answer'},DEVICE:{id:'TEST-reserved',value:'TEST private device metadata'}}}}};
  const mapping=value=>({reviewed:true,responseHash:digest(value),reviewRef:'test:detail-shape-review',documentPointer:'/structuredContent',fields:{surveyId:'/survey',conversationId:'/thread'},status:{pointer:'/response/status',equals:'COMPLETE',meaning:'ANSWERS_RETURNED'},answers:{singleRecord:true,recordsPointer:'/response',questionnairePointer:'/questions',questionDefinition:{id:'/id',type:'/type'},completedPointer:'/complete',invitedPointer:'/invited',pagination:{pointer:'/response/all',equals:true},completeValue:'COMPLETE',row:{id:'/id',status:'/status',answers:'/answers',preview:'/preview',excluded:'/excluded',isTest:'/test'},answerObjects:{id:'/id',value:'/value',metadata:[{key:'DEVICE',questionId:'TEST-reserved'}]}}});
  const receipt=mappedReceipt(raw,mapping(raw),answerContext()),validated=validateResponses(receipt.evidence);
  assert.equal(validated.invitedCount,1);assert.equal(validated.completedRecords,1);assert.equal(validated.retrievedAnswerRecords,1);assert.equal(validated.usableAnswerRecords,1);assert.equal(validated.validAnswersPerQuestion.actualQ,1);assert.deepEqual(validated.exclusions,[]);assert.equal(receipt.excludedAuxiliaryMetadata.length,1);assert.equal(Object.hasOwn(receipt.evidence.responses[0].data,'DEVICE'),false);
  const testRow=structuredClone(raw);testRow.structuredContent.response.test=true;assert.equal(validateResponses(mappedReceipt(testRow,mapping(testRow),answerContext()).evidence).usableAnswerRecords,0);
  const unknown=structuredClone(raw);unknown.structuredContent.response.answers.DEVICE.id='TEST-not-reviewed-metadata';assert.equal(validateResponses(mappedReceipt(unknown,mapping(unknown),answerContext()).evidence).usableAnswerRecords,0);
  const duplicate=structuredClone(raw);duplicate.structuredContent.response.answers.Q2={id:'actualQ',value:'TEST duplicate answer'};assert.throws(()=>mappedReceipt(duplicate,mapping(duplicate),answerContext()),{code:'INVALID_EVIDENCE'});
});
test('actual selected row values normalize through Phase 3; completion counts without answers remain insufficient',()=>{
  const raw=answers(Array.from({length:12},(_,i)=>({key:'TEST-row-'+i,state:'done',values:{}})));
  const receipt=mappedReceipt(raw,answersProfile(raw),answerContext()),validated=validateResponses(receipt.evidence);
  assert.equal(validated.completedRecords,12);assert.equal(validated.usableAnswerRecords,0);assert.equal(validated.status,'INSUFFICIENT_EVIDENCE');
});
test('invalid answer scope, pagination and duplicate/malformed values are not silently repaired',()=>{
  const raw=answers([{key:'TEST-A',state:'done',values:{actualQ:'TEST answer'}},{key:'TEST-dup',state:'done',values:{}},{key:'TEST-dup',state:'done',values:{}},{key:'TEST-bad',state:'done',values:'invalid'}]);
  const validated=validateResponses(mappedReceipt(raw,answersProfile(raw),answerContext()).evidence);
  assert.equal(validated.usableAnswerRecords,1);assert.equal(validated.validAnswersPerQuestion.actualQ,1);
  const wrong=answers([]);wrong.structuredContent.survey='other';assert.throws(()=>mappedReceipt(wrong,answersProfile(wrong),answerContext()),{code:'EVIDENCE_SCOPE_MISMATCH'});
  const incomplete=answers([]);incomplete.structuredContent.more=true;assert.throws(()=>mappedReceipt(incomplete,answersProfile(incomplete),answerContext()),{code:'UNVERIFIED_PAGINATION'});
});

test('fresh actual-schema discovery is required; a changed team cannot claim an older approval',async t=>{
  const {workflow,adapter,directory,accountContext}=setup(t);approve(workflow);await workflow.execute();const action=workflow.state().actions[0];
  const changed=createLiveAdapter({directory,accountContext:{...accountContext,teamName:'TEST-other-team'}});
  assert.throws(()=>changed.claim(action.id),{code:'APPROVAL_SCOPE_MISMATCH'});
  const discoveryPath=path.join(directory,'test-discovery.json');
  const discovery=JSON.parse(fs.readFileSync(discoveryPath,'utf8'));discovery.authStatus='unsupported';fs.writeFileSync(discoveryPath,JSON.stringify(discovery));
  assert.throws(()=>adapter.claim(action.id),{code:'UNVERIFIED_DISCOVERY'});
});

test('null, missing and mixed-source rows stay excluded instead of becoming fabricated answers',()=>{
  const raw=answers([null,{key:'TEST-missing',state:'done'},{key:'TEST-synthetic',state:'done',origin:'synthetic',values:{actualQ:'Not first-party'}},{key:'TEST-real',state:'done',origin:'real_first_party',values:{actualQ:'TEST answer'}}]);
  const mapping=answersProfile(raw);mapping.answers.row.sourceType='/origin';
  const result=validateResponses(mappedReceipt(raw,mapping,answerContext()).evidence);
  assert.equal(result.retrievedAnswerRecords,4);assert.equal(result.usableAnswerRecords,1);assert.equal(result.validAnswersPerQuestion.actualQ,1);
  assert.ok(result.exclusions.some(e=>e.reason==='source_type_mismatch'));
});

test('changed account context invalidates a prior live approval before consuming it or writing an intent',async t=>{
  const {workflow,accountContext}=setup(t);approve(workflow);accountContext.teamName='TEST-other-team';
  await assert.rejects(()=>workflow.execute(),{code:'APPROVAL_SCOPE_MISMATCH'});
  assert.equal(workflow.state().actions.length,0);assert.equal(workflow.state().pendingApproval.status,'APPROVED');
});

test('cancelling an unapproved live request preserves an existing team-verification interruption',t=>{
  const {workflow}=setup(t,{verified:false});const request=workflow.requestAction('create_survey');
  workflow.store.transition('BLOCKED',{reason:'TEAM_UNVERIFIED'});
  workflow.approve({approvalId:request.approval.id,requestHash:request.approval.requestHash,confirmed:true,userApprovalRef:'test:cancel-pending',reject:true});
  assert.equal(workflow.state().stage,'BLOCKED');assert.equal(workflow.state().resumeStage,'DRAFT_PLAN');assert.equal(workflow.state().pendingApproval,null);
});

test('mocked live read handoff connects explicit approval, raw capture, normalization and existing state validation',async t=>{
  const {workflow,adapter,payload}=setup(t);approve(workflow);await workflow.execute();const create=workflow.state().actions[0];adapter.claim(create.id);
  const rawDraft=draft(payload);await workflow.completeHandoff(create.id,rawDraft,profile(rawDraft));
  // TEST DATA receipts only, within an isolated temp run; no allowlist or email operation.
  const store=workflow.store;
  function fixtureAction(kind){const hash=digest({label:'TEST DATA',kind});store.requestApproval({kind,requestHash:hash,maxChargeUsd:'0',scopeDescription:'TEST DATA mock operation',...(kind==='email_send'?{recipientCount:12,recipientsHash:digest('TEST consented list')}: {})});
    const approval=workflow.state().pendingApproval;store.grantApproval(approval.id,{confirmed:true,sourceRef:'test:mock-approval'});
    const state=store.beginAction({kind,requestHash:hash,approvalId:approval.id});store.finishAction(state.actions.at(-1).id,{outcome:'SUCCEEDED',sourceRef:'test:mock-receipt',actualChargeUsd:'0'});}
  fixtureAction('publish');store.transition('PUBLISHED');store.recordConsent({recipientsHash:digest('TEST consented list'),eligibleCount:12,sourceRef:'test:mock-consent'});
  fixtureAction('email_send');store.transition('INVITATIONS_SENT');store.transition('AWAITING_RESPONSES');
  const proposal=workflow.prepareRead(),permit=workflow.prepareRead({confirmed:true,userApprovalRef:'test:explicit-read'});
  assert.equal(proposal.request.arguments.survey_id,'TEST-LIVE-survey');
  await workflow.retrieve();assert.equal(workflow.state().stage,'AWAITING_RESPONSES');
  assert.throws(()=>workflow.prepareRead({confirmed:true,userApprovalRef:'test:duplicate-read'}),{code:'UNRESOLVED_ACTION'});
  const call=adapter.claim(permit.actionId);assert.equal(call.arguments.conversation_id,'TEST-LIVE-conversation');
  assert.throws(()=>adapter.cancelRead(permit.actionId,'test:cancel'),{code:'UNRESOLVED_ACTION'});
  const raw=answers([{key:'TEST-reader',state:'done',values:{'TEST-provider-question':'TEST answer'}}]);
  Object.assign(raw.structuredContent,{survey:'TEST-LIVE-survey',thread:'TEST-LIVE-conversation',complete:1,questionnaire:{'TEST-provider-question':{type:'text'}}});
  adapter.capture(permit.actionId,raw,answersProfile(raw));await workflow.retrieve();
  assert.equal(workflow.state().stage,'ANSWERS_VALIDATED');assert.equal(workflow.state().rounds[0].usableAnswerRecords,1);
  const packet=workflow.checkpoint('ANALYSIS');assert.equal(packet.label,'REAL_FIRST_PARTY');assert.equal(packet.evidence[0].records[0].answers.explain,'TEST answer');
});
