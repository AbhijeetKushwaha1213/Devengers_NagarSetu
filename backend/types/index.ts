// Core application types
export type UserRole = 
  | 'citizen'
  | 'worker'
  | 'municipal_admin'
  | 'pradhan'
  | 'panchayat_worker'
  | 'administrator'
  | 'community_member';

// Backwards compatibility alias
export type UserType = UserRole;

export interface User {
  id: string;
  email?: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  panchayat_id?: string;
  municipality_id?: string;
  ward_id?: string;
  department_id?: string;
  employee_id?: string;
  created_at?: string;
  updated_at?: string;

  // Joined display fields
  department_name?: string;
  municipality_name?: string;
  ward_name?: string;
}

export type IssueCategory = 
  | 'cleanliness'
  | 'dead_animal'
  | 'garbage_dump'
  | 'littering'
  | 'stagnant_water'
  | 'street_light'
  | 'water_supply';


export type IssueStatus = 
  | 'submitted'
  | 'verified'
  | 'in_progress' 
  | 'resolved' 
  | 'escalated'
  | 'rejected';

export type IssueUrgency = 
  | 'low' 
  | 'medium' 
  | 'high' 
  | 'critical';

export interface Issue {
  id: string;
  tracking_id?: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  priority_score?: number;
  address: string;
  panchayat_id?: string;
  reporter_id?: string;
  assigned_manager_id?: string;
  assigned_worker_id?: string;
  department_id?: string;
  municipality_id?: string;
  ward_id?: string;
  image_urls?: string[];
  resolution_image_urls?: string[];
  upvotes_count: number;
  volunteers_count: number;
  citizen_feedback?: 'satisfied' | 'not_satisfied' | string;
  citizen_feedback_comment?: string | null;
  citizen_feedback_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  verified_at?: string;
  resolved_at?: string;
  escalated_at?: string;

  // UI / Joined display helper fields
  location?: string;
  department_name?: string;
  worker_name?: string;
  municipality_name?: string;
  ward_name?: string;
  image?: string;
  created_by?: string;
  urgency?: IssueUrgency;
  latitude?: number;
  longitude?: number;
  comments_count?: number;
}

export interface Municipality {
  id: string;
  name: string;
  district_id?: string;
  created_at?: string;
}

export interface Ward {
  id: string;
  name: string;
  ward_number?: number;
  municipality_id: string;
  created_at?: string;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  municipality_id?: string;
  created_at?: string;
}

export type EventStatus = 
  | 'upcoming' 
  | 'ongoing' 
  | 'completed' 
  | 'cancelled';

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  status: EventStatus;
  time_remaining?: string;
  categories: string[];
  volunteers_count: number;
  created_by: string;
  created_at: string;
}

export interface Comment {
  id: string;
  content: string;
  issue_id: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  hasMore: boolean;
  page: number;
  limit: number;
}

// Form types
export interface CreateIssueForm {
  title: string;
  description: string;
  address: string;
  location?: string;
  category: IssueCategory;
  municipality_id?: string;
  ward_id?: string;
  department_id?: string;
  image?: File;
  latitude?: number;
  longitude?: number;
}

export interface CreateEventForm {
  title: string;
  description: string;
  location: string;
  date: string;
  time: string;
  categories: string[];
}

export interface AuthForm {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
  userType?: UserRole;
  department_id?: string;
  municipality_id?: string;
  ward_id?: string;
  employee_id?: string;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

// Map related types
export interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface MapMarker extends MapLocation {
  id: string;
  title: string;
  type: 'issue' | 'event';
  status?: string;
  urgency?: IssueUrgency;
}

// Notification types
export interface Notification {
  id: string;
  user_id?: string;
  title: string;
  message: string;
  type: string;
  issue_id?: string;
  read?: boolean;
  created_at: string;
  timestamp?: string;
  action_url?: string;
}

// Filter types
export interface IssueFilters {
  category?: IssueCategory;
  status?: IssueStatus;
  urgency?: IssueUrgency;
  location?: string;
  municipality_id?: string;
  ward_id?: string;
  department_id?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface EventFilters {
  status?: EventStatus;
  category?: string;
  location?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Municipal Admin specific types
export interface MunicipalAdminDashboardStats {
  totalIssues: number;
  submittedIssues: number;
  verifiedIssues: number;
  inProgressIssues: number;
  resolvedIssues: number;
  escalatedIssues: number;
}
export type AuthorityDashboardStats = MunicipalAdminDashboardStats;

export interface IssueAssignment {
  issue_id: string;
  assigned_worker_id: string;
  department_id: string;
  status: IssueStatus;
  notes?: string;
}

// Worker specific types
export interface WorkerDashboardStats {
  new_assigned: number;
  in_progress: number;
  resolved_count: number;
  critical_count: number;
  total_assigned: number;
}
export type OfficialDashboardStats = WorkerDashboardStats;

export type OfficialTaskCard = Issue;
