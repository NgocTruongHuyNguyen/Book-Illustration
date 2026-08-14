import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Project } from '@book-studio/shared';
import { writeFile } from '../storage/writeFile.js';
import { readFile } from '../storage/readFile.js';
import { runStep, retryStuckStep, isStepStale } from './pipipelineService.js';
import * as stepsModule from './steps.js';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    userEmail: 'test@example.com',
    title: 'Test Book',
    bookTextPath: '/data/books/p1.txt',
    createdAt: new Date().toISOString(),
    status: 'CREATED',
    stepState: 'IDLE',
    stepStartedAt: null,
    stepError: null,
    textChainLastId: null,
    imageChainLastId: null,
    style: null,
    characters: [],
    chapters: [],
    ...overrides,
  };
}

let tempDataDir: string;

beforeEach(async () => {
  tempDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'book-studio-test-'));
  process.env.DATA_DIR = tempDataDir;
});

afterEach(async () => {
  await fs.rm(tempDataDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  vi.restoreAllMocks();
});

describe('runStep', () => {
  it('runs the STYLE step for a freshly created project and advances status', async () => {
    const project = makeProject();
    await writeFile(project);

    const result = await runStep(project.userEmail, project.id);

    expect(result.outcome).toBe('started');
    expect(result.project.status).toBe('STYLE_SET');
    expect(result.project.stepState).toBe('IDLE');
    expect(result.project.style).toBeTruthy();
  });

  it('runs steps strictly in order — cannot skip to CHARACTERS before STYLE', async () => {
    const project = makeProject({ status: 'CREATED' });
    await writeFile(project);

    const result = await runStep(project.userEmail, project.id);

    expect(result.project.status).toBe('STYLE_SET');
  });

  it('does not run a second Gemini call while a step is already RUNNING', async () => {
    const project = makeProject({
      status: 'CREATED',
      stepState: 'RUNNING',
      stepStartedAt: new Date().toISOString(),
    });
    await writeFile(project);

    const runSpy = vi.spyOn(stepsModule, 'getNextStep');

    const result = await runStep(project.userEmail, project.id);

    expect(result.outcome).toBe('already-running');
    // status must be untouched 
    expect(result.project.status).toBe('CREATED');
    runSpy.mockRestore();
  });

  it('records a failure and sets stepState to FAILED when a step throws', async () => {
    const project = makeProject({ status: 'CREATED' });
    await writeFile(project);

    const spy = vi.spyOn(stepsModule, 'getNextStep').mockReturnValue({
      key: 'STYLE',
      fromStatus: 'CREATED',
      toStatus: 'STYLE_SET',
      run: vi.fn().mockRejectedValue(new Error('gemini exploded')),
    });

    await expect(runStep(project.userEmail, project.id)).rejects.toThrow('gemini exploded');

    const afterFailure = await readFile(project.userEmail, project.id);
    expect(afterFailure.stepState).toBe('FAILED');
    expect(afterFailure.stepError).toBe('gemini exploded');
    expect(afterFailure.status).toBe('CREATED'); // status did not advance

    spy.mockRestore();
  });

  it('allows retrying only the failed step, leaving earlier progress untouched', async () => {
    const project = makeProject({
      status: 'STYLE_SET',
      style: 'already generated style',
    });
    await writeFile(project);

    const result = await runStep(project.userEmail, project.id);

    expect(result.project.status).toBe('CHARACTERS_GENERATED');
    expect(result.project.style).toBe('already generated style'); // untouched
  });

  it('throws when there is no next step (project already DONE)', async () => {
    const project = makeProject({ status: 'DONE' });
    await writeFile(project);

    await expect(runStep(project.userEmail, project.id)).rejects.toThrow();
  });
});

describe('retryStuckStep', () => {
  it('resets a stranded RUNNING step back to IDLE without touching progress', async () => {
    const project = makeProject({
      status: 'CHARACTERS_GENERATED',
      stepState: 'RUNNING',
      stepStartedAt: new Date(Date.now() - 999999).toISOString(),
      characters: [{ name: 'Existing', prompt: 'p', portraitPath: null }],
    });
    await writeFile(project);

    const reset = await retryStuckStep(project.userEmail, project.id);

    expect(reset.stepState).toBe('IDLE');
    expect(reset.stepStartedAt).toBeNull();
    expect(reset.status).toBe('CHARACTERS_GENERATED'); // unchanged
    expect(reset.characters).toHaveLength(1); // unchanged
  });
});

describe('isStepStale', () => {
  it('returns false when stepState is IDLE', () => {
    const project = makeProject({ stepState: 'IDLE' });
    expect(isStepStale(project, 1000)).toBe(false);
  });

  it('returns false when RUNNING but within the timeout', () => {
    const project = makeProject({
      stepState: 'RUNNING',
      stepStartedAt: new Date().toISOString(),
    });
    expect(isStepStale(project, 60_000)).toBe(false);
  });

  it('returns true when RUNNING and past the timeout', () => {
    const project = makeProject({
      stepState: 'RUNNING',
      stepStartedAt: new Date(Date.now() - 120_000).toISOString(),
    });
    expect(isStepStale(project, 60_000)).toBe(true);
  });
});