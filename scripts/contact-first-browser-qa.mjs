// Local test services only. Browser submits are intercepted; no real email or slot is created.
import assert from 'node:assert/strict';
import { createHmac,randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';
const port=Number(process.env.CONTACT_QA_PORT||3339),origin=`http://localhost:${port}`;
const secret='contact-first-local-browser-qa-signing-secret';
const slugs=['anxiety','depression','cbt','couples','ocd','panic','social-anxiety','online-therapy','psychotherapists','free-consultation','mandarin','arabic','adhd','perfectionism','trauma','muslim-therapy','female-muslim-therapist','muslim-marriage'];
const now=new Date().toISOString(),sessionId='gas-11111111-1111-4111-8111-111111111111';
const journey={sessionId,startedAt:now,lastSeenAt:now,landingPath:'/welcome/arabic',lastPath:'/welcome/arabic',eventCount:4,formStarted:true,consultationCtaClicked:true,consultationSubmitted:true,consultationReferenceId:'VC-111111111111111111111111',booked:false,device:'mobile',campaign:'manual_test'};
const events=['hero-cta','contact-submit','calendar-open','calendar-date'].map((targetId,i)=>({sessionId,sessionStartedAt:now,occurredAt:now,sequence:i+1,event:targetId==='hero-cta'?'consultation_cta_clicked':'control_clicked',path:'/welcome/arabic',targetId,targetType:targetId==='hero-cta'?'consultation':'button',...(targetId==='hero-cta'?{targetPath:'/welcome/arabic'}:{})}));
const database=createServer(async(request,response)=>{ const chunks=[];for await(const chunk of request) chunks.push(chunk); const input=JSON.parse(Buffer.concat(chunks).toString()||'{}'); const name=new URL(request.url,origin).pathname.split('/').at(-1);let data={accepted:true,seeded:true};
 if(name==='is_google_ads_booking_control') data=!process.env.CONTACT_QA_LEGACY;
 if(name==='get_booked_consultation_slots_v2') data=[];
 if(name==='get_crm_reporting_state') data={section:'google_ads',activeSince:'2026-01-01T00:00:00.000Z',updatedAt:now};
 if(name==='list_crm_reporting_archives') data={section:'google_ads',activeSince:'2026-01-01T00:00:00.000Z',archives:[]};
 if(name==='export_google_ads_journeys') data=[journey].slice(input.p_offset,input.p_offset+input.p_limit);
 if(name==='export_google_ads_journey_events') data=events.slice(input.p_offset,input.p_offset+input.p_limit);
 if(name==='repair_consultation_request_attribution') data={accepted:true,leadId:'11111111-1111-4111-8111-111111111111',requestReference:input.p_request_reference};
 response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify(data));
});
await new Promise(resolve=>database.listen(port+1,'127.0.0.1',resolve));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-p',String(port)],{windowsHide:true,env:{...process.env,NODE_ENV:'development',SUPABASE_URL:`http://127.0.0.1:${port+1}`,SUPABASE_SECRET_KEY:'sb_secret_local_fixture',SUPABASE_SERVICE_ROLE_KEY:'',GOOGLE_ADS_CONVERSION_SECRET:secret,CHECKPOINT_ADMIN_SESSION_SECRET:secret},stdio:['ignore','pipe','pipe']});
let output=''; server.stdout.on('data',data=>{output+=data});server.stderr.on('data',data=>{output+=data});let browser;
try {
 for(let i=0;i<180;i++){try{const response=await fetch(`${origin}/api/consultation-slots`,{signal:AbortSignal.timeout(1000)});if(response.ok)break;}catch{}if(i===179)throw Error(output.slice(-2000));await new Promise(resolve=>setTimeout(resolve,500));}
 console.log('Local fixture server ready.');browser=await puppeteer.launch({headless:true,pipe:true,timeout:60000,protocolTimeout:120000});await mkdir('artifacts/contact-first',{recursive:true});const page=await browser.newPage();page.setDefaultTimeout(45000);const errors=[],submissions=[],batches=[];let failContact=false,conflict=false;
 page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());
  if(url.hostname==='challenges.cloudflare.com'){void request.respond({status:200,contentType:'application/javascript',body:`window.turnstile={render:(el,options)=>{el._qaOptions=options;return 'qa-'+Math.random()},execute:(el)=>setTimeout(()=>el._qaOptions.callback('qa-token'),0),remove:()=>{}};`});return;}
  if(url.pathname==='/api/submit-intake'){const body=JSON.parse(request.postData());submissions.push(body);const status=body.bookingStage==='contact'&&failContact?(failContact=false,503):body.bookingStage==='booking'&&conflict?(conflict=false,409):200;void request.respond({status,contentType:'application/json',body:JSON.stringify(status===503?{error:'Test delivery failure'}:status===409?{slotUnavailable:true}:{ok:true,referenceId:body.bookingStage==='contact'?'VC-111111111111111111111111':'VC-222222222222222222222222',...(body.bookingStage==='contact'?{continuationToken:'qa-continuation-token'}:{})})});return;}
  if(['/api/journey/steps','/api/google-ads/events'].includes(url.pathname)){batches.push(JSON.parse(request.postData()||'{}'));void request.respond({status:204});return;}
  if(url.pathname==='/api/google-ads/consultation-conversion'){void request.respond({status:503,contentType:'application/json',body:'{}'});return;}
  if(url.pathname==='/api/funnel-events'){void request.respond({status:204});return;}
  if(url.hostname!=='localhost'&&url.protocol!=='data:'){void request.abort();return;}
  void request.continue();
 });
 async function goto(path){console.log('Checking '+path);const response=await page.goto(origin+path,{waitUntil:'networkidle0',timeout:120000});assert.equal(response.status(),200,path);}
 async function click(selector){await page.$eval(selector,el=>el.click());}
 async function fill(selector,value){await page.$eval(selector,(el,text)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));},value);}
 if(process.env.CONTACT_QA_LEGACY){await goto('/welcome/arabic');assert.ok(await page.$('[data-google-ads-control-id="calendar-date"]'),'Legacy calendar first');assert.equal(await page.$('#consultation input[type="email"]'),null);await click('[data-google-ads-control-id="calendar-date"]:not(:disabled)');await click('[data-google-ads-control-id="calendar-time"]:not(:disabled)');await click('[data-google-ads-control-id="calendar-confirm"]');await page.waitForSelector('#consultation input[type="email"]');await goto('/welcome');assert.ok(await page.$('input[type="email"]'));assert.equal(await page.$('[data-google-ads-control-id="calendar-open"]'),null);console.log('PASS: migration absent keeps existing named and general booking flows usable.');}else {
 for(const slug of process.env.CONTACT_QA_FAST ? [] : slugs){await goto('/welcome/'+slug);assert.ok(await page.$('#consultation input[type="email"]'),slug+' contact form first');assert.equal(await page.$('#consultation [data-google-ads-control-id="calendar-date"]'),null,slug+' no calendar before details');}
 if(!process.env.CONTACT_QA_FAST) console.log('PASS all 18 focused routes start with contact fields.');
 for(const [path,width] of [['/welcome/arabic',390],['/welcome/mandarin',1440],['/welcome/couples',1440],['/welcome',390]]){
  submissions.length=0;await page.setViewport({width,height:1000});await goto(path+'?gclid=manual-test-'+path.replaceAll('/','-')+'&utm_campaign=manual_test');
  const formSelector=path==='/welcome'?'form[data-google-ads-consultation-form="true"]':'#consultation form';
  const form=await page.$(formSelector);assert.ok(form);
  const formId=await form.evaluate(el=>{el.id='qa-contact-form';return '#qa-contact-form'});
  await fill(formId+' input[data-google-ads-field-id="full-name"]','Alex');await fill(formId+' input[type="email"]','qa@example.invalid');
  await page.focus(formId+' input[type="tel"]');await page.keyboard.type('6135550100123');assert.equal(await page.$eval(formId+' input[type="tel"]',el=>el.value),'(613) 555-0100');
  await click(formId+' input[type="checkbox"]');
  if(path==='/welcome/couples') failContact=true;
  await click(formId+' [data-google-ads-control-id="contact-submit"]');
  if(path==='/welcome/couples'){await page.waitForFunction(()=>document.querySelector('[role="alert"]')?.textContent.includes('confirm your request'));assert.equal(await page.$('[data-google-ads-control-id="calendar-open"]'),null);await click(formId+' [data-google-ads-control-id="contact-submit"]');}
  await page.waitForSelector('[data-google-ads-control-id="calendar-open"]');assert.ok(submissions.length>=1);assert.equal(submissions[0].bookingStage,'contact');assert.equal(submissions[0].consultationDate,undefined);assert.equal(submissions[0].lastName,'');
  if(path==='/welcome/couples')assert.equal(submissions[0].clientSubmissionId,submissions[1].clientSubmissionId,'retry identity');
  await page.screenshot({path:'artifacts/contact-first/'+path.split('/').at(-1)+'-details-saved.png',fullPage:false});
  await click('[data-google-ads-control-id="calendar-open"]');await page.waitForSelector('[data-google-ads-control-id="calendar-date"]:not(:disabled)');await click('[data-google-ads-control-id="calendar-date"]:not(:disabled)');await page.waitForSelector('[data-google-ads-control-id="calendar-time"]:not(:disabled)');await click('[data-google-ads-control-id="calendar-time"]:not(:disabled)');
  if(path==='/welcome/couples')conflict=true;
  await click('[data-google-ads-control-id="calendar-confirm"]');
  if(path==='/welcome/couples'){await page.waitForFunction(()=>[...document.querySelectorAll('[role="alert"]')].some(el=>el.textContent.includes('no longer available')));await click('[data-google-ads-control-id="calendar-time"]:not(:disabled)');await click('[data-google-ads-control-id="calendar-confirm"]');}
  await page.waitForSelector('[data-booking-step="complete"]');const booked=submissions.at(-1);assert.equal(booked.bookingStage,'booking');assert.equal(booked.continuationToken,'qa-continuation-token');assert.ok(booked.consultationDate&&booked.consultationTime);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'horizontal overflow '+path);
  console.log('PASS two-stage UI '+path+' '+width+'px');
 }
 await goto('/consultation');await page.waitForSelector('#full-name');await fill('#full-name','Alex');await fill('#email','qa@example.invalid');await page.focus('#phone');await page.keyboard.type('6135550100123');assert.equal(await page.$eval('#phone',el=>el.value),'(613) 555-0100');
 // The real website form must accept a single name and reach its availability step.
 await page.evaluate(()=>{const check=document.querySelector('input[data-google-ads-field-id="consent"]');if(check&&!check.checked)check.click();});
 await page.select('#therapy-type','Not Sure'); await page.$$eval('button',els=>els.find(el=>/Continue/i.test(el.textContent))?.click());
 await page.waitForFunction(()=>document.querySelector('main')?.textContent.includes('When works best for you?'));console.log('PASS main-site phone cap and single-name progression.');
 const seconds=Math.floor(Date.now()/1000);const encoded=Buffer.from(JSON.stringify({sub:'checkpoint-admin',iat:seconds,exp:seconds+28800,nonce:randomBytes(16).toString('base64url')})).toString('base64url');const unsigned='v1.'+encoded;await page.setExtraHTTPHeaders({cookie:`__Host-vmh_checkpoint_admin=${unsigned}.${createHmac('sha256',secret).update(unsigned).digest('base64url')}`});
 await goto('/admin/checkpoints/google-ads');await click('[data-landing-path="/welcome/arabic"]');
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Analyze'));await page.$$eval('button',els=>els.find(el=>el.textContent.trim()==='Analyze')?.click());await page.waitForSelector('#consultation-analysis');await page.waitForFunction(()=>document.querySelector('#consultation-analysis')?.textContent.includes('Details received — no confirmed time'));await page.screenshot({path:'artifacts/contact-first/crm-analysis.png'});await click('#close-consultation-analysis');assert.equal(await page.$('#consultation-analysis'),null);console.log('PASS CRM Analyze popup, actual controls, outcomes and close.');
 const emitted=batches.flatMap(body=>body.events||[]);assert.ok(emitted.some(event=>event.targetId==='contact-submit'));assert.ok(emitted.some(event=>event.targetId==='calendar-time'));assert.ok(emitted.some(event=>event.event==='consultation_submitted'&&event.formStep===1));assert.ok(emitted.some(event=>event.event==='consultation_submitted'&&event.formStep===2));assert.ok(!JSON.stringify(emitted).includes('qa@example.invalid'),'contact values in journey');assert.deepEqual(errors,[]);
 console.log('PASS private structural events, no contact values, no browser errors.');
 }
}finally{await browser?.close();server.kill();await new Promise(resolve=>database.close(resolve));}
