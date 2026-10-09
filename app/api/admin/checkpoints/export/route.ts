import { NextRequest,NextResponse } from "next/server";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";
import { resolveCheckpointDateRange } from "@/lib/checkpoints/dashboardMetrics";
import { isCheckpointCode } from "@/lib/checkpoints/config";
import { fetchCheckpointDashboard,fetchCheckpointDetail } from "@/lib/server/checkpointRepository";
import { resolveCrmReportingRange } from "@/lib/server/crmReportingRepository";
import { buildCheckpointFullCsv,checkpointExportFilename } from "@/lib/checkpoints/export";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const unauthorized=requireCheckpointAdminApi(request);if(unauthorized)return unauthorized;
  const params=request.nextUrl.searchParams;
  const range=resolveCheckpointDateRange(params.get("range"),params.get("from"),params.get("to"));
  if(!range)return NextResponse.json({error:"Invalid export date range."},{status:400,headers:{"Cache-Control":"no-store"}});
  try {
    const reporting=await resolveCrmReportingRange("checkpoints",range);
    const {from,to}=reporting.range;
    const dashboard=await fetchCheckpointDashboard(from,to);
    // Include every installed checkpoint, even those with no visits. Never
    // turn a failed detail query into a successful but incomplete download.
    const codes=[...new Set(dashboard.checkpoints.map(row=>row.code))].sort();
    if(codes.some(code=>!isCheckpointCode(code)))throw new Error("Unknown checkpoint in report");
    const details=[];
    for(let index=0;index<codes.length;index+=4) details.push(...await Promise.all(codes.slice(index,index+4).map(code=>fetchCheckpointDetail(code,from,to,reporting.state.activeSince))));
    const result=buildCheckpointFullCsv(dashboard,details,reporting.state.activeSince);
    return new NextResponse("\uFEFF"+result.csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${checkpointExportFilename(from,to)}"`,"Cache-Control":"private, no-store","X-Export-Rows":String(result.rowCount),"X-Export-Checkpoints":String(result.checkpointCount),"X-Content-Type-Options":"nosniff"}});
  }catch{return NextResponse.json({error:"The complete checkpoint export could not be created. Please try again."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
