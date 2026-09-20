import { IssueCategory, IssueStatus, IssueUrgency, EventStatus } from '@/types';

// Application constants
export const APP_CONFIG = {
  name: 'Nagar Setu',
  version: '1.0.0',
  description: 'Community-driven urban issue reporting and management platform',
  supportEmail: 'support@nagarsetu.com',
} as const;

// Route constants
export const ROUTES = {
  HOME: '/',
  LANDING: '/',
  DASHBOARD: '/dashboard',
  ISSUES: '/issues',
  ISSUE_DETAIL: '/issues/:id',
  REPORT_ISSUE: '/issues/report',
  EVENTS: '/events',
  EVENT_DETAIL: '/events/:id',
  PROFILE: '/profile',
  ONBOARDING: '/onboarding',
  AUTHORITY_DASHBOARD: '/authority-dashboard',
  AUTH_CALLBACK: '/auth/callback',
} as const;

// Canonical Issue categories with metadata
export { CATEGORY_DEFINITIONS as ISSUE_CATEGORIES, CATEGORY_LIST, getCategoryMetadata } from './categories';


// Issue status configurations
export const ISSUE_STATUSES: Record<IssueStatus, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  'submitted': {
    label: 'Submitted',
    description: 'Issue has been submitted and is awaiting verification',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: '📝',
  },
  'verified': {
    label: 'Verified',
    description: 'Issue has been verified by municipal authorities',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    icon: '🔍',
  },
  'in_progress': {
    label: 'In Progress',
    description: 'Issue is being actively worked on by assigned worker',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    icon: '🔄',
  },
  'resolved': {
    label: 'Resolved',
    description: 'Issue has been resolved by worker',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: '✅',
  },
  'escalated': {
    label: 'Escalated',
    description: 'Issue has been escalated for higher level review',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: '⚠️',
  },
  'rejected': {
    label: 'Rejected',
    description: 'Issue has been reviewed and rejected',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    icon: '❌',
  },
} as const;

// Issue urgency levels
export const ISSUE_URGENCY: Record<IssueUrgency, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  priority: number;
}> = {
  'low': {
    label: 'Low',
    description: 'Non-urgent issue that can be addressed when convenient',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    priority: 1,
  },
  'medium': {
    label: 'Medium',
    description: 'Moderate issue that should be addressed soon',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    priority: 2,
  },
  'high': {
    label: 'High',
    description: 'Important issue that needs prompt attention',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    priority: 3,
  },
  'critical': {
    label: 'Critical',
    description: 'Urgent issue requiring immediate attention',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    priority: 4,
  },
} as const;

// Event statuses
export const EVENT_STATUSES: Record<EventStatus, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  'upcoming': {
    label: 'Upcoming',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  'ongoing': {
    label: 'Ongoing',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  'completed': {
    label: 'Completed',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  'cancelled': {
    label: 'Cancelled',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
} as const;

// Department configurations
export const DEPARTMENTS = [
  'Public Works',
  'Transportation',
  'Water & Sewerage',
  'Electricity',
  'Health Department',
  'Environmental Services',
  'Parks & Recreation',
  'Building & Planning',
  'Police Department',
  'Fire Department',
  'Other',
] as const;

// Pagination constants
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 50,
  ISSUES_PER_PAGE: 12,
  EVENTS_PER_PAGE: 8,
} as const;

// File upload constants
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  BUCKET_NAME: 'issue-images',
} as const;

// Map constants
export const MAP_CONFIG = {
  DEFAULT_CENTER: { lat: 40.7128, lng: -74.0060 }, // New York City
  DEFAULT_ZOOM: 12,
  MARKER_COLORS: {
    issue: {
      low: '#10B981',      // green
      medium: '#F59E0B',   // yellow
      high: '#F97316',     // orange
      critical: '#EF4444', // red
    },
    event: '#3B82F6',      // blue
  },
} as const;

// Validation constants
export const VALIDATION = {
  TITLE_MIN_LENGTH: 5,
  TITLE_MAX_LENGTH: 100,
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 1000,
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
} as const;

// Toast/Notification constants
export const TOAST_DURATION = {
  SHORT: 3000,
  MEDIUM: 5000,
  LONG: 8000,
} as const;

// Authority access code constants
export const AUTH_CONFIG = {
  ACCESS_CODE_MIN_LENGTH: 10,
  ACCESS_CODE_ROTATION_DAYS: 90,
  MAX_LOGIN_ATTEMPTS: 5,
  SESSION_TIMEOUT_HOURS: 24,
} as const;

// API endpoints (if using external APIs)
export const API_ENDPOINTS = {
  GOOGLE_MAPS: 'https://maps.googleapis.com/maps/api',
  GOOGLE_VISION: 'https://vision.googleapis.com/v1',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  FILE_TOO_LARGE: `File size must be less than ${FILE_UPLOAD.MAX_SIZE / 1024 / 1024}MB`,
  INVALID_FILE_TYPE: 'Only JPEG, PNG, and WebP images are allowed',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  ISSUE_CREATED: 'Issue reported successfully!',
  ISSUE_UPDATED: 'Issue updated successfully!',
  EVENT_CREATED: 'Event created successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  ACCOUNT_CREATED: 'Account created successfully!',
  LOGIN_SUCCESS: 'Welcome back!',
} as const;