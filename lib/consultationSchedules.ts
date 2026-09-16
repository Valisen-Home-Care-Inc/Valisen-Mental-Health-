/** Permanent weekly consultation shifts supplied by the clinic, Toronto time.
 * Sunday=0. End times are exclusive: the full 20-minute call must fit.
 * Wilfred's Thursday/Friday hours were explicitly confirmed for online booking.
 */
export const CONSULTATION_MINUTES = 20;
export const WEEKLY_CONSULTATION_SHIFTS = {
  "ryann-simpson": { 1: [[1020, 1200]], 2: [[1020, 1200]], 3: [[1020, 1140]], 4: [[960, 1140]] },
  "wilfred-bengnwi": { 1: [[900, 1200]], 2: [[540, 1080]], 3: [[540, 780]], 4: [[540, 720]], 5: [[540, 780]] },
  "meryem-ibrahim": { 0: [[540, 1200]], 2: [[540, 1080]] },
  "tim-kahtava": { 1: [[1110, 1170]], 2: [[600, 720]], 3: [[915, 975]], 6: [[795, 855]] },
  "dayong-quan": { 1: [[540, 1020]], 5: [[540, 1020]] },
} as const;
export type ConsultationTherapist = keyof typeof WEEKLY_CONSULTATION_SHIFTS;
export const ALL_CONSULTATION_THERAPISTS = Object.keys(WEEKLY_CONSULTATION_SHIFTS) as ConsultationTherapist[];

export function consultationTimeMinutes(time: string): number | null {
  const match = /^(1[0-2]|[1-9]):([0-5][0-9]) (AM|PM)$/.exec(time);
  return match ? (Number(match[1]) % 12) * 60 + Number(match[2]) + (match[3] === "PM" ? 720 : 0) : null;
}
export function consultationTimeLabel(minutes: number): string {
  return `${Math.floor(minutes / 60) % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${minutes < 720 ? "AM" : "PM"}`;
}
export function consultationWeekday(isoDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return -1;
  const date = new Date(`${isoDate}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === isoDate ? date.getUTCDay() : -1;
}
export function therapistShifts(therapist: ConsultationTherapist, weekday: number): readonly (readonly [number, number])[] {
  const shifts: Partial<Record<number, readonly (readonly [number, number])[]>> = WEEKLY_CONSULTATION_SHIFTS[therapist];
  return shifts?.[weekday] || [];
}
export function scheduledConsultationMinutes(isoDate: string, pool: readonly ConsultationTherapist[] = ALL_CONSULTATION_THERAPISTS): number[] {
  const minutes = new Set<number>();
  for (const person of pool) for (const [start, end] of therapistShifts(person, consultationWeekday(isoDate))) {
    for (let time = start; time + CONSULTATION_MINUTES <= end; time += CONSULTATION_MINUTES) minutes.add(time);
  }
  return [...minutes].sort((a, b) => a - b);
}
export function eligibleConsultationTherapists(isoDate: string, time: string, pool: readonly ConsultationTherapist[] = ALL_CONSULTATION_THERAPISTS): ConsultationTherapist[] {
  const start = consultationTimeMinutes(time);
  if (start === null || !scheduledConsultationMinutes(isoDate, pool).includes(start)) return [];
  return pool.filter((person) => therapistShifts(person, consultationWeekday(isoDate)).some(([from, to]) => start >= from && start + CONSULTATION_MINUTES <= to));
}
