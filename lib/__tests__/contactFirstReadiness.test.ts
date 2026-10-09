import { NextRequest } from "next/server";
import { beforeEach,describe,expect,it,vi } from "vitest";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/server/supabaseServer",async(original)=>({...await original<typeof import("@/lib/server/supabaseServer")>(),callSupabaseRpc:rpc}));
beforeEach(()=>{vi.resetModules();rpc.mockReset();});
describe("contact-first deployment compatibility",()=>{
 it("requires the installed database capability and caches the read",async()=>{
  rpc.mockResolvedValue(true);const {contactFirstBookingReady}=await import("@/lib/server/contactFirstReadiness");
  expect(await contactFirstBookingReady()).toBe(true);expect(await contactFirstBookingReady()).toBe(true);expect(rpc).toHaveBeenCalledTimes(1);
 });
 it("keeps the previous flow on missing or unavailable migration",async()=>{
  rpc.mockRejectedValue(new Error("Missing RPC"));const {contactFirstBookingReady}=await import("@/lib/server/contactFirstReadiness");expect(await contactFirstBookingReady()).toBe(false);
 });
 it("downgrades new control identifiers for old-schema event ingestion without losing the CTA",async()=>{
  rpc.mockImplementation(async(name)=>name==="is_google_ads_booking_control"?false:{accepted:true});const {persistGoogleAdsEventBatch}=await import("@/lib/server/googleAdsRepository");
  const shared={eventId:"gae-11111111-1111-4111-8111-111111111111",sequence:1,occurredAt:new Date().toISOString(),path:"/welcome/arabic",elapsedMs:100,deviceCategory:"desktop" as const,googleClickIdPresent:true};
  await persistGoogleAdsEventBatch({sessionId:"gas-11111111-1111-4111-8111-111111111111",sessionStartedAt:shared.occurredAt,landingPath:shared.path,events:[{...shared,event:"consultation_cta_clicked",targetId:"hero-cta",targetType:"consultation",targetPath:shared.path},{...shared,sequence:2,event:"control_clicked",targetId:"calendar-date",targetType:"button"}]});
  expect(rpc).toHaveBeenCalledWith("ingest_google_ads_events",expect.objectContaining({p_events:[expect.objectContaining({targetId:undefined,targetPath:"/consultation"}),expect.objectContaining({targetId:"button"})]}));
 });
});
