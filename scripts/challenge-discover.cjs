'use strict';
// Protocol-only Codex discovery. No thread/turn creation or MCP tools/call.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),readline=require('node:readline');
function executable(){
  if(process.env.CODEX_EXECUTABLE)return process.env.CODEX_EXECUTABLE;
  if(process.platform!=='win32')return 'codex';
  const roots=[path.join(path.dirname(process.execPath),'node_modules/@openai/codex'),
    process.env.APPDATA&&path.join(process.env.APPDATA,'npm/node_modules/@openai/codex'),
    process.env.ProgramFiles&&path.join(process.env.ProgramFiles,'nodejs/node_modules/@openai/codex')].filter(Boolean);
  const arch=process.arch==='arm64'?'arm64':'x64',triple=arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc';
  for(const root of roots)for(const location of [path.join(root,'node_modules/@openai/codex-win32-'+arch,'vendor',triple,'bin/codex.exe'),path.join(root,'vendor',triple,'bin/codex.exe')])if(fs.existsSync(location))return location;
  throw Error('Set CODEX_EXECUTABLE to the installed native Codex executable; no credential path is required.');
}
function main(argv){
  if(argv.length!==2||argv[0]!=='--output')throw Error('Use --output .runtime/challenge/NEW_RUN/discovery.json');
  const root=path.resolve(__dirname,'..'),privateRoot=path.join(root,'.runtime'),destination=path.resolve(argv[1]),relative=path.relative(privateRoot,destination);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!destination.endsWith('.json'))throw Error('Output must be a JSON file inside this repository .runtime directory.');
  if(fs.existsSync(destination))throw Error('Use a new discovery filename; existing evidence is not overwritten.');
  const child=spawn(executable(),['app-server','--stdio'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const lines=readline.createInterface({input:child.stdout});let finished=false;
  const send=value=>child.stdin.write(JSON.stringify(value)+'\n');
  function finish(value,code=0){if(finished)return;finished=true;clearTimeout(timer);process.exitCode=code;console.log(JSON.stringify(value,null,2));child.stdin.end();lines.close();child.kill();}
  const timer=setTimeout(()=>finish({status:'timeout',businessCalls:0},1),45000);
  child.stderr.on('data',()=>{}); // Never print transport stderr or credentials.
  child.on('error',error=>finish({status:'process_error',code:error.code,businessCalls:0},1));
  child.on('exit',code=>{if(!finished)finish({status:'early_exit',exitCode:code,businessCalls:0},1);});
  lines.on('line',line=>{
    let message;try{message=JSON.parse(line);}catch{return;}
    if(message.error)return finish({status:'rpc_error',id:message.id,code:message.error.code,businessCalls:0},1);
    if(message.id===1){send({method:'initialized'});send({id:2,method:'mcpServerStatus/list',params:{serverName:'flashpoint',detail:'full',limit:10}});}
    if(message.id!==2)return;
    const server=(message.result?.data||[]).find(item=>item.name==='flashpoint');
    if(!server)return finish({status:'server_not_found',businessCalls:0},1);
    const entries=Array.isArray(server.tools)?server.tools:Object.values(server.tools||{});
    const survey=entries.find(tool=>tool.name==='tool_survey');
    if(server.authStatus!=='oAuth'||!survey?.inputSchema)return finish({status:'oauth_or_schema_unverified',authStatus:server.authStatus,toolCount:entries.length,businessCalls:0},1);
    const report={checkedAt:new Date().toISOString(),source:'codex app-server mcpServerStatus/list (protocol metadata only)',name:server.name,authStatus:server.authStatus,
      serverInfo:server.serverInfo?{name:server.serverInfo.name,version:server.serverInfo.version,websiteUrl:server.serverInfo.websiteUrl}:null,
      toolCount:entries.length,toolNames:entries.map(tool=>tool.name),toolSchemas:Object.fromEntries(entries.map(tool=>[tool.name,tool.inputSchema])),
      resourceCount:(server.resources||[]).length,resourceTemplateCount:(server.resourceTemplates||[]).length,businessCalls:0,modelTurns:0,paymentSignatures:0};
    fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
    const fd=fs.openSync(destination,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(report,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    finish({status:'discovered',file:path.relative(root,destination),checkedAt:report.checkedAt,authStatus:report.authStatus,toolCount:report.toolCount,businessCalls:0});
  });
  send({id:1,method:'initialize',params:{clientInfo:{name:'carbonx_protocol_discovery',version:'1.0'},capabilities:{experimentalApi:true}}});
}
if(require.main===module)try{main(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={main};
