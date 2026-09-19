import { expect, it } from "vitest";
import { getTherapistBySlug } from "@/lib/therapists";

it.each([
  ["meryem-ibrahim", "CRPO", "21069"],
  ["ryann-simpson", "OCSWSSW", "846418"],
  ["tim-kahtava", "CRPO", "005895"],
  ["dayong-quan", "CRPO", "13374"],
  ["wilfred-bengnwi", "CRPO", "14462"],
])("preserves the clinic-supplied registration for %s", (slug, college, number) => {
  expect(getTherapistBySlug(slug)?.registration).toEqual({ college, number });
});
