import { buildReferralGuide } from "@/lib/server/referralGuide";

export const runtime = "nodejs";
export async function GET() {
  const pdf = await buildReferralGuide();
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="valisen-healthcare-referral-guide.pdf"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
