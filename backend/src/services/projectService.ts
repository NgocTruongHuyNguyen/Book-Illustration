import { randomUUID } from 'node:crypto';
import type { Project } from '@book-studio/shared';
import { writeFile } from '../storage/writeFile.js';
import { writeBookText } from '../storage/bookStorage.js';
import { uploadFile, createInteraction } from '../gemini/geminiClient.js';
import { TEXT_MODEL } from '../gemini/config.js';

export async function createProject(
  userEmail: string,
  title: string,
  bookText: string
): Promise<Project> {
  const id = randomUUID();
  const bookTextPath = await writeBookText(id, bookText);
  const file = await uploadFile(bookTextPath, 'text/plain');
  const bookInteraction = await createInteraction({
    model: TEXT_MODEL,
    input: [
      { type: 'text', text: 'This is the book we will be working with for the rest of this conversation.' },
      { type: 'document', uri: file.uri, mime_type: file.mimeType },
    ],
  });

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
    textChainLastId: bookInteraction.id,
    imageChainLastId: null, // set once Portraits runs its setup interaction
    style: null,
    characters: [],
    chapters: [],
  };

  await writeFile(project);
  return project;
}