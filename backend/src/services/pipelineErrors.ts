export class NoNextStepError extends Error {
  constructor(projectId: string) {
    super(`No next step available for project ${projectId} — it may already be DONE.`);
    this.name = 'NoNextStepError';
  }
}

export class StepNotStuckError extends Error {
  constructor(projectId: string) {
    super(
      `Project ${projectId} is not in a retryable state. Retry is only allowed ` +
        `when a step has FAILED, or is RUNNING and stuck past the timeout.`
    );
    this.name = 'StepNotStuckError';
  }
}