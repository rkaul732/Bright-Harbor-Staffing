import { cn } from "@/shared/lib/cn";
import type {
  ProfileStatus,
  RequestStatus,
  ShiftCategory,
  ShiftStatus
} from "@/shared/types/domain";

export function StatusBadge({
  value
}: {
  value:
    | ShiftStatus
    | RequestStatus
    | ShiftCategory
    | ProfileStatus
    | "urgent"
    | "demo";
}) {
  const label = value.replaceAll("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        value === "urgent" || value === "emergency"
          ? "border-harbor-lemon bg-harbor-lemon/70 text-harbor-midnight"
          : value === "approved" || value === "covered"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : value === "declined" || value === "cancelled"
              ? "border-red-200 bg-red-50 text-red-700"
          : value === "pending_supervisor_approval" || value === "pending"
            ? "border-harbor-sky/25 bg-harbor-sky/10 text-harbor-ocean"
                : "border-harbor-ocean/10 bg-harbor-mist text-harbor-ocean"
      )}
    >
      {label}
    </span>
  );
}
