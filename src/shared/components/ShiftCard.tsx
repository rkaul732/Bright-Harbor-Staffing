import { ChevronDown, Clock, MapPin, Users } from "lucide-react";
import { FIXED_STANDARD_PAY_RATE } from "@/shared/lib/constants";
import { formatLongDate, formatTimeRange } from "@/shared/lib/dates";
import { StatusBadge } from "@/shared/components/StatusBadge";
import type { ShiftPost } from "@/shared/types/domain";

export function ShiftCard({
  shift,
  compact = false,
  children
}: {
  shift: ShiftPost;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const remaining = Math.max(shift.openings - shift.filled_openings, 0);
  const payRate = shift.pay_rate || FIXED_STANDARD_PAY_RATE;

  return (
    <article className="rounded-lg border border-harbor-ocean/10 bg-white p-4 shadow-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {shift.urgent ? <StatusBadge value="urgent" /> : null}
            <StatusBadge value={shift.category} />
            <StatusBadge value={shift.status} />
          </div>
          <h3 className="mt-3 text-base font-medium text-harbor-midnight">
            {shift.title}
          </h3>
          {!compact && shift.details ? (
            <p className="mt-1 text-sm leading-6 text-harbor-midnight/60">
              {shift.details}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg bg-harbor-mist px-3 py-2 text-right">
          <p className="text-xs text-harbor-ocean">Rate</p>
          <p className="text-sm font-medium text-harbor-midnight">
            ${payRate.toFixed(2)} hourly
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-harbor-midnight/70 sm:grid-cols-3">
        <span className="inline-flex items-center gap-2">
          <MapPin className="h-4 w-4 text-harbor-ocean" aria-hidden="true" />
          {shift.location_name}
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock className="h-4 w-4 text-harbor-ocean" aria-hidden="true" />
          {formatTimeRange(shift)}
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="h-4 w-4 text-harbor-ocean" aria-hidden="true" />
          {remaining} open
        </span>
      </div>
      <p className="mt-2 text-sm text-harbor-midnight/60">{formatLongDate(shift.shift_date)}</p>
      <details className="mt-3 rounded-lg border border-harbor-ocean/10 bg-harbor-mist/45 px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-harbor-ocean">
          Program
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </summary>
        <p className="mt-2 text-sm text-harbor-midnight/70">{shift.program_name}</p>
      </details>
      {children ? <div className="mt-4 border-t border-harbor-ocean/10 pt-4">{children}</div> : null}
    </article>
  );
}
