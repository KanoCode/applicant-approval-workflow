import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { applicationsApi, ApplicationFormInput } from '../api/applications';
import { ApiClientError } from '../api/client';
import { CATEGORIES, Category } from '../types';
import { Banner } from '../components/Banner';

const CATEGORY_LABELS: Record<Category, string> = {
  TRAVEL: 'Travel',
  EQUIPMENT: 'Equipment',
  LEAVE: 'Leave',
  EXPENSE: 'Expense',
  OTHER: 'Other',
};

interface FormState {
  title: string;
  category: Category;
  description: string;
  amount: string;
}

interface FieldErrors {
  title?: string;
  category?: string;
  description?: string;
  amount?: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  category: 'OTHER',
  description: '',
  amount: '',
};

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters.';
  }
  if (form.description.trim().length === 0) {
    errors.description = 'Description is required.';
  }
  const amountNum = Number(form.amount);
  if (form.amount.trim() === '' || Number.isNaN(amountNum)) {
    errors.amount = 'Amount must be a number.';
  } else if (amountNum <= 0) {
    errors.amount = 'Amount must be greater than zero.';
  }
  return errors;
}

export function ApplicationFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [existingAttachmentName, setExistingAttachmentName] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    applicationsApi
      .get(id)
      .then(({ application, permissions }) => {
        if (cancelled) return;
        if (!permissions.canEdit) {
          navigate(`/applications/${id}`, { replace: true });
          return;
        }
        setForm({
          title: application.title,
          category: application.category,
          description: application.description,
          amount: application.amount,
        });
        setExistingAttachmentName(application.attachmentName);
      })
      .catch((err) => {
        if (cancelled) return;
        setServerError(err instanceof ApiClientError ? err.message : 'Failed to load this application.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validate(form);
    setErrors(fieldErrors);
    setServerError(null);
    if (Object.keys(fieldErrors).length > 0)return;

    const payload: ApplicationFormInput = {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      amount: Number(form.amount),
    };

    setIsSubmitting(true);
    try {
      const { application } =
        isEditMode && id ? await applicationsApi.update(id, payload) : await applicationsApi.create(payload);

      if (file) {
        await applicationsApi.uploadAttachment(application.id, file);
      }

      navigate(`/applications/${application.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError('Something went wrong while saving.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="main">
        <div className="loading-block">Loading…</div>
      </div>
    );
  }

  return (
    <div className="main">
      <div className="page-header">
        <h2>{isEditMode ? 'Edit application' : 'New application'}</h2>
      </div>

      {serverError && <Banner kind="error">{serverError}</Banner>}

      <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 560 }}>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'title-error' : undefined}
            maxLength={200}
          />
          {errors.title && (
            <span id="title-error" className="field-error" role="alert">
              {errors.title}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="amount">Amount</label>
          <div className="amount-input">
            <span className="prefix">$</span>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? 'amount-error' : undefined}
            />
          </div>
          {errors.amount && (
            <span id="amount-error" className="field-error" role="alert">
              {errors.amount}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'description-error' : undefined}
            rows={6}
          />
          {errors.description && (
            <span id="description-error" className="field-error" role="alert">
              {errors.description}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="attachment">Attachment (optional)</label>
          {existingAttachmentName && !file && (
            <span className="hint">Current file: {existingAttachmentName}. Choose a new file to replace it.</span>
          )}
          <input
            id="attachment"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="hint">PDF, PNG, JPEG, or WebP. Max 5MB.</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(isEditMode && id ? `/applications/${id}` : '/')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
