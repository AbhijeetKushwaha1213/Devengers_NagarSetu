/**
 * Milestone 9.3: Civic Lifecycle Notification Integration Test Suite
 * File: tests/backend/notifications/lifecycle.test.ts
 *
 * Implements and verifies all 20 required lifecycle notification test cases:
 *
 * Submission Lifecycle:
 * 1. createIssue() dispatches issue_submitted
 * 2. Confirmation notification delivered to reporter
 * 3. Title and tracking ID embedded correctly
 *
 * Status Lifecycle:
 * 4. transitionStatus(verified) dispatches issue_verified
 * 5. transitionStatus(in_progress) dispatches issue_in_progress
 * 6. transitionStatus(resolved) dispatches issue_resolved
 * 7. transitionStatus(rejected) dispatches issue_rejected
 * 8. transitionStatus(escalated) dispatches issue_escalated
 *
 * Assignment Lifecycle:
 * 9. assignWorker() initial assignment dispatches issue_assigned
 * 10. assignWorker() reassignment dispatches issue_reassigned
 * 11. Assigned worker notified
 * 12. Assigner is excluded from notification recipients
 *
 * Engagement Lifecycle:
 * 13. submitFeedback() dispatches feedback_received
 * 14. upvoteIssue() dispatches issue_upvoted
 * 15. addComment() dispatches issue_commented
 * 16. Upvote by issue reporter does NOT notify self
 *
 * Failure & Security Boundaries:
 * 17. Notification failure does NOT abort createIssue
 * 18. Notification failure does NOT abort transitionStatus
 * 19. No notifications dispatched for rejected invalid transitions
 * 20. No duplicate notifications generated on repeated reads/queries
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IssueService } from '../../../backend/services/issues/issueService';
import { WorkerService } from '../../../backend/services/workers/workerService';
import { NotificationService } from '../../../backend/services/notifications/notificationService';
import { IssueValidationError } from '../../../backend/validators/issueValidator';

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

// ------------------------------------------------------------------------------
// Mock State & Supabase Factory for Deterministic Lifecycle Testing
// ------------------------------------------------------------------------------
interface MockDbRow {
  id: string;
  [key: string]: unknown;
}

interface MockLifecycleState {
  currentUserId?: string | null;
  currentUserMetadata?: Record<string, unknown>;
  users: Record<string, MockDbRow>;
  issues: Record<string, MockDbRow>;
  notifications: Record<string, MockDbRow>;
  upvotes: Record<string, MockDbRow>;
  comments: Record<string, MockDbRow>;
  auditLogs: Record<string, MockDbRow>;
  failRpcNotification?: boolean;
}

let uuidSeq = 1000;
function generateUuid(prefix: string = '99999999'): string {
  uuidSeq++;
  return `${prefix}-0000-0000-0000-${uuidSeq.toString().padStart(12, '0')}`;
}

function createLifecycleMockSupabase(state: MockLifecycleState): SupabaseClient {
  const client = {
    auth: {
      getUser: async () => {
        if (!state.currentUserId) {
          return { data: { user: null }, error: new Error('Unauthenticated') };
        }
        return {
          data: {
            user: {
              id: state.currentUserId,
              email: `${state.currentUserId}@test.com`,
              user_metadata: state.currentUserMetadata || { full_name: 'Test User' },
            },
          },
          error: null,
        };
      },
    },
    rpc: async (fnName: string, params?: Record<string, unknown>) => {
      if (fnName === 'create_system_notification') {
        if (state.failRpcNotification) {
          return { data: null, error: { message: 'Database notification trigger failure (simulated)' } };
        }
        if (!params?.p_user_id || !params?.p_title || !params?.p_message || !params?.p_type) {
          return { data: null, error: { message: 'Missing required notification parameters' } };
        }
        const id = generateUuid('88888888');
        const row: MockDbRow = {
          id,
          user_id: params.p_user_id,
          issue_id: params.p_issue_id || null,
          title: params.p_title,
          message: params.p_message,
          type: params.p_type,
          channels: (params.p_channels as string[]) || ['in_app'],
          read_at: null,
          created_at: new Date().toISOString(),
        };
        state.notifications[id] = row;
        return { data: id, error: null };
      }

      // Allow fallback to service-level logic for stored procedures
      return { data: null, error: { message: `Could not find the function public.${fnName}` } };
    },
    from: (table: string) => {
      let currentTable: Record<string, MockDbRow>;
      if (table === 'issues') currentTable = state.issues;
      else if (table === 'notifications') currentTable = state.notifications;
      else if (table === 'user_profiles') currentTable = state.users;
      else if (table === 'upvotes') currentTable = state.upvotes;
      else if (table === 'issue_comments') currentTable = state.comments;
      else if (table === 'issue_audit_log') currentTable = state.auditLogs;
      else currentTable = {};

      return {
        select: (_cols?: string, _options?: { count?: string; head?: boolean }) => {
          let rows = Object.values(currentTable).map(r => ({ ...r }));
          const filterBuilder = {
            eq: (col: string, val: unknown) => {
              rows = rows.filter(r => r[col] === val);
              return filterBuilder;
            },
            in: (col: string, vals: unknown[]) => {
              rows = rows.filter(r => vals.includes(r[col]));
              return filterBuilder;
            },
            is: (col: string, val: unknown) => {
              rows = rows.filter(r => (val === null ? r[col] === null : r[col] === val));
              return filterBuilder;
            },
            order: () => filterBuilder,
            range: (from: number, to: number) => {
              rows = rows.slice(from, to + 1);
              return filterBuilder;
            },
            single: async () => {
              if (rows.length === 0) return { data: null, error: { message: 'Row not found' } };
              return { data: { ...rows[0] }, error: null };
            },
            maybeSingle: async () => {
              return { data: rows.length > 0 ? { ...rows[0] } : null, error: null };
            },
            then: (resolve: (val: { data: MockDbRow[]; count: number; error: null }) => void) =>
              resolve({ data: rows, count: rows.length, error: null }),
          };
          return filterBuilder;
        },
        insert: (data: unknown) => {
          const toInsert = Array.isArray(data) ? (data as Record<string, unknown>[]) : [data as Record<string, unknown>];
          const insertedRows: MockDbRow[] = [];
          for (const item of toInsert) {
            const id = (item.id as string) || generateUuid('77777777');
            const row: MockDbRow = {
              ...item,
              id,
              created_at: (item.created_at as string) || new Date().toISOString(),
              tracking_id: (item.tracking_id as string) || (table === 'issues' ? 'TRK-2026-' + Math.floor(1000 + Math.random() * 9000) : undefined),
            };
            currentTable[id] = row;
            insertedRows.push(row);
          }
          return {
            select: () => ({
              single: async () => ({ data: { ...insertedRows[0] }, error: null }),
              then: (resolve: (val: { data: MockDbRow[]; error: null }) => void) =>
                resolve({ data: insertedRows, error: null }),
            }),
            single: async () => ({ data: { ...insertedRows[0] }, error: null }),
            then: (resolve: (val: { data: MockDbRow[]; error: null }) => void) =>
              resolve({ data: insertedRows, error: null }),
          };
        },
        update: (updates: Record<string, unknown>) => {
          let rowsToUpdate = Object.values(currentTable);
          const updateBuilder = {
            eq: (col: string, val: unknown) => {
              rowsToUpdate = rowsToUpdate.filter(r => r[col] === val);
              return updateBuilder;
            },
            select: () => ({
              single: async () => {
                if (rowsToUpdate.length === 0) return { data: null, error: { message: 'Row not found' } };
                const row = rowsToUpdate[0];
                Object.assign(row, updates);
                currentTable[row.id] = row;
                return { data: { ...row }, error: null };
              },
              then: (resolve: (val: { data: MockDbRow[]; error: null }) => void) => {
                for (const row of rowsToUpdate) {
                  Object.assign(row, updates);
                  currentTable[row.id] = row;
                }
                resolve({ data: rowsToUpdate, error: null });
              },
            }),
            then: (resolve: (val: { data: MockDbRow[]; error: null }) => void) => {
              for (const row of rowsToUpdate) {
                Object.assign(row, updates);
                currentTable[row.id] = row;
              }
              resolve({ data: rowsToUpdate, error: null });
            },
          };
          return updateBuilder;
        },
        delete: () => {
          let rowsToDelete = Object.values(currentTable);
          const deleteBuilder = {
            eq: (col: string, val: unknown) => {
              rowsToDelete = rowsToDelete.filter(r => r[col] === val);
              for (const r of rowsToDelete) {
                delete currentTable[r.id];
              }
              return deleteBuilder;
            },
            then: (resolve: (val: { data: MockDbRow[]; error: null }) => void) =>
              resolve({ data: rowsToDelete, error: null }),
          };
          return deleteBuilder;
        },
      };
    },
  };

  return client as unknown as SupabaseClient;
}

// ------------------------------------------------------------------------------
// Canonical Test Fixtures
// ------------------------------------------------------------------------------
const CITIZEN_A_ID = '11111111-1111-1111-1111-111111111111';
const CITIZEN_B_ID = '22222222-2222-2222-2222-222222222222';
const WORKER_ID = '33333333-3333-3333-3333-333333333333';
const WORKER_2_ID = '44444444-4444-4444-4444-444444444444';
const MUNICIPAL_ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const CENTRAL_ADMIN_ID = '66666666-6666-6666-6666-666666666666';

const MUNICIPALITY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WARD_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function createInitialState(): MockLifecycleState {
  return {
    currentUserId: CITIZEN_A_ID,
    currentUserMetadata: { full_name: 'Citizen Alpha' },
    users: {
      [CITIZEN_A_ID]: {
        id: CITIZEN_A_ID,
        full_name: 'Citizen Alpha',
        role: 'citizen',
        is_active: true,
      },
      [CITIZEN_B_ID]: {
        id: CITIZEN_B_ID,
        full_name: 'Citizen Beta',
        role: 'citizen',
        is_active: true,
      },
      [WORKER_ID]: {
        id: WORKER_ID,
        full_name: 'Field Worker One',
        role: 'worker',
        is_active: true,
        municipality_id: MUNICIPALITY_ID,
      },
      [WORKER_2_ID]: {
        id: WORKER_2_ID,
        full_name: 'Field Worker Two',
        role: 'worker',
        is_active: true,
        municipality_id: MUNICIPALITY_ID,
      },
      [MUNICIPAL_ADMIN_ID]: {
        id: MUNICIPAL_ADMIN_ID,
        full_name: 'Municipal Admin Boss',
        role: 'municipal_admin',
        is_active: true,
        municipality_id: MUNICIPALITY_ID,
      },
      [CENTRAL_ADMIN_ID]: {
        id: CENTRAL_ADMIN_ID,
        full_name: 'Super Central Admin',
        role: 'administrator',
        is_active: true,
      },
    },
    issues: {},
    notifications: {},
    upvotes: {},
    comments: {},
    auditLogs: {},
  };
}

async function runLifecycleTests() {
  console.log('===============================================================');
  console.log('STARTING MILESTONE 9.3 CIVIC LIFECYCLE NOTIFICATION TEST SUITE');
  console.log('===============================================================\n');

  const state = createInitialState();
  const client = createLifecycleMockSupabase(state);

  let testIssueId = '';
  let testTrackingId = '';

  // ----------------------------------------------------------------------------
  // Group 1: Submission Lifecycle (Tests 1 - 3)
  // ----------------------------------------------------------------------------
  console.log('--- GROUP 1: SUBMISSION LIFECYCLE ---');
  try {
    state.currentUserId = CITIZEN_A_ID;
    const issue = await IssueService.createIssue(
      {
        description: 'Large hazardous garbage dump overflowing near market square',
        category: 'garbage_dump',
        address: '123 Main Street, Sector 4',
        municipality_id: MUNICIPALITY_ID,
        ward_id: WARD_ID,
        latitude: 28.6139,
        longitude: 77.2090,
      },
      client
    );

    testIssueId = issue.id;
    testTrackingId = issue.tracking_id || '';

    // Test 1: createIssue() dispatches issue_submitted
    const notifs = Object.values(state.notifications).filter(n => n.issue_id === testIssueId);
    const submittedNotif = notifs.find(n => n.type === 'issue_submitted');
    record(
      1,
      'createIssue() dispatches issue_submitted',
      Boolean(submittedNotif),
      submittedNotif ? `Dispatched notification ID: ${submittedNotif.id}` : 'No issue_submitted notification found'
    );

    // Test 2: Confirmation notification delivered to reporter
    const deliveredToReporter = submittedNotif?.user_id === CITIZEN_A_ID;
    record(
      2,
      'Confirmation notification delivered to reporter',
      deliveredToReporter,
      `Recipient user_id: ${submittedNotif?.user_id}, Expected reporter: ${CITIZEN_A_ID}`
    );

    // Test 3: Title and tracking ID embedded correctly
    const titleValid = submittedNotif?.title.includes('Submitted');
    const trackingValid = submittedNotif?.message.includes(testTrackingId);
    record(
      3,
      'Title and tracking ID embedded correctly in notification',
      Boolean(titleValid && trackingValid),
      `Title: "${submittedNotif?.title}", Message: "${submittedNotif?.message}"`
    );
  } catch (err) {
    record(1, 'createIssue() dispatches issue_submitted', false, (err as Error).message);
    record(2, 'Confirmation notification delivered to reporter', false, (err as Error).message);
    record(3, 'Title and tracking ID embedded correctly in notification', false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // Group 2: Status Lifecycle (Tests 4 - 8)
  // ----------------------------------------------------------------------------
  console.log('\n--- GROUP 2: STATUS LIFECYCLE ---');

  // Test 4: transitionStatus(verified) dispatches issue_verified
  try {
    state.currentUserId = MUNICIPAL_ADMIN_ID;
    await IssueService.transitionStatus(
      {
        issueId: testIssueId,
        status: 'verified',
        notes: 'Verified on-site by municipal sanitation inspector',
      },
      client
    );

    const notifs = Object.values(state.notifications).filter(n => n.issue_id === testIssueId && n.type === 'issue_verified');
    const verifiedNotif = notifs[0];
    const isToReporter = verifiedNotif?.user_id === CITIZEN_A_ID;
    record(
      4,
      'transitionStatus(verified) dispatches issue_verified to reporter',
      Boolean(verifiedNotif && isToReporter),
      verifiedNotif ? `Delivered to reporter ${verifiedNotif.user_id}: "${verifiedNotif.title}"` : 'Failed'
    );
  } catch (err) {
    record(4, 'transitionStatus(verified) dispatches issue_verified to reporter', false, (err as Error).message);
  }

  // Test 5: transitionStatus(in_progress) dispatches issue_in_progress
  try {
    // Assign worker first to allow worker to transition or admin to transition
    state.issues[testIssueId].assigned_worker_id = WORKER_ID;
    state.currentUserId = WORKER_ID;
    await IssueService.transitionStatus(
      {
        issueId: testIssueId,
        status: 'in_progress',
        notes: 'Sanitation crew dispatched to site',
      },
      client
    );

    const inProgNotifs = Object.values(state.notifications).filter(n => n.issue_id === testIssueId && n.type === 'issue_in_progress');
    const inProgNotif = inProgNotifs[0];
    const isToReporter = inProgNotif?.user_id === CITIZEN_A_ID;
    record(
      5,
      'transitionStatus(in_progress) dispatches issue_in_progress',
      Boolean(inProgNotif && isToReporter),
      inProgNotif ? `Delivered to reporter ${inProgNotif.user_id}: "${inProgNotif.title}"` : 'Failed'
    );
  } catch (err) {
    record(5, 'transitionStatus(in_progress) dispatches issue_in_progress', false, (err as Error).message);
  }

  // Test 6: transitionStatus(resolved) dispatches issue_resolved
  try {
    state.currentUserId = WORKER_ID;
    await IssueService.transitionStatus(
      {
        issueId: testIssueId,
        status: 'resolved',
        notes: 'Garbage cleared and area disinfected',
        resolutionImageUrls: ['https://example.com/resolved_clean.jpg'],
      },
      client
    );

    const resolvedNotifs = Object.values(state.notifications).filter(n => n.issue_id === testIssueId && n.type === 'issue_resolved');
    const resolvedNotif = resolvedNotifs[0];
    const isToReporter = resolvedNotif?.user_id === CITIZEN_A_ID;
    record(
      6,
      'transitionStatus(resolved) dispatches issue_resolved to reporter',
      Boolean(resolvedNotif && isToReporter),
      resolvedNotif ? `Delivered to reporter ${resolvedNotif.user_id}: "${resolvedNotif.title}"` : 'Failed'
    );
  } catch (err) {
    record(6, 'transitionStatus(resolved) dispatches issue_resolved to reporter', false, (err as Error).message);
  }

  // Test 7: transitionStatus(rejected) dispatches issue_rejected
  try {
    // Create a second test issue to test rejection flow from submitted status
    state.currentUserId = CITIZEN_A_ID;
    const rejectIssue = await IssueService.createIssue(
      {
        description: 'Duplicate duplicate complaint that is outside municipal remit',
        category: 'cleanliness',
        address: '99 Out of Bounds Lane',
        municipality_id: MUNICIPALITY_ID,
      },
      client
    );

    state.currentUserId = MUNICIPAL_ADMIN_ID;
    await IssueService.transitionStatus(
      {
        issueId: rejectIssue.id,
        status: 'rejected',
        notes: 'Private property - not under municipal jurisdiction',
      },
      client
    );

    const rejectNotifs = Object.values(state.notifications).filter(n => n.issue_id === rejectIssue.id && n.type === 'issue_rejected');
    const rejectNotif = rejectNotifs[0];
    const isToReporter = rejectNotif?.user_id === CITIZEN_A_ID;
    record(
      7,
      'transitionStatus(rejected) dispatches issue_rejected to reporter',
      Boolean(rejectNotif && isToReporter),
      rejectNotif ? `Delivered to reporter ${rejectNotif.user_id}: "${rejectNotif.title}"` : 'Failed'
    );
  } catch (err) {
    record(7, 'transitionStatus(rejected) dispatches issue_rejected to reporter', false, (err as Error).message);
  }

  // Test 8: transitionStatus(escalated) dispatches issue_escalated
  try {
    // Current test issue is resolved. Reporter citizen escalates it.
    state.currentUserId = CITIZEN_A_ID;
    await IssueService.transitionStatus(
      {
        issueId: testIssueId,
        status: 'escalated',
        notes: 'Waste was only partially cleared; bad odor persists',
      },
      client
    );

    const escalatedNotifs = Object.values(state.notifications).filter(n => n.issue_id === testIssueId && n.type === 'issue_escalated');
    // Escalated should notify assigned worker and municipal admin, but NOT the actor (CITIZEN_A)
    const notifiedIds = escalatedNotifs.map(n => n.user_id);
    const hasWorker = notifiedIds.includes(WORKER_ID);
    const hasAdmin = notifiedIds.includes(MUNICIPAL_ADMIN_ID);
    const actorExcluded = !notifiedIds.includes(CITIZEN_A_ID);
    record(
      8,
      'transitionStatus(escalated) dispatches issue_escalated to worker and authority',
      hasWorker && hasAdmin && actorExcluded,
      `Notified: [${notifiedIds.join(', ')}], Actor ${CITIZEN_A_ID} excluded: ${actorExcluded}`
    );
  } catch (err) {
    record(8, 'transitionStatus(escalated) dispatches issue_escalated to worker and authority', false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // Group 3: Assignment Lifecycle (Tests 9 - 12)
  // ----------------------------------------------------------------------------
  console.log('\n--- GROUP 3: ASSIGNMENT LIFECYCLE ---');

  let assignIssueId = '';
  try {
    // Create fresh issue without assigned worker
    state.currentUserId = CITIZEN_A_ID;
    const freshIssue = await IssueService.createIssue(
      {
        description: 'Streetlight pole tilted dangerously after storm',
        category: 'street_light',
        address: '45 Cross Road',
        municipality_id: MUNICIPALITY_ID,
      },
      client
    );
    assignIssueId = freshIssue.id;

    // Test 9: assignWorker() initial assignment dispatches issue_assigned
    state.currentUserId = MUNICIPAL_ADMIN_ID;
    await WorkerService.assignWorker(
      {
        issueId: assignIssueId,
        workerId: WORKER_ID,
        notes: 'Urgent task - inspect electrical cables',
      },
      client
    );

    const assignNotifs = Object.values(state.notifications).filter(n => n.issue_id === assignIssueId && n.type === 'issue_assigned');
    const assignNotif = assignNotifs[0];
    record(
      9,
      'assignWorker() initial assignment dispatches issue_assigned',
      Boolean(assignNotif),
      assignNotif ? `Dispatched issue_assigned ID: ${assignNotif.id}` : 'No issue_assigned notification found'
    );

    // Test 11: Assigned worker notified
    const assignedWorkerNotified = assignNotifs.some(n => n.user_id === WORKER_ID);
    record(
      11,
      'Assigned worker is delivered notification on assignment',
      assignedWorkerNotified,
      `Worker ${WORKER_ID} received notification: ${assignedWorkerNotified}`
    );

    // Test 12: Assigner is excluded from notification recipients
    const assignerExcluded = !assignNotifs.some(n => n.user_id === MUNICIPAL_ADMIN_ID);
    record(
      12,
      'Assigner is strictly excluded from notification recipients',
      assignerExcluded,
      `Assigner ${MUNICIPAL_ADMIN_ID} in recipients: ${!assignerExcluded}`
    );

    // Test 10: assignWorker() reassignment dispatches issue_reassigned
    state.currentUserId = MUNICIPAL_ADMIN_ID;
    await WorkerService.assignWorker(
      {
        issueId: assignIssueId,
        workerId: WORKER_2_ID,
        notes: 'Reassigned due to Worker 1 equipment failure',
      },
      client
    );

    const reassignNotifs = Object.values(state.notifications).filter(n => n.issue_id === assignIssueId && n.type === 'issue_reassigned');
    const reassignNotif = reassignNotifs[0];
    const newWorkerNotified = reassignNotifs.some(n => n.user_id === WORKER_2_ID);
    record(
      10,
      'assignWorker() reassignment dispatches issue_reassigned',
      Boolean(reassignNotif && newWorkerNotified),
      reassignNotif ? `Dispatched issue_reassigned to new worker ${WORKER_2_ID}` : 'Failed'
    );
  } catch (err) {
    record(9, 'assignWorker() initial assignment dispatches issue_assigned', false, (err as Error).message);
    record(10, 'assignWorker() reassignment dispatches issue_reassigned', false, (err as Error).message);
    record(11, 'Assigned worker is delivered notification on assignment', false, (err as Error).message);
    record(12, 'Assigner is strictly excluded from notification recipients', false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // Group 4: Engagement Lifecycle (Tests 13 - 16)
  // ----------------------------------------------------------------------------
  console.log('\n--- GROUP 4: ENGAGEMENT LIFECYCLE ---');

  // Test 13: submitFeedback() dispatches feedback_received
  try {
    // Resolve assignIssue first so feedback can be submitted
    state.issues[assignIssueId].status = 'resolved';
    state.currentUserId = CITIZEN_A_ID; // Reporter
    await IssueService.submitFeedback(
      {
        issueId: assignIssueId,
        feedback: 'satisfied',
        comment: 'Great work fixing the tilted pole quickly!',
      },
      client
    );

    const feedbackNotifs = Object.values(state.notifications).filter(n => n.issue_id === assignIssueId && n.type === 'feedback_received');
    const notifiedIds = feedbackNotifs.map(n => n.user_id);
    const workerGotIt = notifiedIds.includes(WORKER_2_ID);
    const adminGotIt = notifiedIds.includes(MUNICIPAL_ADMIN_ID);
    const reporterExcluded = !notifiedIds.includes(CITIZEN_A_ID);
    record(
      13,
      'submitFeedback() dispatches feedback_received to authorities & worker',
      Boolean(feedbackNotifs.length > 0 && workerGotIt && adminGotIt && reporterExcluded),
      `Recipients: [${notifiedIds.join(', ')}], Reporter excluded: ${reporterExcluded}`
    );
  } catch (err) {
    record(13, 'submitFeedback() dispatches feedback_received to authorities & worker', false, (err as Error).message);
  }

  // Test 14: upvoteIssue() dispatches issue_upvoted
  try {
    state.currentUserId = CITIZEN_B_ID; // Third party citizen
    await IssueService.upvoteIssue(testIssueId, client);

    const upvoteNotifs = Object.values(state.notifications).filter(n => n.issue_id === testIssueId && n.type === 'issue_upvoted');
    const reporterNotified = upvoteNotifs.some(n => n.user_id === CITIZEN_A_ID);
    const upvoterExcluded = !upvoteNotifs.some(n => n.user_id === CITIZEN_B_ID);
    record(
      14,
      'upvoteIssue() dispatches issue_upvoted to reporter',
      Boolean(upvoteNotifs.length > 0 && reporterNotified && upvoterExcluded),
      `Reporter ${CITIZEN_A_ID} notified: ${reporterNotified}, Upvoter ${CITIZEN_B_ID} excluded: ${upvoterExcluded}`
    );
  } catch (err) {
    record(14, 'upvoteIssue() dispatches issue_upvoted to reporter', false, (err as Error).message);
  }

  // Test 15: addComment() dispatches issue_commented
  try {
    state.currentUserId = CITIZEN_B_ID;
    state.currentUserMetadata = { full_name: 'Citizen Beta' };
    await IssueService.addComment(testIssueId, 'I also saw this dump yesterday, smells terrible!', client);

    const commentNotifs = Object.values(state.notifications).filter(n => n.issue_id === testIssueId && n.type === 'issue_commented');
    const notifiedIds = commentNotifs.map(n => n.user_id);
    const reporterNotified = notifiedIds.includes(CITIZEN_A_ID);
    const workerNotified = notifiedIds.includes(WORKER_ID);
    const commenterExcluded = !notifiedIds.includes(CITIZEN_B_ID);
    record(
      15,
      'addComment() dispatches issue_commented to reporter & assigned worker',
      reporterNotified && workerNotified && commenterExcluded,
      `Notified: [${notifiedIds.join(', ')}], Commenter excluded: ${commenterExcluded}`
    );
  } catch (err) {
    record(15, 'addComment() dispatches issue_commented to reporter & assigned worker', false, (err as Error).message);
  }

  // Test 16: Upvote by issue reporter does NOT notify self
  try {
    // Create new issue by Citizen B, then Citizen B upvotes own issue
    state.currentUserId = CITIZEN_B_ID;
    const ownIssue = await IssueService.createIssue(
      {
        description: 'Water logging near local market square',
        category: 'stagnant_water',
        address: 'Market Square Corner',
        municipality_id: MUNICIPALITY_ID,
      },
      client
    );

    await IssueService.upvoteIssue(ownIssue.id, client);
    const postUpvoteNotifs = Object.values(state.notifications).filter(n => n.issue_id === ownIssue.id && n.type === 'issue_upvoted');

    record(
      16,
      'Upvote by issue reporter does NOT notify self (actor exclusion)',
      postUpvoteNotifs.length === 0,
      `Upvote notifications created for author upvote: ${postUpvoteNotifs.length}`
    );
  } catch (err) {
    record(16, 'Upvote by issue reporter does NOT notify self (actor exclusion)', false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // Group 5: Failure & Security Boundaries (Tests 17 - 20)
  // ----------------------------------------------------------------------------
  console.log('\n--- GROUP 5: FAILURE & SECURITY BOUNDARIES ---');

  // Test 17: Notification failure does NOT abort createIssue
  try {
    state.failRpcNotification = true;
    state.currentUserId = CITIZEN_A_ID;
    const resilientIssue = await IssueService.createIssue(
      {
        description: 'Street light blinking rapidly at intersection',
        category: 'street_light',
        address: 'Central Intersection',
        municipality_id: MUNICIPALITY_ID,
      },
      client
    );

    record(
      17,
      'Notification failure does NOT abort createIssue() (failure isolation)',
      Boolean(resilientIssue && resilientIssue.id),
      `Issue successfully created with ID: ${resilientIssue.id} despite notification failure`
    );
  } catch (err) {
    record(17, 'Notification failure does NOT abort createIssue() (failure isolation)', false, (err as Error).message);
  } finally {
    state.failRpcNotification = false;
  }

  // Test 18: Notification failure does NOT abort transitionStatus
  try {
    state.failRpcNotification = false;
    state.currentUserId = CITIZEN_A_ID;
    const statusTestIssue = await IssueService.createIssue(
      {
        description: 'Street light bracket broken hanging on wire',
        category: 'street_light',
        address: 'Maple Avenue',
        municipality_id: MUNICIPALITY_ID,
      },
      client
    );

    // Now enable notification failure and transition status
    state.failRpcNotification = true;
    state.currentUserId = MUNICIPAL_ADMIN_ID;
    const updatedStatus = await IssueService.transitionStatus(
      {
        issueId: statusTestIssue.id,
        status: 'verified',
        notes: 'Inspection confirmed bracket damage',
      },
      client
    );

    record(
      18,
      'Notification failure does NOT abort transitionStatus() (failure isolation)',
      updatedStatus.status === 'verified',
      `Issue status successfully advanced to: ${updatedStatus.status} despite notification failure`
    );
  } catch (err) {
    record(18, 'Notification failure does NOT abort transitionStatus() (failure isolation)', false, (err as Error).message);
  } finally {
    state.failRpcNotification = false;
  }

  // Test 19: No notifications dispatched for rejected invalid transitions
  try {
    const notifsBeforeCount = Object.keys(state.notifications).length;
    let transitionRejected = false;

    // Citizen A tries to illegally resolve their own issue
    state.currentUserId = CITIZEN_A_ID;
    try {
      await IssueService.transitionStatus(
        {
          issueId: testIssueId,
          status: 'resolved',
          notes: 'Citizen trying to resolve own issue directly',
        },
        client
      );
    } catch (transErr) {
      if (transErr instanceof IssueValidationError) {
        transitionRejected = true;
      }
    }

    const notifsAfterCount = Object.keys(state.notifications).length;
    const noNewNotifs = notifsAfterCount === notifsBeforeCount;

    record(
      19,
      'No notifications dispatched for rejected invalid transitions',
      transitionRejected && noNewNotifs,
      `Transition rejected: ${transitionRejected}, New notifications: ${notifsAfterCount - notifsBeforeCount}`
    );
  } catch (err) {
    record(19, 'No notifications dispatched for rejected invalid transitions', false, (err as Error).message);
  }

  // Test 20: No duplicate notifications generated on repeated reads/queries
  try {
    state.currentUserId = CITIZEN_A_ID;
    const countBefore = Object.keys(state.notifications).length;

    // Call getNotifications and getUnreadCount multiple times
    await NotificationService.getNotifications({ limit: 10 }, client);
    await NotificationService.getNotifications({ limit: 10 }, client);
    await NotificationService.getUnreadCount(undefined, client);
    await NotificationService.getUnreadCount(undefined, client);

    const countAfter = Object.keys(state.notifications).length;
    record(
      20,
      'No duplicate notifications generated on repeated reads/queries',
      countBefore === countAfter,
      `Notifications before reads: ${countBefore}, after reads: ${countAfter}`
    );
  } catch (err) {
    record(20, 'No duplicate notifications generated on repeated reads/queries', false, (err as Error).message);
  }

  // ----------------------------------------------------------------------------
  // Summary & Assertion Verification
  // ----------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('TEST SUMMARY');
  console.log('===============================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`TOTAL TESTS : ${results.length}`);
  console.log(`PASSED      : ${passedCount}`);
  console.log(`FAILED      : ${failedCount}`);

  if (failedCount > 0) {
    console.error(`\n❌ FAILED TESTS (${failedCount}):`);
    results.filter(r => !r.passed).forEach(r => console.error(`  - Test ${r.step}: ${r.name} -> ${r.details}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 20 CIVIC LIFECYCLE NOTIFICATION TESTS PASSED SUCCESSFULLY!');
  }
}

runLifecycleTests().catch(err => {
  console.error('Fatal error running lifecycle test suite:', err);
  process.exit(1);
});
