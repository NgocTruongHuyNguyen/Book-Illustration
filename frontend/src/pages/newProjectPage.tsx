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
    <div style={{ maxWidth: 460 }}>
      <button onClick={() => navigate('/projects')}>← Back to projects</button>
      <h1>Start a new illustration project</h1>
      <p>Give it a title, then paste the book's text or upload a .txt file.</p>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title">Project title</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Wind in the Willows"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label htmlFor="book-text">Book text</label>
          <div
            style={{
              border: '1.5px dashed #ccc',
              borderRadius: 8,
              padding: 24,
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {fileName ? `✓ ${fileName} loaded` : 'Click to choose a .txt file'}
          </div>
          <input
            id="file-input"
            type="file"
            accept=".txt"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <div style={{ margin: '12px 0', textAlign: 'center', color: '#888', fontSize: 12 }}>
            or paste text
          </div>
          <textarea
            id="book-text"
            rows={6}
            style={{ width: '100%' }}
            value={bookText}
            onChange={(e) => {
              setBookText(e.target.value);
              setFileName(null);
            }}
            placeholder="Once upon a time, in a small burrow by the river..."
          />
        </div>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={submitting} style={{ width: '100%', marginTop: 16 }}>
          {submitting ? 'Creating… this uploads the book and can take a moment' : 'Create project →'}
        </button>
      </form>
    </div>
  );
}