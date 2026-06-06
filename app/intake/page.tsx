import { redirect } from "next/navigation";
import { JANE_BOOKING_URL } from "@/lib/intake";

export default function IntakePage() {
  redirect(JANE_BOOKING_URL);
}
