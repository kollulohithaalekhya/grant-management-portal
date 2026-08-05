export type Role = 'ADMIN' | 'GRANT_MANAGER' | 'APPLICANT';
export type AuthProvider = 'LOCAL' | 'GOOGLE';
export type GrantStatus = 'OPEN' | 'CLOSED' | 'DRAFT';
export type AppStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type NotifType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export interface User {
  id: string;
  name: string;
  email: string;
  /** A user can hold several roles at once. */
  roles: Role[];
  provider: AuthProvider;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Grant {
  id: string;
  title: string;
  description: string;
  amount: number;
  deadline: string;
  status: GrantStatus;
  category: string;
  eligibility: string;
  createdById: string;
  createdByName?: string;
  applicationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  grantId: string;
  applicantId: string;
  status: AppStatus;
  projectTitle: string;
  projectDescription: string;
  requestedAmount: number;
  organizationName: string;
  contactEmail: string;
  documents: string[];
  reviewNotes: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  grantTitle?: string;
  applicantName?: string;
  applicantEmail?: string;
  reviewerName?: string | null;
  grant?: Grant;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotifType;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalGrants: number;
  openGrants: number;
  closedGrants: number;
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  totalUsers: number;
  totalFunding: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}
