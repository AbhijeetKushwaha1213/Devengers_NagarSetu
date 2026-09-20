/**
 * Milestone 9.3: Civic Lifecycle Event Definitions & Template Engine
 * File: backend/services/notifications/lifecycleEvents.ts
 *
 * Centralizes all issue lifecycle notification templates and metadata mapping.
 */

import { NotificationTemplate, NotificationType } from './types';

export interface IssueLifecycleEventContext {
  issueId: string;
  eventType: NotificationType;
  actorId?: string | null;
  issueTitle?: string;
  trackingId?: string;
  notes?: string | null;
  comment?: string;
  feedback?: 'satisfied' | 'not_satisfied';
  isReassignment?: boolean;
}

export function getLifecycleEventTemplate(event: IssueLifecycleEventContext): NotificationTemplate {
  const title = event.issueTitle || 'Civic Issue';

  switch (event.eventType) {
    case 'issue_submitted': {
      const trackingSuffix = event.trackingId ? ` (Tracking ID: ${event.trackingId})` : '';
      return {
        title: 'Civic Report Submitted',
        message: `Issue "${title}"${trackingSuffix} has been successfully submitted.`,
        channels: ['in_app'],
      };
    }

    case 'issue_verified':
      return {
        title: 'Issue Verified',
        message: `Issue "${title}" has been verified and queued for action.`,
        channels: ['in_app'],
      };

    case 'issue_assigned':
      return {
        title: 'Worker Assigned',
        message: `A field worker has been assigned to issue "${title}".`,
        channels: ['in_app'],
      };

    case 'issue_reassigned':
      return {
        title: 'Issue Reassigned',
        message: `Issue "${title}" has been reassigned to a new field worker.`,
        channels: ['in_app'],
      };

    case 'issue_in_progress':
      return {
        title: 'Work In Progress',
        message: `Work has begun on issue "${title}".`,
        channels: ['in_app'],
      };

    case 'issue_resolved':
      return {
        title: 'Issue Resolved',
        message: `Issue "${title}" has been marked as resolved.`,
        channels: ['in_app'],
      };

    case 'issue_rejected': {
      const reason = event.notes ? `: ${event.notes}` : '.';
      return {
        title: 'Issue Rejected',
        message: `Issue "${title}" was rejected${reason}`,
        channels: ['in_app'],
      };
    }

    case 'issue_escalated': {
      const notes = event.notes ? `: ${event.notes}` : '.';
      return {
        title: 'Issue Escalated',
        message: `Issue "${title}" has been escalated for administrative review${notes}`,
        channels: ['in_app'],
      };
    }

    case 'feedback_received': {
      if (event.feedback === 'satisfied') {
        return {
          title: 'Resolution Confirmed Satisfied',
          message: `Citizen confirmed satisfaction for issue "${title}".`,
          channels: ['in_app'],
        };
      }
      const comment = event.notes ? `: "${event.notes}"` : '.';
      return {
        title: 'Resolution Marked Unsatisfied',
        message: `Citizen expressed dissatisfaction for issue "${title}"${comment}`,
        channels: ['in_app'],
      };
    }

    case 'issue_upvoted':
      return {
        title: 'Civic Report Upvoted',
        message: `A citizen upvoted your civic report "${title}".`,
        channels: ['in_app'],
      };

    case 'issue_commented':
      return {
        title: 'New Comment on Issue',
        message: `A new comment was added to issue "${title}".`,
        channels: ['in_app'],
      };

    case 'system':
    default:
      return {
        title: 'System Notification',
        message: event.notes || `System update for issue "${title}".`,
        channels: ['in_app'],
      };
  }
}
