import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const baseUrl = process.env.QUIZ_TEST_BASE_URL || "http://localhost:3000";
const submissionToken = `v1.VQ-SMOKETEST001.${"a".repeat(43)}`;
const referenceId = "VQ-SMOKETEST001";
const timJaneUrl =
  "https://valisenmentalhealth.janeapp.com/#/staff_member/5";
const timConsultationUrl =
  "/consultation?therapist=tim-kahtava&source=quiz_result";

const outcome = {
  scores: [
    { dimension: "worry", average: 2.5, answered: 3 },
    { dimension: "mood", average: 1.25, answered: 4 },
    { dimension: "stress", average: 1.5, answered: 4 },
    { dimension: "relationships", average: 1, answered: 2 },
  ],
  resultKey: "worry",
  ordered: ["worry", "stress", "mood", "relationships"],
  duration: "weeks",
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
  ],
  runnersUp: ["wilfred-bengnwi", "ryann-simpson", "dayong-quan"],
};

const intentRoutes = [
  {
    intent: "ready_to_speak",
    heading: "Your next step is ready",
    cta: "Request My Free Consultation",
  },
  {
    intent: "brief_consultation",
    heading: "A brief consultation is a good place to start",
    cta: "Request a Consultation with Tim",
  },
  {
    intent: "see_recommended_therapist",
    heading: "Meet your recommended therapist",
    cta: "Request a Consultation with Tim",
  },
  {
    intent: "exploring",
    heading: "Here’s what stood out in your answers",
    cta: "Request a Free Consultation",
  },
];

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    headers: { "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

async function delay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function bodyText(page) {
  return page.evaluate(
    () => document.querySelector("main")?.textContent?.replace(/\s+/g, " ") || "",
  );
}

async function waitForText(page, expected, timeout = 10_000) {
  await page.waitForFunction(
    (text) =>
      (document.querySelector("main")?.textContent || "")
        .replace(/\s+/g, " ")
        .includes(text),
    { timeout },
    expected,
  );
}

async function findButton(page, label) {
  const handle = await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll("button")].find(
        (button) =>
          button.textContent?.trim().replace(/\s+/g, " ") === expected,
      ),
    { timeout: 10_000 },
    label,
  );
  return handle.asElement();
}

async function findLink(page, label) {
  const handle = await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll("a")].find(
        (link) =>
          link.textContent?.trim().replace(/\s+/g, " ").startsWith(expected),
      ),
    { timeout: 10_000 },
    label,
  );
  return handle.asElement();
}

async function setInputValue(page, selector, value) {
  await page.$eval(
    selector,
    (input, nextValue) => {
      const prototype =
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      setter?.call(input, nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value,
  );
}

async function checkInput(page, selector) {
  await page.$eval(selector, (input) => {
    if (input instanceof HTMLInputElement && !input.checked) input.click();
  });
  await page.waitForFunction(
    (target) => Boolean(document.querySelector(target)?.checked),
    {},
    selector,
  );
}

async function selectButtonContaining(page, text) {
  await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll("button")].find((candidate) =>
        candidate.textContent?.replace(/\s+/g, " ").includes(expected),
      ),
    { timeout: 8_000 },
    text,
  );
  const clicked = await page.evaluate((expected) => {
    const button = [...document.querySelectorAll("button")].find((candidate) =>
      candidate.textContent?.replace(/\s+/g, " ").includes(expected),
    );
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  }, text);
  assert.equal(clicked, true, `Could not click the button containing “${text}”.`);
}

async function waitForQuestionAdvance(
  page,
  previousCounter,
  timeout = 6_000,
  expectedCounter,
) {
  await page.waitForFunction(
    (counter, nextCounter) => {
      const text = (document.querySelector("main")?.textContent || "").replace(
        /\s+/g,
        " ",
      );
      return nextCounter ? text.includes(nextCounter) : !text.includes(counter);
    },
    { timeout },
    previousCounter,
    expectedCounter,
  );
}

async function completeQuiz(page) {
  const headings = [];
  for (let step = 1; step <= 19; step += 1) {
    const counter = `Question ${step} of 19`;
    try {
      await waitForText(page, counter);
    } catch (error) {
      const state = await page.evaluate(() => ({
        url: window.location.href,
        text: document.querySelector("main")?.textContent?.replace(/\s+/g, " "),
        scripts: [...document.scripts].map((script) => script.src).filter(Boolean),
      }));
      throw new Error(
        `Quiz never reached ${counter}. State: ${JSON.stringify(state)}`,
        { cause: error },
      );
    }
    console.log(`Quiz UI smoke: ${counter}`);
    headings.push(
      await page.$eval("h2", (element) => element.textContent?.trim() || ""),
    );

    if (step === 16) {
      const previousViewport = page.viewport();
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
      await selectButtonContaining(page, "Anxiety or worry");
      const continueButton = await findButton(page, "Continue");
      await continueButton.click();
      await waitForQuestionAdvance(page, counter, 6_000, "Question 17 of 19");
      await page.waitForFunction(
        () => {
          const counter = [...document.querySelectorAll("span")].find(
            (element) => element.textContent?.trim() === "Question 17 of 19",
          );
          const rect = counter?.getBoundingClientRect();
          return Boolean(rect && rect.top >= 0 && rect.top < innerHeight / 2);
        },
        { timeout: 2_000 },
      );
      if (previousViewport) await page.setViewport(previousViewport);
      continue;
    }

    if (step === 18) {
      await selectButtonContaining(page, "Yes, some of the time");
      await waitForText(page, "Please reach out to someone who can help today");
      assert.equal(
        (await bodyText(page)).includes("Call or text 9-8-8"),
        true,
        "The local safety interstitial did not show crisis support.",
      );
      const continueButton = await findButton(page, "Continue");
      await continueButton.click();
      await waitForText(page, "Question 19 of 19");
      continue;
    }

    if (step === 19) {
      let intentError;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await selectButtonContaining(page, "I’m ready to speak with a therapist");
        try {
          await waitForText(page, "Your personalized results are ready", 2_500);
          intentError = undefined;
          break;
        } catch (error) {
          intentError = error;
        }
      }
      if (intentError) {
        const state = await page.evaluate(() => ({
          text: document.querySelector("main")?.textContent?.replace(/\s+/g, " "),
          selected: [...document.querySelectorAll('button[aria-pressed="true"]')].map(
            (button) => button.textContent?.replace(/\s+/g, " ").trim(),
          ),
        }));
        throw new Error(
          `Final intent did not reveal the access form. State: ${JSON.stringify(state)}`,
          { cause: intentError },
        );
      }
      break;
    }

    let advanceError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt === 0) {
        await page.click('button[aria-pressed="false"]');
      } else {
        await page.$eval('button[aria-pressed="false"]', (button) => button.click());
      }
      try {
        await waitForQuestionAdvance(
          page,
          counter,
          2_500,
          `Question ${step + 1} of 19`,
        );
        advanceError = undefined;
        break;
      } catch (error) {
        advanceError = error;
      }
    }
    if (advanceError) {
      const state = await page.evaluate(() => ({
        heading: document.querySelector("h2")?.textContent?.trim(),
        selected: [...document.querySelectorAll('button[aria-pressed="true"]')].map(
          (button) => button.textContent?.trim(),
        ),
        available: [...document.querySelectorAll('button[aria-pressed="false"]')].map(
          (button) => button.textContent?.trim(),
        ),
      }));
      throw new Error(
        `Quiz did not advance after ${counter}. State: ${JSON.stringify(state)}`,
        { cause: advanceError },
      );
    }
  }

  assert.equal(
    headings.some((heading) =>
      /Which language would you like therapy in|Mandarin \(普通话\)/i.test(heading),
    ),
    false,
    "The retired language question appeared in the visible flow.",
  );
  assert.equal(
    headings.at(-1),
    "What would feel most helpful as your next step?",
    "The intent question was not the final quiz question.",
  );
}

async function preventJaneNavigation(page) {
  await page.evaluate(() => {
    document.addEventListener(
      "click",
      (event) => {
        const link =
          event.target instanceof Element
            ? event.target.closest(
                'a[href*="valisenmentalhealth.janeapp.com"], a[href^="/consultation"]',
              )
            : null;
        if (link) event.preventDefault();
      },
      true,
    );
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const overflowState = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const offenders =
      overflow > 1
        ? [...document.querySelectorAll("body *")]
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName.toLowerCase(),
                className:
                  typeof element.className === "string"
                    ? element.className.slice(0, 160)
                    : "",
                text: (element.textContent || "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 100),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              };
            })
            .filter(
              (item) =>
                item.width > 0 &&
                (item.left < -1 || item.right > window.innerWidth + 1),
            )
            .slice(0, 12)
        : [];
    return { overflow, offenders };
  });
  assert.ok(
    overflowState.overflow <= 1,
    `${label} layout overflows horizontally by ${overflowState.overflow}px. Offenders: ${JSON.stringify(
      overflowState.offenders,
    )}`,
  );
}

async function assertRoute(page, route) {
  await waitForText(page, route.heading);
  const primaryLink = await findLink(page, route.cta);
  assert.equal(
    await primaryLink.evaluate((link) => link.getAttribute("href")),
    timConsultationUrl,
    `${route.intent} did not use Tim’s consultation request destination.`,
  );
  assert.equal(
    await primaryLink.evaluate((link) => link.getAttribute("target")),
    null,
  );
}

async function main() {
  console.log("Quiz UI smoke: launching browser");
  const browser = await puppeteer.launch({ headless: true });
  console.log("Quiz UI smoke: creating page");
  const page = await browser.newPage();
  page.setDefaultTimeout(12_000);
  page.setDefaultNavigationTimeout(15_000);
  await page.emulateTimezone("America/Toronto");
  page.on("pageerror", (error) =>
    console.error("Browser page error:", error.message),
  );
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      console.error(`Browser console ${message.type()}:`, message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      console.error(
        `Browser HTTP ${response.status()}: ${response.request().method()} ${response.url()}`,
      );
    }
  });
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  console.log("Quiz UI smoke: setting media and interception");
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);

  let accessCalls = 0;
  let contactCalls = 0;
  let pdfCalls = 0;
  let restoreCalls = 0;
  let currentRestoreIntent = "ready_to_speak";
  let contactWasSent = false;
  const accessPayloads = [];
  const contactPayloads = [];
  const pdfPayloads = [];
  const restorePayloads = [];
  const engagementPayloads = [];
  const funnelPayloads = [];

  await page.setRequestInterception(true);
  console.log("Quiz UI smoke: interception ready");
  page.on("request", (request) => {
    void (async () => {
      const url = new URL(request.url());
      if (
        url.hostname === "challenges.cloudflare.com" &&
        url.pathname === "/turnstile/v0/api.js"
      ) {
        await request.respond({
          status: 200,
          contentType: "application/javascript",
          body: `(() => {
            let sequence = 0;
            const byContainer = new Map();
            const byId = new Map();
            window.turnstile = {
              render(container, options) {
                const id = "quiz-smoke-widget-" + (++sequence);
                const entry = { id, container, options };
                byContainer.set(container, entry);
                byId.set(id, entry);
                if (options.execution === "render") {
                  setTimeout(() => options.callback("quiz-smoke-render-" + sequence), 0);
                }
                return id;
              },
              execute(container) {
                const entry = byContainer.get(container);
                if (!entry) return;
                const token = "quiz-smoke-" + entry.options.action + "-" + (++sequence);
                setTimeout(() => entry.options.callback(token), 0);
              },
              remove(id) {
                const entry = byId.get(id);
                if (!entry) return;
                byContainer.delete(entry.container);
                byId.delete(id);
              },
            };
          })();`,
        });
        return;
      }
      if (request.method() === "POST" && url.pathname === "/api/funnel-events") {
        funnelPayloads.push(JSON.parse(request.postData() || "{}"));
        await request.respond({ status: 204 });
        return;
      }
      if (request.method() === "POST" && url.pathname === "/api/quiz-lead") {
        accessCalls += 1;
        accessPayloads.push(JSON.parse(request.postData() || "{}"));
        if (accessCalls === 1) {
          // Keep the request in flight briefly so a rapid second click can be
          // used to verify the client-side duplicate-submission guard.
          await delay(220);
          await request.respond(
            jsonResponse(
              {
                ok: false,
                error: "We couldn’t save your results just now. Please try again.",
                retriable: true,
              },
              500,
            ),
          );
          return;
        }
        await request.respond(
          jsonResponse(
            {
              ok: true,
              referenceId,
              submissionToken,
              outcome,
              match,
              intent: "ready_to_speak",
              resultsEmailSent: true,
              userResultsEmailSent: false,
              warnings: [
                "Your result is available here, but the results email could not be delivered yet.",
              ],
            },
            201,
          ),
        );
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === "/api/quiz-lead/result"
      ) {
        restoreCalls += 1;
        restorePayloads.push({
          payload: JSON.parse(request.postData() || "{}"),
          search: url.search,
        });
        await request.respond(
          jsonResponse({
            ok: true,
            firstName: "Alex",
            email: "alex@example.com",
            phone: "613-555-0100",
            referenceId,
            outcome,
            match,
            intent: currentRestoreIntent,
            contactHelpSent: contactWasSent,
            attribution: {
              source: "google",
              campaign: "calm-search",
            },
          }),
        );
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === "/api/quiz-lead/engagement"
      ) {
        const payload = JSON.parse(request.postData() || "{}");
        engagementPayloads.push(payload);
        await request.respond(
          jsonResponse({ ok: true, referenceId, event: payload.event }),
        );
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === "/api/quiz-lead/contact-consent"
      ) {
        contactCalls += 1;
        contactPayloads.push(JSON.parse(request.postData() || "{}"));
        if (contactCalls === 1) {
          await request.respond(
            jsonResponse(
              {
                ok: false,
                error: "We couldn’t send your contact request just now.",
                retriable: true,
              },
              502,
            ),
          );
          return;
        }
        contactWasSent = true;
        await request.respond(
          jsonResponse({
            ok: true,
            emailSent: true,
            referenceId,
          }),
        );
        return;
      }

      if (request.method() === "POST" && url.pathname === "/api/quiz-lead/pdf") {
        pdfCalls += 1;
        pdfPayloads.push(JSON.parse(request.postData() || "{}"));
        await request.respond({
          status: 200,
          contentType: "application/pdf",
          headers: {
            "Cache-Control": "no-store, private",
            "Content-Disposition":
              'attachment; filename="valisen-quiz-results-VQ-SMOKETEST001.pdf"',
          },
          body: "%PDF-1.4\n%%EOF\n",
        });
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

  try {
    console.log("Quiz UI smoke: loading quiz");
    await page.goto(
      `${baseUrl}/quiz?utm_source=google&utm_campaign=calm-search&utm_term=anxiety&gclid=private-click-id`,
      { waitUntil: "domcontentloaded" },
    );
    console.log("Quiz UI smoke: completing questions");
    await page.evaluate(() => {
      window.__quizSmokeDocumentMarker = "same-document";
    });

    await completeQuiz(page);
    console.log("Quiz UI smoke: validating results gate");
    await waitForText(page, "Your personalized results are ready");
    const gateText = await bodyText(page);
    for (const expectedConsentPhrase of [
      "recommended/matched therapist may contact me by email, phone, or text",
      "share my contact details and relevant quiz summary with that therapist",
      "will not be sold or used for unrelated marketing",
    ]) {
      assert.equal(
        gateText.includes(expectedConsentPhrase),
        true,
        `The required results-access consent omitted: ${expectedConsentPhrase}`,
      );
    }
    assert.equal(accessCalls, 0);
    assert.equal(contactCalls, 0);
    const resultsPhone = await page.$('input[autocomplete="tel"]');
    assert.ok(resultsPhone, "The required results-access phone field was missing.");
    assert.equal(
      await resultsPhone.evaluate((input) => input.required),
      true,
      "The results-access phone field was not required.",
    );

    const disabledViewResults = await findButton(page, "View My Results");
    assert.equal(
      await disabledViewResults.evaluate((button) => button.disabled),
      true,
    );

    await page.type('input[autocomplete="email"]', "not-an-email");
    await page.focus('input[autocomplete="given-name"]');
    await waitForText(page, "Please enter a valid email address.");

    await setInputValue(page, 'input[autocomplete="given-name"]', "Alex");
    await setInputValue(page, 'input[autocomplete="email"]', "alex@example.com");
    await setInputValue(page, 'input[autocomplete="tel"]', "613-555-0100");
    await page.focus('input[name="privacyAcknowledged"]');
    await page.keyboard.press("Space");
    await page.waitForFunction(() =>
      Boolean(document.querySelector('input[name="privacyAcknowledged"]')?.checked),
    );
    const enabledViewResults = await findButton(page, "View My Results");
    await enabledViewResults.click();
    await enabledViewResults.evaluate((button) => button.click());
    try {
      await waitForText(page, "We couldn’t save your results just now.");
    } catch (error) {
      const accessState = await page.evaluate(() => ({
        alert: document.querySelector('[role="alert"]')?.textContent?.trim() ?? null,
        button:
          Array.from(document.querySelectorAll("button"))
            .map((candidate) => ({
              disabled: candidate.disabled,
              text: candidate.textContent?.trim() ?? "",
            }))
            .find((candidate) =>
              /View My Results|Securing Your Results|Saving Your Results/.test(
                candidate.text,
              ),
            ) ?? null,
        hasTurnstileApi: typeof window.turnstile?.execute === "function",
      }));
      console.error("Quiz UI smoke: results-access failure state", {
        accessCalls,
        accessState,
      });
      throw error;
    }
    assert.equal(accessCalls, 1, "A rapid double click created two save requests.");
    assert.equal(contactCalls, 0);

    const retryResults = await findButton(page, "View My Results");
    await retryResults.click();
    await assertRoute(page, intentRoutes[0]);
    console.log("Quiz UI smoke: validating Jane CTAs and analytics");
    assert.equal(
      await page.evaluate(() => window.__quizSmokeDocumentMarker),
      "same-document",
      "The quiz reloaded instead of revealing results in place.",
    );
    assert.equal(accessCalls, 2);
    assert.equal(contactCalls, 0);
    assert.equal(accessPayloads[0].clientSubmissionId, accessPayloads[1].clientSubmissionId);
    assert.equal(accessPayloads[1].answers.intent, "ready_to_speak");
    assert.equal("intent" in accessPayloads[1], false);
    assert.equal(accessPayloads[1].phone, "613-555-0100");
    assert.match(
      accessPayloads[1].turnstileToken,
      /^quiz-smoke-quiz_results_access-/,
    );
    assert.notEqual(
      accessPayloads[0].turnstileToken,
      accessPayloads[1].turnstileToken,
      "A consumed results-access challenge was reused after a failed request.",
    );
    assert.equal(
      accessPayloads[1].privacyTextVersion,
      "2026-08-13.v5",
    );
    assert.match(
      accessPayloads[1].privacyLanguage,
      /staff or my recommended\/matched therapist may contact me by email, phone, or text/,
    );
    assert.equal("safety" in accessPayloads[1].answers, false);
    assert.equal("language" in accessPayloads[1].answers, false);
    assert.deepEqual(accessPayloads[1].attribution, {
      source: "google",
      campaign: "calm-search",
    });

    await preventJaneNavigation(page);
    const primaryConsultation = await findLink(page, "Request My Free Consultation");
    await primaryConsultation.click();
    await page.waitForFunction(
      () =>
        (window.dataLayer || []).some(
          (event) =>
            event?.event === "consultation_request_clicked" &&
            event?.cta_placement === "results_primary",
        ),
    );

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await delay(100);
    await assertNoHorizontalOverflow(page, "Mobile");
    await page.evaluate(() => {
      const primary = [...document.querySelectorAll('a[href^="/consultation"]')].find(
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
    try {
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("a")].some((link) => {
            if (
              !link.textContent
                ?.replace(/\s+/g, " ")
                .trim()
                .startsWith("Request a Free Consultation")
            ) {
              return false;
            }
            let element = link;
            while (element) {
              if (getComputedStyle(element).position === "fixed") return true;
              element = element.parentElement;
            }
            return false;
          }),
      );
    } catch (error) {
      const stickyState = await page.evaluate(() => ({
        scrollY,
        viewportHeight: innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        resultRect: document
          .querySelector("[data-quiz-results]")
          ?.getBoundingClientRect()
          .toJSON(),
        consultationLinks: [...document.querySelectorAll('a[href^="/consultation"]')].map(
          (link) => ({
            text: link.textContent?.replace(/\s+/g, " ").trim(),
            rect: link.getBoundingClientRect().toJSON(),
            parentPositions: [
              link,
              link.parentElement,
              link.parentElement?.parentElement,
            ].map((element) =>
              element ? getComputedStyle(element).position : null,
            ),
          }),
        ),
      }));
      throw new Error(
        `Mobile sticky CTA did not appear. State: ${JSON.stringify(stickyState)}`,
        { cause: error },
      );
    }
    const stickyLinks = await page.$$('a[aria-label="Request a free consultation"]');
    assert.ok(stickyLinks.length >= 1, "The mobile sticky consultation CTA did not appear.");
    await stickyLinks.at(-1).click();
    await page.waitForFunction(
      () =>
        (window.dataLayer || []).some(
          (event) =>
            event?.event === "consultation_request_clicked" &&
            event?.cta_placement === "mobile_sticky",
        ),
    );

    await page.evaluate(() => window.scrollTo(0, 0));
    await selectButtonContaining(page, "Share your time options");
    console.log("Quiz UI smoke: validating separate contact help");
    await waitForText(page, "Preferred contact method");
    await waitForText(
      page,
      "We already have the name, email address, and phone number you provided",
    );
    assert.equal(
      await page.$('a[aria-label="Request a free consultation"]'),
      null,
      "The sticky CTA remained visible over the contact-help form.",
    );

    const blankHelpSubmit = await findButton(page, "Review My Time Options");
    await blankHelpSubmit.click();
    await waitForText(page, "Choose how you would prefer to be contacted.");
    assert.equal(contactCalls, 0);

    await checkInput(page, 'input[name="contactMethod"][value="phone"]');
    const savedHelpPhone = await page.$('input[id$="-help-phone"]');
    assert.ok(savedHelpPhone, "The saved phone field was not shown for phone contact.");
    assert.equal(
      await savedHelpPhone.evaluate((input) => input.value),
      "613-555-0100",
      "The booking-help form did not reuse the phone already provided.",
    );
    const addTime = await findButton(page, "Add another time");
    await addTime.click();
    assert.equal(
      await page.$$eval('input[type="datetime-local"]', (inputs) => inputs.length),
      3,
      "The form did not allow a third proposed time.",
    );
    const removeThirdTime = await findButton(page, "Remove");
    await removeThirdTime.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")].filter(
        (button) => button.getAttribute("aria-label") === "Remove proposed time 3",
      );
      buttons[0]?.click();
    });
    assert.equal(
      await page.$$eval('input[type="datetime-local"]', (inputs) => inputs.length),
      2,
      "The form did not remove an extra proposed time.",
    );

    const proposedTimes = await page.evaluate(() =>
      [2, 3].map((daysAhead) => {
        const value = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1_000);
        value.setMinutes(
          value.getMinutes() + (15 - (value.getMinutes() % 15)) % 15,
        );
        value.setSeconds(0, 0);
        const pad = (part) => String(part).padStart(2, "0");
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
          value.getDate(),
        )}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
      }),
    );
    await setInputValue(page, 'input[id$="-help-time-0"]', proposedTimes[0]);
    await setInputValue(page, 'input[id$="-help-time-1"]', proposedTimes[0]);
    const duplicateTimesSubmit = await findButton(page, "Review My Time Options");
    await duplicateTimesSubmit.click();
    await waitForText(page, "Choose distinct dates and times for each option.");
    assert.equal(contactCalls, 0);
    await setInputValue(page, 'input[id$="-help-time-1"]', proposedTimes[1]);
    await setInputValue(
      page,
      "textarea",
      "Please call me if one of these proposed times can be confirmed.",
    );
    const contactConsent = await page.$(
      'input[type="checkbox"][aria-describedby*="help-consent-note"]',
    );
    assert.ok(contactConsent, "The separate contact consent checkbox was missing.");
    assert.equal(
      await contactConsent.evaluate((input) => input.checked),
      false,
      "The separate contact consent was pre-checked.",
    );
    await contactConsent.focus();
    await page.keyboard.press("Space");
    assert.equal(
      await contactConsent.evaluate((input) => input.checked),
      true,
      "The scheduling acknowledgement could not be selected by keyboard.",
    );

    const helpSubmit = await findButton(page, "Review My Time Options");
    await helpSubmit.click();
    await waitForText(page, "You can still choose a time now");
    await page.waitForFunction(
      () =>
        document.activeElement instanceof HTMLAnchorElement &&
        document.activeElement.textContent
          ?.replace(/\s+/g, " ")
          .includes("Choose a Time in Jane Now"),
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll('[role="dialog"]')].some(
          (dialog) => dialog.getAttribute("aria-modal") === "true",
        ),
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.activeElement?.textContent
            ?.replace(/\s+/g, " ")
            .trim() === "Review My Time Options",
      ),
      true,
      "Closing the Jane-first dialog did not restore keyboard focus.",
    );
    await helpSubmit.click();
    await waitForText(page, "You can still choose a time now");
    assert.equal(
      contactCalls,
      0,
      "Opening the Jane-first choice dialog prematurely sent contact details.",
    );
    const dialogJane = await findLink(page, "Choose a Time in Jane Now");
    assert.equal(
      await dialogJane.evaluate((link) => link.getAttribute("href")),
      timJaneUrl,
    );
    await dialogJane.click();
    const continueHelp = await findButton(page, "Send My Time Options");
    await continueHelp.click();
    await waitForText(page, "We couldn’t send your contact request just now.");
    assert.equal(contactCalls, 1);

    const editedRetryMessage =
      "Updated after the failed attempt; please call before confirming.";
    await setInputValue(page, "textarea", editedRetryMessage);
    const retryHelp = await findButton(page, "Review My Time Options");
    await retryHelp.click();
    const retryContinue = await findButton(page, "Send My Time Options");
    await retryContinue.click();
    await waitForText(page, "Scheduling request received");
    assert.equal(contactCalls, 2);
    assert.deepEqual(
      Object.keys(contactPayloads[1]).sort(),
      [
        "consentGranted",
        "consentLanguage",
        "contactMethod",
        "message",
        "phone",
        "preferredTimes",
        "submissionToken",
        "timeZone",
        "turnstileToken",
        "website",
      ].sort(),
      "The scheduling-help request included unexpected fields.",
    );
    assert.equal(contactPayloads[1].contactMethod, "phone");
    assert.equal(contactPayloads[1].phone, "613-555-0100");
    assert.deepEqual(contactPayloads[1].preferredTimes, proposedTimes);
    assert.equal(contactPayloads[1].timeZone, "America/Toronto");
    assert.equal(contactPayloads[1].consentGranted, true);
    assert.equal(contactPayloads[1].message, editedRetryMessage);
    assert.match(
      contactPayloads[1].turnstileToken,
      /^quiz-smoke-quiz_contact_help-/,
    );
    assert.notEqual(
      contactPayloads[0].turnstileToken,
      contactPayloads[1].turnstileToken,
      "A consumed contact-help challenge was reused after a failed request.",
    );

    const analyticsJson = await page.evaluate(() =>
      JSON.stringify(window.dataLayer || []),
    );
    for (const sensitiveValue of [
      "alex@example.com",
      "613-555-0100",
      "Please call me if one of these proposed times can be confirmed.",
      editedRetryMessage,
      proposedTimes[0],
      proposedTimes[1],
      "America/Toronto",
      "private-click-id",
      "anxiety",
      '"score"',
      '"phone"',
    ]) {
      assert.equal(
        analyticsJson.includes(sensitiveValue),
        false,
        `Sensitive value appeared in dataLayer: ${sensitiveValue}`,
      );
    }
    assert.equal(
      await page.evaluate(() =>
        (window.dataLayer || []).some(
          (event) => event?.event === "contact_help_submitted",
        ),
      ),
      true,
    );

    // Refresh restoration must use the body-only private POST and never
    // re-submit lead details. It should preserve the completed help state.
    await page.reload({ waitUntil: "domcontentloaded" });
    console.log("Quiz UI smoke: validating restoration and intent variants");
    await waitForText(page, "Scheduling request received");
    await page.evaluate(() =>
      sessionStorage.removeItem("valisen.consultation.prefill"),
    );
    await preventJaneNavigation(page);
    const restoredConsultation = await findLink(
      page,
      "Request My Free Consultation",
    );
    await restoredConsultation.click();
    const restoredPrefill = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("valisen.consultation.prefill") || "null"),
    );
    assert.deepEqual(
      {
        firstName: restoredPrefill?.firstName,
        email: restoredPrefill?.email,
        phone: restoredPrefill?.phone,
        submissionToken: restoredPrefill?.submissionToken,
      },
      {
        firstName: "Alex",
        email: "alex@example.com",
        phone: "613-555-0100",
        submissionToken,
      },
      "A restored private result did not restage the consented consultation autofill.",
    );
    assert.equal(accessCalls, 2);
    assert.ok(restoreCalls >= 1);
    for (const restored of restorePayloads) {
      assert.equal(
        restored.search,
        "",
        "The private result capability appeared in a restoration URL.",
      );
      assert.deepEqual(
        restored.payload,
        { submissionToken },
        "Private restoration sent fields beyond the capability token.",
      );
    }

    const downloadButton = await findButton(page, "Download My Results PDF");
    assert.ok(
      await downloadButton.evaluate((button) =>
        Boolean(button.closest("[data-quiz-results]")),
      ),
      "The PDF action was not placed inside the results journey.",
    );
    await downloadButton.click();
    await downloadButton.evaluate((button) => button.click());
    for (let attempt = 0; attempt < 20 && pdfCalls === 0; attempt += 1) {
      await delay(50);
    }
    assert.equal(pdfCalls, 1, "The PDF action created duplicate download requests.");
    assert.deepEqual(pdfPayloads[0], { submissionToken });
    assert.equal(
      await page.evaluate(
        (token) =>
          location.href.includes(token) ||
          [...document.querySelectorAll("[href]")].some((element) =>
            element.getAttribute("href")?.includes(token),
          ),
        submissionToken,
      ),
      false,
      "The PDF capability token appeared in a browser URL.",
    );
    assert.equal(
      await page.evaluate(
        (token) => JSON.stringify(window.dataLayer || []).includes(token),
        submissionToken,
      ),
      false,
      "The PDF capability token appeared in the data layer.",
    );

    // Exercise the other three conditional variants through the same reusable
    // private-result component.
    for (const route of intentRoutes.slice(1)) {
      currentRestoreIntent = route.intent;
      contactWasSent = false;
      await page.reload({ waitUntil: "domcontentloaded" });
      await assertRoute(page, route);
      await assertNoHorizontalOverflow(page, `Mobile ${route.intent}`);
    }

    await page.setViewport({ width: 768, height: 900, deviceScaleFactor: 1 });
    await delay(100);
    await assertNoHorizontalOverflow(page, "Tablet");
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await delay(100);
    await assertNoHorizontalOverflow(page, "Desktop");

    // A private emailed link must be consumed from the fragment before GTM,
    // restored through a body-only POST, and removed from the visible URL.
    currentRestoreIntent = "ready_to_speak";
    await page.evaluate(() => sessionStorage.removeItem("valisen.quiz.resultToken"));
    await page.goto(`${baseUrl}/quiz#result=${encodeURIComponent(submissionToken)}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await assertRoute(page, intentRoutes[0]);
    assert.equal(
      await page.evaluate(() => window.location.hash),
      "",
      "The private result token remained in the visible URL fragment.",
    );

    for (const payload of engagementPayloads) {
      const allowedKeys =
        payload.event === "jane_booking_clicked"
          ? ["submissionToken", "event", "ctaPlacement"]
          : ["submissionToken", "event"];
      assert.deepEqual(
        Object.keys(payload).sort(),
        allowedKeys.sort(),
        `Engagement ${payload.event} included unexpected properties.`,
      );
    }

    console.log(
      "Quiz UI smoke passed: 19 questions, safety handling, mandatory phone, unscored intent, duplicate guards, four Jane-first routes, safe analytics, responsive sticky CTA, saved-detail exact-time scheduling help, private POST PDF download, and private result restoration.",
    );
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
