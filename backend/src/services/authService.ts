import type { User } from '@book-studio/shared/types/user.js';
import { readUser, writeUser } from '../storage/userStorage.js';
import { normaliseEmail } from './normaliseEmail.js';

export async function signIn(rawEmail: string, name: string): Promise<User> {
  const email = normaliseEmail(rawEmail);
 
  const existing = await readUser(email);
  if (existing) {
    return existing; // email exists — load their projects (name is not updated)
  }
 
  const user: User = {
    email,
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  await writeUser(user);
  return user;
}