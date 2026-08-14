import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, ProjectStatus } from '@book-studio/shared';
import { listProjects, ApiError } from '../api/client.js';
import { clearCurrentUserEmail } from '../api/authStore.js';

const STEP_LABELS = ['Style', 'Characters', 'Portraits', 'Chapters', 'Illustrations'];
const STATUS_ORDER: ProjectStatus[] = [
  'CREATED',
  'STYLE_SET',
  'CHARACTERS_GENERATED',
  'PORTRAITS_GENERATED',
  'CHAPTERS_GENERATED',
  'DONE',
];

function statusIndex(status: ProjectStatus): number {
  return STATUS_ORDER.indexOf(status);
}

function pillLabel(status: ProjectStatus): string {
  if (status === 'DONE') return 'Done';
  if (status === 'CREATED') return 'Draft';
  return 'In progress';
}

function subtitle(status: ProjectStatus): string {
  if (status === 'CREATED') return 'Book text saved · style not yet generated';
  if (status === 'DONE') return 'All 5 steps complete';
  const idx = statusIndex(status);
  return STEP_LABELS.slice(0, idx).join(' + ') + ' done';
}

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Your projects</h1>
        <div>
          <button onClick={() => navigate('/projects/new')}>+ New project</button>
          <button onClick={signOut}>Sign out</button>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      {!error && projects === null && <p>Loading your projects…</p>}

      {projects !== null && projects.length === 0 && (
        <div>
          <p>No projects yet.</p>
          <button onClick={() => navigate('/projects/new')}>+ New project</button>
        </div>
      )}

      {projects !== null && projects.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {projects.map((p) => {
            const idx = statusIndex(p.status);
            return (
              <li
                key={p.id}
                tabIndex={0}
                role="button"
                onClick={() => navigate(`/projects/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/projects/${p.id}`);
                }}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <strong>{p.title}</strong>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Created {new Date(p.createdAt).toLocaleDateString()} · {subtitle(p.status)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }} aria-label="Progress">
                  {STEP_LABELS.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 18,
                        height: 4,
                        borderRadius: 2,
                        background: i < idx ? '#FF6B00' : '#ddd',
                        display: 'inline-block',
                      }}
                    />
                  ))}
                </div>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    background: p.status === 'DONE' ? '#231F20' : p.status === 'CREATED' ? '#919699' : '#FF6B00',
                  }}
                >
                  {pillLabel(p.status)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}