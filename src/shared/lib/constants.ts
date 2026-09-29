import type {
  AppRole,
  LocationName,
  ProgramName,
  SkillName
} from "@/shared/types/domain";

export const APP_NAME = "Bright Harbor Healthcare Staffing";

export const APPROVAL_SUPERVISOR_EMAIL =
  process.env.SHIFT_APPROVAL_SUPERVISOR_EMAIL ?? "bpataky@brightharbor.org";

export const CODE_RED_BLUE_PROGRAM = "Code Red/Code Blue" satisfies ProgramName;
export const CODE_RED_BLUE_SUPERVISOR_EMAIL = "spetrasek@brightharbor.org";

export const LOCATIONS: LocationName[] = [
  "Point Pleasant",
  "Little Egg Harbor",
  "Berkeley",
  "Toms River"
];

export const PROGRAMS: ProgramName[] = [
  "Access",
  "Bayside",
  "Beacon/ Anchor",
  "Building Empowerment to Achieve Community Housing (BEACH)",
  "Chelsea",
  "Children & Families Outpatient Services",
  "Code Red/Code Blue",
  "Community Resources for Emergency Support and Treatment (CREST)",
  "Crisis Diversion",
  "Directions",
  "Empowering Mind, Body and Recovery after Challenging Experiences (EMBRACE)",
  "Family Crisis Intervention Unit (FCIU)",
  "Front Desk",
  "Healing through Outpatient Perinatal Education & Support (HOPES)",
  "Housing Supports Program (HSP)",
  "Integrated System of Care (ISC)",
  "Intensive Family Support Services",
  "Intensive In Community Services (IIC)",
  "Intensive Outpatient",
  "Involuntary Outpatient Commitment",
  "Keeping Families Together - MONMOUTH",
  "Keeping Families Together - OCEAN",
  "LEAP (Arrive Together, On POINT, Barricaded Subjects)",
  "Level I Outpatient",
  "Medication Assisted Treatment (MAT)",
  "Oasis",
  "Ocean Academy",
  "Outpatient Services",
  "PACT I",
  "PACT II",
  "Progressive Assistance to Transition from Homelessness (PATH)",
  "REAL Team",
  "Shore Haven",
  "SOLAS",
  "Supervised Visits",
  "Supportive Housing Assistance to Reach Excellence (SHARE)",
  "The NOOK",
  "TIDES",
  "Wellness Assistance Valuing Excellence (WAVE)",
  "Youth Electronic Monitoring",
  "Youth Recovery Services (YRS)"
];

export const SHIFT_EXCHANGE_PROGRAMS: ProgramName[] = [
  "Beacon/ Anchor",
  "Building Empowerment to Achieve Community Housing (BEACH)",
  "Chelsea",
  "Code Red/Code Blue",
  "Front Desk",
  "Wellness Assistance Valuing Excellence (WAVE)"
];

export const PROGRAM_DIVISIONS: { name: string; programNames: ProgramName[] }[] = [
  {
    name: "Children and Family Services",
    programNames: [
      "Children & Families Outpatient Services",
      "Healing through Outpatient Perinatal Education & Support (HOPES)",
      "Integrated System of Care (ISC)",
      "Intensive Family Support Services",
      "Intensive In Community Services (IIC)",
      "Keeping Families Together - MONMOUTH",
      "Keeping Families Together - OCEAN",
      "Supervised Visits"
    ]
  },
  {
    name: "Crisis and Outreach",
    programNames: [
      "Access",
      "Community Resources for Emergency Support and Treatment (CREST)",
      "Crisis Diversion",
      "Involuntary Outpatient Commitment",
      "LEAP (Arrive Together, On POINT, Barricaded Subjects)",
      "PACT I",
      "PACT II"
    ]
  },
  {
    name: "Housing and Residential Supports",
    programNames: [
      "Bayside",
      "Beacon/ Anchor",
      "Building Empowerment to Achieve Community Housing (BEACH)",
      "Chelsea",
      "Front Desk",
      "Housing Supports Program (HSP)",
      "Progressive Assistance to Transition from Homelessness (PATH)",
      "Shore Haven",
      "Supportive Housing Assistance to Reach Excellence (SHARE)",
      "TIDES",
      "Wellness Assistance Valuing Excellence (WAVE)"
    ]
  },
  {
    name: "Outpatient and Recovery",
    programNames: [
      "Empowering Mind, Body and Recovery after Challenging Experiences (EMBRACE)",
      "Intensive Outpatient",
      "Level I Outpatient",
      "Medication Assisted Treatment (MAT)",
      "Oasis",
      "Outpatient Services"
    ]
  },
  {
    name: "Youth & Young Adult Services",
    programNames: [
      "Code Red/Code Blue",
      "Directions",
      "Family Crisis Intervention Unit (FCIU)",
      "Ocean Academy",
      "REAL Team",
      "SOLAS",
      "The NOOK",
      "Youth Electronic Monitoring",
      "Youth Recovery Services (YRS)"
    ]
  }
];

export function getProgramsForDivisions(divisionNames: string[]) {
  const selectedPrograms = new Set<ProgramName>();

  PROGRAM_DIVISIONS.filter((division) => divisionNames.includes(division.name)).forEach(
    (division) => {
      division.programNames.forEach((programName) => selectedPrograms.add(programName));
    }
  );

  return PROGRAMS.filter((programName) => selectedPrograms.has(programName));
}

export const AVAILABILITY_OPTIONS = [
  "Monday daytime",
  "Monday evening",
  "Tuesday daytime",
  "Tuesday evening",
  "Wednesday daytime",
  "Wednesday evening",
  "Thursday daytime",
  "Thursday evening",
  "Friday daytime",
  "Friday evening",
  "Saturday daytime",
  "Saturday evening",
  "Sunday daytime",
  "Sunday evening",
  "Overnights",
  "As needed"
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

export function getShiftSupervisorEmail(programName?: string | null) {
  return programName === CODE_RED_BLUE_PROGRAM
    ? CODE_RED_BLUE_SUPERVISOR_EMAIL
    : APPROVAL_SUPERVISOR_EMAIL;
}

export const BRAND_COLORS = {
  sky: "#4BA0D8",
  ocean: "#346990",
  lemon: "#f7f5ac",
  mist: "#eef5fb",
  midnight: "#1c2f43"
};
