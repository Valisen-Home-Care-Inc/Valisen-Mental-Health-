/** Schedule illustrations used only by the public concept previews. */
import { ALL_CONSULTATION_THERAPISTS, consultationTimeLabel, scheduledConsultationMinutes, type ConsultationTherapist } from '@/lib/consultationSchedules';
import { CONSULTATION_BOOKING_WINDOW_DAYS, CONSULTATION_TIME_SLOTS, consultationDateKey, type ConsultationCalendarCell } from '@/lib/consultation';
export { CONSULTATION_BOOKING_WINDOW_DAYS, isValidConsultationPhone } from '@/lib/consultation';

export function getConsultationCalendarMonth(
  year: number,
  month: number,
  now: Date = new Date(),
  pool: readonly ConsultationTherapist[] = ALL_CONSULTATION_THERAPISTS,
): ConsultationCalendarCell[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + CONSULTATION_BOOKING_WINDOW_DAYS);

  const firstOfMonth = new Date(year, month, 1);
  const firstColumnSunFirst = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstColumnSunFirst + daysInMonth) / 7) * 7;

  const cells: ConsultationCalendarCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstColumnSunFirst + 1;
    const inDisplayedMonth = dayNum >= 1 && dayNum <= daysInMonth;
    if (!inDisplayedMonth) {
      cells.push({ date: "", dayOfMonth: 0, inDisplayedMonth: false, selectable: false });
      continue;
    }
    const cellDate = new Date(year, month, dayNum);
    const hasShifts = scheduledConsultationMinutes(consultationDateKey(cellDate), pool).length > 0;
    const isStrictlyFuture = cellDate.getTime() > today.getTime();
    const withinWindow = cellDate.getTime() <= windowEnd.getTime();
    cells.push({
      date: consultationDateKey(cellDate),
      dayOfMonth: cellDate.getDate(),
      inDisplayedMonth: true,
      selectable: hasShifts && isStrictlyFuture && withinWindow,
    });
  }
  return cells;
}

/** Real weekly shifts; pooled appointments do not promise a specific therapist. */
export function getAvailableTimeSlotsForDate(
  isoDate: string,
  pool: readonly ConsultationTherapist[] = ALL_CONSULTATION_THERAPISTS,
): typeof CONSULTATION_TIME_SLOTS {
  return scheduledConsultationMinutes(isoDate, pool).map((minutes) => ({
    time: consultationTimeLabel(minutes),
    availability: minutes < 720 ? "morning" : minutes < 960 ? "afternoon" : "late_afternoon",
  }));
}
