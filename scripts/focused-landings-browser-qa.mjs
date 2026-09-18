import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer';
const base=process.env.SITE_URL || 'http://localhost:3030';
const browser=await puppeteer.launch({headless:true});
const errors=[], posts=[], events=[], tags=[]; const taken=new Set();
let failOnce=false, conflictOnce=false, availabilityDown=false;
const reference='VC-123456789012345678901234';
const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const get=k=>Number(parts.find(p=>p.type===k).value); const monday=new Date(get('year'),get('month')-1,get('day')+1);
while(monday.getDay()!==1)monday.setDate(monday.getDate()+1);
const date=`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
const slugs=['anxiety','depression','cbt','couples','ocd','panic','social-anxiety','online-therapy','psychotherapists','free-consultation','mandarin','arabic','adhd','perfectionism','trauma'];
const receipt='v1.'+'a'.repeat(120)+'.'+'b'.repeat(43);
async function pageFor(route,ads=false) {
 const page=await browser.newPage(); page.setDefaultTimeout(25000); await page.setViewport({width:390,height:844});
 await page.evaluateOnNewDocument(()=>{let options; window.turnstile={render:(_el,next)=>{options=next;return 'mock-widget';},execute:()=>setTimeout(()=>options.callback('mock-token'),10),remove:()=>{}};});
 page.on('pageerror',error=>errors.push(error.message)); await page.setRequestInterception(true);
 page.on('request',async request=>{
  const url=new URL(request.url()); const json=(body,status=200)=>request.respond({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/consultation-slots') {
   if(availabilityDown){void json({error:'offline'},503);return;}
   const therapist=url.searchParams.get('therapist');
   const blocked=therapist?taken.has(therapist):taken.has('ryann-simpson')&&taken.has('wilfred-bengnwi');
   void json({booked:blocked?[`${date}|6:00 PM`]:[],calendarVersion:'therapist-capacity-v2'});return;
  }
  if(url.pathname==='/api/submit-intake') {
   const body=JSON.parse(request.postData() || await request.fetchPostData() || "{}"); posts.push(body);
   if(conflictOnce){conflictOnce=false;void json({slotUnavailable:true},409);return;}
   if(failOnce){failOnce=false;void json({error:'temporary'},503);return;}
   if(body.consultationDate===date && body.consultationTime==='6:00 PM')taken.add(body.preferredTherapist);
   void json({ok:true,referenceId:reference,...(body.googleAdsSessionId?{googleAdsThankYouReady:true,googleAdsConversionReceipt:receipt}:{})});return;
  }
  if(url.pathname==='/api/journey/steps'||url.pathname==='/api/google-ads/events'){events.push(JSON.parse(request.postData() || await request.fetchPostData() || "{}"));void request.respond({status:204,body:''});return;}
  if(url.pathname==='/thank-you/confirm'){void json({ok:true,conversionId:'gac-0123456789abcdef0123456789abcdef'});return;}
  if(url.hostname==='challenges.cloudflare.com'){void request.respond({status:200,contentType:'application/javascript',body:'/* simulated verification */'});return;}
  if(/googletagmanager|google-analytics/.test(url.hostname)){if(new URL(page.url()).pathname !== '/welcome')tags.push({page:page.url(),url:request.url()});void request.abort();return;}
  if(request.method()==='POST'||url.pathname.startsWith('/api/')||!['localhost','127.0.0.1'].includes(url.hostname)){void request.abort();return;}
  void request.continue();
 });
 let fragment='';
 if(ads){const now=Math.floor(Date.now()/1000);const payload={sub:'google-ads-main-domain-journey',session:'gas-12345678901234567890',landing:route,click:true,started:now,exp:now+3600,source:'google',medium:'cpc'};fragment='#vmh_ga=v1.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+ 's'.repeat(43);}
 const response=await page.goto(base+route+fragment,{waitUntil:'networkidle0',timeout:120000}); assert.equal(response.status(),200,route);
 return page;
}
async function choose(page,specific=false) {
 await page.bringToFront();
 const selector=specific?`#consultation button[aria-label="${date}"]:not([disabled])`:'#consultation [class*="calendar"] button:not([disabled])';
 await page.waitForSelector(selector);await page.click(selector);
 if(specific)await page.$$eval('#consultation [class*="periodTabs"] button',buttons=>buttons[2].click());
 await page.waitForSelector('#consultation [class*="timeGrid"] button:not([disabled])');
 await page.$$eval('#consultation [class*="timeGrid"] button',(buttons,specific)=>buttons.find(b=>!b.disabled&&(!specific||b.textContent==='6:00 PM')).click(),specific);
 await page.click('#consultation button[class*="primaryButton"]');
 await page.waitForSelector('input[name="firstName"]');
}
async function fill(page) {
 for(const [name,value] of [['firstName','Launch QA'],['email','launch-qa@example.invalid'],['phone','4165550100']])await page.type(`input[name="${name}"]`,value);
 await page.click('#consultation input[type="checkbox"]');
}
async function finish(page){await page.click('#consultation button[type="submit"]');await page.waitForSelector('#consultation [data-booking-step="complete"]');}
async function overflow(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+' overflow');}
try {
 await fs.mkdir('artifacts/ads-concepts',{recursive:true});
 for(const slug of (process.env.QA_BOOKING_ONLY === '1' ? [] : slugs)){
  const page=await pageFor('/welcome/'+slug);
  assert.equal(await page.$$eval('h1',items=>items.length),1);
  assert.equal(await page.$('[class*="reviewBar"]'),null);
  assert.equal(await page.$('[class*="demoNote"]'),null);
  for(const width of [1440,430,390,360]){await page.setViewport({width,height:900});await overflow(page,slug+width);}
  if(['ocd','arabic','mandarin','couples'].includes(slug))await page.screenshot({path:`artifacts/ads-concepts/live-${slug}-360.png`,fullPage:true});
  assert.ok(await page.$('#consultation [class*="calendar"] button:not([disabled])'),slug+' bookable date');
  await page.close();
 }
 if(process.env.QA_BOOKING_ONLY !== '1')console.log('PASS all 15 live destinations: no preview controls, four viewport widths, live availability.');
 const ocd=await pageFor('/welcome/ocd'),couples=await pageFor('/welcome/couples'),general=await pageFor('/welcome');
 await choose(ocd,true);await fill(ocd);failOnce=true;await ocd.click('#consultation button[type="submit"]');await ocd.waitForSelector('#consultation [role="alert"]');
 assert.equal(await ocd.$eval('input[name="firstName"]',el=>el.disabled),true,'ambiguous retry locks appointment');
 await ocd.$$eval('#your-therapist article button',items=>items.at(-1).click());
 assert.ok((await ocd.$eval('#consultation [class*="bookingSummary"]',el=>el.textContent)).includes('Ryann Simpson'),'external CTA cannot change pending booking');
 await finish(ocd);
 assert.equal(posts.at(-1).clientSubmissionId,posts.at(-2).clientSubmissionId,'retry same request identity');
 assert.equal(posts.at(-1).preferredTherapist,'ryann-simpson');
 assert.equal(posts.at(-1).landingConcept,'ocd');
 await couples.bringToFront();await couples.waitForSelector(`#consultation button[aria-label="${date}"]:not([disabled])`);await couples.click(`#consultation button[aria-label="${date}"]`);
 await couples.$$eval('#consultation [class*="periodTabs"] button',buttons=>buttons[2].click());
 await couples.waitForFunction(()=>[...document.querySelectorAll('#consultation [class*="timeGrid"] button')].find(b=>b.textContent==='6:00 PM')?.disabled);
 await couples.select('#consultation select[aria-label="Choose your therapist"]','wilfred-bengnwi');
 await couples.$$eval('#consultation [class*="periodTabs"] button',buttons=>buttons[2].click());
 await couples.waitForFunction(()=>[...document.querySelectorAll('#consultation [class*="timeGrid"] button')].some(b=>b.textContent==='6:00 PM'&&!b.disabled));
 await general.bringToFront();
 const allBefore=await general.evaluate(()=>fetch('/api/consultation-slots').then(r=>r.json()));assert.deepEqual(allBefore.booked,[]);
 await choose(couples,true);await fill(couples);await finish(couples);
 const allAfter=await general.evaluate(()=>fetch('/api/consultation-slots').then(r=>r.json()));assert.ok(allAfter.booked.includes(date+'|6:00 PM'));
 for(const p of [ocd,couples,general])await p.close();
 console.log('PASS lost-response retry identity, selected therapist lock, cross-tab refresh, remaining general capacity.');
 taken.clear();
 for(const slug of ['arabic','mandarin']){
  const page=await pageFor('/welcome/'+slug);
  const native=slug==='arabic'?'ar':'zh-Hans';
  assert.equal(await page.$eval('#top',el=>el.lang),native);
  await page.click('[class*="languageToggle"] button[lang="en"]');
  assert.equal(await page.$eval('#consultation select',el=>el.value),slug==='arabic'?'Arabic':'Mandarin');
  await page.click(`[class*="languageToggle"] button[lang="${native}"]`);
  await choose(page);await fill(page);conflictOnce=true;await page.click('#consultation button[type="submit"]');await page.waitForSelector('#consultation [data-booking-step="time"]');
  await choose(page);assert.equal(await page.$eval('input[name="email"]',el=>el.value),'launch-qa@example.invalid');
  await finish(page);assert.equal(posts.at(-1).landingLocale,native);assert.equal(posts.at(-1).consultationLanguage,slug==='arabic'?'Arabic':'Mandarin');
  assert.equal(await page.$eval('#consultation [role="status"]',el=>el.textContent.includes('This was a preview')),false);
  await overflow(page,slug+' confirmation');await page.close();
 }
 console.log('PASS native languages, English toggle preserves call language, conflict recovery retains contact fields.');
 availabilityDown=true;const closed=await pageFor('/welcome/adhd');assert.equal(await closed.$('#consultation [class*="calendar"] button[aria-pressed]:not([disabled])'),null);await closed.close();availabilityDown=false;
 const ads=await pageFor('/welcome/arabic',true);await choose(ads);await fill(ads);await ads.click('#consultation button[type="submit"]');
 await ads.waitForFunction(()=>location.pathname==='/thank-you');await ads.waitForSelector('main[lang="ar"]');
 await ads.waitForFunction(()=>window.dataLayer?.some(item=>item.event==='google_ads_consultation_conversion'));
 assert.equal(await ads.evaluate(()=>document.referrer),'','no therapy path in confirmation referrer');
 assert.ok(tags.every(tag=>new URL(tag.page).pathname==='/thank-you'),'marketing tags only on neutral confirmation');
 assert.ok(events.flatMap(batch=>batch.events||[]).some(event=>event.path==='/welcome/arabic'&&event.event==='consultation_submitted'));
 assert.equal(await ads.evaluate(()=>window.dataLayer.filter(item=>item.event==='google_ads_consultation_conversion').length),1);
 await ads.screenshot({path:'artifacts/ads-concepts/live-arabic-confirmation.png'});await ads.close();
 assert.deepEqual(errors,[]);
 console.log('PASS fail-closed availability, signed journey, native named confirmation, neutral one-time Ads conversion.');
 await fs.writeFile('artifacts/ads-concepts/live-browser-result.json',JSON.stringify({passed:true,slugs,posts:posts.length,thirdPartyTagsOnlyNeutral:tags.every(tag=>new URL(tag.page).pathname==='/thank-you'),errors},null,2));
}finally{await browser.close();}
