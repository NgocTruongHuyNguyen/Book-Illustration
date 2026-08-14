import { Router } from 'express';
import { createProject } from '../services/projectService.js';
import { listProjects } from '../storage/listProject.js';
import { readFile } from '../storage/readFile.js';
import { runStep, retryStuckStep } from '../services/pipipelineService.js';
import { NoNextStepError, StepNotStuckError } from '../services/pipelineErrors.js';

export const projectsRouter = Router();


projectsRouter.post('/', async (req, res) => {
  const { title, bookText } = req.body ?? {};

  if (typeof title !== 'string' || title.trim() === '') {
    res.status(400).json({ error: 'A project title is required.' });
    return;
  }
  if (typeof bookText !== 'string' || bookText.trim() === '') {
    res.status(400).json({ error: 'Book text is required (pasted or uploaded).' });
    return;
  }

  try {
    const project = await createProject(req.userEmail!, title, bookText);
    res.status(201).json({ project });
  } catch (err) {
    console.error('create project failed', err);
    res.status(500).json({ error: 'Something went wrong creating the project.' });
  }
});

projectsRouter.get('/', async (req, res) => {
  try {
    const projects = await listProjects(req.userEmail!);
    res.status(200).json({ projects });
  } catch (err) {
    console.error('list projects failed', err);
    res.status(500).json({ error: 'Something went wrong loading your projects.' });
  }
});

projectsRouter.get('/:id', async (req, res) => {
  try {
    const project = await readFile(req.userEmail!, req.params.id);
    res.status(200).json({ project });
  } catch (err) {
    res.status(404).json({ error: 'Project not found.' });
  }
});


projectsRouter.post('/:id/steps/run', async (req, res) => {
  const { style } = req.body ?? {};
  const options = typeof style === 'string' && style.trim() !== '' ? { userStyle: style } : undefined;
 
  try {
    const result = await runStep(req.userEmail!, req.params.id, options);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof NoNextStepError) {
      res.status(400).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Step failed.';
    res.status(502).json({ error: message });
  }
});

projectsRouter.post('/:id/steps/retry', async (req, res) => {
  try {
    const project = await retryStuckStep(req.userEmail!, req.params.id);
    res.status(200).json({ project });
  } catch (err) {
    if (err instanceof StepNotStuckError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('retry stuck step failed', err);
    res.status(500).json({ error: 'Something went wrong retrying this step.' });
  }
});