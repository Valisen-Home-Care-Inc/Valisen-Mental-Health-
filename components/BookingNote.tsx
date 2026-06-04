import { INTAKE_NOTE } from "@/lib/intake";

export default function BookingNote({
  className = "",
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <p className={`text-[11.5px] leading-[1.55] ${dark ? "text-canvas/60" : "text-ink-hint"} ${className}`}>
      {INTAKE_NOTE}
    </p>
  );
}
