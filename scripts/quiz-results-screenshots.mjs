import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.QUIZ_TEST_BASE_URL || "http://127.0.0.1:3000";
const outputDirectory = path.resolve("artifacts", "quiz-results");

const outcome = {
  scores: [
    { dimension: "worry", average: 2.5, answered: 3 },
    { dimension: "mood", average: 1.25, answered: 3 },
    { dimension: "stress", average: 1.75, answered: 3 },
    { dimension: "relationships", average: 1, answered: 3 },
  ],
  resultKey: "worry",
  ordered: ["worry", "stress", "mood", "relationships"],
  duration: "months",
  impact: "moderate",
  score: 52,
  answeredCount: 12,
};

const match = {
  status: "match",
  therapistSlug: "tim-kahtava",
  reasons: [
    {
      chip: "Anxiety",
      detail:
        "You selected “anxiety” — Tim lists this among their areas of support.",
    },
    {
      chip: "Worry & tension",
      detail:
        "Worry & tension stood out in your answers, and Tim works in this area.",
    },
    {
      chip: "Stress & overload",
      detail:
        "Stress & overload also appeared in your answers, and Tim works in this area.",
    },
  ],
  runnersUp: ["wilfred-bengnwi", "ryann-simpson", "dayong-quan"],
};

const variants = [
  {
    intent: "ready_to_speak",
    heading: "Your next step is ready",
    filename: "desktop-ready-to-speak.png",
  },
  {
    intent: "brief_consultation",
    heading: "A brief consultation is a good place to start",
    filename: "desktop-brief-consultation.png",
  },
  {
    intent: "see_recommended_therapist",
    heading: "Meet your recommended therapist",
    filename: "desktop-see-recommended-therapist.png",
  },
  {
    intent: "exploring",
    heading: "Here’s what stood out in your answers",
    filename: "desktop-exploring.png",
  },
];

function tokenFor(index) {
  return `v1.VQ-SCREENSHOT${String(index + 1).padStart(2, "0")}.${String.fromCharCode(
    97 + index,
  ).repeat(43)}`;
}

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    headers: { "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

async function configurePage(page, variant, index) {
  const token = tokenFor(index);
  const referenceId = `VQ-SCREENSHOT${String(index + 1).padStart(2, "0")}`;

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    void (async () => {
      const url = new URL(request.url());
      if (
        request.method() === "POST" &&
        url.pathname === "/api/quiz-lead/result"
      ) {
        await request.respond(
          jsonResponse({
            ok: true,
            firstName: "Alex",
            referenceId,
            outcome,
            match,
            intent: variant.intent,
            contactHelpSent: false,
            attribution: {
              source: "screenshot-qa",
              campaign: "intent-results",
            },
          }),
        );
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === "/api/quiz-lead/engagement"
      ) {
        await request.respond(jsonResponse({ ok: true, referenceId }));
        return;
      }

      if (
        url.hostname.includes("googletagmanager.com") ||
        url.hostname.includes("google-analytics.com") ||
        url.hostname.includes("googleadservices.com")
      ) {
        await request.abort();
        return;
      }

      await request.continue();
    })().catch(() => {
      if (!request.isInterceptResolutionHandled()) void request.abort();
    });
  });

  await page.goto(`${baseUrl}/quiz#result=${encodeURIComponent(token)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    (expected) =>
      (document.querySelector("main")?.textContent || "")
        .replace(/\s+/g, " ")
        .includes(expected),
    { timeout: 12_000 },
    variant.heading,
  );
  await page.waitForSelector('a[href*="valisenmentalhealth.janeapp.com"]', {
    timeout: 8_000,
  });
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map(
        (image) =>
          new Promise((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }
            const finish = () => {
              image.removeEventListener("load", finish);
              image.removeEventListener("error", finish);
              resolve();
            };
            image.addEventListener("load", finish, { once: true });
            image.addEventListener("error", finish, { once: true });
            window.setTimeout(finish, 3_000);
            // Avoid missing an event between the first complete check and
            // listener registration.
            if (image.complete) finish();
          }),
      ),
    );
    document.documentElement.style.scrollBehavior = "auto";
    // ResultsReveal may schedule a focus/scroll adjustment while reduced
    // motion state settles. Let that accessibility hand-off finish before
    // resetting the evidence capture to the true top of the page.
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    window.scrollTo(0, 0);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}

async function main() {
  await fs.mkdir(outputDirectory, { recursive: true });
  const browser = await puppeteer.launch({ headless: true });

  try {
    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index];
      const page = await browser.newPage();
      page.setDefaultTimeout(12_000);
      await page.setViewport({
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
      });
      await page.emulateMediaFeatures([
        { name: "prefers-reduced-motion", value: "reduce" },
      ]);
      await configurePage(page, variant, index);
      console.log(`Capturing ${variant.filename}`);
      await page.screenshot({
        path: path.join(outputDirectory, variant.filename),
        fullPage: false,
      });
      await page.close();
    }

    const mobileVariant = variants[0];
    const mobilePage = await browser.newPage();
    mobilePage.setDefaultTimeout(12_000);
    await mobilePage.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });
    await mobilePage.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    await configurePage(mobilePage, mobileVariant, variants.length);

    console.log("Capturing mobile-ready-to-speak-top.png");
    await mobilePage.screenshot({
      path: path.join(outputDirectory, "mobile-ready-to-speak-top.png"),
      fullPage: false,
    });

    await mobilePage.evaluate(() => {
      const primary = [...document.querySelectorAll('a[href*="janeapp.com"]')].find(
        (link) => {
          let element = link;
          while (element) {
            if (getComputedStyle(element).position === "fixed") return false;
            element = element.parentElement;
          }
          return true;
        },
      );
      const bottom = primary?.getBoundingClientRect().bottom ?? innerHeight;
      window.scrollTo(0, window.scrollY + bottom + 80);
    });
    await mobilePage.waitForFunction(
      () =>
        [...document.querySelectorAll("a")].some(
          (link) => {
            if (
              !link.textContent
                ?.replace(/\s+/g, " ")
                .trim()
                .startsWith("Choose a Consultation Time")
            ) {
              return false;
            }
            let element = link;
            while (element) {
              if (getComputedStyle(element).position === "fixed") return true;
              element = element.parentElement;
            }
            return false;
          },
        ),
      { timeout: 8_000 },
    );
    console.log("Capturing mobile-ready-to-speak-sticky.png");
    await mobilePage.screenshot({
      path: path.join(outputDirectory, "mobile-ready-to-speak-sticky.png"),
      fullPage: false,
    });
    await mobilePage.close();
  } finally {
    await browser.close();
  }

  console.log(`Quiz result screenshots written to ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
