/**
 * Authentication and Login Contract Tests
 * 
 * Verifies all 10 required test scenarios for the canonical authService.login() contract:
 * TEST 1  — Citizen Access (valid credentials)
 * TEST 2  — Worker Access (valid worker profile & field verification)
 * TEST 3  — Authority Access (valid authority/admin account)
 * TEST 4  — Citizen attempting Worker Access (ACCESS_TYPE_MISMATCH)
 * TEST 5  — Citizen attempting Authority Access (ACCESS_TYPE_MISMATCH)
 * TEST 6  — Worker attempting Citizen Access (ACCESS_TYPE_MISMATCH)
 * TEST 7  — Wrong password (INVALID_CREDENTIALS)
 * TEST 8  — Unknown email (INVALID_CREDENTIALS)
 * TEST 9  — Missing profile (PROFILE_NOT_FOUND + signOut called)
 * TEST 10 — Inactive profile (ACCOUNT_INACTIVE + signOut called)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from '../../../backend/services/auth/authService';
import { AuthenticationError } from '../../../backend/services/auth/types';

interface MockScenario {
  signInError?: { message: string } | null;
  authUser?: { id: string; email: string } | null;
  session?: { access_token: string; refresh_token: string } | null;
  profileData?: Record<string, unknown> | null;
  profileError?: { message: string } | null;
}

interface MockClientWithSpies {
  client: SupabaseClient;
  getSignOutCount: () => number;
}

function createMockSupabase(scenario: MockScenario): MockClientWithSpies {
  let signOutCount = 0;

  const mock = {
    auth: {
      signInWithPassword: async ({ email }: { email: string; password?: string }) => {
        if (scenario.signInError) {
          return { data: { user: null, session: null }, error: scenario.signInError };
        }
        return {
          data: {
            user: scenario.authUser ?? { id: 'mock-user-uuid-1', email },
            session: scenario.session ?? {
              access_token: 'mock_jwt_access_token_123',
              refresh_token: 'mock_refresh_token_456',
            },
          },
          error: null,
        };
      },
      signOut: async () => {
        signOutCount++;
        return { error: null };
      },
    },
    from: (table: string) => {
      if (table !== 'user_profiles') {
        throw new Error(`Unexpected table query: ${table}`);
      }
      return {
        select: (_columns: string) => ({
          eq: (_column: string, _value: string) => ({
            maybeSingle: async () => {
              if (scenario.profileError) {
                return { data: null, error: scenario.profileError };
              }
              return { data: scenario.profileData ?? null, error: null };
            },
          }),
        }),
      };
    },
  };

  return {
    client: mock as unknown as SupabaseClient,
    getSignOutCount: () => signOutCount,
  };
}

async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING CANONICAL AUTHENTICATION TEST SUITE');
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

  const authService = new AuthService();

  // -------------------------------------------------------------------------
  // TEST 1 — Citizen
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'cit-uuid-101', email: 'citizen.kumar@example.com' },
      profileData: {
        id: 'cit-uuid-101',
        email: 'citizen.kumar@example.com',
        full_name: 'Rajesh Kumar',
        role: 'citizen',
        is_active: true,
        municipality_id: 'muni-delhi-01',
        ward_id: 'ward-12',
        department_id: null,
        employee_id: null,
      },
    });

    const result = await authService.login(
      {
        email: 'citizen.kumar@example.com',
        password: 'Password@123',
        accessType: 'citizen',
      },
      mock.client
    );

    assert(
      result.user.role === 'citizen' &&
        result.user.full_name === 'Rajesh Kumar' &&
        result.accessToken === 'mock_jwt_access_token_123',
      'TEST 1 — Citizen: valid citizen credentials returns SUCCESS and user.role = "citizen"'
    );
  } catch (err: unknown) {
    assert(false, 'TEST 1 — Citizen', err instanceof Error ? err.message : String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 2 — Worker
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'wrk-uuid-202', email: 'worker.sharma@example.com' },
      profileData: {
        id: 'wrk-uuid-202',
        email: 'worker.sharma@example.com',
        full_name: 'Sunil Sharma',
        role: 'worker',
        is_active: true,
        municipality_id: 'muni-delhi-01',
        ward_id: 'ward-05',
        department_id: 'dept-sanitation-01',
        employee_id: 'EMP-SAN-2024-88',
      },
    });

    const result = await authService.login(
      {
        email: 'worker.sharma@example.com',
        password: 'Password@123',
        accessType: 'worker',
      },
      mock.client
    );

    const verified =
      result.user.role === 'worker' &&
      result.user.is_active === true &&
      result.user.municipality_id === 'muni-delhi-01' &&
      result.user.ward_id === 'ward-05' &&
      result.user.department_id === 'dept-sanitation-01' &&
      result.user.employee_id === 'EMP-SAN-2024-88';

    assert(
      verified,
      'TEST 2 — Worker: valid worker account returns SUCCESS with verified worker fields'
    );
  } catch (err: unknown) {
    assert(false, 'TEST 2 — Worker', err instanceof Error ? err.message : String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 3 — Authority
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'adm-uuid-303', email: 'admin.verma@example.com' },
      profileData: {
        id: 'adm-uuid-303',
        email: 'admin.verma@example.com',
        full_name: 'Pooja Verma',
        role: 'municipal_admin',
        is_active: true,
        municipality_id: 'muni-delhi-01',
        ward_id: null,
        department_id: 'dept-public-works',
        employee_id: 'ADM-MUN-001',
      },
    });

    const result = await authService.login(
      {
        email: 'admin.verma@example.com',
        password: 'Password@123',
        accessType: 'authority',
      },
      mock.client
    );

    assert(
      result.user.role === 'municipal_admin' && result.user.is_active === true,
      'TEST 3 — Authority: valid authority/admin returns SUCCESS for mapped authority role'
    );
  } catch (err: unknown) {
    assert(false, 'TEST 3 — Authority', err instanceof Error ? err.message : String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 4 — Citizen attempting Worker Access
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'cit-uuid-101', email: 'citizen@example.com' },
      profileData: {
        id: 'cit-uuid-101',
        email: 'citizen@example.com',
        full_name: 'Rajesh Kumar',
        role: 'citizen',
        is_active: true,
        municipality_id: 'muni-delhi-01',
        ward_id: 'ward-12',
        department_id: null,
        employee_id: null,
      },
    });

    await authService.login(
      {
        email: 'citizen@example.com',
        password: 'Password@123',
        accessType: 'worker',
      },
      mock.client
    );

    assert(false, 'TEST 4 — Citizen attempting Worker Access: should have thrown ACCESS_TYPE_MISMATCH');
  } catch (err: unknown) {
    assert(
      err instanceof AuthenticationError &&
        err.code === 'ACCESS_TYPE_MISMATCH' &&
        err.statusCode === 403,
      'TEST 4 — Citizen attempting Worker Access: rejects with ACCESS_TYPE_MISMATCH'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 5 — Citizen attempting Authority Access
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'cit-uuid-101', email: 'citizen@example.com' },
      profileData: {
        id: 'cit-uuid-101',
        email: 'citizen@example.com',
        full_name: 'Rajesh Kumar',
        role: 'citizen',
        is_active: true,
        municipality_id: 'muni-delhi-01',
        ward_id: 'ward-12',
        department_id: null,
        employee_id: null,
      },
    });

    await authService.login(
      {
        email: 'citizen@example.com',
        password: 'Password@123',
        accessType: 'authority',
      },
      mock.client
    );

    assert(false, 'TEST 5 — Citizen attempting Authority Access: should have thrown ACCESS_TYPE_MISMATCH');
  } catch (err: unknown) {
    assert(
      err instanceof AuthenticationError &&
        err.code === 'ACCESS_TYPE_MISMATCH' &&
        err.statusCode === 403,
      'TEST 5 — Citizen attempting Authority Access: rejects with ACCESS_TYPE_MISMATCH'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 6 — Worker attempting Citizen Access
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'wrk-uuid-202', email: 'worker@example.com' },
      profileData: {
        id: 'wrk-uuid-202',
        email: 'worker@example.com',
        full_name: 'Sunil Sharma',
        role: 'worker',
        is_active: true,
        municipality_id: 'muni-delhi-01',
        ward_id: 'ward-05',
        department_id: 'dept-sanitation',
        employee_id: 'EMP-1234',
      },
    });

    await authService.login(
      {
        email: 'worker@example.com',
        password: 'Password@123',
        accessType: 'citizen',
      },
      mock.client
    );

    assert(false, 'TEST 6 — Worker attempting Citizen Access: should have thrown ACCESS_TYPE_MISMATCH');
  } catch (err: unknown) {
    assert(
      err instanceof AuthenticationError &&
        err.code === 'ACCESS_TYPE_MISMATCH' &&
        err.statusCode === 403,
      'TEST 6 — Worker attempting Citizen Access: rejects with ACCESS_TYPE_MISMATCH'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 7 — Wrong password
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      signInError: { message: 'Invalid login credentials' },
    });

    await authService.login(
      {
        email: 'citizen@example.com',
        password: 'WrongPassword123',
        accessType: 'citizen',
      },
      mock.client
    );

    assert(false, 'TEST 7 — Wrong password: should have thrown INVALID_CREDENTIALS');
  } catch (err: unknown) {
    assert(
      err instanceof AuthenticationError &&
        err.code === 'INVALID_CREDENTIALS' &&
        err.statusCode === 401,
      'TEST 7 — Wrong password: rejects with INVALID_CREDENTIALS'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 8 — Unknown email
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      signInError: { message: 'User not found' },
    });

    await authService.login(
      {
        email: 'unknown.ghost@example.com',
        password: 'Password@123',
        accessType: 'citizen',
      },
      mock.client
    );

    assert(false, 'TEST 8 — Unknown email: should have thrown INVALID_CREDENTIALS');
  } catch (err: unknown) {
    assert(
      err instanceof AuthenticationError &&
        err.code === 'INVALID_CREDENTIALS' &&
        err.statusCode === 401,
      'TEST 8 — Unknown email: rejects with generic INVALID_CREDENTIALS without leaking email existence'
    );
  }

  // -------------------------------------------------------------------------
  // TEST 9 — Missing profile
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'orphan-uuid-999', email: 'orphan@example.com' },
      profileData: null,
    });

    await authService.login(
      {
        email: 'orphan@example.com',
        password: 'Password@123',
        accessType: 'citizen',
      },
      mock.client
    );

    assert(false, 'TEST 9 — Missing profile: should have thrown PROFILE_NOT_FOUND');
  } catch (err: unknown) {
    assert(
      err instanceof AuthenticationError &&
        err.code === 'PROFILE_NOT_FOUND' &&
        err.statusCode === 404,
      'TEST 9 — Missing profile: throws PROFILE_NOT_FOUND'
    );
  }

  // Verify signOut was called in TEST 9
  try {
    const mock = createMockSupabase({
      authUser: { id: 'orphan-uuid-999', email: 'orphan@example.com' },
      profileData: null,
    });

    try {
      await authService.login(
        {
          email: 'orphan@example.com',
          password: 'Password@123',
          accessType: 'citizen',
        },
        mock.client
      );
    } catch {
      // Expected
    }

    assert(
      mock.getSignOutCount() === 1,
      'TEST 9 (sub) — Missing profile: calls Supabase signOut() to cleanup orphan session'
    );
  } catch (err: unknown) {
    assert(false, 'TEST 9 (sub)', err instanceof Error ? err.message : String(err));
  }

  // -------------------------------------------------------------------------
  // TEST 10 — Inactive profile
  // -------------------------------------------------------------------------
  try {
    const mock = createMockSupabase({
      authUser: { id: 'inactive-uuid-000', email: 'deactivated@example.com' },
      profileData: {
        id: 'inactive-uuid-000',
        email: 'deactivated@example.com',
        full_name: 'Suspended Account',
        role: 'citizen',
        is_active: false,
        municipality_id: null,
        ward_id: null,
        department_id: null,
        employee_id: null,
      },
    });

    await authService.login(
      {
        email: 'deactivated@example.com',
        password: 'Password@123',
        accessType: 'citizen',
      },
      mock.client
    );

    assert(false, 'TEST 10 — Inactive profile: should have thrown ACCOUNT_INACTIVE');
  } catch (err: unknown) {
    assert(
      err instanceof AuthenticationError &&
        err.code === 'ACCOUNT_INACTIVE' &&
        err.statusCode === 403,
      'TEST 10 — Inactive profile: throws ACCOUNT_INACTIVE'
    );
  }

  // Verify signOut was called in TEST 10
  try {
    const mock = createMockSupabase({
      authUser: { id: 'inactive-uuid-000', email: 'deactivated@example.com' },
      profileData: {
        id: 'inactive-uuid-000',
        email: 'deactivated@example.com',
        full_name: 'Suspended Account',
        role: 'citizen',
        is_active: false,
        municipality_id: null,
        ward_id: null,
        department_id: null,
        employee_id: null,
      },
    });

    try {
      await authService.login(
        {
          email: 'deactivated@example.com',
          password: 'Password@123',
          accessType: 'citizen',
        },
        mock.client
      );
    } catch {
      // Expected
    }

    assert(
      mock.getSignOutCount() === 1,
      'TEST 10 (sub) — Inactive profile: calls Supabase signOut() to revoke inactive session'
    );
  } catch (err: unknown) {
    assert(false, 'TEST 10 (sub)', err instanceof Error ? err.message : String(err));
  }

  // -------------------------------------------------------------------------
  // ADDITIONAL TESTS: Role mapping permutations (Rural & Community roles)
  // -------------------------------------------------------------------------
  try {
    // Panchayat worker under worker access
    const mockPanchayatWorker = createMockSupabase({
      profileData: {
        id: 'pwrk-1',
        email: 'pworker@example.com',
        full_name: 'Village Worker',
        role: 'panchayat_worker',
        is_active: true,
      },
    });
    const pWorkerRes = await authService.login(
      { email: 'pworker@example.com', password: 'Password@123', accessType: 'worker' },
      mockPanchayatWorker.client
    );
    assert(
      pWorkerRes.user.role === 'panchayat_worker',
      'ADDITIONAL — Rural worker: panchayat_worker succeeds under "worker" accessType'
    );

    // Pradhan under authority access
    const mockPradhan = createMockSupabase({
      profileData: {
        id: 'prd-1',
        email: 'pradhan@example.com',
        full_name: 'Panchayat Pradhan',
        role: 'pradhan',
        is_active: true,
      },
    });
    const pradhanRes = await authService.login(
      { email: 'pradhan@example.com', password: 'Password@123', accessType: 'authority' },
      mockPradhan.client
    );
    assert(
      pradhanRes.user.role === 'pradhan',
      'ADDITIONAL — Rural authority: pradhan succeeds under "authority" accessType'
    );

    // Administrator under authority access
    const mockAdmin = createMockSupabase({
      profileData: {
        id: 'adm-1',
        email: 'admin@example.com',
        full_name: 'System Admin',
        role: 'administrator',
        is_active: true,
      },
    });
    const adminRes = await authService.login(
      { email: 'admin@example.com', password: 'Password@123', accessType: 'authority' },
      mockAdmin.client
    );
    assert(
      adminRes.user.role === 'administrator',
      'ADDITIONAL — Central authority: administrator succeeds under "authority" accessType'
    );

    // Community member under citizen access
    const mockCommunity = createMockSupabase({
      profileData: {
        id: 'comm-1',
        email: 'community@example.com',
        full_name: 'Community User',
        role: 'community_member',
        is_active: true,
      },
    });
    const commRes = await authService.login(
      { email: 'community@example.com', password: 'Password@123', accessType: 'citizen' },
      mockCommunity.client
    );
    assert(
      commRes.user.role === 'community_member',
      'ADDITIONAL — Citizen variant: community_member succeeds under "citizen" accessType'
    );
  } catch (err: unknown) {
    assert(false, 'ADDITIONAL — Role mapping permutations', err instanceof Error ? err.message : String(err));
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

// Execute tests
runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
