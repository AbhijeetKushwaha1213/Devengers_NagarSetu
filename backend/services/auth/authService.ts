import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../lib/supabase';
import {
  AuthenticatedUser,
  AuthenticationError,
  LoginAccessType,
  LoginInput,
  LoginResult,
} from './types';
import { loginSchema } from '../../validators/auth';

function withTimeout<T>(promise: PromiseLike<T>, ms: number, errorMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    }),
    timeoutPromise,
  ]);
}

/**
 * Mapping between login access portals and permitted database user_role values
 */
export const ROLE_ACCESS_MAP: Record<LoginAccessType, readonly string[]> = {
  citizen: ['citizen', 'community_member'],
  authority: ['municipal_admin', 'administrator', 'pradhan'],
  worker: ['worker', 'panchayat_worker'],
} as const;

export class AuthService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = defaultSupabase) {
    this.client = client;
  }

  /**
   * Canonical authentication contract for all access portals:
   * 1. Citizen Access
   * 2. Authority Access
   * 3. Worker Access
   */
  async login(input: LoginInput, clientOverride?: SupabaseClient): Promise<LoginResult> {
    const supabase = clientOverride || this.client;

    // Step 1: Validate input fields
    const validationResult = loginSchema.safeParse(input);
    if (!validationResult.success) {
      throw new AuthenticationError('INVALID_CREDENTIALS', 'Invalid email or password format');
    }

    const { email, password, accessType } = validationResult.data;

    // Step 2: Supabase Auth password verification
    console.log(`[authService] Step 2: Verifying password with Supabase Auth for: ${email}`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      console.warn('[authService] Auth sign in failed:', authError?.message || 'No user/session returned');
      throw new AuthenticationError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    console.log(`[authService] Step 3: Fetching user profile for uid: ${authData.user.id}`);
    // Step 3: Fetch matching user_profiles row with timeout protection
    let profile: Record<string, unknown> | null = null;
    let profileError: unknown = null;

    try {
      const result = await withTimeout(
        supabase
          .from('user_profiles')
          .select('id, full_name, role, is_active, municipality_id, ward_id, department_id, employee_id')
          .eq('id', authData.user.id)
          .maybeSingle(),
        8000,
        'Profile query timeout: user_profiles took longer than 8 seconds'
      );
      profile = result.data;
      profileError = result.error;
    } catch (err) {
      console.error('[authService] user_profiles query timed out or failed:', err);
      profileError = err;
    }

    // Step 4: Validate profile exists
    if (profileError || !profile) {
      if (profileError) {
        console.error('[authService.login] user_profiles query failed:', profileError);
      }
      await supabase.auth.signOut();
      throw new AuthenticationError('PROFILE_NOT_FOUND', 'User profile not found in system.');
    }

    // Step 5: Validate is_active flag
    if (profile.is_active !== true) {
      await supabase.auth.signOut();
      throw new AuthenticationError('ACCOUNT_INACTIVE', 'Account is deactivated. Please contact your municipal administrator.');
    }

    // Step 6: Validate role against requested access portal
    const allowedRoles = ROLE_ACCESS_MAP[accessType];
    if (!allowedRoles || !allowedRoles.includes(profile.role)) {
      await supabase.auth.signOut();
      throw new AuthenticationError(
        'ACCESS_TYPE_MISMATCH',
        `User role '${profile.role}' is not authorized for ${accessType} access.`
      );
    }

    // Step 7: Construct normalized AuthenticatedUser
    const normalizedUser: AuthenticatedUser = {
      id: profile.id,
      email: authData.user.email || email,
      full_name: profile.full_name || '',
      role: profile.role,
      is_active: Boolean(profile.is_active),
      municipality_id: profile.municipality_id || null,
      ward_id: profile.ward_id || null,
      department_id: profile.department_id || null,
      employee_id: profile.employee_id || null,
    };

    // Step 8: Return normalized user + tokens
    return {
      user: normalizedUser,
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
    };
  }

  /**
   * Static alias for convenience
   */
  static async login(input: LoginInput, clientOverride?: SupabaseClient): Promise<LoginResult> {
    return new AuthService().login(input, clientOverride);
  }

  /**
   * Get current authenticated user session
   */
  async getCurrentSession() {
    const { data: { session }, error } = await this.client.auth.getSession();
    if (error) throw error;
    return session;
  }

  static async getCurrentSession() {
    return new AuthService().getCurrentSession();
  }

  /**
   * Fetch user profile from user_profiles table with timeout protection
   */
  async getUserProfile(userId: string) {
    const result = await withTimeout(
      this.client
        .from('user_profiles')
        .select('id, full_name, role, is_active, municipality_id, ward_id, department_id, employee_id')
        .eq('id', userId)
        .maybeSingle(),
      8000,
      'Profile query timeout: user_profiles took longer than 8 seconds'
    );

    if (result.error) throw result.error;
    return result.data;
  }

  static async getUserProfile(userId: string) {
    return new AuthService().getUserProfile(userId);
  }

  /**
   * Sign out current user
   */
  async signOut() {
    return this.client.auth.signOut();
  }

  static async signOut() {
    return new AuthService().signOut();
  }
}

export const authService = new AuthService();
export default authService;
