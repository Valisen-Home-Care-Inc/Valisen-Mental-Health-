import { webcrypto } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { createJourneyAdapters } from "@/lib/checkpoints/journey/adapters";
import { callRequestPayload } from "@/lib/checkpoints/journey/conversionModel";
afterEach(()=>vi.unstubAllGlobals());
it("uses the same request ID after a lost response and reload without retaining contact details",async()=>{
  const stored=new Map<string,string>();
  vi.stubGlobal("window",{crypto:webcrypto,sessionStorage:{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)}});
  const bodies:Array<{clientSubmissionId:string;sessionId:string}>=[];
  const fetcher=vi.fn(async(_url:string,options:RequestInit)=>{bodies.push(JSON.parse(String(options.body)));if(bodies.length===1)throw new Error("response lost");return new Response(JSON.stringify({ok:true,referenceId:"VC-AAAAAAAAAAAAAAAAAAAAAAAA"}),{status:200});});
  vi.stubGlobal("fetch",fetcher);
  const payload=callRequestPayload({firstName:"Alex",phone:"(613) 555-0123",message:"",consent:true},"VMH-25",undefined,"English","individual");
  await expect(createJourneyAdapters("VMH-25").submit(payload,"first-token")).rejects.toThrow("response lost");
  const afterReload=createJourneyAdapters("VMH-25");await afterReload.submit(payload,"new-token");await afterReload.submit(payload,"new-token");
  expect(fetcher).toHaveBeenCalledTimes(2);expect(bodies[0].clientSubmissionId).toBe(bodies[1].clientSubmissionId);expect(bodies[0].sessionId).toBe(bodies[1].sessionId);
  const values=JSON.stringify([...stored.values()]);expect(values).not.toContain("Alex");expect(values).not.toContain("(613) 555-0123");expect(values).not.toContain("English");
});
