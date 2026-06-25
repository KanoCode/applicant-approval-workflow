import type { ApplicationStatus } from '../types';

const LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  RETURNED: 'Returned',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export function StatusPill({ status }: { status: ApplicationStatus }) {
  return <span className={`status-pill status-${status}`}>{LABELS[status]}</span>;
}

export const STATUS_LABELS = LABELS;
