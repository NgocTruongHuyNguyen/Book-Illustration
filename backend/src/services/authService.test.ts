import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { signIn } from './authService.js';
import { readUser } from '../storage/userStorage.js';

let tempDataDir: string;

beforeEach(async () => {
  tempDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'book-studio-test-'));
  process.env.DATA_DIR = tempDataDir;
});

afterEach(async () => {
  await fs.rm(tempDataDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

describe('signIn', () => {
  it('creates a new user when the email does not exist yet', async () => {
    const user = await signIn('New.User@Example.com', 'Alex');

    expect(user.email).toBe('new.user@example.com'); // normalized
    expect(user.name).toBe('Alex');
    expect(user.createdAt).toBeTruthy();
  });

  it('persists the new user to storage', async () => {
    await signIn('persisted@example.com', 'Sam');

    const stored = await readUser('persisted@example.com');
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe('Sam');
  });

  it('loads the existing user on a second sign-in with the same email', async () => {
    const first = await signIn('returning@example.com', 'Original Name');
    const second = await signIn('returning@example.com', 'Original Name');

    expect(second).toEqual(first);
  });

  it('does not update the name if an existing email signs in with a different name', async () => {
    await signIn('fixedname@example.com', 'First Name');
    const second = await signIn('fixedname@example.com', 'A Totally Different Name');

    expect(second.name).toBe('First Name');
  });

  it('treats emails as case-insensitive and trims whitespace', async () => {
    const first = await signIn('Case.Test@Example.com', 'Person');
    const second = await signIn('  case.test@example.com  ', 'Person');

    expect(second.email).toBe('case.test@example.com');
    expect(second).toEqual(first); // same normalized account, not a duplicate
  });

  it('trims whitespace from the name on account creation', async () => {
    const user = await signIn('trimtest@example.com', '  Padded Name  ');
    expect(user.name).toBe('Padded Name');
  });
});