import { NextRequest, NextResponse } from "next/server";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { googleAdsLandingFilter } from "@/lib/googleAdsLandingReport";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";
import { fetchGoogleAdsReportRows } from "@/lib/server/googleAdsRepository";
import { buildGoogleAdsConsultationAnalysis, type ConsultationAnalysisFilter } from "@/lib/googleAdsConsultationAnalysis";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const unauthorized = requireCheckpointAdminApi(request); if (unauthorized) return unauthorized;
  const params = request.nextUrl.searchParams;
  const scope = params.get("scope") || "live";
  const filter = params.get("filter") || "all";
  const landingPath = googleAdsLandingFilter(params.get("landingPath"));
  const range = resolveCheckpointDateRange(params.get("range"),params.get("from"),params.get("to"));
  if (!range || !landingPath || !["live","test"].includes(scope) || !["all","cta","started"].includes(filter)) return NextResponse.json({ error: "Invalid analysis range or filter." }, { status:400 });
  try {
    const effective = scope === "test" ? range : (await resolveCrmReportingRange("google_ads", range)).range;
    const rows = await fetchGoogleAdsReportRows(effective.from,effective.to,scope === "test");
    return NextResponse.json({ data: buildGoogleAdsConsultationAnalysis(rows.journeys,rows.events,landingPath,filter as ConsultationAnalysisFilter) }, { headers:{ "Cache-Control":"private, no-store" } });
  } catch { return NextResponse.json({ error:"Consultation analysis is temporarily unavailable." },{ status:503, headers:{"Cache-Control":"no-store"} }); }
}
