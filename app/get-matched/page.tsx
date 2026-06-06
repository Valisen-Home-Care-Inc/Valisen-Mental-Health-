import { redirect } from "next/navigation";
import { JANE_BOOKING_URL } from "@/lib/intake";

export default function GetMatchedPage() {
  redirect(JANE_BOOKING_URL);
}
