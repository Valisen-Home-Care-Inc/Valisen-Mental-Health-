"use client";
import { Download,LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { CheckpointDatePreset } from "@/lib/checkpoints/dashboardMetrics";
export default function CheckpointExportButton({range,customFrom,customTo,loading}:{range:CheckpointDatePreset;customFrom:string;customTo:string;loading:boolean}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function download(){
    if(busy)return;setBusy(true);setMessage("");
    try{
      const params=new URLSearchParams({range});if(range==="custom"){params.set("from",customFrom);params.set("to",customTo);}
      const response=await fetch(`/api/admin/checkpoints/export?${params}`,{credentials:"same-origin",cache:"no-store"});
      if(!response.ok){const error=await response.json().catch(()=>null);throw new Error(error?.error||"The export could not be created.");}
      const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download=response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]||"valisen-checkpoints-all-data.csv";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage(`Downloaded one CSV with ${response.headers.get("x-export-checkpoints")||"all"} checkpoints and their detailed reports.`);
    }catch(error){setMessage(error instanceof Error?error.message:"The export could not be created.");}finally{setBusy(false);}
  }
  return <div><button type="button" onClick={()=>void download()} disabled={busy||loading||(range==="custom"&&(!customFrom||!customTo))} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-[#1e5f5a] px-4 text-[12px] font-semibold text-white shadow-sm hover:bg-[#174c48] disabled:opacity-50">{busy?<LoaderCircle size={17} className="animate-spin"/>:<Download size={17}/>}{busy?"Preparing complete CSV…":"Export all checkpoint data (CSV)"}</button>{message?<p role="status" className="mt-2 max-w-sm text-[11px] text-[#53625f]">{message}</p>:null}</div>;
}
