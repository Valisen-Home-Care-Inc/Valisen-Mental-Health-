import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.SITE_URL || "http://127.0.0.1:3000";
const outputDir = path.resolve("artifacts", "therapist-cards");
const captures = [
  {
    name: "desktop-nav",
    kind: "element",
    route: "/",
    selector: "nav",
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
  },
  {
    name: "desktop-pricing",
    kind: "element",
    route: "/",
    selector: "#pricing",
    viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  },
  {
    name: "dayong-profile-mobile",
    kind: "element",
    route: "/therapists/dayong-quan",
    selector: "main > section:first-of-type",
    viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
  },
  {
    name: "homepage-desktop",
    kind: "cards",
    route: "/",
    section: "#therapist-comparison",
    cardCount: 2,
    viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  },
  {
    name: "homepage-laptop",
    kind: "cards",
    route: "/",
    section: "#therapist-comparison",
    cardCount: 2,
    viewport: { width: 1100, height: 800, deviceScaleFactor: 1 },
  },
  {
    name: "homepage-desktop-second-row",
    kind: "cards",
    route: "/",
    section: "#therapist-comparison",
    cardStart: 2,
    cardCount: 2,
    viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  },
  {
    name: "homepage-mobile",
    kind: "cards",
    route: "/",
    section: "#therapist-comparison",
    cardCount: 1,
    viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
  },
  {
    name: "directory-desktop",
    kind: "cards",
    route: "/therapists",
    section: "#therapist-directory",
    cardCount: 2,
    viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  },
  {
    name: "directory-laptop",
    kind: "cards",
    route: "/therapists",
    section: "#therapist-directory",
    cardCount: 2,
    viewport: { width: 1100, height: 800, deviceScaleFactor: 1 },
  },
  {
    name: "directory-mobile",
    kind: "cards",
    route: "/therapists",
    section: "#therapist-directory",
    cardCount: 1,
    viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
  },
  {
    name: "mobile-hero",
    kind: "element",
    route: "/",
    selector: "[data-home-hero]",
    viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
  },
  {
    name: "mobile-finder-opening",
    kind: "element",
    route: "/",
    selector: "#therapist-finder",
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
    await page.goto(`${baseUrl}${capture.route}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const targetSelector =
      capture.kind === "cards"
        ? `${capture.section} article`
        : capture.selector;
    await page.waitForSelector(targetSelector);
    if (capture.kind === "cards") {
      await page.$$eval(
        `${capture.section} article`,
        (elements, cardStart, cardCount) => {
          const selected = elements.slice(cardStart, cardStart + cardCount);
          for (const element of selected) {
            element.scrollIntoView({ block: "center" });
          }
        },
        capture.cardStart ?? 0,
        capture.cardCount,
      );
      await page.waitForFunction(
        (section, cardStart, cardCount) =>
          Array.from(
            document.querySelectorAll(`${section} article`),
          )
            .slice(cardStart, cardStart + cardCount)
            .flatMap((card) => Array.from(card.querySelectorAll("img")))
            .every((image) => image.complete && image.naturalWidth > 0),
        { timeout: 60_000 },
        capture.section,
        capture.cardStart ?? 0,
        capture.cardCount,
      );
    } else {
      await page.$eval(targetSelector, (element) =>
        element.scrollIntoView({ block: "center" }),
      );
    }

    const clip = await page.evaluate((settings) => {
      const elements =
        settings.kind === "cards"
          ? Array.from(
              document.querySelectorAll(`${settings.section} article`),
            ).slice(
              settings.cardStart ?? 0,
              (settings.cardStart ?? 0) + settings.cardCount,
            )
          : [document.querySelector(settings.selector)].filter(Boolean);
      if (elements.length === 0) {
        throw new Error(`No capture elements found for ${settings.name}`);
      }
      const rects = elements.map((element) => element.getBoundingClientRect());
      const margin = 18;
      const left = Math.max(0, Math.min(...rects.map((rect) => rect.left)) - margin);
      const top = Math.max(
        0,
        Math.min(...rects.map((rect) => rect.top)) + window.scrollY - margin,
      );
      const right = Math.min(
        document.documentElement.scrollWidth,
        Math.max(...rects.map((rect) => rect.right)) + margin,
      );
      const bottom =
        Math.max(...rects.map((rect) => rect.bottom)) + window.scrollY + margin;
      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
        scale: 1,
      };
    }, capture);

    const client = await page.createCDPSession();
    const result = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      fromSurface: true,
      clip,
    });
    await fs.writeFile(
      path.join(outputDir, `${capture.name}.png`),
      Buffer.from(result.data, "base64"),
    );
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Saved ${captures.length} therapist-card screenshots to ${outputDir}`);
