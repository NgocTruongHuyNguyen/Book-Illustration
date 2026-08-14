# Why I choose that techstack (TypeScript, Express, React)
I'm already familiar with TS, Express and React from several past project so I can move faster and stay productive. TS also fits well here since AI-intergrated apps are full of data boundaries between frontend, backend and Gemini. and TS enforces those boundaries at compile time. It also means one language across the wholde stack. Express keeps the AI API key on the server, never exposed to frontend and React can handles real-time UI updates as Gemini response come back.

I also considered Next.js instead of React because Next.js gives more structure out of the box, however I don't have much experiences with it, so I would end up spend more time to familiar it with it than building something. Express is the opposite trade: It gives me freedom, but that means more architectural decisions to make myself instead of getting them for free.

The cost of this combination overall is that nothing comes wired together. 
Routing, request validation, session handling, and the API layer connecting frontend to backend all have to be set up by hand, where a more opinionated framework like Next.js would give some of that for free. I'm accepting that in exchange for speed from familiarity and not having to learn a new framework mid-assessment.

# Why I choose JSON files instead of DB (Claude suggest SQLite)
Claude suggested SQLite over JSON files, since it avoids hand-rolling 
concurrency safety and gives transactions for free. I disagreed for this 
specific project: this is an MVP with a 3-day window, and JSON is faster 
to set up with no schema or migrations to think about. For a real product 
I'd pick a database without hesitation, but at this scope and timeline the 
setup cost isn't worth it.

The trade-off I'm accepting is real, though: no transactions, and 
concurrent writes are now my problem to solve instead of the database's. 
I'm handling that with a temp-file-then-rename write (atomic) and a 
per-project write lock so two writes to the same project can't race.

# Shared type via npm workspaces
The original architecture draft suggested by Claude had types under backend folder not on the root. I proposed the fix myself: a shared/types folder so both sides use the same Project, Character, and Chapter types instead of two copies that could quietly drift apart. Once that was settled, Claude suggested npm workspaces over manual TypeScript path aliases in each project's tsconfig, since one root package.json is less fragile than wiring an alias separately into the backend and into Vite. I went with that for the implementation. The cost is one more piece of monorepo setup than a plain two-folder project would need, but it removes an entire class of bugs where the API response shape and what the frontend expects stop matching.

# Adding a services layer
My own call, not Claude's first suggestion. The original folder plan only had routes calling storage and Gemini directly, and I could see that 
getting messy once the routes had to handle step ordering, cap enforcement, and the run-lock-then-call sequence, not just parsing a request. So I created a services folder between routes and storage/gemini, so routes stay thin and the actual pipeline logic lives in one place I can test directly. The cost is an extra layer of indirection for what's otherwise a small app, but it also gives me a clean unit-testing surface for the step ordering and retry logic the assessment specifically asks to be tested.

# Cutting a backend-only types folder
Claude had included an empty backend/src/types folder in the first architecture draft, for types that only the backend would need. I realise that after create shared/types, the types under backend folder is not neccesary anymore so I removed it. The backend  mports directly from shared/types like the frontend does, and I'll add a backend-only types file later only if a genuinely internal type actually appears,rather than pre-building structure for a need that  doesn't exist yet.

# Header-based session instead of cookies
The spec leaves session representation open. I chose a simple header (x-user-email) sent by the frontend on every request after sign-in, instead of a cookie-based session. Given no password or OAuth exists in this app at all, a cookie's main advantage, harder to spoof than a header a client sets itself, doesn't protect much here. The cost is real though: anyone who knows or guesses a user's email could set that header and act as them. I'm accepting that because the assessment explicitly allows no password and no OAuth, and building out real signed sessions would be time spent on a security property this project was never asked to have.

# Email is sole identity
Once a user signs in for the first time, their name is locked to what they entered then. I considered making a different name on re-signin create a new account, but that would mean keying storage on email plus name instead of email alone, which conflicts with the file layout already built and with the spec's own wording, email exists, load their projects, doesn't exist, create the user. I kept email as the sole identity. The cost is that a name typo or change on a later sign-in is silently ignored rather than updating anything, since there's no profile-editing feature in this project's scope.

# How pipeline progress is modeled
When designed it on paper, I used this split from the start rather than proposing a single status field, because a single field can't represent "characters are done and portraits are currently running" at the same time, which is exactly the state a refresh mid-step has to read correctly.Building the real pipelineService confirmed this was the right call: every step transition writes stepState (IDLE, RUNNING, or FAILED) independently of status (which step has actually completed), and the tests in pipelineService.test.ts rely on being able to check both independently, for example confirming a FAILED step leaves status untouched so a retry resumes at the same step rather than losing progress. The cost is real: two fields have to be kept in sync on every write, and a stranded stepState needs the timeout-based recovery path (retryStuckStep) to ever clear it.

# How duplicate execution on refresh is stopped
stepState is written as RUNNING inside the project's lock, before the actual step work happens, not after. Proved this for real by firing two concurrent curl requests at a running project: One came back "started" and the other came back "already-running", only one call actually executed. Cost: every step needs two locked writes instead of one, and the real work has to run outside the lock so a slow call doesn't block other reads/writes to that project.

# Retry must reject a step that isn't actually stuck
My first version of retryStuckStep reset stepState to IDLE unconditionally. Testing it on an already-IDLE project looked fine, but the same reset on a project that's genuinely still RUNNING would release the lock on a step that hasn't finished, letting a second run call start a real duplicate Gemini call. Added a guard: retry only succeeds if stepState is FAILED, or RUNNING past the timeout, rejecting otherwise with StepNotStuckError. A real bug I caught in my own first implementation, not a style preference.

# Waiting for uploaded files to become ACTIVE before use
My first version of uploadFile returned right after the upload finished, with no check on the file's processing state. It looked fine at first, Style and Characters both ran, but the Style output actually said it hadn't been given the book yet, even though I uploaded it and referenced it at project creation. Characters, a later call in the same chain, picked up the book content correctly. So the file was probably still PROCESSING on Gemini's side when Style ran right after upload. I added polling that waits for the file to reach ACTIVE before returning, with a timeout so a failed upload doesn't hang forever. Tested with a fresh project and Style now references the actual book from the first call. This one wasn't caught by any test, I only found it by actually reading the output instead of just checking the request succeeded.