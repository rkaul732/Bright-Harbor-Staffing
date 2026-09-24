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
    <div className="min-w-0 rounded-lg border border-dashed border-harbor-ocean/20 bg-white/70 p-4 text-center">
      <Icon className="mx-auto h-6 w-6 text-harbor-sky" aria-hidden="true" />
      <h3 className="mt-2 text-sm font-medium text-harbor-midnight">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-harbor-midnight/60">{body}</p>
    </div>
  );
}
