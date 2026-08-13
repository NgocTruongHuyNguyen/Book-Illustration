# Why I choose that techstack (TypeScript, Express, React)
I'm already familiar with TS, Express and React from several past project so I can move faster and stay productive. TS also fits well here since AI-intergrated apps are full of data boundaries between frontend, backend and Gemini. and TS enforces those boundaries at compile time. It also means one language across the wholde stack. Express keeps the AI API key on the server, never exposed to frontend and React can handles real-time UI updates as Gemini response come back.

I also considered Next.js instead of React because Next.js gives more structure out of the box, however I don't have much experiences with it, so I would end up spend more time to familiar it with it than building something. Express is the opposite trade: It gives me freedom, but that means more architectural decisions to make myself instead of getting them for free.

The cost of this combination overall is that nothing comes wired together. 
Routing, request validation, session handling, and the API layer connecting frontend to backend all have to be set up by hand, where a more opinionated framework like Next.js would give some of that for free. I'm accepting that in exchange for speed from familiarity and not having to learn a new framework mid-assessment.

# Why I choose JSON storage
For an MVP at this scope, JSON files are faster to setup than a database and the amount of data per project is small enough that a database isn;t worth the added setup

The real cost is concurrency. A database gives atomic writes and 
transactions for free, JSON files don't. Two near-simultaneous writes to 
the same project file, like a refresh landing during a retry, could 
corrupt the file. I'm accepting that risk but mitigating it directly: 
writing to a temp file then renaming it into place for atomic writes, and 
a per-project write lock so concurrent writes queue instead of racing.