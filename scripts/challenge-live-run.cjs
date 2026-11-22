'use strict';
// Local control plane only. It never invokes a Flashpoint tool or reads a token.
const fs = require('node:fs');
const path = require('node:path');
const { createWorkflow } = require('./challenge-workflow.cjs');
const { createLiveAdapter } = require('./challenge-live.cjs');
const { fail } = require('./challenge-safety.cjs');
async function main(argv) {
  const [command, ...args] = argv, options = {};
  if (!command || args.length % 2) fail('USAGE', 'Use COMMAND --dir PRIVATE_RUN --context PRIVATE_CONTEXT_JSON [--file JSON] [--kind KIND] [--action ID]');
  for (let i=0;i<args.length;i+=2) {
    const key=args[i].replace(/^--/,'');
    if (!args[i].startsWith('--') || !['dir','context','file','kind','action','approval','hash','user-ref','objective','profile','billing-acknowledged','consent-confirmed'].includes(key) || options[key]!=null) fail('USAGE','Unknown or duplicate argument');
    options[key]=args[i+1];
  }
  if (!options.dir || !options.context) fail('USAGE','Explicit private --dir and --context are required');
  const read = file => JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
  const adapter=createLiveAdapter({directory:options.dir,accountContext:read(options.context)});
  const workflow=createWorkflow({directory:options.dir,adapter});
  if(command==='init') {
    if(!options.objective)fail('USAGE','Provide the actual --objective');
    workflow.initialize({objective:options.objective});
  }
  else if(command==='checkpoint') return workflow.checkpoint(options.kind);
  else if(command==='submit') workflow.submit(read(options.file));
  else if(command==='request') return workflow.requestAction(options.kind);
  else if(command==='approve') workflow.approve({approvalId:options.approval,requestHash:options.hash,confirmed:true,userApprovalRef:options['user-ref'],billingAcknowledged:options['billing-acknowledged']==='true',consentConfirmed:options['consent-confirmed']==='true'});
  else if(command==='reject') workflow.approve({approvalId:options.approval,requestHash:options.hash,confirmed:true,userApprovalRef:options['user-ref'],reject:true});
  else if(command==='queue') await workflow.execute();
  else if(command==='claim') return adapter.claim(options.action);
  else if(command==='capture') await workflow.completeHandoff(options.action,read(options.file),options.profile?read(options.profile):null);
  else if(command==='read-proposal') return workflow.prepareRead();
  else if(command==='authorize-read') return workflow.prepareRead({confirmed:true,userApprovalRef:options['user-ref']});
  else if(command==='retrieve') await workflow.retrieve();
  else if(command==='capture-read') adapter.capture(options.action,read(options.file),options.profile?read(options.profile):null);
  else if(command==='cancel-read') adapter.cancelRead(options.action,options['user-ref']);
  else if(command==='recover') workflow.recover();
  else if(command==='reconcile') await workflow.reconcile(options.action);
  else if(command==='resume') workflow.resume();
  else if(command!=='show')fail('USAGE','Unknown live control command');
  const state=workflow.state();
  return {mode:'LIVE_CONTROL_PLANE',runId:state.runId,stage:state.stage,sourceType:state.sourceType,activeRound:state.activeRound,
    teamVerified:adapter.accountContext.teamVerified===true,teamName:adapter.accountContext.teamName??null,
    pendingApproval:state.pendingApproval?{id:state.pendingApproval.id,requestHash:state.pendingApproval.requestHash,status:state.pendingApproval.status}:null,
    actions:state.actions.map(a=>({id:a.id,kind:a.kind,status:a.status})),
    rounds:state.rounds.map(r=>({round:r.round,surveyId:r.surveyId,conversationId:r.conversationId,completedRecords:r.completedRecords,retrievedAnswerRecords:r.retrievedAnswerRecords,usableAnswerRecords:r.usableAnswerRecords})),
    note:'Node does not inherit Codex OAuth. Claims must be invoked once by Codex; this CLI dispatches no remote business tool.'};
}
if(require.main===module) main(process.argv.slice(2)).then(value=>console.log(JSON.stringify(value,null,2))).catch(error=>{
  console.error((error.code||'LIVE_CONTROL_ERROR')+': '+(error.code?error.message:'Inspect private run artifacts.'));process.exitCode=1;
});
module.exports={main};
