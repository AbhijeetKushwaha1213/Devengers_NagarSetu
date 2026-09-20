/**
 * Milestone 9.2: Notification Domain Input Validators
 * File: backend/validators/notificationValidator.ts
 */

import {
  CreateNotificationInput,
  GetNotificationsParams,
  NOTIFICATION_TYPES,
  NotificationType,
  NotificationValidationError,
} from '../services/notifications/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_TITLE_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_PAYLOAD_BYTES = 10240; // 10 KB limit to prevent payload abuse

export function isValidUuid(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

export function validateCreateNotificationInput(input: unknown): CreateNotificationInput {
  if (!input || typeof input !== 'object') {
    throw new NotificationValidationError('Input must be a non-null object');
  }

  const raw = input as Record<string, unknown>;

  // Check payload size
  const serialized = JSON.stringify(input);
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    throw new NotificationValidationError(`Notification payload exceeds maximum allowed size of ${MAX_PAYLOAD_BYTES} bytes`);
  }

  // 1. recipientId
  if (!raw.recipientId || typeof raw.recipientId !== 'string') {
    throw new NotificationValidationError('Recipient ID is required and must be a string');
  }
  const recipientId = raw.recipientId.trim();
  if (!isValidUuid(recipientId)) {
    throw new NotificationValidationError('Recipient ID must be a valid UUID');
  }

  // 2. issueId (optional)
  let issueId: string | null = null;
  if (raw.issueId !== undefined && raw.issueId !== null) {
    if (typeof raw.issueId !== 'string') {
      throw new NotificationValidationError('Issue ID must be a valid UUID string if provided');
    }
    const trimmedIssueId = raw.issueId.trim();
    if (trimmedIssueId.length > 0) {
      if (!isValidUuid(trimmedIssueId)) {
        throw new NotificationValidationError('Issue ID must be a valid UUID');
      }
      issueId = trimmedIssueId;
    }
  }

  // 3. title
  if (raw.title === undefined || raw.title === null || typeof raw.title !== 'string') {
    throw new NotificationValidationError('Notification title is required');
  }
  const title = raw.title.trim();
  if (title.length === 0) {
    throw new NotificationValidationError('Notification title cannot be empty');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new NotificationValidationError(`Notification title cannot exceed ${MAX_TITLE_LENGTH} characters`);
  }

  // 4. message
  if (raw.message === undefined || raw.message === null || typeof raw.message !== 'string') {
    throw new NotificationValidationError('Notification message is required');
  }
  const message = raw.message.trim();
  if (message.length === 0) {
    throw new NotificationValidationError('Notification message cannot be empty');
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new NotificationValidationError(`Notification message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }

  // 5. type
  if (!raw.type || typeof raw.type !== 'string') {
    throw new NotificationValidationError('Notification type is required');
  }
  const type = raw.type.trim() as NotificationType;
  if (!NOTIFICATION_TYPES.includes(type)) {
    throw new NotificationValidationError(
      `Unsupported notification type "${raw.type}". Allowed types: ${NOTIFICATION_TYPES.join(', ')}`
    );
  }

  // 6. channels (optional)
  let channels: string[] = ['in_app'];
  if (raw.channels !== undefined && raw.channels !== null) {
    if (!Array.isArray(raw.channels)) {
      throw new NotificationValidationError('Notification channels must be an array of strings');
    }
    if (raw.channels.some(c => typeof c !== 'string' || c.trim().length === 0)) {
      throw new NotificationValidationError('Notification channels must only contain non-empty strings');
    }
    channels = raw.channels.map(c => (c as string).trim());
    if (channels.length === 0) {
      channels = ['in_app'];
    }
  }

  return {
    recipientId,
    issueId,
    type,
    title,
    message,
    channels,
    deliveryStatus: (raw.deliveryStatus as Record<string, unknown> | string) || { in_app: 'delivered' },
  };
}

export function validateGetNotificationsParams(params?: unknown): GetNotificationsParams {
  if (!params) return { limit: 20, offset: 0 };
  if (typeof params !== 'object') {
    throw new NotificationValidationError('Parameters must be an object');
  }

  const raw = params as Record<string, unknown>;
  const result: GetNotificationsParams = {};

  if (raw.userId !== undefined && raw.userId !== null) {
    if (typeof raw.userId !== 'string' || !isValidUuid(raw.userId)) {
      throw new NotificationValidationError('Invalid userId parameter: must be a valid UUID');
    }
    result.userId = raw.userId.trim();
  }

  if (raw.unreadOnly !== undefined) {
    result.unreadOnly = Boolean(raw.unreadOnly);
  }

  if (raw.limit !== undefined && raw.limit !== null) {
    const limitNum = Number(raw.limit);
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new NotificationValidationError('Limit must be an integer between 1 and 100');
    }
    result.limit = limitNum;
  } else {
    result.limit = 20;
  }

  if (raw.offset !== undefined && raw.offset !== null) {
    const offsetNum = Number(raw.offset);
    if (!Number.isInteger(offsetNum) || offsetNum < 0) {
      throw new NotificationValidationError('Offset must be a non-negative integer');
    }
    result.offset = offsetNum;
  } else {
    result.offset = 0;
  }

  return result;
}
