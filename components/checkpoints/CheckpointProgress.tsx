export default function CheckpointProgress({
  current,
  total,
  intentStep = false,
}: {
  current: number;
  total: number;
  intentStep?: boolean;
}) {
  const percent = Math.round((current / total) * 100);
  const progressText = intentStep
    ? `Final step · ${current} of ${total}`
    : `Question ${current} of ${total}`;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[12px] font-medium tracking-[0.02em] text-[#49615f]">
        <span>{progressText}</span>
        <span aria-hidden="true">{percent}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[#dce4df]"
        role="progressbar"
        aria-label="Check-in progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={progressText}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#397f79] to-[#75ad9a] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
