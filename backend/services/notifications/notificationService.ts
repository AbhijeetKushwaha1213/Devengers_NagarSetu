/**
 * Milestone 9.2: Canonical Notification Service
 * File: backend/services/notifications/notificationService.ts
 *
 * Implements trusted, validated backend notification operations:
 * - createNotification via create_system_notification RPC
 * - getNotifications with recipient isolation and read_at ordering
 * - getUnreadCount with read_at IS NULL semantics (zero is_read)
 * - markAsRead via mark_notification_read RPC
 * - markAllAsRead via atomic RPC / secure authenticated update
 * - dispatch with RecipientResolver and safe error isolation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../lib/supabase';
import {
  CreateNotificationInput,
  DispatchResult,
  GetNotificationsParams,
  MarkAllReadResult,
  MarkReadResult,
  Notification,
  NotificationError,
  NotificationEvent,
  NotificationIssueNotFound,
  NotificationRecipientNotFound,
  NotificationTemplate,
  NotificationUnauthorized,
} from './types';
import {
  isValidUuid,
  validateCreateNotificationInput,
  validateGetNotificationsParams,
} from '../../validators/notificationValidator';
import { RecipientResolver } from './recipientResolver';
import {
  IssueLifecycleEventContext,
  getLifecycleEventTemplate,
} from './lifecycleEvents';

export class NotificationService {
  /**
   * Secure notification creation wrapping the trusted create_system_notification database function.
   * Prohibits generic/arbitrary client inserts and validates all domain parameters.
   */
  static async createNotification(
    input: CreateNotificationInput,
    client: SupabaseClient = defaultSupabase
  ): Promise<Notification> {
    const validated = validateCreateNotificationInput(input);

    const deliveryStatusJson =
      typeof validated.deliveryStatus === 'string'
        ? validated.deliveryStatus
        : JSON.stringify(validated.deliveryStatus || { in_app: 'delivered' });

    const { data: notificationId, error } = await client.rpc('create_system_notification', {
      p_user_id: validated.recipientId,
      p_title: validated.title,
      p_message: validated.message,
      p_type: validated.type,
      p_issue_id: validated.issueId || null,
      p_channels: validated.channels || ['in_app'],
      p_delivery_status: deliveryStatusJson,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('Recipient user does not exist') || msg.includes('violates foreign key constraint')) {
        throw new NotificationRecipientNotFound(msg);
      }
      if (msg.includes('Referenced issue does not exist')) {
        throw new NotificationIssueNotFound(msg);
      }
      if (msg.includes('Permission denied')) {
        throw new NotificationUnauthorized(msg);
      }
      throw new NotificationError(`Failed to create notification: ${msg}`);
    }

    if (!notificationId) {
      throw new NotificationError('Notification creation failed: no ID returned');
    }

    // Attempt to fetch the created notification
    try {
      const { data: createdRow } = await client
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .maybeSingle();

      if (createdRow) {
        return createdRow as Notification;
      }
    } catch {
      // If RLS prevents caller from viewing recipient's notification (e.g. admin creating for citizen),
      // we fall back to returning the canonical domain object
    }

    return {
      id: notificationId,
      user_id: validated.recipientId,
      issue_id: validated.issueId || null,
      title: validated.title,
      message: validated.message,
      type: validated.type,
      read_at: null,
      created_at: new Date().toISOString(),
      channels: validated.channels || ['in_app'],
      delivery_status:
        typeof validated.deliveryStatus === 'object' && validated.deliveryStatus !== null
          ? (validated.deliveryStatus as Record<string, unknown>)
          : { in_app: 'delivered' },
      sent_at: new Date().toISOString(),
    };
  }

  /**
   * Retrieves notifications strictly scoped to the authenticated caller.
   * Cross-user notification retrieval is denied.
   */
  static async getNotifications(
    params?: GetNotificationsParams,
    client: SupabaseClient = defaultSupabase
  ): Promise<Notification[]> {
    const validated = validateGetNotificationsParams(params);

    const { data: authData, error: authErr } = await client.auth.getUser();
    if (authErr || !authData?.user) {
      throw new NotificationUnauthorized('Authentication required to retrieve notifications');
    }

    const currentUserId = authData.user.id;

    // Strict cross-user boundary check
    if (validated.userId && validated.userId !== currentUserId) {
      throw new NotificationUnauthorized('Cannot retrieve notifications belonging to another user');
    }

    let query = client
      .from('notifications')
      .select('*')
      .eq('user_id', currentUserId);

    if (validated.unreadOnly) {
      query = query.is('read_at', null);
    }

    const limit = validated.limit || 20;
    const offset = validated.offset || 0;

    query = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      throw new NotificationError(`Failed to retrieve notifications: ${error.message}`);
    }

    return (data || []) as Notification[];
  }

  /**
   * Retrieves the unread notification count for the authenticated caller.
   * Strictly evaluates read_at IS NULL (never is_read).
   */
  static async getUnreadCount(
    params?: { userId?: string },
    client: SupabaseClient = defaultSupabase
  ): Promise<number> {
    const { data: authData, error: authErr } = await client.auth.getUser();
    if (authErr || !authData?.user) {
      throw new NotificationUnauthorized('Authentication required to get unread count');
    }

    const currentUserId = authData.user.id;

    if (params?.userId && params.userId !== currentUserId) {
      throw new NotificationUnauthorized('Cannot get unread count of another user');
    }

    const { count, error } = await client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUserId)
      .is('read_at', null);

    if (error) {
      throw new NotificationError(`Failed to fetch unread notification count: ${error.message}`);
    }

    return count ?? 0;
  }

  /**
   * Marks a specific notification as read using the mark_notification_read RPC.
   * Handles already-read, not-found, cross-user denial, and unauthenticated states.
   */
  static async markAsRead(
    notificationId: string,
    client: SupabaseClient = defaultSupabase
  ): Promise<MarkReadResult> {
    if (!notificationId || !isValidUuid(notificationId)) {
      throw new NotificationError('Notification ID must be a valid UUID');
    }

    const { data, error } = await client.rpc('mark_notification_read', {
      p_notification_id: notificationId,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('Permission denied')) {
        throw new NotificationUnauthorized(msg);
      }
      if (msg.includes('Authentication required')) {
        throw new NotificationUnauthorized(msg);
      }
      if (msg.includes('Notification not found')) {
        throw new NotificationError(msg, 'NOTIFICATION_NOT_FOUND');
      }
      throw new NotificationError(`Failed to mark notification as read: ${msg}`);
    }

    return {
      success: Boolean(data?.success),
      id: data?.id || notificationId,
      read_at: data?.read_at || new Date().toISOString(),
      already_read: Boolean(data?.already_read),
    };
  }

  /**
   * Marks all unread notifications for the authenticated user as read.
   * Operates atomically and never affects other users' records.
   */
  static async markAllAsRead(
    client: SupabaseClient = defaultSupabase
  ): Promise<MarkAllReadResult> {
    const { data: authData, error: authErr } = await client.auth.getUser();
    if (authErr || !authData?.user) {
      throw new NotificationUnauthorized('Authentication required to mark notifications as read');
    }

    const currentUserId = authData.user.id;

    // Step 1: Attempt atomic RPC if available
    try {
      const { data: rpcData, error: rpcErr } = await client.rpc('mark_all_notifications_read');
      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        return {
          success: Boolean(rpcData.success),
          updated_count: Number(rpcData.updated_count ?? 0),
          read_at: String(rpcData.read_at || new Date().toISOString()),
        };
      }
    } catch {
      // Fallback to direct authenticated UPDATE
    }

    // Step 2: Direct authenticated UPDATE scoped strictly to auth.uid()
    const now = new Date().toISOString();
    const { data: updatedRows, error: updateErr } = await client
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', currentUserId)
      .is('read_at', null)
      .select('id');

    if (updateErr) {
      throw new NotificationError(`Failed to mark all notifications as read: ${updateErr.message}`);
    }

    return {
      success: true,
      updated_count: updatedRows?.length || 0,
      read_at: now,
    };
  }

  /**
   * End-to-end domain dispatch flow:
   * event -> RecipientResolver.resolveRecipients -> NotificationService.createNotification
   * Handles per-recipient dispatch failures safely without corrupting the overall dispatch.
   */
  static async dispatch(
    event: NotificationEvent,
    template: NotificationTemplate,
    client: SupabaseClient = defaultSupabase
  ): Promise<DispatchResult> {
    const recipients = await RecipientResolver.resolveRecipients(event, client);

    const sent: string[] = [];
    const failed: Array<{ recipientId: string; error: string }> = [];

    for (const recipientId of recipients) {
      try {
        await this.createNotification(
          {
            recipientId,
            issueId: event.issueId,
            type: event.eventType,
            title: template.title,
            message: template.message,
            channels: template.channels || ['in_app'],
          },
          client
        );
        sent.push(recipientId);
      } catch (err) {
        failed.push({
          recipientId,
          error: (err as Error).message || 'Unknown dispatch error',
        });
      }
    }

    return {
      totalRecipients: recipients.length,
      sent,
      failed,
    };
  }

  /**
   * Dispatches a civic lifecycle event using centralized templates and strict failure isolation.
   * Ensures notification failure NEVER rolls back or corrupts the primary civic mutation.
   */
  static async dispatchLifecycleEvent(
    event: IssueLifecycleEventContext,
    client: SupabaseClient = defaultSupabase
  ): Promise<DispatchResult> {
    try {
      const template = getLifecycleEventTemplate(event);
      return await this.dispatch(
        {
          issueId: event.issueId,
          eventType: event.eventType,
          actorId: event.actorId,
        },
        template,
        client
      );
    } catch (err) {
      console.warn(
        `[NotificationService] Lifecycle dispatch failed for event "${event.eventType}" on issue "${event.issueId}" (isolated):`,
        (err as Error).message || err
      );
      return {
        totalRecipients: 0,
        sent: [],
        failed: [
          {
            recipientId: 'system',
            error: (err as Error).message || 'Unknown lifecycle dispatch error',
          },
        ],
      };
    }
  }
}

export default NotificationService;
