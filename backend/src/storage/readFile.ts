import fs from 'node:fs/promises';
import path from 'node:path';
import type { Project } from '@book-studio/shared';
import { getDataDir } from './config.js';

export async function readFile(userEmail: string, projectId: string): Promise<Project> {
  const filePath = path.join(getDataDir(), 'users', userEmail, 'projects', `${projectId}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as Project;
}