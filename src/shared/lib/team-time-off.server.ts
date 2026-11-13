import "server-only";

import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from "@/shared/lib/supabase/admin";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { datesInRange, hasTeamTimeOffCoordination, TEAM_TIME_OFF_PROGRAMS, type TeamTimeOffDate } from "@/shared/lib/team-time-off";
import type { ProgramName } from "@/shared/types/domain";

type ApprovedTeamTimeOff = {
  program_name: ProgramName;
  start_date: string;
  end_date: string;
};

export async function getTeamTimeOffDatesForCalendar(userId: string, approvedPrograms: ProgramName[]) {
  const programs = TEAM_TIME_OFF_PROGRAMS.filter((program) => approvedPrograms.includes(program));
  if (programs.length === 0 || !isSupabaseConfigured()) {
    return { dates: [] as TeamTimeOffDate[], available: true };
  }
  if (!hasSupabaseServiceRoleKey()) {
    return { dates: [] as TeamTimeOffDate[], available: false };
  }

  const admin = createSupabaseAdminClient();
  const rows: ApprovedTeamTimeOff[] = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from("time_off_requests")
      .select("program_name,start_date,end_date")
      .eq("status", "approved")
      .in("program_name", [...programs])
      .neq("user_id", userId)
      .order("start_date")
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("Could not load anonymous team time off dates", error);
      return { dates: [] as TeamTimeOffDate[], available: false };
    }

    rows.push(...((data ?? []) as ApprovedTeamTimeOff[]));
    if (!data || data.length < pageSize) break;
  }

  const uniqueDates = new Map<string, TeamTimeOffDate>();
  rows.forEach((request) => {
    datesInRange(request.start_date, request.end_date).forEach((date) => {
      uniqueDates.set(`${request.program_name}:${date}`, { program_name: request.program_name, date });
    });
  });

  return { dates: [...uniqueDates.values()].sort((a, b) => a.date.localeCompare(b.date)), available: true };
}

export async function getApprovedTeamTimeOffOverlap(
  userId: string,
  programName: ProgramName,
  startDate: string,
  endDate: string
) {
  if (!hasTeamTimeOffCoordination(programName) || !isSupabaseConfigured()) return [];
  if (!hasSupabaseServiceRoleKey()) throw new Error("Team availability is temporarily unavailable.");

  const { data, error } = await createSupabaseAdminClient()
    .from("time_off_requests")
    .select("start_date,end_date")
    .eq("status", "approved")
    .eq("program_name", programName)
    .neq("user_id", userId)
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (error) throw error;

  return [...new Set((data ?? []).flatMap((request) =>
    datesInRange(request.start_date, request.end_date).filter((date) => date >= startDate && date <= endDate)
  ))].sort();
}
