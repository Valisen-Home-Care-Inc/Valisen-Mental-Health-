import type { SpecificTherapistSlug } from "@/lib/intake";
import type { ConcernTag } from "@/lib/therapists";

export const PAID_SEARCH_LANDING_SLUGS = [
  "anxiety-therapy",
  "depression-therapy",
  "couples-therapy",
] as const;

export type PaidSearchLandingSlug =
  (typeof PAID_SEARCH_LANDING_SLUGS)[number];

export type PaidSearchLandingPageConfig = {
  slug: PaidSearchLandingSlug;
  organicCanonicalPath: string;
  title: string;
  description: string;
  concernTag: ConcernTag;
  therapistPriority: SpecificTherapistSlug[];
  specialtyKeywords: string[];
  tone: "individual" | "couples";
  hero: {
    heading: string;
    body: string;
    imageHeading: string;
    imageBody: string;
  };
  recognition: {
    eyebrow: string;
    heading: string;
    intro: string;
    signs: string[];
    closing: string;
  };
  therapists: {
    eyebrow: string;
    heading: string;
    intro: string;
  };
  howItWorks: Array<{
    title: string;
    body: string;
  }>;
  objections: Array<{
    question: string;
    answer: string;
  }>;
  specificFaqs: Array<{
    question: string;
    answer: string;
  }>;
  finalCta: {
    heading: string;
    body: string;
  };
};

export const paidSearchLandingPages: Record<
  PaidSearchLandingSlug,
  PaidSearchLandingPageConfig
> = {
  "anxiety-therapy": {
    slug: "anxiety-therapy",
    organicCanonicalPath: "/anxiety-therapy-ottawa",
    title: "Anxiety Therapy in Ontario | Free Consultation | Valisen",
    description:
      "Meet a regulated anxiety therapist online across Ontario. See current fees and availability, then request a free 20-minute consultation with Valisen.",
    concernTag: "anxiety",
    therapistPriority: [
      "ryann-simpson",
      "meryem-ibrahim",
      "dayong-quan",
      "tim-kahtava",
    ],
    specialtyKeywords: [
      "anxiety",
      "stress",
      "perfectionism",
      "emotional resilience",
      "mindfulness",
      "coping",
    ],
    tone: "individual",
    hero: {
      heading: "Anxiety therapy for when your mind won’t switch off.",
      body:
        "If worry, racing thoughts, panic, or overthinking are taking up too much room, online anxiety therapy can offer a private place to understand the loop and find more workable ways through it. Start by meeting an anxiety therapist who serves Ontario virtually.",
      imageHeading: "Therapists experienced in anxiety support",
      imageBody:
        "Compare approach, language, availability, and exact fees before you choose.",
    },
    recognition: {
      eyebrow: "When anxiety keeps taking over",
      heading: "Therapy may be worth considering if…",
      intro:
        "You do not need to wait for anxiety to become unbearable—or have a diagnosis—to talk with a therapist.",
      signs: [
        "You worry even when nothing is obviously wrong.",
        "You replay conversations or overthink everyday decisions.",
        "You feel constantly on edge or notice physical anxiety.",
        "Panic or racing thoughts make it hard to stay present.",
        "Your mind will not slow down at night or after work.",
        "You avoid situations because anxiety feels too difficult to manage.",
      ],
      closing:
        "Anxiety can show up at work, socially, in relationships, or as a constant background hum. Therapy can begin with the part that is most disruptive right now.",
    },
    therapists: {
      eyebrow: "Anxiety therapists in Ontario",
      heading: "Meet therapists with verified experience supporting anxiety.",
      intro:
        "Every therapist shown here lists anxiety in their current Valisen profile. Review the practical details, then use a free consultation to decide whether the fit feels right.",
    },
    howItWorks: [
      {
        title: "Request a free consultation",
        body:
          "Choose an anxiety therapist or select no preference, then share the times that generally work for you.",
      },
      {
        title: "Have a low-pressure conversation",
        body:
          "Use 20 minutes to ask about fit, fees, scheduling, and the worry, panic, or overthinking you want support with.",
      },
      {
        title: "Choose your next step",
        body:
          "If the conversation feels useful, arrange a full virtual therapy session. There is no obligation to continue.",
      },
    ],
    objections: [
      {
        question: "“I cannot explain why I feel anxious.”",
        answer:
          "You do not need a neat explanation. You can begin with what you notice—worry, tension, panic, avoidance, or a mind that rarely settles.",
      },
      {
        question: "“I am not sure what kind of therapy I need.”",
        answer:
          "That is okay. The consultation is a place to ask how a therapist works and whether their experience aligns with what you want help with.",
      },
      {
        question: "“I do not know which anxiety therapist to choose.”",
        answer:
          "Select “No preference — help me choose” on the consultation form and Valisen can help you compare the current team.",
      },
      {
        question: "“I have never been to therapy before.”",
        answer:
          "You do not need to prepare a detailed history or know exactly what to say before reaching out.",
      },
    ],
    specificFaqs: [
      {
        question: "Can therapy help with anxiety and overthinking?",
        answer:
          "Therapy can help you understand patterns around worry, rumination, panic, stress responses, and avoidance, then explore strategies suited to your situation. A consultation can help you decide whether a therapist’s approach fits what you are looking for.",
      },
      {
        question: "Do I need an anxiety diagnosis to start therapy?",
        answer:
          "No. You can contact Valisen without a diagnosis. A free consultation is not a diagnostic assessment; it is a brief conversation about fit, scheduling, fees, and what you would like support with.",
      },
    ],
    finalCta: {
      heading: "You do not have to quiet every thought before reaching out.",
      body:
        "Start with a private, free 20-minute conversation with a Valisen therapist who has experience supporting anxiety.",
    },
  },
  "depression-therapy": {
    slug: "depression-therapy",
    organicCanonicalPath: "/depression-therapy-ottawa",
    title: "Depression Therapy in Ontario | Free Consultation | Valisen",
    description:
      "Explore online depression therapy across Ontario with regulated Valisen therapists. See fees upfront and request a free 20-minute consultation.",
    concernTag: "depression",
    therapistPriority: [
      "meryem-ibrahim",
      "tim-kahtava",
      "dayong-quan",
    ],
    specialtyKeywords: [
      "depression",
      "emotional resilience",
      "grief",
      "life transitions",
      "stress",
      "coping",
    ],
    tone: "individual",
    hero: {
      heading: "When everything feels heavier, you do not have to work through it alone.",
      body:
        "Depression therapy can be a place to talk about low mood, numbness, lost motivation, or feeling unlike yourself—without needing to prove how hard things have become. Valisen offers virtual therapy for adults across Ontario.",
      imageHeading: "A gentler first step toward support",
      imageBody:
        "Meet therapists whose current profiles include depression and low-mood support.",
    },
    recognition: {
      eyebrow: "When the usual things feel harder",
      heading: "Therapy may be worth considering if…",
      intro:
        "Low mood does not look the same for everyone, and these experiences do not automatically mean you have depression.",
      signs: [
        "You feel emotionally flat, numb, or persistently low.",
        "You have lost interest in things you normally enjoy.",
        "Motivation is low, even for tasks that used to feel manageable.",
        "You feel disconnected from yourself or the people around you.",
        "Ordinary routines take far more energy than they used to.",
        "A sense of heaviness or isolation keeps following you through the day.",
      ],
      closing:
        "You do not need to decide whether the word “depression” fits before asking for support. You can simply describe what has changed.",
    },
    therapists: {
      eyebrow: "Depression therapists in Ontario",
      heading: "Meet therapists who currently list depression support.",
      intro:
        "These Valisen therapists have depression in their verified areas of practice and are accepting new clients. The consultation is a chance to ask how they approach low mood, disconnection, and motivation.",
    },
    howItWorks: [
      {
        title: "Send a short request",
        body:
          "Choose a therapist or ask Valisen to help, then share your contact details and broad availability.",
      },
      {
        title: "Meet for 20 minutes",
        body:
          "The free phone consultation can cover what you are looking for, the therapist’s approach, fees, and scheduling.",
      },
      {
        title: "Decide at your pace",
        body:
          "If the fit feels right, schedule a full online depression therapy session. The consultation does not commit you to ongoing care.",
      },
    ],
    objections: [
      {
        question: "“Other people have it worse.”",
        answer:
          "You do not need to compare your experience or reach a crisis point before speaking with a therapist.",
      },
      {
        question: "“I do not have the energy to explain everything.”",
        answer:
          "You can keep the consultation brief. There is no expectation that you provide a detailed history before deciding whether to continue.",
      },
      {
        question: "“I am not sure who to choose.”",
        answer:
          "Choose “No preference — help me choose” in the request form and Valisen can help you consider the therapists currently available.",
      },
      {
        question: "“I have never tried therapy.”",
        answer:
          "You do not need special language or a clear goal. It is enough to say that you have not felt like yourself lately.",
      },
    ],
    specificFaqs: [
      {
        question: "Do I need diagnosed depression to speak with a therapist?",
        answer:
          "No. People reach out for low mood, numbness, isolation, loss of motivation, or simply feeling unlike themselves. The consultation is not a diagnostic assessment.",
      },
      {
        question: "What happens in therapy for low mood or depression?",
        answer:
          "The approach depends on you and the therapist. Sessions may explore what is contributing to the heaviness, patterns that affect mood and routines, and practical or reflective ways of responding. Ask about a therapist’s specific approach during the consultation.",
      },
    ],
    finalCta: {
      heading: "You do not have to feel ready for everything—only for one conversation.",
      body:
        "Request a free 20-minute consultation and decide afterward whether a Valisen therapist feels like the right next step.",
    },
  },
  "couples-therapy": {
    slug: "couples-therapy",
    organicCanonicalPath: "/relationship-counselling-ottawa",
    title: "Online Couples Therapy in Ontario | Valisen Mental Health",
    description:
      "Meet Valisen therapists with verified couples experience. Online couples, relationship, and marriage therapy is available across Ontario, with a free consultation.",
    concernTag: "couples-therapy",
    therapistPriority: [
      "wilfred-bengnwi",
      "tim-kahtava",
      "ryann-simpson",
    ],
    specialtyKeywords: [
      "couples",
      "relationship",
      "infidelity",
      "attachment",
      "family",
      "communication",
    ],
    tone: "couples",
    hero: {
      heading: "Stop having the same fight without getting anywhere.",
      body:
        "Online couples or relationship therapy can create a more structured conversation when conflict, distance, resentment, or trust concerns keep pulling you into the same pattern. Meet a couples or relationship therapist serving partners virtually across Ontario.",
      imageHeading: "Couples therapists with verified experience",
      imageBody:
        "See who works with couples, what they focus on, and what each session costs.",
    },
    recognition: {
      eyebrow: "When the relationship feels stuck",
      heading: "Couples therapy may be worth considering if…",
      intro:
        "Seeking support does not mean a relationship is doomed. It can mean the conversations you are having on your own are no longer getting you where you want to go.",
      signs: [
        "You keep having the same argument without resolving it.",
        "Communication quickly turns defensive, tense, or silent.",
        "You feel emotionally distant even when you are together.",
        "Trust concerns or betrayal have changed the relationship.",
        "Resentment makes it difficult to hear one another clearly.",
        "A major transition has created strain or uncertainty about the future.",
      ],
      closing:
        "Couples therapy can focus on communication, conflict, trust, relationship repair, or making sense of what each partner wants next. It does not guarantee reconciliation or any particular outcome.",
    },
    therapists: {
      eyebrow: "Couples therapists in Ontario",
      heading: "Meet therapists who explicitly work with couples.",
      intro:
        "The therapists below currently list couples in both their Valisen matching data and the populations they serve. Use a free consultation to confirm fit for your relationship and goals.",
    },
    howItWorks: [
      {
        title: "Request a free consultation",
        body:
          "Choose a couples therapist or ask for help deciding, then provide broad availability for the first conversation.",
      },
      {
        title: "Talk about fit together",
        body:
          "Use the free 20-minute phone consultation to ask about attendance, approach, scheduling, fees, and the relationship concern you want to address.",
      },
      {
        title: "Choose what comes next",
        body:
          "If the therapist seems like an appropriate fit for both partners, arrange a full virtual couples therapy session.",
      },
    ],
    objections: [
      {
        question: "“My partner is not sure about therapy.”",
        answer:
          "A free consultation can answer practical questions before either of you commits to a full session. Ask the therapist how they handle first conversations and participation.",
      },
      {
        question: "“We should be able to solve this ourselves.”",
        answer:
          "Many couples seek a more structured conversation when their usual attempts keep returning to the same conflict or distance.",
      },
      {
        question: "“I am worried the therapist will take sides.”",
        answer:
          "Use the consultation to ask how the therapist works with both partners and approaches shared relationship patterns.",
      },
      {
        question: "“I do not know which couples therapist to choose.”",
        answer:
          "Select “No preference — help me choose” and Valisen can help you compare the therapists who currently work with couples.",
      },
    ],
    specificFaqs: [
      {
        question: "Do both partners need to attend couples therapy?",
        answer:
          "Attendance can depend on the therapist, the relationship concern, and the goals of the work. The free consultation is the right place to confirm who should join the first full session.",
      },
      {
        question: "Is couples therapy only for relationships in crisis?",
        answer:
          "No. Couples therapy—sometimes called relationship or marriage therapy—can also focus on communication patterns, recurring conflict, emotional distance, trust concerns, or major life transitions. Therapy does not assume the relationship is ending or guarantee that it will continue.",
      },
    ],
    finalCta: {
      heading: "A different conversation can begin with a small first step.",
      body:
        "Meet a Valisen couples therapist for a free 20-minute consultation and decide together whether the fit feels right.",
    },
  },
};

export function getPaidSearchLandingPage(
  slug: PaidSearchLandingSlug,
): PaidSearchLandingPageConfig {
  return paidSearchLandingPages[slug];
}
