import type { Energy, Topic } from "./conversionModel";

type Offer = { title: string; invitation: string };
/** Copy follows the selected detail. It does not infer a diagnosis or an unselected problem. */
const offers: Record<Exclude<Topic, "none">, Record<string, Offer>> = {
  worry: {
    overthinking: { title: "Can’t switch off the overthinking?", invitation: "You chose a mind that won’t switch off. Use your free call to talk about the thoughts that keep coming back, and ask how a therapist would work with worry and overthinking with you." },
    social: { title: "Second-guessing yourself around other people?", invitation: "You mentioned second-guessing yourself in social situations. You can ask how a therapist approaches fear of judgment, social worry and feeling more comfortable around others. You don’t need to prepare the perfect explanation." },
    body: { title: "Feeling on edge when you want to relax?", invitation: "You chose feeling tense or on edge. Your free call is a chance to describe what that feels like and ask how a therapist approaches anxiety and difficulty settling. Start with what you’ve noticed." },
    unsure: { title: "Worry showing up in more than one way?", invitation: "You chose a little of everything. You don’t have to separate overthinking, social worry and feeling on edge before asking for support. In the free call, ask how a therapist would help you understand the pattern." },
  },
  burnout: {
    overload: { title: "Too much on your plate, with little room for you?", invitation: "You pointed to the load of work, school, caregiving or responsibilities. In your free call, talk about what’s asking the most of you and ask how a therapist works with stress, overload and making room for your needs." },
    boundaries: { title: "Saying yes when you’re already stretched?", invitation: "You chose putting everyone else first. You can ask about working on boundaries, the guilt around saying no, and making room for yourself without needing to explain everyone else’s needs first." },
    rest: { title: "Resting, but still finding it hard to switch off?", invitation: "You said rest doesn’t feel like rest. Use the free call to describe what happens when you try to take a break, and ask how a therapist would approach stress and difficulty switching off." },
    unsure: { title: "Tired, but not sure what’s wearing you down?", invitation: "You know you’re tired, even if you can’t pinpoint why. That is something you can bring to the free call. Ask how a therapist explores stress, responsibilities and the patterns that use up your energy." },
  },
  mood: {
    motivation: { title: "Getting going takes more effort than you’d like?", invitation: "You chose difficulty getting going with everyday tasks. In your free call, describe what feels hard to start and ask how a therapist works with low mood and motivation. You don’t need a diagnosis to ask." },
    disconnected: { title: "Not feeling like yourself lately?", invitation: "You mentioned feeling less connected to people or things you enjoy. You can start the free call with exactly that, and ask how a therapist supports low mood and feeling disconnected." },
    heavy: { title: "Things feel heavy. Want somewhere to talk?", invitation: "You said things feel heavy and you could use a place to talk. Your free call is a chance to meet a therapist, explain as much as you’re comfortable with, and ask what ongoing support could look like." },
    unsure: { title: "Feeling low, but not sure how to describe it?", invitation: "You don’t have to find a clear label or the right words before making contact. Start the free call with “I haven’t been feeling like myself,” and ask how the therapist would help you explore what’s going on." },
  },
  relationships: {
    couples: { title: "Not connecting with your partner the way you’d like?", invitation: "You chose your relationship with your partner. Whether conversations turn into conflict or you’ve been feeling distant, ask about couples therapy, how sessions work and how the therapist approaches communication and connection." },
    family: { title: "Family or friendship tension on your mind?", invitation: "You chose family or friendships. The free call gives you a place to ask about support for tension, distance or feeling misunderstood, and how a therapist would help you work through the relationship patterns you want to change." },
    boundaries: { title: "Putting others first, even when it costs you?", invitation: "You chose boundaries and people-pleasing. You can ask how a therapist works with saying no, making room for your own needs and navigating the feelings that come with changing an old pattern." },
    unsure: { title: "A relationship on your mind, but unsure where to start?", invitation: "You’d rather talk it through than pin it down here. In the free call, start with the relationship that’s on your mind and ask whether individual or couples support would be worth exploring." },
  },
  focus: {
    attention: { title: "Starting or finishing things harder than you’d like?", invitation: "You chose difficulty with starting, finishing or following through. Ask how a therapist supports focus, getting started and the frustration around tasks. This check-in doesn’t identify ADHD; you can discuss your experience without assuming a diagnosis." },
    perfectionism: { title: "Nothing feels good enough, even when you try hard?", invitation: "You chose high standards and a loud inner critic. In your free call, ask how a therapist approaches perfectionism, self-criticism and the pressure to get everything right. Start with a situation that feels familiar." },
    confidence: { title: "Hard on yourself more than you’d like?", invitation: "You chose confidence and self-esteem. You can ask about working with self-criticism and the moments when you find it hard to trust yourself. The free call helps you see whether this therapist’s approach feels right." },
    unsure: { title: "Want to understand what’s making focus or confidence harder?", invitation: "You chose a mix of focus, high standards and being hard on yourself. You can bring that mix to the free call and ask how a therapist would help you explore the patterns, without deciding on a label first." },
  },
  changes: {
    grief: { title: "Missing someone or something you’ve lost?", invitation: "You chose a loss or goodbye. That might mean grief, a separation or something you miss. In the free call, ask how the therapist supports loss and what ongoing conversations could look like at your pace." },
    transition: { title: "A new chapter, with a lot to figure out?", invitation: "You chose a change in work, school, where you live or another part of life. Ask how a therapist supports transitions and helps people think through the expectations, decisions and feelings that come with a new chapter." },
    identity: { title: "Trying to figure out where you fit?", invitation: "You chose identity, belonging or expectations. You can ask whether this therapist is someone you could talk with about who you are, what matters to you and the pressure of other people’s expectations." },
    unsure: { title: "A lot has changed. Want to talk it through?", invitation: "You said a lot has changed and you’d like space to process it. Use the free call to describe the part you want to start with and ask how a therapist approaches life changes and uncertainty." },
  },
};

const wellbeingOffers: Record<string, Offer> = {
  balance: { title: "Feeling okay? Keep making time for yourself.", invitation: "You chose keeping your balance. If you’re curious about therapy, use a free call to ask about maintaining boundaries and making space for yourself. You don’t need to be struggling to ask what therapy involves." },
  connection: { title: "Want to invest more in your relationships?", invitation: "You chose investing in your relationships. A free call is a chance to ask about communication, connection and what individual relationship support could involve. You can simply explore the idea before deciding on anything." },
  clarity: { title: "Thinking about what’s next? Talk it through.", invitation: "You chose thinking about your next chapter. If it would be useful, ask a therapist how they support decisions, life changes and making room for what matters to you. Your first conversation is free." },
  unsure: { title: "No specific concern? You can still ask about therapy.", invitation: "You’re simply checking in, and your reflection can be enough. If you’re curious, a free call lets you meet a therapist and ask about their approach, fees or what therapy is like. There’s no need to come with a problem to explain." },
};

export function consultationOfferFor(topic: Topic, detail: string, energy: Energy, wellbeing: boolean): Offer {
  if (topic !== "none") return offers[topic][detail];
  if (wellbeing) {
    const offer = wellbeingOffers[detail];
    return detail === "balance" && energy === "energized" ? { ...offer, title: "Feeling good? Keep making time for yourself." } : offer;
  }
  const opening = energy === "drained" ? "Feeling drained" : "Running low";
  const lowEnergyOffers: Record<string, Offer> = {
    balance: { title: `${opening}, without a clear reason why?`, invitation: "You’d like a little more balance, even though there isn’t one specific concern to name. You can use the free call to talk about your energy and ask how a therapist would help you explore what’s using it up." },
    connection: { title: `${opening} and wanting more connection?`, invitation: "You chose wanting more connection while your energy is low. Ask a therapist about making room for yourself and your relationships, and whether their approach feels like a useful place to start." },
    clarity: { title: `${opening} and looking for a clearer next step?`, invitation: "You’d like more clarity but haven’t named a specific concern. Start the free call with how you’ve been feeling, and ask how the therapist would help you work out what kind of support you want." },
    unsure: { title: "Low on energy, but not sure what you need?", invitation: "You don’t have to work out the reason before asking a question. In the free call, you can describe the low energy you noticed and ask about the therapist’s approach. You choose whether to take things further." },
  };
  return lowEnergyOffers[detail];
}
