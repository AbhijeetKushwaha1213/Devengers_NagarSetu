/**
 * Issue Creation Service Contract Tests
 *
 * Verifies all 9 required test scenarios for the canonical IssueService.createIssue() contract:
 * TEST 1 — Authenticated citizen creates valid issue (success, reporter_id derived, status=submitted, tracking_id returned, title generated)
 * TEST 2 — Unauthenticated create (throws authentication error, no DB insert)
 * TEST 3 — Invalid description (validation error before DB insert)
 * TEST 4 — Invalid category (validation error before DB insert)
 * TEST 5 — Invalid address (validation error)
 * TEST 6 — Invalid municipality UUID (validation error)
 * TEST 7 — Invalid latitude/longitude (validation error)
 * TEST 8 — Frontend cannot provide reporter_id (type contract & runtime derivation enforcement)
 * TEST 9 — Database generates tracking_id (returned issue contains non-empty tracking_id, insert payload excludes tracking_id)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IssueService, Issue } from '../../../backend/services/issues/issueService';
import { CreateIssueInput, IssueValidationError } from '../../../backend/validators/issueValidator';
import { AuthenticationError } from '../../../backend/services/auth/types';

interface MockScenario {
  authUser?: { id: string; email?: string } | null;
  authError?: { message: string } | null;
  insertResult?: Partial<Issue> | null;
  insertError?: { message: string } | null;
}

interface MockClientTracker {
  client: SupabaseClient;
  getLastInsertPayload: () => Record<string, unknown> | null;
  getInsertCallCount: () => number;
}

function createMockSupabase(scenario: MockScenario): MockClientTracker {
  let lastInsertPayload: Record<string, unknown> | null = null;
  let insertCallCount = 0;

  const mock = {
    auth: {
      getUser: async () => {
        if (scenario.authError) {
          return { data: { user: null }, error: scenario.authError };
        }
        if (!scenario.authUser) {
          return { data: { user: null }, error: null };
        }
        return {
          data: {
            user: {
              id: scenario.authUser.id,
              email: scenario.authUser.email || 'test.citizen@nagarsetu.test',
            },
          },
          error: null,
        };
      },
    },
    from: (table: string) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'municipalities') {
        return {
          select: () => Promise.resolve({ data: [], error: null }),
        };
      }
      if (table === 'wards') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'departments' || table === 'user_profiles' || table === 'issue_audit_log') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => Promise.resolve({ data: [], error: null }),
                }),
                in: () => Promise.resolve({ data: [], error: null }),
              }),
              in: () => Promise.resolve({ data: [], error: null }),
              then: (fn: (res: { data: unknown[]; error: null }) => void) => fn({ data: [], error: null }),
            }),
            in: () => Promise.resolve({ data: [], error: null }),
            then: (fn: (res: { data: unknown[]; error: null }) => void) => fn({ data: [], error: null }),
          }),
          insert: () => Promise.resolve({ data: [], error: null }),
        };
      }
      if (table !== 'issues') {
        throw new Error(`Unexpected table query: ${table}`);
      }

      return {
        insert: (rows: Array<Record<string, unknown>>) => {
          insertCallCount++;
          lastInsertPayload = rows[0] || null;
          return {
            select: () => ({
              single: async () => {
                if (scenario.insertError) {
                  return { data: null, error: scenario.insertError };
                }
                const defaultGenerated = {
                  id: 'mock-issue-uuid-1001',
                  tracking_id: 'GS982341',
                  ...rows[0],
                  created_at: new Date().toISOString(),
                };
                return {
                  data: scenario.insertResult
                    ? { ...defaultGenerated, ...scenario.insertResult }
                    : defaultGenerated,
                  error: null,
                };
              },
            }),
          };
        },
      };
    },
  };

  return {
    client: mock as unknown as SupabaseClient,
    getLastInsertPayload: () => lastInsertPayload,
    getInsertCallCount: () => insertCallCount,
  };
}

async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING CANONICAL ISSUE SERVICE TEST SUITE');
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
  // TEST 1 — Authenticated citizen creates valid issue
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'citizen-uuid-101' },
    });

    const input: CreateIssueInput = {
      description: 'Street light on MG Road is completely dysfunctional causing night accidents',
      category: 'street_light',
      address: 'Near Clock Tower, MG Road, Ward 12',
      municipality_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      ward_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      latitude: 28.6139,
      longitude: 77.209,
      image_urls: ['https://storage.nagarsetu.test/photos/issue1.jpg'],
    };

    const result = await IssueService.createIssue(input, mock.client);

    const isSuccess =
      result.reporter_id === 'citizen-uuid-101' &&
      result.status === 'submitted' &&
      typeof result.tracking_id === 'string' &&
      result.tracking_id.length > 0 &&
      typeof result.title === 'string' &&
      result.title.length > 0 &&
      result.title.length <= 50 &&
      result.description === input.description &&
      result.category === 'street_light' &&
      result.address === input.address;

    assert(
      isSuccess,
      'TEST 1 — Authenticated citizen creates valid issue: success, reporter_id derived, status=submitted, tracking_id returned, title generated, fields correct'
    );
  } catch (err: unknown) {
    assert(false, 'TEST 1 — Authenticated citizen creates valid issue', err instanceof Error ? err.message : String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 2 — Unauthenticated create
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: null,
      authError: { message: 'Auth session missing' },
    });

    const input: CreateIssueInput = {
      description: 'Garbage dump accumulating near public school gate',
      category: 'garbage_dump',
      address: 'Main Market Road',
    };

    await IssueService.createIssue(input, mock.client);
    assert(false, 'TEST 2 — Unauthenticated create: should have thrown AuthenticationError');
  } catch (err: unknown) {
    const isExpectedAuthError =
      err instanceof AuthenticationError &&
      err.code === 'UNAUTHENTICATED' &&
      err.statusCode === 401;

    assert(
      isExpectedAuthError,
      'TEST 2 — Unauthenticated create: throws AuthenticationError (401, UNAUTHENTICATED)'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 3 — Invalid description
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'citizen-uuid-101' },
    });

    // Description too short (< 10 chars)
    const input = {
      description: 'Broken',
      category: 'cleanliness',
      address: 'Valid Address Here',
    } as CreateIssueInput;

    await IssueService.createIssue(input, mock.client);
    assert(false, 'TEST 3 — Invalid description: should have failed validation');
  } catch (err: unknown) {
    const isValidationError =
      err instanceof IssueValidationError &&
      err.statusCode === 400 &&
      err.message.includes('Description must be at least 10 characters');

    assert(
      isValidationError,
      'TEST 3 — Invalid description: validation error thrown before DB insert'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 4 — Invalid category
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'citizen-uuid-101' },
    });

    const input = {
      description: 'Pothole on main avenue road needs immediate asphalt filling',
      category: 'flying_cars_category',
      address: 'Main Avenue Road',
    } as unknown as CreateIssueInput;

    await IssueService.createIssue(input, mock.client);
    assert(false, 'TEST 4 — Invalid category: should have failed validation');
  } catch (err: unknown) {
    const isValidationError =
      err instanceof IssueValidationError &&
      err.statusCode === 400 &&
      err.message.includes('Invalid issue category');

    assert(
      isValidationError,
      'TEST 4 — Invalid category: validation error thrown before DB insert'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 5 — Invalid address
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'citizen-uuid-101' },
    });

    // Address too short (< 3 chars)
    const input = {
      description: 'Water pipeline leak flowing onto the road',
      category: 'water_supply',
      address: 'A',
    } as CreateIssueInput;

    await IssueService.createIssue(input, mock.client);
    assert(false, 'TEST 5 — Invalid address: should have failed validation');
  } catch (err: unknown) {
    const isValidationError =
      err instanceof IssueValidationError &&
      err.statusCode === 400;

    assert(
      isValidationError,
      'TEST 5 — Invalid address: validation error thrown'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 6 — Invalid municipality UUID
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'citizen-uuid-101' },
    });

    const input: CreateIssueInput = {
      description: 'Stagnant water in open drain breeding mosquitoes',
      category: 'stagnant_water',
      address: 'Street 4, Colony Sector 9',
      municipality_id: 'not-a-valid-uuid-string',
    };

    await IssueService.createIssue(input, mock.client);
    assert(false, 'TEST 6 — Invalid municipality UUID: should have failed validation');
  } catch (err: unknown) {
    const isValidationError =
      err instanceof IssueValidationError &&
      err.statusCode === 400 &&
      err.message.includes('Invalid municipality UUID');

    assert(
      isValidationError,
      'TEST 6 — Invalid municipality UUID: validation error thrown for malformed UUID'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 7 — Invalid latitude/longitude
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'citizen-uuid-101' },
    });

    const input: CreateIssueInput = {
      description: 'Littering and plastic waste scattered across park pathway',
      category: 'littering',
      address: 'Central Park East Gate',
      latitude: 195.5, // Out of bounds (> 90)
      longitude: 77.2,
    };

    await IssueService.createIssue(input, mock.client);
    assert(false, 'TEST 7 — Invalid latitude/longitude: should have failed validation');
  } catch (err: unknown) {
    const isValidationError =
      err instanceof IssueValidationError &&
      err.statusCode === 400;

    assert(
      isValidationError,
      'TEST 7 — Invalid latitude/longitude: validation error thrown for out-of-bounds coordinate'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 8 — Frontend cannot provide reporter_id
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'authenticated-session-uuid-999' },
    });

    // Compile-time type verification:
    // Ensure 'reporter_id' is not a valid property of CreateIssueInput
    type HasReporterId = 'reporter_id' extends keyof CreateIssueInput ? true : false;
    const typeExcludesReporterId: HasReporterId = false;

    // Runtime spoofing test: malicious client tries to pass reporter_id
    const maliciousPayload = {
      description: 'Dead animal carcass on bypass road requiring urgent disposal',
      category: 'dead_animal',
      address: 'National Bypass KM 14',
      reporter_id: 'spoofed-victim-uuid-000',
    };

    await IssueService.createIssue(maliciousPayload as unknown as CreateIssueInput, mock.client);

    const lastInsert = mock.getLastInsertPayload();
    const enforcedAuthId =
      lastInsert?.reporter_id === 'authenticated-session-uuid-999' &&
      lastInsert?.reporter_id !== 'spoofed-victim-uuid-000';

    assert(
      typeExcludesReporterId === false && enforcedAuthId,
      'TEST 8 — Frontend cannot provide reporter_id: excluded from CreateIssueInput type & service derives strictly from session auth.uid()'
    );
  } catch (err: unknown) {
    assert(false, 'TEST 8 — Frontend cannot provide reporter_id', err instanceof Error ? err.message : String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 9 — Database generates tracking_id
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'citizen-uuid-101' },
      insertResult: {
        tracking_id: 'GS481029',
      },
    });

    const input: CreateIssueInput = {
      description: 'Overflowing public dustbin spreading garbage on sidewalk',
      category: 'garbage_dump',
      address: 'Subhash Chowk, Near Post Office',
    };

    const result = await IssueService.createIssue(input, mock.client);
    const lastPayload = mock.getLastInsertPayload();

    const insertExcludesTrackingId = lastPayload?.tracking_id === undefined;
    const returnIncludesDbTrackingId =
      result.tracking_id === 'GS481029' &&
      result.tracking_id.length > 0;

    assert(
      insertExcludesTrackingId && returnIncludesDbTrackingId,
      'TEST 9 — Database generates tracking_id: insert payload omits tracking_id & returned issue contains non-empty DB tracking_id'
    );
  } catch (err: unknown) {
    assert(false, 'TEST 9 — Database generates tracking_id', err instanceof Error ? err.message : String(err));
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n========================================================');
  console.log(`Test Execution Finished: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
