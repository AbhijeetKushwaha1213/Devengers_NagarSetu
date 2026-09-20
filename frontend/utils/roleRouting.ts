import { LoginAccessType } from '../../backend/services/auth/types';

/**
 * Authoritative role definitions recognized by NagarSetu database
 */
export type DatabaseRole = 
  | 'citizen'
  | 'community_member'
  | 'worker'
  | 'panchayat_worker'
  | 'municipal_admin'
  | 'administrator'
  | 'pradhan';

/**
 * Canonical mapping from database user_profiles.role to product dashboard route
 */
export function getDashboardRouteForRole(role?: string | null): string {
  if (!role) return '/dashboard';

  switch (role) {
    case 'worker':
    case 'panchayat_worker':
      return '/worker/dashboard';

    case 'municipal_admin':
    case 'administrator':
    case 'pradhan':
      return '/authority-dashboard';

    case 'citizen':
    case 'community_member':
    default:
      return '/dashboard';
  }
}

/**
 * Canonical mapping from database user_profiles.role to human-readable display title
 */
export function getRoleDisplayName(role?: string | null): string {
  if (!role) return 'Resident';

  switch (role) {
    case 'worker':
      return 'Municipal Field Worker';
    case 'panchayat_worker':
      return 'Panchayat Field Worker';
    case 'municipal_admin':
      return 'Municipal Administrator';
    case 'administrator':
      return 'Central System Administrator';
    case 'pradhan':
      return 'Gram Pradhan';
    case 'community_member':
      return 'Community Member';
    case 'citizen':
    default:
      return 'Citizen';
  }
}

/**
 * Check if a role belongs to worker or authority personnel
 */
export function isWorkerOrAuthorityRole(role?: string | null): boolean {
  if (!role) return false;
  return [
    'worker',
    'panchayat_worker',
    'municipal_admin',
    'administrator',
    'pradhan'
  ].includes(role);
}

/**
 * Validates whether a user role is authorized for a specific login portal
 */
export function isRoleAllowedForPortal(role: string, portal: LoginAccessType): boolean {
  switch (portal) {
    case 'citizen':
      return ['citizen', 'community_member'].includes(role);
    case 'authority':
      return ['municipal_admin', 'administrator', 'pradhan'].includes(role);
    case 'worker':
      return ['worker', 'panchayat_worker'].includes(role);
    default:
      return false;
  }
}
