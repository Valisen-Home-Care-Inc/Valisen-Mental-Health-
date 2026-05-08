// TODO: Replace with live Google Reviews count and rating once available
export default function SocialProof() {
  return (
    <div className="bg-teal-dark">
      <div className="container-v flex flex-col items-center justify-between gap-3 py-4 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="text-[18px] leading-none text-yellow-400" aria-hidden="true">
            ★★★★★
          </span>
          <span className="text-[13px] font-medium text-canvas">
            Trusted by Ottawa residents
          </span>
        </div>
        <span className="text-[13px] text-canvas/75">
          Serving Ottawa clients in-person and virtually across Ontario
        </span>
      </div>
    </div>
  );
}
