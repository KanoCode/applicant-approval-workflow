import { useState, FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../api/client';
import { Banner } from '../components/Banner';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
    return <Navigate to={from ?? '/'} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Something went wrong while signing in.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillSeed(seedEmail: string) {
    setEmail(seedEmail);
    setPassword('password123');
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <span className="mark">CW-01 · CASEWORK</span>
        <h1>Sign in</h1>
        <p className="subtitle">Submit requests, or review and decide on them.</p>

        {error && <Banner kind="error">{error}</Banner>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="seed-hint">
          <p style={{ margin: '0 0 8px' }}>Seeded accounts (password: <code>password123</code>):</p>
          <p style={{ margin: '0 0 4px' }}>
            <button type="button" className="btn-ghost" onClick={() => fillSeed('applicant@example.com')}>
              applicant@example.com
            </button>{' '}
            — Applicant
          </p>
          <p style={{ margin: 0 }}>
            <button type="button" className="btn-ghost" onClick={() => fillSeed('reviewer@example.com')}>
              reviewer@example.com
            </button>{' '}
            — Reviewer
          </p>
        </div>
      </div>
    </div>
  );
}
