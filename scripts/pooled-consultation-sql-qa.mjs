import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.argv[2] || 'artifacts/pooled-calendar-test/node_modules/@electric-sql/pglite/dist/index.js'));
const db = new PGlite();
const all = ['ryann-simpson','wilfred-bengnwi','meryem-ibrahim','tim-kahtava','dayong-quan'];
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema extensions; create function extensions.gen_random_uuid() returns uuid language sql as 'select gen_random_uuid()';
    create table public.consultation_leads(id uuid, consultation_reference_id text, conversion_stage text, booked_at timestamptz, last_activity_at timestamptz, row_version integer, updated_at timestamptz, workflow_status text);
    create table public.consultation_lead_history(lead_id uuid,event_type text,from_workflow_status text,to_workflow_status text,from_conversion_stage text,to_conversion_stage text,note text,actor_kind text,actor_reference text,recorded_at timestamptz);`);
  await db.exec(await fs.readFile('supabase/migrations/20260909000000_consultation_slot_bookings.sql','utf8'));
  await db.exec(await fs.readFile('supabase/migrations/20260915000000_pooled_consultation_availability.sql','utf8'));
  await db.exec(await fs.readFile('supabase/migrations/20260915000000_pooled_consultation_availability.sql','utf8'));
  let count=0;
  async function nextDate(dow) {
    const result=await db.query(`select d::date::text as date from generate_series(((now() at time zone 'America/Toronto')::date+1)::timestamp,((now() at time zone 'America/Toronto')::date+14)::timestamp,interval '1 day') d where extract(dow from d)=$1 limit 1`,[dow]);
    return result.rows[0].date;
  }
  async function claim(date,time,pool=all,id=++count) {
    const values=[date,time,`qa-calendar-submission-${id}`,`VC-${String(id).padStart(24,'0')}`,'welcome',pool];
    const result=await db.query('select public.claim_consultation_slot_v2($1::date,$2,$3,$4,$5,$6::text[]) as result',values);
    return result.rows[0].result;
  }
  async function blocked(date,pool=all) {
    return (await db.query('select public.get_booked_consultation_slots_v2($1::date,$1::date,$2::text[]) as result',[date,pool])).rows[0].result.map(s=>s.time);
  }
  const monday=await nextDate(1);
  const adhd=['ryann-simpson']; const anxiety=['ryann-simpson','meryem-ibrahim']; const couples=['wilfred-bengnwi','ryann-simpson'];
  assert.equal((await claim(monday,'6:00 PM',adhd,100)).capacityTherapistId,'ryann-simpson');
  const retry=await claim(monday,'6:00 PM',adhd,100);
  assert.equal(retry.replayed,true);
  assert.equal(retry.capacityTherapistId,'ryann-simpson');
  assert.equal((await claim(monday,'6:20 PM',adhd,100)).reason,'identifier_in_use');
  assert.equal((await claim(monday,'6:00 PM',all,100)).reason,'identifier_in_use');
  for (const pool of [adhd,anxiety]) assert.ok((await blocked(monday,pool)).includes('6:00 PM'));
  for (const pool of [couples,all]) assert.ok(!(await blocked(monday,pool)).includes('6:00 PM'));
  assert.equal((await claim(monday,'6:00 PM',couples)).capacityTherapistId,'wilfred-bengnwi');
  assert.ok((await blocked(monday)).includes('6:00 PM'));
  assert.equal((await claim(monday,'6:00 PM',all)).accepted,false);
  assert.equal((await claim(monday,'6:30 PM',['tim-kahtava'])).accepted,true);
  // A 6:20 call overlaps Tim's 6:30 call even though the labels differ.
  assert.equal((await claim(monday,'6:20 PM',adhd)).accepted,true);
  assert.equal((await claim(monday,'6:20 PM',['wilfred-bengnwi'])).accepted,true);
  assert.ok((await blocked(monday)).includes('6:30 PM'));
  assert.equal((await claim(monday,'6:50 PM',['tim-kahtava'])).accepted,true);
  assert.equal((await claim(monday,'7:20 PM',['tim-kahtava'])).accepted,false);
  const saturday=await nextDate(6); const sunday=await nextDate(0);
  assert.equal((await claim(saturday,'1:15 PM',['tim-kahtava'])).accepted,true);
  assert.equal((await claim(saturday,'1:35 PM',['tim-kahtava'])).accepted,true);
  assert.equal((await claim(saturday,'1:55 PM',['tim-kahtava'])).accepted,true);
  assert.equal((await claim(saturday,'2:15 PM',['tim-kahtava'])).accepted,false);
  assert.equal((await claim(sunday,'9:00 AM',['meryem-ibrahim'])).accepted,true);
  assert.equal((await claim(sunday,'9:00 AM',['dayong-quan'])).accepted,false);
  const friday=await nextDate(5);
  await db.query(`insert into public.consultation_slot_bookings(slot_date,slot_time,client_submission_id,consultation_reference_id,source) values($1::date,'9:00 AM','legacy-submission-0001','VC-FFFFFFFFFFFFFFFFFFFFFFFF','welcome')`,[friday]);
  assert.ok((await blocked(friday,['dayong-quan'])).includes('9:00 AM'));
  assert.equal((await claim(friday,'9:00 AM')).accepted,false);
  assert.equal((await claim(friday,'9:20 AM',['dayong-quan'])).accepted,true);
  assert.equal((await claim(friday,'9:20 AM',['wilfred-bengnwi'])).accepted,true);
  assert.equal((await db.query("select has_function_privilege('anon','public.claim_consultation_slot_v2(date,text,text,text,text,text[])','EXECUTE') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_table_privilege('service_role','public.consultation_slot_bookings','SELECT') as allowed")).rows[0].allowed,false);
  console.log('PASS: actual PostgreSQL migration, shared capacity, overlaps, replay protection, weekly/weekend/quarter-hour shifts, legacy holds, and permissions.');
} finally { await db.close(); }
