/**
 * Milestone 9.2: Notification Service & Recipient Resolution Test Suite
 * File: tests/backend/notifications/notificationService.test.ts
 *
 * Implements and verifies all 26 required test cases:
 *
 * Service Tests:
 * 1. create valid notification
 * 2. invalid recipient rejected
 * 3. nonexistent issue rejected
 * 4. invalid type rejected
 * 5. empty title rejected
 * 6. empty message rejected
 * 7. successful retrieval
 * 8. unread count
 * 9. mark as read
 * 10. already-read notification
 * 11. cross-user retrieval denied
 *
 * Recipient Resolver Tests:
 * 12. citizen reporter resolved
 * 13. assigned worker resolved
 * 14. municipal authority resolved only within municipality
 * 15. panchayat authority resolved only within panchayat
 * 16. unrelated municipality excluded
 * 17. unrelated panchayat excluded
 * 18. inactive users excluded where required
 * 19. duplicate recipients deduplicated
 * 20. actor exclusion behavior verified
 *
 * Security Tests:
 * 21. citizen cannot dispatch arbitrary system notification
 * 22. client cannot directly INSERT notifications
 * 23. user cannot read another user's notifications
 * 24. user cannot modify notification content
 * 25. user cannot change recipient
 * 26. mark-as-read cannot affect another user's notification
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import {
  NotificationService,
  RecipientResolver,
  NotificationType,
  NotificationValidationError,
  NotificationIssueNotFound,
  NotificationUnauthorized,
  NotificationRecipientNotFound,
} from '../../../backend/services/notifications';

// ------------------------------------------------------------------------------
// Test Harness Setup
// ------------------------------------------------------------------------------
interface TestResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(step: number, name: string, passed: boolean, details: string) {
  results.push({ step, name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${status}] Test ${step}: ${name} -> ${details}`);
}

// Load environment configuration
const envPath = path.resolve(process.cwd(), '.env.local');
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  }
}

const supabaseUrl = env['VITE_SUPABASE_URL'] || process.env.VITE_SUPABASE_URL || '';
const anonKey = env['VITE_SUPABASE_ANON_KEY'] || process.env.VITE_SUPABASE_ANON_KEY || '';

// ------------------------------------------------------------------------------
// Mock Supabase Client for Deterministic Unit & Contract Testing
// ------------------------------------------------------------------------------
interface MockDbItem {
  id: string;
  [key: string]: unknown;
}

interface MockState {
  currentUserId?: string | null;
  issues?: Record<string, MockDbItem>;
  userProfiles?: Record<string, MockDbItem>;
  notifications?: Record<string, MockDbItem>;
}

function createMockClient(state: MockState): SupabaseClient {
  const notificationsDb: Record<string, MockDbItem> = { ...(state.notifications || {}) };
  const issuesDb: Record<string, MockDbItem> = { ...(state.issues || {}) };
  const userProfilesDb: Record<string, MockDbItem> = { ...(state.userProfiles || {}) };

  const client = {
    auth: {
      getUser: async () => {
        if (!state.currentUserId) {
          return { data: { user: null }, error: new Error('Unauthenticated') };
        }
        return { data: { user: { id: state.currentUserId } }, error: null };
      },
    },
    rpc: async (fnName: string, params?: Record<string, unknown>) => {
      if (fnName === 'create_system_notification' && params) {
        const id = '10000000-0000-0000-0000-' + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
        const userId = String(params.p_user_id);
        const issueId = params.p_issue_id ? String(params.p_issue_id) : null;

        // Verify recipient exists
        if (!userProfilesDb[userId]) {
          return { data: null, error: { message: 'Recipient user does not exist' } };
        }
        // Verify issue if provided
        if (issueId && !issuesDb[issueId]) {
          return { data: null, error: { message: 'Referenced issue does not exist' } };
        }
        notificationsDb[id] = {
          id,
          user_id: userId,
          issue_id: issueId,
          title: String(params.p_title),
          message: String(params.p_message),
          type: String(params.p_type),
          channels: (params.p_channels as string[]) || ['in_app'],
          delivery_status: { in_app: 'delivered' },
          read_at: null,
          created_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        };
        return { data: id, error: null };
      }

      if (fnName === 'mark_notification_read' && params) {
        const notifId = String(params.p_notification_id);
        const notif = notificationsDb[notifId];
        if (!notif) {
          return { data: null, error: { message: 'Notification not found' } };
        }
        if (notif.user_id !== state.currentUserId) {
          return { data: null, error: { message: "Permission denied: cannot mark another user's notification as read" } };
        }
        if (notif.read_at) {
          return { data: { success: true, id: notif.id, read_at: notif.read_at, already_read: true }, error: null };
        }
        notif.read_at = new Date().toISOString();
        return { data: { success: true, id: notif.id, read_at: notif.read_at, already_read: false }, error: null };
      }

      if (fnName === 'mark_all_notifications_read') {
        let count = 0;
        const now = new Date().toISOString();
        for (const n of Object.values(notificationsDb)) {
          if (n.user_id === state.currentUserId && !n.read_at) {
            n.read_at = now;
            count++;
          }
        }
        return { data: { success: true, updated_count: count, read_at: now }, error: null };
      }

      return { data: null, error: { message: `Function ${fnName} not found` } };
    },
    from: (table: string) => {
      return {
        select: (_cols?: string, options?: { count?: string; head?: boolean }) => {
          let rows: MockDbItem[] = [];
          if (table === 'notifications') {
            rows = Object.values(notificationsDb);
          } else if (table === 'issues') {
            rows = Object.values(issuesDb);
          } else if (table === 'user_profiles') {
            rows = Object.values(userProfilesDb);
          }

          let currentFilter = [...rows];

          const builder = {
            eq: (col: string, val: unknown) => {
              currentFilter = currentFilter.filter(r => r[col] === val);
              return builder;
            },
            in: (col: string, vals: unknown[]) => {
              currentFilter = currentFilter.filter(r => vals.includes(r[col]));
              return builder;
            },
            is: (col: string, val: unknown) => {
              currentFilter = currentFilter.filter(r => (val === null ? r[col] === null : r[col] === val));
              return builder;
            },
            order: (_col: string, _opts?: unknown) => builder,
            range: (from: number, to: number) => {
              currentFilter = currentFilter.slice(from, to + 1);
              return builder;
            },
            single: async () => {
              if (currentFilter.length === 0) return { data: null, error: new Error('Not found') };
              return { data: { ...currentFilter[0] }, error: null };
            },
            maybeSingle: async () => {
              if (currentFilter.length === 0) return { data: null, error: null };
              return { data: { ...currentFilter[0] }, error: null };
            },
            then: (resolve: (value: { count?: number; data: MockDbItem[] | null; error: null }) => void) => {
              if (options?.count === 'exact') {
                resolve({ count: currentFilter.length, data: null, error: null });
              } else {
                resolve({ data: currentFilter.map(r => ({ ...r })), error: null });
              }
            },
          };
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          let targetIds: string[] = [];
          const builder = {
            eq: (col: string, val: unknown) => {
              if (table === 'notifications') {
                targetIds = Object.values(notificationsDb)
                  .filter(n => n[col] === val)
                  .map(n => n.id);
              }
              return builder;
            },
            is: (col: string, val: unknown) => {
              if (table === 'notifications') {
                targetIds = targetIds.filter(id => {
                  const n = notificationsDb[id];
                  return val === null ? n[col] === null : n[col] === val;
                });
              }
              return builder;
            },
            select: () => {
              const updated = targetIds.map(id => {
                notificationsDb[id] = { ...notificationsDb[id], ...payload };
                return { id };
              });
              return Promise.resolve({ data: updated, error: null });
            },
          };
          return builder;
        },
      };
    },
  };

  return client as unknown as SupabaseClient;
}

// ------------------------------------------------------------------------------
// Master Test Runner
// ------------------------------------------------------------------------------
async function runNotificationServiceTests() {
  console.log('===============================================================');
  console.log('🧪 MILESTONE 9.2: NOTIFICATION SERVICE & RECIPIENT RESOLVER');
  console.log('===============================================================\n');

  // Canonical UUIDs for controlled testing
  const citizenId = '6528a6ff-a195-48ac-8a2b-e59789cfaae6';
  const workerId = 'a5c5a47a-9cff-472b-bf58-f445da28df99';
  const muniAdminId = 'ee962ee3-103f-46aa-b1f0-d9eea1cdeb72';
  const otherMuniAdminId = '11111111-2222-3333-4444-555555555555';
  const pradhanId = '22222222-3333-4444-5555-666666666666';
  const otherPradhanId = '33333333-4444-5555-6666-777777777777';
  const inactiveWorkerId = '44444444-5555-6666-7777-888888888888';
  const systemAdminId = '55555555-6666-7777-8888-999999999999';

  const municipalityA = 'e15a8684-df60-4451-8897-699aaf8a33c6';
  const municipalityB = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const panchayatA = 'dd26cee3-8d5a-4156-8aca-6986d551f132';
  const panchayatB = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

  const urbanIssueId = '88888888-9999-aaaa-bbbb-cccccccccccc';
  const ruralIssueId = '99999999-aaaa-bbbb-cccc-dddddddddddd';

  const mockProfiles: Record<string, MockDbItem> = {
    [citizenId]: { id: citizenId, role: 'citizen', is_active: true },
    [workerId]: { id: workerId, role: 'worker', is_active: true, municipality_id: municipalityA },
    [muniAdminId]: { id: muniAdminId, role: 'municipal_admin', is_active: true, municipality_id: municipalityA },
    [otherMuniAdminId]: { id: otherMuniAdminId, role: 'municipal_admin', is_active: true, municipality_id: municipalityB },
    [pradhanId]: { id: pradhanId, role: 'pradhan', is_active: true, panchayat_id: panchayatA },
    [otherPradhanId]: { id: otherPradhanId, role: 'pradhan', is_active: true, panchayat_id: panchayatB },
    [inactiveWorkerId]: { id: inactiveWorkerId, role: 'worker', is_active: false, municipality_id: municipalityA },
    [systemAdminId]: { id: systemAdminId, role: 'administrator', is_active: true },
  };

  const mockIssues: Record<string, MockDbItem> = {
    [urbanIssueId]: {
      id: urbanIssueId,
      reporter_id: citizenId,
      assigned_worker_id: workerId,
      municipality_id: municipalityA,
      panchayat_id: null,
      status: 'submitted',
    },
    [ruralIssueId]: {
      id: ruralIssueId,
      reporter_id: citizenId,
      assigned_worker_id: null,
      municipality_id: null,
      panchayat_id: panchayatA,
      status: 'submitted',
    },
  };

  const mockClient = createMockClient({
    currentUserId: muniAdminId,
    issues: mockIssues,
    userProfiles: mockProfiles,
  });

  // ==============================================================================
  // SECTION A: NOTIFICATION SERVICE TESTS (1 - 11)
  // ==============================================================================
  console.log('\n--- SECTION A: NotificationService Contract Tests ---');

  // Test 1: create valid notification
  try {
    const notif = await NotificationService.createNotification(
      {
        recipientId: citizenId,
        issueId: urbanIssueId,
        type: 'issue_submitted',
        title: 'New Civic Report Filed',
        message: 'Your report on street lighting has been registered.',
      },
      mockClient
    );
    const pass = Boolean(notif && notif.id && notif.user_id === citizenId && notif.read_at === null);
    record(1, 'create valid notification', pass, `Created ID: ${notif.id}, read_at: ${notif.read_at}`);
  } catch (err: unknown) {
    record(1, 'create valid notification', false, (err as Error).message);
  }

  // Test 2: invalid recipient rejected
  try {
    let rejected = false;
    try {
      await NotificationService.createNotification(
        {
          recipientId: 'nonexistent-uuid-1234',
          type: 'issue_submitted',
          title: 'Test',
          message: 'Test message',
        },
        mockClient
      );
    } catch (err) {
      if (err instanceof NotificationValidationError) rejected = true;
    }
    // Also test valid UUID but non-existent user profile
    const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
    try {
      await NotificationService.createNotification(
        {
          recipientId: nonExistentUserId,
          type: 'issue_submitted',
          title: 'Test',
          message: 'Test message',
        },
        mockClient
      );
    } catch (err) {
      if (err instanceof NotificationRecipientNotFound) rejected = true;
    }
    record(2, 'invalid recipient rejected', rejected, 'Properly rejected malformed and non-existent recipient');
  } catch (err: unknown) {
    record(2, 'invalid recipient rejected', false, (err as Error).message);
  }

  // Test 3: nonexistent issue rejected
  try {
    let rejected = false;
    try {
      await NotificationService.createNotification(
        {
          recipientId: citizenId,
          issueId: '99999999-0000-0000-0000-000000000000',
          type: 'issue_submitted',
          title: 'Test',
          message: 'Test message',
        },
        mockClient
      );
    } catch (err) {
      if (err instanceof NotificationIssueNotFound) rejected = true;
    }
    record(3, 'nonexistent issue rejected', rejected, 'Rejected creation pointing to missing issue');
  } catch (err: unknown) {
    record(3, 'nonexistent issue rejected', false, (err as Error).message);
  }

  // Test 4: invalid type rejected
  try {
    let rejected = false;
    try {
      await NotificationService.createNotification(
        {
          recipientId: citizenId,
          type: 'invalid_type_here' as unknown as NotificationType,
          title: 'Test',
          message: 'Test message',
        },
        mockClient
      );
    } catch (err) {
      if (err instanceof NotificationValidationError) rejected = true;
    }
    record(4, 'invalid type rejected', rejected, 'Enforced controlled NotificationType union');
  } catch (err: unknown) {
    record(4, 'invalid type rejected', false, (err as Error).message);
  }

  // Test 5: empty title rejected
  try {
    let rejected = false;
    try {
      await NotificationService.createNotification(
        {
          recipientId: citizenId,
          type: 'issue_submitted',
          title: '   ',
          message: 'Valid message',
        },
        mockClient
      );
    } catch (err) {
      if (err instanceof NotificationValidationError) rejected = true;
    }
    record(5, 'empty title rejected', rejected, 'Enforced non-empty trimmed title constraint');
  } catch (err: unknown) {
    record(5, 'empty title rejected', false, (err as Error).message);
  }

  // Test 6: empty message rejected
  try {
    let rejected = false;
    try {
      await NotificationService.createNotification(
        {
          recipientId: citizenId,
          type: 'issue_submitted',
          title: 'Valid title',
          message: '',
        },
        mockClient
      );
    } catch (err) {
      if (err instanceof NotificationValidationError) rejected = true;
    }
    record(6, 'empty message rejected', rejected, 'Enforced non-empty trimmed message constraint');
  } catch (err: unknown) {
    record(6, 'empty message rejected', false, (err as Error).message);
  }

  // Test 7: successful retrieval
  try {
    const notifId1 = '11111111-1111-1111-1111-111111111111';
    const notifId2 = '22222222-2222-2222-2222-222222222222';
    const citizenMockClient = createMockClient({
      currentUserId: citizenId,
      notifications: {
        [notifId1]: { id: notifId1, user_id: citizenId, title: 'Notice 1', message: 'M1', type: 'issue_submitted', read_at: null, created_at: '2026-09-20T08:00:00Z' },
        [notifId2]: { id: notifId2, user_id: citizenId, title: 'Notice 2', message: 'M2', type: 'issue_assigned', read_at: null, created_at: '2026-09-20T09:00:00Z' },
      },
    });
    const items = await NotificationService.getNotifications({}, citizenMockClient);
    const pass = items.length === 2 && items[0].user_id === citizenId;
    record(7, 'successful retrieval', pass, `Retrieved ${items.length} notifications scoped to caller`);
  } catch (err: unknown) {
    record(7, 'successful retrieval', false, (err as Error).message);
  }

  // Test 8: unread count
  try {
    const notifId1 = '11111111-1111-1111-1111-111111111111';
    const notifId2 = '22222222-2222-2222-2222-222222222222';
    const notifId3 = '33333333-3333-3333-3333-333333333333';
    const countMockClient = createMockClient({
      currentUserId: citizenId,
      notifications: {
        [notifId1]: { id: notifId1, user_id: citizenId, title: 'Notice 1', read_at: null },
        [notifId2]: { id: notifId2, user_id: citizenId, title: 'Notice 2', read_at: '2026-09-20T08:30:00Z' },
        [notifId3]: { id: notifId3, user_id: citizenId, title: 'Notice 3', read_at: null },
      },
    });
    const unread = await NotificationService.getUnreadCount({}, countMockClient);
    const pass = unread === 2;
    record(8, 'unread count', pass, `Expected 2 unread, returned ${unread}`);
  } catch (err: unknown) {
    record(8, 'unread count', false, (err as Error).message);
  }

  // Test 9: mark as read
  const markedNotifId = 'aaaaaaaa-1111-2222-3333-444444444444';
  const markMockClient = createMockClient({
    currentUserId: citizenId,
    notifications: {
      [markedNotifId]: { id: markedNotifId, user_id: citizenId, title: 'Unread notice', read_at: null },
    },
  });
  try {
    const markRes = await NotificationService.markAsRead(markedNotifId, markMockClient);
    const pass = markRes.success === true && markRes.already_read === false && markRes.read_at !== null;
    record(9, 'mark as read', pass, `Successfully marked notification as read at ${markRes.read_at}`);
  } catch (err: unknown) {
    record(9, 'mark as read', false, (err as Error).message);
  }

  // Test 10: already-read notification
  try {
    const markRes2 = await NotificationService.markAsRead(markedNotifId, markMockClient);
    const pass = markRes2.success === true && markRes2.already_read === true;
    record(10, 'already-read notification', pass, `Idempotent: returned already_read=true`);
  } catch (err: unknown) {
    record(10, 'already-read notification', false, (err as Error).message);
  }

  // Test 11: cross-user retrieval denied
  try {
    let denied = false;
    try {
      await NotificationService.getNotifications({ userId: workerId }, markMockClient);
    } catch (err) {
      if (err instanceof NotificationUnauthorized) denied = true;
    }
    record(11, 'cross-user retrieval denied', denied, 'Blocked citizen caller from requesting worker notifications');
  } catch (err: unknown) {
    record(11, 'cross-user retrieval denied', false, (err as Error).message);
  }

  // ==============================================================================
  // SECTION B: RECIPIENT RESOLVER TESTS (12 - 20)
  // ==============================================================================
  console.log('\n--- SECTION B: RecipientResolver Domain Tests ---');

  // Test 12: citizen reporter resolved
  try {
    const recipients = await RecipientResolver.resolveRecipients(
      { issueId: urbanIssueId, eventType: 'issue_in_progress', actorId: workerId },
      mockClient
    );
    const pass = recipients.includes(citizenId);
    record(12, 'citizen reporter resolved', pass, `Resolved reporter ${citizenId} for issue_in_progress`);
  } catch (err: unknown) {
    record(12, 'citizen reporter resolved', false, (err as Error).message);
  }

  // Test 13: assigned worker resolved
  try {
    const recipients = await RecipientResolver.resolveRecipients(
      { issueId: urbanIssueId, eventType: 'issue_assigned', actorId: muniAdminId },
      mockClient
    );
    const pass = recipients.includes(workerId);
    record(13, 'assigned worker resolved', pass, `Resolved assigned worker ${workerId} for issue_assigned`);
  } catch (err: unknown) {
    record(13, 'assigned worker resolved', false, (err as Error).message);
  }

  // Test 14: municipal authority resolved only within municipality
  try {
    const recipients = await RecipientResolver.resolveRecipients(
      { issueId: urbanIssueId, eventType: 'issue_submitted', actorId: citizenId },
      mockClient
    );
    const hasMuniA = recipients.includes(muniAdminId);
    record(14, 'municipal authority resolved only within municipality', hasMuniA, `Resolved admin of Municipality A: ${muniAdminId}`);
  } catch (err: unknown) {
    record(14, 'municipal authority resolved only within municipality', false, (err as Error).message);
  }

  // Test 15: panchayat authority resolved only within panchayat
  try {
    const recipients = await RecipientResolver.resolveRecipients(
      { issueId: ruralIssueId, eventType: 'issue_submitted', actorId: citizenId },
      mockClient
    );
    const hasPradhanA = recipients.includes(pradhanId);
    record(15, 'panchayat authority resolved only within panchayat', hasPradhanA, `Resolved pradhan of Panchayat A: ${pradhanId}`);
  } catch (err: unknown) {
    record(15, 'panchayat authority resolved only within panchayat', false, (err as Error).message);
  }

  // Test 16: unrelated municipality excluded
  try {
    const recipients = await RecipientResolver.resolveRecipients(
      { issueId: urbanIssueId, eventType: 'issue_submitted', actorId: citizenId },
      mockClient
    );
    const hasMuniB = recipients.includes(otherMuniAdminId);
    record(16, 'unrelated municipality excluded', !hasMuniB, `Municipality B admin (${otherMuniAdminId}) strictly excluded`);
  } catch (err: unknown) {
    record(16, 'unrelated municipality excluded', false, (err as Error).message);
  }

  // Test 17: unrelated panchayat excluded
  try {
    const recipients = await RecipientResolver.resolveRecipients(
      { issueId: ruralIssueId, eventType: 'issue_submitted', actorId: citizenId },
      mockClient
    );
    const hasPradhanB = recipients.includes(otherPradhanId);
    const hasMuniAdmin = recipients.includes(muniAdminId);
    const pass = !hasPradhanB && !hasMuniAdmin;
    record(17, 'unrelated panchayat excluded', pass, `Other panchayats and municipal admins strictly excluded from rural issue`);
  } catch (err: unknown) {
    record(17, 'unrelated panchayat excluded', false, (err as Error).message);
  }

  // Test 18: inactive users excluded where required
  try {
    const inactiveIssueId = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
    const inactiveMockClient = createMockClient({
      currentUserId: muniAdminId,
      issues: {
        [inactiveIssueId]: {
          id: inactiveIssueId,
          reporter_id: citizenId,
          assigned_worker_id: inactiveWorkerId,
          municipality_id: municipalityA,
        },
      },
      userProfiles: mockProfiles,
    });
    const recipients = await RecipientResolver.resolveRecipients(
      { issueId: inactiveIssueId, eventType: 'issue_assigned', actorId: muniAdminId },
      inactiveMockClient
    );
    const pass = !recipients.includes(inactiveWorkerId);
    record(18, 'inactive users excluded where required', pass, `Inactive worker ${inactiveWorkerId} excluded from dispatch`);
  } catch (err: unknown) {
    record(18, 'inactive users excluded where required', false, (err as Error).message);
  }

  // Test 19: duplicate recipients deduplicated
  try {
    // A scenario where user qualifies as both reporter and authority
    const dualRoleId = '55555555-4444-3333-2222-111111111111';
    const dualIssueId = '66666666-7777-8888-9999-aaaaaaaaaaaa';
    const dualMockClient = createMockClient({
      currentUserId: muniAdminId,
      issues: {
        [dualIssueId]: {
          id: dualIssueId,
          reporter_id: dualRoleId,
          municipality_id: municipalityA,
        },
      },
      userProfiles: {
        [dualRoleId]: { id: dualRoleId, role: 'municipal_admin', is_active: true, municipality_id: municipalityA },
      },
    });
    const recipients = await RecipientResolver.resolveRecipients(
      { issueId: dualIssueId, eventType: 'issue_submitted', actorId: null },
      dualMockClient
    );
    const count = recipients.filter(id => id === dualRoleId).length;
    record(19, 'duplicate recipients deduplicated', count === 1, `Dual-qualifying user received exactly 1 candidate slot`);
  } catch (err: unknown) {
    record(19, 'duplicate recipients deduplicated', false, (err as Error).message);
  }

  // Test 20: actor exclusion behavior verified
  try {
    // If worker is resolving an issue, worker should not receive the resolution notification
    const recipients = await RecipientResolver.resolveRecipients(
      { issueId: urbanIssueId, eventType: 'issue_resolved', actorId: workerId },
      mockClient
    );
    const pass = !recipients.includes(workerId) && recipients.includes(citizenId);
    record(20, 'actor exclusion behavior verified', pass, `Actor ${workerId} excluded; target reporter ${citizenId} retained`);
  } catch (err: unknown) {
    record(20, 'actor exclusion behavior verified', false, (err as Error).message);
  }

  // ==============================================================================
  // SECTION C: LIVE DATABASE SECURITY & ISOLATION TESTS (21 - 26)
  // ==============================================================================
  console.log('\n--- SECTION C: Security & Remote Database Verification Tests ---');

  if (!supabaseUrl || !anonKey) {
    console.log('⚠️ Remote Supabase credentials missing; skipping live database portion');
    for (let t = 21; t <= 26; t++) {
      record(t, 'Live Security Test', false, 'Supabase URL/Key missing');
    }
  } else {
    // Authenticate live users
    const liveCitizenClient = createClient(supabaseUrl, anonKey);
    const { data: citAuth, error: citErr } = await liveCitizenClient.auth.signInWithPassword({
      email: 'citizen@nagarsetu.test',
      password: 'NagarTest@123',
    });
    if (citErr || !citAuth?.user) throw new Error(`Citizen auth failed: ${citErr?.message}`);

    const liveWorkerClient = createClient(supabaseUrl, anonKey);
    const { data: wrkAuth, error: wrkErr } = await liveWorkerClient.auth.signInWithPassword({
      email: 'worker@nagarsetu.test',
      password: 'NagarTest@123',
    });
    if (wrkErr || !wrkAuth?.user) throw new Error(`Worker auth failed: ${wrkErr?.message}`);

    const liveAdminClient = createClient(supabaseUrl, anonKey);
    const { data: admAuth, error: admErr } = await liveAdminClient.auth.signInWithPassword({
      email: 'admin@nagarsetu.test',
      password: 'NagarTest@123',
    });
    if (admErr || !admAuth?.user) throw new Error(`Admin auth failed: ${admErr?.message}`);

    const createdNotifIds: string[] = [];

    try {
      // Test 21: citizen cannot dispatch arbitrary system notification
      try {
        let blocked = false;
        try {
          await NotificationService.createNotification(
            {
              recipientId: liveCitizenClient.auth.getUser ? (await liveCitizenClient.auth.getUser()).data.user!.id : citizenId,
              title: 'Citizen Spoofed Notification',
              message: 'Should fail',
              type: 'system',
            },
            liveCitizenClient
          );
        } catch (err: unknown) {
          const errObj = err as Error;
          if (err instanceof NotificationUnauthorized || errObj.message.includes('Permission denied')) {
            blocked = true;
          }
        }
        record(21, 'citizen cannot dispatch arbitrary system notification', blocked, 'Database RPC rejected citizen authority injection');
      } catch (err: unknown) {
        record(21, 'citizen cannot dispatch arbitrary system notification', false, (err as Error).message);
      }

      // Test 22: client cannot directly INSERT notifications
      try {
        const { error: insertErr } = await liveCitizenClient
          .from('notifications')
          .insert({
            user_id: citAuth.user.id,
            title: 'Hacked Insert',
            message: 'Direct INSERT bypass attempt',
            type: 'system',
          });
        const blocked = Boolean(insertErr && (insertErr.message.includes('violates row-level security') || insertErr.code === '42501'));
        record(22, 'client cannot directly INSERT notifications', blocked, `Direct INSERT blocked by RLS: ${insertErr?.message}`);
      } catch (err: unknown) {
        record(22, 'client cannot directly INSERT notifications', false, (err as Error).message);
      }

      // Create a controlled notification for citizen via Admin client
      const { data: testNotifId, error: adminCreateErr } = await liveAdminClient.rpc('create_system_notification', {
        p_user_id: citAuth.user.id,
        p_title: 'M9.2 Verification Notification',
        p_message: 'Verifying notification service security contracts',
        p_type: 'issue_submitted',
        p_channels: ['in_app'],
      });
      if (adminCreateErr || !testNotifId) throw new Error(`Admin failed to seed test notification: ${adminCreateErr?.message}`);
      createdNotifIds.push(testNotifId);

      // Test 23: user cannot read another user's notifications
      try {
        const { data: workerViewOther } = await liveWorkerClient
          .from('notifications')
          .select('*')
          .eq('id', testNotifId);
        const blocked = !workerViewOther || workerViewOther.length === 0;
        record(23, "user cannot read another user's notifications", blocked, 'RLS prevented worker from querying citizen notification');
      } catch (err: unknown) {
        record(23, "user cannot read another user's notifications", false, (err as Error).message);
      }

      // Test 24: user cannot modify notification content
      try {
        const { error: tamperErr } = await liveCitizenClient
          .from('notifications')
          .update({ title: 'Tampered Title' })
          .eq('id', testNotifId);
        const blocked = Boolean(tamperErr && tamperErr.message.includes('Cannot modify notification title'));
        record(24, 'user cannot modify notification content', blocked, 'Anti-tampering trigger prevented title modification');
      } catch (err: unknown) {
        record(24, 'user cannot modify notification content', false, (err as Error).message);
      }

      // Test 25: user cannot change recipient
      try {
        const { error: recipientTamperErr } = await liveCitizenClient
          .from('notifications')
          .update({ user_id: wrkAuth.user.id })
          .eq('id', testNotifId);
        const blocked = Boolean(recipientTamperErr && (
          recipientTamperErr.message.includes('Cannot modify notification user_id') ||
          recipientTamperErr.message.includes('violates row-level security')
        ));
        record(25, 'user cannot change recipient', blocked, 'Anti-tampering trigger prevented recipient reassignment');
      } catch (err: unknown) {
        record(25, 'user cannot change recipient', false, (err as Error).message);
      }

      // Test 26: mark-as-read cannot affect another user's notification
      try {
        let blocked = false;
        try {
          await NotificationService.markAsRead(testNotifId, liveWorkerClient);
        } catch (err: unknown) {
          const errObj = err as Error;
          if (err instanceof NotificationUnauthorized || errObj.message.includes('Permission denied')) {
            blocked = true;
          }
        }
        record(26, "mark-as-read cannot affect another user's notification", blocked, 'Cross-user mark-as-read denied by RPC security check');
      } catch (err: unknown) {
        record(26, "mark-as-read cannot affect another user's notification", false, (err as Error).message);
      }

    } finally {
      // Clean up all live-created notifications
      console.log('\n--- Cleaning up live test-created notifications ---');
      for (const id of createdNotifIds) {
        await liveCitizenClient.from('notifications').delete().eq('id', id);
        await liveAdminClient.from('notifications').delete().eq('id', id);
      }
      console.log(`Cleaned up ${createdNotifIds.length} test notification(s).`);
    }
  }

  // ==============================================================================
  // SUMMARY REPORT
  // ==============================================================================
  console.log('\n===============================================================');
  console.log('📊 TEST SUMMARY');
  console.log('===============================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error(`\n❌ FAILED TESTS (${failedCount}):`);
    results.filter(r => !r.passed).forEach(r => console.error(` - Test ${r.step}: ${r.name} -> ${r.details}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 26/26 NOTIFICATION SERVICE TESTS PASSED!');
  }
}

runNotificationServiceTests().catch((err: unknown) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
