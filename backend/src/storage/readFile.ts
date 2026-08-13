import type { Project } from '@book-studio/shared';
import fs from 'node:fs/promises';

async function readFile(userEmail: string, projectId: string): Promise<Project> {
  const path = `/data/users/${userEmail}/projects/${projectId}.json`;
  const raw = await fs.readFile(path, 'utf-8');
  return JSON.parse(raw) as Project;
}