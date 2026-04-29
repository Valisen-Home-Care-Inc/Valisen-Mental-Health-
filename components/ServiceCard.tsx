import Link from "next/link";
import type { ReactNode } from "react";

type ServiceCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  linkLabel?: string;
};

export default function ServiceCard({
  icon,
  title,
  description,
  href,
  linkLabel = "Learn more",
}: ServiceCardProps) {
  return (
    <article className="flex h-full flex-col rounded-card border-[0.5px] border-hairline bg-white p-7">
      <div className="mb-6 grid h-12 w-12 place-items-center rounded-full bg-teal-xlight text-teal">
        {icon}
      </div>
      <h3 className="mb-3 font-serif text-vxl font-medium text-ink">{title}</h3>
      <p className="mb-6 flex-1 text-[14px] leading-[1.6] text-ink-secondary">{description}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 text-[14px] font-medium text-teal no-underline hover:text-teal-dark"
      >
        {linkLabel}
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </article>
  );
}
