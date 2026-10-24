/**
 * Canadian statistics shown on /donate. Each figure was checked against the
 * linked Statistics Canada release on 2026-10-24. Keep the survey year beside
 * every number, and re-check sources before changing any value.
 */

export type DonationFact = {
  figure: string;
  claim: string;
  context: string;
  source: string;
  sourceUrl: string;
};

export const DONATION_FACTS: DonationFact[] = [
  {
    figure: "32%",
    claim:
      "of Canadians with a mood or anxiety disorder who felt they needed counselling, but hadn't received it, said they couldn't afford to pay.",
    context: "2022 Mental Health and Access to Care Survey, published January 2026.",
    source: "Statistics Canada, Health Reports",
    sourceUrl: "https://www.statcan.gc.ca/o1/en/app/8942-health-reports-january-2026",
  },
  {
    figure: "43.8%",
    claim:
      "of Canadians aged 15+ with a mood, anxiety or substance use disorder received any counselling or psychotherapy, though 58.8% said they needed it.",
    context: "2022 Mental Health and Access to Care Survey, published September 2023.",
    source: "Statistics Canada, Insights on Canadian Society",
    sourceUrl: "https://www150.statcan.gc.ca/n1/pub/75-006-x/2023001/article/00011-eng.htm",
  },
  {
    figure: "45%",
    claim:
      "of Canadians said rising prices were greatly affecting their ability to meet day-to-day expenses, up from 33% two years earlier.",
    context: "Canadian Social Survey, spring 2024.",
    source: "Statistics Canada",
    sourceUrl:
      "https://www.statcan.gc.ca/o1/en/app/6815-nearly-half-canadians-report-rising-prices-are-greatly-impacting-their-ability-meet-day",
  },
];
