import type { CalendarTimeOffEntry } from "@/shared/types/domain";

export function toCalendarTimeOffEntry(request: CalendarTimeOffEntry): CalendarTimeOffEntry {
  return {
    id: request.id,
    employee_name: request.employee_name,
    program_name: request.program_name,
    start_date: request.start_date,
    end_date: request.end_date,
    status: request.status,
    isSupervisor: true
  };
}
