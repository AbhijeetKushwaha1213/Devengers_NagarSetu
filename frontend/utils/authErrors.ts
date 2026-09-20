import { AuthenticationError, AuthErrorCode } from '../../backend/services/auth/types';

/**
 * Maps authentication errors to clean, user-friendly UI messages
 * without leaking internal database schema or account existence.
 */
export function getFriendlyAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthenticationError || (error && typeof error === 'object' && 'code' in error)) {
    const code = (error as { code: AuthErrorCode }).code;
    switch (code) {
      case 'INVALID_CREDENTIALS':
        return 'Invalid email or password.';
      case 'PROFILE_NOT_FOUND':
        return 'Your account profile could not be found. Please contact support.';
      case 'ACCOUNT_INACTIVE':
        return 'Your account is inactive. Please contact an administrator.';
      case 'ACCESS_TYPE_MISMATCH':
        return 'This account does not have access to this portal.';
      default:
        return (error as Error).message || 'Authentication failed. Please try again.';
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
      return 'Invalid email or password.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Please verify your email address before signing in.';
    }
    if (msg.includes('too many requests')) {
      return 'Too many login attempts. Please try again later.';
    }
    return error.message;
  }

  return 'Authentication failed. Please try again.';
}
