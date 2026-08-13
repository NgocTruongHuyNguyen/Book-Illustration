import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Project } from '@book-studio/shared';
import { writeFile } from './writeFile.js';
import { readFile } from './readFile.js';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project-1',
    userEmail: 'test@example.com',
    title: 'Test Book',
    bookTextPath: '/data/books/test-project-1.txt',
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
});

describe('writeFile', () => {
  it('creates a project file that can be read back', async () => {
    const project = makeProject();
    await writeFile(project);

    const loaded = await readFile(project.userEmail, project.id);
    expect(loaded).toEqual(project);
  });

  it('leaves no .tmp file behind after a successful write', async () => {
    const project = makeProject();
    await writeFile(project);

    const dir = path.join(tempDataDir, 'users', project.userEmail, 'projects');
    const files = await fs.readdir(dir);

    expect(files).toEqual([`${project.id}.json`]);
  });

  it('overwrites cleanly on a second write to the same project', async () => {
    const project = makeProject();
    await writeFile(project);

    const updated = { ...project, style: 'watercolor' };
    await writeFile(updated);

    const loaded = await readFile(project.userEmail, project.id);
    expect(loaded.style).toBe('watercolor');
  });

  it('creates the user/project directory structure if it does not exist yet', async () => {
    const project = makeProject({ userEmail: 'brand-new-user@example.com' });
    await writeFile(project);

    const dir = path.join(tempDataDir, 'users', project.userEmail, 'projects');
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });
});