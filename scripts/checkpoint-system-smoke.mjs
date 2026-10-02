import fs from "node:fs/promises";
import path from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import puppeteer from "puppeteer";
import QRCode from "qrcode";

const baseUrl = process.env.SITE_URL || "http://localhost:3000";
const adminPassword = process.env.CHECKPOINT_QA_ADMIN_PASSWORD || "";
const adminSessionSecret = process.env.CHECKPOINT_QA_ADMIN_SESSION_SECRET || "";
const adminOnly = process.env.CHECKPOINT_QA_ADMIN_ONLY === "1";
const outputDir = path.resolve("artifacts", "checkpoints");

const codes = Array.from({ length: 25 }, (_, index) =>
  `VMH-${String(index + 1).padStart(2, "0")}`,
);
const events = [
  ["session", 260],
  ["checkin_started", 212],
  ["checkin_completed", 168],
  ["result_viewed", 165],
  ["therapist_cta_clicked", 48],
  ["consultation_started", 23],
  ["consultation_submitted", 11],
].map(([event, count]) => ({ event, count }));

const questionSteps = [
  { stepNumber: 1, reached: 212, completed: 198, dropOffs: 14, completionRate: 93.4, dropOffRate: 6.6 },
  { stepNumber: 2, reached: 198, completed: 188, dropOffs: 10, completionRate: 94.9, dropOffRate: 5.1 },
  { stepNumber: 3, reached: 188, completed: 176, dropOffs: 12, completionRate: 93.6, dropOffRate: 6.4 },
  { stepNumber: 4, reached: 176, completed: 168, dropOffs: 8, completionRate: 95.5, dropOffRate: 4.5 },
];

function kpis(multiplier = 1) {
  const sessions = Math.round(26 * multiplier);
  const started = Math.round(21 * multiplier);
  const completed = Math.round(17 * multiplier);
  const consultations = Math.round(1.2 * multiplier);
  return {
    sessions,
    checkinsStarted: started,
    checkinsCompleted: completed,
    completionRate: started ? Math.round((completed / started) * 1000) / 10 : 0,
    resultViews: completed,
    therapistIntent: Math.round(5 * multiplier),
    consultationsStarted: Math.round(2.4 * multiplier),
    consultationsSubmitted: consultations,
    sessionToConsultationRate: sessions
      ? Math.round((consultations / sessions) * 1000) / 10
      : 0,
    externalBookingClicks: Math.round(multiplier),
  };
}

const generatedAt = "2026-08-06T18:30:00.000Z";
function dateString(start, offset) {
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
const dateRange = {
  from: "2026-07-08T04:00:00.000Z",
  to: generatedAt,
};
const checkpoints = codes.map((code, index) => ({
  code,
  status: "active",
  createdAt: "2026-07-01T14:00:00.000Z",
  currentPlacement: {
    id: `2f310000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    partnerName: index === 2 ? "North & Pine Coffee" : `Partner ${index + 1}`,
    locationName: index === 2 ? "Centretown · Front counter" : `Ottawa location ${index + 1}`,
    startedAt: "2026-07-20T14:00:00.000Z",
  },
  ...kpis(0.55 + index * 0.13),
  sparkline: Array.from({ length: 14 }, (_, day) => ({
    date: dateString("2026-07-24", day),
    sessions: (day * (index + 2)) % 8,
  })),
}));

const dashboardFixture = {
  generatedAt,
  range: dateRange,
  kpis: {
    sessions: 260,
    checkinsStarted: 212,
    checkinsCompleted: 168,
    completionRate: 79.2,
    resultViews: 165,
    therapistIntent: 48,
    consultationsStarted: 23,
    consultationsSubmitted: 11,
    sessionToConsultationRate: 4.2,
    externalBookingClicks: 8,
  },
  funnel: events,
  questionSteps,
  checkpoints,
  leads: [
    {
      referenceId: "VC-QA00000001",
      checkpointCode: "VMH-04",
      partnerName: "North & Pine Coffee",
      locationName: "Centretown · Front counter",
      source: "mental_battery_checkpoint",
      status: "submitted",
      submittedAt: "2026-08-06T15:20:00.000Z",
    },
  ],
};

const daily = Array.from({ length: 30 }, (_, index) => ({
  date: dateString("2026-07-08", index),
  sessions: (index * 3) % 11,
  checkinsStarted: (index * 2) % 9,
  checkinsCompleted: (index * 2) % 7,
  therapistIntent: index % 4,
  consultationsSubmitted: index % 8 === 0 ? 1 : 0,
}));
function detailFixtureFor(code) {
  const detailCheckpoint = checkpoints.find((checkpoint) => checkpoint.code === code);
  if (!detailCheckpoint) throw new Error(`Unknown fixture checkpoint ${code}`);
  return {
  generatedAt,
  range: dateRange,
  checkpoint: {
    code: detailCheckpoint.code,
    status: detailCheckpoint.status,
    createdAt: detailCheckpoint.createdAt,
    currentPlacement: detailCheckpoint.currentPlacement,
  },
  kpis: detailCheckpoint,
  cumulativeKpis: kpis(2.8),
  funnel: events.map((stage) => ({
    ...stage,
    count: Math.max(0, Math.round(stage.count / 10)),
  })),
  questionSteps: questionSteps.map((step) => ({
    ...step,
    reached: Math.max(1, Math.round(step.reached / 10)),
    completed: Math.max(0, Math.round(step.completed / 10)),
    dropOffs: Math.max(0, Math.round(step.dropOffs / 10)),
  })),
  placements: [
    {
      id: "3f310000-0000-4000-8000-000000000004",
      partnerName: "Scheduled Partner",
      locationName: "Future placement",
      locationNotes: "QA fixture only",
      placementStatus: "assigned",
      timelineStatus: "scheduled",
      startedAt: "2026-08-20T14:00:00.000Z",
      endedAt: null,
      sessions: 0,
      checkinsCompleted: 0,
      therapistIntent: 0,
      consultationsSubmitted: 0,
      sessionToConsultationRate: 0,
    },
    {
      ...detailCheckpoint.currentPlacement,
      locationNotes: "QA fixture only",
      placementStatus: "assigned",
      timelineStatus: "current",
      endedAt: "2026-08-20T14:00:00.000Z",
    },
    {
      id: "1f310000-0000-4000-8000-000000000004",
      partnerName: "Earlier Partner",
      locationName: "Previous placement",
      placementStatus: "assigned",
      timelineStatus: "historical",
      startedAt: "2026-07-01T14:00:00.000Z",
      endedAt: "2026-07-20T14:00:00.000Z",
    },
  ],
  daily,
  dayOfWeek: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ].map((day, index) => ({
    day,
    sessions: index + 3,
    checkinsCompleted: index + 1,
    therapistIntent: index % 3,
    consultationsSubmitted: index === 4 ? 2 : 0,
  })),
  leads: dashboardFixture.leads.filter((lead) => lead.checkpointCode === code),
  };
}

function createAdminSessionToken(secret) {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("CHECKPOINT_QA_ADMIN_SESSION_SECRET must be at least 32 bytes.");
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    sub: "checkpoint-admin",
    iat: issuedAt,
    exp: issuedAt + 8 * 60 * 60,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const unsigned = `v1.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

await fs.mkdir(outputDir, { recursive: true });
const chromeProfile = await fs.mkdtemp(path.join(outputDir, "chrome-profile-"));
const browser = await puppeteer.launch({
  headless: true,
  timeout: 60_000,
  ignoreHTTPSErrors: true,
  userDataDir: chromeProfile,
  args: [
    "--disable-breakpad",
    "--disable-crash-reporter",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-sandbox",
    `--unsafely-treat-insecure-origin-as-secure=${baseUrl}`,
  ],
});

function installDiagnostics(page, state) {
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (!request.url().includes("googletagmanager")) {
      state.failedRequests.push(`${request.method()} ${request.url()}`);
    }
  });
}

async function auditLayout(page, label) {
  const audit = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .flatMap((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.right <= width + 1 && rect.left >= -1) return [];
        return [{
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className.slice(0, 100) : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        }];
      })
      .slice(0, 8);
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: width,
      offenders,
    };
  });
  if (audit.scrollWidth > audit.clientWidth + 1) {
    throw new Error(`${label} has horizontal overflow: ${JSON.stringify(audit)}`);
  }
}

async function intercept(page, state) {
  // Chromium does not expose Blob beacon bodies through request.postData.
  // Observe the original payload without replacing beacon delivery.
  await page.exposeFunction("checkpointQaBeacon", (payload) => {
    state.eventBodies.push(JSON.parse(payload));
  });
  await page.evaluateOnNewDocument(() => {
    const sendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (new URL(url, location.href).pathname === "/api/checkpoint-events" && data instanceof Blob) {
        void data.text().then((payload) => window.checkpointQaBeacon(payload));
      }
      return sendBeacon(url, data);
    };
  });
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/consultation-slots") {
      void request.respond({ status: 200, contentType: "application/json", body: '{"booked":[],"calendarVersion":"therapist-capacity-v2"}' });
      return;
    }
    if (url.pathname === "/api/funnel-events") {
      void request.respond({ status: 204, body: "" });
      return;
    }
    if (url.pathname === "/api/checkpoint-events") {
      try {
        if (request.resourceType() !== "ping") {
          const postData = request.postData() ?? await request.fetchPostData();
          state.eventBodies.push(JSON.parse(postData || "{}"));
        }
      } catch {
        state.eventBodies.push({ invalid: true });
      }
      void request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          placementId: "2f310000-0000-4000-8000-000000000001",
        }),
      });
      return;
    }
    if (url.pathname === "/api/checkpoint-attribution-retry") {
      state.attributionRepairAttempts =
        (state.attributionRepairAttempts ?? 0) + 1;
      void request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          checkpointAttributionSaved: true,
        }),
      });
      return;
    }
    if (url.pathname === "/api/admin/checkpoints/dashboard") {
      void request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: dashboardFixture }),
      });
      return;
    }
    if (url.pathname === "/api/admin/checkpoints/reporting-periods") {
      void request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({
        data: { section: "checkpoints", activeSince: "2026-08-01T00:00:00.000Z", archives: [] },
      }) });
      return;
    }
    const detailCode = url.pathname.match(/^\/api\/admin\/checkpoints\/(VMH-\d{2})$/)?.[1];
    if (detailCode && codes.includes(detailCode) && request.method() === "GET") {
      void request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: detailFixtureFor(detailCode) }),
      });
      return;
    }
    if (
      url.hostname.includes("googletagmanager.com") ||
      url.hostname.includes("google-analytics.com") ||
      url.hostname.includes("googleadservices.com")
    ) {
      state.marketingRequests.push(request.url());
      void request.abort();
      return;
    }
    void request.continue();
  });
}

async function waitForEvent(state, event, code) {
  const deadline = Date.now() + 10_000;
  while (!state.eventBodies.some((body) => body.event === event && body.checkpointCode === code)) {
    if (Date.now() >= deadline) throw new Error(`${code} did not emit ${event}.`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
}

async function auditCheckpointRoutes() {
  for (const [index, code] of codes.entries()) {
    console.log(`Auditing ${code}${index >= 10 ? " through consultation handoff" : " landing"}...`);
    const page = await browser.newPage();
    const state = {
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      eventBodies: [],
      marketingRequests: [],
    };
    try {
      installDiagnostics(page, state);
      await intercept(page, state);
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
      const response = await page.goto(`${baseUrl}/c/${code}`, {
        waitUntil: "networkidle2",
        timeout: 60_000,
      });
      if (response?.status() !== 200) throw new Error(`${code} returned ${response?.status()}.`);
      await page.waitForFunction(
        (expectedCode) => document.querySelector("footer")?.textContent?.includes(`Checkpoint ${expectedCode}`),
        {},
        code,
      );
      await waitForEvent(state, "landing_view", code);
      const robots = await page.$eval('meta[name="robots"]', (meta) => meta.getAttribute("content"));
      if (!robots?.includes("noindex") || !robots.includes("nofollow")) {
        throw new Error(`${code} is missing its private search indexing policy.`);
      }
      await auditLayout(page, `${code}-landing-390`);

      // Exercise every newly added code using the unchanged four-question quiz.
      // Network writes are mocked; this verifies client attribution and event
      // contracts without adding synthetic sessions or leads to the database.
      if (index >= 10) {
        await page.click("button");
        for (let step = 1; step <= 4; step += 1) {
          await page.waitForFunction(
            (expectedStep) => new RegExp(`${expectedStep} of 4`).test(document.body.innerText) &&
              Boolean(document.querySelector("fieldset button:not([disabled])")),
            {},
            step,
          );
          const buttons = await page.$$("fieldset button");
          await buttons[step === 4 ? 3 : index % buttons.length].click();
        }
        await page.waitForSelector('a[href="/consultation?source=mental_battery_checkpoint"]');
        await waitForEvent(state, "result_viewed", code);
        await auditLayout(page, `${code}-result-390`);
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60_000 }),
          page.click('a[href="/consultation?source=mental_battery_checkpoint"]'),
        ]);
        await page.waitForSelector("form");
        await waitForEvent(state, "consultation_started", code);

        const context = await page.evaluate(() =>
          JSON.parse(sessionStorage.getItem("valisen.mental-battery.session.v1") || "null"),
        );
        if (
          context?.checkpointCode !== code ||
          context?.sessionId !== state.eventBodies[0]?.sessionId ||
          context?.placementId !== "2f310000-0000-4000-8000-000000000001"
        ) {
          throw new Error(`${code} did not preserve its anonymous attribution during consultation handoff.`);
        }
        const expectedEvents = [
          "landing_view", "checkin_started", "checkin_completed", "result_viewed",
          "intent_talk_soon_selected", "consultation_cta_clicked", "therapist_cta_clicked",
          "consultation_started",
        ];
        for (const event of expectedEvents) {
          const count = state.eventBodies.filter((body) => body.event === event).length;
          if (count !== 1) throw new Error(`${code} emitted ${count} ${event} events instead of one: ${JSON.stringify(state.eventBodies)}`);
        }
        const stepEvents = state.eventBodies.filter((body) => body.event === "checkin_step_completed");
        if (stepEvents.length !== 4 || stepEvents.some((body, step) => body.stepNumber !== step + 1)) {
          throw new Error(`${code} did not track each of its four steps exactly once.`);
        }
      }

      const sessionIds = new Set(state.eventBodies.map((body) => body.sessionId));
      const eventIds = new Set(state.eventBodies.map((body) => body.eventId));
      if (sessionIds.size !== 1 || eventIds.size !== state.eventBodies.length) {
        throw new Error(`${code} emitted duplicate event IDs or changed its tracking session.`);
      }
      for (const body of state.eventBodies) {
        if (
          body.checkpointCode !== code ||
          Object.keys(body).some((key) => !["checkpointCode", "event", "eventId", "sessionId", "stepNumber"].includes(key))
        ) {
          throw new Error(`${code} emitted unexpected attribution or event fields: ${JSON.stringify(body)}`);
        }
      }
      if (state.marketingRequests.length || state.consoleErrors.length || state.pageErrors.length) {
        throw new Error(`${code} browser/privacy audit failed: ${JSON.stringify(state)}`);
      }
    } finally {
      await page.close();
    }
  }
}

try {
  if (!adminOnly) await auditCheckpointRoutes();
  for (const width of adminOnly ? [] : [375, 390, 430, 1440]) {
    console.log(`Auditing public checkpoint at ${width}px...`);
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    page.setDefaultTimeout(60_000);
    const state = {
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      eventBodies: [],
      marketingRequests: [],
      attributionRepairAttempts: 0,
    };
    installDiagnostics(page, state);
    await intercept(page, state);
    await page.setViewport({ width, height: width < 600 ? 844 : 1000, deviceScaleFactor: 1 });
    const response = await page.goto(`${baseUrl}/c/VMH-01`, {
      waitUntil: "networkidle2",
      timeout: 60_000,
    });
    if (response?.status() !== 200) throw new Error(`VMH-01 returned ${response?.status()}`);
    await page.waitForSelector("main h1");
    await auditLayout(page, `checkpoint-${width}-landing`);
    await page.click("button");

    let firstUnansweredStep = 0;
    if (width === 375) {
      await page.waitForSelector("fieldset button");
      await page.evaluate(() => {
        const answer = document.querySelector("fieldset button");
        if (!(answer instanceof HTMLButtonElement)) throw new Error("Answer button missing");
        answer.click();
        answer.click();
      });
      await page.waitForFunction(() => document.body.innerText.includes("Question 2 of 4"));
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      const firstStepEvents = state.eventBodies.filter(
        (body) => body.event === "checkin_step_completed" && body.stepNumber === 1,
      );
      if (firstStepEvents.length !== 1) {
        throw new Error(`Rapid double tap emitted ${firstStepEvents.length} first-step events.`);
      }
      firstUnansweredStep = 1;
    }

    const intentIndexByWidth = { 375: 0, 390: 3, 430: 1, 1440: 2 };
    const expectedPrimaryByWidth = {
      375: { label: "Explore therapist options", href: "/therapists", strong: false },
      390: { label: "Book a free consultation", href: "/consultation?source=mental_battery_checkpoint", strong: true },
      430: { label: "Find my therapist match", href: "/quiz", strong: false },
      1440: { label: "Find my therapist match", href: "/quiz", strong: true },
    };

    for (let step = firstUnansweredStep; step < 4; step += 1) {
      console.log(`  answering step ${step + 1}`);
      await page.waitForSelector("fieldset button:not([disabled])");
      const buttons = await page.$$("fieldset button");
      const answerIndex = step === 3
        ? intentIndexByWidth[width]
        : Math.min(step, buttons.length - 1);
      const promptBefore = await page.$eval("fieldset legend", (legend) => legend.textContent);
      await buttons[answerIndex].click();
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      const selectionAudit = await page.evaluate((expectedPrompt) => ({
        prompt: document.querySelector("fieldset legend")?.textContent,
        selected: document.querySelectorAll('fieldset button[aria-pressed="true"]').length,
        disabled: Array.from(document.querySelectorAll("fieldset button")).every(
          (button) => button instanceof HTMLButtonElement && button.disabled,
        ),
        expectedPrompt,
      }), promptBefore);
      if (
        selectionAudit.prompt !== selectionAudit.expectedPrompt ||
        selectionAudit.selected !== 1 ||
        !selectionAudit.disabled
      ) {
        throw new Error(
          `checkpoint-${width} did not hold the selected state before auto-advance: ${JSON.stringify(selectionAudit)}`,
        );
      }
      if (step < 3) {
        await page.waitForFunction(
          (nextStep) => document.body.innerText.includes(
            nextStep === 4 ? "Final step · 4 of 4" : `Question ${nextStep} of 4`,
          ),
          {},
          step + 2,
        );
      }
    }

    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("h1")).some((heading) =>
        /Charged|Steady|Running Low|Needs a Recharge/.test(heading.textContent || ""),
      ),
    );
    console.log("  result rendered");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 800));
    const batteryReveal = await page.evaluate(() => {
      const gauge = Array.from(document.querySelectorAll('[role="img"]')).find(
        (element) => /visual battery level/.test(element.getAttribute("aria-label") || ""),
      );
      const fill = gauge?.querySelector('div[style*="width"]');
      const track = fill?.parentElement;
      if (!(fill instanceof HTMLElement) || !(track instanceof HTMLElement)) return null;
      const target = Number((gauge?.getAttribute("aria-label") || "").match(/(\d+)%/)?.[1]);
      const displayed = (fill.getBoundingClientRect().width / track.getBoundingClientRect().width) * 100;
      return { displayed, target };
    });
    if (
      !batteryReveal ||
      !Number.isFinite(batteryReveal.target) ||
      Math.abs(batteryReveal.displayed - batteryReveal.target) > 1
    ) {
      throw new Error(
        `checkpoint-${width} result battery did not finish its reveal: ${JSON.stringify(batteryReveal)}`,
      );
    }
    await auditLayout(page, `checkpoint-${width}-result`);
    const resultAudit = await page.evaluate((expectedPrimary) => ({
      focusedResult: /Charged|Steady|Running Low|Needs a Recharge/.test(document.activeElement?.textContent || ""),
      primaryCta: Array.from(document.querySelectorAll("a")).some((anchor) => {
        const isExpected =
          anchor.textContent?.includes(expectedPrimary.label) &&
          anchor.getAttribute("href") === expectedPrimary.href;
        const isStrong = anchor.classList.contains("bg-white");
        return isExpected && isStrong === expectedPrimary.strong;
      }),
      supportEyebrow: document.body.innerText.includes("IF YOU’D LIKE SOME SUPPORT"),
      structuredSuggestions:
        document.body.innerText.includes("Take five") &&
        document.body.innerText.includes("Make some room"),
      stored: Object.entries(sessionStorage).map(([key, value]) => `${key}:${value}`).join("\n"),
    }), expectedPrimaryByWidth[width]);
    if (
      !resultAudit.focusedResult ||
      !resultAudit.primaryCta ||
      !resultAudit.supportEyebrow ||
      !resultAudit.structuredSuggestions
    ) {
      throw new Error(`checkpoint-${width} result focus/CTA failed: ${JSON.stringify(resultAudit)}`);
    }
    if (/fully charged|overwhelmed|nearly empty|answer|score/i.test(resultAudit.stored)) {
      throw new Error(`checkpoint-${width} stored an answer or score.`);
    }
    for (const body of state.eventBodies) {
      const keys = Object.keys(body).sort();
      if (keys.some((key) => !["checkpointCode", "event", "eventId", "sessionId", "stepNumber"].includes(key))) {
        throw new Error(`checkpoint-${width} emitted an unexpected event field: ${JSON.stringify(body)}`);
      }
    }
    if (state.marketingRequests.length) {
      throw new Error(`checkpoint-${width} attempted marketing requests: ${state.marketingRequests.join(", ")}`);
    }
    if (state.consoleErrors.length || state.pageErrors.length) {
      throw new Error(`checkpoint-${width} browser errors: ${JSON.stringify(state)}`);
    }
    await page.screenshot({
      path: path.join(outputDir, `public-${width}.png`),
      fullPage: true,
    });
    if (width === 390) {
      const [handoffResponse] = await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60_000 }),
        page.click('a[href="/consultation?source=mental_battery_checkpoint"]'),
      ]);
      const handoffCsp = handoffResponse?.headers()["content-security-policy"] || "";
      if (
        new URL(page.url()).pathname !== "/consultation" ||
        /frame-src\s+'none'/i.test(handoffCsp)
      ) {
        throw new Error(
          `Checkpoint consultation handoff retained the private checkpoint CSP: ${handoffCsp}`,
        );
      }
      await page.waitForSelector("form");
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      if (state.marketingRequests.length) {
        throw new Error(
          `Checkpoint consultation handoff attempted marketing requests: ${state.marketingRequests.join(", ")}`,
        );
      }

      // A confirmed consultation whose database attribution was temporarily
      // unavailable resumes from an opaque, non-PII token and repairs without
      // submitting the form or sending another email.
      await page.evaluate(() => {
        sessionStorage.setItem(
          "valisen.mental-battery.attribution-repair.v1",
          JSON.stringify({
            version: 1,
            repairToken: "qa.opaque-checkpoint-attribution-repair-token.signature",
          }),
        );
      });
      await page.reload({ waitUntil: "networkidle2" });
      await page.waitForFunction(() =>
        document.body.innerText.includes("Your request is in."),
      );
      await page.waitForFunction(
        () => document.body.innerText.includes("Anonymous checkpoint source linked"),
        { timeout: 10_000 },
      );
      if (state.attributionRepairAttempts !== 1) {
        throw new Error(
          `Checkpoint attribution recovery made ${state.attributionRepairAttempts} requests instead of one.`,
        );
      }
      const recoveredStorage = await page.evaluate(() =>
        Object.entries(sessionStorage)
          .map(([key, value]) => `${key}:${value}`)
          .join("\n"),
      );
      if (/attribution-repair|mental-battery\.session/.test(recoveredStorage)) {
        throw new Error("Checkpoint attribution recovery did not clear session-only repair state.");
      }
      await auditLayout(page, "checkpoint-consultation-attribution-recovered-390");
      await page.screenshot({
        path: path.join(outputDir, "consultation-attribution-recovered-390.png"),
        fullPage: true,
      });
    }
    await page.close();
  }

  const unknownPage = await browser.newPage();
  await unknownPage.setCacheEnabled(false);
  const unknownResponse = await unknownPage.goto(`${baseUrl}/c/VMH-26`, {
    waitUntil: "domcontentloaded",
  });
  if (unknownResponse?.status() !== 404) {
    throw new Error(`Unknown checkpoint returned ${unknownResponse?.status()} instead of 404.`);
  }
  await unknownPage.close();

  if (adminSessionSecret || adminPassword) {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    let localAdminSessionCookie = "";
    const state = {
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      eventBodies: [],
      marketingRequests: [],
    };
    installDiagnostics(page, state);
    await intercept(page, state);
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (
        url.pathname === "/api/admin/checkpoints/session" &&
        response.request().method() === "POST"
      ) {
        localAdminSessionCookie = response.headers()["set-cookie"]?.split(";")[0] || "";
      }
    });
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    if (adminSessionSecret) {
      // Browser QA uses the same signed-cookie format as production without
      // weakening Turnstile or depending on an external challenge in CI.
      localAdminSessionCookie = `__Host-vmh_checkpoint_admin=${createAdminSessionToken(adminSessionSecret)}`;
      await page.setExtraHTTPHeaders({ Cookie: localAdminSessionCookie });
      await page.goto(`${baseUrl}/admin/checkpoints`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    } else {
      await page.goto(`${baseUrl}/admin/login`, { waitUntil: "networkidle2", timeout: 60_000 });
      await page.type('input[name="password"]', adminPassword);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60_000 }),
        page.click('button[type="submit"]'),
      ]);
      if (!page.url().includes("/admin/checkpoints") && localAdminSessionCookie) {
        // Secure `__Host-` cookies are intentionally rejected by browsers over
        // HTTP. Send the server-issued token as a raw request header locally.
        await page.setExtraHTTPHeaders({ Cookie: localAdminSessionCookie });
        await page.goto(`${baseUrl}/admin/checkpoints`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
      }
    }
    if (!page.url().includes("/admin/checkpoints")) {
      const message = await page.$eval("body", (body) => body.innerText.slice(0, 500));
      throw new Error(`Admin sign-in did not redirect: ${page.url()}\n${message}`);
    }
    await page.waitForFunction(() => document.body.innerText.includes("Checkpoint comparison"), { timeout: 60_000 });
    await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/admin/checkpoints/dashboard"),
      page.click('button[aria-label="Refresh checkpoint analytics"]'),
    ]);
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll('section[aria-labelledby="checkpoint-grid-title"] article').length === expectedCount,
      {},
      codes.length,
    );
    const dashboardAudit = await page.evaluate((expectedCodes) => {
      const fleet = document.querySelector('section[aria-labelledby="checkpoint-grid-title"]');
      const comparison = document.querySelector('section[aria-labelledby="comparison-title"]');
      return {
        cards: fleet?.querySelectorAll("article").length,
        rows: comparison?.querySelectorAll("tbody tr").length,
        missingControls: expectedCodes.filter((code) =>
          !fleet?.querySelector(`a[href="/admin/checkpoints/${code}"]`) ||
          !fleet.querySelector(`a[href="/api/admin/checkpoints/${code}/qr"]`) ||
          !fleet.querySelector(`button[aria-label="Copy permanent URL for ${code}"]`) ||
          !fleet.querySelector(`button[aria-label="Move ${code}"]`)),
      };
    }, codes);
    if (dashboardAudit.cards !== codes.length || dashboardAudit.rows !== codes.length || dashboardAudit.missingControls.length) {
      throw new Error(`Checkpoint CRM fleet is incomplete: ${JSON.stringify(dashboardAudit)}`);
    }

    for (const width of [1366, 1440, 1920]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await auditLayout(page, `admin-dashboard-${width}`);
      await page.screenshot({
        path: path.join(outputDir, `admin-dashboard-${width}.png`),
        fullPage: true,
      });
    }

    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    for (const code of ["VMH-04", ...codes.slice(10)]) {
      console.log(`Auditing CRM detail for ${code}...`);
      await page.goto(`${baseUrl}/admin/checkpoints/${code}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.waitForFunction(() => document.body.innerText.includes("Placement history"), { timeout: 60_000 });
      await page.waitForFunction((expectedCode) =>
        document.querySelector("main h1")?.textContent === expectedCode &&
        document.body.innerText.includes(`https://valisenmentalhealth.com/c/${expectedCode}`) &&
        Boolean(document.querySelector(`a[href="/api/admin/checkpoints/${expectedCode}/qr"]`)),
      {}, code);
      await auditLayout(page, `admin-detail-${code}-1440`);
      if (code === "VMH-04" || code === "VMH-25") {
        await page.screenshot({
          path: path.join(outputDir, `admin-detail-${code}-1440.png`),
          fullPage: true,
        });
      }
    }

    // These requests reach the real authenticated QR API (not the fixtures).
    // Verify that every generated SVG encodes its permanent production URL.
    for (const code of codes) {
      const response = await fetch(`${baseUrl}/api/admin/checkpoints/${code}/qr`, {
        headers: { Cookie: localAdminSessionCookie },
      });
      const expectedSvg = await QRCode.toString(`https://valisenmentalhealth.com/c/${code}`, {
        type: "svg", errorCorrectionLevel: "H", margin: 4, width: 1024,
        color: { dark: "#153F3EFF", light: "#FFFFFFFF" },
      });
      if (
        response.status !== 200 ||
        !response.headers.get("content-type")?.includes("image/svg+xml") ||
        !response.headers.get("content-disposition")?.includes(`${code}-mental-battery-qr.svg`) ||
        await response.text() !== expectedSvg
      ) {
        throw new Error(`${code} did not return its canonical authenticated QR download.`);
      }
    }
    if (state.marketingRequests.length) {
      throw new Error(`Admin attempted marketing requests: ${state.marketingRequests.join(", ")}`);
    }
    if (state.consoleErrors.length || state.pageErrors.length) {
      throw new Error(`Admin browser errors: ${JSON.stringify(state)}`);
    }
    await page.close();
  } else {
    console.warn(
      "Skipped authenticated admin screenshots: set CHECKPOINT_QA_ADMIN_SESSION_SECRET or CHECKPOINT_QA_ADMIN_PASSWORD.",
    );
  }
} finally {
  try {
    await browser.close();
  } finally {
    await fs.rm(chromeProfile, { recursive: true, force: true });
  }
}

console.log(`Checkpoint QA passed. Screenshots saved to ${outputDir}`);
