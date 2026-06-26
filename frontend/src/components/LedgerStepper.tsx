import type { ApplicationStatus } from '../types';

// The "happy path" spine the stepper always draws, regardless of where the
// application actually ends up. REJECTED and RETURNED are excursions off
// this spine, shown as a stamp rather than as their own column, so the
// stepper doesn't have to branch visually.
const SPINE: { status: ApplicationStatus; label: string }[] = [
  { status: 'DRAFT', label: 'Draft' },
  { status: 'SUBMITTED', label: 'Submitted' },
  { status: 'UNDER_REVIEW', label: 'Under review' },
  { status: 'APPROVED', label: 'Approved' },
];

const STAMP_COLOR: Record<ApplicationStatus, string> = {
  DRAFT: 'var(--status-draft)',
  SUBMITTED: 'var(--status-submitted)',
  UNDER_REVIEW: 'var(--status-review)',
  RETURNED: 'var(--status-returned)',
  APPROVED: 'var(--status-approved)',
  REJECTED: 'var(--status-rejected)',
};

const STAMP_TEXT: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'In review',
  RETURNED: 'Returned',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

function spineIndexFor(status: ApplicationStatus): number {
  if (status === 'REJECTED' || status === 'RETURNED') {
    // Both excursions branch off after SUBMITTED/UNDER_REVIEW; visually we
    // treat them as having reached at least the SUBMITTED step.
    return 1;
  }
  const idx = SPINE.findIndex((s) => s.status === status);
  return idx === -1 ? 0 : idx;
}

export function LedgerStepper({ status }: { status: ApplicationStatus }) {
  const currentIndex = spineIndexFor(status);
  const isExcursion = status === 'REJECTED' || status === 'RETURNED';

  return (
    <div className="ledger-stepper" role="img" aria-label={`Application status: ${STAMP_TEXT[status]}`}>
      {SPINE.map((step, idx) => {
        const isDone = idx < currentIndex || (idx === currentIndex && !isExcursion);
        const isCurrentSpineStep = idx === currentIndex;
        const showStampHere = isCurrentSpineStep;

        return (
          <div className="ledger-step" key={step.status}>
            {idx > 0 && (
              <div className={`ledger-step__connector ${idx <= currentIndex ? 'filled' : ''}`} />
            )}
            <div style={{ position: 'relative' }}>
              {showStampHere && (
                <span className="ledger-stamp" style={{ color: STAMP_COLOR[status] }}>
                  {STAMP_TEXT[status]}
                </span>
              )}
              <div className={`ledger-step__dot ${isDone ? 'done' : ''}`} />
            </div>
            <span className={`ledger-step__label ${isCurrentSpineStep ? 'current' : ''}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
