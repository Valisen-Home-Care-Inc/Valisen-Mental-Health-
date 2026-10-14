import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), claim: vi.fn(), complete: vi.fn(), mail: vi.fn(), verify: vi.fn() }));
vi.mock("@/lib/server/supabaseServer", () => ({ callSupabaseRpc: mocks.rpc }));
vi.mock("@/lib/server/growthRepository", () => ({ claimConsultationNotification: mocks.claim, completeConsultationNotificationClaim: mocks.complete }));
vi.mock("@/lib/server/turnstile", () => ({ verifyTurnstile: mocks.verify }));
vi.mock("@/lib/server/rateLimit", () => ({ isRateLimited: () => false }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: mocks.mail }) } }));
import { POST } from "@/app/api/checkpoint-journey/request/route";
import { checkpointClinicians } from "@/lib/checkpoints/journey/clinicians";
import { callRequestPayload, buildJourneyReflection, EMPTY_JOURNEY, questionFor, questionCount, updateJourney } from "@/lib/checkpoints/journey/conversionModel";
import { parseJourneyEvent, type JourneyReport } from "@/lib/checkpoints/journey/contract";
import { parseCheckpointCallRequest } from "@/lib/checkpoints/journey/requestContract";
import { withLegacyJourneyMetrics } from "@/lib/checkpoints/journey/report";

const sessionId=randomUUID(),clientSubmissionId=randomUUID();
function payload() {
  return { ...callRequestPayload({ firstName:"Alex",phone:"(613) 555-0123",message:"",consent:true },"VMH-25",checkpointClinicians().find(p=>p.slug==="meryem-ibrahim"),"Arabic","couples"),sessionId,clientSubmissionId,formStartedAt:Date.now()-5_000,turnstileToken:"test-token" };
}
function request(value: unknown, origin="https://valisenmentalhealth.com") { return new NextRequest("https://valisenmentalhealth.com/api/checkpoint-journey/request", { method:"POST",headers:{ "Content-Type":"application/json",Origin:origin },body:JSON.stringify(value) }); }
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv("GMAIL_USER","clinic@example.invalid");vi.stubEnv("GMAIL_APP_PASSWORD","test-only");vi.stubEnv("MERYEM_IBRAHIM_EMAIL","");
 mocks.rpc.mockImplementation(async(_name,body)=>({ accepted:true,created:true,leadId:"test-lead-id",referenceId:body.p_reference_id }));
 mocks.claim.mockResolvedValue({ accepted:true,claimed:true,alreadySent:false,claimToken:randomUUID() });mocks.complete.mockResolvedValue({ accepted:true });mocks.mail.mockResolvedValue({});mocks.verify.mockResolvedValue({ ok:true });
});
describe("Production checkpoint journey",()=>{
 it("keeps all 424 adaptive results valid without adding an intent gate",()=>{
  let total=0;
  for(const energy of questionFor(0,EMPTY_JOURNEY).choices) for(const topic of questionFor(1,EMPTY_JOURNEY).choices) {
   const a=updateJourney(updateJourney(EMPTY_JOURNEY,0,energy.value),1,topic.value);
   for(const detail of questionFor(2,a).choices) {
    const b=updateJourney(a,2,detail.value);
    for(const done of questionCount(b)===3?[b]:questionFor(3,b).choices.map(impact=>updateJourney(b,3,impact.value))) {expect(buildJourneyReflection(done)).not.toBeNull();total++;}
   }
  } expect(total).toBe(424);
 });
 it("supports all VMHs, mandatory phone, consent, server-verified therapist/service/language",()=>{
  for(let i=1;i<=25;i++) expect(parseCheckpointCallRequest({...payload(),checkpointCode:`VMH-${String(i).padStart(2,"0")}`} ).value).toBeTruthy();
  for(const change of [{contact:""},{contact:"613"},{consent:false},{checkpointCode:"VMH-26"},{preferredTherapist:"tim-kahtava"},{preferredTherapist:"dayong-quan",consultationLanguage:"Mandarin"},{email:"email-only@example.invalid"},{answers:{energy:"low"}},{consentVersion:"old"}]) expect(parseCheckpointCallRequest({...payload(),...change}).value).toBeUndefined();
 });
 it("accepts structural new-question events and blocks answers and forged saved requests",()=>{
  const event={eventId:randomUUID(),sessionId,checkpointCode:"VMH-25",version:"mental-battery-v3",event:"question_reached",stepNumber:3};
  expect(parseJourneyEvent(event)).toEqual(event);
  for(const change of [{answers:{topic:"worry"}},{event:"request_saved",stepNumber:undefined},{stepNumber:5},{field:"6135550123"},{version:"old"},{questionTitle:"Anxiety"}]) expect(parseJourneyEvent({...event,...change})).toBeNull();
 });
 it("saves first, sends the clinic a clear unscheduled request, then marks delivery",async()=>{
  const response=await POST(request(payload()));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true,requestSaved:true,appointmentBooked:false});
  expect(mocks.rpc).toHaveBeenCalledWith("save_checkpoint_call_request",expect.objectContaining({p_phone:"(613) 555-0123",p_therapist:"meryem-ibrahim",p_language:"Arabic",p_service:"couples"}));
  expect(mocks.mail).toHaveBeenCalledOnce();expect(mocks.mail.mock.calls[0][0]).toMatchObject({to:"info@valisenmentalhealth.com",subject:"Free Call Request - Alex - VMH-25"});
  expect(mocks.mail.mock.calls[0][0].text).toContain("Meryem Ibrahim");expect(mocks.mail.mock.calls[0][0].text).toContain("within 24 hours");expect(mocks.mail.mock.calls[0][0].text).toContain("No appointment or calendar capacity");
  expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.mail.mock.invocationCallOrder[0]);expect(mocks.complete).toHaveBeenLastCalledWith("test-lead-id",expect.any(String),expect.any(String),"sent");
 });
 it("never emails an unsaved request or accepts cross-origin submissions",async()=>{
  expect((await POST(request(payload(),"https://elsewhere.invalid"))).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockRejectedValueOnce(new Error("database down"));expect((await POST(request(payload()))).status).toBe(503);expect(mocks.mail).not.toHaveBeenCalled();
 });
 it("rejects missing phone and consent before verification, persistence or mail",async()=>{
  expect((await POST(request({...payload(),contact:""}))).status).toBe(400);expect((await POST(request({...payload(),consent:false}))).status).toBe(400);
  expect(mocks.verify).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.mail).not.toHaveBeenCalled();
 });
 it("retries failed notification with the same request ID and hash; delivered retries send no email",async()=>{
  mocks.mail.mockRejectedValueOnce(new Error("SMTP down"));const value=payload();expect((await POST(request(value))).status).toBe(503);
  expect(mocks.complete).toHaveBeenLastCalledWith("test-lead-id",expect.any(String),expect.any(String),"failed");
  expect((await POST(request({...value,turnstileToken:"fresh-token"}))).status).toBe(200);
  expect(mocks.rpc.mock.calls[0][1]).toEqual(mocks.rpc.mock.calls[1][1]);
  mocks.claim.mockResolvedValueOnce({accepted:true,alreadySent:true,claimed:false});expect((await POST(request(value))).status).toBe(200);expect(mocks.mail).toHaveBeenCalledTimes(2);
 });
 it("returns a saved request while another invocation holds the notification lease",async()=>{
  mocks.claim.mockResolvedValue({accepted:true,claimed:false,alreadySent:false,reason:"lease_active"});
  const response=await POST(request(payload()));expect(response.status).toBe(202);expect(await response.json()).toMatchObject({requestSaved:true,pending:true,appointmentBooked:false});expect(mocks.mail).not.toHaveBeenCalled();
 });
 it("separates legacy question totals when using the installed launch report",()=>{
  const report={version:"mental-battery-v3",started:2,completed:2,questions:[{stepNumber:1,completed:2},{stepNumber:2,completed:2},{stepNumber:3,completed:2},{stepNumber:4,completed:1}]} as JourneyReport;
  const steps=([1,2,3,4] as const).map(stepNumber=>({stepNumber,reached:3,completed:stepNumber===4?2:3,dropOffs:0,completionRate:100,dropOffRate:0}));
  const legacy=withLegacyJourneyMetrics(report,3,steps);expect(legacy.legacyCompleted).toBe(1);expect(legacy.legacyQuestionSteps.every(step=>step.reached===1&&step.completed===1&&step.dropOffs===0)).toBe(true);
 });
});
