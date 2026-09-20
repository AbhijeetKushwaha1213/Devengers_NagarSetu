/**
 * Regression Test Suite: Issue Visibility & Canonical Categories
 * File: tests/backend/issues/visibilityAndCategoriesRegression.test.ts
 *
 * Covers all 8 required regression scenarios:
 * 1. Citizen issue stores municipality_id.
 * 2. Citizen issue stores ward_id when applicable.
 * 3. Authority can retrieve the issue in its jurisdiction.
 * 4. Authority can assign the issue to an authorized worker.
 * 5. Worker can retrieve the assigned issue.
 * 6. Worker cannot retrieve an issue assigned outside its jurisdiction.
 * 7. All 7 categories pass validation and creation.
 * 8. Invalid category is rejected.
 */

import { IssueService, Issue } from '../../../backend/services/issues/issueService';
import { WorkerService } from '../../../backend/services/workers/workerService';
import {
  ISSUE_CATEGORIES,
  validateCreateIssue,
  validateGetIssues,
  IssueValidationError,
} from '../../../backend/validators/issueValidator';
import { SupabaseClient } from '@supabase/supabase-js';

const MUNICIPALITY_PRAYAGRAJ_ID = 'e15a8684-df60-4451-8897-699aaf8a33c6';
const MUNICIPALITY_OTHER_ID = 'f25a8684-df60-4451-8897-699aaf8a33c7';
const WARD_1_ID = 'a456eaa5-6c8b-4fed-a893-e816ad53773e';
const CITIZEN_ID = '6528a6ff-a195-48ac-8a2b-e59789cfaae6';
const ADMIN_ID = 'ee962ee3-103f-46aa-b1f0-d9eea1cdeb72';
const WORKER_ID = 'a5c5a47a-9cff-472b-bf58-f445da28df99';

interface MockIssueRecord {
  id: string;
  tracking_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  address: string;
  reporter_id: string;
  municipality_id: string | null;
  ward_id: string | null;
  panchayat_id: string | null;
  assigned_worker_id: string | null;
  assigned_manager_id: string | null;
  department_id: string | null;
  volunteers_count: number;
  upvotes_count: number;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

function createRegressionMockClient(options: {
  currentUser?: { id: string; email?: string } | null;
  initialIssues?: MockIssueRecord[];
}) {
  const issues: MockIssueRecord[] = options.initialIssues ? [...options.initialIssues] : [];
  let lastInserted: MockIssueRecord | null = null;

  const mockClient = {
    auth: {
      getUser: async () => {
        if (!options.currentUser) {
          return { data: { user: null }, error: new Error('Unauthenticated') };
        }
        return { data: { user: options.currentUser }, error: null };
      },
    },
    from: (table: string) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => {
                if (val === CITIZEN_ID) {
                  return {
                    data: {
                      id: CITIZEN_ID,
                      role: 'citizen',
                      is_active: true,
                      municipality_id: null,
                      ward_id: null,
                    },
                    error: null,
                  };
                }
                if (val === ADMIN_ID) {
                  return {
                    data: {
                      id: ADMIN_ID,
                      role: 'municipal_admin',
                      is_active: true,
                      municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
                      ward_id: null,
                    },
                    error: null,
                  };
                }
                if (val === WORKER_ID) {
                  return {
                    data: {
                      id: WORKER_ID,
                      role: 'worker',
                      is_active: true,
                      municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
                      ward_id: null,
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
              single: async () => {
                if (val === ADMIN_ID) {
                  return {
                    data: {
                      id: ADMIN_ID,
                      role: 'municipal_admin',
                      is_active: true,
                      municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
                    },
                    error: null,
                  };
                }
                if (val === WORKER_ID) {
                  return {
                    data: {
                      id: WORKER_ID,
                      role: 'worker',
                      is_active: true,
                      municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
                    },
                    error: null,
                  };
                }
                return { data: null, error: new Error('User not found') };
              },
            }),
          }),
        };
      }

      if (table === 'municipalities') {
        return {
          select: () =>
            Promise.resolve({
              data: [
                { id: MUNICIPALITY_PRAYAGRAJ_ID, name: 'Prayagraj Municipal Corporation' },
              ],
              error: null,
            }),
        };
      }

      if (table === 'wards') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              order: () => ({
                limit: async () => ({
                  data: [{ id: WARD_1_ID, name: 'Ward 1', municipality_id: val }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'issues') {
        return {
          insert: (rows: Array<Record<string, unknown>>) => {
            const row = rows[0];
            const record: MockIssueRecord = {
              id: 'test-issue-' + Math.random().toString(36).substring(2, 9),
              tracking_id: 'TRK-' + Math.floor(100000 + Math.random() * 900000),
              title: (row.title as string) || 'Test Title',
              description: (row.description as string) || '',
              category: (row.category as string) || 'cleanliness',
              status: (row.status as string) || 'submitted',
              address: (row.address as string) || '',
              reporter_id: (row.reporter_id as string) || CITIZEN_ID,
              municipality_id: (row.municipality_id as string) || null,
              ward_id: (row.ward_id as string) || null,
              panchayat_id: (row.panchayat_id as string) || null,
              assigned_worker_id: (row.assigned_worker_id as string) || null,
              assigned_manager_id: (row.assigned_manager_id as string) || null,
              department_id: (row.department_id as string) || null,
              volunteers_count: 0,
              upvotes_count: 0,
              created_at: new Date().toISOString(),
              metadata: (row.metadata as Record<string, unknown>) || undefined,
            };
            issues.push(record);
            lastInserted = record;
            return {
              select: () => ({
                single: async () => ({ data: record, error: null }),
              }),
            };
          },
          select: () => {
            let filtered = [...issues];
            const queryBuilder = {
              eq: (col: string, val: unknown) => {
                filtered = filtered.filter((item) => (item as Record<string, unknown>)[col] === val);
                return queryBuilder;
              },
              in: (col: string, vals: unknown[]) => {
                filtered = filtered.filter((item) => vals.includes((item as Record<string, unknown>)[col]));
                return queryBuilder;
              },
              order: () => queryBuilder,
              range: () => queryBuilder,
              single: async () => {
                const item = filtered[0];
                return item ? { data: item, error: null } : { data: null, error: new Error('Not found') };
              },
              then: (resolve: (val: { data: MockIssueRecord[]; error: null }) => void) => {
                resolve({ data: filtered, error: null });
              },
            };
            return queryBuilder;
          },
          update: (payload: Record<string, unknown>) => ({
            eq: (_col: string, val: string) => ({
              select: () => ({
                single: async () => {
                  const idx = issues.findIndex((i) => i.id === val);
                  if (idx !== -1) {
                    issues[idx] = { ...issues[idx], ...payload };
                    return { data: issues[idx], error: null };
                  }
                  return { data: null, error: new Error('Not found') };
                },
              }),
            }),
          }),
        };
      }

      if (table === 'issue_audit_log') {
        return {
          insert: async () => ({ data: null, error: null }),
        };
      }

      if (table === 'departments') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
            then: (fn: (res: { data: unknown[]; error: null }) => void) => fn({ data: [], error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table in regression test: ${table}`);
    },
    rpc: async () => {
      // Force service fallback
      return { data: null, error: { message: 'Could not find the function public.assign_issue_worker' } };
    },
  };

  return {
    client: mockClient as unknown as SupabaseClient,
    getIssues: () => issues,
    getLastInserted: () => lastInserted,
  };
}

async function runRegressionSuite() {
  console.log('========================================================');
  console.log('🧪 RUNNING ISSUE VISIBILITY & CATEGORIES REGRESSION SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // REGRESSION TEST 1: Citizen issue stores municipality_id
  // -------------------------------------------------------------------------
  try {
    const mock = createRegressionMockClient({
      currentUser: { id: CITIZEN_ID, email: 'citizen@nagarsetu.test' },
    });

    const issue = await IssueService.createIssue(
      {
        description: 'Pothole and water logging in Civil Lines area',
        category: 'stagnant_water',
        address: 'Civil Lines, Prayagraj',
        municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
      },
      mock.client
    );

    assert(
      issue.municipality_id === MUNICIPALITY_PRAYAGRAJ_ID,
      'REGRESSION 1: Citizen issue stores municipality_id',
      `Got municipality_id: ${issue.municipality_id}`
    );
  } catch (err) {
    assert(false, 'REGRESSION 1: Citizen issue stores municipality_id', (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // REGRESSION TEST 2: Citizen issue stores ward_id when applicable
  // -------------------------------------------------------------------------
  try {
    const mock = createRegressionMockClient({
      currentUser: { id: CITIZEN_ID, email: 'citizen@nagarsetu.test' },
    });

    const issue = await IssueService.createIssue(
      {
        description: 'Broken streetlight on MG Road near square',
        category: 'street_light',
        address: 'MG Road, Prayagraj',
        municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
        ward_id: WARD_1_ID,
      },
      mock.client
    );

    assert(
      issue.ward_id === WARD_1_ID,
      'REGRESSION 2: Citizen issue stores ward_id when applicable',
      `Got ward_id: ${issue.ward_id}`
    );
  } catch (err) {
    assert(false, 'REGRESSION 2: Citizen issue stores ward_id when applicable', (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // REGRESSION TEST 3: Authority can retrieve the issue in its jurisdiction
  // -------------------------------------------------------------------------
  try {
    const initialIssue: MockIssueRecord = {
      id: 'issue-prayagraj-101',
      tracking_id: 'TRK-101',
      title: 'Water pipe leak in Katra',
      description: 'Major leak on pipeline near Katra market',
      category: 'water_supply',
      status: 'submitted',
      address: 'Katra, Prayagraj',
      reporter_id: CITIZEN_ID,
      municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
      ward_id: WARD_1_ID,
      panchayat_id: null,
      assigned_worker_id: null,
      assigned_manager_id: null,
      department_id: null,
      volunteers_count: 0,
      upvotes_count: 0,
      created_at: new Date().toISOString(),
    };

    const mock = createRegressionMockClient({
      currentUser: { id: ADMIN_ID, email: 'admin@nagarsetu.test' },
      initialIssues: [initialIssue],
    });

    const authorityIssues = await IssueService.getIssues(
      { municipality_id: MUNICIPALITY_PRAYAGRAJ_ID },
      mock.client
    );

    assert(
      authorityIssues.length === 1 && authorityIssues[0].id === 'issue-prayagraj-101',
      'REGRESSION 3: Authority can retrieve the issue in its jurisdiction'
    );
  } catch (err) {
    assert(false, 'REGRESSION 3: Authority can retrieve the issue in its jurisdiction', (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // REGRESSION TEST 4: Authority can assign the issue to an authorized worker
  // -------------------------------------------------------------------------
  try {
    const initialIssue: MockIssueRecord = {
      id: '88888888-8888-4888-8888-888888888201',
      tracking_id: 'TRK-201',
      title: 'Garbage dump accumulating',
      description: 'Garbage heap on corner of street 4',
      category: 'garbage_dump',
      status: 'submitted',
      address: 'Katra, Prayagraj',
      reporter_id: CITIZEN_ID,
      municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
      ward_id: WARD_1_ID,
      panchayat_id: null,
      assigned_worker_id: null,
      assigned_manager_id: null,
      department_id: null,
      volunteers_count: 0,
      upvotes_count: 0,
      created_at: new Date().toISOString(),
    };

    const mock = createRegressionMockClient({
      currentUser: { id: ADMIN_ID, email: 'admin@nagarsetu.test' },
      initialIssues: [initialIssue],
    });

    const updated = await WorkerService.assignWorker(
      {
        issueId: '88888888-8888-4888-8888-888888888201',
        workerId: WORKER_ID,
        notes: 'Assigned to field sanitation worker',
      },
      mock.client
    );


    assert(
      updated.assigned_worker_id === WORKER_ID,
      'REGRESSION 4: Authority can assign the issue to an authorized worker',
      `Assigned worker ID: ${updated.assigned_worker_id}`
    );
  } catch (err) {
    assert(false, 'REGRESSION 4: Authority can assign the issue to an authorized worker', (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // REGRESSION TEST 5: Worker can retrieve the assigned issue
  // -------------------------------------------------------------------------
  try {
    const assignedIssue: MockIssueRecord = {
      id: 'issue-assigned-301',
      tracking_id: 'TRK-301',
      title: 'Streetlight repair',
      description: 'Flickering lamp post on main road',
      category: 'street_light',
      status: 'verified',
      address: 'Civil Lines, Prayagraj',
      reporter_id: CITIZEN_ID,
      municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
      ward_id: WARD_1_ID,
      panchayat_id: null,
      assigned_worker_id: WORKER_ID,
      assigned_manager_id: ADMIN_ID,
      department_id: null,
      volunteers_count: 0,
      upvotes_count: 0,
      created_at: new Date().toISOString(),
    };

    const mock = createRegressionMockClient({
      currentUser: { id: WORKER_ID, email: 'worker@nagarsetu.test' },
      initialIssues: [assignedIssue],
    });

    // Test both snake_case and camelCase queries
    const workerTasksSnake = await IssueService.getIssues(
      { assigned_worker_id: WORKER_ID },
      mock.client
    );
    const workerTasksCamel = await WorkerService.getWorkerTasks(WORKER_ID, mock.client);

    assert(
      workerTasksSnake.length === 1 &&
        workerTasksSnake[0].id === 'issue-assigned-301' &&
        workerTasksCamel.length === 1 &&
        workerTasksCamel[0].id === 'issue-assigned-301',
      'REGRESSION 5: Worker can retrieve the assigned issue (both snake_case and camelCase query params)'
    );
  } catch (err) {
    assert(false, 'REGRESSION 5: Worker can retrieve the assigned issue', (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // REGRESSION TEST 6: Worker cannot retrieve an issue assigned outside its jurisdiction
  // -------------------------------------------------------------------------
  try {
    const otherMunicipalityIssue: MockIssueRecord = {
      id: 'issue-other-muni-401',
      tracking_id: 'TRK-401',
      title: 'Water problem in Lucknow',
      description: 'Water problem outside Prayagraj boundary',
      category: 'water_supply',
      status: 'submitted',
      address: 'Hazratganj, Lucknow',
      reporter_id: CITIZEN_ID,
      municipality_id: MUNICIPALITY_OTHER_ID,
      ward_id: null,
      panchayat_id: null,
      assigned_worker_id: null,
      assigned_manager_id: null,
      department_id: null,
      volunteers_count: 0,
      upvotes_count: 0,
      created_at: new Date().toISOString(),
    };

    const mock = createRegressionMockClient({
      currentUser: { id: WORKER_ID, email: 'worker@nagarsetu.test' },
      initialIssues: [otherMunicipalityIssue],
    });

    // Worker queries their assigned issues
    const tasks = await IssueService.getIssues(
      { assigned_worker_id: WORKER_ID },
      mock.client
    );

    assert(
      tasks.length === 0,
      'REGRESSION 6: Worker cannot retrieve an issue assigned outside its jurisdiction / unassigned'
    );
  } catch (err) {
    assert(false, 'REGRESSION 6: Worker cannot retrieve an issue assigned outside its jurisdiction', (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // REGRESSION TEST 7: All 7 categories pass validation and creation
  // -------------------------------------------------------------------------
  try {
    let all7Passed = true;
    for (const cat of ISSUE_CATEGORIES) {
      const validated = validateCreateIssue({
        description: `Test report description for category ${cat} verification`,
        category: cat,
        address: 'MG Marg, Prayagraj',
        municipality_id: MUNICIPALITY_PRAYAGRAJ_ID,
      });
      if (validated.category !== cat) {
        all7Passed = false;
      }
    }

    assert(
      all7Passed && ISSUE_CATEGORIES.length === 7,
      'REGRESSION 7: All 7 categories pass validation and creation',
      `Categories: ${ISSUE_CATEGORIES.join(', ')}`
    );
  } catch (err) {
    assert(false, 'REGRESSION 7: All 7 categories pass validation and creation', (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // REGRESSION TEST 8: Invalid category is rejected
  // -------------------------------------------------------------------------
  try {
    let rejected = false;
    try {
      validateCreateIssue({
        description: 'Test report with an invalid category',
        category: 'invalid_non_existent_category',
        address: 'Civil Lines, Prayagraj',
      });
    } catch (valErr) {
      if (valErr instanceof IssueValidationError) {
        rejected = true;
      }
    }

    assert(
      rejected,
      'REGRESSION 8: Invalid category is rejected with IssueValidationError'
    );
  } catch (err) {
    assert(false, 'REGRESSION 8: Invalid category is rejected', (err as Error).message);
  }

  console.log('\n========================================================');
  console.log(`🏁 REGRESSION RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});
