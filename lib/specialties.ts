export type SpecialtySlug =
  | "anxiety-therapy-ottawa"
  | "depression-therapy-ottawa"
  | "trauma-therapy-ottawa"
  | "grief-counselling-ottawa"
  | "stress-therapy-ottawa"
  | "self-esteem-therapy-ottawa"
  | "relationship-counselling-ottawa"
  | "life-transitions-therapy-ottawa";

export type SpecialtyPageData = {
  slug: SpecialtySlug;
  title: string;
  metaDescription: string;
  headline: string;
  subtext: string;
  topic: string;
  whatItIs: [string, string];
};

export const SPECIALTIES: SpecialtyPageData[] = [
  {
    slug: "anxiety-therapy-ottawa",
    title: "Anxiety Therapy in Ottawa | Valisen Mental Health",
    metaDescription:
      "Book online with Valisen Mental Health to discuss anxiety therapy options in Ontario.",
    headline: "Anxiety therapy in Ottawa",
    subtext:
      "Living with constant worry, racing thoughts, or panic shouldn't be something you handle alone. Browse our therapists who have experience with anxiety and book a free 20-minute consultation directly with them.",
    topic: "anxiety",
    whatItIs: [
      "Anxiety shows up differently for everyone. For some it's a constant low-level hum of worry. For others it's panic that comes out of nowhere. It can affect sleep, work, relationships, and the everyday choices that used to feel easy.",
      "Therapy for anxiety isn't about forcing the feelings to disappear. It's about building tools to work with them, understanding where they come from, and gradually getting back the parts of your life anxiety has been taking up space in.",
    ],
  },
  {
    slug: "depression-therapy-ottawa",
    title: "Depression Therapy in Ottawa | Valisen Mental Health",
    metaDescription:
      "Book online with Valisen Mental Health to discuss depression therapy options in Ontario.",
    headline: "Depression therapy in Ottawa",
    subtext:
      "Depression can make even small things feel impossible. Browse our therapists who have experience with depression and book a free consultation directly with them — at your pace, on your terms.",
    topic: "depression",
    whatItIs: [
      "Depression isn't just sadness. It's the heaviness that sits on everything - the loss of interest in things you used to love, the difficulty getting out of bed, the sense that nothing quite reaches you anymore. It's exhausting, and it doesn't always have an obvious cause.",
      "Therapy for depression gives you a space to explore what you're going through without pressure. Your therapist works alongside you to understand what's driving it and to find approaches that help - gradually, steadily, in a way that fits your life.",
    ],
  },
  {
    slug: "trauma-therapy-ottawa",
    title: "Trauma Therapy in Ottawa | Valisen Mental Health",
    metaDescription:
      "Book online with Valisen Mental Health to discuss trauma therapy options in Ontario.",
    headline: "Trauma therapy in Ottawa",
    subtext:
      "Trauma changes how the world feels. Browse our therapists who have experience with trauma and book a free consultation directly with them — they will move at your pace.",
    topic: "trauma",
    whatItIs: [
      "Trauma can come from a single event or from ongoing difficult experiences. It can show up as flashbacks or numbness, hypervigilance or avoidance, or as a sense that your body still remembers something your mind has tried to set aside.",
      "Trauma therapy is careful and unhurried. The right therapist won't push you to revisit anything before you're ready. They work with you to build safety first, and to slowly process what happened in a way that feels manageable - not overwhelming.",
    ],
  },
  {
    slug: "grief-counselling-ottawa",
    title: "Grief Counselling in Ottawa | Valisen Mental Health",
    metaDescription:
      "Book online with Valisen Mental Health to discuss grief counselling options in Ontario.",
    headline: "Grief counselling in Ottawa",
    subtext:
      "Grief doesn't follow a schedule. Browse our therapists who have experience supporting people through loss of every kind and book a free consultation directly with them.",
    topic: "grief and loss",
    whatItIs: [
      "Grief is one of the most universal human experiences and one of the loneliest. It can come after the loss of a person, a relationship, a role, or a future you were counting on. There's no right way to grieve, and your experience deserves room to be understood.",
      "Grief counselling gives you a space to feel what you're feeling without anyone trying to fix it. Your therapist walks with you through the experience - helping you make sense of it, hold space for what's hard, and slowly find your footing again.",
    ],
  },
  {
    slug: "stress-therapy-ottawa",
    title: "Stress Therapy in Ottawa | Valisen Mental Health",
    metaDescription:
      "Book online with Valisen Mental Health to discuss stress and burnout therapy options in Ontario.",
    headline: "Stress therapy in Ottawa",
    subtext:
      "Chronic stress wears on everything — your sleep, your body, your relationships, your sense of yourself. Browse our therapists who can help and book a free consultation directly with them.",
    topic: "stress and burnout",
    whatItIs: [
      "Stress is supposed to come and go. When it doesn't - when the pressure keeps building - it changes how you function. You might feel exhausted but unable to rest, snappy without knowing why, or stuck in a loop of overthinking that won't let up.",
      "Therapy for stress isn't about adding another thing to your to-do list. It's about understanding what's draining you, finding what actually helps, and rebuilding the kind of capacity that lets you handle life without running on empty.",
    ],
  },
  {
    slug: "self-esteem-therapy-ottawa",
    title: "Self-Esteem Therapy in Ottawa | Valisen Mental Health",
    metaDescription:
      "Book online with Valisen Mental Health to discuss self-esteem therapy options in Ontario.",
    headline: "Self-esteem therapy in Ottawa",
    subtext:
      "The way you talk to yourself shapes everything else. Browse our therapists who can help you build a kinder, steadier relationship with yourself and book a free consultation directly with them.",
    topic: "self-esteem and self-worth",
    whatItIs: [
      "Low self-esteem is rarely about not being good enough. It's usually about messages you absorbed somewhere along the way that taught you to doubt yourself. Those messages can quietly run the show - affecting how you show up at work, in relationships, and in the choices you make about your own life.",
      "Therapy for self-esteem helps you notice those patterns, understand where they came from, and slowly build a different relationship with yourself. It's not about forced positivity - it's about clarity, self-respect, and learning to trust your own worth.",
    ],
  },
  {
    slug: "relationship-counselling-ottawa",
    title: "Relationship Counselling in Ottawa | Valisen Mental Health",
    metaDescription:
      "Book online with Valisen Mental Health to discuss relationship counselling options in Ontario.",
    headline: "Relationship counselling in Ottawa",
    subtext:
      "Whether you're working through things on your own or with a partner, browse our therapists who specialise in relationships and book a free consultation directly with them.",
    topic: "relationship issues",
    whatItIs: [
      "Relationships are some of the most important parts of our lives - and some of the hardest to navigate. Conflict, disconnection, communication breakdowns, betrayal, or just slowly drifting apart can leave you feeling stuck and unsure what to do next.",
      "Relationship counselling can be done alone or with your partner. The right therapist helps you understand the patterns at play, communicate what you actually need, and decide together what you want the next chapter to look like.",
    ],
  },
  {
    slug: "life-transitions-therapy-ottawa",
    title: "Life Transitions Therapy in Ottawa | Valisen Mental Health",
    metaDescription:
      "Book online with Valisen Mental Health to discuss life transitions therapy options in Ontario.",
    headline: "Life transitions therapy in Ottawa",
    subtext:
      "Big changes — even good ones — can leave you unsteady. Browse our therapists who can help you find your footing and book a free consultation directly with them.",
    topic: "life transitions and change",
    whatItIs: [
      "Career changes, becoming a parent, moving cities, ending a relationship, grief, retirement - life transitions reshape who you are and how you see your future. Even transitions you chose can come with grief, anxiety, and a sense of being between two versions of yourself.",
      "Therapy during a transition gives you a space to process the change without judgment. Your therapist helps you make sense of what you're losing, what you're gaining, and how to step into the next chapter with more steadiness and clarity.",
    ],
  },
];

export function getSpecialty(slug: SpecialtySlug) {
  return SPECIALTIES.find((specialty) => specialty.slug === slug);
}
