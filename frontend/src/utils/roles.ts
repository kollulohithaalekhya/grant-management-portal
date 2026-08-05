import { Role, User } from '../types';

/** True when the user holds at least one of the given roles. */
export const hasRole = (user: User | null | undefined, ...roles: Role[]): boolean =>
  !!user && roles.some((role) => user.roles.includes(role));

export const isAdmin = (user: User | null | undefined) => hasRole(user, 'ADMIN');

export const isGrantManager = (user: User | null | undefined) => hasRole(user, 'GRANT_MANAGER');

export const isApplicant = (user: User | null | undefined) => hasRole(user, 'APPLICANT');

/** "GRANT_MANAGER" -> "Grant Manager" */
export const formatRole = (role: string): string =>
  role
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

export const ROLE_LABELS: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'GRANT_MANAGER', label: 'Grant Manager' },
  { value: 'APPLICANT', label: 'Applicant' },
];
