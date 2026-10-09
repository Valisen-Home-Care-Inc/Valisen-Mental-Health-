import { describe,expect,it } from "vitest";
import { buildGoogleAdsConsultationAnalysis } from "@/lib/googleAdsConsultationAnalysis";
import { normalizeGoogleAdsJourneyExportRows, normalizeGoogleAdsEventExportRows } from "@/lib/googleAdsExport";
const id="gas-11111111-1111-4111-8111-111111111111";
const date="2026-10-09T15:00:00.000Z";
const row=(extra={})=>({sessionId:id,startedAt:date,lastSeenAt:date,landingPath:"/welcome/arabic",lastPath:"/welcome/arabic",eventCount:3,formStarted:true,consultationCtaClicked:true,...extra});
const event=(extra={})=>({sessionId:id,sessionStartedAt:date,occurredAt:date,event:"control_clicked",eventId:"gae-11111111-1111-4111-8111-111111111111",sequence:1,path:"/welcome/arabic",targetType:"button",targetId:"contact-submit",elapsedMs:100,...extra});
describe("consultation engagement analysis",()=>{
 it("distinguishes a captured contact from an accepted calendar booking",()=>{
  const journeys=normalizeGoogleAdsJourneyExportRows([row({consultationSubmitted:true,consultationReferenceId:"VC-111111111111111111111111"})]);
  const timeline=normalizeGoogleAdsEventExportRows([event(),event({eventId:"gae-22222222-2222-4222-8222-222222222222",event:"consultation_submitted",sequence:2,targetType:undefined,targetId:undefined,formStep:1}),event({eventId:"gae-33333333-3333-4333-8333-333333333333",sequence:3,targetId:"calendar-open"})]);
  const result=buildGoogleAdsConsultationAnalysis(journeys,timeline,"/welcome/arabic");
  expect(result.totals).toMatchObject({contactSaved:1,calendarOpened:1,booked:0});
  expect(result.sessions[0]).toMatchObject({lastStep:"Choose a time now",outcome:"Details received — no confirmed time"});
  expect(buildGoogleAdsConsultationAnalysis(normalizeGoogleAdsJourneyExportRows([row({booked:true,consultationSubmitted:true})]),timeline,"/welcome/arabic").totals.booked).toBe(1);
 });
 it("uses the full range beyond the recent-session limit and filters each landing URL",()=>{
  const rows=Array.from({length:75},(_,index)=>row({sessionId:`gas-${String(index).padStart(20,"0")}`})); rows.push(row({landingPath:"/welcome/ocd"}));
  const result=buildGoogleAdsConsultationAnalysis(normalizeGoogleAdsJourneyExportRows(rows),[],"/welcome/arabic","started");
  expect(result.sessions).toHaveLength(75); expect(result.totals.engaged).toBe(75);
 });
 it("does not invent detailed actions for historical CTA-only sessions",()=>{
  const result=buildGoogleAdsConsultationAnalysis(normalizeGoogleAdsJourneyExportRows([row({formStarted:false})]),[],"/welcome/arabic","cta");
  expect(result.sessions[0]).toMatchObject({lastStep:"No detailed booking event recorded",outcome:"CTA clicked — form not started"});
 });
});
