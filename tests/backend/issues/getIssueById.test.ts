/**
 * Issue Detail / Single Issue Retrieval Service Contract Tests
 *
 * Verifies all required test scenarios for the canonical IssueService.getIssueById() contract:
 * TEST 1 — Valid UUID queries .eq('id', uuid)
 * TEST 2 — Valid tracking ID queries .eq('tracking_id', trackingId)
 * TEST 3 — Non-existent issue returns null cleanly
 * TEST 4 — Empty string throws IssueValidationError before DB query
 * TEST 5 — Whitespace-only string throws IssueValidationError before DB query
 * TEST 6 — Special characters/symbols throw IssueValidationError before DB query
 * TEST 7 — Non-string / null / undefined throws IssueValidationError
 * TEST 8 — Database error is properly propagated
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IssueService, Issue } from '../../../backend/services/issues/issueService';
import { IssueValidationError } from '../../../backend/validators/issueValidator';

interface QueryCallTracker {
  eqCalls: Array<{ column: string; value: unknown }>;
  tableQueried?: string;
}

function createMockSupabaseClient(
  mockIssue: Issue | null = null,
  mockError: { message: string } | null = null
): { client: SupabaseClient; tracker: QueryCallTracker } {
  const tracker: QueryCallTracker = {
    eqCalls: [],
  };

  interface MockQueryBuilder {
    select: (cols?: string) => MockQueryBuilder;
    eq: (column: string, value: unknown) => MockQueryBuilder;
    maybeSingle: () => Promise<{ data: Issue | null; error: { message: string } | null }>;
  }

  const queryBuilder: MockQueryBuilder = {
    select: () => queryBuilder,
    eq: (column: string, value: unknown) => {
      tracker.eqCalls.push({ column, value });
      return queryBuilder;
    },
    maybeSingle: async () => {
      if (mockError) return { data: null, error: mockError };
      return { data: mockIssue, error: null };
    },
  };

  const mockClient = {
    from: (table: string) => {
      tracker.tableQueried = table;
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
  title: 'Streetlight outage',
  description: 'Streetlight pole #42 is dark at night',
  category: 'street_light',
  status: 'submitted',
  address: 'Ring Road, Sector 3',
  reporter_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  priority_score: 40,
  upvotes_count: 3,
  volunteers_count: 1,
  created_at: '2026-09-19T11:00:00Z',
};

async function runTests() {
  console.log('🧪 Running IssueService.getIssueById() Contract Tests...\n');
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

  // TEST 1 — Valid UUID queries .eq('id', uuid)
  {
    const { client, tracker } = createMockSupabaseClient(sampleIssue);
    const result = await IssueService.getIssueById(sampleIssue.id, client);
    assert(result?.id === sampleIssue.id, 'Returns issue matching UUID');
    assert(tracker.tableQueried === 'issues', 'Queries public.issues table');
    assert(
      tracker.eqCalls.some((c) => c.column === 'id' && c.value === sampleIssue.id),
      'UUID lookup queries .eq(id, uuid)'
    );
  }

  // TEST 2 — Valid tracking ID queries .eq('tracking_id', trackingId)
  {
    const trackingId = 'GS123456';
    const { client, tracker } = createMockSupabaseClient(sampleIssue);
    const result = await IssueService.getIssueById(trackingId, client);
    assert(result?.tracking_id === trackingId, 'Returns issue matching tracking_id');
    assert(
      tracker.eqCalls.some((c) => c.column === 'tracking_id' && c.value === trackingId),
      'Tracking ID lookup queries .eq(tracking_id, trackingId)'
    );
  }

  // TEST 3 — Non-existent issue returns null cleanly
  {
    const { client } = createMockSupabaseClient(null);
    const result = await IssueService.getIssueById('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', client);
    assert(result === null, 'Non-existent issue returns null without error');
  }

  // TEST 4 — Empty string throws IssueValidationError before DB query
  {
    const { client, tracker } = createMockSupabaseClient();
    try {
      await IssueService.getIssueById('', client);
      assert(false, 'Should throw IssueValidationError on empty string');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'Throws IssueValidationError on empty ID');
      assert(tracker.eqCalls.length === 0, 'Does not query database on empty ID');
    }
  }

  // TEST 5 — Whitespace-only string throws IssueValidationError before DB query
  {
    const { client, tracker } = createMockSupabaseClient();
    try {
      await IssueService.getIssueById('    ', client);
      assert(false, 'Should throw IssueValidationError on whitespace string');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'Throws IssueValidationError on whitespace ID');
      assert(tracker.eqCalls.length === 0, 'Does not query database on whitespace ID');
    }
  }

  // TEST 6 — Special characters/symbols throw IssueValidationError before DB query
  {
    const { client, tracker } = createMockSupabaseClient();
    try {
      await IssueService.getIssueById('invalid!@#$%^&*()', client);
      assert(false, 'Should throw IssueValidationError on symbols in ID');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'Throws IssueValidationError on invalid characters');
      assert(tracker.eqCalls.length === 0, 'Does not query database on invalid characters');
    }
  }

  // TEST 7 — Non-string / null / undefined throws IssueValidationError
  {
    const { client } = createMockSupabaseClient();
    try {
      await IssueService.getIssueById(null as unknown as string, client);
      assert(false, 'Should throw on null');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'Throws IssueValidationError on null');
    }

    try {
      await IssueService.getIssueById(undefined as unknown as string, client);
      assert(false, 'Should throw on undefined');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'Throws IssueValidationError on undefined');
    }

    try {
      await IssueService.getIssueById(12345 as unknown as string, client);
      assert(false, 'Should throw on number');
    } catch (err) {
      assert(err instanceof IssueValidationError, 'Throws IssueValidationError on number');
    }
  }

  // TEST 8 — Database error is properly propagated
  {
    const dbErr = { message: 'Database connection failed' };
    const { client } = createMockSupabaseClient(null, dbErr);
    try {
      await IssueService.getIssueById(sampleIssue.id, client);
      assert(false, 'Should propagate database error');
    } catch (err: unknown) {
      assert((err as Error).message === dbErr.message, 'Database error is properly thrown');
    }
  }

  console.log(`\n🎉 All ${passed}/${total} IssueService.getIssueById() tests PASSED successfully!`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
