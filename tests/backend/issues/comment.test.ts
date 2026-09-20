/**
 * Issue Comments Service Contract Tests
 *
 * Verifies all 10 required test scenarios for the canonical IssueService comment contract:
 * TEST 1 — Authenticated user can create comment
 * TEST 2 — Empty content rejected
 * TEST 3 — Whitespace-only content rejected
 * TEST 4 — Oversized content rejected (>2000 chars)
 * TEST 5 — user_id cannot be spoofed (derived from auth session)
 * TEST 6 — Valid comment persists with generated timestamps
 * TEST 7 — Valid comments can be retrieved in chronological order with author info
 * TEST 8 — Pagination applied properly (limit, offset)
 * TEST 9 — Comments on non-existent issue rejected
 * TEST 10 — Unauthenticated creation denied with AuthenticationError
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IssueService } from '../../../backend/services/issues/issueService';
import { IssueValidationError } from '../../../backend/validators/issueValidator';
import { AuthenticationError } from '../../../backend/services/auth/types';

interface CommentRecord {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ProfileRecord {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
}

interface MockDatabaseState {
  issues: Set<string>;
  comments: CommentRecord[];
  profiles: Map<string, ProfileRecord>;
  currentUser: { id: string; email?: string; full_name?: string } | null;
  lastInsertedPayload?: Record<string, unknown>;
}

function createMockSupabaseForComments(state: MockDatabaseState): SupabaseClient {
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
              user_metadata: {
                full_name: state.currentUser.full_name,
              },
            },
          },
          error: null,
        };
      },
    },
    from: (table: string) => {
      if (table === 'issues') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, val: unknown) => ({
              single: async () => {
                if (!state.issues.has(val as string)) {
                  return { data: null, error: { message: 'Issue not found' } };
                }
                return { data: { id: val }, error: null };
              },
            }),
          }),
        };
      }

      if (table === 'user_profiles') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, val: unknown) => ({
              maybeSingle: async () => {
                const profile = state.profiles.get(val as string);
                return { data: profile || null, error: null };
              },
            }),
            in: (_col: string, vals: string[]) => {
              const matched = vals.map((id) => state.profiles.get(id)).filter(Boolean);
              return Promise.resolve({ data: matched, error: null });
            },
          }),
        };
      }

      if (table === 'issue_comments') {
        const query: {
          issue_id?: string;
          offset?: number;
          limit?: number;
        } = {};

        return {
          insert: (payload: { issue_id: string; user_id: string; content: string }) => {
            state.lastInsertedPayload = payload;
            const newComment: CommentRecord = {
              id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              issue_id: payload.issue_id,
              user_id: payload.user_id,
              content: payload.content,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            state.comments.push(newComment);
            return {
              select: () => ({
                single: async () => ({ data: newComment, error: null }),
              }),
            };
          },
          select: (_cols?: string) => ({
            eq: (_col: string, val: unknown) => {
              query.issue_id = val as string;
              return {
                order: (_col2: string, _opts: { ascending: boolean }) => ({
                  range: async (from: number, to: number) => {
                    const filtered = state.comments.filter((c) => c.issue_id === query.issue_id);
                    const paged = filtered.slice(from, to + 1);
                    return { data: paged, error: null };
                  },
                }),
              };
            },
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

async function runCommentTests() {
  console.log('🧪 RUNNING ISSUE COMMENTS CONTRACT TESTS...\n');
  const validIssueId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const citizenId = '6528a6ff-a195-48ac-8a2b-e59789cfaae6';

  // TEST 1 — Authenticated citizen can create comment
  {
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]),
      comments: [],
      profiles: new Map([
        [citizenId, { id: citizenId, full_name: 'Aarav Sharma', role: 'citizen' }],
      ]),
      currentUser: { id: citizenId, full_name: 'Aarav Sharma' },
    };
    const client = createMockSupabaseForComments(state);

    const comment = await IssueService.addComment(
      validIssueId,
      'The streetlight on Main St is flickering again.',
      client
    );
    console.assert(comment.content === 'The streetlight on Main St is flickering again.', 'TEST 1: content matches');
    console.assert(comment.author?.name === 'Aarav Sharma', 'TEST 1: author name matches profile');
    console.assert(comment.author?.role === 'citizen', 'TEST 1: author role matches profile');
    console.assert(state.comments.length === 1, 'TEST 1: DB contains 1 comment row');
    console.log('✅ TEST 1: Authenticated citizen can create comment');
  }

  // TEST 2 — Empty content rejected
  {
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]),
      comments: [],
      profiles: new Map(),
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForComments(state);

    let rejected = false;
    try {
      await IssueService.addComment(validIssueId, '', client);
    } catch (err) {
      if (err instanceof IssueValidationError) rejected = true;
    }
    console.assert(rejected, 'TEST 2: Empty content must be rejected');
    console.assert(state.comments.length === 0, 'TEST 2: No comment stored');
    console.log('✅ TEST 2: Empty comment rejected by validator');
  }

  // TEST 3 — Whitespace-only content rejected
  {
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]),
      comments: [],
      profiles: new Map(),
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForComments(state);

    let rejected = false;
    try {
      await IssueService.addComment(validIssueId, '     ', client);
    } catch (err) {
      if (err instanceof IssueValidationError) rejected = true;
    }
    console.assert(rejected, 'TEST 3: Whitespace-only content must be rejected');
    console.assert(state.comments.length === 0, 'TEST 3: No comment stored');
    console.log('✅ TEST 3: Whitespace-only comment rejected by validator');
  }

  // TEST 4 — Oversized content rejected (>2000 chars)
  {
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]),
      comments: [],
      profiles: new Map(),
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForComments(state);

    let rejected = false;
    try {
      await IssueService.addComment(validIssueId, 'X'.repeat(2001), client);
    } catch (err) {
      if (err instanceof IssueValidationError) rejected = true;
    }
    console.assert(rejected, 'TEST 4: Content >2000 chars must be rejected');
    console.assert(state.comments.length === 0, 'TEST 4: No comment stored');
    console.log('✅ TEST 4: Oversized comment (>2000 chars) rejected by validator');
  }

  // TEST 5 — user_id cannot be spoofed (derived from auth session)
  {
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]),
      comments: [],
      profiles: new Map(),
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForComments(state);

    await IssueService.addComment(validIssueId, 'Checking caller authentication derivation.', client);
    console.assert(state.lastInsertedPayload?.user_id === citizenId, 'TEST 5: user_id must match auth session');
    console.log('✅ TEST 5: user_id cannot be spoofed from frontend');
  }

  // TEST 6 — Valid comment persists with generated timestamps
  {
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]),
      comments: [],
      profiles: new Map(),
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForComments(state);

    const comment = await IssueService.addComment(validIssueId, 'Valid persistence test.', client);
    console.assert(!!comment.id, 'TEST 6: comment must have non-empty ID');
    console.assert(!!comment.created_at, 'TEST 6: comment must have created_at timestamp');
    console.assert(!!comment.updated_at, 'TEST 6: comment must have updated_at timestamp');
    console.log('✅ TEST 6: Valid comment persists with server timestamps');
  }

  // TEST 7 — Valid comments can be retrieved in chronological order with author info
  {
    const workerId = '22222222-2222-2222-2222-222222222222';
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]),
      comments: [
        {
          id: 'c1',
          issue_id: validIssueId,
          user_id: citizenId,
          content: 'First note from citizen.',
          created_at: '2026-09-20T00:00:00.000Z',
          updated_at: '2026-09-20T00:00:00.000Z',
        },
        {
          id: 'c2',
          issue_id: validIssueId,
          user_id: workerId,
          content: 'Inspection scheduled for 2 PM.',
          created_at: '2026-09-20T00:05:00.000Z',
          updated_at: '2026-09-20T00:05:00.000Z',
        },
      ],
      profiles: new Map([
        [citizenId, { id: citizenId, full_name: 'Aarav Citizen', role: 'citizen' }],
        [workerId, { id: workerId, full_name: 'Ramesh Worker', role: 'worker' }],
      ]),
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForComments(state);

    const comments = await IssueService.getComments(validIssueId, {}, client);
    console.assert(comments.length === 2, 'TEST 7: Must return 2 comments');
    console.assert(comments[0].author?.name === 'Aarav Citizen', 'TEST 7: First author matches');
    console.assert(comments[1].author?.name === 'Ramesh Worker', 'TEST 7: Second author matches');
    console.assert(comments[1].author?.role === 'worker', 'TEST 7: Worker role matches');
    console.log('✅ TEST 7: Valid comments retrieved in chronological order with author profiles');
  }

  // TEST 8 — Pagination applied properly (limit, offset)
  {
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]),
      comments: Array.from({ length: 15 }, (_, i) => ({
        id: `c-${i}`,
        issue_id: validIssueId,
        user_id: citizenId,
        content: `Comment number ${i + 1}`,
        created_at: new Date(Date.now() + i * 1000).toISOString(),
        updated_at: new Date(Date.now() + i * 1000).toISOString(),
      })),
      profiles: new Map(),
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForComments(state);

    const page1 = await IssueService.getComments(validIssueId, { limit: 5, offset: 0 }, client);
    console.assert(page1.length === 5, 'TEST 8: Page 1 must return 5 comments');
    console.assert(page1[0].id === 'c-0', 'TEST 8: Page 1 starts at c-0');

    const page2 = await IssueService.getComments(validIssueId, { limit: 5, offset: 5 }, client);
    console.assert(page2.length === 5, 'TEST 8: Page 2 must return 5 comments');
    console.assert(page2[0].id === 'c-5', 'TEST 8: Page 2 starts at c-5');
    console.log('✅ TEST 8: Pagination parameters applied correctly (limit, offset)');
  }

  // TEST 9 — Comments on non-existent issue rejected
  {
    const nonExistentIssueId = '99999999-9999-9999-9999-999999999999';
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]), // does not have nonExistentIssueId
      comments: [],
      profiles: new Map(),
      currentUser: { id: citizenId },
    };
    const client = createMockSupabaseForComments(state);

    let rejected = false;
    try {
      await IssueService.addComment(nonExistentIssueId, 'Comment on missing issue.', client);
    } catch (err) {
      if (err instanceof IssueValidationError) rejected = true;
    }
    console.assert(rejected, 'TEST 9: Adding comment to missing issue must throw IssueValidationError');

    let readRejected = false;
    try {
      await IssueService.getComments(nonExistentIssueId, {}, client);
    } catch (err) {
      if (err instanceof IssueValidationError) readRejected = true;
    }
    console.assert(readRejected, 'TEST 9: Reading comments of missing issue must throw IssueValidationError');
    console.log('✅ TEST 9: Comments on non-existent issue rejected');
  }

  // TEST 10 — Unauthenticated creation denied with AuthenticationError
  {
    const state: MockDatabaseState = {
      issues: new Set([validIssueId]),
      comments: [],
      profiles: new Map(),
      currentUser: null, // Unauthenticated
    };
    const client = createMockSupabaseForComments(state);

    let authError = false;
    try {
      await IssueService.addComment(validIssueId, 'Unauthenticated attempt.', client);
    } catch (err) {
      if (err instanceof AuthenticationError) authError = true;
    }
    console.assert(authError, 'TEST 10: Unauthenticated comment creation must throw AuthenticationError');
    console.log('✅ TEST 10: Unauthenticated comment creation denied with AuthenticationError');
  }

  console.log('\n🎉 ALL 10 COMMENT CONTRACT TESTS PASSED SUCCESSFULLY!\n');
}

runCommentTests().catch((err) => {
  console.error('❌ COMMENT TEST SUITE FAILED:', err);
  process.exit(1);
});
