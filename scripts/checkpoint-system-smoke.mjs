import fs from "node:fs/promises";
import path from "node:path";
import { createHmac, randomBytes } from "node:crypto";
import puppeteer from "puppeteer";

const baseUrl = process.env.SITE_URL || "http://localhost:3000";
const adminPassword = process.env.CHECKPOINT_QA_ADMIN_PASSWORD || "";
const adminSessionSecret = process.env.CHECKPOINT_QA_ADMIN_SESSION_SECRET || "";
const outputDir = path.resolve("artifacts", "checkpoints");

const codes = Array.from({ length: 10 }, (_, index) =>
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
const detailCheckpoint = checkpoints[3];
const detailFixture = {
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
  leads: dashboardFixture.leads,
};

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
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/checkpoint-events") {
      try {
        state.eventBodies.push(JSON.parse(request.postData() || "{}"));
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
    if (url.pathname === "/api/admin/checkpoints/VMH-04" && request.method() === "GET") {
      void request.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: detailFixture }),
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

try {
  for (const width of [375, 390, 430, 1440]) {
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

    for (let step = firstUnansweredStep; step < 4; step += 1) {
      console.log(`  answering step ${step + 1}`);
      await page.waitForSelector("fieldset button");
      const buttons = await page.$$("fieldset button");
      await buttons[Math.min(step, buttons.length - 1)].click();
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }

    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("h1")).some((heading) =>
        /Charged|Steady|Running Low|Needs a Recharge/.test(heading.textContent || ""),
      ),
    );
    console.log("  result rendered");
    await auditLayout(page, `checkpoint-${width}-result`);
    const resultAudit = await page.evaluate(() => ({
      focusedResult: /Charged|Steady|Running Low|Needs a Recharge/.test(document.activeElement?.textContent || ""),
      primaryCta: Array.from(document.querySelectorAll("a")).some((anchor) =>
        anchor.textContent?.includes("Get matched with a therapist") &&
        anchor.getAttribute("href") === "/consultation?source=mental_battery_checkpoint",
      ),
      stored: Object.entries(sessionStorage).map(([key, value]) => `${key}:${value}`).join("\n"),
    }));
    if (!resultAudit.focusedResult || !resultAudit.primaryCta) {
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
  const unknownResponse = await unknownPage.goto(`${baseUrl}/c/VMH-11`, {
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

    for (const width of [1366, 1440, 1920]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await auditLayout(page, `admin-dashboard-${width}`);
      await page.screenshot({
        path: path.join(outputDir, `admin-dashboard-${width}.png`),
        fullPage: true,
      });
    }

    await page.goto(`${baseUrl}/admin/checkpoints/VMH-04`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForFunction(() => document.body.innerText.includes("Placement history"), { timeout: 60_000 });
    await auditLayout(page, "admin-detail-1440");
    await page.screenshot({
      path: path.join(outputDir, "admin-detail-1440.png"),
      fullPage: true,
    });
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
