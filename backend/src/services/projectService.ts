import { randomUUID } from 'node:crypto';
import type { Project } from '@book-studio/shared';
import { writeFile } from '../storage/writeFile.js';
import { writeBookText } from '../storage/bookStorage.js';

export async function createProject(
  userEmail: string,
  title: string,
  bookText: string
): Promise<Project> {
  const id = randomUUID();
  const bookTextPath = await writeBookText(id, bookText);

  const project: Project = {
    id,
    userEmail,
    title: title.trim(),
    bookTextPath,
    createdAt: new Date().toISOString(),
    status: 'CREATED',
    stepState: 'IDLE',
    stepStartedAt: null,
    stepError: null,
    // Real Gemini book upload (once, per architecture.md) happens later 
    textChainLastId: null,
    imageChainLastId: null,
    style: null,
    characters: [],
    chapters: [],
  };

  await writeFile(project);
  return project;
}