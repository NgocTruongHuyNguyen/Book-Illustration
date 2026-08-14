import fs from 'node:fs/promises';
import path from 'node:path';
import type { User } from '@book-studio/shared/types/user.js';
import { getDataDir } from './config.js';

function userFilePath(email: string): string {
  return path.join(getDataDir(), 'users', email, 'user.json');
}

export async function writeUser(user: User): Promise<void> {
  const dir = path.join(getDataDir(), 'users', user.email);
  await fs.mkdir(dir, { recursive: true });

  const finalPath = userFilePath(user.email);
  const tempPath = `${finalPath}.tmp`;

  await fs.writeFile(tempPath, JSON.stringify(user, null, 2));
  await fs.rename(tempPath, finalPath);
}

export async function readUser(email: string): Promise<User | null> {
  try {
    const raw = await fs.readFile(userFilePath(email), 'utf-8');
    return JSON.parse(raw) as User;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null; 
    }
    throw err;
  }
}