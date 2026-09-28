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
            ? "border-harbor-ocean/25 bg-harbor-mist text-harbor-ocean"
            : value === "declined" || value === "cancelled"
              ? "border-harbor-midnight/20 bg-harbor-lemon/55 text-harbor-midnight"
          : value === "pending_supervisor_approval" || value === "pending"
            ? "border-harbor-sky/25 bg-harbor-sky/10 text-harbor-ocean"
                : "border-harbor-ocean/10 bg-harbor-mist text-harbor-ocean"
      )}
    >
      {label}
    </span>
  );
}
