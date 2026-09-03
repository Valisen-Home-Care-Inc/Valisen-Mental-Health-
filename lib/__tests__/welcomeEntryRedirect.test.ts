import { describe, expect, it } from "vitest";
import WelcomeLandingPage from "@/app/welcome/page";

/** Next's `redirect()` throws an error whose digest carries the destination. */
async function redirectDestination(
  searchParams: Record<string, string>,
): Promise<string | null> {
  try {
    await WelcomeLandingPage({ searchParams: Promise.resolve(searchParams) });
    return null;
  } catch (error) {
    const digest = String((error as { digest?: unknown })?.digest ?? "");
    const match = /^NEXT_REDIRECT;[^;]*;([^;]+);/.exec(digest);
    if (!match) throw error;
    return match[1];
  }
}

describe("/welcome server-side Google Ads entry", () => {
  it("redirects a real ad click into the signer before any HTML is sent", async () => {
    await expect(
      redirectDestination({
        gclid: "Abcdef_123",
        gad_source: "1",
        vmh_campaignid: "18124413697",
        vmh_adgroup: "Therapy-Ontario",
        vmh_keyword: "online therapy ontario",
        email: "private@example.com",
      }),
    ).resolves.toBe(
      "/google-ads/welcome?gclid=Abcdef_123&gad_source=1&vmh_campaignid=18124413697&vmh_adgroup=Therapy-Ontario&vmh_keyword=online+therapy+ontario",
    );
  });

  it("renders the landing page for signed, organic, and Meta visitors", async () => {
    const visitors: Record<string, string>[] = [
      {},
      { utm_source: "google", utm_medium: "cpc" },
      { utm_source: "meta", fbclid: "facebook-click" },
    ];
    for (const searchParams of visitors) {
      await expect(redirectDestination(searchParams)).resolves.toBeNull();
    }
  });
});
