import fs from 'node:fs/promises';
import type { Project } from '@book-studio/shared';

async function writeFile(project: Project): Promise<void> {
  const finalPath = `/data/users/${project.userEmail}/projects/${project.id}.json`;
  const tempPath = `${finalPath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(project, null, 2));
  await fs.rename(tempPath, finalPath);
}