import {
  GOOGLE_ADS_FORM_FIELD_IDS,
  GOOGLE_ADS_EVENT_NAMES,
  GOOGLE_ADS_TARGET_TYPES,
  canonicalizeGoogleAdsPath,
  confirmedConsultationReferenceIsValid,
  googleAdsEventIdIsValid,
  googleAdsSessionIdIsValid,
  isGoogleAdsSectionId,
  type GoogleAdsEventName,
  type GoogleAdsTargetType,
} from "@/lib/googleAdsJourney";
import {
  GOOGLE_ADS_AD_DEVICES,
  GOOGLE_ADS_MATCH_TYPES,
  GOOGLE_ADS_MATCH_TYPE_LABELS,
  GOOGLE_ADS_NETWORKS,
  GOOGLE_ADS_NETWORK_LABELS,
  decodeGoogleAdsValueTrackAttribution,
  safeGoogleAdsNumericId,
  type GoogleAdsAdDevice,
  type GoogleAdsMatchType,
  type GoogleAdsNetwork,
} from "@/lib/googleAdsEntry";

export type GoogleAdsDashboardKpis = {
  sessions: number;
  engagedSessions: number;
  totalEngagedMs: number;
  averageEngagedMs: number;
  consultationCtaSessions: number;
  formStarts: number;
  consultationRequests: number;
  consultationOpportunities: number;
  bookedConsultations: number;
  paidTherapyConversions: number;
  /** Signed clicks whose page never sent a single event (left before load). */
  sessionsWithoutEvents: number;
  /** Sessions that carried Google Ads campaign / ad group / keyword data. */
  attributedSessions: number;
};

export type GoogleAdsFunnelStage = {
  key: string;
  label: string;
  count: number;
  sessionRate: number;
};

export type GoogleAdsPageMetric = {
  path: string;
  label: string;
  sessions: number;
  views: number;
  engagedMs: number;
  averageEngagedMs: number;
  exits: number;
  consultationCtaSessions: number;
  consultationRequests: number;
};

export type GoogleAdsSectionMetric = {
  path: string;
  sectionId: string;
  views: number;
  sessions: number;
  engagedMs: number;
};

export type GoogleAdsClickAttribution = {
  source?: string;
  medium?: string;
  /** Raw `utm_campaign` dimension (name, numeric ID, or QA label). */
  campaign?: string;
  campaignId?: string;
  campaignName?: string;
  content?: string;
  adGroupId?: string;
  adGroupName?: string;
  keyword?: string;
  matchType?: GoogleAdsMatchType;
  network?: GoogleAdsNetwork;
  adDevice?: GoogleAdsAdDevice;
  creativeId?: string;
  legacyContent?: string;
  googleClickIdPresent: boolean;
  /** True when the click carried the Google Ads final URL suffix data. */
  suffixReceived: boolean;
};

export type GoogleAdsCampaignMetric = Omit<
  GoogleAdsClickAttribution,
  "source" | "medium" | "campaign" | "adDevice" | "creativeId"
> & {
  source: string;
  medium: string;
  /** Display label: campaign name, else the raw campaign dimension. */
  campaign: string;
  sessions: number;
  engagedSessions: number;
  consultationCtaSessions: number;
  formStarts: number;
  consultationRequests: number;
  bookedConsultations: number;
  paidTherapyConversions: number;
};

export type GoogleAdsActionMetric = {
  event: GoogleAdsEventName;
  label: string;
  sessions: number;
  events: number;
};

export type GoogleAdsJourneyEvent = {
  id?: string;
  sequence?: number;
  name: GoogleAdsEventName;
  occurredAt: string;
  path: string;
  section?: string;
  targetType?: GoogleAdsTargetType;
  targetId?: string;
  targetPath?: string;
  ctaPlacement?: string;
  therapistId?: string;
  engagedMs?: number;
  scrollDepth?: 25 | 50 | 75 | 100;
  formStep?: 1 | 2;
  consultationReferenceId?: string;
};

export type GoogleAdsJourneySummary = {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  /** Wall-clock span from first to last recorded activity. */
  durationMs: number;
  seededAt?: string;
  landingPath: string;
  lastPath: string;
  engagedMs: number;
  maxScrollDepth: number;
  eventCount: number;
  device?: "mobile" | "tablet" | "desktop";
  consultationCtaClicked: boolean;
  formStarted: boolean;
  consultationSubmitted: boolean;
  consultationReferenceId?: string;
  booked: boolean;
  paidTherapy: boolean;
  attribution: GoogleAdsClickAttribution;
  events: GoogleAdsJourneyEvent[];
};

export type GoogleAdsDashboardData = {
  generatedAt: string;
  range: { from: string; to: string };
  kpis: GoogleAdsDashboardKpis;
  funnel: GoogleAdsFunnelStage[];
  pages: GoogleAdsPageMetric[];
  sections: GoogleAdsSectionMetric[];
  campaigns: GoogleAdsCampaignMetric[];
  actions: GoogleAdsActionMetric[];
  recentSessions: GoogleAdsJourneySummary[];
};

const EVENT_NAMES = new Set<string>(GOOGLE_ADS_EVENT_NAMES);
const TARGET_TYPES = new Set<string>(GOOGLE_ADS_TARGET_TYPES);
const TARGET_IDS = new Set<string>([
  ...GOOGLE_ADS_FORM_FIELD_IDS,
  "button",
  "submit",
]);
const MATCH_TYPES = new Set<string>(GOOGLE_ADS_MATCH_TYPES);
const NETWORKS = new Set<string>(GOOGLE_ADS_NETWORKS);
const AD_DEVICES = new Set<string>(GOOGLE_ADS_AD_DEVICES);

const EVENT_LABELS: Record<GoogleAdsEventName, string> = {
  journey_started: "Journey started",
  page_viewed: "Page viewed",
  page_exited: "Page exited",
  section_viewed: "Section reached",
  engagement_ping: "Active time recorded",
  scroll_depth_reached: "Scroll depth reached",
  internal_link_clicked: "Internal link clicked",
  control_clicked: "Page control clicked",
  consultation_cta_clicked: "Consultation CTA clicked",
  phone_clicked: "Phone link clicked",
  email_clicked: "Email link clicked",
  therapist_profile_clicked: "Therapist profile clicked",
  quiz_clicked: "Quiz clicked",
  external_link_clicked: "External link clicked",
  form_started: "Consultation form started",
  form_field_focused: "Form field reached",
  consultation_step_viewed: "Consultation step viewed",
  consultation_validation_failed: "Form validation shown",
  consultation_submitted: "Client submission signal recorded",
  thank_you_viewed: "Thank-you page viewed",
};

const PAGE_LABELS: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/services": "Services",
  "/therapists": "Therapists",
  "/quiz": "Therapist quiz",
  "/consultation": "Free consultation",
  "/thank-you": "Consultation thank-you",
  "/welcome": "Dedicated landing page (/welcome)",
  "/welcome/thank-you": "Landing-page request confirmation",
  "/sitewide": "Other tracked page",
};

const SECTION_LABELS: Record<string, readonly string[]> = {
  "/": [
    "Find the right therapist",
    "Practice facts at a glance",
    "Private therapist finder",
    "A focused team, with the essentials visible",
    "A clearer path to a consultation",
    "Fees and consultation pricing",
    "Insurance reimbursement",
    "Practical therapy questions",
    "Final therapist finder prompt",
  ],
  "/about": [
    "Making therapy accessible",
    "How Valisen works",
    "Values and care standards",
    "Book with Valisen",
  ],
  "/services": [
    "Therapy services introduction",
    "Individual and couples services",
    "Specialized therapy support",
    "Insurance coverage",
    "Find a therapist who fits",
  ],
  "/insurance": [
    "Insurance coverage introduction",
    "Plans that may cover sessions",
    "How to use insurance benefits",
    "What plans may include",
    "Common insurance questions",
    "Ready to get started",
  ],
  "/resources": [
    "Mental health resources",
    "Featured guides and articles",
    "Need immediate support",
  ],
  "/faq": [
    "Therapy questions introduction",
    "Browse questions and answers",
    "Still deciding what you need",
    "Free consultation prompt",
  ],
  "/therapists": [
    "Therapist directory introduction",
    "Private therapist finder",
    "Reorder the team around your needs",
    "Therapist directory, availability, and fees",
    "Compare therapists and book",
    "Still deciding what you need",
  ],
  "/consultation": [
    "Free consultation introduction",
    "Consultation request form",
  ],
  "/quiz": ["Private therapist finder quiz"],
  "/thank-you": ["Consultation request received"],
  "/welcome/thank-you": ["Consultation request received"],
  "/privacy-policy": ["Privacy policy"],
  "/terms": ["Terms of use"],
  "/resources/five-signs-of-perfectionism": [
    "Understanding perfectionism",
    "Five signs of perfectionism",
    "Sign 1: self-worth tied to achievement",
    "Sign 2: fear of mistakes",
    "Sign 3: all-or-nothing thinking",
    "Sign 4: difficulty resting",
    "Sign 5: harsh self-criticism",
    "High standards versus perfectionism",
    "What can help",
    "Getting support",
    "Sources and references",
  ],
};

const SPECIALTY_SECTION_LABELS = [
  "Therapy concern introduction",
  "Understanding the concern",
  "Browse therapists and book directly",
  "What to expect from therapy",
  "Compare next-step options",
  "Common questions",
] as const;

const PAID_LANDING_SECTION_LABELS = [
  "Campaign landing and consultation request",
  "Therapists accepting clients",
  "About Valisen",
  "Services, pricing, and insurance",
  "How the consultation works",
  "Frequently asked questions",
  "Final consultation prompt",
] as const;

const THERAPIST_PROFILE_SECTION_LABELS = [
  "Therapist overview and availability",
  "A grounded place to begin",
  "Language or areas of support",
  "Areas of support or therapy style",
  "Therapy style or session details",
  "Credentials and session logistics",
  "Professional background",
  "Session details",
] as const;

const SPECIALTY_PAGE_PATTERN = /^\/(?:anxiety-therapy|depression-therapy|grief-counselling|life-transitions-therapy|relationship-counselling|self-esteem-therapy|stress-therapy|trauma-therapy)-ottawa$/;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function pick(source: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function count(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function milliseconds(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(604_800_000, Math.round(parsed))) : 0;
}

function aggregateMilliseconds(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.min(315_576_000_000, Math.round(parsed)))
    : 0;
}

function percent(value: unknown, numerator = 0, denominator = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  const calculated = denominator > 0 ? (numerator / denominator) * 100 : 0;
  const resolved = Number.isFinite(parsed) ? parsed : calculated;
  return Math.max(0, Math.min(100, Math.round(resolved * 10) / 10));
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "true";
}

function safeText(value: unknown, maximum = 120): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\r\n\t]+/g, " ").slice(0, maximum);
}

function optionalDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function date(value: unknown, fallback: string): string {
  return optionalDate(value) ?? fallback;
}

function path(value: unknown): string {
  return canonicalizeGoogleAdsPath(typeof value === "string" ? value : "/sitewide");
}

function pageLabel(pagePath: string, supplied?: unknown): string {
  const explicit = safeText(supplied, 80);
  if (explicit) return explicit;
  if (PAGE_LABELS[pagePath]) return PAGE_LABELS[pagePath];
  if (pagePath.startsWith("/therapists/")) return "Therapist profile";
  if (pagePath.startsWith("/services/")) return "Service detail";
  return pagePath === "/sitewide" ? "Other tracked page" : pagePath;
}

function eventName(value: unknown): GoogleAdsEventName | null {
  return typeof value === "string" && EVENT_NAMES.has(value)
    ? (value as GoogleAdsEventName)
    : null;
}

function targetType(value: unknown): GoogleAdsTargetType | undefined {
  return typeof value === "string" && TARGET_TYPES.has(value)
    ? (value as GoogleAdsTargetType)
    : undefined;
}

function matchType(value: unknown): GoogleAdsMatchType | undefined {
  const text = safeText(value, 20).toLowerCase();
  return MATCH_TYPES.has(text) ? (text as GoogleAdsMatchType) : undefined;
}

function network(value: unknown): GoogleAdsNetwork | undefined {
  const text = safeText(value, 24).toLowerCase();
  return NETWORKS.has(text) ? (text as GoogleAdsNetwork) : undefined;
}

function adDevice(value: unknown): GoogleAdsAdDevice | undefined {
  const text = safeText(value, 12).toLowerCase();
  return AD_DEVICES.has(text) ? (text as GoogleAdsAdDevice) : undefined;
}

/**
 * Reads explicit click-attribution columns first and falls back to the
 * `vt1~` encoding carried inside `utm_content` for sessions recorded before
 * the first-class columns existed.
 */
function normalizeClickAttribution(
  primary: UnknownRecord,
  fallback: UnknownRecord = {},
): GoogleAdsClickAttribution {
  const field = (...keys: string[]) => pick(primary, ...keys) ?? pick(fallback, ...keys);
  const content = safeText(field("content", "utmContent", "utm_content"), 120) || undefined;
  const valueTrack = decodeGoogleAdsValueTrackAttribution(content);
  const campaign = safeText(field("campaign", "utmCampaign", "utm_campaign"), 120) || undefined;
  const campaignId =
    safeGoogleAdsNumericId(safeText(field("campaignId", "campaign_id"), 20)) ||
    safeGoogleAdsNumericId(campaign);
  const campaignName = safeText(field("campaignName", "campaign_name"), 80) || undefined;
  const adGroupId =
    safeGoogleAdsNumericId(safeText(field("adGroupId", "ad_group_id"), 20)) ||
    valueTrack?.adGroupId;
  const adGroupName =
    safeText(field("adGroupName", "ad_group_name"), 80) || valueTrack?.adGroupName;
  const keyword = safeText(field("keyword"), 80) || valueTrack?.keyword;
  const attribution: GoogleAdsClickAttribution = {
    source: safeText(field("source", "utmSource", "utm_source"), 80) || undefined,
    medium: safeText(field("medium", "utmMedium", "utm_medium"), 80) || undefined,
    campaign,
    campaignId,
    campaignName,
    content,
    adGroupId,
    adGroupName,
    keyword,
    matchType: matchType(field("matchType", "match_type")),
    network: network(field("network")),
    adDevice: adDevice(field("adDevice", "ad_device")),
    creativeId: safeGoogleAdsNumericId(safeText(field("creativeId", "creative_id"), 20)),
    legacyContent: content && !valueTrack ? content : undefined,
    googleClickIdPresent: bool(
      field("googleClickIdPresent", "google_click_id_present", "hasGoogleClickId", "has_google_click_id"),
    ),
    suffixReceived: false,
  };
  // Google appends the campaign ID by itself; ad group, keyword, and the
  // typed names only arrive through the advertiser's final URL suffix.
  attribution.suffixReceived = Boolean(
    attribution.campaignName ||
      attribution.adGroupId ||
      attribution.adGroupName ||
      attribution.keyword,
  );
  return attribution;
}

function fallbackKpis(): GoogleAdsDashboardKpis {
  return {
    sessions: 0,
    engagedSessions: 0,
    totalEngagedMs: 0,
    averageEngagedMs: 0,
    consultationCtaSessions: 0,
    formStarts: 0,
    consultationRequests: 0,
    consultationOpportunities: 0,
    bookedConsultations: 0,
    paidTherapyConversions: 0,
    sessionsWithoutEvents: 0,
    attributedSessions: 0,
  };
}

function normalizeKpis(value: unknown): GoogleAdsDashboardKpis {
  const source = record(value);
  return {
    sessions: count(pick(source, "sessions", "session_count")),
    engagedSessions: count(pick(source, "engagedSessions", "engaged_sessions")),
    totalEngagedMs: aggregateMilliseconds(
      pick(source, "totalEngagedMs", "total_engaged_ms", "engagedMs", "engaged_ms"),
    ),
    averageEngagedMs: milliseconds(
      pick(source, "averageEngagedMs", "average_engaged_ms", "avgEngagedMs", "avg_engaged_ms"),
    ),
    consultationCtaSessions: count(
      pick(source, "consultationCtaSessions", "consultation_cta_sessions"),
    ),
    formStarts: count(
      pick(source, "formStarts", "form_starts", "formStartSessions", "form_start_sessions"),
    ),
    consultationRequests: count(
      pick(source, "consultationRequests", "consultation_requests", "consultationsSubmitted", "consultations_submitted"),
    ),
    consultationOpportunities: count(
      pick(source, "consultationOpportunities", "consultation_opportunities"),
    ),
    bookedConsultations: count(
      pick(source, "bookedConsultations", "booked_consultations", "bookings", "booked"),
    ),
    paidTherapyConversions: count(
      pick(source, "paidTherapyConversions", "paid_therapy_conversions", "paidTherapy", "paid_therapy"),
    ),
    sessionsWithoutEvents: count(
      pick(source, "sessionsWithoutEvents", "sessions_without_events"),
    ),
    attributedSessions: count(
      pick(source, "attributedSessions", "attributed_sessions"),
    ),
  };
}

function defaultFunnel(kpis: GoogleAdsDashboardKpis): GoogleAdsFunnelStage[] {
  return [
    ["sessions", "Ad sessions", kpis.sessions],
    ["engaged_sessions", "Engaged sessions", kpis.engagedSessions],
    ["consultation_cta", "Consultation CTA", kpis.consultationCtaSessions],
    ["form_starts", "Form starts", kpis.formStarts],
    ["consultation_requests", "Confirmed requests", kpis.consultationRequests],
    ["booked_consultations", "Consultations booked", kpis.bookedConsultations],
    ["paid_therapy", "Paid therapy", kpis.paidTherapyConversions],
  ].map(([key, label, rawCount]) => ({
    key: String(key),
    label: String(label),
    count: Number(rawCount),
    sessionRate: percent(undefined, Number(rawCount), kpis.sessions),
  }));
}

function normalizeFunnel(value: unknown, kpis: GoogleAdsDashboardKpis): GoogleAdsFunnelStage[] {
  const normalized = array(value)
    .slice(0, 20)
    .map((item) => {
      const source = record(item);
      const key = safeText(pick(source, "key", "event", "stage"), 60);
      if (!key) return null;
      const stageCount = count(pick(source, "count", "sessions"));
      return {
        key,
        label: safeText(source.label, 80) || key.replaceAll("_", " "),
        count: stageCount,
        sessionRate: percent(
          pick(source, "sessionRate", "session_rate", "rate", "conversionRate", "conversion_rate"),
          stageCount,
          kpis.sessions,
        ),
      };
    })
    .filter((item): item is GoogleAdsFunnelStage => Boolean(item));
  return normalized.length ? normalized : defaultFunnel(kpis);
}

function normalizePages(value: unknown): GoogleAdsPageMetric[] {
  return array(value)
    .slice(0, 100)
    .map((item) => {
      const source = record(item);
      const pagePath = path(pick(source, "path", "page", "page_path"));
      return {
        path: pagePath,
        label: pageLabel(pagePath, source.label),
        sessions: count(pick(source, "sessions", "session_count")),
        views: count(pick(source, "views", "pageViews", "page_views", "events")),
        engagedMs: aggregateMilliseconds(
          pick(source, "engagedMs", "engaged_ms"),
        ),
        averageEngagedMs: milliseconds(
          pick(source, "averageEngagedMs", "average_engaged_ms", "avgEngagedMs", "avg_engaged_ms"),
        ),
        exits: count(pick(source, "exits", "exit_count")),
        consultationCtaSessions: count(
          pick(source, "consultationCtaSessions", "consultation_cta_sessions"),
        ),
        consultationRequests: count(
          pick(source, "consultationRequests", "consultation_requests", "consultationsSubmitted", "consultations_submitted"),
        ),
      };
    });
}

function normalizeSections(value: unknown): GoogleAdsSectionMetric[] {
  return array(value)
    .slice(0, 200)
    .map((item) => {
      const source = record(item);
      const sectionId = safeText(pick(source, "sectionId", "section_id", "section"), 24);
      if (!isGoogleAdsSectionId(sectionId)) return null;
      return {
        path: path(pick(source, "path", "page", "page_path")),
        sectionId,
        views: count(pick(source, "views", "events", "count")),
        sessions: count(pick(source, "sessions", "session_count")),
        engagedMs: aggregateMilliseconds(
          pick(source, "engagedMs", "engaged_ms"),
        ),
      };
    })
    .filter((item): item is GoogleAdsSectionMetric => Boolean(item));
}

function normalizeCampaigns(value: unknown): GoogleAdsCampaignMetric[] {
  return array(value)
    .slice(0, 100)
    .map((item) => {
      const source = record(item);
      const attribution = normalizeClickAttribution(source);
      return {
        source: attribution.source || "Not set",
        medium: attribution.medium || "Not set",
        campaign: googleAdsCampaignLabel(attribution) || "Not set",
        campaignId: attribution.campaignId,
        campaignName: attribution.campaignName,
        content: attribution.content,
        adGroupId: attribution.adGroupId,
        adGroupName: attribution.adGroupName,
        keyword: attribution.keyword,
        matchType: attribution.matchType,
        network: attribution.network,
        legacyContent: attribution.legacyContent,
        googleClickIdPresent: attribution.googleClickIdPresent,
        suffixReceived: attribution.suffixReceived,
        sessions: count(pick(source, "sessions", "session_count")),
        engagedSessions: count(pick(source, "engagedSessions", "engaged_sessions")),
        consultationCtaSessions: count(
          pick(source, "consultationCtaSessions", "consultation_cta_sessions"),
        ),
        formStarts: count(
          pick(source, "formStarts", "form_starts", "formStartSessions", "form_start_sessions"),
        ),
        consultationRequests: count(
          pick(source, "consultationRequests", "consultation_requests", "consultationsSubmitted", "consultations_submitted"),
        ),
        bookedConsultations: count(
          pick(source, "bookedConsultations", "booked_consultations", "bookings", "booked"),
        ),
        paidTherapyConversions: count(
          pick(source, "paidTherapyConversions", "paid_therapy_conversions", "paidTherapy", "paid_therapy"),
        ),
      };
    });
}

function normalizeActions(value: unknown): GoogleAdsActionMetric[] {
  return array(value)
    .slice(0, GOOGLE_ADS_EVENT_NAMES.length)
    .map((item) => {
      const source = record(item);
      const name = eventName(pick(source, "event", "name"));
      if (!name) return null;
      return {
        event: name,
        label: safeText(source.label, 80) || EVENT_LABELS[name],
        sessions: count(pick(source, "sessions", "session_count")),
        events: count(pick(source, "events", "event_count", "count")),
      };
    })
    .filter((item): item is GoogleAdsActionMetric => Boolean(item));
}

function normalizeJourneyEvents(value: unknown, fallbackDate: string): GoogleAdsJourneyEvent[] {
  return array(value)
    .slice(0, 250)
    .map((item): GoogleAdsJourneyEvent | null => {
      const source = record(item);
      const name = eventName(pick(source, "name", "event", "event_name"));
      if (!name) return null;
      const eventPath = path(pick(source, "path", "page", "page_path"));
      const idValue = safeText(pick(source, "id", "eventId", "event_id"), 96);
      const sectionValue = safeText(pick(source, "section", "sectionId", "section_id"), 24);
      const targetPathValue = pick(source, "targetPath", "target_path");
      const targetIdValue = safeText(pick(source, "targetId", "target_id"), 80);
      const reference = safeText(
        pick(source, "consultationReferenceId", "consultation_reference_id", "submissionReference", "submission_reference"),
        48,
      );
      const depth = count(pick(source, "scrollDepth", "scroll_depth"));
      const step = count(pick(source, "formStep", "form_step"));
      return {
        id: googleAdsEventIdIsValid(idValue) ? idValue : undefined,
        sequence: pick(source, "sequence") === undefined
          ? undefined
          : count(source.sequence),
        name,
        occurredAt: date(pick(source, "occurredAt", "occurred_at", "createdAt", "created_at"), fallbackDate),
        path: eventPath,
        section: isGoogleAdsSectionId(sectionValue) ? sectionValue : undefined,
        targetType: targetType(pick(source, "targetType", "target_type")),
        targetId: TARGET_IDS.has(targetIdValue) ? targetIdValue : undefined,
        targetPath: targetPathValue === undefined ? undefined : path(targetPathValue),
        ctaPlacement: safeText(pick(source, "ctaPlacement", "cta_placement"), 80) || undefined,
        therapistId: /^[-a-z0-9]{1,80}$/.test(
          safeText(pick(source, "therapistId", "therapist_id"), 80),
        )
          ? safeText(pick(source, "therapistId", "therapist_id"), 80)
          : undefined,
        engagedMs: pick(source, "engagedMs", "engaged_ms") === undefined
          ? undefined
          : milliseconds(pick(source, "engagedMs", "engaged_ms")),
        scrollDepth: [25, 50, 75, 100].includes(depth)
          ? (depth as 25 | 50 | 75 | 100)
          : undefined,
        formStep: step === 1 || step === 2 ? step : undefined,
        consultationReferenceId: confirmedConsultationReferenceIsValid(reference)
          ? reference
          : undefined,
      };
    })
    .filter((item): item is GoogleAdsJourneyEvent => Boolean(item))
    .sort((left, right) =>
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
      (left.sequence ?? 0) - (right.sequence ?? 0),
    );
}

function normalizeRecentSessions(value: unknown, fallbackDate: string): GoogleAdsJourneySummary[] {
  return array(value)
    .slice(0, 100)
    .map((item): GoogleAdsJourneySummary | null => {
      const source = record(item);
      const sessionId = safeText(pick(source, "sessionId", "session_id", "sessionKey", "session_key"), 96);
      if (!googleAdsSessionIdIsValid(sessionId)) return null;
      const startedAt = date(pick(source, "startedAt", "started_at"), fallbackDate);
      const lastSeenAt = date(pick(source, "lastSeenAt", "last_seen_at"), startedAt);
      const reference = safeText(
        pick(source, "consultationReferenceId", "consultation_reference_id", "submissionReference", "submission_reference"),
        48,
      );
      const suppliedDuration = pick(source, "durationMs", "duration_ms");
      const durationMs =
        suppliedDuration === undefined
          ? Math.max(0, Date.parse(lastSeenAt) - Date.parse(startedAt))
          : milliseconds(suppliedDuration);
      const maxScroll = count(pick(source, "maxScrollDepth", "max_scroll_depth"));
      return {
        sessionId,
        startedAt,
        lastSeenAt,
        durationMs,
        seededAt: optionalDate(pick(source, "seededAt", "seeded_at")),
        landingPath: path(pick(source, "landingPath", "landing_path")),
        lastPath: path(pick(source, "lastPath", "last_path")),
        engagedMs: milliseconds(pick(source, "engagedMs", "engaged_ms")),
        maxScrollDepth: [25, 50, 75, 100].includes(maxScroll) ? maxScroll : 0,
        eventCount: count(pick(source, "eventCount", "event_count")),
        device: ["mobile", "tablet", "desktop"].includes(
          safeText(pick(source, "device", "deviceCategory", "device_category"), 12),
        )
          ? (safeText(pick(source, "device", "deviceCategory", "device_category"), 12) as "mobile" | "tablet" | "desktop")
          : undefined,
        consultationCtaClicked: bool(
          pick(source, "consultationCtaClicked", "consultation_cta_clicked"),
        ),
        formStarted: bool(pick(source, "formStarted", "form_started")),
        consultationSubmitted: bool(
          pick(source, "consultationSubmitted", "consultation_submitted"),
        ),
        consultationReferenceId: confirmedConsultationReferenceIsValid(reference)
          ? reference
          : undefined,
        booked: bool(pick(source, "booked", "consultationBooked", "consultation_booked")),
        paidTherapy: bool(pick(source, "paidTherapy", "paid_therapy")),
        attribution: normalizeClickAttribution(record(source.attribution), source),
        events: normalizeJourneyEvents(
          pick(source, "events", "timeline", "recentEvents", "recent_events"),
          startedAt,
        ),
      };
    })
    .filter((item): item is GoogleAdsJourneySummary => Boolean(item))
    .sort(
      (left, right) =>
        Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt),
    );
}

function unwrapped(value: unknown): UnknownRecord {
  if (Array.isArray(value) && value.length === 1) return record(value[0]);
  return record(value);
}

export function emptyGoogleAdsDashboard(range: { from: string; to: string }): GoogleAdsDashboardData {
  const now = new Date().toISOString();
  const normalizedRange = {
    from: date(range.from, now),
    to: date(range.to, now),
  };
  const kpis = fallbackKpis();
  return {
    generatedAt: now,
    range: normalizedRange,
    kpis,
    funnel: defaultFunnel(kpis),
    pages: [],
    sections: [],
    campaigns: [],
    actions: [],
    recentSessions: [],
  };
}

/**
 * Creates a strict, display-only view of the RPC payload. Unknown keys are
 * intentionally discarded so contact fields or intake answers can never leak
 * into this anonymous analytics surface if the database response evolves.
 */
export function normalizeGoogleAdsDashboard(
  value: unknown,
  fallbackRange: { from: string; to: string },
): GoogleAdsDashboardData {
  const source = unwrapped(value);
  const suppliedRange = record(source.range);
  const normalizedRange = {
    from: date(pick(suppliedRange, "from", "start", "startAt", "start_at"), fallbackRange.from),
    to: date(pick(suppliedRange, "to", "end", "endAt", "end_at"), fallbackRange.to),
  };
  const kpis = normalizeKpis(pick(source, "kpis", "summary"));
  return {
    generatedAt: date(pick(source, "generatedAt", "generated_at"), new Date().toISOString()),
    range: normalizedRange,
    kpis,
    funnel: normalizeFunnel(source.funnel, kpis),
    pages: normalizePages(pick(source, "pages", "pagePerformance", "page_performance")),
    sections: normalizeSections(source.sections),
    campaigns: normalizeCampaigns(
      pick(source, "campaigns", "campaignPerformance", "campaign_performance"),
    ),
    actions: normalizeActions(
      pick(source, "actions", "actionPerformance", "action_performance"),
    ),
    recentSessions: normalizeRecentSessions(
      pick(source, "recentSessions", "recent_sessions", "journeys"),
      normalizedRange.from,
    ),
  };
}

/** Human campaign label: advertiser name first, then the raw dimension. */
export function googleAdsCampaignLabel(
  attribution: Pick<GoogleAdsClickAttribution, "campaign" | "campaignId" | "campaignName">,
): string | undefined {
  if (attribution.campaignName) return attribution.campaignName;
  if (attribution.campaign && !safeGoogleAdsNumericId(attribution.campaign)) {
    return attribution.campaign;
  }
  if (attribution.campaignId) return `Campaign ${attribution.campaignId}`;
  return attribution.campaign || undefined;
}

export function googleAdsMatchTypeLabel(value?: GoogleAdsMatchType): string | undefined {
  return value ? GOOGLE_ADS_MATCH_TYPE_LABELS[value] : undefined;
}

export function googleAdsNetworkLabel(value?: GoogleAdsNetwork): string | undefined {
  return value ? GOOGLE_ADS_NETWORK_LABELS[value] : undefined;
}

export function googleAdsEventLabel(event: GoogleAdsEventName): string {
  return EVENT_LABELS[event];
}

export function googleAdsPageLabel(pagePath: string): string {
  return pageLabel(path(pagePath));
}

/**
 * Converts the stable, privacy-safe DOM section number into a compact label for
 * the CRM. Numbers stay visible so existing reports and screenshots continue
 * to reference the same section.
 */
export function googleAdsSectionLabel(
  pagePath: string,
  sectionId: string,
): string {
  const normalizedPath = path(pagePath);
  const match = /^section-(\d{2})$/.exec(sectionId);
  if (!match) return "Page content area";
  const sectionIndex = Number.parseInt(match[1], 10) - 1;
  let labels = SECTION_LABELS[normalizedPath];
  if (!labels && normalizedPath.startsWith("/therapists/")) {
    labels = THERAPIST_PROFILE_SECTION_LABELS;
  } else if (!labels && (normalizedPath.startsWith("/lp/") || normalizedPath === "/welcome")) {
    labels = PAID_LANDING_SECTION_LABELS;
  } else if (!labels && SPECIALTY_PAGE_PATTERN.test(normalizedPath)) {
    labels = SPECIALTY_SECTION_LABELS;
  }
  return labels?.[sectionIndex] || `${googleAdsPageLabel(normalizedPath)} content area`;
}

export function googleAdsSectionReference(
  pagePath: string,
  sectionId: string,
): string {
  const number = /^section-(\d{2})$/.exec(sectionId)?.[1] || sectionId;
  return `Section ${number} — ${googleAdsSectionLabel(pagePath, sectionId)}`;
}
