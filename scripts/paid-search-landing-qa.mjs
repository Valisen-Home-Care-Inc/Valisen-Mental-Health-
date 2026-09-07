import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer";

const baseUrl = process.env.SITE_URL || "http://127.0.0.1:3000";
const outputDir =
  process.env.QA_OUTPUT_DIR ||
  path.join(os.tmpdir(), "valisen-paid-search-landing-qa");

const expectedTherapists = [
  "Ryann Simpson",
  "Wilfred Bengnwi",
  "Meryem Ibrahim",
  "Dayong Quan",
  "Tim Kahtava",
];

// /welcome is the only dedicated Google Ads landing page; the other option
// for campaigns is the default domain (homepage), not a separate route.
const routes = [{ path: "/welcome", expectedTherapists }];

const removedRoutes = [
  "/lp/anxiety-therapy",
  "/lp/depression-therapy",
  "/lp/couples-therapy",
  "/lp/google-ads",
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
        const sectionNavHrefs = (label) =>
          [
            ...document.querySelectorAll(
              `nav[aria-label="${label}"] a`,
            ),
          ].map((link) => link.getAttribute("href"));
        const heroCta = links.find((link) =>
          link.textContent?.includes("Book a Free Consultation"),
        );
        const therapistCtas = [
          ...document.querySelectorAll("#therapists article a"),
        ].filter(
          (link) => link.textContent?.trim() === "Book Free Consultation",
        );
        const therapistCards = [
          ...document.querySelectorAll("[data-therapist-card]"),
        ];
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
          therapistCardDetails: therapistCards.map((card) => ({
            fit: card.querySelector("[data-fit-statement]")?.textContent?.trim() || "",
            specialties:
              card.querySelector("[data-specialties]")?.children.length || 0,
            text: card.textContent || "",
            profileLinks: [...card.querySelectorAll("a")].filter((link) =>
              link.getAttribute("href")?.startsWith("/therapists/"),
            ).length,
          })),
          desktopNavHrefs: sectionNavHrefs("Landing page sections"),
          mobileNavHrefs: sectionNavHrefs(
            "Landing page sections on mobile",
          ),
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
        metrics.consultationHref === "#contact",
        `${route.path} primary CTA has an unexpected destination`,
      );
      assert(
        metrics.therapistHrefs.length === route.expectedTherapists.length &&
          metrics.therapistHrefs.every((href) => href === "#contact"),
        `${route.path} therapist CTA routing is incomplete`,
      );
      assert(
        metrics.therapistCardDetails.length === route.expectedTherapists.length &&
          metrics.therapistCardDetails.every(
            (card) =>
              card.fit.length > 0 &&
              card.fit.length <= 120 &&
              card.specialties >= 2 &&
              card.specialties <= 4 &&
              card.text.includes("For:") &&
              card.text.includes("Languages:") &&
              card.text.includes("Accepting new clients") &&
              !/\$\d+/.test(card.text) &&
              card.profileLinks === 0,
          ),
        `${route.path} therapist cards are missing compact fit details or contain directory behavior`,
      );
      const expectedNavHrefs = [
        "#therapists",
        "#about",
        "#services",
        "#contact",
      ];
      assert(
        JSON.stringify(metrics.desktopNavHrefs) ===
          JSON.stringify(expectedNavHrefs) &&
          JSON.stringify(metrics.mobileNavHrefs) ===
            JSON.stringify(expectedNavHrefs),
        `${route.path} section navigation is not the required four-link menu`,
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
      assert(metrics.faqCount === 5, `${route.path} FAQ schema is not aligned`);
      assert(
        metrics.storage.campaign?.includes('"source":"google"') &&
          metrics.storage.term === "private-search-term" &&
          metrics.storage.clicks?.includes('"gclid":"qa-google-click"'),
        `${route.path} ${viewport.width}px did not preserve campaign attribution first-party: ${JSON.stringify(metrics.storage)}`,
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
        // Already scrolled away (at the therapists section) from the shot
        // above. Click the always-present header CTA, matching the real
        // user path (ConsultationCta's own JS-driven scroll), rather than
        // calling the browser's native scrollIntoView directly: Chrome's
        // sticky-header detection does not reliably honor this page's
        // scroll-margin-top, but the app never relies on that native path
        // for a real click.
        const headerCtaHandle = await page.evaluateHandle(() =>
          [...document.querySelectorAll("header a")].find((link) =>
            link.textContent?.includes("Book Free Consult"),
          ),
        );
        await headerCtaHandle.asElement()?.click();
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        const settledContactTop = await page.$eval(
          "#contact",
          (element) => element.getBoundingClientRect().top,
        );
        assert(
          settledContactTop >= 0 && settledContactTop <= 130,
          `${route.path} contact anchor is obscured by the sticky navigation (${settledContactTop}px)`,
        );
        await page.screenshot({
          path: path.join(
            outputDir,
            `${routeName}-${viewport.width}-contact.png`,
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
    `${baseUrl}/welcome?utm_source=google&utm_medium=cpc&utm_term=private-event-term&gclid=event-click`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await eventPage.waitForSelector(
    '#therapists article a[aria-label="Book a free consultation"]',
  );
  await eventPage.evaluate(() => {
    window.addEventListener("click", (event) => event.preventDefault(), true);
    const links = [...document.querySelectorAll("a")];
    const hero = links.find((link) =>
      link.textContent?.includes("Book a Free Consultation"),
    );
    const phone = document.querySelector('a[href^="tel:"]');
    const therapist = document.querySelector(
      '#therapists article a[aria-label="Book a free consultation"]',
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
    "consultation_step_viewed",
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
        event.page === "paid_search_landing",
    ),
    "First-party tracking lost the universal landing-page cohort",
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
        event.ctaPlacement === "therapist_card" &&
        !event.therapistId,
    ),
    "Therapist CTA is missing or created a therapist-selection identifier",
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
    `${baseUrl}/welcome?utm_source=google&utm_medium=cpc&gclid=handoff-click`,
    { waitUntil: "domcontentloaded", timeout: 60_000 },
  );
  await handoffPage.waitForSelector(
    '#therapists article a[aria-label="Book a free consultation"]',
  );
  await handoffPage.click(
    '#therapists article a[aria-label="Book a free consultation"]',
  );
  await handoffPage.waitForFunction(
    () =>
      window.location.hash === "#contact" &&
      document.querySelector('[id$="-full-name"]'),
  );
  const handoff = await handoffPage.evaluate(() => ({
    hasFullName: Boolean(document.querySelector('[id$="-full-name"]')),
    hasEmail: Boolean(document.querySelector('[id$="-email"]')),
    hasPhone: Boolean(document.querySelector('[id$="-phone"]')),
    hasAvailability: Boolean(document.querySelector('[id$="-slot"]')),
    hasTherapistPreference: Boolean(document.querySelector("#preferred-therapist")),
    path: window.location.pathname,
    hash: window.location.hash,
    search: window.location.search,
    campaign: sessionStorage.getItem("valisen:first-touch-attribution:v1"),
    clicks: sessionStorage.getItem("valisen:first-touch-google-click:v1"),
  }));
  assert(
    handoff.hasFullName &&
      handoff.hasEmail &&
      handoff.hasPhone &&
      handoff.hasAvailability &&
      !handoff.hasTherapistPreference,
    "The simplified in-page consultation form is incomplete",
  );
  assert(
    handoff.path === "/welcome" && handoff.hash === "#contact",
    "The consultation CTA left the landing page",
  );
  assert(
    handoff.campaign?.includes('"source":"google"') &&
      handoff.clicks?.includes('"gclid":"handoff-click"'),
    "First-party attribution did not survive the consultation handoff",
  );
  await handoffPage.close();

  const removedPage = await browser.newPage();
  for (const removedRoute of removedRoutes) {
    const response = await removedPage.goto(`${baseUrl}${removedRoute}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    assert(
      response?.status() === 404,
      `${removedRoute} still resolves instead of returning 404`,
    );
  }
  await removedPage.close();

  process.stdout.write(
    `Universal Google Ads landing QA passed for ${viewports.length} viewports. Screenshots: ${outputDir}\n`,
  );
} finally {
  await browser.close();
}
