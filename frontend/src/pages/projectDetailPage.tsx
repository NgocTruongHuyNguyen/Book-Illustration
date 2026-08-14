import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Project } from '@book-studio/shared';
import { getProject, runStep, retryStep, getBookText, ApiError } from '../api/client.js';
import {
  STEP_LABELS,
  statusIndex,
  getCurrentStepKey,
  isStepStale,
  STEP_CAPTIONS,
  imageUrl,
} from '../lib/pipeline.js';

const POLL_INTERVAL_MS = 3000;

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [styleInput, setStyleInput] = useState('');
  const [showBookModal, setShowBookModal] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function refresh() {
    if (!id) return;
    try {
      const { project: p } = await getProject(id);
      setProject(p);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load project.');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    stopPolling();
    if (project && project.stepState === 'RUNNING' && !isStepStale(project.stepState, project.stepStartedAt)) {
      pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.stepState, project?.stepStartedAt]);

  async function handleRunStep() {
    if (!project) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const currentKey = getCurrentStepKey(project.status);
      const style = currentKey === 'STYLE' && styleInput.trim() ? styleInput.trim() : undefined;
      const result = await runStep(project.id, style);
      setProject(result.project);
      if (result.outcome === 'already-running') {
        stopPolling();
        pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong running this step.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRetry() {
    if (!project) return;
    setActionError(null);
    setActionBusy(true);
    try {
      const { project: p } = await retryStep(project.id);
      setProject(p);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong retrying this step.');
    } finally {
      setActionBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="page">
        <button className="btn-link" onClick={() => navigate('/projects')}>← Back to projects</button>
        <p className="error-text" role="alert">{loadError}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page">
        <p className="meta">Loading project…</p>
      </div>
    );
  }

  const idx = statusIndex(project.status);
  const currentKey = getCurrentStepKey(project.status);
  const stale = isStepStale(project.stepState, project.stepStartedAt);
  const running = project.stepState === 'RUNNING' && !stale;
  const failed = project.stepState === 'FAILED';

  // While Portraits/Illustrations run, the relevant grid shows spinners on
  // items that don't have an image path yet — matches the demo's per-item reveal.
  const portraitsRunning = running && currentKey === 'PORTRAITS';
  const illustrationsRunning = running && currentKey === 'ILLUSTRATIONS';

  return (
    <div className="page">
      <button className="btn-link" onClick={() => navigate('/projects')}>← Back to projects</button>
      <h1>{project.title}</h1>
      <p className="meta">Created {new Date(project.createdAt).toLocaleDateString()}</p>

      <div className="stepper">
        {STEP_LABELS.map((label, i) => {
          const done = i < idx;
          const isCurrent = i === idx;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : undefined }}>
              <div className={`step ${done ? 'done' : isCurrent ? 'current' : ''}`}>
                <span className="num">{done ? '✓' : i + 1}</span>
                <span className="lbl">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && <div className={`connector ${i < idx ? 'done' : ''}`} />}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, alignItems: 'start' }}>
        <div>
          {!currentKey ? (
            <div className="card">
              <div className="status-line" style={{ color: 'var(--ink)' }}>
                ✓ All 5 steps complete — nothing left to generate.
              </div>
              <p className="meta" style={{ margin: 0 }}>This project is done. Everything generated is saved.</p>
            </div>
          ) : stale ? (
            <div className="card">
              <div className="status-line" style={{ color: 'var(--ink)' }}>
                This step was interrupted (likely a server restart or dropped connection) and never finished.
              </div>
              <p className="meta">Nothing before this step was affected. Retrying is safe.</p>
              {actionError && <p className="error-text" role="alert">{actionError}</p>}
              <button className="btn" disabled={actionBusy} onClick={handleRetry}>
                Retry {currentKey}
              </button>
            </div>
          ) : failed ? (
            <div className="card">
              <div className="status-line" style={{ color: '#B4270A' }}>
                This step failed: {project.stepError ?? 'Unknown error.'}
              </div>
              <p className="meta">Everything before this step is untouched. Retry only re-runs this step.</p>
              {actionError && <p className="error-text" role="alert">{actionError}</p>}
              <button className="btn" disabled={actionBusy} onClick={handleRetry}>
                Retry {currentKey}
              </button>
            </div>
          ) : running ? (
            <div className="card">
              <div className="status-line">
                <span className="spinner" />
                {STEP_CAPTIONS[currentKey]}…
              </div>
              <p className="meta" style={{ margin: 0 }}>
                Real Gemini calls take 10–30s or longer for images. Reopening this page won't fire a
                second request — it'll just keep showing this in-flight state until it lands.
              </p>
            </div>
          ) : (
            <div className="card">
              <div className="status-line" style={{ color: 'var(--ink)' }}>
                Ready for the next step: <strong>{currentKey}</strong>
              </div>
              {currentKey === 'STYLE' && (
                <div className="field">
                  <label htmlFor="style-input">Art style (optional)</label>
                  <input
                    id="style-input"
                    value={styleInput}
                    onChange={(e) => setStyleInput(e.target.value)}
                    placeholder="Leave blank to let Gemini choose a style based on your book"
                  />
                </div>
              )}
              {actionError && <p className="error-text" role="alert">{actionError}</p>}
              <button className="btn" disabled={actionBusy} onClick={handleRunStep}>
                {actionBusy ? 'Starting…' : `Generate ${currentKey} →`}
              </button>
            </div>
          )}

          {/* Chapters render above Characters, newest-first, matching the demo */}
          {project.chapters.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Chapters ({project.chapters.length})</h3>
              <div className="entity-grid">
                {project.chapters.map((c) => (
                  <div key={c.name} className="entity-card">
                    <div className="art">
                      {c.illustrationPath ? (
                        <img src={imageUrl(project.id, c.illustrationPath)} alt={c.name} />
                      ) : illustrationsRunning ? (
                        <span className="spinner" />
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Not generated yet</span>
                      )}
                    </div>
                    <div className="body">
                      <h5>{c.name}</h5>
                      <p>{c.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project.characters.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Characters ({project.characters.length})</h3>
              <div className="entity-grid">
                {project.characters.map((c) => (
                  <div key={c.name} className="entity-card">
                    <div className="art">
                      {c.portraitPath ? (
                        <img src={imageUrl(project.id, c.portraitPath)} alt={c.name} />
                      ) : portraitsRunning ? (
                        <span className="spinner" />
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Not generated yet</span>
                      )}
                    </div>
                    <div className="body">
                      <h5>{c.name}</h5>
                      <p>{c.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          {project.style ? (
            <>
              <h5 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 8px' }}>Style</h5>
              <p style={{ fontSize: 13, margin: 0 }}>{project.style}</p>
            </>
          ) : (
            <>
              <h5 style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 8px' }}>Book text</h5>
              <p style={{ fontSize: 13, fontStyle: 'italic', margin: 0 }}>
                Saved and ready — style hasn't been generated yet.
              </p>
            </>
          )}
          <button className="btn-link" style={{ marginTop: 8, marginBottom: 0 }} onClick={() => setShowBookModal(true)}>
            Read full text →
          </button>
        </div>
      </div>

      {showBookModal && (
        <BookTextModal projectId={project.id} onClose={() => setShowBookModal(false)} />
      )}
    </div>
  );
}

function BookTextModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBookText(projectId)
      .then(setText)
      .catch(() => setError('Failed to load book text.'));
  }, [projectId]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(35,31,32,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ maxWidth: 600, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={{ margin: 0 }}>Full book text</h4>
          <button className="btn-link" style={{ margin: 0 }} onClick={onClose}>✕</button>
        </div>
        {error && <p className="error-text" role="alert">{error}</p>}
        {!error && text === null && <p className="meta">Loading…</p>}
        {text !== null && <p style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{text}</p>}
      </div>
    </div>
  );
}