/**
 * Milestone 9.2: Canonical Notification Domain Types & Domain Errors
 * File: backend/services/notifications/types.ts
 */

export const NOTIFICATION_TYPES = [
  'issue_submitted',
  'issue_verified',
  'issue_assigned',
  'issue_reassigned',
  'issue_in_progress',
  'issue_resolved',
  'issue_rejected',
  'issue_escalated',
  'feedback_received',
  'issue_upvoted',
  'issue_commented',
  'system',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface Notification {
  id: string;
  user_id: string;
  issue_id: string | null;
  title: string;
  message: string;
  type: NotificationType;
  read_at: string | null;
  created_at: string;
  channels: string[];
  delivery_status: Record<string, unknown>;
  sent_at: string | null;
}

export interface CreateNotificationInput {
  recipientId: string;
  issueId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  channels?: string[];
  deliveryStatus?: Record<string, unknown> | string;
}

export interface GetNotificationsParams {
  userId?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface MarkReadResult {
  success: boolean;
  id: string;
  read_at: string;
  already_read: boolean;
}

export interface MarkAllReadResult {
  success: boolean;
  updated_count: number;
  read_at: string;
}

export interface NotificationEvent {
  issueId: string;
  eventType: NotificationType;
  actorId?: string | null;
}

export interface NotificationTemplate {
  title: string;
  message: string;
  channels?: string[];
}

export interface DispatchResult {
  totalRecipients: number;
  sent: string[];
  failed: Array<{
    recipientId: string;
    error: string;
  }>;
}

/**
 * Meaningful domain error hierarchy
 */
export class NotificationError extends Error {
  public code: string;

  constructor(message: string, code = 'NOTIFICATION_ERROR') {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
  }
}

export class NotificationRecipientNotFound extends NotificationError {
  constructor(message = 'Recipient user does not exist') {
    super(message, 'NOTIFICATION_RECIPIENT_NOT_FOUND');
    this.name = 'NotificationRecipientNotFound';
  }
}

export class NotificationIssueNotFound extends NotificationError {
  constructor(message = 'Referenced issue does not exist') {
    super(message, 'NOTIFICATION_ISSUE_NOT_FOUND');
    this.name = 'NotificationIssueNotFound';
  }
}

export class NotificationValidationError extends NotificationError {
  constructor(message: string) {
    super(message, 'NOTIFICATION_VALIDATION_ERROR');
    this.name = 'NotificationValidationError';
  }
}

export class NotificationUnauthorized extends NotificationError {
  constructor(message = 'Unauthorized to access or dispatch notification') {
    super(message, 'NOTIFICATION_UNAUTHORIZED');
    this.name = 'NotificationUnauthorized';
  }
}

export class NotificationDispatchError extends NotificationError {
  public details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 'NOTIFICATION_DISPATCH_ERROR');
    this.name = 'NotificationDispatchError';
    this.details = details;
  }
}
