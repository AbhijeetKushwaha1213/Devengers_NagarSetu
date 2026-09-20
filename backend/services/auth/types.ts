/**
 * Authentication and authorization types for NagarSetu
 */

export type LoginAccessType = 'citizen' | 'authority' | 'worker';

export interface AuthenticatedUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  municipality_id: string | null;
  ward_id: string | null;
  department_id: string | null;
  employee_id: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
  accessType: LoginAccessType;
}

export interface LoginResult {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'PROFILE_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'ACCESS_TYPE_MISMATCH'
  | 'UNAUTHENTICATED';

export class AuthenticationError extends Error {
  readonly code: AuthErrorCode;
  readonly statusCode: number;

  constructor(code: AuthErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode =
      statusCode ??
      (code === 'INVALID_CREDENTIALS' || code === 'UNAUTHENTICATED'
        ? 401
        : code === 'PROFILE_NOT_FOUND'
        ? 404
        : code === 'ACCOUNT_INACTIVE'
        ? 403
        : code === 'ACCESS_TYPE_MISMATCH'
        ? 403
        : 400);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}
