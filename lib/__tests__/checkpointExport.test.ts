import { NextRequest,NextResponse } from "next/server";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { CHECKPOINT_CODES } from "@/lib/checkpoints/config";
import { buildCheckpointFullCsv } from "@/lib/checkpoints/export";
import type { CheckpointDashboardData,CheckpointDetailData } from "@/lib/checkpoints/dashboardMetrics";
const mocks=vi.hoisted(()=>({auth:vi.fn(),dashboard:vi.fn(),detail:vi.fn(),range:vi.fn()}));
vi.mock("@/lib/server/checkpointAdminAuth",()=>({requireCheckpointAdminApi:mocks.auth}));
vi.mock("@/lib/server/checkpointRepository",()=>({fetchCheckpointDashboard:mocks.dashboard,fetchCheckpointDetail:mocks.detail}));
vi.mock("@/lib/server/crmReportingRepository",()=>({resolveCrmReportingRange:mocks.range}));
import { GET } from "@/app/api/admin/checkpoints/export/route";
const date="2026-10-09T15:00:00.000Z",from="2026-10-01T04:00:00.000Z",to="2026-10-10T04:00:00.000Z";
const kpis={sessions:0,checkinsStarted:0,checkinsCompleted:0,completionRate:0,resultViews:0,therapistIntent:0,consultationCtaRate:0,consultationsStarted:0,consultationsSubmitted:0,sessionToConsultationRate:0,externalBookingClicks:0};
function dashboard():CheckpointDashboardData { return {generatedAt:date,range:{from,to},kpis,funnel:[],resultActions:[],intentMix:[],questionSteps:[],leads:[],checkpoints:CHECKPOINT_CODES.map(code=>({...kpis,code,status:"active",createdAt:from,currentPlacement:null,sparkline:[{date:"2026-10-02",sessions:0}]}))}; }
function detail(code:string):CheckpointDetailData {return {generatedAt:date,range:{from,to},checkpoint:{code,status:"active",createdAt:from,currentPlacement:null},kpis,cumulativeKpis:{sessions:12},funnel:[{event:"checkin_started",count:0}],resultActions:[{key:"consultation_cta",count:0,sessionRate:0}],intentMix:[],questionSteps:[{stepNumber:1,reached:0,completed:0,dropOffs:0,completionRate:0,dropOffRate:0}],placements:[{id:"placement-1",partnerName:'=IMPORTDATA("malicious")',locationName:'Arabic clinic, "east"',startedAt:from,sessions:0}],daily:[{date:"2026-10-02",sessions:0,checkinsStarted:0,checkinsCompleted:0,therapistIntent:0,consultationsSubmitted:0}],dayOfWeek:[{day:"Friday",sessions:0,checkinsCompleted:0,therapistIntent:0,consultationsSubmitted:0}],leads:[{referenceId:"VC-EXPORTTEST1",checkpointCode:code,partnerName:"Clinic",locationName:"Ottawa",source:"mental_battery_checkpoint",status:"submitted",submittedAt:date}]};}
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockReturnValue(null);mocks.dashboard.mockResolvedValue(dashboard());mocks.detail.mockImplementation(async(code)=>detail(code));mocks.range.mockResolvedValue({range:{from,to},state:{activeSince:"2026-08-23T00:00:00.000Z"}});});
describe("full checkpoint CSV export",()=>{
 it("includes every report category and zero-traffic checkpoints, safely quoting spreadsheet text",()=>{
  const result=buildCheckpointFullCsv(dashboard(),[detail("VMH-25")],"2026-08-23T00:00:00.000Z");
  for(const type of ["dashboard.kpis","dashboard.checkpoints","dashboard.checkpoints.sparkline","checkpoint.placements","checkpoint.daily","checkpoint.dayOfWeek","checkpoint.funnel","checkpoint.questionSteps","checkpoint.resultActions","checkpoint.leads","checkpoint.cumulativeKpis"])expect(result.csv).toContain(type);
  expect(result.csv).toContain("VMH-25");expect(result.csv).toContain('"\'=IMPORTDATA(""malicious"")"');expect(result.csv).toContain('"Arabic clinic, ""east"""');expect(result.csv).toContain("VC-EXPORTTEST1");
 });
 it("returns one downloadable CSV for all installed checkpoints and the effective reporting range",async()=>{
  const response=await GET(new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints/export?range=all"));
  expect(response.status).toBe(200);expect(response.headers.get("content-type")).toContain("text/csv");expect(response.headers.get("x-export-checkpoints")).toBe("25");
  expect(mocks.detail).toHaveBeenCalledTimes(25);expect(mocks.detail).toHaveBeenCalledWith("VMH-25",from,to,"2026-08-23T00:00:00.000Z");
  const csv=await response.text();expect(csv).toContain("checkpoint.daily");expect(csv).toContain("checkpoint.leads");expect(csv).toContain(from);
 });
 it("requires administrator access and rejects invalid dates before querying",async()=>{
  mocks.auth.mockReturnValueOnce(NextResponse.json({error:"Unauthorized"},{status:401}));expect((await GET(new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints/export"))).status).toBe(401);
  expect((await GET(new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints/export?range=custom&from=invalid&to=invalid"))).status).toBe(400);expect(mocks.dashboard).not.toHaveBeenCalled();
 });
 it("fails the entire export when a checkpoint report fails instead of silently omitting it",async()=>{
  mocks.detail.mockRejectedValueOnce(new Error("Unavailable"));const response=await GET(new NextRequest("https://valisenmentalhealth.com/api/admin/checkpoints/export?range=30d"));expect(response.status).toBe(503);expect(response.headers.get("content-type")).toContain("application/json");
 });
});
