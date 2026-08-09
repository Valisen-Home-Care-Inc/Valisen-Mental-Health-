import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import {
  checkpointPermanentUrl,
  isCheckpointCode,
} from "@/lib/checkpoints/config";
import { requireCheckpointAdminApi } from "@/lib/server/checkpointAdminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { code } = await params;
  const unauthorized = requireCheckpointAdminApi(request);
  if (unauthorized) return unauthorized;
  if (!isCheckpointCode(code)) {
    return NextResponse.json(
      { error: "Unknown checkpoint." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Physical tags must always encode the canonical production URL. Preview
  // and admin origins are deliberately ignored so a staging deploy can never
  // generate a QR that would later need reprinting.
  const url = checkpointPermanentUrl(code);

  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 4,
    width: 1024,
    color: { dark: "#153F3EFF", light: "#FFFFFFFF" },
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${code}-mental-battery-qr.svg"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
