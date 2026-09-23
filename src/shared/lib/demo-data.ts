import {
  FIXED_EMERGENCY_PAY_RATE,
  APPROVAL_SUPERVISOR_EMAIL,
  FIXED_STANDARD_PAY_RATE
} from "@/shared/lib/constants";
import { toISODate } from "@/shared/lib/dates";
import type {
  AdSlot,
  AdminProfile,
  AnalyticsSummary,
  AppRole,
  AppUser,
  DashboardData,
  Message,
  MonthlyWinner,
  Notification,
  SavedShift,
  ShiftPost,
  ShiftRequest,
  SupervisorProfile,
  TimeOffRequest,
  WorkerProfile
} from "@/shared/types/domain";

const now = new Date();

function dateFromToday(days: number) {
  const date = new Date(now);
  date.setDate(now.getDate() + days);
  return toISODate(date);
}

const users: AppUser[] = [
  {
    id: "user-employee-1",
    email: "employee@example.com",
    full_name: "Jamie Rivera",
    role: "employee",
    avatar_url: null,
    phone: "732-555-0118",
    created_at: dateFromToday(-80),
    last_sign_in_at: dateFromToday(-1)
  },
  {
    id: "user-employee-2",
    email: "morgan@example.com",
    full_name: "Morgan Lane",
    role: "employee",
    avatar_url: null,
    phone: "732-555-0144",
    created_at: dateFromToday(-60),
    last_sign_in_at: dateFromToday(-1)
  },
  {
    id: "user-supervisor-1",
    email: APPROVAL_SUPERVISOR_EMAIL,
    full_name: "B. Pataky",
    role: "supervisor",
    avatar_url: null,
    phone: "732-555-0199",
    created_at: dateFromToday(-180),
    last_sign_in_at: dateFromToday(-1)
  },
  {
    id: "user-admin-1",
    email: "admin@example.com",
    full_name: "Alex Morgan",
    role: "admin",
    avatar_url: null,
    phone: "732-555-0181",
    created_at: dateFromToday(-210),
    last_sign_in_at: dateFromToday(-1)
  }
];

const workerProfiles: WorkerProfile[] = [
  {
    id: "worker-profile-1",
    user_id: "user-employee-1",
    status: "approved",
    program_name: "Beacon/ Anchor",
    program_names: ["Beacon/ Anchor", "Bayside"],
    availability: ["Weeknights", "Saturday mornings"],
    skills: ["Direct care", "Driving"],
    account_information: { preferredContact: "Text" },
    photo_url: null,
    created_at: dateFromToday(-70)
  },
  {
    id: "worker-profile-2",
    user_id: "user-employee-2",
    status: "pending",
    program_name: "Outpatient Services",
    program_names: ["Outpatient Services"],
    availability: ["Weekends"],
    skills: ["Case management", "Wraparound service coordination"],
    account_information: { preferredContact: "Email" },
    photo_url: null,
    created_at: dateFromToday(-12)
  }
];

const supervisorProfiles: SupervisorProfile[] = [
  {
    id: "supervisor-profile-1",
    user_id: "user-supervisor-1",
    status: "approved",
    location_name: "Toms River",
    front_desk_location_name: "Toms River Staffing",
    title: "Staffing Coordinator",
    created_at: dateFromToday(-170)
  }
];

const adminProfiles: AdminProfile[] = [
  {
    id: "admin-profile-1",
    user_id: "user-admin-1",
    status: "approved",
    program_names: [],
    is_super_admin: true,
    created_at: dateFromToday(-200)
  }
];

const shifts: ShiftPost[] = [
  {
    id: "shift-1",
    title: "Overnight direct care coverage",
    details: "One opening for overnight support and medication reminders.",
    program_name: "Beacon/ Anchor",
    location_name: "Toms River",
    shift_date: dateFromToday(1),
    start_time: "22:00",
    end_time: "07:00",
    requirements: ["Direct care"],
    openings: 1,
    filled_openings: 0,
    pay_rate: FIXED_STANDARD_PAY_RATE,
    category: "standard",
    urgent: true,
    status: "open",
    created_by: "user-supervisor-1",
    posted_by_role: "supervisor",
    owner_user_id: null,
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    created_at: dateFromToday(-1),
    updated_at: dateFromToday(-1)
  },
  {
    id: "shift-2",
    title: "Weekend driving support",
    details: "Transport residents to a community outing and provide direct support.",
    program_name: "Beacon/ Anchor",
    location_name: "Point Pleasant",
    shift_date: dateFromToday(4),
    start_time: "09:00",
    end_time: "15:00",
    requirements: ["Driving", "Direct care"],
    openings: 2,
    filled_openings: 1,
    pay_rate: FIXED_STANDARD_PAY_RATE,
    category: "standard",
    urgent: false,
    status: "open",
    created_by: "user-supervisor-1",
    posted_by_role: "supervisor",
    owner_user_id: null,
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    created_at: dateFromToday(-3),
    updated_at: dateFromToday(-3)
  },
  {
    id: "shift-3",
    title: "Coverage needed - Berkeley",
    details: "Family conflict came up and I need help covering this evening shift.",
    program_name: "Beacon/ Anchor",
    location_name: "Berkeley",
    shift_date: dateFromToday(7),
    start_time: "15:00",
    end_time: "23:00",
    requirements: ["Direct care"],
    openings: 1,
    filled_openings: 0,
    pay_rate: FIXED_STANDARD_PAY_RATE,
    category: "standard",
    urgent: false,
    status: "open",
    created_by: "user-employee-1",
    posted_by_role: "employee",
    owner_user_id: "user-employee-1",
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    created_at: dateFromToday(-1),
    updated_at: dateFromToday(-1)
  },
  {
    id: "shift-4",
    title: "Emergency stabilization coverage",
    details: "Supervisor-designated emergency opening for immediate support.",
    program_name: "Community Resources for Emergency Support and Treatment (CREST)",
    location_name: "Little Egg Harbor",
    shift_date: dateFromToday(0),
    start_time: "16:00",
    end_time: "00:00",
    requirements: ["Direct care", "Case management"],
    openings: 1,
    filled_openings: 0,
    pay_rate: FIXED_EMERGENCY_PAY_RATE,
    category: "emergency",
    urgent: true,
    status: "open",
    created_by: "user-admin-1",
    posted_by_role: "admin",
    owner_user_id: null,
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    created_at: dateFromToday(0),
    updated_at: dateFromToday(0)
  },
  {
    id: "shift-5",
    title: "Approved scheduled coverage",
    details: "Approved shift assigned to Jamie.",
    program_name: "Beacon/ Anchor",
    location_name: "Toms River",
    shift_date: dateFromToday(-3),
    start_time: "07:00",
    end_time: "15:00",
    requirements: ["Direct care"],
    openings: 1,
    filled_openings: 1,
    pay_rate: FIXED_STANDARD_PAY_RATE,
    category: "standard",
    urgent: false,
    status: "covered",
    created_by: "user-supervisor-1",
    posted_by_role: "supervisor",
    owner_user_id: null,
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    created_at: dateFromToday(-14),
    updated_at: dateFromToday(-5)
  },
  {
    id: "shift-6",
    title: "Beacon/ Anchor morning pickup",
    details: "Approved shift picked up by Jamie for Beacon/ Anchor coverage.",
    program_name: "Beacon/ Anchor",
    location_name: "Toms River",
    shift_date: dateFromToday(2),
    start_time: "07:00",
    end_time: "11:00",
    requirements: ["Direct care"],
    openings: 1,
    filled_openings: 1,
    pay_rate: FIXED_STANDARD_PAY_RATE,
    category: "standard",
    urgent: false,
    status: "covered",
    created_by: "user-supervisor-1",
    posted_by_role: "supervisor",
    owner_user_id: null,
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    created_at: dateFromToday(-2),
    updated_at: dateFromToday(-1)
  },
  {
    id: "shift-7",
    title: "Beacon/ Anchor afternoon pickup",
    details: "Second approved shift picked up by Jamie for Beacon/ Anchor coverage.",
    program_name: "Beacon/ Anchor",
    location_name: "Toms River",
    shift_date: dateFromToday(2),
    start_time: "12:00",
    end_time: "16:00",
    requirements: ["Direct care"],
    openings: 1,
    filled_openings: 1,
    pay_rate: FIXED_STANDARD_PAY_RATE,
    category: "standard",
    urgent: false,
    status: "covered",
    created_by: "user-supervisor-1",
    posted_by_role: "supervisor",
    owner_user_id: null,
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    created_at: dateFromToday(-2),
    updated_at: dateFromToday(-1)
  }
];

const requests: ShiftRequest[] = [
  {
    id: "request-1",
    shift_id: "shift-2",
    requestor_id: "user-employee-1",
    requestor_name: "Jamie Rivera",
    note: "I can take the second opening.",
    status: "pending_supervisor_approval",
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    routed_at: dateFromToday(0),
    reviewed_by: null,
    reviewed_at: null,
    created_at: dateFromToday(0)
  },
  {
    id: "request-2",
    shift_id: "shift-5",
    requestor_id: "user-employee-1",
    requestor_name: "Jamie Rivera",
    note: "Confirmed and approved.",
    status: "approved",
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    routed_at: dateFromToday(-8),
    reviewed_by: "user-supervisor-1",
    reviewed_at: dateFromToday(-7),
    created_at: dateFromToday(-8)
  },
  {
    id: "request-3",
    shift_id: "shift-6",
    requestor_id: "user-employee-1",
    requestor_name: "Jamie Rivera",
    note: "Approved Beacon/ Anchor pickup.",
    status: "approved",
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    routed_at: dateFromToday(-2),
    reviewed_by: "user-supervisor-1",
    reviewed_at: dateFromToday(-1),
    created_at: dateFromToday(-2)
  },
  {
    id: "request-4",
    shift_id: "shift-7",
    requestor_id: "user-employee-1",
    requestor_name: "Jamie Rivera",
    note: "Approved Beacon/ Anchor pickup.",
    status: "approved",
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL,
    routed_at: dateFromToday(-2),
    reviewed_by: "user-supervisor-1",
    reviewed_at: dateFromToday(-1),
    created_at: dateFromToday(-2)
  }
];

const timeOffRequests: TimeOffRequest[] = [
  {
    id: "time-off-1",
    user_id: "user-employee-1",
    employee_name: "Jamie Rivera",
    program_name: "Beacon/ Anchor",
    start_date: dateFromToday(14),
    end_date: dateFromToday(16),
    reason: "Family event",
    status: "pending_supervisor_approval",
    reviewed_by: null,
    reviewed_at: null,
    created_at: dateFromToday(-1)
  },
  {
    id: "time-off-2",
    user_id: "user-employee-1",
    employee_name: "Jamie Rivera",
    program_name: "Beacon/ Anchor",
    start_date: dateFromToday(-20),
    end_date: dateFromToday(-19),
    reason: "Appointment",
    status: "approved",
    reviewed_by: "user-admin-1",
    reviewed_at: dateFromToday(-24),
    created_at: dateFromToday(-28)
  },
  {
    id: "time-off-3",
    user_id: "user-employee-2",
    employee_name: "Morgan Lane",
    program_name: "Outpatient Services",
    start_date: dateFromToday(6),
    end_date: dateFromToday(6),
    reason: "Personal time",
    status: "pending_supervisor_approval",
    reviewed_by: null,
    reviewed_at: null,
    created_at: dateFromToday(-2)
  },
  {
    id: "time-off-4",
    user_id: "user-employee-1",
    employee_name: "Jamie Rivera",
    program_name: "Bayside",
    start_date: dateFromToday(3),
    end_date: dateFromToday(3),
    reason: "Bayside time off request",
    status: "pending_supervisor_approval",
    reviewed_by: null,
    reviewed_at: null,
    created_at: dateFromToday(-1)
  }
];

const messages: Message[] = [
  {
    id: "message-1",
    request_id: "request-1",
    shift_id: "shift-2",
    sender_id: "user-supervisor-1",
    sender_name: "B. Pataky",
    recipient_id: "user-employee-1",
    body: "Thanks for requesting this. I am reviewing coverage needs now.",
    created_at: dateFromToday(0),
    read_at: null
  }
];

const savedShifts: SavedShift[] = [
  {
    id: "saved-1",
    shift_id: "shift-1",
    user_id: "user-employee-1",
    created_at: dateFromToday(-1)
  }
];

const notifications: Notification[] = [
  {
    id: "notification-1",
    user_id: null,
    role: "employee",
    title: "Urgent overnight opening",
    body: "Toms River needs direct care coverage tomorrow night.",
    created_at: dateFromToday(0),
    read_at: null
  },
  {
    id: "notification-2",
    user_id: "user-supervisor-1",
    role: "supervisor",
    title: "Approval pending",
    body: "Jamie Rivera requested a Point Pleasant shift.",
    created_at: dateFromToday(0),
    read_at: null
  }
];

const adSlots: AdSlot[] = [
  {
    id: "ad-1",
    title: "Wraparound weekend pool",
    body: "Promote openings from wraparound coordination when weekend support gets tight.",
    cta_label: "View program",
    cta_href: "#",
    program_name: "Wraparound Services",
    placement: "dashboard",
    active: true,
    created_at: dateFromToday(-5)
  },
  {
    id: "ad-2",
    title: "Case management float list",
    body: "Share last minute office and field coverage with qualified employees.",
    cta_label: "Open list",
    cta_href: "#",
    program_name: "Case Management",
    placement: "mobile",
    active: true,
    created_at: dateFromToday(-7)
  }
];

const monthlyWinners: MonthlyWinner[] = [
  {
    id: "winner-1",
    month: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    user_id: "user-employee-1",
    worker_name: "Jamie Rivera",
    approved_shift_count: 12,
    location_name: "Toms River",
    created_at: dateFromToday(0)
  },
  {
    id: "winner-2",
    month: toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    user_id: "user-employee-2",
    worker_name: "Morgan Lane",
    approved_shift_count: 9,
    location_name: "Point Pleasant",
    created_at: dateFromToday(-30)
  }
];

function getAnalytics(): AnalyticsSummary {
  return {
    openShifts: shifts.filter((shift) => shift.status === "open").length,
    coveredShifts: shifts.filter((shift) => shift.status === "covered").length,
    pendingRequests: requests.filter(
      (request) => request.status === "pending_supervisor_approval"
    ).length,
    pendingTimeOffRequests: timeOffRequests.filter(
      (request) => request.status === "pending_supervisor_approval"
    ).length,
    approvedWorkers: workerProfiles.filter((profile) => profile.status === "approved")
      .length,
    activeSupervisors: supervisorProfiles.filter(
      (profile) => profile.status === "approved"
    ).length,
    thisMonthRequests: requests.length
  };
}

export function getDemoDashboardData(role: AppRole): DashboardData {
  const currentUser =
    users.find((user) => user.role === role) ?? users.find((user) => user.role === "employee")!;

  return {
    currentUser,
    users,
    workerProfiles,
    supervisorProfiles,
    adminProfiles,
    shifts,
    requests,
    timeOffRequests,
    messages,
    savedShifts,
    notifications,
    adSlots,
    monthlyWinners,
    analytics: getAnalytics(),
    isDemo: true
  };
}
