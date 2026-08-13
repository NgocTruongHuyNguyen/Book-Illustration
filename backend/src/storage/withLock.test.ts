import { describe, it, expect } from 'vitest';
import { withLock } from './withLock.js';

describe('withLock', () => {
  it('serialises calls for the same id, the second call does not start until the first resolves', async () => {
    const order: string[] = [];

    const first = withLock('project-a', async () => {
      order.push('first-start');
      await new Promise((resolve) => setTimeout(resolve, 30));
      order.push('first-end');
    });

    const second = withLock('project-a', async () => {
      order.push('second-start');
      order.push('second-end');
    });

    await Promise.all([first, second]);

    expect(order).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
  });

  it('does not block calls for a different id', async () => {
    const order: string[] = [];

    const a = withLock('project-a', async () => {
      order.push('a-start');
      await new Promise((resolve) => setTimeout(resolve, 30));
      order.push('a-end');
    });

    const b = withLock('project-b', async () => {
      order.push('b-start');
      order.push('b-end');
    });

    await Promise.all([a, b]);

    // b should complete before a, since it isn't waiting on a's lock
    expect(order.indexOf('b-end')).toBeLessThan(order.indexOf('a-end'));
  });

  it('still releases the lock if the wrapped function throws', async () => {
    await expect(
      withLock('project-c', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    // if the lock were stuck, this would hang or reuse a broken chain
    const result = await withLock('project-c', async () => 'recovered');
    expect(result).toBe('recovered');
  });
});