import { Megaphone } from "lucide-react";
import type { AdSlot } from "@/shared/types/domain";

export function AdSlots({ ads }: { ads: AdSlot[] }) {
  const activeAds = ads.filter((ad) => ad.active).slice(0, 2);

  if (activeAds.length === 0) {
    return null;
  }

  return (
    <aside className="space-y-3">
      {activeAds.map((ad) => (
        <a
          key={ad.id}
          href={ad.cta_href}
          className="block rounded-lg border border-harbor-sky/20 bg-white p-4 shadow-line transition hover:border-harbor-sky/50"
        >
          <div className="flex items-center gap-2 text-sm text-harbor-ocean">
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            {ad.program_name}
          </div>
          <h3 className="mt-2 text-base font-medium text-harbor-midnight">{ad.title}</h3>
          <p className="mt-1 text-sm leading-6 text-harbor-midnight/60">{ad.body}</p>
          <span className="mt-3 inline-flex text-sm font-medium text-harbor-ocean">
            {ad.cta_label}
          </span>
        </a>
      ))}
    </aside>
  );
}
