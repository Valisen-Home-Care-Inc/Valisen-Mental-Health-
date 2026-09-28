import type { PaidSearchConcept, TherapistFit } from "@/lib/paidSearchConcepts";

// Individual/couples work and explicitly faith-integrated Islamic counselling
// confirmed by the clinic on September 27, 2026.
const meryem: TherapistFit = {
  slug: "meryem-ibrahim",
  heading: "Meet Meryem. A Muslim therapist who makes room for your whole story.",
  description: "Meryem Ibrahim is a hijabi Muslim therapist and Registered Psychotherapist (Qualifying), CRPO #21069. She offers faith-integrated Islamic counselling alongside CBT, DBT, solution-focused and trauma-informed approaches. You decide how your beliefs and experiences enter the conversation.",
  reasons: ["Faith-integrated Islamic counselling", "Sessions in English or Arabic", "Individual adults and couples · Online in Ontario"],
};
const locationFaq = {
  question: "Can I work with Meryem from Ottawa or Toronto?",
  answer: "Yes. Meryem offers online therapy for adults across Ontario, including Ottawa and Toronto. These are virtual appointments; this page does not offer an in-person office visit. Your free consultation is a phone call with Meryem at the time you select.",
};
const faithFaq = {
  question: "How is Islam included in therapy?",
  answer: "Meryem offers explicitly faith-integrated Islamic counselling. You can discuss how your faith, values and beliefs relate to what you are experiencing, alongside practical therapeutic work. You agree together on how much faith is part of your sessions. This is psychotherapy, not a service for religious rulings.",
};
const languageFaq = {
  question: "Can I speak in Arabic or English?",
  answer: "Yes. Arabic is Meryem's first language, and she provides therapy in Arabic and English. Choose your preferred consultation language when booking. You do not need to speak Arabic to work with her.",
};

export const meryemPaidSearchConcepts: PaidSearchConcept[] = [
  {
    slug: "muslim-therapy", label: "Muslim & Islamic therapy", collection: "campaign", tone: "sage",
    eyebrow: "Muslim therapist · Faith-integrated Islamic counselling · Ontario",
    headline: "Therapy that respects your faith.", emphasis: "And makes room for you.",
    introduction: "You can value your faith and still feel anxious, overwhelmed or stuck. Meryem Ibrahim offers a space to work through it with a Muslim therapist who welcomes Islam into the conversation. Online therapy in English or Arabic, across Ontario.",
    cta: "Book a free call with Meryem",
    recognitionHeading: "You want support that understands what matters to you.",
    recognition: ["Trying to manage worry or low mood while feeling you should be coping better.", "Balancing your own needs with family expectations, relationships or a changing sense of identity.", "Wanting practical help without leaving your faith outside the conversation."],
    approachHeading: "Your faith can belong here. So can the difficult feelings.",
    approachIntro: "Meryem combines faith-integrated Islamic counselling with practical, collaborative psychotherapy. There is no expectation that you arrive with the right words or a particular level of religious practice.",
    approach: [
      { title: "Start with what is weighing on you", description: "Talk about anxiety, low mood, grief, stress or a difficult change. Your experience sets the starting point." },
      { title: "Include faith on your terms", description: "Explore how your Islamic beliefs, values, family context and sense of identity connect with what you are facing." },
      { title: "Build something you can use", description: "Work on coping skills, emotional regulation and patterns through CBT, DBT and solution-focused approaches, shaped around your goals." },
    ],
    therapists: [meryem], proof: ["Faith-integrated Islamic counselling", "With Meryem Ibrahim · RP (Qualifying)"],
    faqs: [faithFaq, { question: "Do I have to be very religious to reach out?", answer: "No. You do not have to explain or prove your level of practice. Meryem welcomes your own relationship with faith, including questions or mixed feelings. You decide what you want to discuss." }, languageFaq, locationFaq],
    bookingHeading: "A first conversation with someone who welcomes your faith.",
  },
  {
    slug: "female-muslim-therapist", label: "Female Muslim therapist", collection: "campaign", tone: "lilac",
    eyebrow: "Female Muslim & hijabi therapist · Online in Ontario",
    headline: "A female Muslim therapist.", emphasis: "Space to speak freely.",
    introduction: "If speaking with a woman who shares your faith would help you feel more comfortable, meet Meryem Ibrahim. A hijabi Muslim therapist offering thoughtful, practical support for anxiety, relationship stress and life changes. Choose English or Arabic. Start with a free call directly with her.",
    cta: "Book a free call with Meryem",
    recognitionHeading: "Feeling comfortable with your therapist matters.",
    recognition: ["Wanting to discuss something personal with a female Muslim therapist.", "Carrying family or relationship expectations while trying to find your own voice.", "Looking for a space where your beliefs are respected and your experience is not assumed."],
    approachHeading: "Shared faith. Curiosity about your individual experience.",
    approachIntro: "A shared background can be a starting point for connection. Meryem still takes time to learn what your life, beliefs and goals mean to you.",
    approach: [
      { title: "Begin at your own pace", description: "Share what feels useful, ask questions and take time to decide whether Meryem feels like the right fit." },
      { title: "Make room for the fuller picture", description: "Explore stress, boundaries, relationships or identity with space for your cultural context and Islamic faith." },
      { title: "Work toward practical change", description: "Build coping skills and understand recurring patterns with an approach that combines warmth, reflection and useful tools." },
    ],
    therapists: [{ ...meryem, heading: "Meryem Ibrahim. A real person you can get to know.", reasons: ["Female Muslim therapist who wears hijab", "Faith-integrated care at your pace", "Arabic is her first language · English also offered"] }],
    proof: ["Speak directly with Meryem", "Free 20-minute phone consultation"],
    faqs: [{ question: "Will I speak with Meryem herself?", answer: "Yes. The date and time you choose are for a free 20-minute phone call directly with Meryem Ibrahim. You can ask about her approach before deciding whether to begin therapy." }, { question: "Do I need to wear hijab or practise in a particular way?", answer: "No. Choosing a hijabi therapist does not create an expectation about your clothing or religious practice. Meryem makes room for your individual experiences and what matters to you." }, faithFaq, languageFaq, locationFaq],
    bookingHeading: "See how it feels to talk with Meryem.",
  },
  {
    slug: "muslim-marriage", label: "Muslim couples & marriage counselling", collection: "campaign", tone: "clay", service: "couples",
    eyebrow: "Muslim couples & Islamic marriage counselling · Ontario",
    headline: "Less distance between you.", emphasis: "More room for understanding.",
    introduction: "The recurring arguments. The things left unsaid. The wish to feel like a team again. Meryem Ibrahim offers couples and marriage counselling with space for your Islamic faith, your shared values and both of your perspectives. Online in Ontario, in English or Arabic.",
    cta: "Book a free call with Meryem",
    recognitionHeading: "You share a life. You want to feel heard in it.",
    recognition: ["Returning to the same disagreement, even when you both want things to change.", "Struggling to talk about family boundaries, expectations or responsibilities without tension.", "Wanting help with your marriage that takes your faith seriously and makes room for both people."],
    approachHeading: "Work on the relationship. Make space for both of you.",
    approachIntro: "Meryem offers faith-integrated couples work that considers your relationship, values and goals together. The consultation gives you a chance to ask about her approach and whether it fits what you need.",
    approach: [
      { title: "Understand what keeps happening", description: "Explore recurring conflict, communication patterns and the needs that may be difficult to express." },
      { title: "Bring values into the conversation", description: "Discuss faith, family expectations, boundaries and what a supportive partnership means to each of you." },
      { title: "Practise a different conversation", description: "Work on listening, expressing needs and taking practical steps toward the goals you agree on together." },
    ],
    therapists: [{ ...meryem, heading: "A Muslim therapist for the conversations your relationship needs.", description: "Meryem offers couples and marriage counselling, including explicitly faith-integrated Islamic counselling. A Registered Psychotherapist (Qualifying), CRPO #21069, she brings a compassionate, culturally responsive approach to communication, relationship stress and shared goals.", reasons: ["Couples & marriage counselling", "Islamic faith and values welcomed", "English or Arabic · Virtual sessions in Ontario"] }],
    proof: ["$200 CAD · 50 minutes", "Couples session · Total for both partners"],
    faqs: [{ question: "Is this Islamic marriage counselling?", answer: "Meryem offers couples and marriage psychotherapy that can explicitly include your Islamic faith and values. You can discuss communication, relationship patterns, expectations and shared goals. She does not provide religious rulings or guarantee a particular outcome for your relationship." }, { question: "Is the couples fee per person?", answer: "No. A couples therapy session is $200 CAD for 50 minutes, total for both partners. The first 20-minute phone consultation directly with Meryem is free." }, languageFaq, locationFaq],
    bookingHeading: "Start with one conversation about what you both need.",
  },
];
