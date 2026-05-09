export default function CrisisNote({
  className = "",
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <p
      className={`text-[12px] leading-[1.6] ${dark ? "text-white/30" : "text-ink-secondary"} ${className}`}
    >
      If you are in crisis, please call{" "}
      <strong className={dark ? "text-white/50" : "text-ink"}>988</strong> or the Ottawa crisis
      line at{" "}
      <a
        href="tel:613-722-6914"
        className={`underline-offset-2 hover:underline ${dark ? "text-white/50" : "text-ink"}`}
      >
        613-722-6914
      </a>
      .
    </p>
  );
}
