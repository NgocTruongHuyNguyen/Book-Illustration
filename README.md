# Book Illustration Studio

Turns a book's text into character portraits and a chapter illustration, using the Gemini API. Five user-driven steps run in order: Style → Characters → Portraits → Chapters → Illustrations.

## Prerequisites

- Node.js 18+
- A Gemini API key with access to a current Gemini text model and the Gemini 2.5 Flash Image ("Nano Banana") model.

## Setup

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# edit backend/.env and set your real GEMINI_API_KEY
```

## Start

Two dev servers, run each in its own terminal:

```bash
cd backend && npm run dev    # http://localhost:3001
cd frontend && npm run dev   # http://localhost:5173
```

(No `docker-compose.yml` — storage is local JSON files and disk images, no external services to containerize. See "Storage" below.)

## Test

```bash
cd backend && npm test    # 59 tests — step ordering, resumability, retry/lock logic, storage
cd frontend && npm test   # 17 tests — pipeline status helpers (statusIndex, getCurrentStepKey, etc.)
```

See `TESTING.md` for strategy, coverage rationale, and a real pasted test report.

## Environment variables

**backend/.env**
```
| Variable | Description |
|---|---|
| `PORT` | Backend port (e.g. `3001`) |
| `GEMINI_API_KEY` | Your Gemini API key — never commit this |
| `GEMINI_TEXT_MODEL` | Text model for Style/Characters/Chapters (e.g. `gemini-3.6-flash`) |
| `GEMINI_IMAGE_MODEL` | Image model for Portraits/Illustrations (e.g. `gemini-2.5-flash-image`) |

**frontend/.env**
| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend URL, e.g. `http://localhost:3001` |
```
## Architecture
- **Frontend**: TypeScript + React, plain CSS (no component library)
- **Backend**: TypeScript + Express
- **Storage**: JSON files on disk, one file per project, isolated per user email. Atomic writes (temp file + rename) and a per-project write lock guard against concurrent writes. Rationale and trade-offs recorded in `DECISIONS.md`.
- **Session**: `x-user-email` header sent by the frontend on every request after sign-in — no password, no OAuth, per spec.
- **Gemini integration**: book text is uploaded once via the File API at project creation; every later step chains off a stored `previous_interaction_id`, split across two independent chains (text: Style→Characters→Chapters; image: Portrait setup→Portraits→Chapter-image setup→Illustrations). See `docs/plan.md` for exact call shapes per step, extracted from Google's reference notebook.
- **Pipeline state**: `status` (which steps are done) and `stepState` (`IDLE`/`RUNNING`/`FAILED`) are tracked as two separate fields so a refresh mid-step can be read and resumed correctly. A `RUNNING` step past a timeout is treated as stranded and offers a manual retry — never auto-retried.
- **Caps**: max 2 characters, max 1 chapter, enforced server-side after Gemini's response, not left to the prompt or the UI.

Full reasoning behind these decisions, including where AI suggestions were overridden, is in `DECISIONS.md`.

## Project structure
Check on docs/architecture.md



