import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationsApi } from '../api/applications';
import { ApiClientError } from '../api/client';
import type { Application, ApplicationStatus } from '../types';
import { StatusPill } from '../components/StatusPill';
import { Banner } from '../components/Banner';

const FILTERS: { value: ApplicationStatus | 'ALL' | undefined; label: string }[] = [
  { value: undefined, label: 'Open queue' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

const CATEGORY_LABELS: Record<string, string> = {
  TRAVEL: 'Travel',
  EQUIPMENT: 'Equipment',
  LEAVE: 'Leave',
  EXPENSE: 'Expense',
  OTHER: 'Other',
};

function formatAmount(amount: string): string {
  const n = Number(amount);
  if (Number.isNaN(n) || n === 0) return '—';
  return `$${n.toFixed(2)}`;
}

export function ReviewerQueuePage() {
  const [filter, setFilter] = useState<ApplicationStatus | 'ALL' | undefined>(undefined);
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setApplications(null);
    setError(null);
    applicationsApi
      .list(filter)
      .then(({ applications: list }) => {
        if (!cancelled) setApplications(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load the queue.');
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <div className="main">
      <div className="page-header">
        <h2>Review queue</h2>
        <span className="page-header__meta">
          {applications ? `${applications.length} case${applications.length === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            className={`filter-chip ${filter === f.value ? 'active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {applications === null && !error && <div className="loading-block">Loading the queue…</div>}

      {applications !== null && applications.length === 0 && (
        <div className="docket">
          <div className="empty-state">
            <h3>Nothing here</h3>
            <p>No applications match this filter right now.</p>
          </div>
        </div>
      )}

      {applications !== null && applications.length > 0 && (
        <div className="docket">
          <div className="docket-header-row">
            <span>Case</span>
            <span>Title</span>
            <span>Applicant</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span>Status</span>
            <span></span>
          </div>
          {applications.map((app) => (
            <Link to={`/applications/${app.id}`} className="docket-row" key={app.id}>
              <span className="docket-row__id">#{app.id.slice(0, 8)}</span>
              <span className="docket-row__title">{app.title}</span>
              <span className="docket-row__category">
                {app.owner.name} · {CATEGORY_LABELS[app.category] ?? app.category}
              </span>
              <span className="docket-row__amount">{formatAmount(app.amount)}</span>
              <span>
                <StatusPill status={app.status} />
              </span>
              <span className="docket-row__arrow">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
