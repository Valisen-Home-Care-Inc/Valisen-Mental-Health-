import type { ReactNode } from "react";

type BadgeVariant = "specialty" | "language" | "session" | "status" | "accent" | "quiet";

const variantClasses: Record<BadgeVariant, string> = {
  specialty: "border-teal/18 bg-teal-xlight/55 text-teal-dark",
  language: "border-black/10 bg-white text-ink",
  session: "border-black/10 bg-canvas text-ink-secondary",
  status: "border-green-200 bg-green-50 text-green-700",
  accent: "border-accent/20 bg-accent-light text-accent",
  quiet: "border-black/10 bg-white/70 text-ink-secondary",
};

export default function Badge({
  children,
  variant = "quiet",
  className = "",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-3 py-1 text-[11.5px] font-medium leading-none ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
