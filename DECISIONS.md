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