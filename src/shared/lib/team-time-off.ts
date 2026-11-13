import type { ProgramName } from "@/shared/types/domain";

export const TEAM_TIME_OFF_PROGRAMS = ["Access", "Integrated System of Care (ISC)"] as const satisfies readonly ProgramName[];

export type TeamTimeOffDate = {
  program_name: ProgramName;
  date: string;
};

export function hasTeamTimeOffCoordination(programName: string) {
  return TEAM_TIME_OFF_PROGRAMS.some((program) => program === programName);
}

export function datesInRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return dates;

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function overlappingTeamTimeOffDates(
  teamDates: TeamTimeOffDate[],
  programName: string,
  startDate: string,
  endDate: string
) {
  return teamDates
    .filter((item) => item.program_name === programName && item.date >= startDate && item.date <= endDate)
    .map((item) => item.date)
    .sort();
}

export function teamTimeOffSelectionKey(programName: string, startDate: string, endDate: string) {
  return JSON.stringify([programName, startDate, endDate]);
}
