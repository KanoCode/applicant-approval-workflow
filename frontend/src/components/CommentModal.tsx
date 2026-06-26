import { useState, FormEvent } from 'react';

interface CommentModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClassName: string;
  isSubmitting: boolean;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
}

/**
 * Used for both Reject and Return, since both require a non-empty comment
 * server-side. Client-side we mirror that requirement so the person gets
 * immediate feedback instead of a round-trip 400.
 */
export function CommentModal({
  title,
  description,
  confirmLabel,
  confirmClassName,
  isSubmitting,
  onConfirm,
  onCancel,
}: CommentModalProps) {
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = comment.trim();
  const isInvalid = touched && trimmed.length === 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (trimmed.length === 0) return;
    onConfirm(trimmed);
  }

  return (
    <div className="comment-modal-backdrop" onClick={onCancel}>
      <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{description}</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="comment">Comment (required)</label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={isInvalid}
              aria-describedby={isInvalid ? 'comment-error' : undefined}
              autoFocus
              rows={4}
            />
            {isInvalid && (
              <span id="comment-error" className="field-error" role="alert">
                A comment is required for this action.
              </span>
            )}
          </div>
          <div className="comment-modal__actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={`btn ${confirmClassName}`} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
