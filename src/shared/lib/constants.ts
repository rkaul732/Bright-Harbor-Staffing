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

export type ProgramChoice = {
  label: string;
  programNames: ProgramName[];
  children?: ProgramChoice[];
};

export type ProgramDivision = {
  name: string;
  choices: ProgramChoice[];
  programNames: ProgramName[];
};

const divisionChoices: { name: string; choices: ProgramChoice[] }[] = [
  {
    name: "Acute Care Services (Crisis)",
    choices: [
      { label: "CREST", programNames: ["Community Resources for Emergency Support and Treatment (CREST)"] },
      { label: "Crisis Diversion", programNames: ["Crisis Diversion"] },
      { label: "Crisis Stabilization", programNames: ["Crisis Stabilization"] },
      { label: "IOC", programNames: ["Involuntary Outpatient Commitment"] },
      { label: "PACT I", programNames: ["PACT I"] },
      { label: "PACT II", programNames: ["PACT II"] }
    ]
  },
  {
    name: "Adult Clinical Services",
    choices: [
      { label: "Access", programNames: ["Access"] },
      { label: "IFSS", programNames: ["Intensive Family Support Services"] },
      { label: "ISC", programNames: ["Integrated System of Care (ISC)"] },
      {
        label: "Law Enforcement Assisted Programs (LEAP)",
        programNames: ["LEAP (Arrive Together, On POINT, Barricaded Subjects)", "Arrive Together", "Barricaded Subjects", "On POINT"],
        children: [
          { label: "Arrive Together", programNames: ["Arrive Together"] },
          { label: "Barricaded Subjects", programNames: ["Barricaded Subjects"] },
          { label: "On POINT", programNames: ["On POINT"] }
        ]
      },
      { label: "Nursing Case Management", programNames: ["Nursing Case Management"] },
      { label: "Oasis", programNames: ["Oasis"] },
      { label: "Outpatient (Adult)", programNames: ["Outpatient Services"] },
      { label: "Primary Care", programNames: ["Primary Care"] },
      { label: "Recovery Services", programNames: ["Recovery Services"] },
      { label: "Shore Haven", programNames: ["Shore Haven"] }
    ]
  },
  {
    name: "Adult Residential Services",
    choices: [
      { label: "Anchor/Beacon", programNames: ["Beacon/ Anchor"] },
      { label: "Beach/Chelsea", programNames: ["Building Empowerment to Achieve Community Housing (BEACH)", "Chelsea"] },
      { label: "HSP", programNames: ["Housing Supports Program (HSP)"] },
      { label: "PATH", programNames: ["Progressive Assistance to Transition from Homelessness (PATH)"] },
      { label: "SHARE", programNames: ["Supportive Housing Assistance to Reach Excellence (SHARE)"] },
      { label: "Wave", programNames: ["Wellness Assistance Valuing Excellence (WAVE)"] }
    ]
  },
  {
    name: "Children's Services",
    choices: [
      { label: "EMBRACE", programNames: ["Empowering Mind, Body and Recovery after Challenging Experiences (EMBRACE)"] },
      { label: "HOPES", programNames: ["Healing through Outpatient Perinatal Education & Support (HOPES)"] },
      { label: "IIC", programNames: ["Intensive In Community Services (IIC)"] },
      { label: "KFT Monmouth", programNames: ["Keeping Families Together - MONMOUTH"] },
      { label: "KFT Ocean", programNames: ["Keeping Families Together - OCEAN"] },
      { label: "Outpatient (Children's)", programNames: ["Children & Families Outpatient Services"] },
      { label: "Supervised Visits", programNames: ["Supervised Visits"] }
    ]
  },
  {
    name: "Development",
    choices: [
      { label: "Marketing/Development", programNames: ["Marketing/Development"] },
      { label: "REAL", programNames: ["REAL Team"] },
      { label: "Salt Bridge Farms", programNames: ["Salt Bridge Farms"] }
    ]
  },
  { name: "Facilities", choices: [{ label: "Facilities", programNames: ["Facilities"] }] },
  {
    name: "Finance",
    choices: [
      { label: "Accounting", programNames: ["Accounting"] },
      { label: "Billing", programNames: ["Billing"] },
      { label: "Payroll", programNames: ["Payroll"] }
    ]
  },
  { name: "HR", choices: [{ label: "HR", programNames: ["HR"] }] },
  { name: "IT", choices: [{ label: "IT", programNames: ["IT"] }] },
  { name: "Ocean Academy", choices: [{ label: "Ocean Academy", programNames: ["Ocean Academy"] }] },
  { name: "QADC", choices: [{ label: "QADC", programNames: ["QADC"] }] },
  { name: "SOLAS", choices: [{ label: "SOLAS", programNames: ["SOLAS"] }] },
  {
    name: "Youth & Young Adult Services",
    choices: [
      { label: "Directions", programNames: ["Directions"] },
      { label: "FCIU", programNames: ["Family Crisis Intervention Unit (FCIU)"] },
      { label: "The NOOK", programNames: ["The NOOK"] },
      { label: "YEM", programNames: ["Youth Electronic Monitoring"] },
      { label: "YRS", programNames: ["Youth Recovery Services (YRS)"] }
    ]
  }
];

export const PROGRAM_DIVISIONS: ProgramDivision[] = divisionChoices.map((division) => ({
  ...division,
  programNames: [...new Set(division.choices.flatMap((choice) => choice.programNames))]
}));

export const PROGRAMS: ProgramName[] = [...new Set(PROGRAM_DIVISIONS.flatMap((division) => division.programNames))];

// Keep former identifiers readable so existing accounts and requests retain their scope.
export const LEGACY_PROGRAMS: ProgramName[] = [
  "Bayside",
  "Code Red/Code Blue",
  "Front Desk",
  "Intensive Outpatient",
  "Level I Outpatient",
  "Medication Assisted Treatment (MAT)",
  "TIDES"
];

export const KNOWN_PROGRAMS: ProgramName[] = [...PROGRAMS, ...LEGACY_PROGRAMS];

export const PROGRAM_SELECT_OPTIONS = PROGRAM_DIVISIONS.flatMap((division) =>
  division.choices.flatMap((choice) => [choice, ...(choice.children ?? [])].map((item) => ({
    value: item.programNames[0],
    label: item.label,
    division: division.name,
    programNames: item.programNames
  })))
).sort((a, b) => a.label.localeCompare(b.label) || a.division.localeCompare(b.division));

export function getProgramLabel(programName: string) {
  return (
    PROGRAM_SELECT_OPTIONS.find((option) => option.value === programName)?.label ??
    PROGRAM_SELECT_OPTIONS.find((option) => option.programNames.includes(programName as ProgramName))?.label ??
    programName
  );
}

export function getRelatedProgramNames(programName: ProgramName) {
  return (
    PROGRAM_SELECT_OPTIONS.find((option) => option.value === programName)?.programNames ??
    PROGRAM_SELECT_OPTIONS.find((option) => option.programNames.includes(programName))?.programNames ??
    [programName]
  );
}

export const SHIFT_EXCHANGE_PROGRAMS: ProgramName[] = [
  "Beacon/ Anchor",
  "Building Empowerment to Achieve Community Housing (BEACH)",
  "Chelsea",
  "Code Red/Code Blue",
  "Front Desk",
  "Wellness Assistance Valuing Excellence (WAVE)"
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
    KNOWN_PROGRAMS.includes(programName as ProgramName)
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
