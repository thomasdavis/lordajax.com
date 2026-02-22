# Two Weeks of Forth GPTs, Self-Healing Pipelines, and Indigenous Language Maps

*Running a language model in Forth was stupid. I did it anyway. Meanwhile, my agent infrastructure got a nervous system.*

Across eight repos and 214 commits over Feb 8–22, there's a pattern I keep half-denying: I'm building infrastructure for AI agents to fix their own bugs. Not metaphorically. Literally. Production error fires → Sentry catches it → webhook creates a GitHub issue → Claude Code auto-fix pipeline triggers → PR gets opened → Discord gets notified. That loop is now live across at least two projects. In parallel, I ran a completely unhinged experiment in [fourth](https://github.com/thomasdavis/fourth)/[forthLLM](https://github.com/rolandnsharp/forthLLM): training and inferring a baby GPT written entirely in Forth, zero Python. Also: mobtranslate.com got a full design system overhaul, JSON Resume's pathways feature got market-ready refactoring, and TPMJS grew a workflow builder, ML tracking, and 74 new tools. It was a busy two weeks.

## Why You Should Care

- **Self-healing agent loop is live**: Runtime errors in Omega and TPMJS now auto-create GitHub issues and trigger Claude Code auto-fix PRs, measured by watching the pipeline fire on intentional test errors
- **GPT inference in 100% Forth**: BPE tokenizer, transformer weights, sampling — no Python, no numpy. Runs. Slowly.
- **Visual workflow builder shipped**: TPMJS got a drag-and-drop canvas with 5,544 lines of net new code
- **74 agnt.gg tools integrated**: `@tpmjs/official-agnt` package wraps the full agnt.gg tool catalog
- **mobtranslate.com got a full design system**: `@mobtranslate/ui` shipped, interactive location maps for place names added, dark mode fixed
- **Persistent memory for AI agents**: Both Omega and TPMJS now have agent memory services backed by postgres similarity search

---

## `fourth` + `forthLLM` — GPT in Forth, Because Why Not

**Problem:** I wanted to understand transformer inference well enough to implement it from scratch. Doing it in Python with numpy doesn't force the same depth of understanding as doing it in a language with no native arrays, no floating-point libraries, no nothing.

**Approach:** I started with `forthLLM` as the canonical repo and `fourth` as a personal fork/mirror. The project is a GPT model — BPE tokenizer, weight matrices, attention, sampling — written entirely in Forth. The commits tell the story:

- `f4a941e`: Initial snapshot, 200,088 lines of training data added
- `9178248`: BPE training for 100 steps with random-seed inference; removed 198,545 lines of local data from the repo (oops)
- `29e97ba`: Conversational loop tuning, "easy prompt" inference mode
- `9958865`: Tuned inference seeding so the model replies naturally to "hi" as a prompt

There's no Python in the final workflow. The `gpt.4th` file handles the whole pipeline — tokenization, matrix ops, attention heads, sampling. Here's roughly what the inference loop looks like structurally:

```forth
: run-inference ( -- )
  load-weights
  encode-prompt
  begin
    forward-pass
    sample-token
    dup emit-token
    end-token?
  until ;
```

It's 100x slower than any sane implementation and the "conversations" it produces are barely coherent. That's not really the point. The point was to understand the mechanics by being forced to implement stack-based matrix multiplication.

**Results:** The model trains (100 BPE steps), runs inference, and produces output. Response quality is approximately "autocomplete from a very drunk person who read some text once." Measured by vibes and the fact that it doesn't crash. The TypeScript inference CLI added in `f62c392` wraps the Forth execution so you can call it from a normal terminal without gforth ceremony.

**Pitfalls / What Broke:** The repo accidentally committed 200,088 lines of training data, then a subsequent commit deleted 198,545 lines. So the git history has a 200k line addition followed by a 198k line deletion. The `.gitignore` was updated to prevent future large data files from leaking in. Also: Forth's lack of proper scoping means variable names collide in ways that took a while to debug.

**Next:**
- Get coherent multi-turn conversations working
- Benchmark inference speed (currently measured as "wait a few seconds")
- Consider whether BPE is actually right for Forth or if byte-level is simpler to implement

---

## `omega` — The Agent That Fixes Its Own Bugs

**Problem:** Omega is my personal AI agent — handles Discord, runs tools, manages user profiles, does personality analysis. It kept breaking in production and I kept finding out via Discord messages from confused users rather than logs.

**Approach:** The big architectural move this period was wiring the full error → issue → fix → notify loop. Here's the chain:

1. Runtime error occurs in Omega (Discord bot or web API)
2. `captureError()` catches it and sends to GitHub as a new issue (deduped by error message hash)
3. GitHub issue triggers the Claude Code auto-fix workflow via `label_trigger: autofix`
4. Claude Code opens a PR with the fix
5. Railway deployment webhook fires → Discord notification

The Prisma side had its own chaos. At one point, `ApiUsageLog` needed adding to the schema (`450f4db`), then `ConversationMessage` was missing `@map("user_id")` (`bedac92`), then sentiment analysis was being returned as a parsed JSON object rather than a string so the code was trying to `JSON.parse()` an already-parsed object (`ef1528f`). These are the boring bugs that nonetheless take hours to track down in production.

The personality profiling system got a major overhaul (`eee77e5`, `11923d2`): multi-pass analysis, "Omega rating" (a single score across dimensions — not a diagnosis, opt-in, deletable), removed astrology entirely because it was dumb. The system prompt got tightened to emphasize TPMJS as the primary capability extension mechanism, and email sending rules were added so the bot doesn't accidentally spam people.

The homepage got an interactive `OmegaWireframe` visualization (`81532ba`), replacing the previous static layout.

One genuinely interesting feat: an OpenAI-compatible chat completions endpoint (`65ddef1`, +522 lines). This means anything that talks to OpenAI's API can now talk to Omega instead. Tested manually by pointing a local OpenAI client at it.

**Results:** The error → issue pipeline is live and has successfully auto-created issues from production failures. Measured by deliberately triggering errors (the `kickflip` test command) and watching the GitHub issue appear within ~30 seconds. The auto-fix workflow then picks it up within a couple minutes if Claude Code is configured.

**Pitfalls / What Broke:** Error deduplication was too aggressive — it was filtering out legitimate external tool errors as "noise" (`f470ed3`). The dedup logic now compares on a normalized error fingerprint rather than exact message match. Also: the comic listing page (`/comics`) was broken because the Prisma query was pulling `imageData` (a large blob) into memory for every record just to list titles. Fixed by removing that field from the listing query (`6bfb326`).

**Next:**
- Omega rating UI on profile pages needs polish
- OpenAI-compatible endpoint needs auth and rate limiting
- Analysis history diff viewer (landed in `10e6bfd`) needs user testing

---

## `tpmjs` — Tool Package Manager Getting Serious

**Problem:** TPMJS is supposed to be the npm for AI agent tools. But it had gaps: no visual way to build agent workflows, no ML tracking for tool usage patterns, no stateful execution sessions, and the tool sync pipeline was missing ~50 packages.

**Approach:** This was the most active repo (106 commits, 31 features, 40 fixes). The major pieces:

**Visual Workflow Builder** (`1e2c7a4`, +5,544 lines): Drag-and-drop canvas for composing agent workflows. Collections and tools show up in the palette, you wire them together. Uses React Flow under the hood. The architecture separates sandbox from executor types (`c49c9a7`) so you can toggle execution modes without rebuilding the graph.

**Agent Sandbox Executor** (`77ce4ee`): Stateful tool execution sessions backed by Deno. Session TTL extended to 24 hours so long-running agent conversations don't lose their state. The sandbox gets the same env vars as the parent agent, forwarded via request headers (`f5ee6f6`).

**ML Training Data Tracking** (`727b60f`, +404 lines): Every tool execution now logs to a training data table. The idea is to eventually use this to predict which tools an agent should reach for given a query, without having to search the whole registry. Stats pages surface this data (`6676464`).

**74 agnt.gg Tools** (`6bea848`, +9,682 lines): The `@tpmjs/official-agnt` package wraps the full agnt.gg tool catalog. These are the standard web-browsing, file-reading, search tools you'd expect. Integration required fixing the API request body format (`236c9d0`) and path prefixes (`ed66796`).

**Persistent Memory Service** (`d015607`): AI agents now have a memory service — store facts, retrieve by similarity. Lower default similarity threshold so it's actually useful in practice (`7993cb4`). The memory system was initially implemented as an `autoMemory` built-in tool, then ripped out and replaced with TPMJS `createMemory` so it goes through the same tool registry as everything else (`4c82155` in omega, `05caafc` for the original implementation).

**Sentry + Auto-Fix Pipeline** (`958b861`): Sentry errors hit a webhook endpoint, which creates GitHub issues, which trigger Claude Code auto-fix. Same architecture as Omega. Spent a lot of commits getting the Sentry webhook format right — it sends `event_alert` vs `issue_alert` payloads and you need to handle both.

**New Tool Packages**: postgres (22 tools), pandoc (3 tools), jq (2 tools) in `9d53c6d`. Supabase REST API (10 tools) in `e42bbdf`. Slack + Discord packages in `cc69d98`. The executor Dockerfile needed pandoc, jq, and postgresql-client actually installed (`4c65d38`).

**Timeline Page** (`5fed0ec`): Interactive development history visualization. Uses Isoflow for the isometric architecture diagram on `/tech` — had to wrap it in an iframe because Isoflow is React 18 and the rest of the app is React 19, and they don't share a reconciler well (`022ecda`).

**Omega Mac** (`1cd44b4`): Native macOS SwiftUI chat app that talks to the TPMJS/Omega API. Fixed macOS 14 compatibility by removing macOS 15-only APIs (`894f984`). The enter-to-send and duplicate message bugs got fixed (`5ac3bea`).

**Results:** The workflow builder ships and renders. Tool sync now covers ~50 previously missing packages (measured by comparing the registry count before/after the sync run in `cc69d98`). ML tracking data is visible on stats pages. The Sentry → GitHub → Claude Code pipeline fired on the first intentional test error.

**Pitfalls / What Broke:** The biome format check kept failing CI because of auto-generated files (`oclif.manifest.json`) and the timeline data JSON file. Fixed by excluding those paths explicitly. The Isoflow iframe approach means the architecture diagram can't deep-link or respond to React state changes — it's essentially a read-only embed. The sandbox session TTL increase to 24 hours means stale sessions sit around longer, which might be a memory issue on the executor pod at scale.

**Next:**
- Workflow builder needs a way to save/load named workflows
- ML tool prediction model needs actual training (right now it's just logging)
- Omega Mac app needs background operation (currently only works while the window is open)

---

## `mobtranslate.com` — Indigenous Language Platform Gets a Design System

**Problem:** mobtranslate.com had accumulated inconsistent styling across its pages — auth forms, dictionary search, word detail, leaderboard, settings — all slightly different. Dark mode was broken in several places. The 404 page was embarrassing. Place names in the dictionary had no visual geographic context.

**Approach:** The centerpiece is `@mobtranslate/ui` (`c914528`, +11,508 lines): a proper design system package with a styleguide app. This is the standard monorepo design system move — extract tokens, components, and patterns into a shared package, then migrate the web app to consume it.

The migration itself (`c8b70e3`) was substantial: +2,163 lines added but 13,768 deleted, which is a good sign. A design system should compress your UI code, not expand it.

Dark mode got a proper fix (`4dc3212`): system preference detection via `prefers-color-scheme`, token-based color switching, and fixes to the leaderboard card specifically which was ignoring dark mode entirely. The secondary color token was red (wrong), now neutral gray (`9c5ffbf`).

Interactive location maps for place names (`e116cd7`, +628 lines): dictionary entries that reference place names now render a map showing where that place is. This is meaningful for an indigenous language platform — geographic context is culturally significant, not decorative.

AI location enrichment pipeline for the admin (`a8bf2d8`): geocoding pipeline with AI enrichment for dictionary sync. Builds the geographic data that feeds the maps.

The `/api/version` endpoint (`8bcec8a`) is a small but important addition — it makes it easy to verify which version is actually deployed without checking Railway/Vercel dashboards.

**Results:** The design system migration reduced UI code by a net ~11,600 lines (measured by the diff in `c8b70e3`). Dark mode now works correctly on all pages verified manually. The styleguide app runs and shows all components. Location maps render for place names that have geocoded coordinates.

**Pitfalls / What Broke:** The styleguide had visual issues at launch — missing animation CSS classes (`f5a356d`) and layout problems (`f2ee0fb`). Dark mode on the leaderboard card specifically needed a separate fix after the main dark mode PR. The auth form width was off after the design system migration (`b497b03`). Design system migrations always shake out a week's worth of small visual regressions.

**Next:**
- Geocoding pipeline needs to cover more entries (currently only enriched during sync)
- Consider whether the styleguide app should be publicly accessible
- Mobile responsiveness on the translator widget was touched but probably needs a full audit

---

## `jsonresume.org` — Pathways Feature Gets Market-Ready

**Problem:** The pathways feature — career path analysis and job graph traversal — was built but not polished enough for public launch. Files were too large (violating the 200-line limit), tests were flaky due to non-deterministic random in VP-tree tests, and there were lint warnings across the board.

**Approach:** Three rounds of refactoring (`0035408`, `89c0d36`, `f8bec38`): split large files into focused modules, add comprehensive tests for the graph algorithms, optimize turbo caching. The VP-tree brute force test was failing non-deterministically because the random data it generated wasn't seeded — fixed by using a seeded random function (`c20452b`).

The graph algorithm optimization (`f8bec38`, +1,924 lines with 1,900 deleted) maintained the same external behavior while improving performance. Measured as "felt faster in local testing" — I didn't instrument it with timing, which I should do.

CI got cleaned up: removed explicit pnpm version that was conflicting with `action-setup@v4` (`1c2521c`), narrowed glob override to avoid breaking globby (`9073492`), security patches applied (`ca19abe`).

The market-readiness commit (`49a52dc`, +498/-348) touched the data pipeline hooks (`usePathwaysJobData.js`) and the integration test. Mostly API response shape normalization and error handling for the public-facing version.

**Results:** CI passes. The VP-tree test is now deterministic. Files comply with the 200-line limit. The pathways feature has integration test coverage for its main data pipeline. Whether it's actually "market ready" will be determined by user testing.

**Pitfalls / What Broke:** The refactoring runs that split files also introduced new lint warnings (unused imports, `vi.mock` needing `vi` imported), which required follow-up fix commits. The 200-line file limit is a useful constraint but it does create overhead — sometimes a 250-line file is just a 250-line file.

**Next:**
- Instrument graph algorithm with timing metrics
- Public launch prep: rate limiting, auth checks on sensitive endpoints
- Pathways API documentation

---

## `blocks` — Registry Foundations and Auth Groundwork

**Problem:** Blocks is a component/tool registry. It needed lazy auth initialization (so you don't pay the auth cost unless you're doing something that needs it), and the tools sync pipeline to push from TPMJS to the Blocks registry needed building.

**Approach:** Three commits this period. The main one (`39e5006`): lazy-init auth with `getAuth()` — instead of initializing auth at module load time (slow, fails fast if env vars are missing), it now initializes on first use. Source maps were regenerated as part of this refactor.

The TPMJS sync script (`eaebc3a`, +156 lines): pushes official tools from the TPMJS registry into Blocks. This is the bridge that makes tools available in both ecosystems without maintaining two separate catalogs.

Changesets for upcoming features were documented (`79c7902`, +34 lines): store package, public registry, and auth. These are the pending features in the queue.

**Results:** Auth initialization is now lazy — measured by the absence of startup errors when auth env vars aren't set in test environments. The sync script successfully pushes tools (verified manually by running it against a local Blocks instance). Changesets exist, which means the publishing pipeline knows what's coming.

**Pitfalls / What Broke:** The source map regeneration in `39e5006` is a maintenance overhead — every time the auth module changes, maps need regenerating. Might be worth automating in the build step. The sync script is a one-way push with no conflict resolution; if a tool is modified in Blocks directly, it'll get overwritten on next sync.

**Next:**
- Implement the public registry (documented in changeset)
- Wire the store package
- Add conflict detection to the sync script

---

## `lordajax.com` — One Commit, This Post

One commit. It was the auto-generated weekly activity blog posts that keep landing here. The site itself is working fine. Sometimes the most honest thing you can say about a repo is "it was there, it did its job."

---

## What's Next

- **Auto-fix pipeline cross-pollination**: Omega and TPMJS both have the Sentry → GitHub → Claude Code loop. The next step is making it generic enough to drop into any project with a one-file config
- **TPMJS workflow builder persistence**: Saving and loading named workflows is the feature that makes the visual builder actually useful rather than a demo
- **ML tool prediction**: The training data is accumulating. Need to build the actual prediction model that uses it
- **MobTranslate geocoding coverage**: Expand the AI enrichment pipeline to cover more dictionary entries with geographic data
- **Forth GPT coherence**: Better sampling (beam search or at minimum temperature tuning) to get less garbage output from the model
- **JSON Resume Pathways public launch**: The code is market-ready by internal standards; needs real users to find the edge cases
- **Blocks public registry**: The changeset exists, the auth foundation is laid

---

## Links & Resources

**Projects**
- [tpmjs/tpmjs](https://github.com/tpmjs/tpmjs) — Tool Package Manager for AI Agents
- [thomasdavis/omega](https://github.com/thomasdavis/omega) — Personal AI agent platform
- [australia/mobtranslate.com](https://github.com/australia/mobtranslate.com) — Indigenous language translation platform
- [jsonresume/jsonresume.org](https://github.com/jsonresume/jsonresume.org) — JSON Resume mono repo
- [thomasdavis/fourth](https://github.com/thomasdavis/fourth) — GPT in Forth
- [rolandnsharp/forthLLM](https://github.com/rolandnsharp/forthLLM) — ForthLLM canonical repo
- [thomasdavis/blocks](https://github.com/thomasdavis/blocks) — Component/tool registry

**Tools & Services**
- [Railway](https://railway.app) — Deployment and hosting
- [Sentry](https://sentry.io) — Error monitoring
- [agnt.gg](https://agnt.gg) — Tool catalog
- [React Flow](https://reactflow.dev) — Workflow builder canvas
- [Isoflow](https://isoflow.io) — Isometric architecture diagrams
- [Deno](https://deno.land) — Sandbox executor runtime
- [Prisma](https://prisma.io) — ORM across all the postgres-backed projects
- [Vercel](https://vercel.com) — Frontend deployments
