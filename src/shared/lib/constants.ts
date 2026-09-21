import type {
  AppRole,
  LocationName,
  ProgramName,
  SkillName
} from "@/shared/types/domain";

export const APP_NAME = "Bright Harbor Staffing";

export const APPROVAL_SUPERVISOR_EMAIL =
  process.env.SHIFT_APPROVAL_SUPERVISOR_EMAIL ?? "bpataky@brightharbor.org";

export const LOCATIONS: LocationName[] = [
  "Point Pleasant",
  "Little Egg Harbor",
  "Berkeley",
  "Toms River"
];

export const PROGRAMS: ProgramName[] = [
  "Anchor",
  "Beacon",
  "Bayside",
  "Beach",
  "Chelsea",
  "Wave",
  "Code Red/Code Blue",
  "Access Center",
  "Administration",
  "Outpatient",
  "School Based"
];

export const SHIFT_EXCHANGE_PROGRAMS: ProgramName[] = [
  "Anchor",
  "Beacon",
  "Beach",
  "Chelsea",
  "Wave",
  "Code Red/Code Blue"
];

export const SKILLS: SkillName[] = [
  "Direct care",
  "Case management",
  "Driving",
  "Wraparound service coordination"
];

export const ROLE_LABELS: Record<AppRole, string> = {
  employee: "Employee",
  supervisor: "Supervisor",
  admin: "Admin"
};

export const FIXED_STANDARD_PAY_RATE = 17;
export const FIXED_EMERGENCY_PAY_RATE = 19;

export const ROLE_DASHBOARD_PATHS: Record<AppRole, string> = {
  employee: "/employee",
  supervisor: "/supervisor",
  admin: "/admin"
};

export function canUseShiftExchange(programNames?: string | string[] | null) {
  const names = Array.isArray(programNames)
    ? programNames
    : programNames
      ? [programNames]
      : [];

  return names.some((programName) =>
    SHIFT_EXCHANGE_PROGRAMS.includes(programName as ProgramName)
  );
}

export function getProfileProgramNames(profile?: {
  program_name?: ProgramName | null;
  program_names?: ProgramName[] | null;
}) {
  const names = profile?.program_names?.length
    ? profile.program_names
    : profile?.program_name
      ? [profile.program_name]
      : [];

  return names.filter((programName): programName is ProgramName =>
    PROGRAMS.includes(programName as ProgramName)
  );
}

export const BRAND_COLORS = {
  sky: "#4BA0D8",
  ocean: "#346990",
  lemon: "#f7f5ac",
  mist: "#eef5fb",
  midnight: "#1c2f43"
};
