import type { Project } from '@book-studio/shared';
import { readFile } from '../storage/readFile.js';
import { writeFile } from '../storage/writeFile.js';
import { withLock } from '../storage/withLock.js';
import { getNextStep } from './steps.js';
import { NoNextStepError } from './pipelineErrors.js';

export type RunStepResult =
  | { outcome: 'started'; project: Project }
  | { outcome: 'already-running'; project: Project };

export async function runStep(userEmail: string, projectId: string): Promise<RunStepResult> {
  const claim = await withLock(projectId, async () => {
    const project = await readFile(userEmail, projectId);

    if (project.stepState === 'RUNNING') {
      return { claimed: false as const, project };
    }

    const step = getNextStep(project.status);
    if (!step) {
      throw new NoNextStepError(projectId);
    }

    const updated: Project = {
      ...project,
      stepState: 'RUNNING',
      stepStartedAt: new Date().toISOString(),
      stepError: null,
    };
    await writeFile(updated);
    return { claimed: true as const, project: updated };
  });

  if (!claim.claimed) {
    return { outcome: 'already-running', project: claim.project };
  }

  // The actual step work happens OUTSIDE the lock, so a single slow Gemini call doesn't block reads/writes to this project for its full duration.
  const step = getNextStep(claim.project.status);
  if (!step) {
    throw new NoNextStepError(projectId);
  }

  try {
    const resultFields = await step.run(claim.project);

    await withLock(projectId, async () => {
      const latest = await readFile(userEmail, projectId);
      const finished: Project = {
        ...latest,
        ...resultFields,
        status: step.toStatus,
        stepState: 'IDLE',
        stepStartedAt: null,
        stepError: null,
      };
      await writeFile(finished);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await withLock(projectId, async () => {
      const latest = await readFile(userEmail, projectId);
      const failed: Project = {
        ...latest,
        stepState: 'FAILED',
        stepError: message,
      };
      await writeFile(failed);
    });
    throw err;
  }

  const finalProject = await readFile(userEmail, projectId);
  return { outcome: 'started', project: finalProject };
}

export async function retryStuckStep(userEmail: string, projectId: string): Promise<Project> {
  return withLock(projectId, async () => {
    const project = await readFile(userEmail, projectId);
    const reset: Project = {
      ...project,
      stepState: 'IDLE',
      stepStartedAt: null,
      stepError: null,
    };
    await writeFile(reset);
    return reset;
  });
}

export function isStepStale(project: Project, timeoutMs: number): boolean {
  if (project.stepState !== 'RUNNING' || !project.stepStartedAt) {
    return false;
  }
  const elapsed = Date.now() - new Date(project.stepStartedAt).getTime();
  return elapsed > timeoutMs;
}