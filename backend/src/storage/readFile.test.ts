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

describe('readFile', () => {
  it('reads back exactly what was written', async () => {
    const project = makeProject();
    await writeFile(project);

    const loaded = await readFile(project.userEmail, project.id);
    expect(loaded).toEqual(project);
  });

  it('throws when the project file does not exist', async () => {
    await expect(readFile('nobody@example.com', 'does-not-exist')).rejects.toThrow();
  });

  it('throws when the project file contains invalid JSON', async () => {
    const project = makeProject();
    const dir = path.join(tempDataDir, 'users', project.userEmail, 'projects');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${project.id}.json`), '{ this is not valid json');

    await expect(readFile(project.userEmail, project.id)).rejects.toThrow();
  });
});