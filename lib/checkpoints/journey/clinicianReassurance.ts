import type { ConcernTag, Therapist } from "@/lib/therapists";

export type ClinicianReassurance = Partial<Record<ConcernTag, string>>;
const supportLabels: Partial<Record<ConcernTag, string>> = {
  anxiety: "Provides anxiety support",
  depression: "Provides support for low mood & depression",
  "stress-burnout": "Works with stress & burnout",
  "relationship-challenges": "Provides relationship support",
  "couples-therapy": "Provides couples therapy",
  adhd: "Provides ADHD support",
  "perfectionism-people-pleasing": "Perfectionism & people-pleasing support",
  "self-esteem": "Provides self-esteem support",
  "life-transitions": "Support through major life transitions",
  grief: "Provides grief & loss support",
};

/** Read-only facts from the clinic profile, never inferred years or specialist credentials. */
export function buildClinicianReassurance(person: Therapist, ownerConfirmedCouples = false): ClinicianReassurance {
  const supported = new Set(person.matching.concernTags);
  if (ownerConfirmedCouples) supported.add("couples-therapy");
  const proof: ClinicianReassurance = {};
  for (const tag of supported) {
    let text = supportLabels[tag];
    if (!text) continue;
    if (person.slug === "tim-kahtava") {
      text = person.credentialsList.find(item => item.label === "Experience")?.value || text;
    } else if (person.slug === "wilfred-bengnwi") {
      const experience = person.credentialsList.find(item => item.label === "Clinical Experience")?.value;
      text = (tag === "couples-therapy" ? experience?.split(";").map(item => item.trim()).find(item => item.includes("specializing in couples therapy")) : experience?.split(";")[0].trim()) || text;
    } else if (person.slug === "ryann-simpson") {
      if (tag === "anxiety") text = "Focuses on anxiety & overthinking";
      if (tag === "couples-therapy") text = "Couples & communication support";
      if (tag === "stress-burnout") text = "Stress, burnout & boundaries support";
      if (tag === "adhd") text = "ADHD & executive-function support";
      if (tag === "self-esteem") text = "Self-esteem & confidence support";
      if (tag === "relationship-challenges") text = "Relationships, communication & boundaries";
    } else if (person.slug === "meryem-ibrahim") {
      if (["anxiety", "depression", "stress-burnout"].includes(tag) && person.therapyStyle.tags.includes("CBT") && person.therapyStyle.tags.includes("DBT")) text = "Draws on CBT & DBT for support";
      if (tag === "grief") text = "Compassionate grief & loss support";
      if (tag === "life-transitions") text = "Culturally responsive support through change";
      if (tag === "couples-therapy" && ownerConfirmedCouples) text = "Offers couples & marriage therapy";
    } else if (person.slug === "dayong-quan") {
      if (tag === "anxiety" || tag === "stress-burnout") {
        const mindfulness = person.areasOfSupport.find(area => area.title === "Mindfulness-Based Therapy")?.description.match(/more than (\d+) years of mindfulness experience/);
        if (mindfulness) text = `${mindfulness[1]}+ years of mindfulness experience`;
      } else if (person.credentialsList.some(item => item.value.includes("Yorkville University")) && person.credentialsList.some(item => item.value.includes("East China Normal University"))) {
        text = "Graduate psychology training in Canada & China";
      }
    }
    proof[tag] = text;
  }
  return proof;
}
