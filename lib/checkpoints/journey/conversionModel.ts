/** Mental Battery journey. Reflection answers never enter a request or analytics payload. */
import type { ConcernTag } from "@/lib/therapists";
import { validateContact as validateSelectedContact, type ContactDraft } from "./contact";
import { consultationOfferFor } from "./conversionOffers";
import type { ClinicianReassurance } from "./clinicianReassurance";

export const CONVERSION_VERSION = "mental-battery-v3";
export type Energy = "energized" | "okay" | "low" | "drained";
export type Topic = "worry" | "burnout" | "mood" | "relationships" | "focus" | "changes" | "none";
export type Impact = "little" | "sometimes" | "often" | "much";
export type JourneyAnswers = { energy: Energy | null; topic: Topic | null; detail: string | null; impact: Impact | null };
export const EMPTY_JOURNEY: JourneyAnswers = { energy: null, topic: null, detail: null, impact: null };
export type Choice = { value: string; label: string; hint?: string; icon?: string };
export type Question = { key: keyof JourneyAnswers; title: string; subtitle: string; choices: Choice[] };

export function isWellbeingCheckin(answers: JourneyAnswers) {
  return answers.topic === "none" && (answers.energy === "energized" || answers.energy === "okay");
}
export function questionCount(answers: JourneyAnswers) { return isWellbeingCheckin(answers) ? 3 : 4; }

const details: Record<Topic, { title: string; choices: Choice[] }> = {
  worry: { title: "What does that feel like for you?", choices: [
    { value: "overthinking", label: "My mind won’t switch off", hint: "Worrying, replaying, overthinking" },
    { value: "social", label: "I second-guess myself around people", hint: "Social situations or fear of judgment" },
    { value: "body", label: "I feel tense or on edge", hint: "Hard to settle, even when I want to" },
    { value: "unsure", label: "A little of everything", hint: "I’m still finding the words" },
  ] },
  burnout: { title: "Where do you feel most stretched?", choices: [
    { value: "overload", label: "Too much is on my plate", hint: "Work, school, caregiving or responsibilities" },
    { value: "boundaries", label: "Everyone else comes first", hint: "Saying yes when I’m already running low" },
    { value: "rest", label: "Rest doesn’t feel like rest", hint: "Switching off is harder than it sounds" },
    { value: "unsure", label: "I can’t quite pinpoint it", hint: "I just know I’m tired" },
  ] },
  mood: { title: "What would you like someone to understand?", choices: [
    { value: "motivation", label: "Getting going takes a lot", hint: "Motivation and everyday tasks" },
    { value: "disconnected", label: "I don’t feel quite like myself", hint: "Less connected to people or things I enjoy" },
    { value: "heavy", label: "Things feel heavy lately", hint: "I could use a place to talk" },
    { value: "unsure", label: "I’m not sure how to describe it", hint: "That’s okay, too" },
  ] },
  relationships: { title: "Which kind of connection is on your mind?", choices: [
    { value: "couples", label: "My relationship with my partner", hint: "Communication, conflict or feeling distant" },
    { value: "family", label: "Family or friendships", hint: "Tension, distance or feeling misunderstood" },
    { value: "boundaries", label: "My boundaries and people-pleasing", hint: "Making room for my own needs" },
    { value: "unsure", label: "I’d rather talk it through", hint: "No need to figure it all out here" },
  ] },
  focus: { title: "Where does it get frustrating?", choices: [
    { value: "attention", label: "Starting or finishing things", hint: "Focus, follow-through or feeling scattered" },
    { value: "perfectionism", label: "Nothing feels good enough", hint: "High standards and a loud inner critic" },
    { value: "confidence", label: "I’m hard on myself", hint: "Confidence and self-esteem" },
    { value: "unsure", label: "It’s a mix of these", hint: "I’d like to understand the pattern" },
  ] },
  changes: { title: "What are you finding your way through?", choices: [
    { value: "grief", label: "A loss or goodbye", hint: "Grief, separation or something I miss" },
    { value: "transition", label: "A new chapter", hint: "Work, school, a move or a major change" },
    { value: "identity", label: "Figuring out where I fit", hint: "Identity, belonging or expectations" },
    { value: "unsure", label: "A lot has changed", hint: "I’d like some space to process it" },
  ] },
  none: { title: "What would you like to make more room for?", choices: [
    { value: "balance", label: "A little more balance", hint: "Keeping the things that help me feel well" },
    { value: "connection", label: "Better connection", hint: "With myself or the people in my life" },
    { value: "clarity", label: "A clearer sense of direction", hint: "Thinking things through with someone" },
    { value: "unsure", label: "Nothing in particular", hint: "I’m simply taking a moment for myself" },
  ] },
};

export function questionFor(step: number, answers: JourneyAnswers): Question {
  if (step === 0) return { key: "energy", title: "How’s your battery today?", subtitle: "Think about the last few days. Pick what feels closest.", choices: [
    { value: "energized", label: "Feeling good", hint: "I have some energy to spare", icon: "full" },
    { value: "okay", label: "Doing okay", hint: "A little up, a little down", icon: "steady" },
    { value: "low", label: "Running low", hint: "I could use a recharge", icon: "low" },
    { value: "drained", label: "Feeling drained", hint: "I’m running on very little", icon: "empty" },
  ] };
  if (step === 1) return { key: "topic", title: answers.energy === "energized" ? "Anything you’d like to check in on?" : "What’s taking up the most space?", subtitle: answers.energy === "energized" ? "Pick an area you’re curious about, or simply check in without a concern." : "You don’t need a label or diagnosis. Just a starting point.", choices: [
    { value: "worry", label: "Worry & overthinking", icon: "worry" },
    { value: "burnout", label: "Stress & burnout", icon: "burnout" },
    { value: "mood", label: "Feeling low", icon: "mood" },
    { value: "relationships", label: "Relationships", icon: "relationships" },
    { value: "focus", label: "Focus & self-confidence", icon: "focus" },
    { value: "changes", label: "Loss or life changes", icon: "changes" },
    { value: "none", label: "Nothing specific — just checking in", icon: "none" },
  ] };
  if (step === 2 && isWellbeingCheckin(answers)) return { key: "detail", title: "What would you like from this check-in?", subtitle: "You can look ahead, reflect, or simply leave with your result.", choices: [
    { value: "balance", label: "Keep feeling balanced", hint: "Make room for what’s working" },
    { value: "connection", label: "Invest in my relationships", hint: "Connection, communication or boundaries" },
    { value: "clarity", label: "Think about what’s next", hint: "My goals or the next chapter" },
    { value: "unsure", label: "Just see my reflection", hint: "No other goal today" },
  ] };
  if (step === 2) return { key: "detail", ...details[answers.topic || "none"], subtitle: "Only share what feels comfortable. Your answers stay on this device." };
  return { key: "impact", title: answers.topic === "none" ? "How much is the low energy affecting your day?" : "How much space is this taking in your day?", subtitle: "This helps your reflection feel more like you.", choices: [
    { value: "little", label: "Not much right now", hint: "It’s more of a check-in than a concern" },
    { value: "sometimes", label: "It comes and goes", hint: "Some moments are harder than others" },
    { value: "often", label: "It’s on my mind quite often", hint: "I’d like things to feel a bit easier" },
    { value: "much", label: "It’s affecting my everyday life", hint: "It’s taking more energy than I’d like" },
  ] };
}

export function updateJourney(answers: JourneyAnswers, step: number, value: string): JourneyAnswers {
  const question = questionFor(step, answers);
  if (!question.choices.some(choice => choice.value === value)) return answers;
  const next = { ...answers, [question.key]: value };
  // A different topic needs its own detail. Never carry a couples answer into another branch.
  if (question.key === "topic" && value !== answers.topic) { next.detail = null; next.impact = null; }
  if (questionCount(next) !== questionCount(answers)) next.impact = null;
  return next;
}

export type JourneyClinician = {
  slug: string; name: string; credential: string; photo: string; photoPosition?: string;
  languages: string[]; registration: string; fee: string; tags: ConcernTag[]; couples: boolean;
  consultationMinutes: number;
  reassurance?: ClinicianReassurance;
};
type Care = { label: string; title: string; invitation: string; tag: ConcernTag; preferences: string[]; talkingPoints: string[]; smallStep: string };
const care: Record<Topic, Care> = {
  worry: { label: "Support for worry & anxiety", title: "More calm. Less mental noise.", invitation: "Explore the worry patterns that take up so much room, and what support could look like for you.", tag: "anxiety", preferences: ["ryann-simpson", "meryem-ibrahim", "dayong-quan"], talkingPoints: ["What’s keeping your mind busy", "How they work with worry and anxiety", "Whether their approach feels right for you"], smallStep: "Write down one thing your mind keeps returning to. Beside it, note what you can influence today — and what you can leave for later." },
  burnout: { label: "Stress & burnout support", title: "Room to breathe. Without doing more.", invitation: "Talk about the load you’re carrying, your boundaries and where you want more breathing room.", tag: "stress-burnout", preferences: ["ryann-simpson", "meryem-ibrahim", "tim-kahtava"], talkingPoints: ["What’s asking the most of you", "How they approach stress and boundaries", "What a manageable next step might look like"], smallStep: "Pick one non-urgent task you can put down for today. A smaller load can start with one decision, rather than a whole new routine." },
  mood: { label: "Mood & depression support", title: "You don’t have to carry the low days alone.", invitation: "Make space to talk about the low days, motivation or feeling unlike yourself, without needing the perfect explanation.", tag: "depression", preferences: ["meryem-ibrahim", "dayong-quan", "tim-kahtava"], talkingPoints: ["What you’ve been noticing in your mood", "How they support low mood and motivation", "What working together could involve"], smallStep: "Choose one gentle point of connection today: a familiar activity, a brief message to someone you trust, or a few minutes outside if that feels possible." },
  relationships: { label: "Relationship support", title: "Healthier boundaries. Closer connections.", invitation: "Talk through relationship patterns, communication or making room for your own needs.", tag: "relationship-challenges", preferences: ["ryann-simpson", "wilfred-bengnwi", "tim-kahtava"], talkingPoints: ["The connection you’d like to feel more of", "How they approach communication and boundaries", "Whether individual or couples support fits"], smallStep: "Finish this sentence for yourself: “What I wish someone understood is…” You don’t have to send it to anyone; it can simply help you find your words." },
  focus: { label: "Focus & self-esteem support", title: "Less self-blame. A clearer way forward.", invitation: "Explore what makes focus, follow-through or confidence difficult, and ask how a therapist could support you.", tag: "adhd", preferences: ["ryann-simpson"], talkingPoints: ["The moments that feel frustrating", "How they support focus and self-esteem", "What their therapy approach is like"], smallStep: "Choose one task and name its smallest possible first step. Aim for a beginning, rather than a perfect finish." },
  changes: { label: "Support through life changes", title: "Space for what’s changed.", invitation: "Talk about the change or loss you’re navigating, and the kind of support that would feel useful.", tag: "life-transitions", preferences: ["meryem-ibrahim", "tim-kahtava", "ryann-simpson"], talkingPoints: ["What has changed for you", "How they work with transitions or loss", "What support can look like at your pace"], smallStep: "Name one thing that feels different and one thing that still feels familiar. You don’t need to make sense of the whole chapter today." },
  none: { label: "Space to think things through", title: "What’s working is worth protecting.", invitation: "If you’re curious, use a free conversation to explore balance, connection or what you want from the next chapter.", tag: "life-transitions", preferences: ["ryann-simpson", "meryem-ibrahim", "tim-kahtava"], talkingPoints: ["What you’d like more room for", "Questions about therapy, fees or fit", "Whether you want any further support"], smallStep: "Notice one thing that gives you energy and one that uses it up. Make a little room for the first one this week." },
};

export function buildJourneyReflection(answers: JourneyAnswers) {
  if (!answers.energy || !answers.topic || !answers.detail) return null;
  const wellbeing = isWellbeingCheckin(answers);
  if (!wellbeing && !answers.impact) return null;
  if (!questionFor(2, answers).choices.some(choice => choice.value === answers.detail)) return null;
  const base = care[answers.topic];
  let pathway = { ...base };
  const couples = answers.topic === "relationships" && answers.detail === "couples";
  if (couples) pathway = { ...base, label: "Couples & relationship support", title: "Less arguing. More understanding.", invitation: "Ask about couples therapy, communication and rebuilding connection. You can start with a free conversation about your options.", tag: "couples-therapy", talkingPoints: ["What you want to feel different together", "How couples sessions work", "Their approach, fees and availability"] };
  if (answers.topic === "changes" && answers.detail === "grief") pathway = { ...base, label: "Grief & loss support", tag: "grief", preferences: ["meryem-ibrahim", "tim-kahtava", "dayong-quan"] };
  if (answers.topic === "focus" && answers.detail === "confidence") pathway = { ...base, tag: "self-esteem" };
  if ((answers.topic === "focus" && answers.detail === "perfectionism") || (answers.topic === "relationships" && answers.detail === "boundaries")) pathway = { ...base, tag: "perfectionism-people-pleasing", preferences: ["ryann-simpson"], label: "Boundaries & self-compassion support" };
  // A completed wellbeing branch never treats an old impact answer as current evidence.
  const currentImpact = wellbeing ? null : answers.impact;
  const strain = currentImpact === "often" || currentImpact === "much";
  const bars = answers.energy === "drained" ? 1 : answers.energy === "low" ? 2 : answers.energy === "energized" && !strain ? 4 : 3;
  const title = answers.energy === "drained" ? "Your battery could use some care." : answers.energy === "low" ? "You’re running a little low." : strain ? "Energy and strain can coexist." : answers.energy === "energized" ? "There’s some charge to protect." : wellbeing ? "You’re doing okay today." : "A little steady. A little stretched.";
  const energy = { energized: "You’ve been feeling good", okay: "You’ve been doing okay", low: "You’ve been running low", drained: "You’ve been feeling drained" }[answers.energy];
  const detail = questionFor(2, answers).choices.find(choice => choice.value === answers.detail)!;
  const impact = currentImpact ? { little: "without much impact on daily life right now", sometimes: "with some harder moments along the way", often: "and it’s been taking up space quite often", much: "and it’s affecting everyday life" }[currentImpact] : null;
  const summary = wellbeing ? `${energy}. You chose “${detail.label.toLowerCase()}.” This can simply be a pause to notice how you’re doing; you don’t have to find a problem to solve.` : answers.topic === "none" ? `${energy}. You chose “${detail.label.toLowerCase()},” ${impact}. You don’t have to turn that pause into a problem to solve.` : `${energy}, ${impact}. You highlighted “${detail.label.toLowerCase()}.”`;
  const offer = consultationOfferFor(answers.topic, answers.detail, answers.energy, wellbeing);
  if (wellbeing && answers.detail === "connection") pathway = { ...pathway, tag: "relationship-challenges", label: "Communication & relationship support", preferences: ["ryann-simpson", "wilfred-bengnwi", "tim-kahtava"] };
  const reassurance = wellbeing ? null : currentImpact === "little" ? "You said this isn’t affecting your day much. The call can simply be a chance to ask questions." : currentImpact === "sometimes" ? "You said it comes and goes. You can start with one of those harder moments." : currentImpact === "often" ? "You said this is on your mind quite often. Start with the part you most want someone to understand." : "You said it’s affecting everyday life. You don’t have to fit the whole story into the first call.";
  const wellbeingStarter: Record<string, string> = { balance: wellbeing ? "I’d like to keep feeling balanced." : "I’d like a little more balance.", connection: wellbeing ? "I’d like to invest in my relationships." : "I’d like to feel more connected.", clarity: "I’d like to think through what comes next.", unsure: wellbeing ? "I’m curious about what therapy is like, even though I don’t have a particular concern." : "I’m not sure what I need yet." };
  return { ...pathway, supportTitle: offer.title, invitation: offer.invitation, reassurance, couples, bars, title, summary, detail: detail.label, topic: questionFor(1, answers).choices.find(choice => choice.value === answers.topic)!.label, starter: `${energy.replace("You’ve", "I’ve")}. ${answers.topic === "none" ? wellbeingStarter[answers.detail] : `What feels closest is: ${detail.label.toLowerCase()}.`} I’d like to ask what working together could look like.`, positive: wellbeing };
}

export function recommendClinicians(reflection: NonNullable<ReturnType<typeof buildJourneyReflection>>, clinicians: JourneyClinician[], language: string) {
  return clinicians.filter(person => person.tags.includes(reflection.tag) && (!reflection.couples || person.couples) && (language === "any" || person.languages.includes(language))).sort((a, b) => {
    const rank = (slug: string) => { const index = reflection.preferences.indexOf(slug); return index < 0 ? 99 : index; };
    return rank(a.slug) - rank(b.slug);
  });
}

export type JourneyContactDraft = Omit<ContactDraft, "method" | "email">;

export function validateContact(draft: JourneyContactDraft) {
  return validateSelectedContact({ ...draft, method: "phone", email: "" });
}

export function callRequestPayload(draft: JourneyContactDraft, code: string, clinician: JourneyClinician | undefined, language: string, service: "individual" | "couples") {
  return { checkpointCode: code, funnelVersion: CONVERSION_VERSION, firstName: draft.firstName.trim(), preferredContactMethod: "phone" as const, contact: draft.phone.trim(), optionalMessage: draft.message.trim(), consent: draft.consent, consentText: "I agree that Valisen Mental Health may contact me about this free consultation request and help arrange a therapist and time.", consentVersion: "checkpoint-free-call-v3", preferredTherapist: clinician?.slug || "team-help", consultationLanguage: language, requestedService: service };
}
