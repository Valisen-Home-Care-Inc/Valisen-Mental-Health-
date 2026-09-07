"use client";

import { Check, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
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
    <div aria-invalid={Boolean(invalid)}>
      {!isFlexible ? (
        <>
          <div className="rounded-[14px] border border-black/10 bg-canvas p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => goToMonth(-1)}
                disabled={isCurrentViewToday}
                aria-label="Previous month"
                className="grid h-7 w-7 place-items-center rounded-full text-ink-secondary transition hover:bg-black/5 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="font-serif text-[14px] font-medium text-ink">
                {CONSULTATION_MONTH_NAMES[viewMonth]} {viewYear}
              </p>
              <button
                type="button"
                onClick={() => goToMonth(1)}
                disabled={!hasSelectableInView && !nextMonthHasSelectable}
                aria-label="Next month"
                className="grid h-7 w-7 place-items-center rounded-full text-ink-secondary transition hover:bg-black/5 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[9.5px] font-semibold uppercase tracking-[0.06em] text-ink-hint">
              {WEEKDAY_SHORT_SUN_FIRST.map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>

            <div
              role="group"
              aria-label={`Choose a date in ${CONSULTATION_MONTH_NAMES[viewMonth]} ${viewYear}`}
              className="mt-1 grid grid-cols-7 gap-1"
            >
              {cells.map((cell, i) => {
                if (!cell.date) return <span key={`blank-${i}`} aria-hidden="true" />;
                const isSelected = cell.date === selectedDate;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    disabled={!cell.selectable}
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedDate(cell.date);
                      if (value?.kind === "specific" && value.date !== cell.date) onChange(null);
                    }}
                    className={`aspect-square rounded-[8px] text-[12px] font-medium transition-all duration-200 ${
                      isSelected
                        ? "bg-teal text-white"
                        : cell.selectable
                          ? "text-ink hover:bg-teal/10"
                          : "text-ink-hint/50"
                    }`}
                  >
                    {cell.dayOfMonth}
                    {cell.selectable && !isSelected ? (
                      <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-teal/60" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold text-ink-secondary">
                Available times &mdash; {formatConsultationDateLabel(selectedDate)}
              </p>
              <div
                role="group"
                aria-label={`Choose a time on ${formatConsultationDateLabel(selectedDate)}`}
                className="grid grid-cols-3 gap-1.5 min-[420px]:grid-cols-4"
              >
                {dayTimeSlots.map(({ time, availability }) => {
                  const selected =
                    value?.kind === "specific" && value.date === selectedDate && value.time === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        onChange({
                          kind: "specific",
                          date: selectedDate,
                          time,
                          availability,
                          label: formatPreferredSlotLabel(selectedDate, time),
                        })
                      }
                      className={`rounded-[10px] border px-2 py-1.5 text-[12px] font-medium transition-all duration-200 ${
                        selected
                          ? "border-teal bg-teal text-white"
                          : "border-black/15 bg-white text-ink hover:border-teal/50"
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {allowFlexible ? <button
            type="button"
            onClick={() => onChange({ kind: "flexible" })}
            className="mt-2.5 text-[12px] font-medium text-ink-secondary underline underline-offset-2 transition-colors hover:text-teal"
          >
            Can&apos;t find a suitable time
          </button> : null}
        </>
      ) : (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[12px] font-medium text-ink-secondary underline underline-offset-2 transition-colors hover:text-teal"
        >
          Pick a specific time instead
        </button>
      )}

      {value ? (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[14px] bg-teal-xlight px-3 py-2.5 text-[12px] font-medium text-teal-dark">
          <span className="flex min-w-0 items-center gap-1.5">
            {value.kind === "specific" ? (
              <>
                <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{value.label}</span>
              </>
            ) : (
              <>
                <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
                A representative will get back to you within 24 hours
              </>
            )}
          </span>
          <Check size={16} className="shrink-0" aria-hidden="true" />
        </div>
      ) : null}
      <input type="hidden" id={idPrefix} value={value ? "set" : ""} readOnly />
    </div>
  );
}
