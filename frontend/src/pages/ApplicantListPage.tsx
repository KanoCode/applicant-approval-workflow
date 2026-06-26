import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationsApi } from '../api/applications';
import { ApiClientError } from '../api/client';
import type { Application } from '../types';
import { StatusPill } from '../components/StatusPill';
import { Banner } from '../components/Banner';

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ApplicantListPage() {
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    applicationsApi
      .list()
      .then(({ applications: list }) => {
        if (!cancelled) setApplications(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : 'Failed to load your applications.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="main">
      <div className="page-header">
        <h2>My applications</h2>
        <Link to="/applications/new" className="btn btn-primary">
          New application
        </Link>
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      {applications === null && !error && <div className="loading-block">Loading your applications…</div>}

      {applications !== null && applications.length === 0 && (
        <div className="docket">
          <div className="empty-state">
            <h3>No applications yet</h3>
            <p>Start your first request — it'll save as a draft until you submit it.</p>
          </div>
        </div>
      )}

      {applications !== null && applications.length > 0 && (
        <div className="docket">
          <div className="docket-header-row">
            <span>Case</span>
            <span>Title</span>
            <span>Category</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span>Status</span>
            <span></span>
          </div>
          {applications.map((app) => (
            <Link to={`/applications/${app.id}`} className="docket-row" key={app.id}>
              <span className="docket-row__id">#{app.id.slice(0, 8)}</span>
              <span className="docket-row__title">{app.title}</span>
              <span className="docket-row__category">{CATEGORY_LABELS[app.category] ?? app.category}</span>
              <span className="docket-row__amount">{formatAmount(app.amount)}</span>
              <span>
                <StatusPill status={app.status} />
              </span>
              <span className="docket-row__arrow" title={`Updated ${formatDate(app.updatedAt)}`}>
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
