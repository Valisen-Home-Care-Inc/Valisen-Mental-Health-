import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.SITE_URL || "http://127.0.0.1:3000";
const outputDir = path.resolve("artifacts", "funnel-redesign");

const captures = [
  {
    name: "homepage-desktop",
    path: "/",
    viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  },
  {
    name: "homepage-mobile",
    path: "/",
    viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
  },
  {
    name: "therapists-desktop",
    path: "/therapists",
    viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  },
  {
    name: "therapists-mobile",
    path: "/therapists",
    viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
  },
];

await fs.mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true });

try {
  for (const capture of captures) {
    const page = await browser.newPage();
    page.setDefaultTimeout(60_000);
    await page.setViewport(capture.viewport);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const hostname = new URL(request.url()).hostname;
      if (
        hostname.includes("googletagmanager.com") ||
        hostname.includes("google-analytics.com") ||
        hostname.includes("googleadservices.com")
      ) {
        void request.abort();
      } else {
        void request.continue();
      }
    });
    await page.goto(`${baseUrl}${capture.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForSelector("main h1");
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    const audit = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const h1 = document.querySelector("h1")?.textContent?.trim() || "";
      const hasHorizontalOverflow =
        document.documentElement.scrollWidth > document.documentElement.clientWidth;
      const overflowElements = Array.from(document.querySelectorAll("*"))
        .flatMap((element) => {
          const rect = element.getBoundingClientRect();
          return rect.right > document.documentElement.clientWidth + 1 ||
            rect.left < -1
            ? [
                {
                  tag: element.tagName.toLowerCase(),
                  id: element.id,
                  className:
                    typeof element.className === "string"
                      ? element.className.slice(0, 120)
                      : "",
                  left: Math.round(rect.left),
                  right: Math.round(rect.right),
                },
              ]
            : [];
        })
        .slice(0, 8);
      const mobileSticky = Array.from(
        document.querySelectorAll("a"),
      ).some((link) =>
        /Find My Therapist|Book Free Consultation with/.test(
          link.textContent || "",
        ),
      );
      return {
        h1,
        hasPrice: bodyText.includes("$180") && bodyText.includes("50 minutes"),
        hasFinder: Boolean(document.getElementById("therapist-finder")),
        hasRatingClaim:
          bodyText.includes("Trusted by Ontario residents") ||
          bodyText.includes("5.0"),
        hasHorizontalOverflow,
        overflowElements,
        mobileSticky,
      };
    });

    if (!audit.h1 || !audit.hasPrice || !audit.hasFinder) {
      throw new Error(
        `${capture.name} is missing required funnel content: ${JSON.stringify(audit)}`,
      );
    }
    if (audit.hasRatingClaim) {
      throw new Error(`${capture.name} still contains a rating/review claim.`);
    }
    if (audit.hasHorizontalOverflow) {
      throw new Error(`${capture.name} has horizontal overflow.`);
    }
    if (capture.viewport.width < 640 && !audit.mobileSticky) {
      throw new Error(`${capture.name} is missing a mobile primary action.`);
    }

    await page.screenshot({
      path: path.join(outputDir, `${capture.name}.png`),
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Saved ${captures.length} screenshots to ${outputDir}`);
