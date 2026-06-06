export const SESSION_RATE = "$180/hour";
export const SESSION_FEE_LABEL = `Session Fee: ${SESSION_RATE}`;

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

function standardLogistics(sessionFormat = "Virtual therapy available across Ontario"): DetailItem[] {
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
    { label: "Province Eligibility", value: "Ontario residents" },
  ];
}

export const therapists: Therapist[] = [
  {
    slug: "dayong-quan",
    name: "Dayong Quan",
    credentials: "Registered Psychotherapist, MACP",
    credentialSummary: "Registered Psychotherapist",
    initials: "DQ",
    photo: "/dayong-quan.png",
    comingSoon: true,
    availability: "Coming soon",
    acceptingNewClients: false,
    rate: SESSION_RATE,
    primaryConcerns: "Anxiety, Stress, Life Transitions, and Cultural Adjustment",
    headline:
      "Mandarin & English Therapy for Anxiety, Stress, Life Transitions, Addiction, and Cultural Adjustment",
    cardStatement:
      "Dayong provides therapy in English and Mandarin, supporting clients with anxiety, stress, depression, addiction-related concerns, cultural adjustment, and life transitions. His background includes counselling psychology, addiction and mental health, autism and behaviour science, and extensive mindfulness and meditation experience.",
    specialties: [
      "Anxiety",
      "Depression",
      "Stress & burnout",
      "Addiction and mental health",
      "Mindfulness-based therapy",
      "Life transitions",
      "Cultural adjustment",
      "Behavioural concerns",
    ],
    languages: ["Mandarin", "English", "普通话"],
    sessionTypes: ["Virtual therapy", "Ontario"],
    featureLabel: "Mandarin-speaking therapist",
    featuredHero: {
      badge: "Mandarin-speaking therapist",
      headline: "Mandarin & English Therapy for Anxiety, Stress, and Life Transitions",
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
        title: "Stress & Burnout",
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
      { label: "Graduate Certificate", value: "Addictions & Mental Health with Honours, Humber College" },
      { label: "Graduate Certificate", value: "Autism & Behaviour Science, St. Clair College" },
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
        "Dayong Quan offers therapy in English and Mandarin for anxiety, stress, depression, addiction-related concerns, mindfulness, cultural adjustment, and life transitions. Sessions are $180/hour.",
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
    languages: ["English"],
    sessionTypes: ["Virtual therapy", "Ontario"],
    featuredHero: {
      badge: "Couples & relationship therapy",
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
      { label: "Degree", value: "Master of Arts in Spiritual Care & Psychotherapy, Wilfrid Laurier University" },
      { label: "Doctoral Degree", value: "PhD in Public Administration" },
      { label: "Undergraduate Degree", value: "Bachelor of Science Honours in Molecular Medicine" },
    ],
    logistics: standardLogistics(),
    seo: {
      title: "Wilfred Bengnwi | Couples Therapist & Registered Psychotherapist",
      description:
        "Wilfred Bengnwi, RP, M.A., PhD, provides therapy for couples, relationship repair, emotional infidelity recovery, trauma, attachment injuries, youth and adult mental health. Sessions are $180/hour.",
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
    credentials: "Registered Psychotherapist, Ontario RP #005895",
    credentialSummary: "Registered Psychotherapist",
    initials: "TK",
    photo: "/tim-kahtava.png",
    carouselPhotoPosition: "center -10px",
    availability: "Accepting new clients",
    acceptingNewClients: true,
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
      { label: "Registration", value: "Registered Psychotherapist in Ontario, registration #005895" },
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
        "Tim Kahtava is a Registered Psychotherapist in Ontario with over 20 years of experience supporting individuals, couples, and families through CBT, DBT, EMDR, and solution-focused therapy. Sessions are $180/hour.",
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
    slug: "natasha-azoulay",
    name: "Natasha Azoulay",
    credentials: "MSW, RSW",
    credentialSummary: "Registered Social Worker",
    initials: "NA",
    photo: "/natasha-azoulay.png",
    availability: "Accepting new clients",
    acceptingNewClients: true,
    rate: SESSION_RATE,
    primaryConcerns: "Trauma, Youth Mental Health, Families, Neurodiversity, and Complex Needs",
    headline:
      "Trauma-Informed Therapy Support for Youth, Adults, Families, Neurodiverse Clients, Veterans, and High-Risk Populations",
    cardStatement:
      "Natasha is a Registered Social Worker with experience supporting youth, adults, families, veterans, and high-risk populations. Her work is trauma-informed, neurodiversity-affirming, and grounded in practical support for emotional regulation, anxiety, depression, and complex life challenges.",
    specialties: [
      "Trauma",
      "Anxiety",
      "Depression",
      "Youth mental health",
      "Family support",
      "Neurodiversity-affirming care",
      "Veterans' mental health",
      "Crisis support",
    ],
    languages: ["English", "French", "Hebrew", "Yiddish", "American Sign Language"],
    sessionTypes: ["Virtual therapy", "Ontario"],
    featuredHero: {
      badge: "Trauma-informed support",
      headline: "Therapy Support for Youth, Adults, Families, and Complex Needs",
      description:
        "Support for trauma, anxiety, depression, neurodiversity-related challenges, family stress, veterans' mental health, and emotional regulation.",
      ctaLabel: "View Natasha's profile",
    },
    intro: [
      "Clients often seek support when trauma, anxiety, family stress, neurodiversity-related challenges, or major life changes become difficult to manage alone.",
      "Natasha works with youth, adults, families, and high-risk populations using a trauma-informed and client-centred approach.",
      "As a Registered Social Worker, she provides therapy and psychotherapy support grounded in assessment, treatment planning, emotional regulation, and practical tools for complex needs.",
    ],
    areasOfSupport: [
      {
        title: "Trauma",
        description:
          "Trauma-informed assessment, treatment planning, and therapy support for clients managing the impact of difficult experiences.",
      },
      {
        title: "Anxiety",
        description:
          "Support for worry, panic, stress, avoidance, nervous system activation, and practical regulation strategies.",
      },
      {
        title: "Depression",
        description:
          "Therapy support for low mood, disconnection, low motivation, and the strain of managing daily responsibilities.",
      },
      {
        title: "Youth Mental Health",
        description:
          "Support for children, youth, teens, and families navigating emotional, behavioural, social, and developmental concerns.",
      },
      {
        title: "Family Support",
        description:
          "Work with families around communication, stress, safety planning, emotional regulation, and complex needs.",
      },
      {
        title: "Neurodiversity-Affirming Care",
        description:
          "Support for neurodiverse children, youth, and teens, including autism-related social and emotional needs.",
      },
      {
        title: "Veterans' Mental Health",
        description:
          "Support informed by experience with veterans facing complex addictions and mental health needs.",
      },
      {
        title: "Crisis Support",
        description:
          "Experience with suicide risk assessment, safety planning, and intervention through ASIST certification.",
      },
    ],
    therapyStyle: {
      summary: "Structured, supportive, trauma-informed, and practical.",
      paragraphs: [
        "Natasha's approach is structured, supportive, and trauma-informed. She focuses on assessment, emotional regulation, coping strategies, family systems, and practical tools that help clients navigate complex challenges with more stability.",
        "Her work is especially suited to clients and families managing layered concerns, including neurodiversity, trauma, addiction and mental health needs, adjustment stress, and crisis-related support.",
      ],
      tags: ["Trauma-informed", "Neurodiversity-affirming", "Family systems", "Crisis support"],
    },
    credentialsList: [
      { label: "Registration", value: "Registered Social Worker with the Ontario College of Social Workers and Social Service Workers" },
      { label: "Degree", value: "Master of Social Work, Carleton University" },
      { label: "Experience", value: "8+ years supporting youth, leading teams, and delivering psychotherapy support" },
      { label: "Clinical Background", value: "Individual and group counselling with children, youth, families, veterans, EAP clients, and high-risk populations" },
      { label: "Certification", value: "ASIST certification in suicide risk assessment, safety planning, and intervention" },
      { label: "Additional Training", value: "TA-TRPG certification for tabletop-style therapy tools for autism and social disabilities" },
      { label: "Publication", value: "First-author publication related to Circles of Support and Accountability" },
    ],
    logistics: standardLogistics(),
    seo: {
      title: "Natasha Azoulay | MSW, Registered Social Worker",
      description:
        "Natasha Azoulay, MSW, RSW, provides trauma-informed therapy support for youth, adults, families, veterans, neurodiverse clients, anxiety, depression, and complex life challenges. Sessions are $180/hour.",
      keywords: [
        "Registered Social Worker Ontario",
        "trauma-informed therapy Ontario",
        "youth mental health therapist Ontario",
        "neurodiversity affirming therapy Ontario",
        "veterans mental health therapy Ontario",
      ],
    },
  },
];

export function getTherapistBySlug(slug: string) {
  return therapists.find((therapist) => therapist.slug === slug);
}
