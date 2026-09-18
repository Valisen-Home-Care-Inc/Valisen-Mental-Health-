import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]));
const db=new PGlite();
try {
 await db.exec("create role anon; create role authenticated; create role service_role; create schema extensions; create function extensions.gen_random_uuid() returns uuid language sql as 'select gen_random_uuid()';");
 const base=await fs.readFile('supabase/migrations/20260823000000_google_ads_journey.sql','utf8');
 await db.exec(base.slice(base.indexOf('create or replace function public.is_google_ads_tracked_path'),base.indexOf('create table public.google_ads_consultations')));
 await db.exec(base.slice(base.indexOf('create or replace function public.ingest_google_ads_events'),base.indexOf('create or replace function public.link_google_ads_consultation')));
 const field=await fs.readFile('supabase/migrations/20260904000000_google_ads_form_field_entry.sql','utf8');
 await db.exec(field.slice(field.indexOf('create or replace function'),field.indexOf('-- Add a durable ordered summary')));
 const migration=await fs.readFile('supabase/migrations/20260917000000_focused_google_ads_landings.sql','utf8');
 await db.exec(migration); await db.exec(migration);
 const slugs=['anxiety','depression','cbt','couples','ocd','panic','social-anxiety','online-therapy','psychotherapists','free-consultation','mandarin','arabic','adhd','perfectionism','trauma'];
 let i=0;
 for (const slug of slugs) {
  const id=String(++i).padStart(20,'0'), path='/welcome/'+slug, now=new Date().toISOString();
  const events=['page_viewed','form_started','consultation_step_viewed','form_field_entered','consultation_submitted'].map((event,n)=>({eventId:`gae-${id}-${n}`,sequence:n+1,occurredAt:now,event,path,elapsedMs:100,deviceCategory:'desktop',googleClickIdPresent:true,...(['form_started','consultation_step_viewed','consultation_submitted'].includes(event)?{formStep:2}:{}),...(event==='form_field_entered'?{targetType:'form_field',targetId:'email'}:{}),...(event==='consultation_submitted'?{submissionReference:'VC-000000000000000000000001'}:{})}));
  const values=['gas-'+id,now,path,JSON.stringify(events)];
  await db.query('select public.ingest_google_ads_events($1,$2::timestamptz,$3,$4::jsonb)',values);
  await db.query('select public.ingest_google_ads_events($1,$2::timestamptz,$3,$4::jsonb)',values);
 }
 assert.equal((await db.query('select count(*)::int as count from public.google_ads_events')).rows[0].count,75);
 assert.equal((await db.query("select public.is_google_ads_tracked_path('/welcome/unapproved') as allowed")).rows[0].allowed,false);
 console.log('PASS PostgreSQL: all 15 final URLs accept form events, retries deduplicate, unknown paths stay rejected, migration reruns safely.');
} finally { await db.close(); }
