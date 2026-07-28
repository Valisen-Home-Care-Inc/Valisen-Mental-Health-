import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.SITE_URL || "http://127.0.0.1:3000";
const outputDir = path.resolve("artifacts", "possibility-builder");

const viewports = [
  {
    label: "desktop",
    settings: { width: 1440, height: 1000, deviceScaleFactor: 1 },
  },
  {
    label: "mobile",
    settings: {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    },
  },
];

async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((expected) => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) =>
        (candidate.textContent || "").replace(/\s+/g, " ").trim().includes(expected),
    );
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`Could not find button containing: ${text}`);
}

async function saveElement(page, selector, filename) {
  const element = await page.waitForSelector(selector, { visible: true });
  if (!element) throw new Error(`Missing screenshot element: ${selector}`);
  await element.screenshot({
    path: path.join(outputDir, filename),
  });
}

async function assertNoOverflow(page, state) {
  const audit = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowElements: Array.from(document.querySelectorAll("*"))
      .flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > document.documentElement.clientWidth + 1 ||
          rect.left < -1
          ? [
              {
                tag: element.tagName.toLowerCase(),
                className:
                  typeof element.className === "string"
                    ? element.className.slice(0, 100)
                    : "",
                left: Math.round(rect.left),
                right: Math.round(rect.right),
              },
            ]
          : [];
      })
      .slice(0, 6),
  }));
  if (audit.scrollWidth > audit.viewport) {
    throw new Error(`${state} has horizontal overflow: ${JSON.stringify(audit)}`);
  }
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await puppeteer.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage();
    page.setDefaultTimeout(30_000);
    await page.setViewport(viewport.settings);
    await page.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
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

    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#therapist-finder");
    await saveElement(
      page,
      "#therapist-finder",
      `${viewport.label}-01-opening-stage.png`,
    );
    await assertNoOverflow(page, `${viewport.label} opening stage`);

    await page.evaluate(() => {
      const input = document.querySelector('input[value="worry"]');
      if (!(input instanceof HTMLInputElement)) throw new Error("Missing worry input");
      input.click();
    });
    if (viewport.label === "desktop") {
      await clickButtonByText(page, "Show Me What Progress");
    }
    await page.waitForSelector('input[value="decisions"]');
    await saveElement(
      page,
      "#therapist-finder",
      `${viewport.label}-02-goal-selection.png`,
    );
    await assertNoOverflow(page, `${viewport.label} goal stage`);

    await page.evaluate(() => {
      for (const value of ["decisions", "uncertainty"]) {
        const input = document.querySelector(`input[value="${value}"]`);
        if (!(input instanceof HTMLInputElement)) {
          throw new Error(`Missing goal input: ${value}`);
        }
        input.click();
      }
    });
    await clickButtonByText(page, "Build My Possible Next Step");
    await page.waitForSelector("[data-possibility-reflection]");

    await saveElement(
      page,
      "[data-possibility-reflection]",
      `${viewport.label}-03-possibility-reflection.png`,
    );
    await saveElement(
      page,
      "[data-possibility-recommendation]",
      `${viewport.label}-04-therapist-recommendation.png`,
    );
    await assertNoOverflow(page, `${viewport.label} completed stage`);

    const completedAudit = await page.evaluate(() => {
      const text = document.body.innerText;
      const janeLink = document.querySelector(
        '[data-possibility-recommendation] a[href*="janeapp.com"]',
      );
      return {
        hasFreeConsultation: text.includes("Free 20-minute consultation"),
        hasPaidRange: text.includes("$160–$180 per 50 minutes"),
        janeUrl: janeLink?.getAttribute("href") || "",
        hasSensitiveQuery:
          (janeLink?.getAttribute("href") || "").includes("?") ||
          (janeLink?.getAttribute("href") || "").includes("worry"),
      };
    });
    if (
      !completedAudit.hasFreeConsultation ||
      !completedAudit.hasPaidRange ||
      !completedAudit.janeUrl.includes("valisenmentalhealth.janeapp.com") ||
      completedAudit.hasSensitiveQuery
    ) {
      throw new Error(
        `${viewport.label} recommendation audit failed: ${JSON.stringify(completedAudit)}`,
      );
    }

    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`Saved 8 Possibility Builder screenshots to ${outputDir}`);
