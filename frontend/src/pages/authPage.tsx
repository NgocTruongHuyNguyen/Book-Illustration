import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, ApiError } from '../api/client.js';
import { setCurrentUserEmail, getCurrentUserEmail } from '../api/authStore.js';

export function AuthPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (getCurrentUserEmail()) {
    navigate('/projects', { replace: true });
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Enter your name and a valid email to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await signIn(trimmedEmail, trimmedName);
      setCurrentUserEmail(user.email);
      navigate('/projects');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong signing in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: '40px 32px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 22, marginBottom: 4 }}>Book Illustration Studio</h1>
        <p className="meta" style={{ textAlign: 'center' }}>
          Enter your details to start or resume an illustration project.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mira Hassan"
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mira@example.com"
            />
          </div>

          {error && <p className="error-text" role="alert">{error}</p>}

          <button type="submit" className="btn" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
            {submitting ? 'Continuing…' : 'Continue →'}
          </button>
        </form>

        <p className="meta" style={{ textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
          No password — this is a lightweight identity check. Using an email that
          already has projects resumes them exactly where you left off.
        </p>
      </div>
    </div>
  );
}