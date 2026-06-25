export type Role = 'APPLICANT' | 'REVIEWER';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'RETURNED'
  | 'APPROVED'
  | 'REJECTED';

export type Category = 'TRAVEL' | 'EQUIPMENT' | 'LEAVE' | 'EXPENSE' | 'OTHER';

export const CATEGORIES: Category[] = ['TRAVEL', 'EQUIPMENT', 'LEAVE', 'EXPENSE', 'OTHER'];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface UserRef {
  id: string;
  name: string;
  email?: string;
  role?: Role;
}

export interface Application {
  id: string;
  title: string;
  category: Category;
  description: string;
  amount: string; // Prisma Decimal serializes as a string over JSON
  attachmentPath: string | null;
  attachmentName: string | null;
  status: ApplicationStatus;
  ownerId: string;
  owner: UserRef;
  reviewerId: string | null;
  reviewer: UserRef | null;
  createdAt: string;
  updatedAt: string;
  auditLog?: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  applicationId: string;
  actorId: string;
  actor: UserRef;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  comment: string | null;
  createdAt: string;
}

export interface Permissions {
  canEdit: boolean;
  canDelete: boolean;
  canSubmit: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
