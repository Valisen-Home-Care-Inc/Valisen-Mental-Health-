"use client";

import { Check, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./ConsultationTimeSlotPicker.module.css";
import {
  CONSULTATION_MONTH_NAMES,
  WEEKDAY_SHORT_SUN_FIRST,
  formatConsultationDateLabel,
  formatPreferredSlotLabel,
  getAvailableTimeSlotsForDate,
  getConsultationCalendarMonth,
  type ConsultationSlotSelection,
} from "@/lib/consultation";

export default function ConsultationTimeSlotPicker({
  idPrefix,
  value,
  onChange,
  invalid,
  allowFlexible = true,
  calendarToday,
}: {
  idPrefix: string;
  value: ConsultationSlotSelection | null;
  onChange: (selection: ConsultationSlotSelection | null) => void;
  invalid?: boolean;
  allowFlexible?: boolean;
  calendarToday?: Date;
}) {
  const today = useMemo(() => calendarToday ?? new Date(), [calendarToday]);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const cells = useMemo(
    () => getConsultationCalendarMonth(viewYear, viewMonth, today),
    [viewYear, viewMonth, today],
  );
  const dayTimeSlots = useMemo(
    () => (selectedDate ? getAvailableTimeSlotsForDate(selectedDate) : []),
    [selectedDate],
  );

  const hasSelectableInView = cells.some((cell) => cell.selectable);
  const isCurrentViewToday = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const nextMonthDate = new Date(viewYear, viewMonth + 1, 1);
  const nextMonthHasSelectable = getConsultationCalendarMonth(
    nextMonthDate.getFullYear(),
    nextMonthDate.getMonth(),
    today,
  ).some((cell) => cell.selectable);

  function goToMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const isFlexible = value?.kind === "flexible";

  return (
    <div className={styles.picker} aria-invalid={Boolean(invalid)}>
      {!isFlexible ? (
        <>
          <div className={styles.calendar}>
            <div className={styles.stepLabel}>
              <span className={styles.stepNumber}>1</span>
              Choose a day
              <span className={styles.timezone}>Toronto time</span>
            </div>
            <div className={styles.monthBar}>
              <p className={styles.month} id={idPrefix + "-month"} aria-live="polite">
                {CONSULTATION_MONTH_NAMES[viewMonth]} <span>{viewYear}</span>
              </p>
              <div className={styles.monthControls}>
                <button type="button" onClick={() => goToMonth(-1)} disabled={isCurrentViewToday} aria-label="Previous month" className={styles.monthButton}>
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => goToMonth(1)} disabled={!hasSelectableInView && !nextMonthHasSelectable} aria-label="Next month" className={styles.monthButton}>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className={styles.weekdays} aria-hidden="true">
              {WEEKDAY_SHORT_SUN_FIRST.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div role="group" aria-label={"Choose a date in " + CONSULTATION_MONTH_NAMES[viewMonth] + " " + viewYear} className={styles.days}>
              {cells.map((cell, i) => {
                if (!cell.date) return <span key={"blank-" + i} aria-hidden="true" />;
                const isSelected = cell.date === selectedDate;
                return (
                  <button key={cell.date} type="button" disabled={!cell.selectable}
                    aria-label={formatConsultationDateLabel(cell.date) + ", " + viewYear}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedDate(cell.date);
                      if (value?.kind === "specific" && value.date !== cell.date) onChange(null);
                    }}
                    className={styles.day + (isSelected ? " " + styles.selectedDay : "")}
                  >
                    {cell.dayOfMonth}
                    {cell.selectable && !isSelected ? <span className={styles.availableDot} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={styles.timesPanel}>
            <div className={styles.stepLabel}>
              <span className={styles.stepNumber}>2</span>
              Choose a time
              <Clock3 size={14} className={styles.timezone} aria-hidden="true" />
            </div>
            {selectedDate ? (
              <>
                <p className={styles.dateLabel}>{formatConsultationDateLabel(selectedDate)}</p>
                <div role="group" aria-label={"Choose a time on " + formatConsultationDateLabel(selectedDate)} className={styles.times}>
                  {dayTimeSlots.map(({ time, availability }) => {
                    const selected = value?.kind === "specific" && value.date === selectedDate && value.time === time;
                    return <button key={time} type="button" aria-pressed={selected}
                      onClick={() => onChange({ kind: "specific", date: selectedDate, time, availability, label: formatPreferredSlotLabel(selectedDate, time) })}
                      className={styles.time + (selected ? " " + styles.selectedTime : "")}
                    >{time}{selected ? <Check size={12} aria-hidden="true" /> : null}</button>;
                  })}
                </div>
                {dayTimeSlots.length > 9 ? <p className={styles.scrollHint}>Scroll to see all times <ChevronDown size={12} aria-hidden="true" /></p> : null}
              </>
            ) : (
              <div className={styles.emptyTimes}><CalendarDays size={19} aria-hidden="true" /><p>Select a day above to see times.</p></div>
            )}
          </div>
        </>
      ) : null}
      {value ? (
        <div className={styles.selection} role="status">
          <span className={styles.selectionIcon}><Check size={16} aria-hidden="true" /></span>
          <div>
            <span className={styles.selectionEyebrow}>{value.kind === "specific" ? "Your selected time" : "We'll help you find a time"}</span>
            <p>{value.kind === "specific" ? value.label : "A representative will get back to you within 24 hours"}</p>
          </div>
        </div>
      ) : null}
      {allowFlexible ? <button type="button" onClick={() => onChange(isFlexible ? null : { kind: "flexible" })} className={styles.flexible}>
        {isFlexible ? "Pick a specific time instead" : "Can't find a suitable time"}<ChevronRight size={14} aria-hidden="true" />
      </button> : null}
      <input type="hidden" id={idPrefix} value={value ? "set" : ""} readOnly />
    </div>
  );
}
