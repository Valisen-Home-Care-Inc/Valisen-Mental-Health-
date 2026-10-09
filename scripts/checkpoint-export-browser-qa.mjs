// Authenticated local CSV download check. All data comes from local fixtures.
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
const port=3357,origin=`http://localhost:${port}`,secret='checkpoint-export-local-browser-qa-secret';
const now=new Date().toISOString(),from='2026-08-23T00:00:00.000Z';
const kpis={sessions:0,checkinsStarted:0,checkinsCompleted:0,completionRate:0,resultViews:0,therapistIntent:0,consultationCtaRate:0,consultationsStarted:0,consultationsSubmitted:0,sessionToConsultationRate:0,externalBookingClicks:0};
const codes=Array.from({length:25},(_,index)=>`VMH-${String(index+1).padStart(2,'0')}`);
let failures=false;const requests=[];
const database=createServer(async(request,response)=>{const chunks=[];for await(const chunk of request)chunks.push(chunk);const args=JSON.parse(Buffer.concat(chunks).toString()||'{}'),name=new URL(request.url,origin).pathname.split('/').at(-1);requests.push({name,args});const range={from:args.p_from||from,to:args.p_to||now};let data={};
 if(name==='get_crm_reporting_state')data={section:'checkpoints',activeSince:from,updatedAt:now};
 if(name==='list_crm_reporting_archives')data={section:'checkpoints',activeSince:from,archives:[]};
 if(name==='get_checkpoint_action_metrics')data={total:0,cohortSessions:0,checkpoints:[],placements:[],daily:[],dayOfWeek:[],resultActions:[],intentMix:[]};
 if(name==='get_checkpoint_dashboard')data={generatedAt:now,range,kpis,funnel:[],questionSteps:[],checkpoints:codes.map(code=>({...kpis,code,status:'active',createdAt:from,currentPlacement:null,sparkline:[]})),leads:[]};
 if(name==='get_checkpoint_detail'){if(failures){response.writeHead(503);response.end('{}');return;}data={generatedAt:now,range,checkpoint:{code:args.p_checkpoint_code,status:'active',createdAt:from,currentPlacement:null},kpis,cumulativeKpis:kpis,funnel:[],questionSteps:[],placements:[],daily:[{date:'2026-10-08',sessions:0}],dayOfWeek:[],leads:[]};}
 response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify(data));});
await new Promise(resolve=>database.listen(port+1,'127.0.0.1',resolve));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-p',String(port)],{windowsHide:true,env:{...process.env,NODE_ENV:'development',SUPABASE_URL:`http://127.0.0.1:${port+1}`,SUPABASE_SECRET_KEY:'sb_secret_local_fixture',SUPABASE_SERVICE_ROLE_KEY:'',CHECKPOINT_ADMIN_SESSION_SECRET:secret},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',data=>{output+=data});server.stderr.on('data',data=>{output+=data});let browser;
try{
 const seconds=Math.floor(Date.now()/1000),encoded=Buffer.from(JSON.stringify({sub:'checkpoint-admin',iat:seconds,exp:seconds+28800,nonce:randomBytes(16).toString('base64url')})).toString('base64url'),unsigned='v1.'+encoded,cookie=`__Host-vmh_checkpoint_admin=${unsigned}.${createHmac('sha256',secret).update(unsigned).digest('base64url')}`;
 for(let index=0;index<180;index++){try{const response=await fetch(`${origin}/api/admin/checkpoints/dashboard?range=invalid`,{headers:{cookie},signal:AbortSignal.timeout(1000)});if(response.status===400)break;}catch{}if(index===179)throw Error(output.slice(-2000));await new Promise(resolve=>setTimeout(resolve,500));}
 browser=await puppeteer.launch({headless:true,pipe:true,timeout:60000});const page=await browser.newPage();page.setDefaultTimeout(45000);await page.setExtraHTTPHeaders({cookie});await page.evaluateOnNewDocument(()=>{const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.qaExportBlob=blob;return create(blob);};});
 await page.setRequestInterception(true);page.on('request',request=>{if(new URL(request.url()).hostname!=='localhost')void request.abort();else void request.continue();});
 await page.setViewport({width:390,height:844});await page.goto(`${origin}/admin/checkpoints`,{waitUntil:'networkidle0',timeout:120000});
 await page.$$eval('button',buttons=>buttons.find(button=>button.textContent.trim()==='Export all checkpoint data (CSV)').click());await page.waitForFunction(()=>window.qaExportBlob);const csv=await page.evaluate(()=>window.qaExportBlob.text());assert.ok(csv.includes('checkpoint.daily'));for(const code of codes)assert.ok(csv.includes(code),code);assert.ok(csv.includes('dashboard.kpis'));
 await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.includes('25 checkpoints'));assert.ok(requests.filter(request=>request.name==='get_checkpoint_detail').length>=25);
 console.log('PASS: authenticated one-file CSV download includes all 25 checkpoints and daily detail, with mobile export button and success feedback.');
 failures=true;await page.evaluate(()=>{window.qaExportBlob=null;});await page.$$eval('button',buttons=>buttons.find(button=>button.textContent.trim()==='Export all checkpoint data (CSV)').click());await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.includes('could not be created'));assert.equal(await page.evaluate(()=>window.qaExportBlob),null);console.log('PASS: failed detail lookup shows an error and downloads no partial CSV.');
}finally{await browser?.close();server.kill();await new Promise(resolve=>database.close(resolve));}
