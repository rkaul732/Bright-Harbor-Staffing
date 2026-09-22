export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type AppRole = "employee" | "supervisor" | "admin";
type ProfileStatus = "pending" | "approved" | "suspended";
type ProgramName =
  "Community Resources for Emergency Support and Treatment (CREST)"
  | "Crisis Diversion"
  | "Involuntary Outpatient Commitment"
  | "PACT I"
  | "PACT II"
  | "Access"
  | "LEAP (Arrive Together, On POINT, Barricaded Subjects)"
  | "Outpatient Services"
  | "Intensive Family Support Services"
  | "Oasis"
  | "Integrated System of Care (ISC)"
  | "Intensive Outpatient"
  | "Level I Outpatient"
  | "Medication Assisted Treatment (MAT)"
  | "Shore Haven"
  | "Building Empowerment to Achieve Community Housing (BEACH)"
  | "Beacon/ Anchor"
  | "Chelsea"
  | "Supportive Housing Assistance to Reach Excellence (SHARE)"
  | "Wellness Assistance Valuing Excellence (WAVE)"
  | "Progressive Assistance to Transition from Homelessness (PATH)"
  | "Housing Supports Program (HSP)"
  | "TIDES"
  | "Bayside"
  | "Empowering Mind, Body and Recovery after Challenging Experiences (EMBRACE)"
  | "Intensive In Community Services (IIC)"
  | "Children & Families Outpatient Services"
  | "Healing through Outpatient Perinatal Education & Support (HOPES)"
  | "Keeping Families Together - OCEAN"
  | "Keeping Families Together - MONMOUTH"
  | "Supervised Visits"
  | "Directions"
  | "Youth Electronic Monitoring"
  | "Youth Recovery Services (YRS)"
  | "Family Crisis Intervention Unit (FCIU)"
  | "REAL Team"
  | "The NOOK"
  | "Ocean Academy"
  | "SOLAS";
type ShiftCategory = "standard" | "emergency";
type ShiftStatus = "open" | "covered" | "cancelled" | "draft";
type RequestStatus =
  | "pending_supervisor_approval"
  | "approved"
  | "declined"
  | "cancelled";
type SkillName =
  | "Direct care"
  | "Case management"
  | "Driving"
  | "Wraparound service coordination";

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row & Record<string, unknown>;
  Insert: Insert & Record<string, unknown>;
  Update: Update & Record<string, unknown>;
  Relationships: [];
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
};

type WorkerProfileRow = {
  id: string;
  user_id: string;
  status: ProfileStatus;
  program_name: ProgramName;
  program_names: ProgramName[];
  availability: Json;
  skills: SkillName[];
  account_information: Json;
  photo_url: string | null;
  created_at: string;
};

type SupervisorProfileRow = {
  id: string;
  user_id: string;
  status: ProfileStatus;
  location_name: string | null;
  front_desk_location_name: string | null;
  title: string | null;
  created_at: string;
};

type AdminProfileRow = {
  id: string;
  user_id: string;
  status: ProfileStatus;
  created_at: string;
};

type ShiftPostRow = {
  id: string;
  title: string;
  details: string | null;
  program_name: ProgramName;
  location_name: string;
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

type RequestRow = {
  id: string;
  shift_id: string;
  requestor_id: string;
  requestor_name: string;
  note: string | null;
  status: RequestStatus;
  supervisor_email: string;
  routed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
};

type TimeOffRequestRow = {
  id: string;
  user_id: string;
  employee_name: string;
  program_name: ProgramName;
  start_date: string;
  end_date: string;
  reason: string;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  request_id: string | null;
  shift_id: string | null;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};

type SavedShiftRow = {
  id: string;
  shift_id: string;
  user_id: string;
  created_at: string;
};

type RescheduleRow = {
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
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type CancelationRow = {
  id: string;
  shift_id: string;
  requested_by: string;
  reason: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string | null;
  role: AppRole | "all";
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type AdSlotRow = {
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

type MonthlyWinnerRow = {
  id: string;
  month: string;
  user_id: string;
  worker_name: string;
  approved_shift_count: number;
  location_name: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: Table<
        UserRow,
        {
          id: string;
          email: string;
          full_name?: string;
          role?: AppRole;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
        }
      >;
      worker_profiles: Table<
        WorkerProfileRow,
        Partial<WorkerProfileRow> & { user_id: string }
      >;
      supervisor_profiles: Table<
        SupervisorProfileRow,
        Partial<SupervisorProfileRow> & { user_id: string }
      >;
      admin_profiles: Table<
        AdminProfileRow,
        Partial<AdminProfileRow> & { user_id: string }
      >;
      shift_posts: Table<
        ShiftPostRow,
        Partial<ShiftPostRow> & {
          title: string;
          location_name: string;
          shift_date: string;
          start_time: string;
          end_time: string;
          created_by: string;
          posted_by_role: AppRole;
        }
      >;
      requests: Table<
        RequestRow,
        Partial<RequestRow> & {
          shift_id: string;
          requestor_id: string;
          requestor_name: string;
        }
      >;
      time_off_requests: Table<
        TimeOffRequestRow,
        Partial<TimeOffRequestRow> & {
          user_id: string;
          employee_name: string;
          program_name: ProgramName;
          start_date: string;
          end_date: string;
          reason: string;
        }
      >;
      messages: Table<
        MessageRow,
        Partial<MessageRow> & {
          sender_id: string;
          sender_name: string;
          body: string;
        }
      >;
      saved_shifts: Table<
        SavedShiftRow,
        Partial<SavedShiftRow> & {
          shift_id: string;
          user_id: string;
        }
      >;
      reschedules: Table<
        RescheduleRow,
        Partial<RescheduleRow> & {
          shift_id: string;
          requested_by: string;
          old_shift_date: string;
          old_start_time: string;
          old_end_time: string;
          new_shift_date: string;
          new_start_time: string;
          new_end_time: string;
        }
      >;
      cancelations: Table<
        CancelationRow,
        Partial<CancelationRow> & {
          shift_id: string;
          requested_by: string;
        }
      >;
      notifications: Table<
        NotificationRow,
        Partial<NotificationRow> & {
          title: string;
          body: string;
        }
      >;
      ad_slots: Table<
        AdSlotRow,
        Partial<AdSlotRow> & {
          title: string;
          body: string;
          cta_label: string;
          cta_href: string;
          program_name: string;
        }
      >;
      monthly_winners: Table<
        MonthlyWinnerRow,
        Partial<MonthlyWinnerRow> & {
          month: string;
          user_id: string;
          worker_name: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      profile_status: ProfileStatus;
      shift_category: ShiftCategory;
      shift_status: ShiftStatus;
      request_status: RequestStatus;
      skill_name: SkillName;
    };
    CompositeTypes: Record<string, never>;
  };
};
