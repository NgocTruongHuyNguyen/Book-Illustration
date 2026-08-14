export class NoNextStepError extends Error {
  constructor(projectId: string) {
    super(`No next step available for project ${projectId}. It may already be DONE.`);
    this.name = 'NoNextStepError';
  }
}

export class StepAlreadyRunningError extends Error {
  constructor(projectId: string) {
    super(`A step is already running for project ${projectId}.`);
    this.name = 'StepAlreadyRunningError';
  }
}