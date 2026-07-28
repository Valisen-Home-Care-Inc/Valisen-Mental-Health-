import type { Dimension } from "@/lib/quiz";

export const CLINIC_JANE_BOOKING_URL =
  "https://valisenmentalhealth.janeapp.com/";
/** Clinic-wide range, including the planned lower-priced therapist. */
export const THERAPY_SESSION_PRICE_MINIMUM = 160;
export const THERAPY_SESSION_PRICE_MAXIMUM = 180;
/** Exact fee for every therapist currently shown on the public roster. */
export const CURRENT_THERAPIST_SESSION_PRICE = 180;
export const THERAPY_SESSION_DURATION_MINUTES = 50;
export const CONSULTATION_PRICE = 0;
export const CONSULTATION_DURATION_MINUTES = 20;
export const THERAPY_PRICE_RANGE = `$${THERAPY_SESSION_PRICE_MINIMUM}–$${THERAPY_SESSION_PRICE_MAXIMUM} per ${THERAPY_SESSION_DURATION_MINUTES} minutes`;
export const SESSION_RATE = `$${CURRENT_THERAPIST_SESSION_PRICE} per ${THERAPY_SESSION_DURATION_MINUTES} minutes`;
export const SESSION_FEE_LABEL = `Paid therapy session: ${SESSION_RATE}`;
export const CONSULTATION_LABEL = `Free ${CONSULTATION_DURATION_MINUTES}-minute consultation`;

/* ────────────────────────────────────────────────────────────────────────
 * Matching metadata (used by lib/matching.ts)
 *
 * Every value here must be VERIFIED — i.e. directly supported by the
 * therapist's own profile content below (specialties, areasOfSupport, bio
 * pronouns). Never add a tag a therapist hasn't listed.
 * `lastVerifiedAt` records when the metadata was last checked against the
 * profile content in this file.
 * ──────────────────────────────────────────────────────────────────────── */

/** User-selectable concern areas. Each maps to verified therapist experience. */
export type ConcernTag =
  | "anxiety"
  | "depression"
  | "stress-burnout"
  | "relationship-challenges"
  | "couples-therapy"
  | "trauma"
  | "adhd"
  | "perfectionism-people-pleasing"
  | "self-esteem"
  | "addiction"
  | "cultural-adjustment"
  | "life-transitions"
  | "grief";

export type MatchingProfile = {
  /** Sourced from the pronouns used in the therapist's own bio text. */
  gender: "man" | "woman";
  /** Concern areas verifiably listed in this therapist's specialties/areas of support. */
  concernTags: ConcernTag[];
  /** Quiz dimensions this therapist verifiably works with. */
  dimensions: Dimension[];
  /** All current therapists serve adults (18+) across Ontario. */
  populations: Array<"adults-18-plus" | "couples">;
  /** ISO date the metadata above was last verified against this profile. */
  lastVerifiedAt: string;
};

export type SupportArea = {
  title: string;
  description: string;
};

export type DetailItem = {
  label: string;
  value: string;
};

export type Therapist = {
  slug: string;
  name: string;
  credentials: string;
  credentialSummary: string;
  initials: string;
  availability: string;
  acceptingNewClients: boolean;
  profileUrl: string;
  consultationBookingUrl: string;
  usesClinicBookingFallback: boolean;
  janeStaffId?: string;
  consultationPrice: number;
  consultationDurationMinutes: number;
  consultationFormat: "Phone";
  therapySessionPriceMinimum: number;
  therapySessionPriceMaximum: number;
  therapySessionDurationMinutes: number;
  formats: Array<"Virtual" | "Telephone">;
  jurisdictions: string[];
  populationsServed: string[];
  approachStyles: Array<"Practical / structured" | "Reflective / exploratory">;
  rate: string;
  primaryConcerns: string;
  headline: string;
  cardStatement: string;
  specialties: string[];
  languages: string[];
  sessionTypes: string[];
  photo?: string;
  photoPosition?: string;
  carouselPhotoPosition?: string;
  featureLabel?: string;
  comingSoon?: boolean;
  /** Verified metadata consumed by the quiz matching engine. */
  matching: MatchingProfile;
  featuredHero: {
    badge: string;
    headline: string;
    description: string;
    secondaryLine?: string;
    ctaLabel: string;
  };
  intro: string[];
  areasOfSupport: SupportArea[];
  therapyStyle: {
    summary: string;
    paragraphs: string[];
    tags: string[];
  };
  credentialsList: DetailItem[];
  logistics: DetailItem[];
  languageSection?: {
    eyebrow: string;
    heading: string;
    mandarinHeading: string;
    paragraphs: string[];
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
};

function standardLogistics(
  sessionFormat = "Virtual therapy available across Ontario",
  provinceEligibility = "Ontario residents",
): DetailItem[] {
  return [
    { label: "Session Fee", value: SESSION_RATE },
    {
      label: "Free Consultation",
      value: "Book directly through Jane or call Valisen if you need help choosing a therapist",
    },
    { label: "Session Format", value: sessionFormat },
    { label: "Session Length", value: "50 minutes" },
    { label: "Availability", value: "Accepting new clients" },
    { label: "Receipts", value: "Receipts provided for insurance reimbursement where applicable" },
    { label: "Next Step", value: "Use the button below to book through Jane." },
    { label: "Province Eligibility", value: provinceEligibility },
  ];
}

const THERAPIST_DISPLAY_ORDER = [
  "ryann-simpson",
  "wilfred-bengnwi",
  "tim-kahtava",
  "dayong-quan",
];

export const therapists: Therapist[] = [
  {
    slug: "dayong-quan",
    name: "Dayong Quan",
    credentials: "Registered Psychotherapist, MACP",
    credentialSummary: "Registered Psychotherapist",
    initials: "DQ",
    photo: "/dayong-quan.jpg",
    comingSoon: false,
    availability: "Accepting new clients",
    acceptingNewClients: true,
    profileUrl: "/therapists/dayong-quan",
    consultationBookingUrl:
      "https://valisenmentalhealth.janeapp.com/#/staff_member/7",
    usesClinicBookingFallback: false,
    janeStaffId: "7",
    consultationPrice: CONSULTATION_PRICE,
    consultationDurationMinutes: CONSULTATION_DURATION_MINUTES,
    consultationFormat: "Phone",
    therapySessionPriceMinimum: CURRENT_THERAPIST_SESSION_PRICE,
    therapySessionPriceMaximum: CURRENT_THERAPIST_SESSION_PRICE,
    therapySessionDurationMinutes: THERAPY_SESSION_DURATION_MINUTES,
    formats: ["Virtual"],
    jurisdictions: ["Ontario"],
    populationsServed: ["Individual adults (18+)"],
    approachStyles: ["Practical / structured", "Reflective / exploratory"],
    matching: {
      gender: "man",
      concernTags: [
        "anxiety",
        "depression",
        "stress-burnout",
        "addiction",
        "cultural-adjustment",
        "life-transitions",
      ],
      dimensions: ["worry", "mood", "stress"],
      populations: ["adults-18-plus"],
      lastVerifiedAt: "2026-07-16",
    },
    rate: SESSION_RATE,
    primaryConcerns: "Anxiety, Stress, Life Transitions, and Cultural Adjustment",
    headline:
      "Mandarin and English Therapy for Anxiety, Stress, Life Transitions, Addiction, and Cultural Adjustment",
    cardStatement:
      "Dayong provides therapy in English and Mandarin, supporting clients with anxiety, stress, depression, addiction-related concerns, cultural adjustment, and life transitions. His background includes counselling psychology, addiction and mental health, autism and behaviour science, and extensive mindfulness and meditation experience.",
    specialties: [
      "Anxiety",
      "Depression",
      "Stress and burnout",
      "Addiction and mental health",
      "Mindfulness-based therapy",
      "Life transitions",
      "Cultural adjustment",
      "Behavioural concerns",
    ],
    languages: ["English", "Mandarin"],
    sessionTypes: ["Virtual therapy", "Ontario"],
    featureLabel: "Mandarin-speaking therapist",
    featuredHero: {
      badge: "Mandarin-speaking therapist",
      headline: "Mandarin and English Therapy for Anxiety, Stress, and Life Transitions",
      description:
        "Therapy available in English and Mandarin for adults navigating anxiety, burnout, addiction-related concerns, cultural adjustment, and major transitions.",
      secondaryLine: "提供普通话心理咨询服务",
      ctaLabel: "View Mandarin therapist profile",
    },
    intro: [
      "Many clients seek therapy when stress, emotional pressure, cultural adjustment, or major life changes become difficult to manage alone.",
      "Dayong works with adults navigating anxiety, depression, burnout, addiction-related concerns, and life transitions, with therapy available in both English and Mandarin.",
      "His clinical background includes counselling psychology, addiction and mental health, behaviour science, and community mental health support.",
    ],
    areasOfSupport: [
      {
        title: "Anxiety",
        description:
          "Support for worry, tension, overthinking, panic, and patterns that make daily life feel harder to manage.",
      },
      {
        title: "Depression",
        description:
          "Therapy for low mood, emotional heaviness, loss of motivation, and difficulty reconnecting with routines or relationships.",
      },
      {
        title: "Stress and Burnout",
        description:
          "Support for exhaustion, pressure, work strain, and the feeling that your usual coping strategies are no longer enough.",
      },
      {
        title: "Addiction and Mental Health",
        description:
          "Therapy for addiction-related concerns, emotional regulation, stress, and the mental health patterns that can sit underneath substance use.",
      },
      {
        title: "Mindfulness-Based Therapy",
        description:
          "Mindfulness-informed support shaped by more than 10 years of mindfulness experience and more than 20 years of meditation practice.",
      },
      {
        title: "Life Transitions",
        description:
          "Support through relocation, study, work changes, family pressure, identity shifts, and major decisions.",
      },
      {
        title: "Cultural Adjustment",
        description:
          "Therapy for immigration stress, cultural expectations, language transitions, family roles, and belonging.",
      },
      {
        title: "Behavioural Concerns",
        description:
          "Support informed by autism and behaviour science training, including practical attention to behaviour patterns and change.",
      },
    ],
    therapyStyle: {
      summary: "Calm, reflective, grounded, and practical.",
      paragraphs: [
        "Dayong's approach is calm, reflective, and grounded. He integrates counselling skills, mindfulness-informed support, and practical therapeutic strategies to help clients better understand their patterns, manage stress, and move forward with more clarity.",
        "Clients who prefer a thoughtful, steady pace may appreciate his focus on awareness, emotional regulation, and practical change.",
      ],
      tags: ["Mindfulness-informed", "Counselling psychology", "Addictions support", "Behaviour science"],
    },
    credentialsList: [
      { label: "Registration", value: "Registered Psychotherapist" },
      { label: "Degree", value: "Master of Arts in Counseling Psychology, Yorkville University" },
      { label: "Graduate Certificate", value: "Addictions and Mental Health with Honours, Humber College" },
      { label: "Graduate Certificate", value: "Autism and Behaviour Science, St. Clair College" },
      { label: "Graduate Degree", value: "Master of Science in Psychology, East China Normal University" },
      { label: "Additional Qualification", value: "Professional Qualification for Counselling in China" },
      { label: "Clinical Background", value: "Private, EAP, and community mental health psychotherapy experience" },
    ],
    logistics: standardLogistics(),
    languageSection: {
      eyebrow: "Therapy available in English and Mandarin",
      heading: "Mandarin-Speaking Therapist in Ontario",
      mandarinHeading: "提供普通话心理咨询服务",
      paragraphs: [
        "Dayong offers therapy in both English and Mandarin for clients navigating stress, anxiety, depression, addiction-related concerns, cultural adjustment, family expectations, and major life transitions.",
        "For Mandarin-speaking clients, therapy in Mandarin can make it easier to describe emotional pressure, family dynamics, migration stress, and personal concerns without translating every detail first.",
      ],
    },
    seo: {
      title: "Dayong Quan | Mandarin-Speaking Therapist in Ontario",
      description:
        "Dayong Quan offers therapy in English and Mandarin for anxiety, stress, depression, addiction-related concerns, mindfulness, cultural adjustment, and life transitions. Sessions are $180 per 50 minutes.",
      keywords: [
        "Mandarin-speaking therapist Ontario",
        "Chinese therapist Ontario",
        "Mandarin therapy Ontario",
        "Mandarin therapist for anxiety",
        "Mandarin therapist online Ontario",
      ],
    },
  },
  {
    slug: "wilfred-bengnwi",
    name: "Wilfred Bengnwi",
    photo: "/wilfred-bengnwi.png",
    credentials: "RP, M.A., PhD",
    credentialSummary: "Registered Psychotherapist",
    initials: "WB",
    availability: "Accepting new clients",
    acceptingNewClients: true,
    profileUrl: "/therapists/wilfred-bengnwi",
    consultationBookingUrl:
      "https://valisenmentalhealth.janeapp.com/#/staff_member/6",
    usesClinicBookingFallback: false,
    janeStaffId: "6",
    consultationPrice: CONSULTATION_PRICE,
    consultationDurationMinutes: CONSULTATION_DURATION_MINUTES,
    consultationFormat: "Phone",
    therapySessionPriceMinimum: CURRENT_THERAPIST_SESSION_PRICE,
    therapySessionPriceMaximum: CURRENT_THERAPIST_SESSION_PRICE,
    therapySessionDurationMinutes: THERAPY_SESSION_DURATION_MINUTES,
    formats: ["Virtual"],
    jurisdictions: ["Ontario"],
    populationsServed: ["Individuals", "Couples", "Families"],
    approachStyles: ["Practical / structured", "Reflective / exploratory"],
    matching: {
      gender: "man",
      concernTags: [
        "couples-therapy",
        "relationship-challenges",
        "trauma",
        "anxiety",
        "addiction",
      ],
      dimensions: ["relationships", "worry"],
      populations: ["adults-18-plus", "couples"],
      lastVerifiedAt: "2026-07-16",
    },
    rate: SESSION_RATE,
    primaryConcerns: "Couples, Relationship Repair, Trauma, and Attachment Injuries",
    headline:
      "Couples, Relationship Repair, Trauma-Informed Therapy, and Attachment-Based Support",
    cardStatement:
      "Wilfred works with individuals, couples, and families navigating relationship distress, attachment injuries, emotional infidelity, trauma, addiction-related concerns, and major life transitions.",
    specialties: [
      "Couples therapy",
      "Relationship challenges",
      "Emotional infidelity recovery",
      "Attachment injuries",
      "Trauma",
      "Anxiety",
      "Youth and adult mental health",
      "Addiction and substance use",
    ],
    languages: ["English", "French"],
    sessionTypes: ["Virtual therapy", "Ontario"],
    featuredHero: {
      badge: "Couples and relationship therapy",
      headline: "Therapy for Couples, Relationship Repair, and Trauma",
      description:
        "Support for couples and individuals navigating relationship distress, emotional infidelity, attachment injuries, trauma, and major life transitions.",
      ctaLabel: "View Wilfred's profile",
    },
    intro: [
      "Relationship difficulties can affect every part of life, especially when trust, communication, emotional safety, or past injuries remain unresolved.",
      "Wilfred works with individuals and couples seeking support with relational repair, trauma, emotional regulation, and attachment-based concerns.",
      "His background includes clinical leadership, supervision, addiction and mental health recovery, and therapy with individuals, couples, families, and groups.",
    ],
    areasOfSupport: [
      {
        title: "Couples Therapy",
        description:
          "Support for couples working through communication breakdowns, recurring conflict, trust concerns, and disconnection.",
      },
      {
        title: "Relationship Challenges",
        description:
          "Therapy for relational patterns, emotional distance, repair conversations, and healthier ways of relating.",
      },
      {
        title: "Emotional Infidelity Recovery",
        description:
          "Structured support for couples and individuals working through betrayal, secrecy, repair, and rebuilding trust.",
      },
      {
        title: "Attachment Injuries",
        description:
          "Support for unresolved emotional wounds that affect closeness, safety, communication, and conflict.",
      },
      {
        title: "Trauma",
        description:
          "Trauma-informed therapy for painful experiences, emotional regulation, and the relational impact of past injuries.",
      },
      {
        title: "Youth and Adult Mental Health",
        description:
          "Support for anxiety, emotional distress, family stress, crisis concerns, and major life transitions.",
      },
      {
        title: "Addiction and Substance Use",
        description:
          "Therapy informed by experience in addiction and mental health recovery settings.",
      },
      {
        title: "Family Therapy",
        description:
          "Support for family communication, repair, boundaries, and shared stressors.",
      },
    ],
    therapyStyle: {
      summary: "Relational, structured, attachment-informed, and repair-focused.",
      paragraphs: [
        "Wilfred's approach is relational, structured, and attachment-informed. He focuses on helping clients understand emotional patterns, repair trust, strengthen communication, and build healthier ways of relating.",
        "His work often helps clients slow down conflict cycles, identify what is happening underneath the surface, and create more workable conversations.",
      ],
      tags: ["Attachment-informed", "Trauma-informed", "Couples therapy", "Family therapy"],
    },
    credentialsList: [
      { label: "Registration", value: "Registered Psychotherapist" },
      { label: "Practice Status", value: "Qualified Independent Practitioner" },
      { label: "Clinical Experience", value: "5+ years of clinical experience; 4+ years specializing in couples therapy" },
      { label: "Leadership Experience", value: "Former Assistant Clinical Director and former Clinical Director in mental health and addiction recovery settings" },
      { label: "Degree", value: "Master of Arts in Spiritual Care and Psychotherapy, Wilfrid Laurier University" },
      { label: "Doctoral Degree", value: "PhD in Public Administration" },
      { label: "Undergraduate Degree", value: "Bachelor of Science Honours in Molecular Medicine" },
    ],
    logistics: standardLogistics(),
    seo: {
      title: "Wilfred Bengnwi | Couples Therapist and Registered Psychotherapist",
      description:
        "Wilfred Bengnwi, RP, M.A., PhD, provides therapy for couples, relationship repair, emotional infidelity recovery, trauma, attachment injuries, youth and adult mental health. Sessions are $180 per 50 minutes.",
      keywords: [
        "couples therapist Ontario",
        "relationship therapist Ontario",
        "emotional infidelity recovery therapy",
        "attachment injuries therapy",
        "registered psychotherapist Ontario",
      ],
    },
  },
  {
    slug: "tim-kahtava",
    name: "Tim Kahtava",
    credentials: "Registered Psychotherapist",
    credentialSummary: "Registered Psychotherapist",
    initials: "TK",
    photo: "/tim-kahtava.jpg",
    carouselPhotoPosition: "center -10px",
    availability: "Accepting new clients",
    acceptingNewClients: true,
    profileUrl: "/therapists/tim-kahtava",
    consultationBookingUrl:
      "https://valisenmentalhealth.janeapp.com/#/staff_member/5",
    usesClinicBookingFallback: false,
    janeStaffId: "5",
    consultationPrice: CONSULTATION_PRICE,
    consultationDurationMinutes: CONSULTATION_DURATION_MINUTES,
    consultationFormat: "Phone",
    therapySessionPriceMinimum: CURRENT_THERAPIST_SESSION_PRICE,
    therapySessionPriceMaximum: CURRENT_THERAPIST_SESSION_PRICE,
    therapySessionDurationMinutes: THERAPY_SESSION_DURATION_MINUTES,
    formats: ["Virtual"],
    jurisdictions: ["Ontario"],
    populationsServed: ["Individuals", "Couples", "Families"],
    approachStyles: ["Practical / structured"],
    matching: {
      gender: "man",
      concernTags: [
        "anxiety",
        "depression",
        "trauma",
        "couples-therapy",
        "relationship-challenges",
        "stress-burnout",
        "life-transitions",
        "grief",
      ],
      dimensions: ["worry", "mood", "stress", "relationships"],
      populations: ["adults-18-plus", "couples"],
      lastVerifiedAt: "2026-07-16",
    },
    rate: SESSION_RATE,
    primaryConcerns: "Anxiety, Depression, Trauma, Couples, and Family Support",
    headline:
      "Experienced Therapy for Individuals, Couples, and Families Using Practical CBT, DBT, EMDR, and Solution-Focused Strategies",
    cardStatement:
      "Tim is a Registered Psychotherapist with over 20 years of experience supporting individuals, couples, and families. His approach is practical, collaborative, and focused on helping clients build emotional resilience and workable coping strategies.",
    specialties: [
      "Anxiety",
      "Depression",
      "Trauma",
      "Emotional resilience",
      "Couples therapy",
      "Family therapy",
      "Life transitions",
      "Practical coping skills",
    ],
    languages: ["English"],
    sessionTypes: ["Virtual therapy", "Ontario"],
    featuredHero: {
      badge: "20+ years experience",
      headline: "Practical Therapy for Individuals, Couples, and Families",
      description:
        "Support for anxiety, depression, trauma, emotional resilience, family concerns, and life transitions using practical therapeutic strategies.",
      ctaLabel: "View Tim's profile",
    },
    intro: [
      "Therapy can be especially useful when old coping patterns stop working or when stress, conflict, grief, or emotional pain begins to interfere with daily life.",
      "Tim works collaboratively with clients to clarify goals, build practical skills, and support meaningful change.",
      "He brings more than 20 years of experience supporting individuals, couples, and families, including extensive virtual therapy and EAP-related counselling experience.",
    ],
    areasOfSupport: [
      {
        title: "Anxiety",
        description:
          "Support for worry, panic, rumination, stress responses, and the habits that can keep anxiety active.",
      },
      {
        title: "Depression",
        description:
          "Therapy for low mood, loss of motivation, isolation, and rebuilding routines that support emotional resilience.",
      },
      {
        title: "Trauma",
        description:
          "Support informed by EMDR and practical stabilization strategies for clients processing difficult experiences.",
      },
      {
        title: "Emotional Resilience",
        description:
          "Work on emotional regulation, coping skills, self-understanding, and steadier responses to stress.",
      },
      {
        title: "Couples Therapy",
        description:
          "Support for communication, conflict, relationship stress, and practical steps toward healthier interaction.",
      },
      {
        title: "Family Therapy",
        description:
          "Therapy for family communication, transitions, relational strain, and shared stressors.",
      },
      {
        title: "Life Transitions",
        description:
          "Support through change, uncertainty, grief, identity shifts, and new responsibilities.",
      },
      {
        title: "Virtual Therapy",
        description:
          "Experienced online therapy support for clients who prefer or require virtual sessions.",
      },
    ],
    therapyStyle: {
      summary: "Approachable, practical, collaborative, and skills-focused.",
      paragraphs: [
        "Tim's style is approachable, practical, and collaborative. He draws from CBT, DBT, EMDR, and solution-focused approaches to help clients develop strategies they can use beyond the therapy room.",
        "Sessions are goal-aware without feeling rigid, with attention to both immediate coping and longer-term change.",
      ],
      tags: ["CBT", "DBT", "EMDR", "Solution-focused therapy"],
    },
    credentialsList: [
      { label: "Registration", value: "Registered Psychotherapist in Ontario" },
      { label: "Experience", value: "20+ years supporting individuals, couples, and families" },
      { label: "Clinical Background", value: "Private psychotherapy experience from 2020 to present" },
      { label: "Prior Role", value: "Former director and therapist with Northshore Counselling Centre, 1997 to 2020" },
      { label: "Training", value: "CBT Practitioner course certificate, 2023" },
      { label: "Approaches", value: "CBT, DBT, EMDR, and solution-focused therapy" },
      { label: "Education", value: "Master of Divinity; BA in Psychology" },
    ],
    logistics: standardLogistics(),
    seo: {
      title: "Tim Kahtava | Registered Psychotherapist in Ontario",
      description:
        "Tim Kahtava is a Registered Psychotherapist in Ontario with over 20 years of experience supporting individuals, couples, and families through CBT, DBT, EMDR, and solution-focused therapy. Sessions are $180 per 50 minutes.",
      keywords: [
        "Registered Psychotherapist Ontario",
        "CBT therapist Ontario",
        "DBT therapist Ontario",
        "EMDR therapist Ontario",
        "virtual therapy Ontario",
      ],
    },
  },
  {
    slug: "ryann-simpson",
    name: "Ryann Simpson",
    credentials: "Registered Social Worker (RSW)",
    credentialSummary: "Registered Social Worker",
    initials: "RS",
    photo: "/ryann-simpson.png",
    comingSoon: false,
    availability: "Accepting new clients",
    acceptingNewClients: true,
    profileUrl: "/therapists/ryann-simpson",
    consultationBookingUrl:
      "https://valisenmentalhealth.janeapp.com/#/staff_member/8",
    usesClinicBookingFallback: false,
    janeStaffId: "8",
    consultationPrice: CONSULTATION_PRICE,
    consultationDurationMinutes: CONSULTATION_DURATION_MINUTES,
    consultationFormat: "Phone",
    therapySessionPriceMinimum: CURRENT_THERAPIST_SESSION_PRICE,
    therapySessionPriceMaximum: CURRENT_THERAPIST_SESSION_PRICE,
    therapySessionDurationMinutes: THERAPY_SESSION_DURATION_MINUTES,
    formats: ["Virtual", "Telephone"],
    jurisdictions: ["Ontario", "Saskatchewan"],
    populationsServed: ["Individual adults (18+)", "Couples"],
    approachStyles: ["Practical / structured", "Reflective / exploratory"],
    matching: {
      gender: "woman",
      concernTags: [
        "anxiety",
        "relationship-challenges",
        "couples-therapy",
        "perfectionism-people-pleasing",
        "adhd",
        "self-esteem",
        "stress-burnout",
        "life-transitions",
      ],
      dimensions: ["worry", "stress", "relationships"],
      populations: ["adults-18-plus", "couples"],
      lastVerifiedAt: "2026-07-16",
    },
    rate: SESSION_RATE,
    primaryConcerns: "Anxiety, Perfectionism, People-Pleasing, ADHD, and Self-Esteem",
    headline:
      "Virtual and Telephone Therapy for Anxiety, Perfectionism, People-Pleasing, ADHD, and Self-Esteem",
    cardStatement:
      "Ryann is a Registered Social Worker offering virtual and telephone therapy to individual adults and couples in Ontario and Saskatchewan. She works with clients navigating anxiety, relationship challenges, people-pleasing, perfectionism, ADHD, self-esteem concerns, and major life transitions, with a focus on real insight, practical tools, and understanding the patterns that shape you.",
    specialties: [
      "Anxiety",
      "Relationship challenges",
      "People-pleasing",
      "Perfectionism",
      "ADHD",
      "Self-esteem",
      "Life transitions",
      "Stress and burnout",
    ],
    languages: ["English"],
    sessionTypes: ["Virtual therapy", "Telephone therapy", "Ontario and Saskatchewan"],
    featuredHero: {
      badge: "Anxiety, ADHD and perfectionism",
      headline: "Therapy for Anxiety, Perfectionism, People-Pleasing, and ADHD",
      description:
        "Virtual and telephone therapy in Ontario and Saskatchewan for individual adults and couples navigating anxiety, perfectionism, people-pleasing, ADHD, self-esteem, and major life transitions.",
      ctaLabel: "View Ryann's profile",
    },
    intro: [
      "Ryann Simpson is a Registered Social Worker (RSW) who offers virtual and telephone therapy to individual adults (18+) and couples in Ontario and Saskatchewan. She's drawn to exploring how we process, what shapes us, and the behavioural patterns that quietly run the show — approaching each client with curiosity and a genuine desire to understand what resonates for them.",
      "Ryann believes therapy should offer more than a good listener — it should provide real insight, tools, and strategies you can actually use. Many of the clients she works with want a connection that feels right, and to leave sessions with something tangible: understanding why a pattern keeps repeating, or a clear next step toward where they want to be.",
      "She often works with people who describe themselves as self-aware, intuitive, intellectual, and emotionally attuned — people who may seem to have things together on the outside while struggling internally with anxiety, overwhelm, and self-criticism, and who want to understand what's really shaping their habits, decisions, and relationships.",
    ],
    areasOfSupport: [
      {
        title: "Anxiety",
        description:
          "Support for anxiety and overwhelm, including the internal struggle that can sit underneath a put-together exterior.",
      },
      {
        title: "Relationship Challenges",
        description:
          "Support for individuals and couples working through relationship patterns and communication difficulties.",
      },
      {
        title: "People-Pleasing",
        description:
          "Understanding the patterns behind people-pleasing and learning to build relationships that feel more authentic.",
      },
      {
        title: "Perfectionism",
        description:
          "Support for perfectionism and the self-criticism that often comes with it.",
      },
      {
        title: "ADHD",
        description:
          "Support for ADHD and the day-to-day patterns it shapes, including executive functioning.",
      },
      {
        title: "Self-Esteem",
        description:
          "Building a steadier, more self-aware relationship with yourself.",
      },
      {
        title: "Life Transitions",
        description:
          "Support through major life transitions and the uncertainty that can come with change.",
      },
      {
        title: "Stress and Burnout",
        description:
          "Support for stress and burnout, and rebuilding sustainable ways of coping.",
      },
      {
        title: "Boundaries and Communication",
        description:
          "Developing boundaries and communication skills that support healthier relationships.",
      },
      {
        title: "Executive Functioning and Overthinking",
        description:
          "Practical support for executive functioning difficulties and patterns of overthinking.",
      },
    ],
    therapyStyle: {
      summary: "Curious, insight-driven, and focused on what resonates for you.",
      paragraphs: [
        "Ryann approaches clients with curiosity, a desire to understand, and a focus on what resonates for them. She believes therapy should offer more than a good listener — it should also provide real insight, tools, and strategies you can work with.",
        "Clients often want a connection that feels right, and to be able to take something away — whether that's understanding why you keep repeating the same pattern, or learning how to take tangible steps toward where you want to be. She often works with deep thinkers and feelers, including those who consider themselves highly sensitive persons.",
      ],
      tags: ["Insight-focused", "Curiosity-driven", "Individual and couples therapy", "Works with HSPs and deep feelers"],
    },
    credentialsList: [
      { label: "Registration", value: "Registered Social Worker (RSW)" },
      { label: "Client Population", value: "Individual adults (18+) and couples" },
    ],
    logistics: standardLogistics(
      "Virtual and telephone therapy available across Ontario and Saskatchewan",
      "Ontario and Saskatchewan residents",
    ),
    seo: {
      title: "Ryann Simpson | RSW Therapist in Ontario and Saskatchewan",
      description:
        "Ryann Simpson, RSW, offers virtual and telephone therapy for individual adults and couples in Ontario and Saskatchewan navigating anxiety, perfectionism, people-pleasing, ADHD, self-esteem, and life transitions. Sessions are $180 per 50 minutes.",
      keywords: [
        "RSW therapist Ontario",
        "RSW therapist Saskatchewan",
        "ADHD therapist Ontario",
        "perfectionism therapy Ontario",
        "people pleasing therapy Ontario",
        "highly sensitive person therapist Ontario",
        "telephone therapy Ontario",
      ],
    },
  },
];

therapists.sort(
  (a, b) =>
    THERAPIST_DISPLAY_ORDER.indexOf(a.slug) - THERAPIST_DISPLAY_ORDER.indexOf(b.slug),
);

export function getTherapistBySlug(slug: string) {
  return therapists.find((therapist) => therapist.slug === slug);
}

/** Therapists currently shown to the public (not "coming soon"). */
export function getActiveTherapists(): Therapist[] {
  return therapists.filter((therapist) => !therapist.comingSoon);
}

export function getAcceptingTherapists(): Therapist[] {
  return getActiveTherapists().filter(
    (therapist) => therapist.acceptingNewClients,
  );
}

export function formatTherapySession(therapist: Therapist): string {
  const price =
    therapist.therapySessionPriceMinimum === therapist.therapySessionPriceMaximum
      ? `$${therapist.therapySessionPriceMaximum}`
      : `$${therapist.therapySessionPriceMinimum}–$${therapist.therapySessionPriceMaximum}`;
  return `${price} per ${therapist.therapySessionDurationMinutes} minutes`;
}

export function formatConsultation(therapist: Therapist): string {
  return therapist.consultationPrice === 0
    ? `Free ${therapist.consultationDurationMinutes}-minute consultation`
    : `$${therapist.consultationPrice} per ${therapist.consultationDurationMinutes} minutes`;
}

export function getTherapyPriceSummary(
  roster: Therapist[] = getActiveTherapists(),
): string {
  if (roster.length === 0) return "Contact Valisen for current fees";

  const durations = new Set(
    roster.map((therapist) => therapist.therapySessionDurationMinutes),
  );

  if (durations.size === 1) {
    return `Therapy sessions: $${THERAPY_SESSION_PRICE_MINIMUM}–$${THERAPY_SESSION_PRICE_MAXIMUM} per ${roster[0].therapySessionDurationMinutes} minutes`;
  }

  return `Therapy sessions: $${THERAPY_SESSION_PRICE_MINIMUM}–$${THERAPY_SESSION_PRICE_MAXIMUM}, depending on therapist and session type`;
}

export function getVerifiedLanguages(
  roster: Therapist[] = getActiveTherapists(),
): string[] {
  return Array.from(
    new Set(
      roster.flatMap((therapist) =>
        therapist.languages.filter((language) => language !== "普通话"),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));
}
