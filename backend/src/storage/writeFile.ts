import fs from 'node:fs/promises';
import path from 'node:path';
import type { Project } from '@book-studio/shared';
import { getDataDir } from './config.js';

export async function writeFile(project: Project): Promise<void> {
  const dir = path.join(getDataDir(), 'users', project.userEmail, 'projects');
  await fs.mkdir(dir, { recursive: true });

  const finalPath = path.join(dir, `${project.id}.json`);
  const tempPath = `${finalPath}.tmp`;

  await fs.writeFile(tempPath, JSON.stringify(project, null, 2));
  await fs.rename(tempPath, finalPath);
}