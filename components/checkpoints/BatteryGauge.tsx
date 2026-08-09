"use client";

import { useEffect, useState } from "react";

type BatteryGaugeProps = {
  fillPercent: number;
  label: string;
  compact?: boolean;
};

function getFillStyle(fillPercent: number): string {
  if (fillPercent <= 25) return "from-[#d98262] via-[#c9633e] to-[#a94d32]";
  if (fillPercent <= 50) return "from-[#d9b46f] via-[#c6964f] to-[#a87b36]";
  return "from-[#82bda7] via-[#3d9186] to-[#26736f]";
}

export default function BatteryGauge({
  fillPercent,
  label,
  compact = false,
}: BatteryGaugeProps) {
  const safeFill = Math.max(5, Math.min(100, Math.round(fillPercent)));
  const [displayFill, setDisplayFill] = useState(5);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setDisplayFill(safeFill);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [safeFill]);

  return (
    <div
      className={`relative mx-auto ${compact ? "w-[172px]" : "w-full max-w-[300px]"}`}
      role="img"
      aria-label={`${label}: ${safeFill}% visual battery level`}
    >
      <div
        className={`relative overflow-hidden border border-white/70 bg-white/45 p-[7px] shadow-[0_24px_70px_rgba(24,75,72,0.16)] backdrop-blur-xl ${
          compact ? "h-[82px] rounded-[24px]" : "h-[128px] rounded-[34px]"
        }`}
      >
        <div className="relative h-full overflow-hidden rounded-[26px] border border-black/[0.06] bg-[#e7e9e3] shadow-inner">
          <div
            className={`absolute inset-y-0 left-0 overflow-hidden bg-gradient-to-r ${getFillStyle(
              safeFill,
            )} transition-[width] duration-1000 ease-out motion-reduce:transition-none`}
            style={{ width: `${displayFill}%` }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_10%,rgba(255,255,255,0.34)_45%,transparent_72%)]" />
            <div className="absolute inset-x-3 top-2 h-px bg-white/50" />
          </div>
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0, transparent calc(25% - 1px), #335c59 calc(25% - 1px), #335c59 25%)",
            }}
          />
        </div>
      </div>
      <div
        aria-hidden="true"
        className={`absolute right-[-11px] top-1/2 -translate-y-1/2 rounded-r-lg border border-l-0 border-white/80 bg-white/60 shadow-sm ${
          compact ? "h-8 w-3" : "h-12 w-4"
        }`}
      />
    </div>
  );
}
