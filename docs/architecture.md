# Architecture
Co-author: claude
## Overview
Backend: TypeScript + Express. Frontend: TypeScript + React. Storage: JSON files on disk, one file per project. No database. See docs/plan.md for the Gemini pipeline mechanics this architecture supports.

## System Diagram
```
[User] <-> [React frontend] <-> [Express backend] <-> [Gemini API]
                                        |
                                [/data on local disk]
```

## Project structure
```
book-illustration-studio/
├── backend/
│   ├── src/
│   │   ├── routes/       # API endpoints — thin, parse request, call a
│   │   │                 # service, shape the response. No business logic.
│   │   ├── services/     # business logic — step ordering/validation, cap
│   │   │                 # enforcement, the runStep orchestration (lock ->
│   │   │                 # call Gemini -> write result). Calls gemini/ and
│   │   │                 # storage/, knows nothing about HTTP.
│   │   ├── gemini/       # Gemini client wrapper, one function per pipeline
│   │   │                 # step. Knows nothing about caps or step state.
│   │   ├── storage/      # read/write project JSON, write lock, atomic
│   │                     # write. Knows nothing about Gemini or HTTP.
│   │                     # no separate backend/types folder for now, the backend imports
│   │                     # Project/Character/Chapter/etc. directly from shared/types, same
│   │                     # as the frontend.
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/        # ProjectList, NewProject, ProjectDetail, Auth
│   │   ├── components/   # Stepper, CharacterCard, ChapterCard, etc.
│   │   └── api/          # fetch wrappers calling the backend
│   └── package.json
├── shared/
│   └── types/            # Project, Character, Chapter, ProjectStatus,
│                         # StepState, the API contract both frontend
│                         # and backend import from, so the two never
│                         # drift out of sync.
├── docs/
│   ├── plan.md
│   └── architecture.md
├── data/                 # gitignored — runtime JSON/images/book text
├── CLAUDE.md
├── DECISIONS.md
├── TESTING.md
├── package.json          # root — npm workspaces (shared, backend, frontend)
└── .gitignore

```

- This is a plan so the actual folders may change once the coding sarts but the separation (routes / services / gemini / storage / types on the backend; pages / components / api on the frontend, shared types at the root) is the intended shape

- shared/types holds the Project, Character, Chapter, ProjectStatus, and StepState types from the "Project state shape" section below. Both backend and frontend import from it directly, so the API response shape and the frontend's expectations can never quietly drift apart. This is set up as an npm workspace (a root package.json with a workspaces field listing shared, backend, frontend), rather than manual TypeScript path aliases in each project

## Identity
- User key: normalised email (email.trim().toLowerCase()) for case sensitivity
- Sign in with email and name, password is not required at this stage
- Existing email loads that user's project, a new email creates the user
- Normalisation happens once, at the API boundary (sign-in, project creation), before the email is used anywhere downstream.

## File layout
```
/data/
  users/
    {normalised-email}/
      projects/
        {projectId}.json
  images/
    {projectId}/
      character-{index}.png
      chapter-{index}.png
  books/
    {projectId}.txt
```

- One JSON file per project. Images and book text are separate files on disk, served through backend API routes

## Project state shape
``` typescript

type StepKey = 'STYLE' | 'CHARACTERS' | 'PORTRAITS' | 'CHAPTERS' | 'ILLUSTRATIONS';

type ProjectStatus =
  | 'CREATED'
  | 'STYLE_SET'
  | 'CHARACTERS_GENERATED'
  | 'PORTRAITS_GENERATED'
  | 'CHAPTERS_GENERATED'
  | 'DONE';

type StepState = 'IDLE' | 'RUNNING' | 'FAILED';

interface Character {
  name: string;
  prompt: string;
  portraitPath: string | null;
}

interface Chapter {
  name: string;
  prompt: string;
  illustrationPath: string | null;
}

interface Project {
  id: string;
  userEmail: string;
  title: string;
  bookTextPath: string;
  createdAt: string;

  status: ProjectStatus;
  stepState: StepState;
  stepStartedAt: string | null;
  stepError: string | null;

  textChainLastId: string | null;
  imageChainLastId: string | null;

  style: string | null;
  characters: Character[];
  chapters: Chapter[];
}
```

- stepStartedAt is what makes stranded-step detection possible after a server crash.
- stepError lets the UI show why a step failed, not just that it did
- The two chain id fields are separate because the pipeline runs two independent Gemini interaction chains, a text chain and an image chain, and losing track of either one breaks resumability for that chain specifically.

## Concurrency: reading project
``` typescript
async function readFile(userEmail: string, projectId: string): Promise<Project> {
  const path = `/data/users/${userEmail}/projects/${projectId}.json`;
  const raw = await fs.readFile(path, 'utf-8');
  return JSON.parse(raw) as Project;
}
```
- readFile takes userEmail as well as projectId, since the file path is scoped under the owning user's folder.yea

## Conurrency: write lock
``` typescript
const writeLocks = new Map<string, Promise<unknown>>();

async function withLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(projectId) ?? Promise.resolve();
  const current = previous.then(fn, fn);
  writeLocks.set(projectId, current.catch(() => {}));
  return current;
}
```

## Concurrency: atomic write
``` typescript
async function writeFile(project: Project): Promise<void> {
  const finalPath = `/data/users/${project.userEmail}/projects/${project.id}.json`;
  const tempPath = `${finalPath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(project, null, 2));
  await fs.rename(tempPath, finalPath);
}
```
- Every write goes to a temp file first, then gets renamed into place. Rename on the same filesystem is atomic, so a crash mid-write never leaves a half-written JSON file on disk.

## No duplicate Gemini calls
``` typescript
async function runStep(
  userEmail: string,
  projectId: string,
  options?: StepOptions
): Promise<RunStepResult> {
  const claim = await withLock(projectId, async () => {
    const project = await readFile(userEmail, projectId);
 
    if (project.stepState === 'RUNNING') {
      return { claimed: false as const, project };
    }
 
    const step = getNextStep(project.status);
    if (!step) {
      throw new NoNextStepError(projectId);
    }
 
    const updated: Project = {
      ...project,
      stepState: 'RUNNING',
      stepStartedAt: new Date().toISOString(),
      stepError: null,
    };
    await writeFile(updated);
    return { claimed: true as const, project: updated };
  });
 
  if (!claim.claimed) {
    return { outcome: 'already-running', project: claim.project };
  }
 
  const step = getNextStep(claim.project.status);
  if (!step) {
    throw new NoNextStepError(projectId);
  }
 
  try {
    const resultFields = await step.run(claim.project, options); // <-- options passed through here
 
    await withLock(projectId, async () => {
      const latest = await readFile(userEmail, projectId);
      const finished: Project = {
        ...latest,
        ...resultFields,
        status: step.toStatus,
        stepState: 'IDLE',
        stepStartedAt: null,
        stepError: null,
      };
      await writeFile(finished);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await withLock(projectId, async () => {
      const latest = await readFile(userEmail, projectId);
      const failed: Project = {
        ...latest,
        stepState: 'FAILED',
        stepError: message,
      };
      await writeFile(failed);
    });
    throw err;
  }
 
  const finalProject = await readFile(userEmail, projectId);
  return { outcome: 'started', project: finalProject };
}
```
- The step state is written as RUNNING before the Gemini call is made, not after. This ordering is what makes a refresh, a second tab, or a double-click safe, because the lock check happens before the network call starts, not around it.

## Stuck-step recovery
- The concrete timeout used is STUCK_STEP_TIMEOUT_MS = 3 minutes, defined in pipelineService.ts. This is well above the 10-30s+ a real Gemini call takes, including image generation, so a step that is still genuinely in progress is never mistaken for stuck. retryStuckStep only succeeds when a step has actually FAILED, or is RUNNING and has exceeded this timeout. Calling it on a step in profress is rejecte with StepNotStuckError, not silently allowed.