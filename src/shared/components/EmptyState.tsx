import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-harbor-ocean/20 bg-white/70 p-6 text-center">
      <Icon className="mx-auto h-6 w-6 text-harbor-sky" aria-hidden="true" />
      <h3 className="mt-3 text-base font-medium text-harbor-midnight">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-harbor-midnight/60">{body}</p>
    </div>
  );
}
