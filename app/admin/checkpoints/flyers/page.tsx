import Link from "next/link";
import BookingFlyerClient from "@/components/checkpoints/admin/BookingFlyerClient";
import FlyerGeneratorClient from "@/components/checkpoints/admin/FlyerGeneratorClient";
import { requireCheckpointAdminPage } from "@/lib/server/checkpointAdminAuth";

export const dynamic = "force-dynamic";

const FLYERS = [
  { key: "booking", label: "Booking flyer (areas)" },
  { key: "mental-battery", label: "Mental Battery (checkpoints)" },
] as const;

type FlyersPageProps = { searchParams: Promise<{ flyer?: string | string[] }> };

export default async function CheckpointFlyersPage({ searchParams }: FlyersPageProps) {
  await requireCheckpointAdminPage("/admin/checkpoints/flyers");
  const requested = (await searchParams).flyer;
  const current = requested === "mental-battery" ? "mental-battery" : "booking";

  return (
    <>
      <nav
        aria-label="Flyer type"
        className="mx-auto flex w-full max-w-[1680px] flex-wrap gap-2 px-4 pt-6 sm:px-7 lg:px-10"
      >
        {FLYERS.map((flyer) => {
          const active = flyer.key === current;
          return (
            <Link
              key={flyer.key}
              href={flyer.key === "booking" ? "/admin/checkpoints/flyers" : `/admin/checkpoints/flyers?flyer=${flyer.key}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-[10px] border px-3.5 text-[12.5px] font-semibold no-underline transition ${
                active
                  ? "border-[#1e5f5a] bg-white text-[#153f3e] shadow-[0_1px_8px_rgba(0,0,0,0.07)]"
                  : "border-black/[0.08] text-[#667371] hover:bg-white/70 hover:text-[#153f3e]"
              }`}
            >
              {flyer.label}
            </Link>
          );
        })}
      </nav>
      {current === "booking" ? <BookingFlyerClient /> : <FlyerGeneratorClient />}
    </>
  );
}
