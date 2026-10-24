import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Everyone deserves someone to talk to. Help fund a therapy session with Valisen Mental Health.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function DonateOpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/valisen-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#F8F6F1",
          color: "#071F48",
          fontFamily: "sans-serif",
        }}
      >
        <img src={logoSrc} width={274} height={95} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.06, letterSpacing: -1 }}>
            Everyone deserves
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.06, letterSpacing: -1 }}>
            someone to talk to.
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.04, letterSpacing: -1, color: "#208A98" }}>
            Not everyone can afford it.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 28, color: "#4B587A" }}>Help fund subsidized therapy</div>
          <div
            style={{
              display: "flex",
              padding: "16px 30px",
              borderRadius: 999,
              background: "#071F48",
              color: "#FFFFFF",
              fontSize: 26,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            valisenmentalhealth.com/donate
          </div>
        </div>
      </div>
    ),
    size,
  );
}
