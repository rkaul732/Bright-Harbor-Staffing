export type AppRole = "employee" | "supervisor" | "admin";

export type ProgramName =
  | "Anchor"
  | "Beacon"
  | "Bayside"
  | "Beach"
  | "Chelsea"
  | "Wave"
  | "Code Red/Code Blue"
  | "Access Center"
  | "Administration"
  | "Outpatient"
  | "School Based";

export type LocationName =
  | "Point Pleasant"
  | "Little Egg Harbor"
  | "Berkeley"
  | "Toms River";

export type SkillName =
  | "Direct care"
  | "Case management"
  | "Driving"
  | "Wraparound service coordination";

export type ShiftCategory = "standard" | "emergency";

export type ShiftStatus = "open" | "covered" | "cancelled" | "draft";

export type RequestStatus =
  | "pending_supervisor_approval"
  | "approved"
  | "declined"
  | "cancelled";

export type ProfileStatus = "pending" | "approved" | "suspended";

export type CalendarMode = "month" | "day";

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  avatar_url?: string | null;
  phone?: string | null;
  created_at: string;
};

export type WorkerProfile = {
  id: string;
  user_id: string;
  status: ProfileStatus;
  program_name: ProgramName;
  program_names: ProgramName[];
  availability: string[];
  skills: SkillName[];
  account_information?: Record<string, string>;
  photo_url?: string | null;
  created_at: string;
};

export type SupervisorProfile = {
  id: string;
  user_id: string;
  status: ProfileStatus;
  location_name?: LocationName | null;
  front_desk_location_name?: string | null;
  title?: string | null;
  created_at: string;
};

export type AdminProfile = {
  id: string;
  user_id: string;
  status: ProfileStatus;
  created_at: string;
};

export type ShiftPost = {
  id: string;
  title: string;
  details: string | null;
  program_name: ProgramName;
  location_name: LocationName;
  shift_date: string;
  start_time: string;
  end_time: string;
  requirements: SkillName[];
  openings: number;
  filled_openings: number;
  pay_rate: number;
  category: ShiftCategory;
  urgent: boolean;
  status: ShiftStatus;
  created_by: string;
  posted_by_role: AppRole;
  owner_user_id: string | null;
  supervisor_email: string;
  created_at: string;
  updated_at: string;
};

export type ShiftRequest = {
  id: string;
  shift_id: string;
  requestor_id: string;
  requestor_name: string;
  note: string | null;
  status: RequestStatus;
  supervisor_email: string;
  routed_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

export type TimeOffRequest = {
  id: string;
  user_id: string;
  employee_name: string;
  program_name: ProgramName;
  start_date: string;
  end_date: string;
  reason: string;
  status: RequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  request_id: string | null;
  shift_id: string | null;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  body: string;
  created_at: string;
  read_at?: string | null;
};

export type Reschedule = {
  id: string;
  shift_id: string;
  requested_by: string;
  old_shift_date: string;
  old_start_time: string;
  old_end_time: string;
  new_shift_date: string;
  new_start_time: string;
  new_end_time: string;
  reason: string | null;
  status: RequestStatus;
  created_at: string;
};

export type Cancelation = {
  id: string;
  shift_id: string;
  requested_by: string;
  reason: string | null;
  status: RequestStatus;
  created_at: string;
};

export type SavedShift = {
  id: string;
  shift_id: string;
  user_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string | null;
  role: AppRole | "all";
  title: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

export type AdSlot = {
  id: string;
  title: string;
  body: string;
  cta_label: string;
  cta_href: string;
  program_name: string;
  placement: "dashboard" | "calendar" | "mobile";
  active: boolean;
  created_at: string;
};

export type MonthlyWinner = {
  id: string;
  month: string;
  user_id: string;
  worker_name: string;
  approved_shift_count: number;
  location_name?: LocationName | null;
  created_at: string;
};

export type AnalyticsSummary = {
  openShifts: number;
  coveredShifts: number;
  pendingRequests: number;
  pendingTimeOffRequests: number;
  approvedWorkers: number;
  activeSupervisors: number;
  thisMonthRequests: number;
};

export type DashboardData = {
  currentUser: AppUser;
  users: AppUser[];
  workerProfiles: WorkerProfile[];
  supervisorProfiles: SupervisorProfile[];
  adminProfiles: AdminProfile[];
  shifts: ShiftPost[];
  requests: ShiftRequest[];
  timeOffRequests: TimeOffRequest[];
  messages: Message[];
  savedShifts: SavedShift[];
  notifications: Notification[];
  adSlots: AdSlot[];
  monthlyWinners: MonthlyWinner[];
  analytics: AnalyticsSummary;
  isDemo: boolean;
};
