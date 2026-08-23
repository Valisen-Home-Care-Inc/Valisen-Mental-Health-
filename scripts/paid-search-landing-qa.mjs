import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.SITE_URL || "http://127.0.0.1:3000";
const outputDir =
  process.env.QA_OUTPUT_DIR ||
  path.join(os.tmpdir(), "valisen-paid-search-landing-qa");

const routes = [
  {
    path: "/lp/anxiety-therapy",
    expectedTherapists: [
      "Ryann Simpson",
      "Meryem Ibrahim",
      "Dayong Quan",
      "Tim Kahtava",
    ],
  },
  {
    path: "/lp/depression-therapy",
    expectedTherapists: ["Meryem Ibrahim", "Tim Kahtava", "Dayong Quan"],
  },
  {
    path: "/lp/couples-therapy",
    expectedTherapists: ["Wilfred Bengnwi", "Tim Kahtava", "Ryann Simpson"],
  },
];

const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await puppeteer.launch({ headless: true });

try {
  for (const route of routes) {
    for (const viewport of viewports) {
      const page = await browser.newPage();
      const runtimeErrors = [];
      page.setDefaultTimeout(60_000);
      await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          url.pathname === "/api/funnel-events" ||
          url.hostname.includes("googletagmanager.com") ||
          url.hostname.includes("google-analytics.com") ||
          url.hostname.includes("googleadservices.com")
        ) {
          void request.abort();
        } else {
          void request.continue();
        }
      });
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          !message.text().includes("Failed to load resource: net::ERR_FAILED")
        ) {
          runtimeErrors.push(message.text());
        }
      });

      const url =
        `${baseUrl}${route.path}` +
        "?utm_source=google&utm_medium=cpc&utm_campaign=landing-qa" +
        "&utm_term=private-search-term&utm_content=responsive" +
        "&gclid=qa-google-click&gbraid=qa-app-click&wbraid=qa-web-click";
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      assert(
        response?.status() === 200 || response?.status() === 304,
        `${route.path} returned ${response?.status()}`,
      );
      await page.waitForSelector("h1");
      await new Promise((resolve) => setTimeout(resolve, 250));
      await page.evaluate(() => {
        history.scrollRestoration = "manual";
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, 0);
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = await page.evaluate((expectedTherapists) => {
        const links = [...document.querySelectorAll("a")];
        const heroCta = links.find((link) =>
          link.textContent?.includes("Book a Free 20-Minute Consultation"),
        );
        const therapistCtas = links.filter((link) =>
          link.getAttribute("aria-label")?.startsWith("Book a free consultation with"),
        );
        const sticky = document.querySelector(
          'aside[aria-label="Book a free consultation"]',
        );
        const heroRect = heroCta?.getBoundingClientRect();
        const stickyStyle = sticky ? getComputedStyle(sticky) : null;
        const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
        const schema = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map((script) => {
            try {
              return JSON.parse(script.textContent || "null");
            } catch {
              return null;
            }
          })
          .find((value) => value?.["@type"] === "FAQPage");
        const bodyText = document.body.innerText;
        const dataLayer = JSON.stringify(window.dataLayer || []);
        const storage = {
          campaign: sessionStorage.getItem("valisen:first-touch-attribution:v1"),
          term: sessionStorage.getItem("valisen:first-touch-utm-term:v1"),
          clicks: sessionStorage.getItem("valisen:first-touch-google-click:v1"),
        };

        return {
          currentSearch: window.location.search,
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          heroCtaTop: heroRect?.top ?? null,
          heroCtaBottom: heroRect?.bottom ?? null,
          stickyDisplay: stickyStyle?.display ?? "missing",
          stickyBottom: sticky?.getBoundingClientRect().bottom ?? null,
          consultationHref:
            heroCta instanceof HTMLAnchorElement ? heroCta.getAttribute("href") : null,
          therapistHrefs: therapistCtas.map((link) => link.getAttribute("href")),
          missingTherapists: expectedTherapists.filter(
            (therapist) => !bodyText.includes(therapist),
          ),
          robots,
          canonical,
          faqCount: schema?.mainEntity?.length ?? 0,
          dataLayer,
          storage,
        };
      }, route.expectedTherapists);

      assert(
        metrics.scrollWidth <= metrics.viewportWidth,
        `${route.path} overflows at ${viewport.width}px (${metrics.scrollWidth}px)`,
      );
      assert(
        metrics.consultationHref ===
          "/consultation?source=paid_search_landing",
        `${route.path} primary CTA has an unexpected destination`,
      );
      assert(
        metrics.therapistHrefs.length === route.expectedTherapists.length &&
          metrics.therapistHrefs.every(
            (href) =>
              href?.startsWith("/consultation?therapist=") &&
              href.includes("source=paid_search_landing"),
          ),
        `${route.path} therapist CTA routing is incomplete`,
      );
      assert(
        metrics.missingTherapists.length === 0,
        `${route.path} is missing ${metrics.missingTherapists.join(", ")}`,
      );
      assert(
        /noindex/i.test(metrics.robots) && /follow/i.test(metrics.robots),
        `${route.path} is missing noindex, follow`,
      );
      assert(
        metrics.canonical === `https://valisenmentalhealth.com${route.path}`,
        `${route.path} has an unexpected canonical`,
      );
      assert(metrics.faqCount === 7, `${route.path} FAQ schema is not aligned`);
      assert(
        metrics.storage.campaign?.includes('"source":"google"') &&
          metrics.storage.term === "private-search-term" &&
          metrics.storage.clicks?.includes('"gclid":"qa-google-click"'),
        `${route.path} did not preserve campaign attribution first-party`,
      );
      assert(
        !metrics.currentSearch.includes("utm_term") &&
          metrics.currentSearch.includes("gclid=qa-google-click"),
        `${route.path} did not scrub the search term before marketing tags`,
      );
      assert(
        !/private-search-term|qa-google-click|qa-app-click|qa-web-click/.test(
          metrics.dataLayer,
        ),
        `${route.path} leaked private attribution into the data layer`,
      );

      if (viewport.width < 768) {
        assert(metrics.stickyDisplay !== "none", `${route.path} sticky CTA is hidden`);
        assert(
          metrics.stickyBottom !== null &&
            Math.abs(metrics.stickyBottom - viewport.height) < 2,
          `${route.path} sticky CTA is not anchored to the viewport`,
        );
      } else {
        assert(metrics.stickyDisplay === "none", `${route.path} sticky CTA remains on desktop`);
      }

      if ([375, 390, 430].includes(viewport.width)) {
        assert(
          metrics.heroCtaTop !== null &&
            metrics.heroCtaTop >= 0 &&
            metrics.heroCtaBottom !== null &&
            metrics.heroCtaBottom <= viewport.height,
          `${route.path} hero CTA is below the fold at ${viewport.width}px`,
        );
      }

      assert(
        runtimeErrors.length === 0,
        `${route.path} ${viewport.width}px browser errors: ${runtimeErrors.join(" | ")}`,
      );

      if (viewport.width === 390 || viewport.width === 1440) {
        const routeName = route.path.split("/").pop();
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise((resolve) => setTimeout(resolve, 100));
        await page.screenshot({
          path: path.join(outputDir, `${routeName}-${viewport.width}-hero.png`),
          fullPage: false,
        });
        const therapistSectionTop = await page.$eval(
          "#therapists",
          (element) => element.getBoundingClientRect().top + window.scrollY,
        );
        await page.evaluate((top) => window.scrollTo(0, top), therapistSectionTop);
        await new Promise((resolve) => setTimeout(resolve, 350));
        await page.screenshot({
          path: path.join(
            outputDir,
            `${routeName}-${viewport.width}-therapists.png`,
          ),
          fullPage: false,
        });
        const fileName = `${routeName}-${viewport.width}.png`;
        await page.screenshot({
          path: path.join(outputDir, fileName),
          fullPage: true,
        });
      }
      await page.close();
    }
  }

  const eventPage = await browser.newPage();
  const funnelBatches = [];
  await eventPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await eventPage.setRequestInterception(true);
  eventPage.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/funnel-events") {
      try {
        funnelBatches.push(JSON.parse(request.postData() || "{}"));
      } catch {
        funnelBatches.push({});
      }
      void request.respond({ status: 204 });
    } else if (url.hostname.includes("google")) {
      void request.abort();
    } else {
      void request.continue();
    }
  });
  await eventPage.goto(
    `${baseUrl}/lp/anxiety-therapy?utm_source=google&utm_medium=cpc&utm_term=private-event-term&gclid=event-click`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await eventPage.waitForSelector(
    'a[aria-label="Book a free consultation with Meryem Ibrahim"]',
  );
  await eventPage.evaluate(() => {
    window.addEventListener("click", (event) => event.preventDefault(), true);
    const links = [...document.querySelectorAll("a")];
    const hero = links.find((link) =>
      link.textContent?.includes("Book a Free 20-Minute Consultation"),
    );
    const phone = document.querySelector('header a[href^="tel:"]');
    const therapist = document.querySelector(
      'a[aria-label="Book a free consultation with Meryem Ibrahim"]',
    );
    const sticky = document.querySelector(
      'aside[aria-label="Book a free consultation"] a',
    );
    for (const link of [hero, phone, therapist, sticky]) {
      if (link instanceof HTMLElement) link.click();
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const eventLayer = await eventPage.evaluate(() => window.dataLayer || []);
  const firstPartyEvents = funnelBatches.flatMap((batch) => batch.events || []);
  const marketingEvents = eventLayer.filter(
    (entry) => entry && typeof entry === "object" && "event" in entry,
  );
  for (const expectedEvent of [
    "landing_page_viewed",
    "paid_traffic_landed",
    "phone_clicked",
    "consultation_request_clicked",
  ]) {
    assert(
      marketingEvents.some((event) => event.event === expectedEvent),
      `GTM data layer is missing ${expectedEvent}`,
    );
    assert(
      firstPartyEvents.some((event) => event.event === expectedEvent),
      `First-party tracking is missing ${expectedEvent}`,
    );
  }
  assert(
    firstPartyEvents.some(
      (event) =>
        event.event === "landing_page_viewed" &&
        event.page === "paid_search_anxiety",
    ),
    "First-party tracking lost the exact landing-page cohort",
  );
  assert(
    marketingEvents
      .filter((event) => typeof event.page === "string")
      .every((event) => event.page === "paid_search_landing"),
    "GTM received a service-specific paid-search page identifier",
  );
  assert(
    firstPartyEvents.some(
      (event) =>
        event.event === "consultation_request_clicked" &&
        event.therapistId === "meryem-ibrahim",
    ),
    "Therapist CTA did not retain its first-party therapist identifier",
  );
  assert(
    !/private-event-term|event-click/.test(
      JSON.stringify({ eventLayer, funnelBatches }),
    ),
    "Sensitive or click attribution leaked into an event payload",
  );
  await eventPage.close();

  const handoffPage = await browser.newPage();
  await handoffPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await handoffPage.setRequestInterception(true);
  handoffPage.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === "/api/funnel-events" ||
      url.hostname.includes("google")
    ) {
      void request.abort();
    } else {
      void request.continue();
    }
  });
  await handoffPage.goto(
    `${baseUrl}/lp/anxiety-therapy?utm_source=google&utm_medium=cpc&gclid=handoff-click`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await handoffPage.waitForSelector(
    'a[aria-label="Book a free consultation with Meryem Ibrahim"]',
  );
  await handoffPage.click(
    'a[aria-label="Book a free consultation with Meryem Ibrahim"]',
  );
  await handoffPage.waitForFunction(
    () =>
      window.location.pathname === "/consultation" &&
      document.querySelector("#preferred-therapist"),
  );
  const handoff = await handoffPage.evaluate(() => ({
    therapist: (document.querySelector("#preferred-therapist"))?.value,
    search: window.location.search,
    campaign: sessionStorage.getItem("valisen:first-touch-attribution:v1"),
    clicks: sessionStorage.getItem("valisen:first-touch-google-click:v1"),
  }));
  assert(
    handoff.therapist === "meryem-ibrahim",
    "Therapist preference did not reach the consultation form",
  );
  assert(
    handoff.search.includes("source=paid_search_landing") &&
      handoff.search.includes("therapist=meryem-ibrahim"),
    "Paid-search consultation source was not retained",
  );
  assert(
    handoff.campaign?.includes('"source":"google"') &&
      handoff.clicks?.includes('"gclid":"handoff-click"'),
    "First-party attribution did not survive the consultation handoff",
  );
  await handoffPage.close();

  process.stdout.write(
    `Paid-search landing QA passed for ${routes.length} routes × ${viewports.length} viewports. Screenshots: ${outputDir}\n`,
  );
} finally {
  await browser.close();
}
