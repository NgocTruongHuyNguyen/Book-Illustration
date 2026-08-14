import { describe, it, expect } from 'vitest';
import {
  STEP_LABELS,
  STEP_KEYS,
  STATUS_ORDER,
  statusIndex,
  getCurrentStepKey,
  pillLabel,
  subtitle,
  isStepStale,
} from './pipeline.js';

describe('statusIndex', () => {
  it('returns 0 for CREATED — no steps done yet', () => {
    expect(statusIndex('CREATED')).toBe(0);
  });

  it('returns 5 for DONE — all steps done', () => {
    expect(statusIndex('DONE')).toBe(5);
  });

  it('matches STATUS_ORDER position for a mid-pipeline status', () => {
    expect(statusIndex('PORTRAITS_GENERATED')).toBe(STATUS_ORDER.indexOf('PORTRAITS_GENERATED'));
  });
});

describe('getCurrentStepKey', () => {
  it('returns STYLE when status is CREATED', () => {
    expect(getCurrentStepKey('CREATED')).toBe('STYLE');
  });

  it('returns the matching step for each STEP_KEYS entry', () => {
    // CREATED -> STYLE, STYLE_SET -> CHARACTERS, etc. — one status ahead of the step key
    STATUS_ORDER.slice(0, -1).forEach((status, i) => {
      expect(getCurrentStepKey(status)).toBe(STEP_KEYS[i]);
    });
  });

  it('returns null when status is DONE — nothing left to run', () => {
    expect(getCurrentStepKey('DONE')).toBeNull();
  });
});

describe('pillLabel', () => {
  it('shows Draft for CREATED', () => {
    expect(pillLabel('CREATED')).toBe('Draft');
  });

  it('shows Done for DONE', () => {
    expect(pillLabel('DONE')).toBe('Done');
  });

  it('shows In progress for any step in between', () => {
    expect(pillLabel('CHARACTERS_GENERATED')).toBe('In progress');
    expect(pillLabel('STYLE_SET')).toBe('In progress');
  });
});

describe('subtitle', () => {
  it('describes CREATED as book text saved, no style yet', () => {
    expect(subtitle('CREATED')).toMatch(/book text saved/i);
  });

  it('describes DONE as all steps complete', () => {
    expect(subtitle('DONE')).toMatch(/all 5 steps complete/i);
  });

  it('lists completed step labels for a mid-pipeline status', () => {
    // CHAPTERS_GENERATED means Style + Characters + Portraits + Chapters are done
    const result = subtitle('CHAPTERS_GENERATED');
    expect(result).toContain('Style');
    expect(result).toContain('Characters');
    expect(result).toContain('Portraits');
    expect(result).toContain('Chapters');
    expect(result).not.toContain('Illustrations');
  });
});

describe('isStepStale', () => {
  it('returns false when stepState is IDLE, regardless of timestamp', () => {
    expect(isStepStale('IDLE', new Date().toISOString())).toBe(false);
  });

  it('returns false when RUNNING but stepStartedAt is null', () => {
    expect(isStepStale('RUNNING', null)).toBe(false);
  });

  it('returns false when RUNNING and within the timeout window', () => {
    const justStarted = new Date().toISOString();
    expect(isStepStale('RUNNING', justStarted)).toBe(false);
  });

  it('returns true when RUNNING and past the timeout window', () => {
    const longAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString(); // 4 min ago, timeout is 3 min
    expect(isStepStale('RUNNING', longAgo)).toBe(true);
  });
});

describe('STEP_LABELS and STEP_KEYS', () => {
  it('stay in sync — same length, same order intent', () => {
    expect(STEP_LABELS).toHaveLength(STEP_KEYS.length);
  });
});