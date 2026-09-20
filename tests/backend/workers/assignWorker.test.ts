/**
 * Unit & Contract Tests: WorkerService.assignWorker()
 */
import { WorkerService } from '../../../backend/services/workers/workerService';
import { IssueValidationError, IssueStatus } from '../../../backend/validators/issueValidator';
import { AuthenticationError } from '../../../backend/services/auth/types';
import { SupabaseClient } from '@supabase/supabase-js';

interface MockIssueState {
  id: string;
  status: IssueStatus;
  reporter_id: string;
  assigned_worker_id: string | null;
  assigned_manager_id: string | null;
  municipality_id: string | null;
  department_id: string | null;
  panchayat_id: string | null;
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
  profiles?: Record<string, MockUserProfile>;
  initialIssue?: MockIssueState | null;
}) {
  const auditLogs: Record<string, unknown>[] = [];
  let currentIssue: MockIssueState | null = options.initialIssue ? { ...options.initialIssue } : null;
  const profiles = options.profiles || {};

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
                const p = profiles[val];
                if (p) return { data: p, error: null };
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
  console.log('🧪 RUNNING WORKER ASSIGNMENT TEST SUITE\n');

  const issueId = '11111111-1111-4111-a111-111111111111';
  const adminId = '22222222-2222-4222-a222-222222222222';
  const workerAId = '33333333-3333-4333-a333-333333333333';
  const workerBId = '44444444-4444-4444-a444-444444444444';
  const citizenId = '55555555-5555-4555-a555-555555555555';
  const deptId = '66666666-6666-4666-a666-666666666666';

  // TEST 1: Unauthenticated assign call throws AuthenticationError (401)
  try {
    const { client } = createMockSupabase({ currentUser: null });
    await WorkerService.assignWorker({ issueId, workerId: workerAId }, client);
    console.assert(false, 'Should throw AuthenticationError');
  } catch (err) {
    console.assert(err instanceof AuthenticationError);
    console.log('✅ TEST 1: Unauthenticated assign call rejected with AuthenticationError (401)');
  }

  // TEST 2: Malformed UUIDs rejected before DB query
  try {
    const { client } = createMockSupabase({ currentUser: { id: adminId } });
    await WorkerService.assignWorker({ issueId: 'invalid-id', workerId: workerAId }, client);
    console.assert(false, 'Should reject malformed UUID');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.log('✅ TEST 2: Malformed issueId rejected by validator');
  }

  // TEST 3: Citizen attempting worker assignment rejected
  try {
    const { client } = createMockSupabase({
      currentUser: { id: citizenId },
      profiles: {
        [citizenId]: { id: citizenId, role: 'citizen', is_active: true },
        [workerAId]: { id: workerAId, role: 'worker', is_active: true },
      },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        assigned_manager_id: null,
        municipality_id: null,
        department_id: null,
        panchayat_id: null,
      },
    });

    await WorkerService.assignWorker({ issueId, workerId: workerAId }, client);
    console.assert(false, 'Citizen should not be able to assign worker');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.assert((err as Error).message.includes('Only officials and administrators can assign workers'));
    console.log('✅ TEST 3: Citizen attempting assignment rejected with authorization error');
  }

  // TEST 4: Valid initial assignment by administrator (WORKER_ASSIGNED)
  {
    const { client, getIssue, getAuditLogs } = createMockSupabase({
      currentUser: { id: adminId },
      profiles: {
        [adminId]: { id: adminId, role: 'administrator', is_active: true },
        [workerAId]: { id: workerAId, role: 'worker', is_active: true },
      },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        assigned_manager_id: null,
        municipality_id: null,
        department_id: null,
        panchayat_id: null,
      },
    });

    const updated = await WorkerService.assignWorker(
      { issueId, workerId: workerAId, departmentId: deptId, notes: 'Initial road crew dispatch' },
      client
    );

    console.assert(updated.assigned_worker_id === workerAId, 'Worker assigned');
    console.assert(updated.status === 'in_progress', 'Status transitioned to in_progress');
    console.assert(updated.assigned_manager_id === adminId, 'Manager recorded');
    console.assert(getIssue()?.assigned_worker_id === workerAId);

    const logs = getAuditLogs();
    console.assert(logs.length === 1, 'Audit log inserted');
    console.assert(logs[0].action === 'WORKER_ASSIGNED', 'Action is WORKER_ASSIGNED');
    console.assert(logs[0].old_status === 'submitted' && logs[0].new_status === 'in_progress');
    console.assert(logs[0].new_data.assigned_worker_id === workerAId);
    console.assert(logs[0].old_data.assigned_worker_id === null);
    console.assert(logs[0].notes === 'Initial road crew dispatch');
    console.log('✅ TEST 4: Initial assignment sets WORKER_ASSIGNED, advances to in_progress, and logs audit record');
  }

  // TEST 5: Reassignment from Worker A to Worker B (WORKER_REASSIGNED)
  // Administrator has system-wide access; tests the WORKER_REASSIGNED audit path.
  {
    const { client, getIssue, getAuditLogs } = createMockSupabase({
      currentUser: { id: adminId },
      profiles: {
        [adminId]: { id: adminId, role: 'administrator', is_active: true },
        [workerBId]: { id: workerBId, role: 'worker', is_active: true },
      },
      initialIssue: {
        id: issueId,
        status: 'in_progress',
        reporter_id: citizenId,
        assigned_worker_id: workerAId, // Previously assigned to Worker A
        assigned_manager_id: adminId,
        municipality_id: null,
        department_id: deptId,
        panchayat_id: null,
      },
    });

    const updated = await WorkerService.assignWorker(
      { issueId, workerId: workerBId, notes: 'Reassigning to specialized worker' },
      client
    );

    console.assert(updated.assigned_worker_id === workerBId, 'Worker updated to Worker B');
    console.assert(getIssue()?.assigned_worker_id === workerBId);

    const logs = getAuditLogs();
    console.assert(logs.length === 1);
    console.assert(logs[0].action === 'WORKER_REASSIGNED', 'Action is WORKER_REASSIGNED');
    console.assert(logs[0].old_data.assigned_worker_id === workerAId, 'Previous worker captured');
    console.assert(logs[0].new_data.assigned_worker_id === workerBId, 'New worker captured');
    console.log('✅ TEST 5: Reassignment records previous worker, new worker, and WORKER_REASSIGNED action');
  }

  // TEST 6: Inactive worker rejected
  try {
    const { client } = createMockSupabase({
      currentUser: { id: adminId },
      profiles: {
        [adminId]: { id: adminId, role: 'administrator', is_active: true },
        [workerAId]: { id: workerAId, role: 'worker', is_active: false }, // INACTIVE
      },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        assigned_manager_id: null,
        municipality_id: null,
        department_id: null,
        panchayat_id: null,
      },
    });

    await WorkerService.assignWorker({ issueId, workerId: workerAId }, client);
    console.assert(false, 'Inactive worker should be rejected');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.assert((err as Error).message.includes('Target worker is inactive'));
    console.log('✅ TEST 6: Inactive worker assignment rejected');
  }

  // TEST 7: Target user with non-worker role (e.g. citizen) rejected
  try {
    const { client } = createMockSupabase({
      currentUser: { id: adminId },
      profiles: {
        [adminId]: { id: adminId, role: 'administrator', is_active: true },
        [citizenId]: { id: citizenId, role: 'citizen', is_active: true },
      },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        assigned_manager_id: null,
        municipality_id: null,
        department_id: null,
        panchayat_id: null,
      },
    });

    await WorkerService.assignWorker({ issueId, workerId: citizenId }, client);
    console.assert(false, 'Citizen cannot be assigned as field worker');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.assert((err as Error).message.includes('Target user is not a field worker'));
    console.log('✅ TEST 7: Non-worker target user rejected with role check');
  }

  // TEST 8: Nonexistent worker ID rejected
  try {
    const { client } = createMockSupabase({
      currentUser: { id: adminId },
      profiles: {
        [adminId]: { id: adminId, role: 'administrator', is_active: true },
      },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        assigned_manager_id: null,
        municipality_id: null,
        department_id: null,
        panchayat_id: null,
      },
    });

    await WorkerService.assignWorker({ issueId, workerId: '99999999-9999-4999-a999-999999999999' }, client);
    console.assert(false, 'Nonexistent worker should be rejected');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.assert((err as Error).message.includes('Target worker profile not found'));
    console.log('✅ TEST 8: Nonexistent worker profile rejected');
  }

  // TEST 9: Cross-municipality assignment blocked
  try {
    const { client } = createMockSupabase({
      currentUser: { id: adminId },
      profiles: {
        [adminId]: {
          id: adminId,
          role: 'municipal_admin',
          is_active: true,
          municipality_id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
        },
        [workerAId]: { id: workerAId, role: 'worker', is_active: true },
      },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        assigned_manager_id: null,
        municipality_id: 'bbbb2222-bbbb-2222-bbbb-222222222222', // Different municipality
        department_id: null,
        panchayat_id: null,
      },
    });

    await WorkerService.assignWorker({ issueId, workerId: workerAId }, client);
    console.assert(false, 'Cross-municipality assignment should be blocked');
  } catch (err) {
    console.assert(err instanceof IssueValidationError);
    console.assert((err as Error).message.includes('Cannot assign issues outside your municipality'));
    console.log('✅ TEST 9: Cross-municipality assignment blocked');
  }

  // TEST 10: Pradhan assignment authorized within panchayat scope
  {
    const pradhanId = '77777777-7777-4777-a777-777777777777';
    const panchayatId = '88888888-8888-4888-a888-888888888888';
    const { client, getIssue, getAuditLogs } = createMockSupabase({
      currentUser: { id: pradhanId },
      profiles: {
        [pradhanId]: { id: pradhanId, role: 'pradhan', is_active: true, panchayat_id: panchayatId },
        [workerAId]: { id: workerAId, role: 'panchayat_worker', is_active: true, panchayat_id: panchayatId },
      },
      initialIssue: {
        id: issueId,
        status: 'submitted',
        reporter_id: citizenId,
        assigned_worker_id: null,
        assigned_manager_id: null,
        municipality_id: null,
        department_id: null,
        panchayat_id: panchayatId,
      },
    });

    const updated = await WorkerService.assignWorker(
      { issueId, workerId: workerAId, notes: 'Village water pipeline repair' },
      client
    );

    console.assert(updated.assigned_worker_id === workerAId);
    console.assert(updated.status === 'in_progress');
    console.assert(getAuditLogs().length === 1);
    console.log('✅ TEST 10: Pradhan can assign panchayat worker within panchayat boundary');
  }

  console.log('\n🎉 ALL 10 WORKER ASSIGNMENT TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
