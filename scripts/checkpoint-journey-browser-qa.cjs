// Production UI against isolated PostgreSQL. Mail/challenge responses are mocked; never contacts live services.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {randomUUID,createHash,createHmac,randomBytes,pbkdf2Sync}=require('node:crypto');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..'),appDir=process.env.CHECKPOINT_JOURNEY_QA_APP_DIR||root;
const origin='http://127.0.0.1:3318',secret='checkpoint-launch-local-qa-secret-never-production-123456789';
const packagePath=path.join(root,'artifacts/pooled-calendar-test/node_modules/@electric-sql/pglite');
const {PGlite}=require(packagePath),{btree_gist}=require(path.join(packagePath,'dist/contrib/btree_gist.cjs')),{pgcrypto}=require(path.join(packagePath,'dist/contrib/pgcrypto.cjs'));
const output=path.join(root,'artifacts/checkpoints/journey-launch');fs.mkdirSync(output,{recursive:true});
let db,rpcServer,app,browser;const errors=[],violations=[],eventBodies=[],requestBodies=[];let firstFailure=true;
const query=async(name,body)=>{
 if(!/^[a-z][a-z0-9_]+$/.test(name)||Object.keys(body).some(key=>!/^p_[a-z_]+$/.test(key)))throw Error('Invalid QA RPC');
 const keys=Object.keys(body);return (await db.query(`select public.${name}(${keys.map((key,index)=>`${key} => $${index+1}`).join(',')}) as data`,keys.map(key=>body[key]))).rows[0].data;
};
(async()=>{
 db=new PGlite({extensions:{btree_gist,pgcrypto}});await db.exec('create role anon;create role authenticated;create role service_role;');
 const directory=path.join(appDir,'supabase/migrations');
 for(const name of fs.readdirSync(directory).filter(name=>name.endsWith('.sql')&&name<'20261013000000').sort())await db.exec(fs.readFileSync(path.join(directory,name),'utf8').replace(/\r\n/g,'\n'));
 // Use the exact SQL installed by the owner, including its initial report contract.
 await db.exec(fs.readFileSync(path.join(appDir,'artifacts/checkpoints/LAUNCH_CHECKPOINT_JOURNEY.sql'),'utf8').replace(/\r\n/g,'\n'));
 const old=randomUUID();for(const event of ['landing_view','checkin_started','checkin_completed','result_viewed','intent_result_only_selected'])await query('ingest_checkpoint_event',{p_checkpoint_code:'VMH-01',p_anonymous_session_id:old,p_client_event_id:randomUUID(),p_event_name:event});
 for(let step=1;step<=4;step++)await query('ingest_checkpoint_event',{p_checkpoint_code:'VMH-01',p_anonymous_session_id:old,p_client_event_id:randomUUID(),p_event_name:'checkin_step_completed',p_step_number:step});
 rpcServer=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;try{const data=await query(req.url.split('/').pop(),JSON.parse(raw||'{}'));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));}catch(error){console.error('QA RPC unavailable: '+req.url+' '+error.message.slice(0,160));res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');}});
 await new Promise(resolve=>rpcServer.listen(3918,'127.0.0.1',resolve));
 const salt=Buffer.alloc(16,1),passwordHash=`pbkdf2_sha256$210000$${salt.toString('base64url')}$${pbkdf2Sync('qa-only',salt,210000,32,'sha256').toString('base64url')}`;
 const env={...process.env,SUPABASE_URL:'http://127.0.0.1:3918',SUPABASE_SECRET_KEY:'sb_secret_local_qa',CHECKPOINT_ADMIN_SESSION_SECRET:secret,CHECKPOINT_ADMIN_PASSWORD_HASH:passwordHash,GMAIL_USER:'qa@example.invalid',GMAIL_APP_PASSWORD:'no-live-mail'};
 app=cp.spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',appDir,'--webpack','--hostname','127.0.0.1','--port','3318'],{cwd:appDir,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 const logs=[];app.stdout.on('data',chunk=>logs.push(chunk.toString()));app.stderr.on('data',chunk=>logs.push(chunk.toString()));
 for(let n=0;n<120;n++){if(app.exitCode!==null)throw Error('QA app exited: '+logs.join('').slice(-1200));try{const response=await fetch(origin+'/c/VMH-25');if(response.ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,500));if(n===119)throw Error('QA app startup timeout');}
 browser=await puppeteer.launch({headless:true,pipe:true,protocolTimeout:120000});const page=await browser.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);page.on('request',request=>{void(async()=>{
  const url=new URL(request.url());
  if(url.hostname==='challenges.cloudflare.com')return request.respond({status:200,contentType:'application/javascript',body:'window.turnstile={render:function(el,o){setTimeout(function(){o.callback("qa-token")},10);return "qa-widget"},remove:function(){},execute:function(){}};'});
  if(url.origin!==origin&&url.protocol!=='data:'){violations.push(request.url());return request.abort();}
  if(url.pathname==='/api/checkpoint-journey/events')eventBodies.push(JSON.parse(request.postData()));
  if(url.pathname==='/api/checkpoint-journey/request'){
   const body=JSON.parse(request.postData());requestBodies.push(body);await new Promise(resolve=>setTimeout(resolve,650));
   if(firstFailure){firstFailure=false;return request.respond({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Sample request failure. Please retry.'})});}
   const reference=`VC-${createHash('sha256').update(`checkpoint-free-call-v3:${body.clientSubmissionId}`).digest('hex').slice(0,24).toUpperCase()}`;
   await query('save_checkpoint_call_request',{p_checkpoint_code:body.checkpointCode,p_session_key:body.sessionId,p_client_submission_id:body.clientSubmissionId,p_reference_id:reference,p_payload_hash:createHash('sha256').update(JSON.stringify([body.checkpointCode,body.sessionId,body.firstName,body.contact,body.preferredTherapist,body.consultationLanguage,body.requestedService])).digest('hex'),p_first_name:body.firstName,p_phone:body.contact,p_therapist:body.preferredTherapist,p_language:body.consultationLanguage,p_service:body.requestedService});
   return request.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,referenceId:reference,requestSaved:true,appointmentBooked:false})});
  }
  return request.continue();
 })().catch(error=>{errors.push(error.message);void request.abort();});});
 const viewport=(width,height=844)=>page.setViewport({width,height,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const goto=async(code)=>{const response=await page.goto(origin+'/c/'+code,{waitUntil:'networkidle0',timeout:120000});assert.equal(response.status(),200);await page.waitForSelector('[data-funnel-version="mental-battery-v3"]');assert.match(response.headers()['content-security-policy'],/frame-src https:\/\/challenges.cloudflare.com/);assert.equal(await page.evaluate(()=>scrollY),0);};
 const answer=async(value,next)=>{await page.click(`[data-answer="${value}"]`);await page.waitForSelector(next==='result'?'[data-phase="result"]':`[data-question="${next}"]`);await new Promise(resolve=>setTimeout(resolve,210));};
 const fill=(selector,value)=>page.$eval(selector,(element,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));},value);
 const click=selector=>page.$eval(selector,element=>element.click());
 const size=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
 await viewport(390);for(let n=1;n<=25;n++)await goto(`VMH-${String(n).padStart(2,'0')}`);await page.screenshot({path:path.join(output,'01-entry-phone.png'),fullPage:true});
 await answer('energized',2);await answer('none',3);await answer('unsure','result');assert.equal(await page.$('[data-question="4"]'),null);assert.match(await page.$eval('#offer-heading',e=>e.textContent),/No specific concern/);
 await page.$$eval('button',buttons=>buttons.find(b=>b.textContent.trim()==='Edit answers').click());await answer('low',2);await answer('relationships',3);await answer('couples',4);await answer('often','result');await page.select('#result-language','Arabic');assert.match(await page.$eval('[data-primary-consultation]',e=>e.textContent),/Meryem/);
 await click('[data-primary-consultation]');await page.waitForSelector('dialog[open]');assert.equal(await page.$('[name="email"]'),null);assert.equal(await page.$eval('[name="phone"]',e=>e.required),true);assert.equal(await page.$eval('#journey-call-language',e=>e.value),'Arabic');
 await click('dialog button[type="submit"]');await fill('[name="firstName"]','Alex');await click('[name="consent"]');await click('dialog button[type="submit"]');assert.equal(requestBodies.length,0);assert.equal(await page.$eval('[name="phone"]',e=>e.getAttribute('aria-invalid')),'true');
 await fill('[name="phone"]','613');await click('dialog button[type="submit"]');assert.equal(requestBodies.length,0);await fill('[name="phone"]','+1 (613) 555-0123');assert.equal(await page.$eval('[name="phone"]',e=>e.value),'(613) 555-0123');await page.screenshot({path:path.join(output,'02-required-phone.png'),fullPage:true});
 await page.$eval('dialog form',form=>{form.requestSubmit();form.requestSubmit();});await page.waitForSelector('form[aria-busy="true"]');await page.waitForFunction(()=>document.querySelector('dialog')?.textContent.includes('Sample request failure'));assert.equal(requestBodies.length,1);assert.equal(await page.$eval('[name="phone"]',e=>e.value),'(613) 555-0123');
 await page.$eval('dialog form',form=>{form.requestSubmit();form.requestSubmit();});await page.waitForSelector('[data-phase="confirmation"]');assert.equal(requestBodies.length,2);assert.equal(requestBodies[0].clientSubmissionId,requestBodies[1].clientSubmissionId);assert.match(await page.$eval('main',e=>e.textContent),/not a confirmed appointment/);await page.screenshot({path:path.join(output,'03-saved-request.png'),fullPage:true});
 const report=await query('get_checkpoint_journey_report',{p_from:new Date(Date.now()-86400000).toISOString(),p_to:new Date(Date.now()+60000).toISOString()});assert.equal(report.sessions,25);assert.equal(report.actions.saved,1);assert.equal(report.actions.booked,0);assert.equal(report.legacySessions,1);
 for(const body of eventBodies){assert.equal(body.version,'mental-battery-v3');assert(!['answers','topic','concern','therapist','phone','email','contact'].some(key=>key in body));}
 const issued=Math.floor(Date.now()/1000),encoded=Buffer.from(JSON.stringify({sub:'checkpoint-admin',iat:issued,exp:issued+8*3600,nonce:randomBytes(16).toString('base64url')})).toString('base64url'),unsigned='v1.'+encoded,token=unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url');
 await page.setExtraHTTPHeaders({Cookie:'__Host-vmh_checkpoint_admin='+token});await viewport(1440,1000);await page.goto(origin+'/admin/checkpoints',{waitUntil:'networkidle0',timeout:120000});
 try { await page.waitForSelector('[data-checkpoint-journey-report]'); }
 catch(error) { await page.screenshot({path:path.join(output,'crm-failure.png'),fullPage:true});console.error('CRM URL: '+page.url());console.error((await page.$eval('body',e=>e.textContent)).slice(-2200));console.error('Server: '+logs.join('').slice(-1800));throw error; }
 assert.match(await page.$eval('[data-checkpoint-journey-report]',e=>e.textContent),/1 left|0 left/);await page.screenshot({path:path.join(output,'04-crm-report.png'),fullPage:true});
 const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:output});await page.$$eval('button',buttons=>buttons.find(b=>b.textContent.trim()==='Export quiz report CSV').click());
 for(let i=0;i<20;i++){if(fs.readdirSync(output).some(name=>name.endsWith('.csv')))break;await new Promise(resolve=>setTimeout(resolve,100));}
 const csv=fs.readdirSync(output).find(name=>name.endsWith('.csv'));assert(csv,'CSV downloaded');assert.match(fs.readFileSync(path.join(output,csv),'utf8'),/mental-battery-v3/);assert.match(fs.readFileSync(path.join(output,csv),'utf8'),/New questions/);
 const fullExport=await page.evaluate(async()=>{const response=await fetch('/api/admin/checkpoints/export?range=all');return {status:response.status,count:response.headers.get('x-export-checkpoints'),csv:await response.text()};});
 assert.equal(fullExport.status,200);assert.equal(fullExport.count,'25');assert.match(fullExport.csv,/dashboard\.journey\.questions/);assert.match(fullExport.csv,/mental-battery-v3/);fs.writeFileSync(path.join(output,'all-checkpoint-data.csv'),fullExport.csv);
 await page.goto(origin+'/admin/checkpoints/VMH-25',{waitUntil:'networkidle0',timeout:120000});await page.waitForSelector('[data-checkpoint-journey-report]');assert.match(await page.$eval('[data-checkpoint-journey-report]',e=>e.textContent),/1 new-quiz sessions/);
 for(const width of [320,390,768,1440]){await viewport(width,900);await size();}
 await viewport(390);await goto('VMH-24');await answer('low',2);await answer('worry',3);await answer('overthinking',4);await answer('often','result');await size();await page.screenshot({path:path.join(output,'05-anxiety-phone.png'),fullPage:true});
 assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'qa-report.json'),JSON.stringify({passed:true,vmhs:25,requestRetries:requestBodies.length,privateStructuralEvents:eventBodies.length,noLiveMail:true,checks:['all URLs and no entry scroll jump','adaptive 3/4 questions','Arabic couples therapist and language','mandatory formatted phone','failed request retains details; retry ID stable','server-saved request separated from booking','new CRM questions and historical cohorts','VMH-specific report and CSV','mobile widths and no external marketing requests']},null,2));console.log('PASS: all 25 production checkpoint routes, adaptive questions, phone-required contact, retry/saved state, real PostgreSQL analytics, CRM new/legacy separation and CSV, mobile layouts. No live mail was sent.');
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(app&&app.exitCode===null){if(process.platform==='win32'){try{cp.execFileSync('taskkill',['/pid',String(app.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});}catch{app.kill();}}else app.kill();}if(rpcServer)await new Promise(resolve=>rpcServer.close(resolve));if(db)await db.close();});
