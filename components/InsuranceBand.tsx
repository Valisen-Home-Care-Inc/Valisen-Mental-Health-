const PROVIDERS = ["Manulife", "Sun Life", "Canada Life", "Green Shield", "Equitable"];

export default function InsuranceBand({
  label = "MAY BE COVERED BY MANY EXTENDED HEALTH PLANS",
}: {
  label?: string;
}) {
  return (
    <div className="border-y-[0.5px] border-hairline-light bg-canvas">
      <div className="container-v flex flex-col items-start justify-between gap-5 py-9 md:flex-row md:items-center">
        <span className="text-vxs uppercase tracking-[1.5px] text-ink-secondary">{label}</span>
        <div className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] font-medium tracking-[0.08em] text-ink-secondary">
          {PROVIDERS.map((provider) => (
            <span key={provider}>{provider}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
