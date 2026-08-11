"use client";

import { useEffect, useState } from "react";
import type { BatteryTone } from "@/lib/checkpoints/scoring";

type BatteryGaugeProps = {
  fillPercent: number;
  label: string;
  compact?: boolean;
  glow?: boolean;
  reveal?: boolean;
  tone?: BatteryTone;
};

const TONE_STYLES: Record<
  BatteryTone,
  { fill: string; glow: string }
> = {
  charged: {
    fill: "from-[#8bc6ad] via-[#469889] to-[#27766f]",
    glow: "bg-[#5aa38e]/30",
  },
  steady: {
    fill: "from-[#68ad9d] via-[#4b9485] to-[#c5a15d]",
    glow: "bg-[#8cab83]/25",
  },
  "running-low": {
    fill: "from-[#e2c17a] via-[#cf9d50] to-[#aa7736]",
    glow: "bg-[#d2a454]/28",
  },
  recharge: {
    fill: "from-[#e8a37b] via-[#dc845b] to-[#c96d46]",
    glow: "bg-[#dc845b]/25",
  },
};

function toneFromFill(fillPercent: number): BatteryTone {
  if (fillPercent <= 25) return "recharge";
  if (fillPercent <= 50) return "running-low";
  if (fillPercent <= 80) return "steady";
  return "charged";
}

export default function BatteryGauge({
  fillPercent,
  label,
  compact = false,
  glow = false,
  reveal = false,
  tone,
}: BatteryGaugeProps) {
  const safeFill = Math.max(5, Math.min(100, Math.round(fillPercent)));
  const [displayFill, setDisplayFill] = useState(reveal ? 0 : safeFill);
  const resolvedTone = tone ?? toneFromFill(safeFill);
  const toneStyle = TONE_STYLES[resolvedTone];

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
      {glow ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-[12%] bottom-[-8px] h-12 rounded-full blur-2xl ${toneStyle.glow}`}
        />
      ) : null}
      <div
        className={`relative overflow-hidden border border-white/70 bg-white/45 p-[7px] shadow-[0_24px_70px_rgba(24,75,72,0.16)] backdrop-blur-xl ${
          compact ? "h-[82px] rounded-[24px]" : "h-[128px] rounded-[34px]"
        }`}
      >
        <div className="relative h-full overflow-hidden rounded-[26px] border border-black/[0.06] bg-[#e7e9e3] shadow-inner">
          <div
            className={`absolute inset-y-0 left-0 overflow-hidden bg-gradient-to-r ${toneStyle.fill} transition-[width] duration-[700ms] ease-out motion-reduce:transition-none`}
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
