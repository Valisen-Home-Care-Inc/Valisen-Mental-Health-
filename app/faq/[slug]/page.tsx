import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { MATCHING_FORM_URL } from "@/lib/intake";

// ─── Data types ──────────────────────────────────────────────────────────────

type PageSection = {
  h2?: string;
  paragraphs: string[];
  callout?: string; // highlighted note block
  internalLinks?: Array<{ href: string; label: string }>;
};

type FAQPageEntry = {
  question: string;
  category: string;
  categorySlug: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  sections: PageSection[];
  relatedSlugs: string[];
  updatedDate: string;
};

// ─── Page Content ─────────────────────────────────────────────────────────────

const FAQ_PAGES: Record<string, FAQPageEntry> = {

  "am-i-depressed": {
    question: "Am I depressed? How do I know if what I'm feeling is depression?",
    category: "Mental Health Signs",
    categorySlug: "mental-health-signs",
    metaTitle: "Am I Depressed? Signs of Depression Explained | Valisen Mental Health Ottawa",
    metaDescription:
      "Wondering if you're depressed? Learn the real signs of depression, how it differs from sadness, and when to seek support. Ottawa therapists answer clearly.",
    updatedDate: "2026-05-01",
    intro:
      "Depression is one of the most common and most misunderstood mental health conditions. Many people spend months — or years — wondering whether what they're experiencing is \"just a rough patch\" or something that deserves professional attention. This page is here to help you answer that question honestly.",
    sections: [
      {
        h2: "What depression actually feels like",
        paragraphs: [
          "Depression is not simply feeling sad. It is a clinical condition that reshapes how you think, how you experience your body, and how you relate to the world around you. The classic picture includes a persistent low mood or emptiness lasting most days for at least two weeks, a noticeable loss of interest in things that once gave you pleasure (this is called anhedonia), changes in appetite or weight, disrupted sleep, low energy or a constant sense of fatigue, difficulty concentrating or making decisions, and feelings of worthlessness or excessive guilt.",
          "But depression has a wide range of presentations. Some people with depression do not feel sad at all — they feel flat, numb, or emotionally absent. Others experience it primarily as irritability or agitation rather than sorrow. Depression can manifest through physical symptoms: unexplained headaches, digestive problems, or body pain with no clear medical cause are all consistent with how depression affects the nervous system.",
          "In men especially, depression often shows up as anger, recklessness, or substance use rather than the tearful withdrawal that popular culture tends to portray. This is one of the reasons depression frequently goes unrecognized and untreated in men.",
        ],
      },
      {
        h2: "Depression vs. a difficult period — how to tell the difference",
        paragraphs: [
          "Life brings grief, loss, disappointment, and stress. Feeling low after a breakup, a job loss, or a bereavement is a normal human response — not necessarily depression. The key clinical distinction is duration, pervasiveness, and functional impairment. When difficult feelings persist for more than two weeks with little to no relief, affect multiple areas of your life simultaneously, and begin to interfere with your ability to work, maintain relationships, or take care of yourself, that pattern is consistent with a depressive episode rather than a natural stress response.",
          "Another useful signal is what happens when circumstances briefly improve. In a normal low mood, a nice evening out, a piece of good news, or a connection with a friend can genuinely lift things. In clinical depression, even positive events tend not to shift the underlying heaviness for long — or at all.",
        ],
        callout:
          "If you have had recurring thoughts of death or suicide, please reach out for support immediately. You can call or text the 988 Suicide and Crisis Lifeline (Canada and US) at 988, or go to your nearest emergency department.",
      },
      {
        h2: "Common types of depression",
        paragraphs: [
          "Major Depressive Disorder (MDD) is what most people mean when they say depression — episodes of significant impairment lasting at least two weeks. Persistent Depressive Disorder (dysthymia) is a lower-grade but longer-lasting depression that can persist for years without meeting the full criteria for MDD. Seasonal Affective Disorder (SAD) follows a seasonal pattern, typically worsening in fall and winter. Postpartum depression affects parents in the weeks and months after childbirth and is far more serious than the \"baby blues.\" Bipolar disorder involves depressive episodes that alternate with periods of elevated or irritable mood.",
          "A trained clinician can help you identify which type of depression best fits your experience, which matters because treatment approaches differ.",
        ],
      },
      {
        h2: "When to seek support",
        paragraphs: [
          "If several of the signs above have been present most days for two or more weeks, it is worth speaking with a mental health professional — even if you are not certain what you are experiencing is depression. You do not need a confirmed diagnosis to start therapy. A therapist can help you understand what you are going through, even if the full picture is still unclear.",
          "Depression is one of the most treatable mental health conditions. Evidence-based approaches like Cognitive Behavioural Therapy (CBT), Interpersonal Therapy (IPT), and others have strong research support. Many people experience significant improvement within weeks of starting structured therapy.",
        ],
        internalLinks: [
          { href: "/depression-therapy-ottawa", label: "Learn about depression therapy at Valisen" },
          { href: "/faq/am-i-burnt-out", label: "Am I burnt out, or is this something more serious?" },
        ],
      },
    ],
    relatedSlugs: ["am-i-burnt-out", "do-i-have-anxiety", "trauma-signs"],
  },

  "do-i-have-anxiety": {
    question: "Do I have anxiety? What are the signs of an anxiety disorder?",
    category: "Mental Health Signs",
    categorySlug: "mental-health-signs",
    metaTitle: "Do I Have Anxiety? Signs of an Anxiety Disorder | Valisen Ottawa",
    metaDescription:
      "Wondering if your worry is normal or an anxiety disorder? Learn the real signs of anxiety, types of anxiety disorders, and when therapy helps — from Ottawa therapists.",
    updatedDate: "2026-05-01",
    intro:
      "Anxiety is a normal part of being human. Your nervous system is designed to produce worry and alertness in the face of genuine threat. An anxiety disorder is different — it is when that alarm system becomes overactive, triggering distress that is disproportionate to the situation, difficult to control, and persistent enough to interfere with your daily life.",
    sections: [
      {
        h2: "Signs of an anxiety disorder",
        paragraphs: [
          "The defining feature of an anxiety disorder is worry or fear that feels out of proportion to the actual threat and does not resolve once the stressor passes. Common signs include: constant or near-daily worry that is hard to switch off, a racing heart, chest tightness, or shortness of breath without a clear physical cause, trouble falling or staying asleep because of racing thoughts, avoidance of situations or places that trigger fear, irritability or restlessness, difficulty concentrating because your mind keeps anticipating problems, and physical symptoms like nausea, dizziness, or muscle tension during or before stressful situations.",
          "The worry in anxiety disorders often has a forward-looking, \"what if\" quality. You may find yourself running through worst-case scenarios, planning obsessively for unlikely catastrophes, or reassurance-seeking in ways that provide only temporary relief before the worry returns.",
        ],
      },
      {
        h2: "Types of anxiety disorders",
        paragraphs: [
          "Generalized Anxiety Disorder (GAD) involves persistent, hard-to-control worry across multiple life domains — health, relationships, work, finances — for at least six months. Social anxiety disorder is an intense fear of social situations and of being judged or humiliated by others. Panic disorder involves recurrent, unexpected panic attacks — sudden surges of intense fear with physical symptoms like racing heart, dizziness, and a terrifying sense of losing control — accompanied by ongoing concern about future attacks.",
          "Specific phobias involve intense fear of a particular object or situation (flying, blood, spiders) that is disproportionate to actual danger. Agoraphobia is a fear of situations where escape might be difficult or help unavailable, such as crowded places, public transit, or being alone outside. Health anxiety (sometimes called illness anxiety) is marked by excessive fear of having or developing a serious illness despite medical reassurance.",
          "Obsessive-Compulsive Disorder (OCD) and Post-Traumatic Stress Disorder (PTSD) share features with anxiety disorders but are now classified separately — though both involve significant anxiety and are treated by many of the same therapeutic approaches.",
        ],
      },
      {
        h2: "When is anxiety a disorder versus normal worry?",
        paragraphs: [
          "The clinical threshold is whether anxiety is causing significant distress or impairment in your life. If worry is consuming a large portion of your day, leading you to avoid situations you would otherwise value, affecting your sleep or relationships, or making you feel physically unwell on a regular basis, those are signs worth exploring with a professional.",
          "It is also worth noting that anxiety and depression frequently co-occur — many people experience both. If you are noticing signs of both, that is common and does not make treatment more complicated. A good therapist can work with both presentations simultaneously.",
        ],
        internalLinks: [
          { href: "/anxiety-therapy-ottawa", label: "Learn about anxiety therapy at Valisen" },
          { href: "/faq/stress-vs-anxiety", label: "What is the difference between stress and an anxiety disorder?" },
        ],
      },
    ],
    relatedSlugs: ["stress-vs-anxiety", "am-i-depressed", "trauma-signs"],
  },

  "stress-vs-anxiety": {
    question: "What is the difference between stress and an anxiety disorder?",
    category: "Mental Health Signs",
    categorySlug: "mental-health-signs",
    metaTitle: "Stress vs Anxiety Disorder — What Is the Difference? | Valisen Ottawa",
    metaDescription:
      "Stress and anxiety feel similar but are clinically different. Learn how to tell them apart and when anxiety becomes a disorder that responds well to therapy.",
    updatedDate: "2026-05-01",
    intro:
      "Stress and anxiety share many of the same physical sensations — a racing heart, tension headaches, difficulty sleeping — and people often use the two words interchangeably. But understanding the distinction matters, because the two have different origins and respond to different approaches.",
    sections: [
      {
        h2: "What stress is",
        paragraphs: [
          "Stress is a response to an identifiable external demand. A deadline, a conflict with someone you care about, a financial pressure, an upcoming medical procedure — these are stressors, and the stress response they trigger is your nervous system's way of mobilizing resources to meet them. Stress is time-limited and proportionate: it tends to escalate when the demand is present and ease once circumstances change.",
          "Stress in appropriate doses is not harmful — in fact, some stress sharpens focus and motivation. Chronic stress over months or years without adequate recovery, however, wears down the body and mind and can increase vulnerability to both physical illness and mental health conditions.",
        ],
      },
      {
        h2: "What makes anxiety different",
        paragraphs: [
          "Anxiety, as a clinical condition, tends to persist even in the absence of an immediate, identifiable stressor. The worry in anxiety disorders attaches to future possibilities, hypothetical risks, or social judgments — things that may never happen or that are objectively unlikely. The nervous system behaves as though there is danger present when, objectively, there is not.",
          "A useful way to think about it: stress is typically triggered by the present situation, while anxiety is triggered by anticipated futures. When you remove the stressor, stress tends to ease; anxiety often remains because it does not depend on any single external cause.",
          "The other key difference is pervasiveness. Stress is often domain-specific — you are stressed about work, or about a relationship, but not about everything simultaneously. Generalized anxiety involves worry that hops between subjects, returning to new concerns even after the original one is resolved.",
        ],
      },
      {
        h2: "When to consider therapy",
        paragraphs: [
          "A useful rule of thumb: if the distress has a clear, proportionate cause and reliably eases when circumstances improve, it is more likely stress. If it is persistent, hard to explain, attaches to multiple areas of life without a single clear trigger, and interferes with your functioning despite nothing being objectively \"wrong\" — that pattern is more consistent with an anxiety disorder.",
          "Both stress and anxiety respond well to therapy, though the focus differs. For stress, therapy often focuses on sustainable coping strategies, boundary-setting, and life restructuring. For anxiety disorders, evidence-based approaches like Cognitive Behavioural Therapy (CBT) address the thought patterns and avoidance behaviours that maintain the anxiety cycle.",
        ],
        internalLinks: [
          { href: "/anxiety-therapy-ottawa", label: "Anxiety therapy at Valisen" },
          { href: "/stress-therapy-ottawa", label: "Stress therapy at Valisen" },
        ],
      },
    ],
    relatedSlugs: ["do-i-have-anxiety", "am-i-burnt-out", "therapy-approaches"],
  },

  "am-i-burnt-out": {
    question: "Am I burnt out, or is it something more serious?",
    category: "Mental Health Signs",
    categorySlug: "mental-health-signs",
    metaTitle: "Am I Burnt Out? Burnout vs Depression Explained | Valisen Ottawa",
    metaDescription:
      "Burnout and depression share symptoms but have different causes and treatments. Ottawa therapists explain how to tell them apart and what to do next.",
    updatedDate: "2026-05-01",
    intro:
      "Burnout has become one of the most widely used terms in mental health conversations — and one of the most misunderstood. It is a real and serious condition, but it is not the same as depression, and knowing the difference affects how you recover.",
    sections: [
      {
        h2: "What burnout actually is",
        paragraphs: [
          "Burnout is a state of chronic exhaustion that develops after prolonged exposure to overwhelming, unsustainable demands — most commonly in a work context, but also in caregiving roles, parenting, or other high-responsibility environments. The World Health Organization defines it through three dimensions: emotional exhaustion (feeling depleted, drained, running on empty), depersonalization or cynicism (emotional distance from your work or the people you serve), and a reduced sense of personal accomplishment (feeling like your efforts no longer matter or make a difference).",
          "People experiencing burnout describe it as a kind of deep tiredness that rest does not fix, a growing numbness or cynicism toward things that used to feel meaningful, and a creeping sense of going through the motions without really being present.",
        ],
      },
      {
        h2: "How burnout differs from depression",
        paragraphs: [
          "The clinical distinction between burnout and depression is one of the most important and genuinely difficult distinctions in mental health. They can look nearly identical from the outside, and they frequently co-occur — burnout that is not addressed often develops into clinical depression over time.",
          "The key differentiating factor is context-dependence. Burnout is largely driven by the external environment: it typically centres on the work or role that has depleted you, and it tends to lift — at least partially — with meaningful time away from that context. Depression, by contrast, is more pervasive. It tends to colour every domain of life, not just the depleting one, and does not reliably improve with rest alone.",
          "The most telling question: if you took four weeks of genuine, complete rest from the draining role — no emails, no caregiving, full recovery conditions — would you begin to feel like yourself again? If the answer is yes, the picture is more consistent with burnout. If the emptiness and hopelessness would follow you regardless of circumstances, that pattern is more consistent with clinical depression.",
        ],
      },
      {
        h2: "What to do",
        paragraphs: [
          "Either way, therapy is an effective first step. A therapist can help you identify what is driving the exhaustion — whether it is a specific environmental situation, underlying patterns in how you take on responsibility, a depressive episode, or some combination — and build a sustainable path forward. Trying to self-diagnose and push through burnout without structural change rarely works; the conditions that created the burnout tend to recreate it.",
        ],
        internalLinks: [
          { href: "/depression-therapy-ottawa", label: "Depression therapy at Valisen" },
          { href: "/faq/am-i-depressed", label: "How do I know if what I'm feeling is depression?" },
        ],
      },
    ],
    relatedSlugs: ["am-i-depressed", "stress-vs-anxiety", "how-often-therapy"],
  },

  "trauma-signs": {
    question: "How do I know if I have trauma or PTSD?",
    category: "Mental Health Signs",
    categorySlug: "mental-health-signs",
    metaTitle: "Do I Have Trauma or PTSD? Signs and What to Do | Valisen Ottawa",
    metaDescription:
      "Trauma and PTSD look different for everyone. Ottawa therapists explain the signs, types of trauma, and how evidence-based therapy like EMDR can help.",
    updatedDate: "2026-05-01",
    intro:
      "Trauma is not defined by what happened to you — it is defined by the impact that experience continues to have on your nervous system and your life. Two people can have similar experiences and have entirely different responses; that is not a reflection of strength or weakness. It is a reflection of how individual nervous systems process and store overwhelming events.",
    sections: [
      {
        h2: "Signs of trauma",
        paragraphs: [
          "Post-Traumatic Stress Disorder (PTSD) is the most formally recognized trauma-related diagnosis. Its core features include intrusion symptoms (flashbacks, nightmares, or intrusive memories that feel involuntary and vivid), avoidance of people, places, thoughts, or feelings associated with the traumatic event, negative changes in thoughts and mood (persistent guilt, shame, emotional numbness, estrangement from others), and hyperarousal (being on constant alert, an exaggerated startle response, difficulty sleeping, irritability, or angry outbursts).",
          "However, many people who have experienced trauma do not meet the full criteria for PTSD and still carry significant trauma-related distress. Complex PTSD (C-PTSD) is increasingly recognized as a distinct presentation that develops after prolonged, repeated trauma — particularly in relationships or contexts where escape was not possible (childhood abuse, domestic violence, long-term emotional neglect). C-PTSD shares PTSD's core features but adds significant difficulties with emotional regulation, a deep disruption in self-perception, and pervasive difficulties in relationships.",
        ],
      },
      {
        h2: "How trauma shows up beyond the obvious symptoms",
        paragraphs: [
          "Trauma does not always announce itself clearly. Many people who carry unprocessed trauma experience it as chronic anxiety, difficulty trusting others, patterns of self-sabotage, intense emotional reactions that feel disproportionate, physical symptoms without clear medical cause, or a pervasive sense of being fundamentally different or broken.",
          "If you find yourself avoiding certain situations, relationships, or memories with an intensity that limits your life; if you have emotional reactions that feel like they \"belong\" to a past moment rather than the present; or if you feel chronically disconnected from your body, your emotions, or the people around you — these are all worth exploring with a trauma-informed therapist.",
        ],
      },
      {
        h2: "How trauma is treated",
        paragraphs: [
          "Trauma responds well to evidence-based therapy. EMDR (Eye Movement Desensitization and Reprocessing) has the strongest evidence base for PTSD and trauma processing; it helps the brain reprocess stored traumatic memories so they lose their intrusive, activating quality. Trauma-focused Cognitive Behavioural Therapy (TF-CBT) and somatic-based approaches are also well-supported. The first step does not require you to re-tell your trauma in detail — a good trauma therapist will work at a pace that is safe for your nervous system.",
        ],
        internalLinks: [
          { href: "/trauma-therapy-ottawa", label: "Trauma therapy at Valisen" },
          { href: "/faq/therapy-approaches", label: "What is EMDR and how does it work?" },
        ],
      },
    ],
    relatedSlugs: ["am-i-depressed", "is-my-grief-normal", "therapy-approaches"],
  },

  "is-my-grief-normal": {
    question: "Is my grief normal? When does grief become something that needs support?",
    category: "Mental Health Signs",
    categorySlug: "mental-health-signs",
    metaTitle: "Is My Grief Normal? When to Seek Grief Counselling | Valisen Ottawa",
    metaDescription:
      "Grief is deeply personal and has no fixed timeline. Learn the difference between normal grief and complicated grief, and when grief counselling in Ottawa can help.",
    updatedDate: "2026-05-01",
    intro:
      "Grief is one of the most universal human experiences and one of the least supported. There is no grief that is too much or too little, and there is no correct timeline. But there are patterns in grief that suggest professional support would help — not because your grief is wrong, but because you deserve to move through it with skilled companionship.",
    sections: [
      {
        h2: "What normal grief looks like",
        paragraphs: [
          "Grief following a significant loss — the death of a loved one, the end of a meaningful relationship, a major life transition — typically involves waves of sadness, anger, disbelief, longing, guilt, and relief, often cycling unpredictably and without warning. These waves tend to diminish in intensity over time, though they do not disappear. Most people find that while grief does not end, it does transform — from a raw wound into something that can be carried without constant acute pain.",
          "There is no fixed timeline for grief. The popular idea that it resolves in a year, or passes through five orderly stages, has limited research support. Grief is non-linear and deeply individual. What matters is whether you can continue to function, connect with people you love, and find moments of meaning or lightness alongside the loss — even imperfectly.",
        ],
      },
      {
        h2: "When grief may need professional support",
        paragraphs: [
          "Complicated Grief (also called Prolonged Grief Disorder) is a recognized clinical condition in which grief does not follow the expected trajectory. Signs include: grief that remains acutely painful and impairing months or years after the loss without any softening; an inability to accept the reality of the loss even intellectually; complete withdrawal from normal activities, relationships, or future planning; intense, prolonged yearning for the deceased; and difficulty imagining a meaningful life without the person.",
          "Grief can also trigger or unmask depression, anxiety, trauma symptoms, or substance use. If your grief has been accompanied by persistent low mood, panic attacks, significant alcohol or drug use, or thoughts of ending your own life, these are important signals that warrant professional attention.",
          "You do not need to be in crisis to seek support. Many people find grief therapy valuable not because they cannot cope at all, but because processing loss in the presence of a skilled therapist accelerates healing and helps them honour the loss in a way that feels true to the relationship.",
        ],
        internalLinks: [
          { href: "/grief-counselling-ottawa", label: "Grief counselling at Valisen" },
        ],
      },
    ],
    relatedSlugs: ["am-i-depressed", "trauma-signs", "first-therapy-session"],
  },

  "how-to-find-therapist": {
    question: "How do I find the right therapist in Ottawa?",
    category: "Finding a Therapist",
    categorySlug: "finding-a-therapist",
    metaTitle: "How to Find the Right Therapist in Ottawa | Valisen Mental Health",
    metaDescription:
      "Finding the right therapist in Ottawa takes more than a Google search. Here's a practical, honest guide from a local mental health team on what actually matters.",
    updatedDate: "2026-05-01",
    intro:
      "Finding the right therapist is both more important and more complicated than most people expect. The research on therapy effectiveness is clear: the quality of the therapeutic relationship — the alliance between you and your therapist — is one of the strongest predictors of outcome, often more predictive than the specific modality your therapist uses. That means finding the right fit matters enormously.",
    sections: [
      {
        h2: "Know what you are looking for (even roughly)",
        paragraphs: [
          "You do not need to arrive with a diagnosis or a clear sense of your goals. But it helps to have a rough sense of whether you are looking for short-term, structured support for a specific issue (anxiety, a transition, a relationship problem) or longer-term, exploratory work on patterns that have followed you for years. Some issues respond well to a focused, skills-based approach like CBT; others benefit from more depth-oriented, relational work.",
          "Consider also whether you have practical requirements: your insurance plan's eligibility criteria (some plans cover Registered Psychotherapists but not Registered Social Workers, or vice versa), language, cultural background, or lived experience.",
        ],
      },
      {
        h2: "What credentials to look for in Ontario",
        paragraphs: [
          "In Ontario, therapists are regulated through two main bodies: the College of Registered Psychotherapists of Ontario (CRPO), which registers Registered Psychotherapists (RP), and the Ontario College of Social Workers and Social Service Workers (OCSWSSW), which registers Registered Social Workers (RSW). Both designations require graduate-level training and ongoing professional accountability.",
          "Be cautious of unregulated practitioners who use terms like \"counsellor\" or \"life coach\" without a regulated designation — in Ontario, these titles are not protected, meaning anyone can use them regardless of training. A regulated designation offers meaningful consumer protection.",
        ],
      },
      {
        h2: "How Valisen makes the process easier",
        paragraphs: [
          "Rather than scrolling through directories and reading profiles of strangers, Valisen offers a free 20-minute phone consultation that gives you a direct sense of whether the fit is right before you commit to a full session. All of our therapists are regulated, experienced in evidence-based approaches, and chosen not just for clinical skill but for their ability to build genuine, warm therapeutic relationships.",
          "If after a session or two the fit does not feel right, tell us — we can transition you to another member of our team without you losing your history or starting over on a new platform.",
        ],
        internalLinks: [
          { href: "/therapists", label: "Meet our therapists" },
          { href: "/book-consultation", label: "Book a free 20-minute consultation" },
        ],
      },
    ],
    relatedSlugs: ["rp-vs-rsw", "first-therapy-session", "dont-know-what-i-need"],
  },

  "rp-vs-rsw": {
    question: "What is the difference between an RP and an RSW?",
    category: "Finding a Therapist",
    categorySlug: "finding-a-therapist",
    metaTitle: "RP vs RSW — What Is the Difference? | Valisen Ottawa",
    metaDescription:
      "Wondering what the difference is between a Registered Psychotherapist (RP) and a Registered Social Worker (RSW) in Ontario? We explain clearly — including insurance coverage.",
    updatedDate: "2026-05-01",
    intro:
      "If you have started searching for a therapist in Ontario, you have probably encountered these two designations. Both RPs and RSWs provide psychotherapy, and both are regulated health professionals. But their training backgrounds, regulatory frameworks, and insurance coverage can differ in ways that matter for your situation.",
    sections: [
      {
        h2: "Registered Psychotherapist (RP)",
        paragraphs: [
          "A Registered Psychotherapist (RP) is regulated by the College of Registered Psychotherapists of Ontario (CRPO). The RP designation was established in 2015 when Ontario passed the Psychotherapy Act, making psychotherapy a controlled act that can only be performed by regulated professionals. RPs typically hold a master's degree in psychotherapy, counselling psychology, or a related field, and their training centres specifically on the practice of psychotherapy.",
          "The RP designation is relatively specific to Ontario and is not widely recognized across Canada the way that social work designations are. This matters primarily for insurance: while many insurance plans now include RPs in their mental health coverage, some plans (particularly older benefit structures) may list only psychologists and social workers. Always verify with your specific plan.",
        ],
      },
      {
        h2: "Registered Social Worker (RSW)",
        paragraphs: [
          "A Registered Social Worker (RSW) is regulated by the Ontario College of Social Workers and Social Service Workers (OCSWSSW). Social work is a broader profession that encompasses community work, case management, and policy — but RSWs who specialize in direct clinical practice provide psychotherapy that is clinically indistinguishable from that provided by RPs.",
          "RSWs are more widely recognized across Canada and by insurance providers. Many benefit plans, including those that predate the RP designation, include RSWs under their mental health coverage. If your plan specifies \"registered social worker\" as a covered provider, an RSW is eligible.",
        ],
      },
      {
        h2: "Which should you choose?",
        paragraphs: [
          "For clinical purposes, the distinction matters less than the individual therapist's training, specialization, and the fit between you. Both designations are held to legally enforceable professional standards. The main practical difference is insurance eligibility: check your benefits plan to confirm which designations your plan covers before booking.",
          "Valisen's team includes both Registered Psychotherapists (RP) and Registered Social Workers (RSW), and any therapist can confirm their designation and registration number upon request.",
        ],
        internalLinks: [
          { href: "/insurance", label: "Insurance and coverage at Valisen" },
          { href: "/therapists", label: "Meet our therapists" },
        ],
      },
    ],
    relatedSlugs: ["does-insurance-cover-therapy", "which-plans-cover-rps", "how-to-find-therapist"],
  },

  "first-therapy-session": {
    question: "What happens in a first therapy session?",
    category: "Finding a Therapist",
    categorySlug: "finding-a-therapist",
    metaTitle: "What Happens in a First Therapy Session? | Valisen Ottawa",
    metaDescription:
      "Not sure what to expect from your first therapy appointment? Ottawa therapists walk you through exactly what happens so you can walk in feeling prepared.",
    updatedDate: "2026-05-01",
    intro:
      "The first therapy session is one of the most common things people feel anxious about before starting. Knowing what to expect — and what not to expect — makes it significantly easier to walk in.",
    sections: [
      {
        h2: "What the first session is not",
        paragraphs: [
          "The first session is not a performance review. You will not be judged, diagnosed on the spot, or told what is wrong with you. You do not need to have everything figured out before you arrive. You do not need to tell your therapist everything that has ever happened to you. A skilled therapist is not looking for you to be articulate, composed, or to present a perfectly organized account of your situation.",
        ],
      },
      {
        h2: "What actually happens",
        paragraphs: [
          "Most first sessions involve the therapist getting a sense of why you have come in, what your life currently looks like, and what kind of support would be most helpful. This is called an intake or assessment. Your therapist will ask open-ended questions — about your current concerns, your history (to the extent you are comfortable sharing), your relationships, your goals. Some of it may feel like a structured interview; some of it will feel more like a conversation.",
          "You will also have an opportunity to ask questions — about the therapist's approach, their experience with concerns similar to yours, what the process might look like over time, and anything about confidentiality or practical logistics that you want to understand before committing.",
        ],
      },
      {
        h2: "What makes a good first session",
        paragraphs: [
          "By the end of the first session, you should have a rough sense of whether this person is someone you could trust with the harder material. That does not mean you feel completely comfortable — building genuine trust takes time. But there should be at least a baseline sense of safety and non-judgment. If the session felt cold, dismissive, or like you were just filling out a questionnaire, that is worth paying attention to.",
          "The first session is also a two-way assessment: you are evaluating the therapist just as much as they are getting to know you. It is completely appropriate to try one or two sessions and then decide you would like to work with someone else. A good therapist will understand this.",
        ],
        callout:
          "Many people feel emotionally raw after a first session. This is normal — you have likely touched on things that carry weight. Be gentle with yourself afterward and give yourself time to decompress.",
      },
    ],
    relatedSlugs: ["how-to-find-therapist", "how-often-therapy", "therapy-approaches"],
  },

  "therapy-approaches": {
    question: "What is the difference between CBT, DBT, and EMDR?",
    category: "Finding a Therapist",
    categorySlug: "finding-a-therapist",
    metaTitle: "CBT vs DBT vs EMDR — What Is the Difference? | Valisen Ottawa",
    metaDescription:
      "CBT, DBT, and EMDR are all evidence-based therapy approaches — but they treat different things. Ottawa therapists explain each clearly and which conditions they suit.",
    updatedDate: "2026-05-01",
    intro:
      "When you are researching therapy, you will encounter a range of acronyms — CBT, DBT, EMDR, ACT, IFS. These are not competing philosophies so much as different tools designed for different situations. Here is a clear, practical overview of the most common ones.",
    sections: [
      {
        h2: "Cognitive Behavioural Therapy (CBT)",
        paragraphs: [
          "CBT is the most widely researched form of psychotherapy and has the strongest evidence base across the widest range of conditions — including depression, anxiety disorders, OCD, phobias, and insomnia. CBT is based on the understanding that our thoughts, emotions, and behaviours are interconnected, and that changing unhelpful thought patterns and behavioural habits can shift emotional experience.",
          "CBT is typically structured and time-limited. Sessions often include worksheets, between-session exercises, and a collaborative focus on identifying specific automatic thoughts and challenging their accuracy. If you are looking for a focused, skills-based approach that produces measurable change within a defined time period, CBT is a strong option.",
        ],
      },
      {
        h2: "Dialectical Behaviour Therapy (DBT)",
        paragraphs: [
          "DBT was originally developed by Marsha Linehan for individuals with Borderline Personality Disorder and has since been extended to a range of conditions involving emotional dysregulation — including self-harm, suicidality, eating disorders, and substance use. DBT combines CBT techniques with mindfulness-based approaches and emphasizes four core skill areas: mindfulness, distress tolerance, emotional regulation, and interpersonal effectiveness.",
          "Full DBT programs are intensive — they typically include individual therapy, group skills training, and therapist phone coaching. Modified DBT elements (specific skills modules without the full program) are also frequently incorporated into individual therapy for people who struggle with emotional intensity.",
        ],
      },
      {
        h2: "EMDR (Eye Movement Desensitization and Reprocessing)",
        paragraphs: [
          "EMDR is a specialized approach developed specifically for trauma. It is endorsed by the World Health Organization (WHO) and has the strongest evidence base of any approach for PTSD. The core of EMDR involves bilateral stimulation (often side-to-side eye movements, though tapping or auditory tones are also used) while the client holds a targeted traumatic memory in mind. This process appears to help the brain reprocess stored traumatic material so that it loses its intrusive, activating quality.",
          "EMDR does not require you to talk through your trauma in detail, which makes it more accessible for people who find verbal processing of traumatic events retraumatizing. The process works at the level of how the memory is stored in the nervous system, not just at the cognitive level.",
        ],
        internalLinks: [
          { href: "/trauma-therapy-ottawa", label: "Trauma therapy and EMDR at Valisen" },
          { href: "/faq/first-therapy-session", label: "What to expect in a first therapy session" },
        ],
      },
    ],
    relatedSlugs: ["trauma-signs", "first-therapy-session", "how-long-therapy"],
  },

  "therapy-cost-ottawa": {
    question: "How much does therapy cost in Ottawa?",
    category: "Cost and Insurance",
    categorySlug: "cost-insurance",
    metaTitle: "How Much Does Therapy Cost in Ottawa in 2026? | Valisen",
    metaDescription:
      "Therapy costs in Ottawa vary by provider type, experience, and format. This guide covers current rates, what affects price, and how to use your insurance benefits.",
    updatedDate: "2026-05-01",
    intro:
      "Cost is one of the most common practical barriers to starting therapy, and it is worth being honest about what the numbers look like. Therapy in Ottawa is an investment — but understanding the range helps you make an informed decision and use your insurance benefits effectively.",
    sections: [
      {
        h2: "Current therapy rates in Ottawa (2026)",
        paragraphs: [
          "Individual therapy sessions with a Registered Psychotherapist (RP) or Registered Social Worker (RSW) in Ottawa typically range from $120 to $200 per 50-minute session, with $140–$175 being the most common range for experienced private-practice therapists. Sessions with psychologists (who hold doctoral-level training) typically run higher, from $175 to $250 or more.",
          "Some therapists offer a sliding scale — fees adjusted based on income — which can significantly reduce costs for those without adequate insurance coverage. Community mental health centres and Employee Assistance Programs (EAPs) may offer free or reduced-cost sessions, though these are often limited in number (typically 6–12 sessions) and may have wait times.",
        ],
      },
      {
        h2: "What affects the cost",
        paragraphs: [
          "Session length (50 vs. 75 minutes), therapist credential level (RP vs. RSW vs. psychologist vs. psychiatrist), years of experience, and specialty training all influence pricing. Highly specialized therapists — those trained in EMDR, DBT, or trauma-specific modalities — may charge at the upper end of the range.",
          "Insurance coverage can significantly offset these costs. Many group benefit plans include $500–$2,000 per year for mental health services, which at average Ottawa rates covers approximately 4–14 sessions. Some plans renew annually, allowing you to budget across the year.",
        ],
      },
      {
        h2: "Getting the most out of your benefits",
        paragraphs: [
          "Before booking, check your benefits plan carefully: confirm which provider types are eligible (RP, RSW, psychologist), whether pre-authorization or a referral is required, the annual maximum, and whether sessions have a per-session cap. Many plans reimburse after the session; some have direct billing arrangements.",
          "If you are unsure whether your plan covers therapy at Valisen, we are happy to help you verify your coverage during your free initial consultation.",
        ],
        internalLinks: [
          { href: "/insurance", label: "Insurance and coverage at Valisen" },
          { href: "/faq/does-insurance-cover-therapy", label: "Does insurance cover therapy in Canada?" },
        ],
      },
    ],
    relatedSlugs: ["does-insurance-cover-therapy", "which-plans-cover-rps", "tax-deductible-therapy"],
  },

  "does-insurance-cover-therapy": {
    question: "Does insurance cover therapy in Canada?",
    category: "Cost and Insurance",
    categorySlug: "cost-insurance",
    metaTitle: "Does Insurance Cover Therapy in Canada? | Valisen Ottawa",
    metaDescription:
      "Yes — many Canadian employee benefit plans cover psychotherapy. Learn what to check in your plan, which providers are eligible, and how to claim therapy costs.",
    updatedDate: "2026-05-01",
    intro:
      "Many Canadians are surprised to discover that their employer health benefits cover a meaningful portion of psychotherapy costs. Understanding how your plan works can make the difference between accessing care and delaying it indefinitely.",
    sections: [
      {
        h2: "The short answer: yes, often",
        paragraphs: [
          "Most group health benefit plans in Canada include a mental health or paramedical coverage category that covers registered psychotherapists, registered social workers, or both — in addition to psychologists. The annual coverage typically ranges from $500 to $2,500 depending on your plan, employer, and tier.",
          "Some plans distinguish between provider types: they may cover psychologists but not RPs, or cover RSWs but not RPs, or cover all regulated mental health professionals equally. The key is checking your specific plan's wording rather than assuming.",
        ],
      },
      {
        h2: "What to check in your benefits plan",
        paragraphs: [
          "Log into your plan's member portal or call your plan administrator and confirm: (1) whether the plan includes mental health or paramedical coverage; (2) which provider types are listed as eligible (look for Registered Psychotherapist, Registered Social Worker, Psychologist); (3) what the annual maximum is and whether it has a per-session cap; (4) whether sessions require a physician's referral or pre-authorization; and (5) whether the plan reimburses you after you pay, or whether your therapist can bill the plan directly.",
        ],
      },
      {
        h2: "Employee Assistance Programs (EAPs)",
        paragraphs: [
          "Many employers also offer an Employee Assistance Program (EAP) that provides a small number of free therapy sessions — typically 3 to 8 — through a third-party provider. EAP sessions are confidential and do not require a referral. They are a useful starting point if you are not sure whether ongoing therapy is right for you, but their limited number means they are usually not sufficient for more complex or longer-term concerns.",
        ],
        internalLinks: [
          { href: "/insurance", label: "Full insurance coverage information at Valisen" },
          { href: "/faq/which-plans-cover-rps", label: "Which major insurance plans cover Registered Psychotherapists?" },
        ],
      },
    ],
    relatedSlugs: ["which-plans-cover-rps", "therapy-cost-ottawa", "tax-deductible-therapy"],
  },

  "which-plans-cover-rps": {
    question: "Which major insurance plans cover Registered Psychotherapists?",
    category: "Cost and Insurance",
    categorySlug: "cost-insurance",
    metaTitle: "Which Insurance Plans Cover Registered Psychotherapists? | Valisen",
    metaDescription:
      "Manulife, Sun Life, Canada Life, Greenshield, and Equitable Life all cover Registered Psychotherapists in Ontario — but coverage varies by plan. Here's what to know.",
    updatedDate: "2026-05-01",
    intro:
      "Coverage for Registered Psychotherapists has expanded significantly in Canada over the past five years. Most major insurers now include RPs as eligible providers under mental health benefit categories — but coverage depends on your specific plan design, not just your insurer.",
    sections: [
      {
        h2: "The major Canadian insurers",
        paragraphs: [
          "Manulife, Sun Life, Canada Life, Greenshield, and Equitable Life are the five largest group benefit insurers in Canada and all include coverage for Registered Psychotherapists across many of their standard plan tiers. Blue Cross plans (COLOUR and others) typically also include RP coverage. Most Desjardins plans cover RPs as well.",
          "That said, \"the plan includes RPs\" is a generalization. Whether your specific plan covers RPs depends on how your employer's plan was structured when it was set up. Older plans, particularly those designed before the Psychotherapy Act (2015) created the RP designation in Ontario, may list only psychologists and social workers as eligible. These plans are increasingly being updated, but not all have been.",
        ],
      },
      {
        h2: "How to verify your own plan",
        paragraphs: [
          "The most reliable way to confirm coverage is to call the member services number on your benefit card and ask specifically: \"Does my plan include coverage for sessions with a Registered Psychotherapist (RP) under the College of Registered Psychotherapists of Ontario?\" Ask also about the annual maximum and any per-session limits.",
          "Alternatively, log into your insurer's member portal. Benefit summaries are usually accessible online and will list eligible provider types under the mental health or extended health category.",
        ],
      },
      {
        h2: "What Valisen therapists are registered as",
        paragraphs: [
          "Valisen's team includes Registered Psychotherapists (RP) with CRPO and Registered Social Workers (RSW) with OCSWSSW. We can provide the full registration details of any therapist on your request, and we are happy to help you work through your benefits questions during your initial consultation.",
        ],
        internalLinks: [
          { href: "/insurance", label: "Insurance at Valisen — full details" },
          { href: "/faq/rp-vs-rsw", label: "What is the difference between an RP and an RSW?" },
        ],
      },
    ],
    relatedSlugs: ["does-insurance-cover-therapy", "rp-vs-rsw", "therapy-cost-ottawa"],
  },

  "tax-deductible-therapy": {
    question: "Can I claim therapy costs on my taxes in Canada?",
    category: "Cost and Insurance",
    categorySlug: "cost-insurance",
    metaTitle: "Is Therapy Tax Deductible in Canada? | Valisen Ottawa",
    metaDescription:
      "Therapy with an RP or RSW in Ontario may qualify as a medical expense under the CRA's Medical Expense Tax Credit. Here's what you need to know for 2026.",
    updatedDate: "2026-05-01",
    intro:
      "Canada's Medical Expense Tax Credit (METC) allows you to claim eligible health-related costs on your federal tax return. Psychotherapy may be eligible — but the rules depend on your province, the type of provider, and current CRA guidance.",
    sections: [
      {
        h2: "How the Medical Expense Tax Credit works",
        paragraphs: [
          "The METC is a non-refundable federal tax credit that allows you to claim medical expenses that exceed 3% of your net income (or $2,635 in 2026 — whichever is less). The credit is worth approximately 15 cents on every eligible dollar claimed federally, plus a provincial component that varies by province.",
          "To claim it, you add up all eligible medical expenses paid in any 12-month period ending in the tax year. Only the amount above the threshold is eligible for the credit. This means smaller out-of-pocket therapy costs may not generate a meaningful tax saving — but higher annual therapy costs can.",
        ],
      },
      {
        h2: "Is therapy with an RP or RSW eligible?",
        paragraphs: [
          "In Ontario, sessions with Registered Psychotherapists (RP) and Registered Social Workers (RSW) providing psychotherapy are likely eligible under the METC as services provided by a regulated health professional. The CRA's guidance in this area has evolved as the RP designation has matured; recent CRA publications and rulings have generally supported RP and RSW services as eligible medical expenses.",
          "However, CRA interpretations and guidance can change, and individual situations vary. We strongly recommend consulting a tax professional or the CRA directly to confirm what is eligible for your specific circumstances in the current tax year.",
        ],
      },
      {
        h2: "Receipts from Valisen",
        paragraphs: [
          "We provide itemized receipts after every session that include your therapist's full name, professional registration number, credential designation, and the session date and amount — the documentation typically required to support a medical expense claim. Retain these receipts for your tax filing.",
        ],
      },
    ],
    relatedSlugs: ["therapy-cost-ottawa", "does-insurance-cover-therapy", "which-plans-cover-rps"],
  },

  "how-often-therapy": {
    question: "How often should I go to therapy?",
    category: "About Sessions",
    categorySlug: "sessions",
    metaTitle: "How Often Should I Go to Therapy? | Valisen Mental Health Ottawa",
    metaDescription:
      "Weekly, biweekly, or monthly? Ottawa therapists explain how session frequency affects progress and how to find the right cadence for your situation.",
    updatedDate: "2026-05-01",
    intro:
      "Therapy frequency is not one-size-fits-all — it depends on what you are working on, where you are in the process, and what is practical for your life. But there are some clinical principles that can help you make a good decision.",
    sections: [
      {
        h2: "Why weekly sessions are the standard starting point",
        paragraphs: [
          "The most common starting cadence for therapy is once per week. Weekly sessions create the consistency and momentum that early therapeutic work requires. They allow the therapeutic relationship to develop quickly, give you enough material between sessions to bring back and process, and keep the thread of the work continuous enough that insights build on each other rather than being lost.",
          "Research supports weekly over less frequent contact in the early stages of therapy, particularly for more acute presentations — depression, anxiety disorders, trauma, crisis. When you are first establishing safety and trust with a therapist, longer gaps tend to slow progress.",
        ],
      },
      {
        h2: "When less frequent sessions make sense",
        paragraphs: [
          "As you make meaningful progress and the work shifts from acute stabilization to integration and maintenance, many people naturally move to biweekly sessions. This is often a collaborative decision made with your therapist — you have developed enough internal resources that longer intervals between sessions are productive rather than disruptive.",
          "Monthly or occasional check-in sessions are sometimes appropriate in the later stages of long-term work, when most goals have been met and the focus is on sustaining gains. Some people find a quarterly check-in valuable even years after completing a primary course of therapy.",
        ],
      },
      {
        h2: "The most important thing",
        paragraphs: [
          "The most consistent predictor of good therapy outcomes is showing up reliably. Imperfect consistency — attending most of the time, engaging genuinely even when it feels hard — produces better outcomes than waiting until everything is perfect or spacing sessions so far apart that continuity is lost. If weekly is financially difficult, biweekly is far better than stopping entirely.",
        ],
      },
    ],
    relatedSlugs: ["how-long-therapy", "first-therapy-session"],
  },

  "how-long-therapy": {
    question: "How long does therapy take? When will I feel better?",
    category: "About Sessions",
    categorySlug: "sessions",
    metaTitle: "How Long Does Therapy Take? Honest Answer | Valisen Ottawa",
    metaDescription:
      "There's no universal timeline for therapy — it depends on what you're working on. Ottawa therapists give an honest answer about what progress realistically looks like.",
    updatedDate: "2026-05-01",
    intro:
      "This is the question almost everyone wants to ask at the start of therapy and is often afraid to — either because they fear the answer, or because they worry it will make them seem impatient. The honest answer is: it depends. But we can give you a realistic picture of what different kinds of work typically require.",
    sections: [
      {
        h2: "Short-term, focused therapy (8–20 sessions)",
        paragraphs: [
          "For specific, circumscribed concerns — a particular anxiety, adjustment to a defined life transition, skill-building in a targeted area — structured short-term approaches like CBT often produce meaningful improvement within 8–20 sessions. Many EAP programs are designed around this model. If your goals are clear and relatively focused, this range is a realistic target.",
          "Important caveat: some people find that as one presenting concern resolves, deeper or longer-standing patterns come into view. What starts as 12-session work sometimes naturally evolves into longer engagement — and that is not a failure of the process.",
        ],
      },
      {
        h2: "Medium-term therapy (6–18 months)",
        paragraphs: [
          "More complex presentations — major depression, chronic anxiety, grief, relationship patterns, trauma — typically require longer work to achieve lasting change. In medium-term therapy, the early sessions focus on building the therapeutic relationship, stabilization, and developing shared understanding of what is being worked on. The middle phase involves the deeper work; the later phase focuses on consolidation and preparing for independent functioning.",
        ],
      },
      {
        h2: "Long-term and open-ended therapy",
        paragraphs: [
          "Some people benefit from longer-term, depth-oriented work — particularly those dealing with complex trauma, personality-level patterns, or longstanding relational difficulties that did not emerge in a single episode. This work is not about being \"stuck\" in therapy; it is about the depth of change that is possible when the therapeutic relationship itself becomes the primary vehicle of growth.",
        ],
      },
      {
        h2: "When will you feel better?",
        paragraphs: [
          "Most people notice some shift within the first few sessions — not resolution, but a sense of being understood, of having language for their experience, of early perspective shifts. Meaningful symptom improvement in well-defined conditions like depression or anxiety often appears within 6–12 weeks of consistent weekly sessions. The deeper work of changing long-standing patterns takes longer, but the changes tend to be more durable.",
        ],
      },
    ],
    relatedSlugs: ["how-often-therapy", "therapy-approaches", "first-therapy-session"],
  },

  "dont-know-what-i-need": {
    question: "What if I don't know what kind of therapy I need?",
    category: "About Sessions",
    categorySlug: "sessions",
    metaTitle: "What If I Don't Know What Kind of Therapy I Need? | Valisen Ottawa",
    metaDescription:
      "Not knowing what you need is the most common starting point for therapy. Ottawa therapists explain why that's perfectly fine and what happens next.",
    updatedDate: "2026-05-01",
    intro:
      "Not knowing what kind of therapy you need — or even what is wrong, exactly — is by far the most common position people are in when they first reach out. You do not need to arrive with a diagnosis, a clear treatment goal, or an understanding of therapeutic modalities. The not-knowing is itself something a good therapist is trained to work with.",
    sections: [
      {
        h2: "You don't need to have it figured out",
        paragraphs: [
          "Many people delay reaching out for therapy because they feel they do not have a \"good enough\" reason, or because they cannot articulate what they want to work on. Both of these are unnecessary barriers. \"I have not felt like myself for months and I can't figure out why\" is a completely valid reason to start therapy. So is \"things are objectively fine but I feel empty\" or \"I keep repeating the same patterns and I don't know how to stop.\"",
          "Clarity often comes in the process of therapy, not before it. The first few sessions are partly about collaboratively figuring out what you are actually working on.",
        ],
      },
      {
        h2: "What a consultation call does",
        paragraphs: [
          "A free 20-minute consultation call is not a clinical assessment — it is a brief, low-pressure conversation about what has brought you to therapy, what you are looking for, and whether we can help. You can share as little or as much as feels comfortable. Based on that conversation, we can recommend which therapist on our team is best positioned for your situation, and explain what early sessions might look like.",
        ],
      },
      {
        h2: "How therapists work with \"I don't know\"",
        paragraphs: [
          "A skilled therapist is trained to hold uncertainty alongside you. The early sessions are fundamentally exploratory: your therapist will ask questions, reflect back what they are hearing, and help you develop language for experiences that may have felt unspeakable. The goal is not to immediately assign a diagnosis and a treatment plan — it is to create a safe enough space that what is actually going on can begin to surface.",
          "Many people find that within two or three sessions, something clarifies — a thread emerges that they did not know was there. That is often where the meaningful work begins.",
        ],
        internalLinks: [
          { href: "/book-consultation", label: "Book a free 20-minute consultation call" },
        ],
      },
    ],
    relatedSlugs: ["first-therapy-session", "how-to-find-therapist", "how-often-therapy"],
  },

  "what-is-valisen": {
    question: "What is Valisen Mental Health?",
    category: "About Valisen",
    categorySlug: "about-valisen",
    metaTitle: "What Is Valisen Mental Health? | Ottawa Therapy Practice",
    metaDescription:
      "Valisen Mental Health is an Ottawa-based private therapy practice offering individual therapy, couples counselling, and specialized services from a focused team of registered therapists.",
    updatedDate: "2026-05-01",
    intro:
      "Valisen Mental Health is a private therapy practice based in Ottawa, Ontario. We offer evidence-based, personalized therapy for individuals dealing with anxiety, depression, trauma, grief, relationship challenges, and life transitions.",
    sections: [
      {
        h2: "Our approach",
        paragraphs: [
          "We believe that good therapy requires both clinical skill and genuine human connection. Our therapists are selected not only for their training and experience, but for their ability to build warm, real therapeutic relationships — the kind where you feel safe enough to be honest about what is actually going on.",
          "We work primarily with individual adults and offer virtual sessions throughout Ontario. Our team specializes in a range of evidence-based modalities including CBT, EMDR, DBT, and depth-oriented relational approaches.",
        ],
      },
      {
        h2: "Our team",
        paragraphs: [
          "Valisen's team includes Registered Psychotherapists (RP) with the College of Registered Psychotherapists of Ontario and Registered Social Workers (RSW) with the Ontario College of Social Workers and Social Service Workers. Our team is intentionally small — we prioritize quality and clinical fit over volume.",
          "Sessions with Valisen therapists are covered by most major Canadian insurance benefit plans that include mental health coverage. We provide itemized receipts for every session.",
        ],
        internalLinks: [
          { href: "/therapists", label: "Meet our therapists" },
          { href: "/about", label: "More about Valisen" },
        ],
      },
    ],
    relatedSlugs: ["how-to-book", "therapist-credentials", "languages-offered"],
  },

  "how-to-book": {
    question: "How do I book a consultation or my first session?",
    category: "About Valisen",
    categorySlug: "about-valisen",
    metaTitle: "How to Book Therapy at Valisen | Ottawa Mental Health",
    metaDescription:
      "Booking at Valisen is straightforward — start with a free 20-minute phone consultation, or book directly online. Here's exactly how the process works.",
    updatedDate: "2026-05-01",
    intro:
      "Starting therapy should not be complicated. Here is exactly how the process works at Valisen.",
    sections: [
      {
        h2: "Step 1: Free 20-minute consultation",
        paragraphs: [
          "The simplest starting point is to book a free 20-minute phone consultation. During that call, you can share (briefly) what has brought you to therapy, ask questions about our team and approach, and get a sense of whether Valisen is the right fit. There is no obligation to continue, and you do not need to prepare anything specific.",
          "You can book this call directly through our online booking system — no referral required. Sessions are typically available within a few days of your inquiry.",
        ],
      },
      {
        h2: "Step 2: First session",
        paragraphs: [
          "After your consultation call, if you would like to proceed, you will book a full 50-minute intake session with the therapist who is the best fit for your situation. The intake session is a chance to go deeper into what you are working on, ask any remaining questions, and begin building the therapeutic relationship.",
          "You will complete a brief intake form before your first appointment that covers basic information and consent. This keeps the first session itself focused on you rather than on paperwork.",
        ],
      },
      {
        h2: "Prefer to call?",
        paragraphs: [
          "If you would rather speak with someone directly before booking online, you can reach us by phone at 613-707-0333. We are happy to answer questions and help you figure out the right next step.",
        ],
        internalLinks: [
          { href: "/book-consultation", label: "Book your free consultation online" },
        ],
      },
    ],
    relatedSlugs: ["what-is-valisen", "first-therapy-session", "dont-know-what-i-need"],
  },

  "languages-offered": {
    question: "Do you offer therapy in languages other than English?",
    category: "About Valisen",
    categorySlug: "about-valisen",
    metaTitle: "Therapy in English, Arabic, French & Mandarin | Valisen",
    metaDescription:
      "Valisen Mental Health offers therapy in English, Arabic, French, and Mandarin — because the language you work in shapes the depth and safety of therapy.",
    updatedDate: "2026-07-29",
    intro:
      "The language in which therapy happens is not a neutral detail. The depth of emotional access, the precision of self-expression, and the safety of the therapeutic relationship are all meaningfully affected by whether you are working in your first language. At Valisen, therapy is available in English, Arabic, French, and Mandarin.",
    sections: [
      {
        h2: "Languages currently available",
        paragraphs: [
          "Our team currently offers therapy in English, Arabic, French, and Mandarin. Meryem offers sessions in English and Arabic, Dayong offers sessions in English and Mandarin, and Wilfred offers sessions in English and French. When booking, please indicate your language preference so we can match you with the right therapist.",
        ],
      },
      {
        h2: "Why it matters",
        paragraphs: [
          "Many people who are fluent or highly proficient in English still find that certain experiences, emotions, or memories are encoded in their first language. This is especially true for childhood experiences, intergenerational patterns, and identity-related material. Working in the language that holds those experiences can make the therapeutic process significantly more effective.",
          "For Arabic-speaking clients, working in Arabic can make it easier to explore culture, identity, faith, immigration or refugee experiences, family dynamics, and emotional concerns without translating every detail first.",
          "For Mandarin-speaking clients, working in Mandarin can make it easier to describe family dynamics, migration and cultural adjustment, and personal concerns without translating every detail first.",
        ],
        internalLinks: [
          { href: "/therapists", label: "Meet our therapists and see language options" },
        ],
      },
    ],
    relatedSlugs: ["what-is-valisen", "how-to-book", "how-to-find-therapist"],
  },

  "therapist-credentials": {
    question: "Are your therapists licensed and regulated in Ontario?",
    category: "About Valisen",
    categorySlug: "about-valisen",
    metaTitle: "Are Valisen Therapists Licensed in Ontario? | Credentials Explained",
    metaDescription:
      "Valisen therapists are Registered Psychotherapists with the College of Registered Psychotherapists of Ontario (CRPO) or Registered Social Workers with OCSWSSW. Learn what regulated means and how to verify your therapist's credentials.",
    updatedDate: "2026-05-01",
    intro:
      "Credential transparency matters. In Ontario, anyone can call themselves a \"counsellor\" or \"life coach\" without any regulated training. Understanding what makes a therapist regulated — and how to verify it — protects you as a client.",
    sections: [
      {
        h2: "What it means to be regulated in Ontario",
        paragraphs: [
          "Regulated health professionals in Ontario are registered with a professional college that holds them to legally enforceable standards of practice. These standards cover initial training requirements (typically a master's degree for psychotherapy providers), ongoing professional development, professional liability insurance, and a formal complaints and discipline process that the public can access.",
          "Being regulated is not the same as being licensed — in Canada, we typically use the term \"registered\" — but the implications are similar: you have recourse if your care falls below professional standards.",
        ],
      },
      {
        h2: "Valisen therapist designations",
        paragraphs: [
          "Valisen therapists are credentialed members of either the College of Registered Psychotherapists of Ontario (CRPO), as Registered Psychotherapists (RP), or the Ontario College of Social Workers and Social Service Workers (OCSWSSW), as Registered Social Workers (RSW). Both designations require graduate-level training and active registration in good standing.",
        ],
      },
      {
        h2: "How to verify",
        paragraphs: [
          "You can verify any therapist's registration at any time through the public registries maintained by CRPO (crpo.ca) or OCSWSSW (ocswssw.org). We are happy to provide the registration number and designation of any Valisen therapist upon request.",
        ],
        internalLinks: [
          { href: "/therapists", label: "Meet our therapists" },
          { href: "/faq/rp-vs-rsw", label: "What is the difference between an RP and an RSW?" },
        ],
      },
    ],
    relatedSlugs: ["rp-vs-rsw", "what-is-valisen", "does-insurance-cover-therapy"],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  "mental-health-signs": "Mental Health Signs",
  "finding-a-therapist": "Finding a Therapist",
  "cost-insurance": "Cost and Insurance",
  sessions: "About Sessions",
  "about-valisen": "About Valisen",
};

export function generateStaticParams() {
  return Object.keys(FAQ_PAGES).map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const page = FAQ_PAGES[params.slug];
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    openGraph: { title: page.metaTitle, description: page.metaDescription },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FAQEntryPage({ params }: { params: { slug: string } }) {
  const page = FAQ_PAGES[params.slug];
  if (!page) notFound();

  const related = page.relatedSlugs
    .map((s) => FAQ_PAGES[s])
    .filter(Boolean) as FAQPageEntry[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: page.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: page.intro + " " + page.sections.map((s) => s.paragraphs.join(" ")).join(" "),
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.question,
    description: page.metaDescription,
    dateModified: page.updatedDate,
    publisher: {
      "@type": "Organization",
      name: "Valisen Mental Health",
      url: "https://valisenmentalhealth.ca",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <NavBar />

      <main>
        {/* ── Breadcrumb ── */}
        <nav
          aria-label="Breadcrumb"
          className="border-b border-hairline bg-white px-6 py-3"
        >
          <ol className="container-v flex max-w-[860px] items-center gap-1.5 text-[12px] text-ink-secondary">
            <li>
              <Link href="/" className="hover:text-teal">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={12} />
            </li>
            <li>
              <Link href="/faq" className="hover:text-teal">
                FAQ
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={12} />
            </li>
            <li>
              <Link
                href={`/faq#${page.categorySlug}`}
                className="hover:text-teal"
              >
                {CATEGORY_LABELS[page.categorySlug] ?? page.category}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={12} />
            </li>
            <li className="truncate max-w-[220px] text-ink" aria-current="page">
              {page.question}
            </li>
          </ol>
        </nav>

        {/* ── Article ── */}
        <article className="bg-canvas py-16 md:py-24">
          <div className="container-v max-w-[860px]">
            {/* Back link */}
            <Link
              href="/faq"
              className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-teal hover:text-teal-dark"
            >
              <ArrowLeft size={14} />
              Back to all FAQs
            </Link>

            {/* Category tag */}
            <span className="badge-outline-teal mb-6 inline-block text-[11px] uppercase tracking-[0.08em]">
              {page.category}
            </span>

            {/* H1 */}
            <h1 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-[42px]">
              {page.question}
            </h1>

            {/* Last updated */}
            <p className="mt-4 text-[12px] text-ink-secondary">
              Last reviewed:{" "}
              {new Date(page.updatedDate).toLocaleDateString("en-CA", {
                year: "numeric",
                month: "long",
              })}
            </p>

            {/* Intro */}
            <p className="mt-8 text-[17px] leading-[1.8] text-ink md:text-[18px]">
              {page.intro}
            </p>

            {/* Divider */}
            <div className="my-10 h-px bg-hairline" />

            {/* Sections */}
            <div className="space-y-10">
              {page.sections.map((section, i) => (
                <section key={i}>
                  {section.h2 && (
                    <h2 className="mb-4 font-serif text-[22px] font-medium leading-[1.2] tracking-[-0.4px] text-ink md:text-[26px]">
                      {section.h2}
                    </h2>
                  )}
                  <div className="space-y-4">
                    {section.paragraphs.map((p, j) => (
                      <p key={j} className="text-[16px] leading-[1.85] text-ink-secondary">
                        {p}
                      </p>
                    ))}
                  </div>

                  {/* Callout block */}
                  {section.callout && (
                    <div className="mt-5 rounded-[12px] border border-teal/20 bg-teal/[0.06] px-5 py-4 text-[14px] leading-[1.7] text-teal-dark">
                      {section.callout}
                    </div>
                  )}

                  {/* Internal links */}
                  {section.internalLinks && section.internalLinks.length > 0 && (
                    <ul className="mt-5 space-y-1.5">
                      {section.internalLinks.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-teal underline underline-offset-2 hover:text-teal-dark"
                          >
                            {link.label}
                            <ChevronRight size={13} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </div>
        </article>

        {/* ── Related questions ── */}
        {related.length > 0 && (
          <section className="bg-white py-16">
            <div className="container-v max-w-[860px]">
              <h2 className="mb-8 font-serif text-[22px] font-medium tracking-[-0.4px] text-ink">
                Related questions
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.question}
                    href={`/faq/${Object.keys(FAQ_PAGES).find((k) => FAQ_PAGES[k] === r)}`}
                    className="group rounded-[14px] border border-hairline bg-[#FAFAF8] p-5 transition-all duration-200 hover:border-teal/30 hover:shadow-sm"
                  >
                    <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-teal">
                      {r.category}
                    </span>
                    <p className="text-[14px] font-medium leading-[1.4] text-ink group-hover:text-teal">
                      {r.question}
                    </p>
                  </Link>
                ))}
              </div>
              <div className="mt-8">
                <Link
                  href="/faq"
                  className="inline-flex items-center gap-1.5 text-[14px] text-teal underline underline-offset-2 hover:text-teal-dark"
                >
                  <ArrowLeft size={14} />
                  View all FAQs
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── CTA ── */}
        <section className="bg-teal-dark py-20">
          <div className="container-v max-w-[680px] text-center">
            <span className="badge-outline-white mb-5">READY TO START?</span>
            <h2 className="font-serif text-[30px] font-medium leading-[1.1] tracking-[-0.8px] text-canvas md:text-[36px]">
              Still have questions? Let&apos;s talk.
            </h2>
            <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-[1.7] text-white/75">
              Book a free 20-minute phone consultation. No pressure, no commitment — just a real
              conversation about how we can help.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={MATCHING_FORM_URL} className="btn-primary">
                Book Free Consultation
              </Link>
              <a
                href="tel:613-707-0333"
                className="text-[14px] font-medium text-white/80 hover:text-white"
              >
                or call 613‑707‑0333
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
