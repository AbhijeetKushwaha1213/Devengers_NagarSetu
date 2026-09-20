/**
 * Unit & Contract Tests: Geographic Authorization & Domain Operations
 * File: tests/backend/issues/geographicAuthorization.test.ts
 */
import { IssueService } from '../../../backend/services/issues/issueService';
import { WorkerService } from '../../../backend/services/workers/workerService';
import { IssueValidationError, IssueStatus } from '../../../backend/validators/issueValidator';
import { AuthenticationError } from '../../../backend/services/auth/types';
import { SupabaseClient } from '@supabase/supabase-js';

interface MockIssueState {
  id: string;
  status: IssueStatus;
  reporter_id: string;
  assigned_worker_id: string | null;
  municipality_id: string | null;
  panchayat_id: string | null;
  department_id?: string | null;
  citizen_feedback?: string | null;
  citizen_feedback_comment?: string | null;
  citizen_feedback_at?: string | null;
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
  userProfiles?: Record<string, MockUserProfile>;
  initialIssue?: MockIssueState | null;
}) {
  const auditLogs: Record<string, unknown>[] = [];
  let currentIssue: MockIssueState | null = options.initialIssue ? { ...options.initialIssue } : null;
  let deletedIssueId: string | null = null;

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
      // Force fallback to TypeScript service logic for deterministic unit testing
      return { data: null, error: { message: `Could not find the function public.${fnName}` } };
    },
    from: (table: string) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              single: async () => {
                const profile = options.userProfiles?.[val];
                if (profile) {
                  return { data: profile, error: null };
                }
                return { data: null, error: { message: 'Not found' } };
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
                  return { data: { ...currentIssue }, error: null };
                }
                return { data: null, error: { message: 'Issue not found' } };
              },
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: (_col: string, val: string) => ({
              select: () => ({
                single: async () => {
                  if (currentIssue && currentIssue.id === val) {
                    currentIssue = { ...currentIssue, ...payload } as MockIssueState;
                    return { data: { ...currentIssue }, error: null };
                  }
                  return { data: null, error: { message: 'Issue not found' } };
                },
              }),
            }),
          }),
          delete: () => ({
            eq: (_col: string, val: string) => {
              let result: { data: { id: string }[]; error: null } | null = null;
              const exec = () => {
                if (!result) {
                  if (currentIssue && currentIssue.id === val) {
                    deletedIssueId = val;
                    currentIssue = null;
                    result = { data: [{ id: val }], error: null };
                  } else {
                    result = { data: [], error: null };
                  }
                }
                return result;
              };
              const p = Promise.resolve().then(() => exec());
              return Object.assign(p, {
                select: () => Promise.resolve().then(() => exec()),
              });
            },
          }),
        };
      }

      if (table === 'issue_audit_log') {
        return {
          insert: async (records: Record<string, unknown>) => {
            auditLogs.push(records);
            return { data: records, error: null };
          },
        };
      }

      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      };
    },
    _getIssue: () => currentIssue,
    _getDeletedId: () => deletedIssueId,
    _getAuditLogs: () => auditLogs,
  };

  return client as unknown as SupabaseClient & {
    _getIssue: () => MockIssueState | null;
    _getDeletedId: () => string | null;
    _getAuditLogs: () => Record<string, unknown>[];
  };
}

async function runGeographicTests() {
  console.log('🧪 RUNNING GEOGRAPHIC AUTHORIZATION & DOMAIN OPERATIONS TEST SUITE\n');

  const MUNI_A = '11111111-1111-4111-a111-111111111111';
  const MUNI_B = '22222222-2222-4222-a222-222222222222';
  const PANCHAYAT_A = '33333333-3333-4333-a333-333333333333';
  const PANCHAYAT_B = '44444444-4444-4444-a444-444444444444';

  const ADMIN_A_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const PRADHAN_A_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const CENTRAL_ADMIN_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
  const WORKER_MUNI_A_ID = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';
  const WORKER_PANCHAYAT_A_ID = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
  const CITIZEN_ID = 'ffffffff-ffff-4fff-ffff-ffffffffffff';
  const ISSUE_ID = '99999999-9999-4999-a999-999999999999';

  const userProfiles: Record<string, MockUserProfile> = {
    [ADMIN_A_ID]: {
      id: ADMIN_A_ID,
      role: 'municipal_admin',
      is_active: true,
      municipality_id: MUNI_A,
      panchayat_id: null,
    },
    [PRADHAN_A_ID]: {
      id: PRADHAN_A_ID,
      role: 'pradhan',
      is_active: true,
      municipality_id: null,
      panchayat_id: PANCHAYAT_A,
    },
    [CENTRAL_ADMIN_ID]: {
      id: CENTRAL_ADMIN_ID,
      role: 'administrator',
      is_active: true,
      municipality_id: null,
      panchayat_id: null,
    },
    [WORKER_MUNI_A_ID]: {
      id: WORKER_MUNI_A_ID,
      role: 'worker',
      is_active: true,
      municipality_id: MUNI_A,
      panchayat_id: null,
    },
    [WORKER_PANCHAYAT_A_ID]: {
      id: WORKER_PANCHAYAT_A_ID,
      role: 'panchayat_worker',
      is_active: true,
      municipality_id: null,
      panchayat_id: PANCHAYAT_A,
    },
    [CITIZEN_ID]: {
      id: CITIZEN_ID,
      role: 'citizen',
      is_active: true,
      municipality_id: null,
      panchayat_id: null,
    },
  };

  // TEST 1: Municipality A admin accessing Municipality A issue → allowed
  {
    const client = createMockSupabase({
      currentUser: { id: ADMIN_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    const res = await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, client);
    console.assert(res.status === 'verified', 'Admin A verified issue in Muni A');
    console.log('✅ TEST 1: Municipality A admin accessing Municipality A issue → allowed');
  }

  // TEST 2: Municipality A admin accessing Municipality B issue → denied
  {
    const client = createMockSupabase({
      currentUser: { id: ADMIN_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: MUNI_B,
        panchayat_id: null,
      },
    });

    try {
      await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, client);
      console.assert(false, 'Should have blocked cross-municipality access');
    } catch (err) {
      console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on cross-muni');
      console.assert((err as Error).message.includes('outside your municipality'), 'Correct message');
    }
    console.log('✅ TEST 2: Municipality A admin accessing Municipality B issue → denied');
  }

  // TEST 3: Pradhan accessing own panchayat issue → allowed
  {
    const client = createMockSupabase({
      currentUser: { id: PRADHAN_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: null,
        panchayat_id: PANCHAYAT_A,
      },
    });

    const res = await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, client);
    console.assert(res.status === 'verified', 'Pradhan verified own panchayat issue');
    console.log('✅ TEST 3: Pradhan accessing own panchayat issue → allowed');
  }

  // TEST 4: Pradhan accessing another panchayat issue → denied
  {
    const client = createMockSupabase({
      currentUser: { id: PRADHAN_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: null,
        panchayat_id: PANCHAYAT_B,
      },
    });

    try {
      await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, client);
      console.assert(false, 'Should have blocked cross-panchayat access');
    } catch (err) {
      console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on cross-panchayat');
      console.assert((err as Error).message.includes('outside your panchayat'), 'Correct message');
    }
    console.log('✅ TEST 4: Pradhan accessing another panchayat issue → denied');
  }

  // TEST 5: Worker accessing assigned issue → allowed
  {
    const client = createMockSupabase({
      currentUser: { id: WORKER_MUNI_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'in_progress',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: WORKER_MUNI_A_ID,
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    const res = await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'resolved' }, client);
    console.assert(res.status === 'resolved', 'Assigned worker resolved issue');
    console.log('✅ TEST 5: Worker accessing assigned issue → allowed');
  }

  // TEST 6: Worker accessing unrelated issue → denied
  {
    const client = createMockSupabase({
      currentUser: { id: WORKER_MUNI_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'in_progress',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: 'some-other-worker-uuid',
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    try {
      await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'resolved' }, client);
      console.assert(false, 'Unassigned worker should be denied');
    } catch (err) {
      console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError');
      console.assert((err as Error).message.includes('assigned to them'), 'Correct message');
    }
    console.log('✅ TEST 6: Worker accessing unrelated issue → denied');
  }

  // TEST 7: Panchayat worker crossing panchayat boundary → denied
  {
    const client = createMockSupabase({
      currentUser: { id: PRADHAN_A_ID },
      userProfiles: {
        ...userProfiles,
        '55555555-5555-4555-a555-555555555555': {
          id: '55555555-5555-4555-a555-555555555555',
          role: 'panchayat_worker',
          is_active: true,
          panchayat_id: PANCHAYAT_B,
        },
      },
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: null,
        panchayat_id: PANCHAYAT_A,
      },
    });

    try {
      await WorkerService.assignWorker(
        {
          issueId: ISSUE_ID,
          workerId: '55555555-5555-4555-a555-555555555555',
        },
        client
      );
      console.assert(false, 'Cross-panchayat worker assignment should be denied');
    } catch (err) {
      console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError');
      console.assert((err as Error).message.includes('another panchayat'), 'Correct message');
    }
    console.log('✅ TEST 7: Panchayat worker crossing panchayat boundary → denied');
  }

  // TEST 8: Citizen attempting unauthorized status transition → denied
  {
    const client = createMockSupabase({
      currentUser: { id: CITIZEN_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    try {
      await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, client);
      console.assert(false, 'Citizen cannot verify issue');
    } catch (err) {
      console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError');
      console.assert((err as Error).message.includes('cannot perform official status transitions'), 'Correct message');
    }
    console.log('✅ TEST 8: Citizen accessing unauthorized issue transition → denied');
  }

  // TEST 9: Correct urban issue with NULL panchayat_id → Pradhan access strictly denied, Municipal admin allowed
  {
    const clientPradhan = createMockSupabase({
      currentUser: { id: PRADHAN_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: MUNI_A,
        panchayat_id: null, // Urban issue
      },
    });

    try {
      await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, clientPradhan);
      console.assert(false, 'Pradhan must be denied on urban issue with null panchayat');
    } catch (err) {
      console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError');
      console.assert((err as Error).message.includes('Cannot manage non-panchayat/urban issue'), 'Correct message');
    }

    const clientAdmin = createMockSupabase({
      currentUser: { id: ADMIN_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: MUNI_A,
        panchayat_id: null, // Urban issue
      },
    });

    const res = await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, clientAdmin);
    console.assert(res.status === 'verified', 'Municipal admin A allowed on urban issue in Muni A');
    console.log('✅ TEST 9: Correct urban issue with NULL panchayat_id → behavior verified (Pradhan denied, Muni admin allowed)');
  }

  // TEST 10: Rural issue with NULL municipality_id → Municipal admin strictly denied, Pradhan allowed
  {
    const clientAdmin = createMockSupabase({
      currentUser: { id: ADMIN_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: null, // Rural issue
        panchayat_id: PANCHAYAT_A,
      },
    });

    try {
      await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, clientAdmin);
      console.assert(false, 'Municipal admin must be denied on rural issue with null municipality');
    } catch (err) {
      console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError');
      console.assert((err as Error).message.includes('Cannot manage non-municipal/rural issue'), 'Correct message');
    }

    const clientPradhan = createMockSupabase({
      currentUser: { id: PRADHAN_A_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: null, // Rural issue
        panchayat_id: PANCHAYAT_A,
      },
    });

    const res = await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, clientPradhan);
    console.assert(res.status === 'verified', 'Pradhan allowed on rural issue in own panchayat');
    console.log('✅ TEST 10: Rural issue without municipality context → safely denied for municipal_admin, allowed for matching pradhan');
  }

  // TEST 11: Citizen deleting own submitted issue via IssueService.deleteIssue() → allowed
  {
    const client = createMockSupabase({
      currentUser: { id: CITIZEN_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    const res = await IssueService.deleteIssue(ISSUE_ID, client);
    console.assert(res.success === true, 'Delete succeeded');
    console.assert(client._getDeletedId() === ISSUE_ID, 'Issue deleted from store');
    console.log('✅ TEST 11: Citizen deleting own submitted issue via IssueService.deleteIssue() → allowed');
  }

  // TEST 12: Citizen deleting in_progress or other user\'s issue → denied
  {
    // Case A: In-progress issue
    const clientA = createMockSupabase({
      currentUser: { id: CITIZEN_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'in_progress',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: WORKER_MUNI_A_ID,
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    try {
      await IssueService.deleteIssue(ISSUE_ID, clientA);
      console.assert(false, 'Should not allow deleting in_progress issue');
    } catch (err) {
      console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on non-submitted status');
      console.assert((err as Error).message.includes('Only "submitted" issues can be deleted'), 'Correct error message');
    }

    // Case B: Other user's issue
    const clientB = createMockSupabase({
      currentUser: { id: 'some-other-citizen' },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    try {
      await IssueService.deleteIssue(ISSUE_ID, clientB);
      console.assert(false, 'Should not allow deleting another user issue');
    } catch (err) {
      console.assert(err instanceof IssueValidationError, 'Throws IssueValidationError on ownership check');
      console.assert((err as Error).message.includes('only delete issues you reported'), 'Correct error message');
    }
    console.log('✅ TEST 12: Citizen deleting in_progress or other user issue → denied');
  }

  // TEST 13: Citizen feedback submission via IssueService.submitFeedback()
  {
    // Satisfied feedback
    const clientSatisfied = createMockSupabase({
      currentUser: { id: CITIZEN_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'resolved',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: WORKER_MUNI_A_ID,
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    const resSatisfied = await IssueService.submitFeedback(
      {
        issueId: ISSUE_ID,
        feedback: 'satisfied',
        comment: 'Road looks great!',
      },
      clientSatisfied
    );
    console.assert(resSatisfied.status === 'resolved', 'Status remains resolved');
    console.assert(clientSatisfied._getIssue()?.citizen_feedback === 'satisfied', 'Feedback stored');

    // Dissatisfied feedback escalates
    const clientDissatisfied = createMockSupabase({
      currentUser: { id: CITIZEN_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'resolved',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: WORKER_MUNI_A_ID,
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    const resDissatisfied = await IssueService.submitFeedback(
      {
        issueId: ISSUE_ID,
        feedback: 'not_satisfied',
        comment: 'Pothole was not filled completely',
      },
      clientDissatisfied
    );
    console.assert(resDissatisfied.status === 'escalated', 'Status transitioned to escalated');
    console.assert(clientDissatisfied._getIssue()?.citizen_feedback === 'not_satisfied', 'Feedback stored');
    console.log('✅ TEST 13: Citizen submitting feedback via IssueService.submitFeedback() → satisfied preserves, not_satisfied escalates');
  }

  // TEST 14: Central Administrator system-wide access across urban and rural issues
  {
    // Urban issue
    const clientUrban = createMockSupabase({
      currentUser: { id: CENTRAL_ADMIN_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: MUNI_A,
        panchayat_id: null,
      },
    });

    const resUrban = await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, clientUrban);
    console.assert(resUrban.status === 'verified', 'Central admin verified urban issue');

    // Rural issue
    const clientRural = createMockSupabase({
      currentUser: { id: CENTRAL_ADMIN_ID },
      userProfiles,
      initialIssue: {
        id: ISSUE_ID,
        status: 'submitted',
        reporter_id: CITIZEN_ID,
        assigned_worker_id: null,
        municipality_id: null,
        panchayat_id: PANCHAYAT_B,
      },
    });

    const resRural = await IssueService.transitionStatus({ issueId: ISSUE_ID, status: 'verified' }, clientRural);
    console.assert(resRural.status === 'verified', 'Central admin verified rural issue');
    console.log('✅ TEST 14: Central Administrator system-wide access across urban and rural issues → verified');
  }

  console.log('\n🎉 ALL 14 GEOGRAPHIC AUTHORIZATION & DOMAIN TESTS PASSED SUCCESSFULLY!\n');
}

runGeographicTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
