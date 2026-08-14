import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject, ApiError } from '../api/client.js';

export function NewProjectPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [bookText, setBookText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      setBookText(text);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedText = bookText.trim();
    if (!trimmedTitle || !trimmedText) {
      setError("Give the project a title and provide the book text (paste or upload).");
      return;
    }

    setSubmitting(true);
    try {
      const { project } = await createProject(trimmedTitle, trimmedText);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong creating the project.');
      setSubmitting(false);
    }
  }

  return (
    <div className="page narrow">
      <button className="btn-link" onClick={() => navigate('/projects')}>← Back to projects</button>
      <h1>Start a new illustration project</h1>
      <p className="meta">Give it a title, then paste the book's text or upload a .txt file.</p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="title">Project title</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Wind in the Willows"
          />
        </div>

        <div className="field">
          <label htmlFor="book-text">Book text</label>
          <div className="dropzone" onClick={() => document.getElementById('file-input')?.click()}>
            {fileName ? `✓ ${fileName} loaded` : 'Click to choose a .txt file'}
          </div>
          <input
            id="file-input"
            type="file"
            accept=".txt"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <div className="divider">or paste text</div>
          <textarea
            id="book-text"
            rows={6}
            value={bookText}
            onChange={(e) => {
              setBookText(e.target.value);
              setFileName(null);
            }}
            placeholder="Once upon a time, in a small burrow by the river..."
          />
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}

        <button type="submit" className="btn" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
          {submitting ? 'Creating… this uploads the book and can take a moment' : 'Create project →'}
        </button>
      </form>
    </div>
  );
}