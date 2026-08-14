# Project Overview
## About this Project
A web app that turns a book's text into character portraits and one chapter illustration, using the Gemini API. Five user-driven steps, run one at a time: Style, then Characters, then Portraits, then Chapters, then Illustrations. Full mechanics of each step are documented in docs/plan.md; read that before writing any Gemini integration code. Do not guess at the pipeline. The plan file is the source of truth, extracted directly from Google's reference notebook.

## Tech Stack
- Frontend 
    - TypeScript
    - React
- Backend
    - TypeScript
    - Express
- Storage
    - JSON file

# Hard Requirements
These are pass/fail correctness rules from the assessment spec, not style preferences. Do not simplify past them.

## Caps (server enforced not prompt enforced)
- Max 2 characters, max 1 chapter
- Gemini will not reliably respect these limits on its own. The reference notebook's own defaults are max_character_images=5 and max_chapter_images=3, and it only truncates client-side after the response comes back. That is not sufficient here.
- Enforcement must happen in backend route/service code, after Gemini's response is received and before anything is persisted or used to trigger the next step
- Must hold even if a request hits the API directly, bypassing the frontend entirely. Don't rely on disabling a button as the only protection

## 2 interaction chains/project
- The pipeline uses Gemini's interaction API. via previous_interaction_id, not stateless call
- Txt chain: book upload -> style -> characters -> chapters
- Img chain: potrait setup -> potraits -> chapter-image setup -> illustration
- Every project must persist the latest interaction id for both chains. A step resumes by chaining off the correct chain's last id. Using the wrong chain, or losing either id, breaks resumability.
- Look at docs/plan.md for exact call shapes per step

## Book text sent once
- Book text is uploaded via Gemini's File API exactly once, at project creation
- Every later step references that upload/interaction chain. Never re-send the full book text in a later prompt.

## Resumable pipeline state
- Track two separate fields, not one combined status.
- status: which steps have completed — CREATED → STYLE_SET → CHARACTERS_GENERATED → PORTRAITS_GENERATED → CHAPTERS_GENERATED → DONE
- step_state: IDLE | RUNNING | FAILED, plus step_started_at
- A step may only start if step_state === IDLE and the prior step's status has been reached. Checked server-side

## No duplicate Gemini calls
- Write step_state = RUNNING to storage BEFORE making the Gemini call, not after.
- This ordering is what makes refresh, a second tab, and a double-click safe, the lock has to exist before the network call starts

## Stuck-step recovery, not auto-retry
- If step_state has been RUNNING longer than a reasonable timeout (real calls run 10–30s+, image generation longer), expose a manual retry action
- Never auto-retry a Gemini call in a loop. Retries are always user-triggered.

## Failed steps are retryable in isolation
- A failed step must leave everything before it untouched
- Retrying re-runs only that step, chaining off the same stored interactions ids as before

## Storage rules
- State isolated per user and per project (one file/project)
- Writes must be safe against concurrency: write to a temp file then rename (atomic), and serialise writes per project (a per-project write lock/queue).
- Images and book text live on local disk, served through our own API routes. No S3, no blob storage, no CDN.

## Scope boundaries
- Nothing from the notebook's later section. Only steps 1-5.
- No rate-limiting infrastucture
- No retry-with-backoff loops
- No auth beyond email+name session handling

## Working style
- Small, incremental commits with real messages
- If a change is mostly AI-generate note that in commit
- When proposing a solution, flag trade-offs explicitly rather than silently picking the more complex option. Decisions and their costs get recorded in DECISIONS.md

# Commands
- `npm test` (from backend/) — runs backend tests via Vitest
- `npm run dev` (from backend/) — starts the backend
# Code style

Co-author: claude.ai