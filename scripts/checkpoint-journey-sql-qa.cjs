// Real PostgreSQL in memory; no live database or email connections.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const packagePath=path.join(root,'artifacts/pooled-calendar-test/node_modules/@electric-sql/pglite');
const {PGlite}=require(packagePath),{btree_gist}=require(path.join(packagePath,'dist/contrib/btree_gist.cjs')),{pgcrypto}=require(path.join(packagePath,'dist/contrib/pgcrypto.cjs'));
(async()=>{
 const db=new PGlite({extensions:{btree_gist,pgcrypto}});
 try {
  await db.exec('create role anon;create role authenticated;create role service_role;');
  const directory=path.join(root,'supabase/migrations');
  for(const name of fs.readdirSync(directory).filter(name=>name.endsWith('.sql')&&name<'20261013000000').sort()) await db.exec(fs.readFileSync(path.join(directory,name),'utf8').replace(/\r\n/g,'\n'));
  const rows=async(sql,args=[])=>(await db.query(sql,args)).rows;
  const value=async(sql,args=[])=>(await rows(sql,args))[0].data;
  const old=randomUUID(); await value("select public.ingest_checkpoint_event('VMH-01',$1::uuid,$2::uuid,'landing_view') as data",[old,randomUUID()]);
  const oldRows=await rows('select to_jsonb(s) as data from public.funnel_sessions s where anonymous_session_id=$1::uuid',[old]);
  const sql=fs.readFileSync(path.join(directory,'20261013000000_checkpoint_journey_v3.sql'),'utf8');await db.exec(sql);await db.exec(sql);
  assert.deepEqual(await rows('select to_jsonb(s) as data from public.funnel_sessions s where anonymous_session_id=$1::uuid',[old]),oldRows);
  const event=(code,session,name,step=null,field=null,id=randomUUID())=>value('select public.ingest_checkpoint_journey_event($1,$2::uuid,$3::uuid,$4,$5::smallint,$6,null) as data',[code,session,id,name,step,field]);
  await assert.rejects(event('VMH-01',old,'landing_view'),/Legacy sessions/);
  let submitted=0;const sessions=[];
  for(let n=1;n<=25;n++) {
   const code=`VMH-${String(n).padStart(2,'0')}`,session=randomUUID(),id=randomUUID(),request=randomUUID(),ref=`VC-${String(n).padStart(24,'0')}`;sessions.push(session);
   await event(code,session,'landing_view',null,null,id);await event(code,session,'landing_view',null,null,id);
   await event(code,session,'checkin_started');
   const count=n%2?3:4;
   for(let step=1;step<=count;step++){await event(code,session,'question_reached',step);await event(code,session,'question_completed',step);}
   for(const name of ['checkin_completed','result_viewed','consultation_cta_clicked','consultation_started','request_attempted']) await event(code,session,name);
   await event(code,session,'contact_field_reached',null,'phone');
   const args=[code,session,request,ref,'a'.repeat(64),'QA','(613) 555-0123','ryann-simpson','English','individual'];
   const save=()=>value('select public.save_checkpoint_call_request($1,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10) as data',args);
   const first=await save(),retry=await save();assert.equal(first.created,true);assert.equal(retry.created,false);assert.equal(first.leadId,retry.leadId);submitted++;
   const claim=(lead)=>value('select public.claim_consultation_notification($1::uuid,$2) as data',[lead,ref]);
   const claimed=await claim(first.leadId);assert.equal(claimed.claimed,true);assert.equal((await claim(first.leadId)).claimed,false);
   await value("select public.complete_consultation_notification_claim($1::uuid,$2,$3::uuid,'failed') as data",[first.leadId,ref,claimed.claimToken]);
   const retryClaim=await claim(first.leadId);assert.equal(retryClaim.claimed,true);
   await value("select public.complete_consultation_notification_claim($1::uuid,$2,$3::uuid,'sent') as data",[first.leadId,ref,retryClaim.claimToken]);assert.equal((await claim(first.leadId)).alreadySent,true);
   args[4]='b'.repeat(64);await assert.rejects(save(),/already in use/);
  }
  await assert.rejects(event('VMH-25',sessions[24],'request_saved'),/Invalid checkpoint journey event/);
  await assert.rejects(event('VMH-25',sessions[24],'contact_field_reached',null,'6135550123'),/Invalid checkpoint journey event/);
  const report=await value("select public.get_checkpoint_journey_report(now()-interval '1 day',now()+interval '1 minute') as data");
  assert.equal(report.sessions,25);assert.equal(report.completed,25);assert.equal(report.threeQuestionResults,13);assert.equal(report.fourQuestionResults,12);assert.equal(report.legacySessions,1);
  assert.equal(report.questions[3].reached,12);assert.equal(report.questions[3].exits,0);assert.equal(report.actions.saved,25);assert.equal(report.actions.booked,0);
  assert.equal((await rows('select count(*)::int as count from public.consultation_requests where email is null'))[0].count,25);
  assert.equal((await rows("select count(*)::int as count from public.consultation_leads where conversion_stage='consultation_requested'"))[0].count,25);
  for(const signature of ['public.ingest_checkpoint_journey_event(text,uuid,uuid,text,smallint,text,text)','public.save_checkpoint_call_request(text,uuid,uuid,text,text,text,text,text,text,text)','public.get_checkpoint_journey_report(timestamptz,timestamptz,text)']) assert.equal((await rows("select has_function_privilege('anon',$1,'EXECUTE') as allowed",[signature]))[0].allowed,false);
  assert.equal((await rows("select has_table_privilege('service_role','public.checkpoint_journey_events','SELECT') as allowed"))[0].allowed,false);
  console.log(`PASS: migration reruns, all ${submitted} VMHs, 3/4-question cohorts, legacy preservation, phone-only saved requests, no false bookings, retry and notification leases, strict events, RPC permissions.`);
 }finally{await db.close();}
})().catch(error=>{console.error(String(error.message).slice(0,700));process.exitCode=1;});
