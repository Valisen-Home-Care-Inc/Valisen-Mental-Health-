import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canonicalizeGoogleAdsPath,
  GOOGLE_ADS_TRACKED_PATHS,
  googleAdsEntryTarget,
  isCrisisPhoneHref,
  isGoogleAdsFormFieldId,
  parseGoogleAdsJourneyBrowserClaim,
} from "@/lib/googleAdsJourney";
import {
  GOOGLE_ADS_CONVERSION_TTL_SECONDS,
  createGoogleAdsConversionReceipt,
  verifyGoogleAdsConversionReceipt,
} from "@/lib/server/googleAdsConversionReceipt";
import { getVerifiedGoogleAdsJourney } from "@/lib/server/googleAdsRequest";
import {
  GOOGLE_ADS_JOURNEY_TTL_SECONDS,
  createGoogleAdsJourney,
  verifyGoogleAdsJourneyToken,
} from "@/lib/server/googleAdsJourneySession";

const SECRET = "google-ads-conversion-test-secret-that-is-long-enough";
const SESSION = "gas-12345678-1234-4234-9234-123456789abc";
const REFERENCE = "VC-ABCDEF123456";

beforeEach(() => vi.stubEnv("GOOGLE_ADS_CONVERSION_SECRET", SECRET));
afterEach(() => vi.unstubAllEnvs());

describe("Google Ads journey boundaries", () => {
  it("uses fixed entry aliases and canonical closed paths", () => {
    expect(googleAdsEntryTarget(undefined)).toBe("/welcome");
    expect(googleAdsEntryTarget(["home"])).toBe("/");
    expect(googleAdsEntryTarget(["welcome"])).toBe("/welcome");
    expect(googleAdsEntryTarget(["welcome", "thank-you"])).toBeNull();
    expect(googleAdsEntryTarget(["anxiety"])).toBe("/welcome");
    expect(googleAdsEntryTarget(["lp", "google-ads"])).toBeNull();
    expect(googleAdsEntryTarget(["therapists", "dayong-quan"])).toBe(
      "/therapists/dayong-quan",
    );
    expect(googleAdsEntryTarget(["admin"])).toBeNull();
    expect(canonicalizeGoogleAdsPath("/therapists?person=private")).toBe(
      "/therapists",
    );
    expect(canonicalizeGoogleAdsPath("/not-allowlisted/private-value")).toBe(
      "/sitewide",
    );
  });

  it("allowlists form fields, tracked SQL paths, and omits crisis calls", () => {
    expect(isGoogleAdsFormFieldId("full-name")).toBe(true);
    expect(isGoogleAdsFormFieldId("email")).toBe(true);
    expect(isGoogleAdsFormFieldId("entered-value@example.com")).toBe(false);
    expect(isCrisisPhoneHref("tel:988")).toBe(true);
    expect(isCrisisPhoneHref("tel:613-722-6914")).toBe(true);
    expect(isCrisisPhoneHref("tel:613-707-0333")).toBe(false);
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260901000000_google_ads_welcome_tracking_hotfix.sql",
      ),
      "utf8",
    );
    for (const path of GOOGLE_ADS_TRACKED_PATHS) {
      expect(migration, `missing SQL path ${path}`).toContain(`'${path}'`);
    }
  });

  it("ships a closed, value-free consultation field-entry migration", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260904000000_google_ads_form_field_entry.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("'form_field_entered'");
    expect(migration).toContain("'full-name', 'first-name', 'last-name'");
    expect(migration).toContain("v_path not in (''/consultation'', ''/welcome'')");
    expect(migration).toContain("'formFieldsEntered'");
    expect(migration).not.toMatch(/first_name|email_address|phone_number|field_value/);
  });

  it("requires same-origin plus an untampered purpose-bound receipt", () => {
    const now = Date.now();
    const journey = createGoogleAdsJourney({
      landingPath: "/welcome",
      search: "?utm_source=google&utm_medium=cpc&utm_campaign=anxiety&gclid=abcdef123",
      now,
    });
    expect(journey).toBeTruthy();
    const valid = new NextRequest(
      "https://valisenmentalhealth.com/api/google-ads/events",
      {
        method: "POST",
        headers: {
          Origin: "https://valisenmentalhealth.com",
          Host: "valisenmentalhealth.com",
          "Sec-Fetch-Site": "same-origin",
        },
        body: "{}",
      },
    );
    expect(getVerifiedGoogleAdsJourney(valid, journey?.token)?.sessionId).toBe(
      journey?.claim.sessionId,
    );
    expect(getVerifiedGoogleAdsJourney(valid, `${journey?.token}x`)).toBeNull();

    const crossOrigin = new NextRequest(
      "https://valisenmentalhealth.com/api/google-ads/events",
      {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          Host: "valisenmentalhealth.com",
        },
        body: "{}",
      },
    );
    expect(getVerifiedGoogleAdsJourney(crossOrigin, journey?.token)).toBeNull();

    const deployAlias = new NextRequest(
      "https://valisen-mental-health.netlify.app/api/google-ads/events",
      {
        method: "POST",
        headers: {
          Origin: "https://valisen-mental-health.netlify.app",
          Host: "valisen-mental-health.netlify.app",
          "Sec-Fetch-Site": "same-origin",
        },
        body: "{}",
      },
    );
    expect(getVerifiedGoogleAdsJourney(deployAlias, journey?.token)).toBeNull();
    expect(
      verifyGoogleAdsJourneyToken(
        journey?.token,
        now + GOOGLE_ADS_JOURNEY_TTL_SECONDS * 1_000,
      ),
    ).toBeNull();
  });

  it("seals the click attribution into the signed token for both server and browser", () => {
    const valueTrack = {
      campaignId: "18124413697",
      campaignName: "Therapy Ontario Search",
      adGroupId: "7639334819",
      adGroupName: "Therapy-Ontario",
      keyword: "online therapy ontario",
      matchType: "phrase" as const,
      network: "search" as const,
      device: "mobile" as const,
      creativeId: "987654321",
    };
    const journey = createGoogleAdsJourney({
      landingPath: "/welcome",
      search: "?utm_source=google&utm_medium=cpc&utm_campaign=Therapy%20Ontario%20Search&gclid=abcdef123",
      valueTrack,
    });
    expect(journey?.claim.valueTrack).toEqual(valueTrack);
    expect(journey?.claim.attribution).toEqual({
      source: "google",
      medium: "cpc",
      campaign: "Therapy Ontario Search",
    });
    const verified = verifyGoogleAdsJourneyToken(journey?.token);
    expect(verified?.valueTrack).toEqual(valueTrack);
    expect(verified?.attribution).toEqual(journey?.claim.attribution);
    expect(journey?.token.length).toBeLessThan(2_500);
    // The browser reads only the narrow public claim and ignores the sealed detail.
    const browserClaim = parseGoogleAdsJourneyBrowserClaim(journey?.token);
    expect(browserClaim?.sessionId).toBe(journey?.claim.sessionId);
    expect(browserClaim?.attribution.campaign).toBe("Therapy Ontario Search");
    expect(JSON.stringify(browserClaim)).not.toContain("online therapy ontario");
  });
});

describe("Google Ads conversion receipt", () => {
  it("accepts an untampered short-lived claim and rejects expiry", () => {
    const now = Date.UTC(2026, 7, 23, 12, 0, 0);
    const token = createGoogleAdsConversionReceipt(
      { sessionId: SESSION, referenceId: REFERENCE },
      {
        now,
        secret: SECRET,
        nonce: Buffer.alloc(16, 7).toString("base64url"),
      },
    );
    expect(token).toBeTruthy();
    const verified = verifyGoogleAdsConversionReceipt(token, {
      now: now + 1_000,
      secret: SECRET,
    });
    expect(verified).toMatchObject({
      sessionId: SESSION,
      referenceId: REFERENCE,
    });
    expect(verified?.nonceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      verifyGoogleAdsConversionReceipt(token, {
        now: now + GOOGLE_ADS_CONVERSION_TTL_SECONDS * 1_000,
        secret: SECRET,
      }),
    ).toBeNull();
    expect(
      verifyGoogleAdsConversionReceipt(`${token}x`, { now, secret: SECRET }),
    ).toBeNull();
  });

  it("fails closed when identifiers or the signing secret are invalid", () => {
    expect(
      createGoogleAdsConversionReceipt(
        { sessionId: "fs-not-an-ad-session", referenceId: REFERENCE },
        { secret: SECRET },
      ),
    ).toBeNull();
    expect(
      createGoogleAdsConversionReceipt(
        { sessionId: SESSION, referenceId: REFERENCE },
        { secret: "short" },
      ),
    ).toBeNull();
  });
});
