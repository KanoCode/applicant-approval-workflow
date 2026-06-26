import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { applicationsApi } from '../api/applications';
import { ApiClientError } from '../api/client';
import type { Application, Permissions } from '../types';
import { useAuth } from '../context/AuthContext';
import { StatusPill } from '../components/StatusPill';
import { LedgerStepper } from '../components/LedgerStepper';
import { Banner } from '../components/Banner';
import { CommentModal } from '../components/CommentModal';

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const TRANSITION_VERB: Record<string, string> = {
  DRAFT: 'created',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'claimed for review',
  RETURNED: 'returned for changes',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

type PendingAction = 'reject' | 'return' | null;

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [application, setApplication] = useState<Application | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const reload = useCallback(() => {
    if (!id) return;
    applicationsApi
      .get(id)
      .then(({ application: app, permissions: perms }) => {
        setApplication(app);
        setPermissions(perms);
      })
      .catch((err) => {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load this application.');
      });
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function runAction(action: () => Promise<{ application: Application }>) {
    setActionError(null);
    setIsActing(true);
    try {
      const { application: updated } = await action();
      setApplication(updated);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'That action failed.');
    } finally {
      setIsActing(false);
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setIsActing(true);
    setActionError(null);
    try {
      await applicationsApi.remove(id);
      navigate('/');
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'Failed to delete this application.');
      setIsActing(false);
    }
  }

  if (error) {
    return (
      <div className="main">
        <Banner kind="error">{error}</Banner>
        <Link to="/" className="btn-ghost">
          ← Back
        </Link>
      </div>
    );
  }

  if (!application || !permissions || !user) {
    return (
      <div className="main">
        <div className="loading-block">Loading application…</div>
      </div>
    );
  }

  const isOwner = application.ownerId === user.id;
  const isReviewer = user.role === 'REVIEWER';
  const hasClaimed =  isReviewer && (application.status != 'UNDER_REVIEW');
  const canDecide = isReviewer && (application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW');
  const canClaim = isReviewer && application.status === 'SUBMITTED';
  const isClosed = application.status === 'APPROVED' || application.status === 'REJECTED';

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <span className="page-header__meta">CASE #{application.id.slice(0, 8)}</span>
          <h2 style={{ marginTop: 4 }}>{application.title}</h2>
        </div>
        <StatusPill status={application.status} />
      </div>

      <LedgerStepper status={application.status} />

      {actionError && <Banner kind="error">{actionError}</Banner>}

      <div className="detail-grid">
        <div>
          <div className="panel">
            <h3>Request details</h3>
            <dl style={{ margin: 0 }}>
              <div className="detail-fact">
                <dt>Category</dt>
                <dd>{CATEGORY_LABELS[application.category] ?? application.category}</dd>
              </div>
              <div className="detail-fact">
                <dt>Amount</dt>
                <dd>{formatAmount(application.amount)}</dd>
              </div>
              <div className="detail-fact">
                <dt>Applicant</dt>
                <dd>{application.owner.name}</dd>
              </div>
              <div className="detail-fact">
                <dt>Reviewer</dt>
                <dd>{application.reviewer ? application.reviewer.name : 'Unassigned'}</dd>
              </div>
              <div className="detail-fact">
                <dt>Last updated</dt>
                <dd>{formatDateTime(application.updatedAt)}</dd>
              </div>
            </dl>
            <h3 style={{ marginTop: 20 }}>Description</h3>
            <p className="description-block">{application.description}</p>

            {application.attachmentPath && (
              <a
                className="attachment-link"
                href={`/uploads/${application.attachmentPath}`}
                target="_blank"
                rel="noreferrer"
                style={{ marginTop: 14 }}
              >
                📎 {application.attachmentName ?? 'Attachment'}
              </a>
            )}
          </div>

          <div className="panel">
            <h3>Audit trail</h3>
            {(!application.auditLog || application.auditLog.length === 0) && (
              <p style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>
                No transitions yet — this application is still a draft.
              </p>
            )}
            {application.auditLog && application.auditLog.length > 0 && (
              <div>
                {application.auditLog.map((entry, idx) => (
                  <div className="audit-entry" key={entry.id}>
                    <div className="audit-entry__rail">
                      <div className="audit-entry__dot" />
                      {idx < application.auditLog!.length - 1 && <div className="audit-entry__line" />}
                    </div>
                    <div className="audit-entry__body">
                      <div className="audit-entry__transition">
                        {entry.actor.name} {TRANSITION_VERB[entry.toStatus] ?? 'updated this'}
                      </div>
                      <div className="audit-entry__meta">
                        {entry.fromStatus} → {entry.toStatus} · {formatDateTime(entry.createdAt)}
                      </div>
                      {entry.comment && <div className="audit-entry__comment">{entry.comment}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="panel">
            <h3>Actions</h3>
            <div className="decision-actions">
              {isOwner && permissions.canEdit && (
                <Link to={`/applications/${application.id}/edit`} className="btn btn-secondary">
                  Edit
                </Link>
              )}
              {isOwner && permissions.canSubmit && (
                <button
                  className="btn btn-primary"
                  disabled={isActing}
                  onClick={() => runAction(() => applicationsApi.submit(application.id))}
                >
                  {application.status === 'RETURNED' ? 'Re-submit' : 'Submit'}
                </button>
              )}
              {isOwner && permissions.canDelete && (
                <button className="btn-danger-ghost" disabled={isActing} onClick={handleDelete}>
                  Delete draft
                </button>
              )}
              {isOwner && !permissions.canEdit && !permissions.canSubmit && !isClosed && (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  Waiting on the reviewer — no action needed from you right now.
                </p>
              )}
              {isOwner && isClosed && (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>This case is closed.</p>
              )}

              {canClaim && (
                <button
                  className="btn btn-secondary"
                  disabled={isActing}
                  onClick={() => runAction(() => applicationsApi.claim(application.id))}
                >
                  Claim for review
                </button>
              )}
              {canDecide && (
                <>
                  <button
                    className="btn btn-approve"
                    disabled={isActing}
                    onClick={() => runAction(() => applicationsApi.approve(application.id))}
                  >
                    Approve
                  </button>
                  <button className="btn btn-return" disabled={hasClaimed} onClick={() => setPendingAction('return')}>
                    Return for changes
                  </button>
                  <button className="btn btn-reject" disabled={hasClaimed} onClick={() => setPendingAction('reject')}>
                    Reject
                  </button>
                </>
              )}
              {isReviewer && !canDecide && (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  No reviewer action available for this status.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {pendingAction === 'reject' && (
        <CommentModal
          title="Reject application"
          description="This sends the application back to the applicant as rejected. Explain why so they understand the decision."
          confirmLabel="Reject"
          confirmClassName="btn-reject"
          isSubmitting={isActing}
          onCancel={() => setPendingAction(null)}
          onConfirm={(comment) => runAction(() => applicationsApi.reject(application.id, comment))}
        />
      )}

      {pendingAction === 'return' && (
        <CommentModal
          title="Return for changes"
          description="The applicant will be able to edit and re-submit. Let them know what needs to change."
          confirmLabel="Return"
          confirmClassName="btn-return"
          isSubmitting={isActing}
          onCancel={() => setPendingAction(null)}
          onConfirm={(comment) => runAction(() => applicationsApi.return(application.id, comment))}
        />
      )}
    </div>
  );
}
