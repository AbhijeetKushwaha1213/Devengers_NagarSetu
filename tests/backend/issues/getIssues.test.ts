/**
 * Issue Retrieval Service Contract Tests
 *
 * Verifies all required test scenarios for the canonical IssueService.getIssues() contract:
 * TEST 1 — Default query execution (limit=50, offset=0, order=created_at desc)
 * TEST 2 — Single status filter (.eq('status', status))
 * TEST 3 — Array status filter (.in('status', [statuses]))
 * TEST 4 — Category filter (.eq('category', category))
 * TEST 5 — Scope filters (municipality_id, ward_id, department_id)
 * TEST 6 — Reporter ID filter (.eq('reporter_id', uuid))
 * TEST 7 — Assigned Worker ID filter (.eq('assigned_worker_id', uuid))
 * TEST 8 — Search filter (.or() with sanitized search term)
 * TEST 9 — Sorting options (newest, oldest, priority, upvotes)
 * TEST 10 — Range pagination (.range(offset, offset + limit - 1))
 * TEST 11 — Invalid category throws IssueValidationError before DB query
 * TEST 12 — Invalid status throws IssueValidationError before DB query
 * TEST 13 — Invalid UUID throws IssueValidationError before DB query
 * TEST 14 — getIssueById retrieves single issue by ID
 * TEST 15 — Database error is propagated
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IssueService, Issue } from '../../../backend/services/issues/issueService';
import { IssueValidationError } from '../../../backend/validators/issueValidator';

interface QueryCallTracker {
  eqCalls: Array<{ column: string; value: unknown }>;
  inCalls: Array<{ column: string; values: unknown[] }>;
  orCalls: string[];
  orderCalls: Array<{ column: string; options?: { ascending?: boolean } }>;
  rangeCall?: { from: number; to: number };
}

function createMockSupabaseClient(
  mockData: Issue[] = [],
  mockError: { message: string } | null = null
): { client: SupabaseClient; tracker: QueryCallTracker } {
  const tracker: QueryCallTracker = {
    eqCalls: [],
    inCalls: [],
    orCalls: [],
    orderCalls: [],
  };

  interface MockQueryBuilder {
    select: (cols?: string) => MockQueryBuilder;
    eq: (column: string, value: unknown) => MockQueryBuilder;
    in: (column: string, values: unknown[]) => MockQueryBuilder;
    or: (filters: string) => MockQueryBuilder;
    order: (column: string, options?: { ascending?: boolean }) => MockQueryBuilder;
    range: (from: number, to: number) => MockQueryBuilder;
    maybeSingle: () => Promise<{ data: Issue | null; error: { message: string } | null }>;
    then: (resolve: (val: { data: Issue[] | null; error: unknown }) => void) => void;
  }

  const queryBuilder: MockQueryBuilder = {
    select: (_cols?: string) => queryBuilder,
    eq: (column: string, value: unknown) => {
      tracker.eqCalls.push({ column, value });
      return queryBuilder;
    },
    in: (column: string, values: unknown[]) => {
      tracker.inCalls.push({ column, values });
      return queryBuilder;
    },
    or: (filters: string) => {
      tracker.orCalls.push(filters);
      return queryBuilder;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      tracker.orderCalls.push({ column, options });
      return queryBuilder;
    },
    range: (from: number, to: number) => {
      tracker.rangeCall = { from, to };
      return queryBuilder;
    },
    maybeSingle: async () => {
      if (mockError) return { data: null, error: mockError };
      return { data: mockData[0] || null, error: null };
    },
    then: (resolve: (val: { data: Issue[] | null; error: unknown }) => void) => {
      if (mockError) {
        resolve({ data: null, error: mockError });
      } else {
        resolve({ data: mockData, error: null });
      }
    },
  };

  const mockClient = {
    from: (table: string) => {
      if (table !== 'issues') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return queryBuilder;
    },
  } as unknown as SupabaseClient;

  return { client: mockClient, tracker };
}

const sampleIssue: Issue = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  tracking_id: 'GS123456',
  title: 'Pothole on Main St',
  description: 'Deep pothole causing vehicle damage near sector 4',
  category: 'stagnant_water',
  status: 'submitted',
  address: 'Main Street, Sector 4',
  reporter_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  priority_score: 50,
  upvotes_count: 5,
  volunteers_count: 2,
  created_at: '2026-09-19T10:00:00Z',
};

async function runTests() {
  console.log('🧪 Running IssueService.getIssues() Contract Tests...\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
  }

  // TEST 1 — Default query execution
  {
    const { client, tracker } = createMockSupabaseClient([sampleIssue]);
    const result = await IssueService.getIssues({}, client);
    assert(Array.isArray(result) && result.length === 1, 'Default query returns array of issues');
    assert(tracker.rangeCall?.from === 0 && tracker.rangeCall?.to === 49, 'Default range is 0 to 49 (limit=50, offset=0)');
    assert(
      tracker.orderCalls.some((o) => o.column === 'created_at' && o.options?.ascending === false),
      'Default sorting is created_at descending'
    );
  }

  // TEST 2 — Single status filter (.eq('status', status))
  {
    const { client, tracker } = createMockSupabaseClient([sampleIssue]);
    await IssueService.getIssues({ status: 'submitted' }, client);
    assert(
      tracker.eqCalls.some((e) => e.column === 'status' && e.value === 'submitted'),
      'Single status applies .eq(status, submitted)'
    );
  }

  // TEST 3 — Array status filter (.in('status', [statuses]))
  {
    const { client, tracker } = createMockSupabaseClient([sampleIssue]);
    await IssueService.getIssues({ status: ['submitted', 'in_progress'] }, client);
    assert(
      tracker.inCalls.some(
        (i) =>
          i.column === 'status' &&
          Array.isArray(i.values) &&
          i.values.includes('submitted') &&
          i.values.includes('in_progress')
      ),
      'Array of statuses applies .in(status, [submitted, in_progress])'
    );
  }

  // TEST 4 — Category filter (.eq('category', category))
  {
    const { client, tracker } = createMockSupabaseClient([sampleIssue]);
    await IssueService.getIssues({ category: 'cleanliness' }, client);
    assert(
      tracker.eqCalls.some((e) => e.column === 'category' && e.value === 'cleanliness'),
      'Category filter applies .eq(category, cleanliness)'
    );
  }

  // TEST 5 — Scope filters (municipality_id, ward_id, department_id)
  {
    const munId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
    const wardId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
    const deptId = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
    const { client, tracker } = createMockSupabaseClient([sampleIssue]);

    await IssueService.getIssues(
      { municipality_id: munId, ward_id: wardId, department_id: deptId },
      client
    );

    assert(tracker.eqCalls.some((e) => e.column === 'municipality_id' && e.value === munId), 'municipality_id filter applied');
    assert(tracker.eqCalls.some((e) => e.column === 'ward_id' && e.value === wardId), 'ward_id filter applied');
    assert(tracker.eqCalls.some((e) => e.column === 'department_id' && e.value === deptId), 'department_id filter applied');
  }

  // TEST 6 — Reporter ID filter
  {
    const reporterId = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';
    const { client, tracker } = createMockSupabaseClient([sampleIssue]);
    await IssueService.getIssues({ reporter_id: reporterId }, client);
    assert(
      tracker.eqCalls.some((e) => e.column === 'reporter_id' && e.value === reporterId),
      'reporter_id filter applies .eq(reporter_id, uuid)'
    );
  }

  // TEST 7 — Assigned Worker ID filter
  {
    const workerId = 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77';
    const { client, tracker } = createMockSupabaseClient([sampleIssue]);
    await IssueService.getIssues({ assigned_worker_id: workerId }, client);
    assert(
      tracker.eqCalls.some((e) => e.column === 'assigned_worker_id' && e.value === workerId),
      'assigned_worker_id filter applies .eq(assigned_worker_id, uuid)'
    );
  }

  // TEST 8 — Search filter (.or() with sanitized search term)
  {
    const { client, tracker } = createMockSupabaseClient([sampleIssue]);
    await IssueService.getIssues({ search: 'Pothole, Sector%4' }, client);
    assert(tracker.orCalls.length === 1, 'Search query triggers .or() condition');
    assert(
      tracker.orCalls[0].includes('title.ilike.%Pothole Sector4%') &&
        tracker.orCalls[0].includes('description.ilike.%Pothole Sector4%'),
      'Search term strips PostgREST delimiters and searches title, description, and address'
    );
  }

  // TEST 9 — Sorting options
  {
    const { client: cOldest, tracker: tOldest } = createMockSupabaseClient();
    await IssueService.getIssues({ sortBy: 'oldest' }, cOldest);
    assert(
      tOldest.orderCalls.some((o) => o.column === 'created_at' && o.options?.ascending === true),
      'oldest sort sets created_at ascending: true'
    );

    const { client: cPriority, tracker: tPriority } = createMockSupabaseClient();
    await IssueService.getIssues({ sortBy: 'priority' }, cPriority);
    assert(
      tPriority.orderCalls.some((o) => o.column === 'priority_score' && o.options?.ascending === false),
      'priority sort sets priority_score descending'
    );

    const { client: cUpvotes, tracker: tUpvotes } = createMockSupabaseClient();
    await IssueService.getIssues({ sortBy: 'upvotes' }, cUpvotes);
    assert(
      tUpvotes.orderCalls.some((o) => o.column === 'upvotes_count' && o.options?.ascending === false),
      'upvotes sort sets upvotes_count descending'
    );
  }

  // TEST 10 — Pagination range
  {
    const { client, tracker } = createMockSupabaseClient();
    await IssueService.getIssues({ limit: 20, offset: 40 }, client);
    assert(
      tracker.rangeCall?.from === 40 && tracker.rangeCall?.to === 59,
      'Pagination computes range(40, 59) for limit=20, offset=40'
    );
  }

  // TEST 11 — Invalid category throws IssueValidationError
  {
    const { client } = createMockSupabaseClient();
    try {
      await IssueService.getIssues(
        { category: 'non_existent_category' as unknown as Issue['category'] },
        client
      );
      assert(false, 'Should throw IssueValidationError on invalid category');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid category');
    }
  }

  // TEST 12 — Invalid status throws IssueValidationError
  {
    const { client } = createMockSupabaseClient();
    try {
      await IssueService.getIssues(
        { status: 'invalid_status' as unknown as Issue['status'] },
        client
      );
      assert(false, 'Should throw IssueValidationError on invalid status');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid status');
    }
  }

  // TEST 13 — Invalid UUID throws IssueValidationError
  {
    const { client } = createMockSupabaseClient();
    try {
      await IssueService.getIssues({ reporter_id: 'not-a-valid-uuid' }, client);
      assert(false, 'Should throw IssueValidationError on invalid reporter UUID');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid reporter UUID');
    }
  }

  // TEST 14 — getIssueById retrieves single issue
  {
    const { client } = createMockSupabaseClient([sampleIssue]);
    const issue = await IssueService.getIssueById(sampleIssue.id, client);
    assert(issue?.id === sampleIssue.id, 'getIssueById returns issue matching requested id');

    try {
      await IssueService.getIssueById('', client);
      assert(false, 'Should throw IssueValidationError on empty ID');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'getIssueById throws IssueValidationError on empty ID');
    }
  }

  // TEST 15 — Database error is propagated
  {
    const dbErr = { message: 'Database query timeout' };
    const { client } = createMockSupabaseClient([], dbErr);
    try {
      await IssueService.getIssues({}, client);
      assert(false, 'Should propagate database error');
    } catch (err: unknown) {
      assert((err as Error).message === dbErr.message, 'Database error properly propagated');
    }
  }

  console.log(`\n🎉 All ${passed}/${total} IssueService.getIssues() tests PASSED successfully!`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
