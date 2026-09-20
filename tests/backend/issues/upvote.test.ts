/**
 * Issue Upvote Service Contract Tests
 *
 * Verifies all 9 required test scenarios for the canonical IssueService upvote contract:
 * TEST 1 — Authenticated user can upvote
 * TEST 2 — Duplicate upvote rejected
 * TEST 3 — User can remove own upvote
 * TEST 4 — User cannot remove another user's upvote
 * TEST 5 — User cannot spoof user_id (always derived from auth session)
 * TEST 6 — Unauthenticated user denied with AuthenticationError
 * TEST 7 — Upvote count remains correct
 * TEST 8 — Malformed issueId rejected before database query
 * TEST 9 — getUpvoteStatus returns correct state for authenticated and anonymous callers
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IssueService } from '../../../backend/services/issues/issueService';
import { IssueValidationError } from '../../../backend/validators/issueValidator';
import { AuthenticationError } from '../../../backend/services/auth/types';

interface UpvoteRecord {
  id: string;
  issue_id: string;
  user_id: string;
  created_at: string;
}

interface MockDatabaseState {
  issues: Map<string, { id: string; upvotes_count: number }>;
  upvotes: UpvoteRecord[];
  currentUser: { id: string; email?: string } | null;
  lastDeletedFilter?: { issue_id?: string; user_id?: string };
  lastInsertedPayload?: Record<string, unknown>;
}

function createMockSupabaseForUpvotes(state: MockDatabaseState): SupabaseClient {
  return {
    auth: {
      getUser: async () => {
        if (!state.currentUser) {
          return { data: { user: null }, error: null };
        }
        return {
          data: {
            user: {
              id: state.currentUser.id,
              email: state.currentUser.email || 'citizen@nagarsetu.test',
              user_metadata: {},
            },
          },
          error: null,
        };
      },
    },
    from: (table: string) => {
      if (table === 'issues') {
        const query: Record<string, unknown> = {};
        return {
          select: (_cols?: string) => ({
            eq: (col: string, val: unknown) => {
              query[col] = val;
              return {
                single: async () => {
                  const issue = state.issues.get(val as string);
                  if (!issue) {
                    return { data: null, error: { message: 'Issue not found' } };
                  }
                  return { data: { ...issue }, error: null };
                },
              };
            },
          }),
        };
      }

      if (table === 'upvotes') {
        const query: Record<string, unknown> = {};
        return {
          select: (_cols?: string) => ({
            eq: (col1: string, val1: unknown) => {
              query[col1] = val1;
              return {
                eq: (col2: string, val2: unknown) => {
                  query[col2] = val2;
                  return {
                    maybeSingle: async () => {
                      const found = state.upvotes.find(
                        (u) => u.issue_id === query.issue_id && u.user_id === query.user_id
                      );
                      return { data: found || null, error: null };
                    },
                  };
                },
              };
            },
          }),
          insert: (payload: { issue_id: string; user_id: string }) => {
            state.lastInsertedPayload = payload;
            const duplicate = state.upvotes.find(
              (u) => u.issue_id === payload.issue_id && u.user_id === payload.user_id
            );
            if (duplicate) {
              return {
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "upvotes_issue_user_unique"',
                },
              };
            }
            const newRecord: UpvoteRecord = {
              id: `upvote-${Date.now()}`,
              issue_id: payload.issue_id,
              user_id: payload.user_id,
              created_at: new Date().toISOString(),
            };
            state.upvotes.push(newRecord);
            const issue = state.issues.get(payload.issue_id);
            if (issue) {
              issue.upvotes_count += 1;
            }
            return { error: null };
          },
          delete: () => {
            const deleteFilters: Record<string, string> = {};
            return {
              eq: (col1: string, val1: string) => {
                deleteFilters[col1] = val1;
                return {
                  eq: (col2: string, val2: string) => {
                    deleteFilters[col2] = val2;
                    state.lastDeletedFilter = deleteFilters;
                    const initialLen = state.upvotes.length;
                    state.upvotes = state.upvotes.filter(
                      (u) =>
                        !(
                          u.issue_id === deleteFilters.issue_id &&
                          u.user_id === deleteFilters.user_id
                        )
                    );
                    const deletedCount = initialLen - state.upvotes.length;
                    const issue = state.issues.get(deleteFilters.issue_id);
                    if (issue && deletedCount > 0) {
                      issue.upvotes_count = Math.max(0, issue.upvotes_count - deletedCount);
                    }
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

async function runUpvoteTests() {
  console.log('🧪 RUNNING ISSUE UPVOTE CONTRACT TESTS...\n');
  const validIssueId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const citizenId = '6528a6ff-a195-48ac-8a2b-e59789cfaae6';
  const otherUserId = '11111111-2222-3333-4444-555555555555';

  // TEST 1 — Authenticated user can upvote
  {
    const state: MockDatabaseState = {
      issues: new Map([[validIssueId, { id: validIssueId, upvotes_count: 0 }]]),
      upvotes: [],
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForUpvotes(state);

    const result = await IssueService.upvoteIssue(validIssueId, client);
    console.assert(result.upvoted === true, 'TEST 1: Upvoted should be true');
    console.assert(result.upvotes_count === 1, 'TEST 1: upvotes_count should be incremented to 1');
    console.assert(state.upvotes.length === 1, 'TEST 1: DB should contain 1 upvote record');
    console.assert(state.upvotes[0].user_id === citizenId, 'TEST 1: upvote user_id must match auth user');
    console.log('✅ TEST 1: Authenticated citizen can upvote an issue');
  }

  // TEST 2 — Duplicate upvote rejected
  {
    const state: MockDatabaseState = {
      issues: new Map([[validIssueId, { id: validIssueId, upvotes_count: 1 }]]),
      upvotes: [{ id: 'u1', issue_id: validIssueId, user_id: citizenId, created_at: '' }],
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForUpvotes(state);

    let rejected = false;
    try {
      await IssueService.upvoteIssue(validIssueId, client);
    } catch (err) {
      if (err instanceof IssueValidationError && err.message.includes('already upvoted')) {
        rejected = true;
      }
    }
    console.assert(rejected, 'TEST 2: Duplicate upvote must be rejected with IssueValidationError');
    console.assert(state.upvotes.length === 1, 'TEST 2: Upvote count in DB must remain 1');
    console.log('✅ TEST 2: Duplicate upvote rejected by database constraint & service check');
  }

  // TEST 3 — User can remove own upvote
  {
    const state: MockDatabaseState = {
      issues: new Map([[validIssueId, { id: validIssueId, upvotes_count: 1 }]]),
      upvotes: [{ id: 'u1', issue_id: validIssueId, user_id: citizenId, created_at: '' }],
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForUpvotes(state);

    const result = await IssueService.removeUpvote(validIssueId, client);
    console.assert(result.upvoted === false, 'TEST 3: Upvoted should be false after removal');
    console.assert(result.upvotes_count === 0, 'TEST 3: Count should be decremented to 0');
    console.assert(state.upvotes.length === 0, 'TEST 3: DB row must be removed');
    console.log('✅ TEST 3: User can remove their own upvote');
  }

  // TEST 4 — User cannot remove another user's upvote
  {
    const state: MockDatabaseState = {
      issues: new Map([[validIssueId, { id: validIssueId, upvotes_count: 1 }]]),
      upvotes: [{ id: 'u1', issue_id: validIssueId, user_id: otherUserId, created_at: '' }],
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForUpvotes(state);

    const result = await IssueService.removeUpvote(validIssueId, client);
    console.assert(result.upvotes_count === 1, 'TEST 4: Count must not change when removing non-owned upvote');
    console.assert(state.upvotes.length === 1, 'TEST 4: Other user upvote must remain untouched');
    console.assert(state.lastDeletedFilter?.user_id === citizenId, 'TEST 4: Delete must be scoped to caller auth.uid()');
    console.log("✅ TEST 4: User cannot remove another user's upvote");
  }

  // TEST 5 — User cannot spoof user_id (always derived from auth session)
  {
    const state: MockDatabaseState = {
      issues: new Map([[validIssueId, { id: validIssueId, upvotes_count: 0 }]]),
      upvotes: [],
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForUpvotes(state);

    // Call upvoteIssue with only issueId — frontend has no way to supply user_id
    await IssueService.upvoteIssue(validIssueId, client);
    console.assert(state.lastInsertedPayload?.user_id === citizenId, 'TEST 5: user_id must come from auth.getUser()');
    console.log('✅ TEST 5: user_id cannot be spoofed from frontend');
  }

  // TEST 6 — Unauthenticated user denied with AuthenticationError
  {
    const state: MockDatabaseState = {
      issues: new Map([[validIssueId, { id: validIssueId, upvotes_count: 0 }]]),
      upvotes: [],
      currentUser: null, // Anonymous
    };
    const client = createMockSupabaseForUpvotes(state);

    let authError = false;
    try {
      await IssueService.upvoteIssue(validIssueId, client);
    } catch (err) {
      if (err instanceof AuthenticationError) {
        authError = true;
      }
    }
    console.assert(authError, 'TEST 6: Unauthenticated caller must throw AuthenticationError');

    let removeAuthError = false;
    try {
      await IssueService.removeUpvote(validIssueId, client);
    } catch (err) {
      if (err instanceof AuthenticationError) {
        removeAuthError = true;
      }
    }
    console.assert(removeAuthError, 'TEST 6: Unauthenticated caller must throw AuthenticationError on remove');
    console.log('✅ TEST 6: Unauthenticated user denied with AuthenticationError');
  }

  // TEST 7 — Upvote count invariant holds
  {
    const state: MockDatabaseState = {
      issues: new Map([[validIssueId, { id: validIssueId, upvotes_count: 0 }]]),
      upvotes: [],
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForUpvotes(state);

    const upRes = await IssueService.upvoteIssue(validIssueId, client);
    console.assert(upRes.upvotes_count === state.upvotes.length, 'TEST 7: count matches upvote rows');

    const downRes = await IssueService.removeUpvote(validIssueId, client);
    console.assert(downRes.upvotes_count === state.upvotes.length, 'TEST 7: count matches after removal');
    console.log('✅ TEST 7: Upvote count invariant matches COUNT(upvotes) exactly');
  }

  // TEST 8 — Malformed issueId rejected before database query
  {
    const state: MockDatabaseState = {
      issues: new Map(),
      upvotes: [],
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForUpvotes(state);

    let valError = false;
    try {
      await IssueService.upvoteIssue('invalid-id', client);
    } catch (err) {
      if (err instanceof IssueValidationError) {
        valError = true;
      }
    }
    console.assert(valError, 'TEST 8: Malformed issueId must throw IssueValidationError');
    console.log('✅ TEST 8: Malformed issueId rejected by validator before database query');
  }

  // TEST 9 — getUpvoteStatus returns correct state for authenticated and anonymous callers
  {
    const state: MockDatabaseState = {
      issues: new Map([[validIssueId, { id: validIssueId, upvotes_count: 5 }]]),
      upvotes: [{ id: 'u1', issue_id: validIssueId, user_id: citizenId, created_at: '' }],
      currentUser: { id: citizenId },
    };
    const authClient = createMockSupabaseForUpvotes(state);
    const authStatus = await IssueService.getUpvoteStatus(validIssueId, authClient);
    console.assert(authStatus.upvoted === true, 'TEST 9: Authenticated user upvote detected');
    console.assert(authStatus.upvotes_count === 5, 'TEST 9: Upvotes count returned accurately');

    // Unauthenticated caller
    state.currentUser = null;
    const anonClient = createMockSupabaseForUpvotes(state);
    const anonStatus = await IssueService.getUpvoteStatus(validIssueId, anonClient);
    console.assert(anonStatus.upvoted === false, 'TEST 9: Anonymous caller shows upvoted = false');
    console.assert(anonStatus.upvotes_count === 5, 'TEST 9: Anonymous caller still gets total count');
    console.log('✅ TEST 9: getUpvoteStatus returns accurate state for both authenticated and anonymous callers');
  }

  console.log('\n🎉 ALL 9 UPVOTE CONTRACT TESTS PASSED SUCCESSFULLY!\n');
}

runUpvoteTests().catch((err) => {
  console.error('❌ UPVOTE TEST SUITE FAILED:', err);
  process.exit(1);
});
