import { buildCsv } from "@/lib/googleAdsExport";
import { isCheckpointCode } from "@/lib/checkpoints/config";
import type { CheckpointDashboardData, CheckpointDetailData } from "@/lib/checkpoints/dashboardMetrics";

type Cell = string | number | boolean | null;
type Row = Record<string,Cell>;
const META = ["Scope","Checkpoint","Record type","Record key","Range from (UTC)","Range to (UTC)","Reporting period starts (UTC)","Generated (UTC)"];

/** One rectangular CSV. Record types distinguish totals from detail rows. */
export function buildCheckpointFullCsv(dashboard:CheckpointDashboardData, details:CheckpointDetailData[], activeSince:string) {
  const rows:Row[]=[];
  const fields=new Set<string>();
  const visit=(value:unknown,type:string,scope:string,code:string,key:string,generated:string)=>{
    if(Array.isArray(value)) {
      if(!value.length) { fields.add("empty"); rows.push({Scope:scope,Checkpoint:code,"Record type":type,"Record key":key,"Range from (UTC)":dashboard.range.from,"Range to (UTC)":dashboard.range.to,"Reporting period starts (UTC)":activeSince,"Generated (UTC)":generated,empty:true}); }
      value.forEach((item,index)=>visit(item,type,scope,code,String(index+1),generated));return;
    }
    if(!value || typeof value!=="object") return;
    const object=value as Record<string,unknown>;
    const checkpoint=isCheckpointCode(object.code)?object.code:isCheckpointCode(object.checkpointCode)?object.checkpointCode:code;
    const recordKey=String(object.id ?? object.referenceId ?? object.date ?? object.event ?? object.key ?? object.intent ?? object.stepNumber ?? object.day ?? object.code ?? key);
    const row:Row={Scope:scope,Checkpoint:checkpoint,"Record type":type,"Record key":recordKey,"Range from (UTC)":type.endsWith(".cumulativeKpis")?activeSince:dashboard.range.from,"Range to (UTC)":type.endsWith(".cumulativeKpis")?generated:dashboard.range.to,"Reporting period starts (UTC)":activeSince,"Generated (UTC)":generated};
    let scalar=false;
    for(const [field,entry] of Object.entries(object)) {
      if(entry===null || ["string","number","boolean"].includes(typeof entry)) { const column=`Data: ${field}`;fields.add(column);row[column]=entry as Cell;scalar=true; }
    }
    if(scalar)rows.push(row);
    for(const [field,entry] of Object.entries(object)) if(entry!==null && typeof entry==="object") visit(entry,type?`${type}.${field}`:field,scope,checkpoint,recordKey,generated);
  };
  visit(dashboard,"dashboard","overall","","",dashboard.generatedAt);
  for(const detail of details)visit(detail,"checkpoint","checkpoint detail",detail.checkpoint.code,detail.checkpoint.code,detail.generatedAt);
  const headers=[...META,...[...fields].sort()];
  return { csv:buildCsv(headers,rows.map(row=>headers.map(header=>row[header]))),rowCount:rows.length,checkpointCount:details.length };
}

export function checkpointExportFilename(from:string,to:string) { return `valisen-checkpoints-all-data-${from.slice(0,10)}-to-${to.slice(0,10)}.csv`; }
