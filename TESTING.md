# Testing
## Command to run test
- cd backend && npm run test
- cd frontend && npm run test

## Backend
Test runner: Vitest, chosen for native ESM + TypeScript support matching
the rest of the backend, and for using the same esbuild-based approach as
tsx, which the backend already runs on.

Backend gets the heavier coverage since that's where the actual correctness rules live: step ordering, cap enforcement, resumability, and the no-duplicate-call guarantee. Those are the pass/fail requirements from the assessment spec, and they're the kind of logic that's easy to get subtly wrong under refresh/retry/concurrency, so they're worth testing properly rather than eyeballing in the browser.

### What's covered
- `steps.test.ts` — the 2-character/1-chapter caps are enforced even when Gemini returns more, the two interaction chains (text and image) are threaded correctly step to step, structured JSON requests use the expected schema shape, and each step throws clearly if it's missing the chain state it needs to resume from.
- `pipelineService.test.ts` — steps run strictly in order, a second `runStep` call while one is already RUNNING returns `already-running` instead of firing a duplicate Gemini call, a thrown step sets `FAILED` with the error message while leaving `status` untouched so retry resumes at the same step, and `retryStuckStep` only succeeds on a FAILED step or a RUNNING step past the stale timeout — rejecting a genuinely in-progress step with `StepNotStuckError`.
- `withLock.test.ts` — calls for the same project id serialise, calls for different ids don't block each other, and the lock still releases if the wrapped function throws.
- `readFile.test.ts` / `writeFile.test.ts` — round-trip correctness, and writes leave no stray `.tmp` file behind after an atomic write.
- `authService.test.ts` — email normalisation (trim + lowercase), and an existing account's name isn't silently overwritten on a later sign-in with a different name.
- `geminiClient.test.ts` — text/image extraction from a mocked interaction response, and a clear error (no network call) when `GEMINI_API_KEY` is missing.

### Test report
 ✓ src/gemini/geminiClient.test.ts (5 tests) 3ms
 ✓ src/storage/readFile.test.ts (3 tests) 8ms
 ✓ src/storage/writeFile.test.ts (4 tests) 12ms
 ✓ src/services/authService.test.ts (6 tests) 13ms
 ✓ src/services/steps.test.ts (23 tests) 17ms
 ✓ src/services/pipelineService.test.ts (15 tests) 25ms
 ✓ src/storage/withLock.test.ts (3 tests) 64ms

 Test Files  7 passed (7)
      Tests  59 passed (59)
   Start at  11:30:27
   Duration  193ms (transform 319ms, setup 0ms, import 399ms, tests 141ms, environment 0ms)

## Frontend
Test runner: Vitest

Frontend gets targeted coverage on `lib/pipeline.ts`, the pure-function status math shared by the project list and detail pages (statusIndex, getCurrentStepKey, pillLabel, subtitle, isStepStale). This is the logic that decides which step runs next, what pill/label the UI shows, and whether a step counts as stranded, if it drifts from what the backend actually does, the UI lies about project state. It has no DOM dependency, so it's fast and doesn't need React Testing Library setup.

### What's covered
- `pipeline.test.ts` — status-to-step-index math, which step key is "current" for every status in the pipeline (including `null` once DONE), pill labels and subtitle text at each stage, and the stale-step timeout boundary (false when IDLE, false when RUNNING within the window, true once past it).

### Test report
 ✓ src/lib/pipeline.test.ts (17 tests) 4ms
   ✓ statusIndex (3)
     ✓ returns 0 for CREATED — no steps done yet 1ms
     ✓ returns 5 for DONE — all steps done 0ms
     ✓ matches STATUS_ORDER position for a mid-pipeline status 0ms
   ✓ getCurrentStepKey (3)
     ✓ returns STYLE when status is CREATED 0ms
     ✓ returns the matching step for each STEP_KEYS entry 0ms
     ✓ returns null when status is DONE — nothing left to run 0ms
   ✓ pillLabel (3)
     ✓ shows Draft for CREATED 0ms
     ✓ shows Done for DONE 0ms
     ✓ shows In progress for any step in between 0ms
   ✓ subtitle (3)
     ✓ describes CREATED as book text saved, no style yet 0ms
     ✓ describes DONE as all steps complete 0ms
     ✓ lists completed step labels for a mid-pipeline status 0ms
   ✓ isStepStale (4)
     ✓ returns false when stepState is IDLE, regardless of timestamp 1ms
     ✓ returns false when RUNNING but stepStartedAt is null 0ms
     ✓ returns false when RUNNING and within the timeout window 0ms
     ✓ returns true when RUNNING and past the timeout window 0ms
   ✓ STEP_LABELS and STEP_KEYS (1)
     ✓ stay in sync — same length, same order intent 0ms

 Test Files  1 passed (1)
      Tests  17 passed (17)
   Start at  11:32:11
   Duration  86ms (transform 17ms, setup 0ms, import 23ms, tests 4ms, environment 0ms)

## What's deliberately not covered

No full component rendering tests (no React Testing Library setup) — with limited time, the higher-value thing was making sure the pure logic the UI depends on is correct, rather than testing that JSX renders a div. Manual testing covered the actual page flows (sign-in, create project, run each step, character/chapter cards, retry/stuck states).

No integration test that runs the real 5-step pipeline against a mocked Gemini — flagged in the spec as nice-to-have, not required, and time didn't allow it on top of the manual end-to-end run already done.

No E2E — explicitly out of scope per the spec.

No tests for Express route handlers directly (thin wrappers around the tested service functions) — the routing layer just parses the request and calls a service, so the service-level tests above cover the actual logic.

