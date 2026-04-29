import CrisisNote from "./CrisisNote";

export default function FormConfirmation({ firstName = "" }: { firstName?: string }) {
  return (
    <div className="rounded-card border-[0.5px] border-hairline bg-white p-8 text-center md:p-14">
      <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-teal">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 12 L10 17 L20 7"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="font-serif text-[34px] font-medium leading-[1.1] tracking-[-1px] text-ink md:text-v2xl">
        You&apos;re on the list.
      </h2>
      <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-[1.6] text-ink-secondary">
        Thanks{firstName ? ` ${firstName}` : ""}. We&apos;ve received your intake and will review
        it carefully so we can help find the right match.
      </p>
      <p className="mx-auto mt-5 max-w-[440px] text-[14px] leading-[1.6] text-ink-secondary">
        Questions in the meantime? Call{" "}
        <a href="tel:613-707-0333" className="text-teal hover:underline">
          613-707-0333
        </a>{" "}
        or email{" "}
        <a href="mailto:support@valisencare.ca" className="text-teal hover:underline">
          support@valisencare.ca
        </a>
      </p>
      <CrisisNote className="mt-8" />
    </div>
  );
}
