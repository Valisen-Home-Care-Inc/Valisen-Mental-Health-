import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESULT_ACTIONS, RESULT_SECTIONS, parseResultEngagement } from "@/lib/quizResultEngagement";
import { RESULT_ACTION_LABELS } from "@/components/checkpoints/admin/QuizResultEngagementPanel";

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  viewId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  sequence: 1,
  elapsedSeconds: 20,
  activeSeconds: 10,
  scrollDepth: 80,
  sections: ["summary", "save_contact"],
  lastSection: "save_contact",
  actions: {},
  ...overrides,
});

/** The newest migration that redefines the database allow-list. */
function latestEngagementMigration(): string {
  const dir = join(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  const matching = files.filter((file) =>
    readFileSync(join(dir, file), "utf8").includes("function public.record_quiz_result_engagement"),
  );
  return readFileSync(join(dir, matching[matching.length - 1]), "utf8");
}

function sqlArray(sql: string, name: string): string[] {
  const match = new RegExp(`${name} text\\[\\] := array\\[([^\\]]+)\\]`).exec(sql);
  if (!match) throw new Error(`Missing ${name}`);
  return match[1].split(",").map((item) => item.trim().replace(/^'|'$/g, ""));
}

describe("results-page tracking contract", () => {
  it("records the version 7 actions: therapist choice, contact save, WhatsApp and the exit pop-up", () => {
    for (const action of ["therapist_chosen", "save_contact_clicked", "whatsapp_clicked", "exit_prompt_shown", "exit_prompt_saved", "exit_prompt_dismissed", "details_opened"]) {
      expect(RESULT_ACTIONS).toContain(action);
    }
    expect(parseResultEngagement(snapshot({ actions: { save_contact_clicked: 1, whatsapp_clicked: 2, exit_prompt_shown: 1 } }))).not.toBeNull();
    expect(parseResultEngagement(snapshot({ actions: { invented_action: 1 } }))).toBeNull();
  });

  it("keeps the database allow-lists identical to the app's", () => {
    const sql = latestEngagementMigration();
    expect(sqlArray(sql, "v_actions")).toEqual([...RESULT_ACTIONS]);
    expect(sqlArray(sql, "v_sections")).toEqual([...RESULT_SECTIONS]);
    expect(sql).toContain("'actionTotals'");
  });

  it("gives every action a plain label in the CRM", () => {
    for (const action of RESULT_ACTIONS) expect(RESULT_ACTION_LABELS[action]).toBeTruthy();
  });
});

describe("CRM results-engagement panel", () => {
  it("shows people and taps for the new actions, and readable interaction names", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: Panel } = await import("@/components/checkpoints/admin/QuizResultEngagementPanel");
    const html = renderToStaticMarkup(createElement(Panel, { data: {
      views: 3, visitors: 2, averageActiveSeconds: 75, averageScrollDepth: 88,
      actionTotals: { save_contact_clicked: { count: 3, results: 2 }, whatsapp_clicked: { count: 1, results: 1 } },
      records: [{ referenceId: "VQ-TEST", firstName: "Alex", views: 1, activeSeconds: 40, elapsedSeconds: 90, scrollDepth: 100,
        sections: ["summary", "save_contact"], lastSection: "save_contact",
        actions: { exit_prompt_shown: 1, exit_prompt_saved: 1 }, lastSeenAt: "2026-10-18T19:00:00Z" }],
    } }));
    expect(html).toContain("Tapped Save contact");
    expect(html).toContain("Alex");
    expect(html).toContain("VQ-TEST");
    expect(html).toContain("2 people");
    expect(html).toContain("3 taps");
    expect(html).toContain("Tapped WhatsApp");
    expect(html).toContain("Saw before-you-go pop-up: 1");
    expect(html).toContain("Tapped Save contact in pop-up: 1");
    expect(html).toContain("save contact");
    const legacy = renderToStaticMarkup(createElement(Panel, { data: { views: 0, visitors: 0, averageActiveSeconds: 0, averageScrollDepth: 0, records: [] } }));
    expect(legacy).toContain("Apply the version 7 result-engagement migration");
  });
});
