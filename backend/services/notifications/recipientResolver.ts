/**
 * Milestone 9.2: Recipient Resolution Engine
 * File: backend/services/notifications/recipientResolver.ts
 *
 * Authoritatively determines notification recipients based on NagarSetu civic jurisdictions,
 * issue ownership, worker assignments, actor exclusions, and active account status.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../lib/supabase';
import {
  NotificationEvent,
  NotificationIssueNotFound,
  NotificationValidationError,
  NOTIFICATION_TYPES,
  NotificationType,
} from './types';
import { isValidUuid } from '../../validators/notificationValidator';

export class RecipientResolver {
  /**
   * Authoritative recipient determination for civic lifecycle events.
   * Derives all routing from database relationships; never trusts client-supplied jurisdiction IDs.
   */
  static async resolveRecipients(
    event: NotificationEvent,
    client: SupabaseClient = defaultSupabase
  ): Promise<string[]> {
    if (!event || typeof event !== 'object') {
      throw new NotificationValidationError('Event context is required');
    }

    if (!event.issueId || !isValidUuid(event.issueId)) {
      throw new NotificationValidationError('A valid issueId UUID is required for recipient resolution');
    }

    if (!event.eventType || !NOTIFICATION_TYPES.includes(event.eventType)) {
      throw new NotificationValidationError(
        `Invalid or unsupported eventType: "${event.eventType}". Supported: ${NOTIFICATION_TYPES.join(', ')}`
      );
    }

    // Step 1: Attempt atomic database procedure if available
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('resolve_notification_recipients', {
        p_issue_id: event.issueId,
        p_event_type: event.eventType,
        p_actor_id: event.actorId || null,
      });

      if (!rpcError && Array.isArray(rpcData)) {
        return rpcData;
      }

      if (rpcError) {
        const msg = rpcError.message || '';
        if (msg.includes('Referenced issue does not exist') || msg.includes('Issue not found')) {
          throw new NotificationIssueNotFound(`Issue with ID "${event.issueId}" does not exist`);
        }
        // If RPC does not exist yet on database, proceed to TypeScript domain resolution
      }
    } catch (err) {
      if (err instanceof NotificationIssueNotFound || err instanceof NotificationValidationError) {
        throw err;
      }
      // RPC call fallback
    }

    // Step 2: TypeScript domain resolution logic
    return this.resolveInTypeScript(event, client);
  }

  /**
   * Deterministic TypeScript domain resolution logic
   */
  private static async resolveInTypeScript(
    event: NotificationEvent,
    client: SupabaseClient
  ): Promise<string[]> {
    // 1. Fetch authoritative issue record
    const { data: issue, error: issueErr } = await client
      .from('issues')
      .select('id, reporter_id, assigned_worker_id, municipality_id, panchayat_id')
      .eq('id', event.issueId)
      .single();

    if (issueErr || !issue) {
      throw new NotificationIssueNotFound(`Issue with ID "${event.issueId}" does not exist`);
    }

    const candidateRecipients = new Set<string>();
    const { eventType, actorId } = event;

    // 2. Reporter candidacy
    const reporterEvents: NotificationType[] = [
      'issue_submitted',
      'issue_verified',
      'issue_assigned',
      'issue_reassigned',
      'issue_in_progress',
      'issue_resolved',
      'issue_rejected',
      'issue_escalated',
      'issue_upvoted',
      'issue_commented',
      'system',
    ];

    if (issue.reporter_id && reporterEvents.includes(eventType)) {
      const isReporterActive = await this.isUserActive(issue.reporter_id, client);
      if (isReporterActive) {
        candidateRecipients.add(issue.reporter_id);
      }
    }

    // 3. Assigned Worker candidacy
    const workerEvents: NotificationType[] = [
      'issue_assigned',
      'issue_reassigned',
      'issue_in_progress',
      'issue_resolved',
      'issue_rejected',
      'issue_escalated',
      'feedback_received',
      'issue_commented',
      'system',
    ];

    if (issue.assigned_worker_id && workerEvents.includes(eventType)) {
      const isWorkerActive = await this.isUserActive(issue.assigned_worker_id, client);
      if (isWorkerActive) {
        candidateRecipients.add(issue.assigned_worker_id);
      }
    }

    // 4. Urban Municipal Authority Routing (Strict Municipality Boundary)
    const authorityEvents: NotificationType[] = [
      'issue_submitted',
      'issue_escalated',
      'feedback_received',
      'issue_rejected',
      'system',
    ];

    if (issue.municipality_id && authorityEvents.includes(eventType)) {
      // Query municipal admins strictly matching this issue's municipality_id
      const { data: municipalAdmins } = await client
        .from('user_profiles')
        .select('id, is_active')
        .eq('role', 'municipal_admin')
        .eq('municipality_id', issue.municipality_id);

      if (municipalAdmins && Array.isArray(municipalAdmins)) {
        for (const admin of municipalAdmins) {
          if (admin.is_active !== false) {
            candidateRecipients.add(admin.id);
          }
        }
      }
    }

    // 5. Rural Panchayat Authority Routing (Strict Panchayat Boundary)
    if (issue.panchayat_id && authorityEvents.includes(eventType)) {
      // Query pradhan & panchayat workers strictly matching this issue's panchayat_id
      const { data: panchayatAuthorities } = await client
        .from('user_profiles')
        .select('id, is_active')
        .in('role', ['pradhan', 'panchayat_worker'])
        .eq('panchayat_id', issue.panchayat_id);

      if (panchayatAuthorities && Array.isArray(panchayatAuthorities)) {
        for (const auth of panchayatAuthorities) {
          if (auth.is_active !== false) {
            candidateRecipients.add(auth.id);
          }
        }
      }
    }

    // 6. Central Administrator Routing (System-wide oversight for escalated/system events)
    if (['issue_escalated', 'system'].includes(eventType)) {
      const { data: centralAdmins } = await client
        .from('user_profiles')
        .select('id, is_active')
        .eq('role', 'administrator');

      if (centralAdmins && Array.isArray(centralAdmins)) {
        for (const admin of centralAdmins) {
          if (admin.is_active !== false) {
            candidateRecipients.add(admin.id);
          }
        }
      }
    }

    // 7. Actor Exclusion
    if (actorId) {
      if (eventType === 'issue_submitted' && actorId === issue.reporter_id) {
        // Retain reporter for issue_submitted so citizen receives their submission confirmation receipt
      } else {
        candidateRecipients.delete(actorId);
      }
    }

    return Array.from(candidateRecipients);
  }

  /**
   * Helper to verify if a user profile is active
   */
  private static async isUserActive(userId: string, client: SupabaseClient): Promise<boolean> {
    try {
      const { data: profile } = await client
        .from('user_profiles')
        .select('id, is_active')
        .eq('id', userId)
        .single();

      if (!profile) return false;
      return profile.is_active !== false;
    } catch {
      return false;
    }
  }
}

export default RecipientResolver;
