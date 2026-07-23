import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const baseUrl = process.env.QUIZ_TEST_BASE_URL || "http://127.0.0.1:3000";

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
};

const match = {
  status: "match",
  therapistSlug: "tim-kahtava",
  reasons: [
    {
      chip: "Worry & tension",
      detail: "Worry & tension stood out in your answers, and Tim works in this area.",
    },
  ],
  runnersUp: ["wilfred-bengnwi", "ryann-simpson"],
};

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function bodyText(page) {
  return page.evaluate(() => document.querySelector("main")?.textContent || "");
}

async function waitForText(page, text, timeout = 8_000) {
  await page.waitForFunction(
    (expected) =>
      (document.querySelector("main")?.textContent || "")
        .replace(/\s+/g, " ")
        .includes(expected),
    { timeout },
    text,
  );
}

async function findButton(page, label) {
  const handle = await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim().replace(/\s+/g, " ") === expected,
      ),
    { timeout: 8_000 },
    label,
  );
  return handle.asElement();
}

async function setInputValue(page, selector, value) {
  await page.$eval(
    selector,
    (input, nextValue) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
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

async function selectFirstAnswer(page, counter) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt === 0) {
      await page.click('button[aria-pressed="false"]');
    } else {
      await page.$eval('button[aria-pressed="false"]', (button) => button.click());
    }
    try {
      await page.waitForFunction(
        (previousCounter) => {
          const mainText = (document.querySelector("main")?.textContent || "").replace(
            /\s+/g,
            " ",
          );
          return (
            !mainText.includes(previousCounter) ||
            Boolean(document.querySelector('button[aria-pressed="true"]'))
          );
        },
        { timeout: 1_500 },
        counter,
      );
      return;
    } catch {
      // A click can occasionally land during the 260 ms question transition.
      // Retry once only while the same unanswered screen remains.
    }
  }
  throw new Error(`Could not select an answer for ${counter}.`);
}

async function completeQuiz(page) {
  const headings = [];
  for (let step = 1; step <= 18; step += 1) {
    const counter = `Question ${step} of 18`;
    await waitForText(page, counter);
    const heading = await page.$eval("h2", (element) => element.textContent?.trim() || "");
    headings.push(heading);

    const hasMultiContinue = await page.evaluate(() =>
      [...document.querySelectorAll("button")].some((button) =>
        /^(Continue|Skip — nothing specific)$/.test(button.textContent?.trim() || ""),
      ),
    );

    await selectFirstAnswer(page, counter);
    if (hasMultiContinue) {
      const continueButton = await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].find((button) =>
          /^Continue$/.test(button.textContent?.trim() || ""),
        ),
      );
      await continueButton.asElement().click();
    }

    if (step < 18) {
      try {
        await page.waitForFunction(
          (previousCounter) =>
            !(document.querySelector("main")?.textContent || "")
              .replace(/\s+/g, " ")
              .includes(previousCounter),
          { timeout: 5_000 },
          counter,
        );
      } catch (error) {
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
          `Quiz did not advance after step ${step} (${counter}). State: ${JSON.stringify(state)}`,
          { cause: error },
        );
      }
    }
  }

  assert.equal(
    headings.some((heading) => /Which language would you like therapy in|Mandarin \(普通话\)/i.test(heading)),
    false,
    "The retired language question appeared in the visible flow.",
  );
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => console.error("Browser page error:", error.message));
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

  let accessCalls = 0;
  let consentCalls = 0;
  let simulatedAccessEmails = 0;
  let simulatedContactEmails = 0;
  const accessPayloads = [];

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    void (async () => {
      const url = new URL(request.url());
      if (request.method() === "POST" && url.pathname === "/api/quiz-lead") {
        accessCalls += 1;
        accessPayloads.push(JSON.parse(request.postData() || "{}"));
        if (accessCalls === 1) {
          await request.respond(
            jsonResponse(
              {
                ok: false,
                error:
                  "We saved your answers, but couldn’t deliver the results summary. Please try again.",
                retriable: true,
              },
              502,
            ),
          );
          return;
        }
        simulatedAccessEmails += 1;
        await request.respond(
          jsonResponse(
            {
              ok: true,
              referenceId: "VQ-SMOKETEST001",
              submissionToken: `v1.VQ-SMOKETEST001.${"a".repeat(43)}`,
              outcome,
              match,
              resultsEmailSent: true,
            },
            201,
          ),
        );
        return;
      }

      if (
        request.method() === "POST" &&
        url.pathname === "/api/quiz-lead/contact-consent"
      ) {
        consentCalls += 1;
        if (consentCalls === 1) {
          await request.respond(
            jsonResponse(
              { ok: false, error: "Temporary notification failure", retriable: true },
              502,
            ),
          );
        } else {
          simulatedContactEmails += 1;
          await request.respond(
            jsonResponse({
              ok: true,
              emailSent: true,
              referenceId: "VQ-SMOKETEST001",
            }),
          );
        }
        return;
      }

      await request.continue();
    })().catch(() => {
      if (!request.isInterceptResolutionHandled()) void request.abort();
    });
  });

  try {
    await page.goto(`${baseUrl}/quiz`, {
      waitUntil: ["domcontentloaded", "networkidle2"],
    });
    await page.evaluate(() => {
      window.__quizSmokeDocumentMarker = "same-document";
    });

    await completeQuiz(page);
    await waitForText(page, "Your personalized results are ready");

    let text = await bodyText(page);
    assert.equal(text.includes("Your check-in & recommended next step"), false);
    assert.equal(text.includes("Recommended for you"), false);
    assert.equal(text.includes("Book with Tim"), false);
    assert.equal(accessCalls, 0);
    assert.equal(consentCalls, 0);

    const viewResults = await findButton(page, "View My Results");
    assert.equal(await viewResults.evaluate((button) => button.disabled), true);

    await page.type('input[autocomplete="email"]', "not-an-email");
    await page.focus('input[autocomplete="given-name"]');
    await waitForText(page, "Please enter a valid email address.");

    await setInputValue(page, 'input[autocomplete="given-name"]', "Alex");
    await setInputValue(page, 'input[autocomplete="email"]', "alex@example.com");
    await setInputValue(page, 'input[autocomplete="tel"]', "613-555-0100");
    await checkInput(page, 'input[type="checkbox"][required]');

    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find(
        (candidate) =>
          candidate.textContent?.trim().replace(/\s+/g, " ") === "View My Results",
      );
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    const enabledViewResults = await findButton(page, "View My Results");
    await enabledViewResults.click();

    await waitForText(page, "couldn’t deliver the results summary");
    text = await bodyText(page);
    assert.equal(text.includes("Your check-in & recommended next step"), false);
    assert.equal(accessCalls, 1);
    assert.equal(simulatedAccessEmails, 0);
    assert.equal(consentCalls, 0);

    const retryResults = await findButton(page, "View My Results");
    await retryResults.click();
    await waitForText(page, "Your check-in & recommended next step", 10_000);
    text = await bodyText(page);
    assert.equal(text.includes("Your Results"), true);
    assert.equal(text.includes("Recommended for you"), true);
    assert.equal(text.includes("Tim Kahtava"), true);
    assert.equal(text.includes("Book with Tim"), true);
    assert.equal(consentCalls, 0, "Results access unexpectedly triggered contact consent.");
    assert.equal(accessCalls, 2);
    assert.equal(simulatedAccessEmails, 1);
    assert.equal(simulatedContactEmails, 0);
    assert.equal(
      accessPayloads[0].clientSubmissionId,
      accessPayloads[1].clientSubmissionId,
      "Results-email retry used a new lead id.",
    );
    assert.equal("language" in accessPayloads[1].answers, false);
    assert.equal("safety" in accessPayloads[1].answers, false);
    assert.equal(
      await page.evaluate(() => window.__quizSmokeDocumentMarker),
      "same-document",
      "The quiz reloaded instead of revealing results in place.",
    );

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, `Mobile layout overflows horizontally by ${overflow}px.`);
    text = await bodyText(page);
    assert.equal(text.includes("Would you like your recommended therapist to contact you?"), true);

    const consentButton = await findButton(page, "Yes, I’d Like the Therapist to Contact Me");
    await consentButton.click();
    await waitForText(page, "We couldn't send your request.");
    assert.equal((await bodyText(page)).includes("Your check-in & recommended next step"), true);
    assert.equal(simulatedContactEmails, 0);

    const retryButton = await findButton(page, "Yes, I’d Like the Therapist to Contact Me");
    await retryButton.click();
    await waitForText(page, "Request received");
    assert.equal(consentCalls, 2);
    assert.equal(simulatedAccessEmails, 1);
    assert.equal(simulatedContactEmails, 1);
    assert.equal(
      await page.evaluate(() =>
        [...document.querySelectorAll("button")].some((button) =>
          button.textContent?.includes("Therapist to Contact Me"),
        ),
      ),
      false,
      "The consent button remained available after success.",
    );

    console.log(
      "Quiz UI smoke passed: 18 questions, gated results, access-email failure/retry with one summary, responsive reveal, and one separate contact notification.",
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
