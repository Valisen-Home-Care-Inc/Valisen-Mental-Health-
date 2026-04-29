export default function CrisisNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[12px] leading-[1.6] text-ink-secondary ${className}`}>
      If you are in crisis, please call <strong className="text-ink">988</strong> or the Ottawa
      crisis line at{" "}
      <a href="tel:613-722-6914" className="text-ink underline-offset-2 hover:underline">
        613-722-6914
      </a>
      .
    </p>
  );
}
