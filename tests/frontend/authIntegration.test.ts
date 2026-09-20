/**
 * Frontend Auth Integration Test
 * 
 * Verifies the frontend integration with the canonical authService contract,
 * error translation to friendly messages, and role validation across all 3 portals.
 */

import { AuthService } from '../../backend/services/auth/authService';
import { getFriendlyAuthErrorMessage } from '../../frontend/utils/authErrors';
import { LoginAccessType, AuthenticationError } from '../../backend/services/auth/types';
import { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabase(role: string, isActive = true, failPassword = false) {
  let signOutCalled = false;
  const mock = {
    auth: {
      signInWithPassword: async () => {
        if (failPassword) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
        }
        return {
          data: {
            user: { id: 'usr-123', email: 'test@example.com' },
            session: { access_token: 'token_123', refresh_token: 'ref_123' },
          },
          error: null,
        };
      },
      signOut: async () => {
        signOutCalled = true;
        return { error: null };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'usr-123',
              email: 'test@example.com',
              full_name: 'Test User',
              role,
              is_active: isActive,
            },
            error: null,
          }),
        }),
      }),
    }),
  };
  return { client: mock as unknown as SupabaseClient, getSignOutCalled: () => signOutCalled };
}

async function runIntegrationTests() {
  console.log('🧪 RUNNING FRONTEND AUTH INTEGRATION TESTS...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  const authService = new AuthService();

  // Helper simulating the frontend context login call with error mapping
  async function simulateFrontendLogin(email: string, password: string, accessType: LoginAccessType, mockClient: SupabaseClient) {
    try {
      const result = await authService.login({ email, password, accessType }, mockClient);
      return { success: true, user: result.user, error: null };
    } catch (err) {
      const friendlyMessage = getFriendlyAuthErrorMessage(err);
      return { success: false, user: null, error: friendlyMessage, rawError: err };
    }
  }

  // TEST 1: Citizen account -> Citizen Access -> SUCCESS
  {
    const mock = createMockSupabase('citizen');
    const res = await simulateFrontendLogin('citizen@test.com', 'Pass123', 'citizen', mock.client);
    assert(res.success && res.user?.role === 'citizen', 'TEST 1: Citizen -> Citizen Access succeeds');
  }

  // TEST 2: Citizen account -> Worker Access -> REJECTED with friendly message
  {
    const mock = createMockSupabase('citizen');
    const res = await simulateFrontendLogin('citizen@test.com', 'Pass123', 'worker', mock.client);
    assert(
      !res.success && res.error === 'This account does not have access to this portal.',
      'TEST 2: Citizen -> Worker Access rejected with friendly error'
    );
  }

  // TEST 3: Citizen account -> Authority Access -> REJECTED with friendly message
  {
    const mock = createMockSupabase('citizen');
    const res = await simulateFrontendLogin('citizen@test.com', 'Pass123', 'authority', mock.client);
    assert(
      !res.success && res.error === 'This account does not have access to this portal.',
      'TEST 3: Citizen -> Authority Access rejected with friendly error'
    );
  }

  // TEST 4: Worker account -> Worker Access -> SUCCESS
  {
    const mock = createMockSupabase('worker');
    const res = await simulateFrontendLogin('worker@test.com', 'Pass123', 'worker', mock.client);
    assert(res.success && res.user?.role === 'worker', 'TEST 4: Worker -> Worker Access succeeds');
  }

  // TEST 5: Worker account -> Citizen Access -> REJECTED with friendly message
  {
    const mock = createMockSupabase('worker');
    const res = await simulateFrontendLogin('worker@test.com', 'Pass123', 'citizen', mock.client);
    assert(
      !res.success && res.error === 'This account does not have access to this portal.',
      'TEST 5: Worker -> Citizen Access rejected with friendly error'
    );
  }

  // TEST 6: Authority account -> Authority Access -> SUCCESS
  {
    const mock = createMockSupabase('municipal_admin');
    const res = await simulateFrontendLogin('admin@test.com', 'Pass123', 'authority', mock.client);
    assert(res.success && res.user?.role === 'municipal_admin', 'TEST 6: Authority -> Authority Access succeeds');
  }

  // TEST 7: Authority account -> Worker Access -> REJECTED with friendly message
  {
    const mock = createMockSupabase('municipal_admin');
    const res = await simulateFrontendLogin('admin@test.com', 'Pass123', 'worker', mock.client);
    assert(
      !res.success && res.error === 'This account does not have access to this portal.',
      'TEST 7: Authority -> Worker Access rejected with friendly error'
    );
  }

  // TEST 8: Wrong password -> friendly error
  {
    const mock = createMockSupabase('citizen', true, true);
    const res = await simulateFrontendLogin('citizen@test.com', 'WrongPass', 'citizen', mock.client);
    assert(
      !res.success && res.error === 'Invalid email or password.',
      'TEST 8: Wrong password returns friendly error "Invalid email or password."'
    );
  }

  // TEST 9: Inactive account -> friendly error
  {
    const mock = createMockSupabase('citizen', false);
    const res = await simulateFrontendLogin('citizen@test.com', 'Pass123', 'citizen', mock.client);
    assert(
      !res.success && res.error === 'Your account is inactive. Please contact an administrator.',
      'TEST 9: Inactive account returns friendly error'
    );
  }

  console.log(`\n========================================================`);
  console.log(`Frontend Integration Tests: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================================\n`);

  if (failed > 0) process.exit(1);
}

runIntegrationTests().catch(err => {
  console.error(err);
  process.exit(1);
});
