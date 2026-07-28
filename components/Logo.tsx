import Link from "next/link";
import Image from "next/image";

export default function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center no-underline" aria-label="Valisen home">
      <Image
        src="/valisen-logo.png"
        alt="Valisen Mental Health"
        width={950}
        height={330}
        className={`h-9 w-auto object-contain md:h-12 ${dark ? "brightness-0 invert" : ""}`}
        priority
      />
    </Link>
  );
}
