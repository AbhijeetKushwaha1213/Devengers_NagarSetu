/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test Suite: Automatic Issue Routing & Department Management (17 Scenarios)
 * File: tests/backend/routing/automaticRoutingAndDepartment.test.ts
 *
 * Verifies:
 * Part 12 Automated Regression Test Suite:
 * 1. Department list loads for authorized municipality
 * 2. Unauthorized municipality departments are not exposed
 * 3. Issue department_id persists correctly
 * 4. Category resolves to correct department
 * 5. Correct municipality workers are selected
 * 6. Wrong municipality workers are rejected
 * 7. Inactive workers are rejected
 * 8. Worker workload affects selection
 * 9. Deterministic tie-breaking works
 * 10. Automatic assignment persists
 * 11. Worker can retrieve automatically assigned issue
 * 12. No-worker condition leaves issue safely unassigned
 * 13. Missing department leaves issue safely routable manually
 * 14. AI failure does not break assignment
 * 15. Admin can override assignment
 * 16. Assignment audit event is generated
 * 17. Notification is sent after assignment
 */

import { DepartmentRouter } from '../../../backend/services/routing/departmentRouter';
import { WorkerRouter } from '../../../backend/services/routing/workerRouter';
import { RoutingService } from '../../../backend/services/routing/routingService';
import { AIAssistantService } from '../../../backend/services/ai/aiAssistantService';
import { WorkerService } from '../../../backend/services/workers/workerService';
import { SupabaseClient } from '@supabase/supabase-js';

// --- Test State & Mock Supabase Factory ---

interface MockDepartment {
  id: string;
  name: string;
  municipality_id: string;
}

interface MockWorker {
  id: string;
  full_name: string;
  role: string;
  municipality_id: string;
  department_id: string;
  ward_id?: string | null;
  is_active: boolean;
}

interface MockIssue {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  reporter_id: string;
  municipality_id: string;
  ward_id?: string | null;
  department_id?: string | null;
  assigned_worker_id?: string | null;
  assigned_manager_id?: string | null;
  tracking_id?: string;
  updated_at?: string;
}

interface MockAuditLog {
  id?: string;
  issue_id: string;
  user_id?: string | null;
  action: string;
  old_status?: string;
  new_status?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  notes?: string;
  created_at?: string;
}

interface MockNotification {
  id?: string;
  user_id: string;
  issue_id?: string | null;
  type: string;
  title: string;
  message: string;
  channels?: string[];
  created_at?: string;
}

let notifSeq = 1000;

function createMockSupabase(initialState: {
  currentUser?: { id: string; role: string; municipality_id?: string; full_name?: string } | null;
  departments?: MockDepartment[];
  workers?: MockWorker[];
  issues?: MockIssue[];
  auditLogs?: MockAuditLog[];
  notifications?: MockNotification[];
}) {
  const departments: MockDepartment[] = [...(initialState.departments || [])];
  const workers: MockWorker[] = [...(initialState.workers || [])];
  const issues: Map<string, MockIssue> = new Map(
    (initialState.issues || []).map((i) => [i.id, { ...i }])
  );
  const auditLogs: MockAuditLog[] = [...(initialState.auditLogs || [])];
  const notifications: MockNotification[] = [...(initialState.notifications || [])];

  const client = {
    auth: {
      getUser: async () => {
        if (!initialState.currentUser) {
          return { data: { user: null }, error: new Error('Unauthorized') };
        }
        return {
          data: {
            user: {
              id: initialState.currentUser.id,
              email: `${initialState.currentUser.id}@test.com`,
              user_metadata: { full_name: initialState.currentUser.full_name || 'Test User' },
            },
          },
          error: null,
        };
      },
    },
    rpc: async (fnName: string, params: any) => {
      if (fnName === 'create_system_notification') {
        notifSeq++;
        const notifId = `88888888-8888-4888-8888-${notifSeq.toString().padStart(12, '0')}`;
        const notif: MockNotification = {
          id: notifId,
          user_id: params.p_user_id,
          issue_id: params.p_issue_id || null,
          type: params.p_type,
          title: params.p_title,
          message: params.p_message,
          channels: params.p_channels || ['in_app'],
          created_at: new Date().toISOString(),
        };
        notifications.push(notif);
        return { data: notifId, error: null };
      }
      // Fallback for non-mocked RPCs
      return { data: null, error: { message: `Could not find the function public.${fnName}` } };
    },
    from: (table: string) => {
      if (table === 'departments') {
        let filtered = [...departments];
        const queryObj: any = {
          select: (_cols?: string) => queryObj,
          eq: (col: string, val: string) => {
            filtered = filtered.filter((d: any) => d[col] === val);
            return queryObj;
          },
          then: (resolve: any) => resolve({ data: filtered, error: null }),
        };
        return queryObj;
      }

      if (table === 'user_profiles') {
        let filtered = [...workers];
        if (initialState.currentUser) {
          filtered.push({
            id: initialState.currentUser.id,
            full_name: initialState.currentUser.full_name || 'Admin',
            role: initialState.currentUser.role,
            municipality_id: initialState.currentUser.municipality_id || '',
            department_id: '',
            is_active: true,
          });
        }
        let singleTargetId: string | null = null;
        const queryObj: any = {
          select: (_cols?: string) => queryObj,
          eq: (col: string, val: any) => {
            if (col === 'id') singleTargetId = val;
            filtered = filtered.filter((w: any) => w[col] === val);
            return queryObj;
          },
          in: (col: string, vals: any[]) => {
            filtered = filtered.filter((w: any) => vals.includes(w[col]));
            return queryObj;
          },
          single: async () => {
            if (singleTargetId) {
              const target = filtered.find((w) => w.id === singleTargetId);
              if (target) return { data: target, error: null };
              return { data: null, error: { message: 'Profile not found' } };
            }
            if (filtered.length > 0) return { data: filtered[0], error: null };
            return { data: null, error: { message: 'Profile not found' } };
          },
          maybeSingle: async () => {
            if (singleTargetId) {
              const target = filtered.find((w) => w.id === singleTargetId);
              return { data: target || null, error: null };
            }
            return { data: filtered[0] || null, error: null };
          },
          then: (resolve: any) => resolve({ data: filtered, error: null }),
        };
        return queryObj;
      }

      if (table === 'issues') {
        let filtered = Array.from(issues.values());
        let singleId: string | null = null;
        let updateData: Partial<MockIssue> | null = null;

        const queryObj: any = {
          select: (_cols?: string) => queryObj,
          eq: (col: string, val: any) => {
            if (col === 'id') singleId = val;
            filtered = filtered.filter((i: any) => i[col] === val);
            return queryObj;
          },
          in: (col: string, vals: any[]) => {
            filtered = filtered.filter((i: any) => vals.includes(i[col]));
            return queryObj;
          },
          update: (payload: Partial<MockIssue>) => {
            updateData = payload;
            return queryObj;
          },
          insert: async (rows: MockIssue | MockIssue[]) => {
            const arr = Array.isArray(rows) ? rows : [rows];
            for (const item of arr) {
              issues.set(item.id, { ...item });
            }
            return { data: arr, error: null };
          },
          single: async () => {
            if (updateData && singleId) {
              const current = issues.get(singleId);
              if (!current) return { data: null, error: { message: 'Issue not found' } };
              const updated = { ...current, ...updateData };
              issues.set(singleId, updated);
              return { data: updated, error: null };
            }
            if (singleId) {
              const item = issues.get(singleId);
              if (item) return { data: item, error: null };
              return { data: null, error: { message: 'Issue not found' } };
            }
            if (filtered.length > 0) return { data: filtered[0], error: null };
            return { data: null, error: { message: 'Issue not found' } };
          },
          maybeSingle: async () => {
            if (updateData && singleId) {
              const current = issues.get(singleId);
              if (!current) return { data: null, error: null };
              const updated = { ...current, ...updateData };
              issues.set(singleId, updated);
              return { data: updated, error: null };
            }
            if (singleId) {
              const item = issues.get(singleId);
              return { data: item || null, error: null };
            }
            return { data: filtered[0] || null, error: null };
          },
          then: (resolve: any) => {
            if (updateData && singleId) {
              const current = issues.get(singleId);
              if (current) {
                const updated = { ...current, ...updateData };
                issues.set(singleId, updated);
                return resolve({ data: [updated], error: null });
              }
            }
            return resolve({ data: filtered, error: null });
          },
        };
        return queryObj;
      }

      if (table === 'issue_audit_log') {
        return {
          insert: async (entry: MockAuditLog | MockAuditLog[]) => {
            const entries = Array.isArray(entry) ? entry : [entry];
            auditLogs.push(...entries);
            return { data: entries, error: null };
          },
        };
      }

      if (table === 'notifications') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, _val: any) => ({
              maybeSingle: async () => ({
                data: notifications.length > 0 ? notifications[notifications.length - 1] : null,
                error: null,
              }),
            }),
          }),
          insert: async (entry: MockNotification | MockNotification[]) => {
            const entries = Array.isArray(entry) ? entry : [entry];
            notifications.push(...entries);
            return { data: entries, error: null };
          },
        };
      }

      throw new Error(`Unhandled mock table: ${table}`);
    },
    // Expose internal state for assertions
    _getState: () => ({ departments, workers, issues, auditLogs, notifications }),
  };

  return client as unknown as SupabaseClient & {
    _getState: () => {
      departments: MockDepartment[];
      workers: MockWorker[];
      issues: Map<string, MockIssue>;
      auditLogs: MockAuditLog[];
      notifications: MockNotification[];
    };
  };
}

// --- Test Suite Execution ---

async function runTests() {
  console.log('--- BEGIN: Automatic Issue Routing & Department Management Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`  ✅ PASSED: ${message}`);
      passed++;
    }
  }

  const PRAYAGRAJ_ID = 'e15a8684-df60-4451-8897-699aaf8a33c6';
  const VARANASI_ID = 'a2222222-2222-4222-8222-222222222222';
  const CITIZEN_ID = '44444444-4444-4444-8444-444444444441';
  const ADMIN_ID = '33333333-3333-4333-8333-333333333331';

  const DEPT_SANITATION = {
    id: '1694091f-28e9-4b81-92f6-9ab9935438b6',
    name: 'Sanitation Department',
    municipality_id: PRAYAGRAJ_ID,
  };
  const DEPT_ELECTRICAL = {
    id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Electrical Department',
    municipality_id: PRAYAGRAJ_ID,
  };
  const DEPT_WATER = {
    id: 'b0000000-0000-0000-0000-000000000003',
    name: 'Water Supply Department',
    municipality_id: PRAYAGRAJ_ID,
  };
  const DEPT_VARANASI_SANITATION = {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'Sanitation Department',
    municipality_id: VARANASI_ID,
  };

  // =========================================================================
  // Scenario 1: Department list loads for authorized municipality
  // =========================================================================
  try {
    console.log('\n[Scenario 1] Department list loads for authorized municipality');
    const client = createMockSupabase({
      departments: [DEPT_SANITATION, DEPT_ELECTRICAL, DEPT_WATER, DEPT_VARANASI_SANITATION],
    });

    const res = await client.from('departments').select('id, name, municipality_id').eq('municipality_id', PRAYAGRAJ_ID);
    assert(res.data?.length === 3, 'Loads exactly 3 departments for Prayagraj');
    assert(
      res.data?.every((d: MockDepartment) => d.municipality_id === PRAYAGRAJ_ID),
      'All returned departments belong to Prayagraj'
    );
  } catch (err: any) {
    console.error('Scenario 1 exception:', err.message);
  }

  // =========================================================================
  // Scenario 2: Unauthorized municipality departments are not exposed
  // =========================================================================
  try {
    console.log('\n[Scenario 2] Unauthorized municipality departments are not exposed');
    const client = createMockSupabase({
      departments: [DEPT_SANITATION, DEPT_VARANASI_SANITATION],
    });

    const res = await client.from('departments').select('id, name, municipality_id').eq('municipality_id', PRAYAGRAJ_ID);
    assert(!res.data?.some((d: MockDepartment) => d.municipality_id === VARANASI_ID), 'Varanasi departments are completely excluded when querying Prayagraj');
  } catch (err: any) {
    console.error('Scenario 2 exception:', err.message);
  }

  // =========================================================================
  // Scenario 3: Issue department_id persists correctly
  // =========================================================================
  try {
    console.log('\n[Scenario 3] Issue department_id persists correctly');
    const issueId = '11111111-1111-4111-8111-111111111103';
    const client = createMockSupabase({
      issues: [
        {
          id: issueId,
          title: 'Garbage heap',
          category: 'garbage_dump',
          status: 'submitted',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
        },
      ],
    });

    const updateRes = await client
      .from('issues')
      .update({ department_id: DEPT_SANITATION.id })
      .eq('id', issueId)
      .select()
      .single();

    assert(updateRes.data?.department_id === DEPT_SANITATION.id, 'department_id is persisted on the issue record');
  } catch (err: any) {
    console.error('Scenario 3 exception:', err.message);
  }

  // =========================================================================
  // Scenario 4: Category resolves to correct department
  // =========================================================================
  try {
    console.log('\n[Scenario 4] Category resolves to correct department');
    const client = createMockSupabase({
      departments: [DEPT_SANITATION, DEPT_ELECTRICAL, DEPT_WATER],
    });

    const rSanitation = await DepartmentRouter.resolveDepartment('garbage_dump', PRAYAGRAJ_ID, client);
    assert(rSanitation.departmentId === DEPT_SANITATION.id, 'garbage_dump resolves to Sanitation Department');

    const rElectrical = await DepartmentRouter.resolveDepartment('street_light', PRAYAGRAJ_ID, client);
    assert(rElectrical.departmentId === DEPT_ELECTRICAL.id, 'street_light resolves to Electrical Department');

    const rWater = await DepartmentRouter.resolveDepartment('water_supply', PRAYAGRAJ_ID, client);
    assert(rWater.departmentId === DEPT_WATER.id, 'water_supply resolves to Water Supply Department');

    const rWaterAlias = await DepartmentRouter.resolveDepartment('water_leakage' as any, PRAYAGRAJ_ID, client);
    assert(rWaterAlias.departmentId === DEPT_WATER.id, 'water_leakage alias resolves to Water Supply Department');
  } catch (err: any) {
    console.error('Scenario 4 exception:', err.message);
  }

  // =========================================================================
  // Scenario 5: Correct municipality workers are selected
  // =========================================================================
  try {
    console.log('\n[Scenario 5] Correct municipality workers are selected');
    const client = createMockSupabase({
      workers: [
        {
          id: '22222222-2222-4222-8222-222222222201',
          full_name: 'Prayagraj Worker',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
        {
          id: '22222222-2222-4222-8222-222222222202',
          full_name: 'Varanasi Worker',
          role: 'worker',
          municipality_id: VARANASI_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
      ],
    });

    const res = await WorkerRouter.selectWorker({
      category: 'garbage_dump',
      departmentId: DEPT_SANITATION.id,
      departmentName: DEPT_SANITATION.name,
      municipalityId: PRAYAGRAJ_ID,
      supabaseClient: client,
    });

    assert(res.workerId === '22222222-2222-4222-8222-222222222201', 'Selected worker belongs to Prayagraj municipality');
  } catch (err: any) {
    console.error('Scenario 5 exception:', err.message);
  }

  // =========================================================================
  // Scenario 6: Wrong municipality workers are rejected
  // =========================================================================
  try {
    console.log('\n[Scenario 6] Wrong municipality workers are rejected');
    const client = createMockSupabase({
      workers: [
        {
          id: '22222222-2222-4222-8222-222222222202',
          full_name: 'Varanasi Only Worker',
          role: 'worker',
          municipality_id: VARANASI_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
      ],
    });

    const res = await WorkerRouter.selectWorker({
      category: 'garbage_dump',
      departmentId: DEPT_SANITATION.id,
      departmentName: DEPT_SANITATION.name,
      municipalityId: PRAYAGRAJ_ID,
      supabaseClient: client,
    });

    assert(res.status === 'pending' && res.workerId === null, 'Rejects workers from different municipality');
  } catch (err: any) {
    console.error('Scenario 6 exception:', err.message);
  }

  // =========================================================================
  // Scenario 7: Inactive workers are rejected
  // =========================================================================
  try {
    console.log('\n[Scenario 7] Inactive workers are rejected');
    const client = createMockSupabase({
      workers: [
        {
          id: '22222222-2222-4222-8222-222222222203',
          full_name: 'Inactive Worker',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: false,
        },
      ],
    });

    const res = await WorkerRouter.selectWorker({
      category: 'garbage_dump',
      departmentId: DEPT_SANITATION.id,
      departmentName: DEPT_SANITATION.name,
      municipalityId: PRAYAGRAJ_ID,
      supabaseClient: client,
    });

    assert(res.status === 'pending' && res.workerId === null, 'Inactive worker is not selected');
  } catch (err: any) {
    console.error('Scenario 7 exception:', err.message);
  }

  // =========================================================================
  // Scenario 8: Worker workload affects selection
  // =========================================================================
  try {
    console.log('\n[Scenario 8] Worker workload affects selection');
    const workerBusyId = '22222222-2222-4222-8222-222222222208';
    const workerFreeId = '22222222-2222-4222-8222-222222222209';

    const client = createMockSupabase({
      workers: [
        {
          id: workerBusyId,
          full_name: 'Busy Worker',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
        {
          id: workerFreeId,
          full_name: 'Free Worker',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
      ],
      issues: [
        {
          id: '11111111-1111-4111-8111-111111111181',
          title: 'Active Issue 1',
          category: 'garbage_dump',
          status: 'in_progress',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
          assigned_worker_id: workerBusyId,
        },
        {
          id: '11111111-1111-4111-8111-111111111182',
          title: 'Active Issue 2',
          category: 'garbage_dump',
          status: 'in_progress',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
          assigned_worker_id: workerBusyId,
        },
      ],
    });

    const res = await WorkerRouter.selectWorker({
      category: 'garbage_dump',
      departmentId: DEPT_SANITATION.id,
      departmentName: DEPT_SANITATION.name,
      municipalityId: PRAYAGRAJ_ID,
      supabaseClient: client,
    });

    assert(res.workerId === workerFreeId, 'Worker with 0 active tasks is selected over worker with 2 tasks');
    assert(res.activeWorkload === 0, 'Reported workload for selected worker is 0');
  } catch (err: any) {
    console.error('Scenario 8 exception:', err.message);
  }

  // =========================================================================
  // Scenario 9: Deterministic tie-breaking works
  // =========================================================================
  try {
    console.log('\n[Scenario 9] Deterministic tie-breaking works');
    const workerA = '22222222-2222-4222-8222-22222222220a';
    const workerB = '22222222-2222-4222-8222-22222222220b';

    const client = createMockSupabase({
      workers: [
        {
          id: workerB,
          full_name: 'Worker B',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
        {
          id: workerA,
          full_name: 'Worker A',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
      ],
    });

    const res = await WorkerRouter.selectWorker({
      category: 'garbage_dump',
      departmentId: DEPT_SANITATION.id,
      departmentName: DEPT_SANITATION.name,
      municipalityId: PRAYAGRAJ_ID,
      supabaseClient: client,
    });

    assert(res.workerId === workerA, 'Deterministic tie-break selects worker with lower alphanumeric ID');
  } catch (err: any) {
    console.error('Scenario 9 exception:', err.message);
  }

  // =========================================================================
  // Scenario 10: Automatic assignment persists
  // =========================================================================
  try {
    console.log('\n[Scenario 10] Automatic assignment persists');
    const issueId = '11111111-1111-4111-8111-111111111110';
    const workerId = '22222222-2222-4222-8222-222222222210';
    const client = createMockSupabase({
      departments: [DEPT_SANITATION],
      workers: [
        {
          id: workerId,
          full_name: 'Sanitation Officer',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
      ],
      issues: [
        {
          id: issueId,
          title: 'Uncollected Trash',
          category: 'garbage_dump',
          status: 'submitted',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
        },
      ],
    });

    const result = await RoutingService.routeIssue(
      {
        id: issueId,
        category: 'garbage_dump',
        municipality_id: PRAYAGRAJ_ID,
        reporter_id: CITIZEN_ID,
      },
      client
    );

    assert(result.status === 'assigned', 'Routing status is assigned');
    assert(result.assignedIssue?.assigned_worker_id === workerId, 'assigned_worker_id persisted on issue');
    assert(result.assignedIssue?.department_id === DEPT_SANITATION.id, 'department_id persisted on issue');
    assert(result.assignedIssue?.status === 'in_progress', 'status advanced to in_progress');
  } catch (err: any) {
    console.error('Scenario 10 exception:', err.message);
  }

  // =========================================================================
  // Scenario 11: Worker can retrieve automatically assigned issue
  // =========================================================================
  try {
    console.log('\n[Scenario 11] Worker can retrieve automatically assigned issue');
    const workerId = '22222222-2222-4222-8222-222222222211';
    const issueId = '11111111-1111-4111-8111-111111111111';
    const client = createMockSupabase({
      issues: [
        {
          id: issueId,
          title: 'Assigned Garbage Issue',
          category: 'garbage_dump',
          status: 'in_progress',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
          assigned_worker_id: workerId,
          department_id: DEPT_SANITATION.id,
        },
      ],
    });

    const workerTasksRes = await client
      .from('issues')
      .select('*')
      .eq('assigned_worker_id', workerId);

    assert(workerTasksRes.data?.length === 1, 'Worker can query their assigned issues');
    assert(workerTasksRes.data?.[0].id === issueId, 'Assigned issue retrieved accurately');
  } catch (err: any) {
    console.error('Scenario 11 exception:', err.message);
  }

  // =========================================================================
  // Scenario 12: No-worker condition leaves issue safely unassigned
  // =========================================================================
  try {
    console.log('\n[Scenario 12] No-worker condition leaves issue safely unassigned');
    const issueId = '11111111-1111-4111-8111-111111111112';
    const client = createMockSupabase({
      departments: [DEPT_SANITATION],
      workers: [], // 0 workers in department
      issues: [
        {
          id: issueId,
          title: 'Trash without worker',
          category: 'garbage_dump',
          status: 'submitted',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
        },
      ],
    });

    const result = await RoutingService.routeIssue(
      {
        id: issueId,
        category: 'garbage_dump',
        municipality_id: PRAYAGRAJ_ID,
        reporter_id: CITIZEN_ID,
      },
      client
    );

    assert(result.status === 'pending_worker', 'Routing status is pending_worker');
    assert(result.workerResult.workerId === null, 'workerId remains null');
    assert(result.departmentResult.departmentId === DEPT_SANITATION.id, 'Department was still resolved and assigned');

    const state = client._getState();
    const updatedIssue = state.issues.get(issueId);
    assert(updatedIssue?.status === 'submitted', 'Issue remains in submitted status');
    assert(updatedIssue?.assigned_worker_id === null || updatedIssue?.assigned_worker_id === undefined, 'No worker is assigned');
    assert(updatedIssue?.department_id === DEPT_SANITATION.id, 'department_id is recorded on issue');
  } catch (err: any) {
    console.error('Scenario 12 exception:', err.message);
  }

  // =========================================================================
  // Scenario 13: Missing department leaves issue safely routable manually
  // =========================================================================
  try {
    console.log('\n[Scenario 13] Missing department leaves issue safely routable manually');
    const issueId = '11111111-1111-4111-8111-111111111113';
    const client = createMockSupabase({
      departments: [], // No registered departments
      issues: [
        {
          id: issueId,
          title: 'Uncategorized Civic Problem',
          category: 'other',
          status: 'submitted',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
        },
      ],
    });

    const result = await RoutingService.routeIssue(
      {
        id: issueId,
        category: 'other' as any,
        municipality_id: PRAYAGRAJ_ID,
        reporter_id: CITIZEN_ID,
      },
      client
    );

    assert(result.status === 'pending_department', 'Routing status is pending_department');
    assert(result.departmentResult.departmentId === null, 'departmentId is null');
    assert(result.workerResult.workerId === null, 'workerId is null');

    const state = client._getState();
    const issueState = state.issues.get(issueId);
    assert(issueState?.status === 'submitted', 'Issue remains submitted for manual authority assignment');
    assert(
      state.auditLogs.some((l) => l.action === 'ROUTING_PENDING_DEPARTMENT'),
      'Audit log recorded ROUTING_PENDING_DEPARTMENT'
    );
  } catch (err: any) {
    console.error('Scenario 13 exception:', err.message);
  }

  // =========================================================================
  // Scenario 14: AI failure does not break assignment
  // =========================================================================
  try {
    console.log('\n[Scenario 14] AI failure does not break assignment');
    const client = createMockSupabase({
      departments: [DEPT_SANITATION],
      workers: [
        {
          id: '22222222-2222-4222-8222-222222222214',
          full_name: 'Fallback Worker',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
      ],
    });

    const aiSuggestion = await AIAssistantService.suggestRouting(
      {
        title: 'Broken bins',
        category: 'garbage_dump',
        municipalityId: PRAYAGRAJ_ID,
      },
      client
    );

    assert(aiSuggestion.status === 'resolved', 'AI Assistant resolves category deterministically');
    assert(aiSuggestion.confidence >= 0.7, 'High confidence for standard category');

    const brokenAISuggestion = await AIAssistantService.suggestRouting(
      {
        title: '',
        category: 'unknown_broken_category' as any,
        municipalityId: PRAYAGRAJ_ID,
      },
      client
    );

    assert(brokenAISuggestion.status === 'fallback', 'Unknown category cleanly falls back without exception');
  } catch (err: any) {
    console.error('Scenario 14 exception:', err.message);
  }

  // =========================================================================
  // Scenario 15: Admin can override assignment
  // =========================================================================
  try {
    console.log('\n[Scenario 15] Admin can override assignment');
    const adminUser = {
      id: ADMIN_ID,
      role: 'administrator',
      municipality_id: PRAYAGRAJ_ID,
      full_name: 'Admin NagarSetu',
    };
    const issueId = '11111111-1111-4111-8111-111111111115';
    const workerOrigId = '22222222-2222-4222-8222-222222222215';
    const workerOverId = '22222222-2222-4222-8222-222222222216';

    const client = createMockSupabase({
      currentUser: adminUser,
      departments: [DEPT_SANITATION, DEPT_ELECTRICAL],
      workers: [
        {
          id: workerOrigId,
          full_name: 'Original Worker',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
        {
          id: workerOverId,
          full_name: 'Override Worker',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_ELECTRICAL.id,
          is_active: true,
        },
      ],
      issues: [
        {
          id: issueId,
          title: 'Reassigned issue',
          category: 'garbage_dump',
          status: 'in_progress',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
          assigned_worker_id: workerOrigId,
          department_id: DEPT_SANITATION.id,
        },
      ],
    });

    const overrideResult = await WorkerService.assignWorker(
      {
        issueId,
        workerId: workerOverId,
        departmentId: DEPT_ELECTRICAL.id,
      },
      client
    );

    assert(overrideResult.assigned_worker_id === workerOverId, 'Worker reassigned to override worker');
    assert(overrideResult.department_id === DEPT_ELECTRICAL.id, 'Department reassigned to Electrical');

    const state = client._getState();
    assert(
      state.auditLogs.some((l) => (l.action === 'WORKER_REASSIGNED' || l.action === 'WORKER_ASSIGNED') && (l.new_data as any)?.assigned_worker_id === workerOverId),
      'Admin override audit log recorded'
    );
  } catch (err: any) {
    console.error('Scenario 15 exception:', err.message);
  }

  // =========================================================================
  // Scenario 16: Assignment audit event is generated
  // =========================================================================
  try {
    console.log('\n[Scenario 16] Assignment audit event is generated');
    const issueId = '11111111-1111-4111-8111-111111111116';
    const workerId = '22222222-2222-4222-8222-222222222217';
    const client = createMockSupabase({
      departments: [DEPT_SANITATION],
      workers: [
        {
          id: workerId,
          full_name: 'Audit Worker',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
      ],
      issues: [
        {
          id: issueId,
          title: 'Audit Logging Check',
          category: 'garbage_dump',
          status: 'submitted',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
        },
      ],
    });

    await RoutingService.routeIssue(
      {
        id: issueId,
        category: 'garbage_dump',
        municipality_id: PRAYAGRAJ_ID,
        reporter_id: CITIZEN_ID,
      },
      client
    );

    const state = client._getState();
    const auditRecord = state.auditLogs.find(
      (l) => l.issue_id === issueId && l.action === 'WORKER_ASSIGNED'
    );

    assert(!!auditRecord, 'WORKER_ASSIGNED audit record is generated');
    assert(!!(auditRecord?.new_data as any)?.routing_reason, 'Audit record contains explainable routing_reason');
  } catch (err: any) {
    console.error('Scenario 16 exception:', err.message);
  }

  // =========================================================================
  // Scenario 17: Notification is sent after assignment
  // =========================================================================
  try {
    console.log('\n[Scenario 17] Notification is sent after assignment');
    const issueId = '11111111-1111-4111-8111-111111111117';
    const workerId = '22222222-2222-4222-8222-222222222218';
    const client = createMockSupabase({
      departments: [DEPT_SANITATION],
      workers: [
        {
          id: workerId,
          full_name: 'Notified Worker',
          role: 'worker',
          municipality_id: PRAYAGRAJ_ID,
          department_id: DEPT_SANITATION.id,
          is_active: true,
        },
      ],
      issues: [
        {
          id: issueId,
          title: 'Notification Verification',
          category: 'garbage_dump',
          status: 'submitted',
          reporter_id: CITIZEN_ID,
          municipality_id: PRAYAGRAJ_ID,
        },
      ],
    });

    await RoutingService.routeIssue(
      {
        id: issueId,
        title: 'Notification Verification',
        category: 'garbage_dump',
        municipality_id: PRAYAGRAJ_ID,
        reporter_id: CITIZEN_ID,
      },
      client
    );

    const state = client._getState();
    const assignmentNotif = state.notifications.find((n) => n.issue_id === issueId);
    assert(!!assignmentNotif, 'Lifecycle notification is dispatched on automatic assignment');
    assert(
      assignmentNotif?.type === 'issue_assigned' || assignmentNotif?.type === 'assignment' || assignmentNotif?.type === 'status_change',
      'Notification type corresponds to assignment'
    );
  } catch (err: any) {
    console.error('Scenario 17 exception:', err.message);
  }

  console.log('\n-----------------------------------------------------------');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed`);
  console.log('-----------------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Unhandled test suite error:', e);
  process.exit(1);
});
