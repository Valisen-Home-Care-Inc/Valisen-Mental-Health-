// TODO: Replace with live Google Reviews count and rating once available
export default function SocialProof() {
  return (
    <div className="border-b border-hairline-light bg-white">
      <div className="container-v flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-4 sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5" aria-label="5 out of 5 stars">
            {[...Array(5)].map((_, i) => (
              <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
          <span className="text-[13px] font-semibold text-ink">5.0</span>
          <span className="text-[13px] text-ink-secondary">· Trusted by Ontario residents</span>
        </div>
        <div className="hidden h-4 w-px bg-black/[0.09] sm:block" aria-hidden="true" />
        <div className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z" stroke="#2A7F7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Regulated therapists (RP &amp; RSW)
        </div>
        <div className="hidden h-4 w-px bg-black/[0.09] sm:block" aria-hidden="true" />
        <div className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#2A7F7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="9" r="2" stroke="#2A7F7F" strokeWidth="2" />
          </svg>
          Ottawa — virtual across Ontario
        </div>
      </div>
    </div>
  );
}
