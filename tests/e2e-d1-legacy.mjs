// Historical D1/ChatGPT integration test. Not applicable after the Supabase migration.
throw new Error('Legacy D1 test: use tests/supabase-database.mjs and SUPABASE_SETUP.md for the current account system.');
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base='http://localhost:5173';
const sign=await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'});const cookie=sign.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
assert.ok(cookie,'local sign in cookie');
async function request(path,body,auth=true){return fetch(base+path,{method:body?'POST':'GET',headers:{...(auth?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:base}:{})},...(body?{body:JSON.stringify(body)}:{})})}
async function api(body){const r=await request('/api/workspace',body);const j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j}
assert.equal((await request('/api/workspace',null,false)).status,401);
assert.equal((await request('/api/workspace',{action:'client',name:'Invalid',website:'http://127.0.0.1'})).status,400);
await api({action:'settings',name:'Local QA workspace',color:'#087f75'});
const {client}=await api({action:'client',name:'QA · Example domain',website:'https://example.com'});
const {audit}=await api({action:'audit',clientId:client.id,limit:5});let done;
for(let i=0;i<35;i++){const state=await api();done=state.audits.find(a=>a.id===audit.id);if(['complete','failed'].includes(done.status))break;await new Promise(r=>setTimeout(r,1500))}
assert.equal(done.status,'complete',done.error);assert.ok(done.result.pages.length);assert.ok(done.result.findings.length);
const f=done.result.findings[0];const {task}=await api({action:'task',auditId:audit.id,code:f.code,url:f.url});await api({action:'updateTask',id:task.id,status:'In progress',assignee:'QA reviewer',due:'2026-10-01',notes:'Before: '+f.evidence});
const {report}=await api({action:'report',auditId:audit.id,title:'QA Website report',period:'September 2026'});report.sections[0].text='Verified report edit persisted.';await api({action:'saveReport',id:report.id,title:report.title,sections:report.sections,template:'editorial'});
const pdf=await request('/api/pdf?id='+report.id);assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/pdf/);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');await writeFile('.sites-runtime/qa-report.pdf',bytes);
const {token}=await api({action:'share',id:report.id});const shared=await request('/share/'+token,null,false);assert.equal(shared.status,200);assert.match(await shared.text(),/Verified report edit persisted/);await api({action:'revoke',id:report.id});assert.equal((await request('/share/'+token,null,false)).status,404);
assert.equal((await request('/api/pdf?id='+report.id,null,false)).status,401);const csv=await request('/api/export?id='+audit.id);assert.equal(csv.status,200);assert.match(await csv.text(),/severity/);
const state=await api();assert.equal(state.tasks.find(t=>t.id===task.id).status,'In progress');assert.equal(state.reports.find(r=>r.id===report.id).sections[0].text,'Verified report edit persisted.');console.log(JSON.stringify({result:'PASS',pages:done.result.pages.length,findings:done.result.findings.length,pdfBytes:bytes.length,checks:['sign-in','SSRF input rejection','client persistence','background audit','evidence','task update','report editing','PDF download','share access','revocation','unauthorized API','CSV export']}));
