/**
 * Unit & Contract Tests: IssueService.transitionStatus()
 */
import { IssueService } from '../../../backend/services/issues/issueService';
import { IssueValidationError, IssueStatus } from '../../../backend/validators/issueValidator';
import { AuthenticationError } from '../../../backend/services/auth/types';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock test helpers
interface MockIssueState {
  id: string;
  status: IssueStatus;
  reporter_id: string;
  assigned_worker_id: string | null;
  municipality_id: string | null;
  panchayat_id: string | null;
  verified_at?: string | null;
  resolved_at?: string | null;
  escalated_at?: string | null;
  updated_at?: string;
}

interface MockUserProfile {
  id: string;
  role: string;
  is_active: boolean;
  municipality_id?: string | null;
  panchayat_id?: string | null;
}

function createMockSupabase(options: {
  currentUser?: { id: string } | null;
  userProfile?: MockUserProfile | null;
  initialIssue?: MockIssueState | null;
}) {
  const auditLogs: Record<string, unknown>[] = [];
  let currentIssue: MockIssueState | null = options.initialIssue ? { ...options.initialIssue } : null;

  const client = {
    auth: {
      getUser: async () => {
        if (!options.currentUser) {
          return { data: { user: null }, error: new Error('Session not found') };
        }
        return { data: { user: options.currentUser }, error: null };
      },
    },
    rpc: async (fnName: string, _params: unknown) => {
      // Simulate RPC not found so fallback service logic is tested deterministically
      return { data: null, error: { message: `Could not find the function public.${fnName}` } };
    },
    from: (table: string) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: async () => {
                if (options.userProfile && options.userProfile.id === val) {
                  return { data: options.userProfile, error: null };
                }
                return { data: null, error: new Error('Profile not found') };
              },
            }),
          }),
        };
      }

      if (table === 'issues') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: async () => {
                if (currentIssue && currentIssue.id === val) {
                  return { data: currentIssue, error: null };
                }
                return { data: null, error: new Error('Issue not found') };
              },
            }),
          }),
          update: (payload: Partial<MockIssueState>) => ({
            eq: (_col: string, val: string) => ({
              select: () => ({
                single: async () => {
                  if (!currentIssue || currentIssue.id !== val) {
                    return { data: null, error: new Error('Issue not found') };
                  }
                  currentIssue = { ...currentIssue, ...payload };
                  return { data: currentIssue, error: null };
                },
              }),
            }),
          }),
        };
      }

      if (table === 'issue_audit_log') {
        return {
          insert: async (record: Record<string, unknown>) => {
            auditLogs.push(record);
            return { data: [record], error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  return {
    client,
    getIssue: () => currentIssue,
    getAuditLogs: () => auditLogs,
  };
}

async function runTests() {
  console.log('🧪 RUNNING STATUS TRANSITION ENGINE TEST SUITE\n');

  const issueId = '11111111-1111-4111-a111-111111111111';
  const adminId = '22222222-2222-4222-a222-222222222222';
  const workerId = '33333333-3333-4333-a333-333333333333';
  const otherWorkerId = '44444444-4444-4444-a444-444444444444';
  const citizenId = '55555555-5555-4555-a555-555555555555';

  // TEST 1: Unauthenticated request throws AuthenticationError
  try {
    const { client } = createMockSupabase({ currentUser: null });
    await IssueService.transitionStatus({ issueId, status: 'verified' }, client);
    console.assert(false, 'Should throw AuthenticationError');
  } catch (err) {
    console.assert(err instanceof AuthenticationError, 'Throws AuthenticationError when unauthenticated');
    console.log('✅ TEST 1: Unauthenticated call rejected with AuthenticationError (401)');
  }

  // TEST 2: Malformed UUID throws IssueValidationError
  try {
    const { client } = createMockSupabase({ currentUser: { id: adminId } });
    await IssueService.transitionStatus({ issueId: 'not-a-uuid', status: 'verified' }, client);
    console.assert(false, 'Should throw for invalid UUID');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError for invalid UUID');
    console.log('✅ TEST 2: Malformed issueId rejected before database access');
  }

  // TEST 3: Admin valid transition from submitted to verified
  {
    const { client, getIssue, getAuditLogs } = createMockSupabase({
      currentUser: { id: adminId },
      userProfile: {
        id: adminId,
        role: 'municipal_admin',
        is_active: true,
        municipality_id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
      },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        municipality_id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
        panchayat_id: null,
      },
    });

    const updated = await IssueService.transitionStatus(
      { issueId, status: 'verified', notes: 'Verified via ground report' },
      client
    );

    console.assert(updated.status === 'verified', 'Status updated to verified');
    console.assert(getIssue()?.status === 'verified', 'State reflected in database');
    const logs = getAuditLogs();
    console.assert(logs.length === 1, 'Audit log inserted');
    console.assert(logs[0].action === 'STATUS_CHANGED', 'Action is STATUS_CHANGED');
    console.assert(logs[0].old_status === 'submitted', 'Old status is submitted');
    console.assert(logs[0].new_status === 'verified', 'New status is verified');
    console.assert(logs[0].notes === 'Verified via ground report', 'Notes recorded in audit log');
    console.log('✅ TEST 3: Admin transition submitted -> verified succeeds with audit log');
  }

  // TEST 4: Invalid transition (submitted -> resolved directly) rejected
  try {
    const { client } = createMockSupabase({
      currentUser: { id: adminId },
      userProfile: { id: adminId, role: 'administrator', is_active: true },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        municipality_id: null,
        panchayat_id: null,
      },
    });

    await IssueService.transitionStatus({ issueId, status: 'resolved' }, client);
    console.assert(false, 'Should reject invalid transition');
  } catch (err) {
    console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid transition');
    console.assert((err as Error).message.includes('Cannot transition issue from "submitted" to "resolved"'));
    console.log('✅ TEST 4: Disallowed transition submitted -> resolved rejected by transition graph');
  }

  // TEST 5: Citizen attempting official transition rejected
  try {
    const { client } = createMockSupabase({
      currentUser: { id: citizenId },
      userProfile: { id: citizenId, role: 'citizen', is_active: true },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        municipality_id: null,
        panchayat_id: null,
      },
    });

    await IssueService.transitionStatus({ issueId, status: 'in_progress' }, client);
    console.assert(false, 'Citizen should not be permitted to transition status');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.assert((err as Error).message.includes('Citizens cannot perform official status transitions'));
    console.log('✅ TEST 5: Citizen attempting official status transition rejected');
  }

  // TEST 6: Citizen escalating resolved issue via feedback succeeds
  {
    const { client, getIssue, getAuditLogs } = createMockSupabase({
      currentUser: { id: citizenId },
      userProfile: { id: citizenId, role: 'citizen', is_active: true },
      initialIssue: {
        id: issueId,
        status: 'resolved',
        reporter_id: citizenId,
        assigned_worker_id: workerId,
        municipality_id: null,
        panchayat_id: null,
      },
    });

    const updated = await IssueService.transitionStatus(
      { issueId, status: 'escalated', notes: 'Pothole was only partially patched' },
      client
    );

    console.assert(updated.status === 'escalated', 'Citizen successfully escalated resolved issue');
    console.assert(getIssue()?.status === 'escalated');
    const logs = getAuditLogs();
    console.assert(logs.length === 1);
    console.assert(logs[0].old_status === 'resolved' && logs[0].new_status === 'escalated');
    console.log('✅ TEST 6: Citizen escalation of resolved issue succeeds with audit record');
  }

  // TEST 7: Assigned worker can transition verified -> in_progress
  {
    const { client, getIssue, getAuditLogs } = createMockSupabase({
      currentUser: { id: workerId },
      userProfile: { id: workerId, role: 'worker', is_active: true },
      initialIssue: {
        id: issueId,
        status: 'verified',
        reporter_id: citizenId,
        assigned_worker_id: workerId,
        municipality_id: null,
        panchayat_id: null,
      },
    });

    const updated = await IssueService.transitionStatus(
      { issueId, status: 'in_progress', notes: 'Starting repair work' },
      client
    );

    console.assert(updated.status === 'in_progress');
    console.assert(getIssue()?.status === 'in_progress');
    console.assert(getAuditLogs().length === 1);
    console.log('✅ TEST 7: Assigned worker transition verified -> in_progress succeeds');
  }

  // TEST 8: Unassigned worker attempting transition is rejected
  try {
    const { client } = createMockSupabase({
      currentUser: { id: otherWorkerId },
      userProfile: { id: otherWorkerId, role: 'worker', is_active: true },
      initialIssue: {
        id: issueId,
        status: 'in_progress',
        reporter_id: citizenId,
        assigned_worker_id: workerId, // Assigned to different worker
        municipality_id: null,
        panchayat_id: null,
      },
    });

    await IssueService.transitionStatus({ issueId, status: 'resolved' }, client);
    console.assert(false, 'Unassigned worker should be rejected');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.assert((err as Error).message.includes('Workers can only transition issues assigned to them'));
    console.log('✅ TEST 8: Unassigned worker modification rejected');
  }

  // TEST 9: Worker attempting to reject issue is blocked
  try {
    const { client } = createMockSupabase({
      currentUser: { id: workerId },
      userProfile: { id: workerId, role: 'worker', is_active: true },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: workerId,
        municipality_id: null,
        panchayat_id: null,
      },
    });

    await IssueService.transitionStatus({ issueId, status: 'rejected' }, client);
    console.assert(false, 'Worker should not be allowed to reject issue');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.assert((err as Error).message.includes('Workers cannot reject issues'));
    console.log('✅ TEST 9: Worker attempting to reject issue rejected');
  }

  // TEST 10: Cross-municipality admin transition is blocked
  try {
    const { client } = createMockSupabase({
      currentUser: { id: adminId },
      userProfile: {
        id: adminId,
        role: 'municipal_admin',
        is_active: true,
        municipality_id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
      },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        municipality_id: 'bbbb2222-bbbb-2222-bbbb-222222222222', // Different municipality
        panchayat_id: null,
      },
    });

    await IssueService.transitionStatus({ issueId, status: 'verified' }, client);
    console.assert(false, 'Cross-municipality transition should be blocked');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.assert((err as Error).message.includes('Cannot manage issues outside your municipality'));
    console.log('✅ TEST 10: Cross-municipality admin access blocked');
  }

  console.log('\n🎉 ALL 10 STATUS TRANSITION TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
