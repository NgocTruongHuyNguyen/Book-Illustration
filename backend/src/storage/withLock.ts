const writeLocks = new Map<string, Promise<unknown>>();

export async function withLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(projectId) ?? Promise.resolve();
  const current = previous.then(fn, fn);
  writeLocks.set(projectId, current.catch(() => {}));
  return current;
}