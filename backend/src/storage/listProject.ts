// backend/src/storage/listProjects.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Project } from '@book-studio/shared';
import { getDataDir } from './config.js';
import { readFile } from './readFile.js';

export async function listProjects(userEmail: string): Promise<Project[]> {
  const dir = path.join(getDataDir(), 'users', userEmail, 'projects');

  let filenames: string[];
  try {
    filenames = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []; // no projects folder yet — brand new user
    }
    throw err;
  }

  const projectIds = filenames
    .filter((f) => f.endsWith('.json') && !f.endsWith('.json.tmp'))
    .map((f) => f.replace(/\.json$/, ''));

  const projects = await Promise.all(projectIds.map((id) => readFile(userEmail, id)));

  return projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}