import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.SITE_URL || "http://127.0.0.1:3000";
const outputDir = path.resolve("artifacts", "consultation");
await fs.mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true });

async function preparePage(viewport) {
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  await page.setViewport(viewport);
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    const pathname = new URL(request.url()).pathname;
    if (
      pathname === "/api/funnel-events" ||
      hostname.includes("googletagmanager.com") ||
      hostname.includes("google-analytics.com") ||
      hostname.includes("googleadservices.com")
    ) {
      void request.abort();
    } else {
      void request.continue();
    }
  });
  await page.goto(
    `${baseUrl}/consultation?therapist=tim-kahtava&source=visual_qa`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await page.waitForSelector("#first-name");
  return page;
}

try {
  const desktop = await preparePage({
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
  });
  await desktop.screenshot({
    path: path.join(outputDir, "step-1-desktop.png"),
    fullPage: true,
  });
  await desktop.type("#first-name", "Alex");
  await desktop.type("#last-name", "Test");
  await desktop.type("#email", "alex@example.com");
  await desktop.select("#therapy-type", "Individual Therapy");
  await desktop.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((element) =>
      element.textContent?.includes("Continue to Availability"),
    );
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Continue button not found");
    }
    button.click();
  });
  await desktop.waitForFunction(() =>
    document.body.innerText.includes("When works best for you?"),
  );
  await desktop
    .waitForSelector('iframe[src*="challenges.cloudflare.com"]', {
      timeout: 15_000,
    })
    .catch(() => undefined);
  await desktop.screenshot({
    path: path.join(outputDir, "step-2-desktop.png"),
    fullPage: true,
  });
  await desktop.close();

  const mobile = await preparePage({
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
  });
  await mobile.screenshot({
    path: path.join(outputDir, "step-1-mobile.png"),
    fullPage: true,
  });
  await mobile.close();
} finally {
  await browser.close();
}
