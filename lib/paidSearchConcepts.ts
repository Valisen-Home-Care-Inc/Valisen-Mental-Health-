import { getTherapistBySlug, type Therapist } from "@/lib/therapists";
import { ALL_CONSULTATION_THERAPISTS, type ConsultationTherapist } from "@/lib/consultationSchedules";

export type TherapistFit = { slug: string; heading: string; description: string; reasons: string[] };
export type PaidSearchConcept = {
  slug: string;
  label: string;
  collection: "campaign" | "niche";
  tone: "sage" | "clay" | "blue" | "lilac" | "gold";
  eyebrow: string;
  headline: string;
  emphasis: string;
  introduction: string;
  cta: string;
  recognitionHeading: string;
  recognition: string[];
  approachHeading: string;
  approachIntro: string;
  approach: Array<{ title: string; description: string }>;
  therapists: TherapistFit[];
  proof: [string, string];
  faqs: Array<{ question: string; answer: string }>;
  bookingHeading: string;
  language?: { label: string; code: string; heading: string; translation: string };
  suggestedKeywords?: string[];
};

const meryemAnxiety: TherapistFit = {
  slug: "meryem-ibrahim", heading: "A warm space. Practical ways forward.",
  description: "Meryem combines a compassionate, non-judgmental style with CBT, DBT, and solution-focused approaches. Together, you can explore the patterns behind anxiety and work on coping skills that fit your life.",
  reasons: ["Works with worry, overthinking, and overwhelm", "CBT, DBT & solution-focused approaches", "Therapy in English & Arabic"],
};
const timPractical: TherapistFit = {
  slug: "tim-kahtava", heading: "Experience you can talk to. Skills you can use.",
  description: "Tim brings over 20 years of experience with individuals, couples, and families. His collaborative style makes room for what is happening now while helping you build strategies for life between sessions.",
  reasons: ["20+ years supporting clients", "CBT, DBT & solution-focused approaches", "Practical, collaborative sessions"],
};
const ryannPatterns: TherapistFit = {
  slug: "ryann-simpson", heading: "For the deep thinker who wants something to change.",
  description: "Ryann works with anxiety, overthinking, people-pleasing, and perfectionism. Her curious, insight-focused style helps you understand your patterns and find tools that feel relevant to you.",
  reasons: ["Anxiety, perfectionism & people-pleasing", "Insight, tools & practical next steps", "Virtual & telephone therapy"],
};

export const paidSearchConcepts: PaidSearchConcept[] = [
  {
    slug: "anxiety", label: "Anxiety therapy", collection: "campaign", tone: "sage",
    eyebrow: "Anxiety therapy in Ontario",
    headline: "Anxiety therapy for the mind", emphasis: "that won’t switch off.",
    introduction: "The overthinking. The constant what-ifs. Ryann helps adults understand recurring anxiety patterns and build practical tools. Prefer a CBT approach? Meet Meryem, too. Virtual therapy across Ontario.",
    cta: "Book a free consultation",
    recognitionHeading: "When your mind won't give you a break.",
    recognition: ["Replaying conversations long after they’re over.", "Holding everything together while feeling tense inside.", "Avoiding things you want to do because of what might happen."],
    approachHeading: "Understand the worry. Make room for something else.",
    approachIntro: "Therapy can focus on the situations, thoughts, and habits that keep anxiety taking up space in your day.",
    approach: [
      { title: "Make sense of the pattern", description: "Explore what sets anxiety off, how you respond, and where the cycle keeps repeating." },
      { title: "Build a personal toolkit", description: "Work on coping, emotional regulation, and more flexible responses to anxious thoughts." },
      { title: "Bring it into everyday life", description: "Set goals around what matters to you, whether that’s work, relationships, or feeling more present." },
    ],
    therapists: [ryannPatterns, meryemAnxiety], proof: ["Anxiety & overthinking", "A focus of Ryann’s work"],
    faqs: [{ question: "Can I ask for CBT for anxiety?", answer: "Yes. Meryem’s approach draws from Cognitive Behavioural Therapy (CBT), alongside DBT and solution-focused therapy. Choose a free call with Meryem to discuss how a structured approach could fit your needs." }, { question: "Do I need an anxiety diagnosis?", answer: "You can reach out about worry, overthinking, tension, or avoidance without having a diagnosis. The consultation is a place to explain what has been difficult and ask about support." }],
    bookingHeading: "Start with a conversation. Not another what-if.",
  },
  {
    slug: "depression", label: "Depression therapy", collection: "campaign", tone: "lilac",
    eyebrow: "Depression therapy in Ontario",
    headline: "You miss feeling like yourself.", emphasis: "Let’s start there.",
    introduction: "When everyday things take more effort, Tim and Meryem offer support for low mood, isolation, and finding a manageable next step. Their approaches include CBT and practical coping strategies. Virtual therapy for adults in Ontario.",
    cta: "Book a free consultation",
    recognitionHeading: "Some days, the smallest things feel like a lot.",
    recognition: ["Getting through the day, but feeling disconnected from it.", "Pulling away from people even when you don’t want to be alone.", "Knowing what you need to do, without the energy to begin."],
    approachHeading: "Small, workable steps. Space for the bigger picture.",
    approachIntro: "You don’t have to arrive motivated or explain everything perfectly. Therapy can begin with how life feels right now.",
    approach: [
      { title: "Be heard without pressure", description: "Make room for low mood, numbness, sadness, or the feelings that are hard to put into words." },
      { title: "Look at what keeps you stuck", description: "Explore the thoughts, routines, and relationship patterns that may be making daily life harder." },
      { title: "Reconnect at your pace", description: "Work toward manageable actions and routines that reflect what matters to you." },
    ],
    therapists: [{ ...timPractical, heading: "Practical support when motivation is hard to find.", reasons: ["Works with low mood, isolation & motivation", "20+ years supporting clients", "CBT & practical coping strategies"] }, { ...meryemAnxiety, heading: "A compassionate place to put down the weight.", description: "Meryem supports adults experiencing depression, grief, and life changes. Her work combines a warm, culturally responsive space with CBT, DBT, and solution-focused approaches.", reasons: ["Depression, grief & life transitions", "CBT, DBT & solution-focused approaches", "A collaborative, unhurried pace"] }],
    proof: ["20+ years", "Tim’s experience supporting clients"],
    faqs: [{ question: "Do you offer CBT for depression?", answer: "Tim and Meryem both draw from CBT in their work. You can discuss what a structured approach might look like and how it could fit your goals during the consultation." }, { question: "What if I don’t know what to say?", answer: "You can start with something as simple as ‘things have felt heavy lately.’ You do not need to arrive with a prepared story or a clear explanation." }],
    bookingHeading: "One small step toward support.",
  },
  {
    slug: "cbt", label: "CBT therapy", collection: "campaign", tone: "blue",
    eyebrow: "Cognitive Behavioural Therapy · Ontario",
    headline: "Understand the pattern.", emphasis: "Practise a different response.",
    introduction: "Work with Tim or Meryem on shared goals, the links between thoughts and actions, and skills to practise between sessions. CBT is part of both clinicians’ approaches. Virtual therapy for adults in Ontario.",
    cta: "Book a free consultation",
    recognitionHeading: "You want insight you can do something with.",
    recognition: ["Understanding a pattern, but falling back into it.", "Wanting practical ways to respond to worry or low mood.", "Looking for sessions with shared goals and a clear focus."],
    approachHeading: "A collaborative process. Practical work.",
    approachIntro: "Your therapist can explain how CBT fits your needs and adapt the work with you. You remain part of the conversation about direction and pace.",
    approach: [
      { title: "Choose a starting point", description: "Identify a situation or pattern you want to work on, and agree on goals together." },
      { title: "Understand the connections", description: "Look at how thoughts, emotions, and actions interact in situations from your own life." },
      { title: "Try something different", description: "Practise tools and reflect on what happens, including between-session exercises when appropriate." },
    ],
    therapists: [{ ...timPractical, description: "Tim uses CBT alongside DBT and solution-focused approaches to help you connect patterns with practical changes. His clinic profile lists a CBT Practitioner course certificate from 2023. You can agree on goals and discuss useful practice between sessions." }, { ...meryemAnxiety, description: "Meryem draws from CBT, DBT, and solution-focused therapy in her work with adults. Together, you can explore how thoughts, emotions, and responses connect, and choose practical steps that fit your goals and pace." }], proof: ["CBT Practitioner course", "Tim’s listed training · 2023"],
    faqs: [{ question: "Is CBT the same as positive thinking?", answer: "CBT involves exploring patterns and testing more helpful responses. It is not simply being told to think positively. Your therapist can explain the approach and how it might relate to your goals." }, { question: "Will I have work between sessions?", answer: "Your therapist may suggest exercises or observations to try between sessions. You can discuss what is realistic for you and adjust the pace together." }],
    bookingHeading: "Talk about what you’d like to change.",
  },
  {
    slug: "couples", label: "Couples therapy", collection: "campaign", tone: "clay",
    eyebrow: "Couples therapy in Ontario",
    headline: "Less arguing.", emphasis: "More understanding.",
    introduction: "The same argument. The growing distance. The things that never quite get said. Work with a couples therapist who helps you slow down the pattern and find a more useful conversation—together.",
    cta: "Book a free consultation",
    recognitionHeading: "It’s not just the argument. It’s what happens after.",
    recognition: ["One of you pushes to talk while the other pulls away.", "Trying to repair trust, but returning to the same hurt.", "Sharing a life while feeling increasingly far apart."],
    approachHeading: "Put the pattern on the table. Make room for both of you.",
    approachIntro: "Couples work can help you understand what happens beneath conflict and practise different ways of responding to each other.",
    approach: [
      { title: "Understand your cycle", description: "Explore the triggers, reactions, and unspoken needs that keep familiar arguments going." },
      { title: "Have the harder conversations", description: "Work on communication, emotional connection, boundaries, and the impact of broken trust." },
      { title: "Decide what comes next", description: "Clarify what each of you needs and build practical steps toward your shared goals." },
    ],
    therapists: [{ ...ryannPatterns, heading: "Understand what each of you brings to the pattern.", description: "Ryann works with adult couples and individuals on relationship challenges, boundaries, people-pleasing, and communication. Her curious style makes room for understanding and practical tools.", reasons: ["Works with adult couples", "Boundaries & communication", "Virtual & telephone sessions"] }, { slug: "wilfred-bengnwi", heading: "Relationship repair is a central part of his work.", description: "Wilfred brings a relational, attachment-informed approach to couples therapy. His work focuses on conflict cycles, communication, trust, and the emotional patterns underneath recurring relationship struggles.", reasons: ["4+ years specializing in couples therapy", "Attachment-informed & repair-focused", "Communication, trust & emotional infidelity"] }],
    proof: ["Communication & connection", "Couples therapy with Ryann"],
    faqs: [{ question: "Is the couples fee per person?", answer: "No. Couples therapy is $200 CAD per 50-minute session, total for both partners. The initial 20-minute phone consultation with your selected therapist is free." }, { question: "Can we talk about infidelity or broken trust?", answer: "Wilfred’s listed areas of work include relationship repair, emotional infidelity, and attachment injuries. You can ask about his approach without sharing the details in this form." }],
    bookingHeading: "Make space for a different conversation.",
  },
  {
    slug: "ocd", label: "OCD therapy", collection: "campaign", tone: "blue",
    eyebrow: "OCD support · Ontario",
    headline: "More room for your life.", emphasis: "Less room for the loop.",
    introduction: "Intrusive thoughts. Repeated checking. The search for certainty that never quite feels finished. Talk with a therapist who works with OCD about the patterns taking up your time—and the life you want more room for.",
    cta: "Book a free consultation",
    recognitionHeading: "When ‘just one more time’ never feels like enough.",
    recognition: ["Getting caught in thoughts you never wanted to have.", "Repeating checks or rituals to try to feel certain.", "Finding that reassurance doesn’t stay reassuring for long."],
    approachHeading: "An unwanted thought isn’t the whole story of you.",
    approachIntro: "You can talk about OCD without having to justify how exhausting it feels. Start with a conversation about your experience, goals, and the clinician’s approach.",
    approach: [
      { title: "Talk about what you need", description: "Ask about support for intrusive thoughts, compulsions, or the patterns taking up your time." },
      { title: "Discuss the treatment approach", description: "Ask how your therapist works with OCD, what sessions involve, and how the approach fits your goals." },
      { title: "Make an informed choice", description: "Understand the clinician’s scope, fees, and proposed next step before beginning therapy." },
    ],
    therapists: [
      { ...ryannPatterns, heading: "A thoughtful, practical space to talk about OCD.", description: "Ryann works with OCD as well as anxiety, overthinking, and perfectionism. Her curious, insight-focused style makes room for understanding your experience and discussing practical next steps. Ask about how she works with OCD during your consultation.", reasons: ["OCD & anxiety support", "Insight, tools & practical next steps", "Virtual & telephone therapy"] },
      { ...meryemAnxiety, heading: "A non-judgmental space for thoughts that feel hard to share.", description: "Meryem works with OCD and anxiety, bringing a compassionate, culturally responsive style. Her broader practice draws from CBT, DBT, and solution-focused approaches, with therapy in English and Arabic.", reasons: ["Support for OCD & intrusive thoughts", "Compassionate & culturally responsive", "English & Arabic sessions"] },
      { slug: "wilfred-bengnwi", heading: "Space for OCD and the relationships it touches.", description: "Wilfred works with OCD as well as anxiety and relationship concerns. His relational, structured style makes room for the emotional patterns and everyday effects you want to understand.", reasons: ["OCD & anxiety support", "Registered Psychotherapist", "Relational, structured approach"] },
      { slug: "dayong-quan", heading: "OCD support in Mandarin or English.", description: "Dayong works with OCD, anxiety, and cultural adjustment. He offers a calm, reflective, and practical therapeutic style, with sessions available in both Mandarin and English.", reasons: ["Support for OCD & intrusive thoughts", "Mandarin & English sessions", "Calm, grounded, practical support"] },
    ],
    proof: ["OCD support", "Discuss the clinician’s methods before starting"],
    faqs: [{ question: "Which Valisen therapists work with OCD?", answer: "Ryann Simpson, Meryem Ibrahim, Wilfred Bengnwi, and Dayong Quan work with OCD. Their different styles and language options are introduced on this page so you can ask about the fit that matters to you." }, { question: "Can I ask about CBT for OCD?", answer: "Yes. Explain that you are seeking an OCD-focused approach and ask about the clinician’s relevant experience and methods. Meryem’s broader practice draws from CBT. Your therapist can explain the specific approach they recommend before you begin." }],
    bookingHeading: "Make space to talk about what’s been taking up yours.",
  },
  {
    slug: "panic", label: "Panic support", collection: "campaign", tone: "blue",
    eyebrow: "Therapy for panic & anxiety · Ontario",
    headline: "Life can feel bigger", emphasis: "than the fear of panic.",
    introduction: "If you find yourself worrying about the next wave of panic or planning life around avoiding it, talk with a therapist who works with panic and anxiety. Start with a calm, practical conversation about support.",
    cta: "Book a free consultation",
    recognitionHeading: "Sometimes it’s the fear of it happening again.",
    recognition: ["Watching for sensations that might mean panic is starting.", "Planning around exits, familiar places, or who can come with you.", "Avoiding situations you used to move through more freely."],
    approachHeading: "Support for the panic. And the life around it.",
    approachIntro: "Therapy can focus on your experience of panic, anticipatory worry, and the responses that have become part of daily life.",
    approach: [
      { title: "Understand your experience", description: "Talk through the sensations, situations, and worries that are difficult for you." },
      { title: "Work on coping responses", description: "Explore practical strategies for anxiety and emotional regulation with your therapist." },
      { title: "Set meaningful goals", description: "Identify what you want to feel more able to do and discuss a manageable way forward." },
    ],
    therapists: [{ ...timPractical, heading: "Practical support for panic, worry, and rumination.", reasons: ["Support for panic & anxiety", "CBT, DBT & practical coping strategies", "20+ years supporting clients"] }, { slug: "dayong-quan", heading: "A calm, grounded person to work with.", description: "Dayong’s anxiety work includes panic, tension, and overthinking. His reflective, practical approach combines counselling skills with mindfulness-informed support.", reasons: ["Works with panic & anxiety patterns", "Calm, reflective & practical style", "Therapy in English & Mandarin"] }],
    proof: ["Panic + anxiety", "Support from Tim & Dayong"],
    faqs: [{ question: "Can I ask about CBT for panic?", answer: "Yes. Tim draws from CBT, DBT, and solution-focused approaches and lists panic within his anxiety work. Ask how he would approach your situation during the consultation." }, { question: "What if I’m unsure whether symptoms are panic?", answer: "New, severe, or unexplained physical symptoms should be assessed by a medical professional. The consultation can help you discuss therapy needs; it does not replace urgent or medical assessment." }],
    bookingHeading: "Start with a calm conversation about support.",
  },
  {
    slug: "social-anxiety", label: "Social anxiety", collection: "campaign", tone: "sage",
    eyebrow: "Support for social anxiety · Ontario",
    headline: "Less replaying every conversation.", emphasis: "More being yourself.",
    introduction: "The meeting you dread. The message you rewrite. The social plans you want to want. Explore the worry and self-consciousness with a therapist whose work includes anxiety and the patterns around it.",
    cta: "Book a free consultation",
    recognitionHeading: "It can be exhausting to monitor yourself all the time.",
    recognition: ["Running through what you’ll say before a simple conversation.", "Wondering how you came across long after you’ve gone home.", "Wanting connection, then finding a reason to cancel."],
    approachHeading: "Space to speak freely. Room to practise.",
    approachIntro: "You can talk about the moments that feel uncomfortable and the ways anxiety affects work, relationships, and everyday choices.",
    approach: [
      { title: "Name the pressure", description: "Explore fears of judgement, self-criticism, and the expectations you carry into social situations." },
      { title: "Notice your patterns", description: "Understand the links between anxious thoughts, avoidance, and how you feel afterward." },
      { title: "Work toward your goals", description: "Discuss practical responses and small changes that fit the connections you want in your life." },
    ],
    therapists: [ryannPatterns, meryemAnxiety], proof: ["Anxiety-focused support", "A conversation you don’t have to rehearse"],
    faqs: [{ question: "What if talking to a therapist makes me anxious?", answer: "You can say that at the beginning. You do not have to be a confident speaker or explain yourself perfectly to have a useful first conversation." }, { question: "Can sessions focus on work or social situations?", answer: "Yes. You can bring specific situations into therapy and discuss how the therapist’s anxiety work may fit your goals. Ask about relevant experience and approaches in your consultation." }],
    bookingHeading: "You don’t have to rehearse this first step.",
  },
  {
    slug: "online-therapy", label: "Online therapy", collection: "campaign", tone: "sage",
    eyebrow: "Online therapy across Ontario",
    headline: "A real connection.", emphasis: "In a space that’s yours.",
    introduction: "Virtual therapy for adults across Ontario, without the commute. Meet Ryann for anxiety and recurring patterns, Meryem for CBT-informed support in English or Arabic, or Tim for a practical approach backed by extensive experience.",
    cta: "Book a free consultation",
    recognitionHeading: "Therapy needs to fit the life you actually have.",
    recognition: ["A workday that makes another trip across town difficult.", "Wanting more choice than the therapists near your home.", "Preferring to talk from somewhere familiar and private."],
    approachHeading: "Personal support, with a simpler way to get there.",
    approachIntro: "Online sessions are available to adults located in Ontario. Choose a private space, connect with your therapist, and make time for the conversation.",
    approach: [
      { title: "Find a person who fits", description: "Compare the featured therapists’ style, experience, and fees without opening another page." },
      { title: "Ask your questions first", description: "Use the free consultation to discuss your needs, the virtual format, and next steps." },
      { title: "Make it part of your week", description: "Arrange therapy with your clinician and join from a private space in Ontario." },
    ],
    therapists: [ryannPatterns, meryemAnxiety, { ...timPractical, reasons: ["Extensive virtual therapy experience", "20+ years supporting clients", "Individuals, couples & families"] }],
    proof: ["Ryann · Meryem · Tim", "Compare their approaches, languages, and fees"],
    faqs: [{ question: "Do I need to live in Ottawa?", answer: "No. The featured therapists provide virtual therapy to clients located across Ontario. Let us know where you will be during sessions so the team can confirm eligibility." }, { question: "What do I need for an online session?", answer: "You will need a private space, a suitable device, and a reliable internet connection. Your therapist will share the joining instructions before a booked therapy session." }],
    bookingHeading: "Make room for a conversation that’s for you.",
  },
  {
    slug: "psychotherapists", label: "Registered psychotherapists", collection: "campaign", tone: "gold",
    eyebrow: "Registered psychotherapists in Ontario",
    headline: "Meet a Registered Psychotherapist.", emphasis: "Ask your questions first.",
    introduction: "Tim brings over 20 years of experience and a practical CBT approach. Dayong offers calm, reflective support in English and Mandarin. Both are Registered Psychotherapists providing virtual therapy to adults in Ontario.",
    cta: "Book a free consultation",
    recognitionHeading: "Choosing a therapist is personal. The details matter.",
    recognition: ["Wanting to know the person’s qualifications, not just a friendly bio.", "Looking for an approach that suits how you think and communicate.", "Needing clarity about fees and what happens after you reach out."],
    approachHeading: "A clear way to choose with confidence.",
    approachIntro: "Start with their qualifications and approach and a conversation about fit. You decide whether you want to take the next step.",
    approach: [
      { title: "See the person and their approach", description: "Read what each clinician works with, how they describe their style, and their qualifications." },
      { title: "Talk about your priorities", description: "Ask about relevant experience, availability, virtual sessions, and insurance receipts." },
      { title: "Choose your next step", description: "Understand the fee and proposed support before arranging a paid appointment." },
    ],
    therapists: [timPractical, { slug: "dayong-quan", heading: "Thoughtful, grounded support in English or Mandarin.", description: "Dayong is a Registered Psychotherapist with counselling psychology training and experience across private, EAP, and community mental health settings. His style is calm, reflective, and practical.", reasons: ["Registered Psychotherapist, MACP", "Anxiety, stress & life transitions", "English & Mandarin sessions"] }],
    proof: ["Registered clinicians", "Qualifications visible before you book"],
    faqs: [{ question: "Are the therapists on this page Registered Psychotherapists?", answer: "Yes. Tim Kahtava and Dayong Quan are listed as Registered Psychotherapists in their clinic profiles. Their qualifications and approach are available in the profiles on this page." }, { question: "Can you help me choose between them?", answer: "Yes. Use the separate assistance option below the calendar to contact the clinic about fit or language preferences. When you book a consultation time, you choose the therapist who will call you." }],
    bookingHeading: "Start with the questions that matter to you.",
  },
  {
    slug: "free-consultation", label: "Book a consultation", collection: "campaign", tone: "clay",
    eyebrow: "Free therapy consultation · Ontario",
    headline: "Meet your therapist.", emphasis: "Start with a free 20-minute call.",
    introduction: "Speak directly with a therapist at the time you book. Ask about their approach, explain what you’re looking for, and decide whether you’d like to work together. Virtual therapy for adults in Ontario; no obligation to continue.",
    cta: "Book a free consultation",
    recognitionHeading: "You don’t need all the answers before you reach out.",
    recognition: ["Wondering who might understand what you’re dealing with.", "Wanting to know the cost and the process before committing.", "Being ready for support, but unsure where to begin."],
    approachHeading: "A useful first conversation. No obligation to continue.",
    approachIntro: "The consultation is a chance to discuss fit and next steps. It is not a full therapy session, and you can choose what you feel comfortable sharing.",
    approach: [
      { title: "Talk directly with your therapist", description: "Share a little about the support you want, without having to give a detailed personal history." },
      { title: "Ask the practical questions", description: "Discuss therapist options, session fees, preferred language, and scheduling." },
      { title: "Decide what feels right", description: "Take the information you need and choose whether to arrange therapy." },
    ],
    therapists: [ryannPatterns, meryemAnxiety], proof: ["20 minutes · $0", "A phone conversation, with no obligation"],
    faqs: [{ question: "Is there any charge for the consultation?", answer: "No. The 20-minute phone consultation is free. Paid therapy sessions are a separate next step, with the fee confirmed before you book." }, { question: "Am I committing to therapy by booking?", answer: "No. You can ask about fit, fees, and how therapy works, then decide whether you want to continue." }],
    bookingHeading: "Choose a time. We’ll take it from there.",
  },
  {
    slug: "mandarin", label: "Mandarin therapy", collection: "niche", tone: "gold",
    eyebrow: "Mandarin-speaking therapist · Ontario",
    headline: "Therapy in Mandarin.", emphasis: "Room for all of you.",
    introduction: "Anxiety, low mood, life stress—or feelings that are easier to explain in Mandarin. Dayong Quan offers calm, practical support in Mandarin and English. Virtual therapy for adults across Ontario, with room for your own experience.",
    cta: "Book a free consultation",
    language: { label: "Mandarin / 普通话", code: "zh-Hans", heading: "用熟悉的语言，聊真实的自己。", translation: "提供普通话心理咨询服务 · 安大略省线上咨询" },
    recognitionHeading: "Some things feel different in your own language.",
    recognition: ["Worry or low mood making everyday life feel harder.", "Balancing work, relationships, or changes in your life.", "Wanting to speak naturally, without translating every detail first."],
    approachHeading: "Your language is part of the conversation.",
    approachIntro: "Dayong provides therapy in English and Mandarin for adults in Ontario. Language and cultural adjustment are visible parts of his practice.",
    approach: [
      { title: "Speak in the language that fits", description: "Use Mandarin or English to explore what feels difficult, personal, or hard to explain." },
      { title: "Make room for your context", description: "Explore the relationships and life changes that matter to you. Culture, identity, or migration can be part of the conversation if they are relevant to your experience." },
      { title: "Find a grounded way forward", description: "Work with a calm, reflective clinician on awareness, coping, and practical change." },
    ],
    therapists: [{ slug: "dayong-quan", heading: "A Mandarin-speaking therapist. A thoughtful, steady presence.", description: "Dayong is a Registered Psychotherapist with a Master of Arts in Counseling Psychology and a Master of Science in Psychology from East China Normal University. His clinical work includes anxiety, depression, cultural adjustment, and life transitions.", reasons: ["Therapy in Mandarin & English", "Graduate psychology degrees in Canada & China", "Cultural adjustment, anxiety & family expectations"] }],
    proof: ["普通话 / English", "Dayong offers therapy in both languages"],
    faqs: [{ question: "Can my therapy sessions be in Mandarin?", answer: "Yes. Dayong offers psychotherapy in Mandarin and English. Choose your consultation language in the calendar. You can read this page in English while booking a Mandarin-language call directly with Dayong." }, { question: "Can we discuss cultural or immigration-related pressure?", answer: "Yes. Dayong’s listed work includes cultural adjustment, immigration stress, family expectations, belonging, and major life transitions." }],
    bookingHeading: "Start in the language that feels like you.",
    suggestedKeywords: ["Mandarin therapist Ontario", "Mandarin speaking psychotherapist Ontario", "online therapy in Mandarin", "普通话 心理咨询 安大略"],
  },
  {
    slug: "arabic", label: "Arabic therapy", collection: "niche", tone: "clay",
    eyebrow: "Arabic-speaking therapist · Ontario",
    headline: "Therapy in Arabic.", emphasis: "So nothing gets lost.",
    introduction: "Anxiety, low mood, stress, or a difficult change: you can talk about it in Arabic. Meryem Ibrahim offers practical, compassionate support in Arabic and English for adults across Ontario. Your experiences set the direction.",
    cta: "Book a free consultation",
    language: { label: "Arabic / العربية", code: "ar", heading: "مساحة للتعبير عن نفسك بلغتك", translation: "العلاج النفسي باللغة العربية والإنجليزية · أونتاريو" },
    recognitionHeading: "Be understood in the language that feels natural.",
    recognition: ["Carrying worry, stress, or low mood through your day.", "Navigating relationships, grief, or a change in your life.", "Wanting to express yourself without searching for the English words."],
    approachHeading: "Your story. Your language. Your pace.",
    approachIntro: "Arabic is Meryem’s first language. Her experience includes working with diverse communities, immigrants, and refugees.",
    approach: [
      { title: "Speak comfortably", description: "Explore emotions and personal experiences in Arabic or English." },
      { title: "Bring your whole context", description: "Make space for the relationships, losses, or life changes affecting you. Culture, identity, or faith can be included if they matter to you." },
      { title: "Build practical support", description: "Work on coping skills and patterns through CBT, DBT, and solution-focused approaches, tailored to your goals." },
    ],
    therapists: [{ ...meryemAnxiety, heading: "Arabic is her first language. Understanding is her starting point.", description: "Meryem is a Registered Psychotherapist (Qualifying) who works with adults experiencing anxiety, depression, trauma, grief, and life transitions. She offers a compassionate, culturally responsive space in Arabic and English.", reasons: ["Arabic is her first language", "Experience with immigrants & refugees", "CBT, DBT & trauma-informed care"] }],
    proof: ["العربية / English", "Therapy with Meryem in either language"],
    faqs: [{ question: "Can therapy be entirely in Arabic?", answer: "Yes. Meryem provides psychotherapy in Arabic and English. Choose your consultation language in the calendar. You can read this page in English while booking an Arabic-language call directly with Meryem." }, { question: "What does RP (Qualifying) mean?", answer: "Meryem is a Registered Psychotherapist in the Qualifying category. Her designation is shown clearly so you can ask questions about her practice and confirm whether your benefits plan covers sessions with an RP (Qualifying)." }],
    bookingHeading: "A first conversation, with your language in mind.",
    suggestedKeywords: ["Arabic speaking therapist Ontario", "Arabic psychotherapy Ontario", "online therapy in Arabic"],
  },
  {
    slug: "adhd", label: "Adult ADHD support", collection: "niche", tone: "gold",
    eyebrow: "Therapy for adults with ADHD · Ontario",
    headline: "You’re trying hard.", emphasis: "Let’s make daily life work better.",
    introduction: "The half-finished tasks. The overwhelm. The frustration of knowing what to do and struggling to start. Work with Ryann Simpson on the everyday patterns around ADHD, with insight and practical tools.",
    cta: "Book a free consultation",
    recognitionHeading: "There’s more to it than ‘just get organized.’",
    recognition: ["Finding it hard to begin, switch tasks, or finish what you started.", "Feeling overwhelmed by routines other people seem to manage easily.", "Turning frustration inward when the same difficulties keep coming up."],
    approachHeading: "Support for the way your days actually unfold.",
    approachIntro: "Ryann works with ADHD, executive functioning, overthinking, and self-esteem. Sessions can explore both the practical challenges and their emotional impact.",
    approach: [
      { title: "Understand your patterns", description: "Look at how attention, overwhelm, emotions, and expectations interact in your day." },
      { title: "Find tools that fit", description: "Explore practical strategies around executive functioning and daily responsibilities." },
      { title: "Work on the self-criticism too", description: "Make space for the frustration, perfectionism, or relationship strain that can come alongside these difficulties." },
    ],
    therapists: [{ ...ryannPatterns, heading: "A curious, practical approach to ADHD and the person behind it.", description: "Ryann is a Registered Social Worker whose work includes adult ADHD, executive functioning, anxiety, perfectionism, and self-esteem. Her focus is understanding the patterns that shape your life and finding tools you can work with.", reasons: ["Adult ADHD & executive functioning", "Practical tools alongside insight", "Virtual & telephone sessions"] }],
    proof: ["ADHD + daily life", "Practical support with Ryann"],
    faqs: [{ question: "Is this an ADHD assessment or medication service?", answer: "This page is for therapy and support with ADHD-related concerns. It does not offer a diagnostic assessment or medication prescribing service. Ask the team if you need help clarifying the right type of care." }, { question: "Can I also work on anxiety or perfectionism?", answer: "Yes. Ryann’s listed areas include anxiety, perfectionism, people-pleasing, and self-esteem as well as ADHD. You can discuss how these concerns overlap in your life." }],
    bookingHeading: "Bring the real version of your day.",
    suggestedKeywords: ["adult ADHD therapist Ontario", "ADHD counselling Ontario", "executive functioning therapy Ontario"],
  },
  {
    slug: "perfectionism", label: "Perfectionism & people-pleasing", collection: "niche", tone: "sage",
    eyebrow: "Perfectionism & people-pleasing therapy · Ontario",
    headline: "You can care deeply", emphasis: "without carrying everything.",
    introduction: "Always being the reliable one can be exhausting. Explore the self-criticism, overthinking, and difficulty saying no with a therapist who works with perfectionism and people-pleasing.",
    cta: "Book a free consultation",
    recognitionHeading: "When ‘doing enough’ never quite feels like enough.",
    recognition: ["Saying yes, then feeling stretched, resentful, or depleted.", "Holding yourself to standards you would never ask of someone else.", "Replaying a small mistake as if it says everything about you."],
    approachHeading: "Understand the pattern. Make room for your needs.",
    approachIntro: "You can care about people and your work while exploring what your own limits, values, and needs look like.",
    approach: [
      { title: "Get curious about the pressure", description: "Explore the experiences and expectations behind overthinking, approval-seeking, and self-criticism." },
      { title: "Practise different boundaries", description: "Work on expressing needs, communicating limits, and noticing the feelings that come with saying no." },
      { title: "Build a different relationship with yourself", description: "Make space for self-esteem, realistic expectations, and choices that fit your values." },
    ],
    therapists: [{ ...ryannPatterns, heading: "For deep thinkers, deep feelers, and the always-reliable one.", reasons: ["Perfectionism & people-pleasing", "Boundaries, communication & self-esteem", "Works with highly sensitive people"] }],
    proof: ["Boundaries + self-esteem", "Part of Ryann’s work with people-pleasing"],
    faqs: [{ question: "Is this a reason to come to therapy?", answer: "You can seek support for patterns that leave you exhausted, self-critical, or disconnected from your needs. You do not need to reach a crisis or have a diagnosis to discuss them." }, { question: "Can sessions focus on boundaries?", answer: "Yes. Ryann’s work includes boundaries, communication, people-pleasing, and relationship challenges. You can bring situations from your own relationships or work into the conversation." }],
    bookingHeading: "This time can be for you.",
    suggestedKeywords: ["perfectionism therapist Ontario", "people pleasing therapy Ontario", "therapy for highly sensitive people Ontario"],
  },
  {
    slug: "trauma", label: "Trauma-informed therapy", collection: "niche", tone: "lilac",
    eyebrow: "Trauma-informed therapy · Ontario",
    headline: "A place to feel heard.", emphasis: "A pace that stays yours.",
    introduction: "When difficult experiences keep showing up in the present, you deserve a thoughtful approach to support. Meet therapists who work with trauma, with attention to your choices, comfort, and pace.",
    cta: "Book a free consultation",
    recognitionHeading: "You don’t have to tell the whole story to begin.",
    recognition: ["Feeling on edge or finding it hard to settle.", "Noticing the past affecting trust, relationships, or everyday life.", "Wanting support while feeling unsure about opening things up."],
    approachHeading: "Begin with what feels manageable.",
    approachIntro: "Your therapist can discuss the approach, explain the options, and work with you on a pace that respects your needs.",
    approach: [
      { title: "Build the working relationship", description: "Ask questions, discuss boundaries, and talk about what would help you feel comfortable in sessions." },
      { title: "Develop support for the present", description: "Explore coping, emotional regulation, and the effect difficult experiences have on daily life." },
      { title: "Discuss the approach together", description: "Talk about treatment options and next steps, including whether a particular approach fits your situation." },
    ],
    therapists: [{ ...timPractical, heading: "Experience with trauma and practical stabilization.", description: "Tim draws from EMDR, CBT, DBT, and solution-focused approaches. His trauma work includes practical stabilization strategies and support for people processing difficult experiences.", reasons: ["Trauma and practical stabilization", "Practical stabilization & coping", "20+ years supporting clients"] }, { ...meryemAnxiety, heading: "Choice, pacing, and a compassionate understanding.", description: "Meryem offers trauma-informed, culturally responsive care for adults. Her approach prioritizes a non-judgmental space, client choice, and the pace at which you feel ready to work.", reasons: ["Trauma-informed & culturally responsive", "Attention to choice & pacing", "English & Arabic sessions"] }],
    proof: ["Choice + pacing", "Trauma-informed clinicians, clearly introduced"],
    faqs: [{ question: "Do I have to describe what happened during the consultation?", answer: "No. The consultation is for questions about fit and next steps. You can say you are seeking trauma support without providing a detailed personal history." }, { question: "Can I ask about EMDR?", answer: "Yes. Tim lists EMDR among the approaches informing his work. Ask about his relevant training, how he uses it, and whether it may be appropriate for your needs." }],
    bookingHeading: "Take the next step at your pace.",
    suggestedKeywords: ["trauma informed therapist Ontario", "online trauma therapy Ontario"],
  },
];

export function getPaidSearchConcept(slug: string) {
  return paidSearchConcepts.find((concept) => concept.slug === slug);
}

export function conceptTherapists(concept: PaidSearchConcept): Array<TherapistFit & { therapist: Therapist }> {
  return concept.therapists.flatMap((fit) => {
    const therapist = getTherapistBySlug(fit.slug);
    return therapist && !therapist.comingSoon && therapist.acceptingNewClients ? [{ ...fit, therapist }] : [];
  });
}

/** A page controls its eligible pool; submitted therapist IDs are never trusted. */
export function consultationPoolForConcept(slug?: string): ConsultationTherapist[] | null {
  if (!slug) return ALL_CONSULTATION_THERAPISTS;
  const concept = getPaidSearchConcept(slug);
  return concept ? conceptTherapists(concept).map(({ slug }) => slug as ConsultationTherapist) : null;
}

export const conceptFinalPath = (slug: string) => `/welcome/${slug}`;

/** Couples pricing explicitly confirmed by the clinic for these concepts. */
export function conceptSessionFee(conceptSlug: string, clinician: { fee: number; duration: number }) {
  return conceptSlug === "couples" ? { fee: 200, duration: 50 } : { fee: clinician.fee, duration: clinician.duration };
}
