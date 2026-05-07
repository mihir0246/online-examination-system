/**
 * Shared type definitions for the frontend.
 * Mirrors the backend Prisma User/Trainee models exactly
 * so TypeScript can catch role mismatches at compile time.
 */

// User roles — must match the backend 'type' field on User model
export type UserRole = 'ADMIN' | 'TRAINER' | 'TRAINEE';

// The shape returned by /api/v1/login and stored in Redux
export interface AuthUser {
  id: string;
  name: string;
  emailid: string;
  type: UserRole;
}

// Trainee-specific profile (from /trainee/details)
export interface TraineeProfile {
  id: string;
  name: string;
  emailid: string;
  contact: string;
  organisation: string;
  location: string;
  testId: string;
  consentGivenAt?: string;
}

// Generic paginated API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
