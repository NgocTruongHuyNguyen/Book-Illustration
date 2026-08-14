import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Project } from '@book-studio/shared';
import { writeFile } from '../storage/writeFile.js';
import { readFile } from '../storage/readFile.js';
import { runStep, retryStuckStep, isStepStale } from './pipipelineService.js';
import { StepNotStuckError } from './pipelineErrors.js';
import * as stepsModule from './steps.js';

vi.mock('../gemini/geminiClient.js', () => ({
  createInteraction: vi.fn().mockResolvedValue({
    id: 'mock-interaction-id',
    status: 'completed',
    model: 'gemini-3.6-flash',
    steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Mocked style output' }] }],
  }),
  extractText: vi.fn().mockReturnValue('Mocked style output'),
}));

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
    textChainLastId: 'mock-book-interaction-id',
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
    expect(result.project.style).toContain('Mocked style output');
  });

  it('passes a user-supplied style through instead of asking Gemini to invent one', async () => {
    const project = makeProject();
    await writeFile(project);

    const result = await runStep(project.userEmail, project.id, { userStyle: 'noir comic' });

    expect(result.project.style).toContain('noir comic');
  });

  it('throws a clear error if the project has no text chain to continue from', async () => {
    const project = makeProject({ textChainLastId: null });
    await writeFile(project);

    await expect(runStep(project.userEmail, project.id)).rejects.toThrow('text chain');
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

    const result = await runStep(project.userEmail, project.id);

    expect(result.outcome).toBe('already-running');
    expect(result.project.status).toBe('CREATED');
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
    expect(afterFailure.status).toBe('CREATED');

    spy.mockRestore();
  });

  it('allows retrying only the failed step, leaving earlier progress untouched', async () => {
    const project = makeProject({
      status: 'STYLE_SET',
      style: 'already generated style',
    });
    await writeFile(project);

    const spy = vi.spyOn(stepsModule, 'getNextStep').mockReturnValue({
      key: 'CHARACTERS',
      fromStatus: 'STYLE_SET',
      toStatus: 'CHARACTERS_GENERATED',
      run: vi.fn().mockResolvedValue({
        characters: [{ name: 'Mock', prompt: 'p', portraitPath: null }],
      }),
    });

    const result = await runStep(project.userEmail, project.id);

    expect(result.project.status).toBe('CHARACTERS_GENERATED');
    expect(result.project.style).toBe('already generated style'); // untouched

    spy.mockRestore();
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
    expect(reset.status).toBe('CHARACTERS_GENERATED');
    expect(reset.characters).toHaveLength(1);
  });

  it('resets a FAILED step back to IDLE and clears the error', async () => {
    const project = makeProject({
      status: 'STYLE_SET',
      stepState: 'FAILED',
      stepError: 'gemini exploded',
    });
    await writeFile(project);

    const reset = await retryStuckStep(project.userEmail, project.id);

    expect(reset.stepState).toBe('IDLE');
    expect(reset.stepError).toBeNull();
  });

  it('rejects retrying a project that is IDLE — nothing to retry', async () => {
    const project = makeProject({ status: 'STYLE_SET', stepState: 'IDLE' });
    await writeFile(project);

    await expect(retryStuckStep(project.userEmail, project.id)).rejects.toThrow(
      StepNotStuckError
    );
  });

  it('rejects retrying a project that is RUNNING but not yet past the stale timeout', async () => {
    const project = makeProject({
      status: 'STYLE_SET',
      stepState: 'RUNNING',
      stepStartedAt: new Date().toISOString(),
    });
    await writeFile(project);

    await expect(retryStuckStep(project.userEmail, project.id)).rejects.toThrow(
      StepNotStuckError
    );
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