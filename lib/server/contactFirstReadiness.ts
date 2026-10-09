import { callSupabaseRpc } from "@/lib/server/supabaseServer";
let ready=false,expires=0;
let pending:Promise<boolean>|null=null;
/** The readiness function is installed in the same transaction as the writer.
 * Existing calendars remain usable until the migration commits. */
export async function contactFirstBookingReady():Promise<boolean> {
  if(Date.now()<expires)return ready;
  if(pending)return pending;
  pending=callSupabaseRpc<boolean>("is_google_ads_booking_control",{p_id:"calendar-confirm"},3000)
    .then(value=>{ready=value===true;return ready;}).catch(()=>{ready=false;return false;})
    .finally(()=>{expires=Date.now()+(ready?60000:15000);pending=null;});
  return pending;
}
