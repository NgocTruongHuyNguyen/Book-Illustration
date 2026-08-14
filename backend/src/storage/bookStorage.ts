import fs from 'node:fs/promises';
import path from 'node:path';
import { getDataDir } from './config.js';

export async function writeBookText(projectId: string, text: string): Promise<string> {
  const dir = path.join(getDataDir(), 'books');
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${projectId}.txt`);
  await fs.writeFile(filePath, text, 'utf-8');
  return filePath;
}

export async function readBookText(bookTextPath: string): Promise<string> {
  return fs.readFile(bookTextPath, 'utf-8');
}