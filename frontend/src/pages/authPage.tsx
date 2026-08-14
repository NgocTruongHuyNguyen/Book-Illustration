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

  // Already signed in — no need to show the form again.
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
    <div>
      <h1>Book Illustration Studio</h1>
      <p>Enter your details to start or resume an illustration project.</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mira Hassan"
          />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="mira@example.com"
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Continuing…' : 'Continue →'}
        </button>
      </form>
      <p>
        No password — this is a lightweight identity check. Using an email that
        already has projects resumes them exactly where you left off.
      </p>
    </div>
  );
}
