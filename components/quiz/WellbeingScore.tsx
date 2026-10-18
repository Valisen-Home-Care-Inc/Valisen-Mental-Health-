import { QUESTIONS, SCORE_BANDS, scoreBandDetailsFor, type Answers } from "@/lib/quiz";
import styles from "./ResultsReveal.module.css";

/** Mouth shapes for the face in the score marker, saddest → happiest. */
const MOUTHS = {
  hard: "M8 17 Q12 13 16 17",
  struggling: "M8.5 16.4 Q12 14.2 15.5 16.4",
  managing: "M8.5 15 Q12 16.8 15.5 15",
  well: "M8 14 Q12 18.5 16 14",
} as const;

function Face({ color, mouth, size }: { color: string; mouth: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="10" r="1" fill={color} stroke="none" />
      <circle cx="15" cy="10" r="1" fill={color} stroke="none" />
      <path d={mouth} />
    </svg>
  );
}

/** Short names for the check-in items, used in "What shaped your score". */
const CHECKIN_SHORT_LABELS: Record<string, string> = {
  worry_1: "Hard to stop worrying",
  mood_1: "Less interest or pleasure",
  stress_1: "Running on empty",
  worry_2: "Tense or on edge",
  mood_2: "Feeling down",
  relationships_1: "Tension in a close relationship",
  stress_2: "Overwhelmed",
  worry_3: "Racing thoughts",
  mood_3: "Low motivation",
  stress_3: "Rest doesn't recharge you",
  relationships_2: "Feeling alone",
  sleep: "Sleep trouble",
};
const MAX_CHECKIN_DETAILS = 5;

function optionLabel(id: string, value: unknown): string | undefined {
  return QUESTIONS.find((item) => item.id === id)?.options.find((option) => option.value === value)?.label;
}

/**
 * Readable "what shaped your score" chips, only from answers held in memory:
 * the check-in items reported most often, then how long and how much.
 */
export function scoreDetails(answers: Answers | undefined): string[] {
  if (!answers) return [];
  const checkins = Object.keys(CHECKIN_SHORT_LABELS)
    .map((id) => ({ id, value: answers[id] }))
    .filter((item): item is { id: string; value: number } => typeof item.value === "number" && item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_CHECKIN_DETAILS)
    .map((item) => `${CHECKIN_SHORT_LABELS[item.id]}: ${optionLabel(item.id, item.value)?.toLowerCase()}`);
  const duration = optionLabel("duration", answers.duration);
  const impact = optionLabel("impact", answers.impact);
  return [
    ...checkins,
    ...(duration ? [`Going on for: ${duration.toLowerCase()}`] : []),
    ...(impact ? [`Effect on daily life: ${impact.toLowerCase()}`] : []),
  ];
}

export default function WellbeingScore({
  score,
  firstName,
  answers,
  safetyFlagged,
  onDetailsOpened,
}: {
  score: number;
  firstName: string;
  answers?: Answers;
  safetyFlagged: boolean;
  onDetailsOpened?: () => void;
}) {
  const band = scoreBandDetailsFor(score) ?? SCORE_BANDS[0];
  const shown = Math.min(100, Math.max(1, Math.round(score)));
  const details = scoreDetails(answers);
  const name = firstName.trim();

  return (
    <div className={styles.score} data-band={band.key}>
      <p className={styles.scoreEyebrow}>{name ? `${name}, your wellbeing score` : "Your wellbeing score"}</p>
      <p className={styles.scoreNumber} aria-label={`${shown} out of 100`}>
        <strong>{shown}</strong>
        <span aria-hidden="true">/100</span>
      </p>
      <h1 className={styles.bandPill}>{band.title}</h1>
      <p className={styles.bandText}>{band.description}</p>
      {band.key === "hard" && !safetyFlagged ? (
        <p className={styles.crisisInline}>
          In crisis or thinking of harming yourself? Call or text <strong>9-8-8</strong> now.
        </p>
      ) : null}

      <div className={styles.meter}>
        <div className={styles.meterRow}>
          <span className={styles.meterEnd} role="img" aria-label="Lower scores: having a hard time">
            <Face color="#E5533F" mouth={MOUTHS.hard} size={30} />
          </span>
          <div
            className={styles.meterTrack}
            role="meter"
            aria-label="Wellbeing score"
            aria-valuemin={1}
            aria-valuemax={100}
            aria-valuenow={shown}
            aria-valuetext={`${shown} out of 100: ${band.title}`}
          >
            <i style={{ left: "39%" }} aria-hidden="true" />
            <i style={{ left: "59%" }} aria-hidden="true" />
            <i style={{ left: "79%" }} aria-hidden="true" />
            <span className={styles.meterThumb} style={{ left: `${2 + shown * 0.96}%` }} aria-hidden="true">
              <b>You · {shown}</b>
              <Face color="var(--band-face)" mouth={MOUTHS[band.key]} size={34} />
            </span>
          </div>
          <span className={styles.meterEnd} role="img" aria-label="Higher scores: doing well">
            <Face color="#1F7A8A" mouth={MOUTHS.well} size={30} />
          </span>
        </div>
        <ul className={styles.meterLegend} aria-label="What the score means">
          {SCORE_BANDS.map((item) => (
            <li key={item.key} data-band={item.key} data-active={item.key === band.key}>
              <i aria-hidden="true" />
              <span>{item.short}</span>
              <small>{item.min}–{item.max}</small>
            </li>
          ))}
        </ul>
      </div>

      <details
        className={styles.scoreDetails}
        onToggle={(event) => {
          if ((event.currentTarget as HTMLDetailsElement).open) onDetailsOpened?.();
        }}
      >
        <summary>What shaped your score</summary>
        {details.length ? (
          <ul>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
        ) : null}
        <p className={styles.scoreNote}>
          Higher means you’re doing better. Your score comes from your two-week check-in, how long
          things have been going on and how much they affect your day. It reflects today’s answers and
          isn’t a diagnosis.
        </p>
      </details>
    </div>
  );
}
