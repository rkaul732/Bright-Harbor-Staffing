import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "plain"
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "plain" | "sky" | "lemon";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "sky"
          ? "border-harbor-sky/20 bg-harbor-sky/10"
          : tone === "lemon"
            ? "border-harbor-lemon bg-harbor-lemon/60"
            : "border-harbor-ocean/10 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-harbor-midnight/60">{label}</p>
        <Icon className="h-4 w-4 text-harbor-ocean" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-medium text-harbor-midnight">{value}</p>
    </div>
  );
}
