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

const SCORE_DETAIL_QUESTIONS = [
  ["checkin_worry", "Worry or stress"],
  ["checkin_mood", "Feeling down"],
  ["checkin_sleep", "Sleep disrupted"],
  ["checkin_coping", "Hard to get through the day"],
  ["duration", "Going on for"],
  ["impact", "Effect on daily life"],
] as const;

/** Readable "what shaped your score" chips, only from answers held in memory. */
export function scoreDetails(answers: Answers | undefined): string[] {
  if (!answers) return [];
  return SCORE_DETAIL_QUESTIONS.flatMap(([id, label]) => {
    const question = QUESTIONS.find((item) => item.id === id);
    const option = question?.options.find((item) => item.value === answers[id]);
    return option ? [`${label}: ${option.label.toLowerCase()}`] : [];
  });
}

export default function WellbeingScore({
  score,
  firstName,
  answers,
  safetyFlagged,
}: {
  score: number;
  firstName: string;
  answers?: Answers;
  safetyFlagged: boolean;
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

      <details className={styles.scoreDetails}>
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
