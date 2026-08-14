import type { ProjectStatus } from '@book-studio/shared';

export const STEP_LABELS = ['Style', 'Characters', 'Portraits', 'Chapters', 'Illustrations'];

export const STATUS_ORDER: ProjectStatus[] = [
  'CREATED',
  'STYLE_SET',
  'CHARACTERS_GENERATED',
  'PORTRAITS_GENERATED',
  'CHAPTERS_GENERATED',
  'DONE',
];

export function statusIndex(status: ProjectStatus): number {
  return STATUS_ORDER.indexOf(status);
}

export function pillLabel(status: ProjectStatus): string {
  if (status === 'DONE') return 'Done';
  if (status === 'CREATED') return 'Draft';
  return 'In progress';
}

export function subtitle(status: ProjectStatus): string {
  if (status === 'CREATED') return 'Book text saved · style not yet generated';
  if (status === 'DONE') return 'All 5 steps complete';
  const idx = statusIndex(status);
  return STEP_LABELS.slice(0, idx).join(' + ') + ' done';
}

// Must match backend/src/services/pipipelineService.ts STUCK_STEP_TIMEOUT_MS
export const STUCK_STEP_TIMEOUT_MS = 3 * 60 * 1000;

export function isStepStale(stepState: string, stepStartedAt: string | null): boolean {
  if (stepState !== 'RUNNING' || !stepStartedAt) return false;
  return Date.now() - new Date(stepStartedAt).getTime() > STUCK_STEP_TIMEOUT_MS;
}