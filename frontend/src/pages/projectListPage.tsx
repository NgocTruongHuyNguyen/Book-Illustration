import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '@book-studio/shared';
import { listProjects, ApiError } from '../api/client.js';
import { clearCurrentUserEmail } from '../api/authStore.js';
import { STEP_LABELS, statusIndex, pillLabel, subtitle } from '../lib/pipeline.js';

export function ProjectListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then(({ projects }) => {
        if (!cancelled) setProjects(projects);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load projects.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function signOut() {
    clearCurrentUserEmail();
    navigate('/');
  }

  return (
    <div className="page">
      <div className="topbar">
        <h1>Your projects</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => navigate('/projects/new')}>+ New project</button>
          <button className="btn-secondary btn" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}
      {!error && projects === null && <p className="meta">Loading your projects…</p>}

      {projects !== null && projects.length === 0 && (
        <div className="empty-state">
          <p style={{ marginBottom: 16 }}>No projects yet.</p>
          <button className="btn" onClick={() => navigate('/projects/new')}>+ New project</button>
        </div>
      )}

      {projects !== null && projects.length > 0 && (
        <div>
          {projects.map((p) => {
            const idx = statusIndex(p.status);
            const pillClass = p.status === 'DONE' ? 'done' : p.status === 'CREATED' ? 'draft' : 'progress';
            return (
              <div
                key={p.id}
                className="project-row"
                tabIndex={0}
                role="button"
                onClick={() => navigate(`/projects/${p.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/projects/${p.id}`); }}
              >
                <div className="title">
                  <strong>{p.title}</strong>
                  <span className="subtitle">Created {new Date(p.createdAt).toLocaleDateString()} · {subtitle(p.status)}</span>
                </div>
                <div className="progress-mini" aria-label="Progress">
                  {STEP_LABELS.map((_, i) => (
                    <span key={i} className={`seg ${i < idx ? 'on' : ''}`} />
                  ))}
                </div>
                <span className={`pill ${pillClass}`}>{pillLabel(p.status)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}