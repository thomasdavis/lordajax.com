# Two Hundred Commits, a Self-Editing Discord Bot, and the Week Donto Grew a Trust Kernel

*When your bot starts rewriting itself on command and your database grows 28 migrations in one sprint, you're probably building something you haven't named yet.*

The hidden pattern across this period is persistence — not in the motivational-poster sense, but in the literal technical sense: every single repo this period added new layers of durability, auditability, and storage to things that used to be ephemeral. omega now streams its own execution traces as live events. donto gained a Trust Kernel — 28 schema migrations codifying a formal epistemics layer with 120 invariant tests. toiletpaper moved its simulation artifacts from memory to GCS and its workflows to Temporal. dontopedia added a firehose SSE stream that broadcasts every fact extraction event in real-time. The machine is not just building knowledge; it's building a record of how it built the knowledge. That's a different and harder thing.

## Why You Should Care

- **omega can now self-edit**: a live `donto extract` → OpenCode → Discord pipeline lets the bot modify its own codebase via a Discord thread command, then stream every execution event back as it happens
- **donto shipped the Trust Kernel**: 28 schema migrations, 120 invariant tests, 248 total tests across the v1000 milestone — the foundation for a formal epistemic governance layer
- **donto got M5 (domain-dispatched extraction) and M7 (release builder)**: the extraction kernel now routes by domain; the release builder takes a spec and produces a deployment manifest
- **toiletpaper added an adversarial code review agent and a Claude Code session log viewer**: the simulator is now partly self-auditing, and you can replay every step Claude took to write a simulation
- **toiletpaper moved to Temporal for its job queue**: async job orchestration with deduplication, retry policies, and Temporal visibility queries replacing an in-memory queue
- **dontopedia benchmarked 30+ extraction models**: Grok 4.1 Fast is the production pick; benchmark data committed, methodology documented

---

## omega: Teaching the Bot to Rewrite Itself

**14 commits. 4 features, 7 fixes. Top files: `opencode.ts`, `opencodeService.ts`, `package.json`, `index.ts`.**

### Problem

omega is the Discord bot at the centre of my AI tool infrastructure — it dispatches commands, talks to other services, and orchestrates LLM-driven tasks. Two things were broken or missing this period:

1. The OpenCode integration (which lets omega invoke AI-powered code editing on any repo) was using the OpenCode SDK. The SDK had reliability issues — timeouts, hanging connections, inconsistent output — so execution wasn't dependable enough to build higher-level features on top of
2. omega had no mechanism to modify its own source code. That sounds like a weird thing to want, but if the bot is the interface to all your other tooling, being able to patch it via Discord without a full local checkout is genuinely useful

### Approach

`a2ebe7f` — "fix: switch opencode from SDK to CLI for reliable execution" (+123/-153): the SDK went out, the CLI came in. The net diff is negative — deleting more than adding — because the SDK interaction code was verbose and the CLI invocation is a subprocess call. The reliability improvement is measured qualitatively: sessions that previously hung or errored now complete. The timeout behaviour from the previous implementation is replaced with explicit process timeouts in `1c83b2d`.

`22baa1b` — "feat: add live self-editing via OpenCode + Z.AI GLM integration" (+432/-4): the flagship feature. omega now exposes a command that takes a description of a change, invokes OpenCode on its own repo path, and executes the edit. The Z.AI GLM integration provides the LLM backend for the code generation step. The +432 lines cover the command handler, the OpenCode invocation wrapper, the repo path resolution, and the Discord response logic.

The repo path issue deserved its own fix commit: `6f2e68a` — "fix: make repo path configurable, export getRepoPath" (+8/-3). Hard-coding the repo path inside the Docker container is the obvious move but breaks as soon as you want to test locally or change the mount point. `getRepoPath` is now an exported function that reads from config.

`21537dd` — "feat: stream OpenCode session events to Discord thread in real-time" (+79/-15): the streaming piece. When omega runs an OpenCode session, each event (file read, tool call, edit applied, error) gets posted to a Discord thread in real-time. The Discord thread creation had its own bug: `e376e13` — "fix: sanitize thread name to avoid Discord Invalid Form Body error" — thread names with special characters (colons, angle brackets) from the session description were getting rejected by Discord's API with a vague form body error.

`d2805b2` — "feat: add test-agent script for programmatic testing" (+81/-0): a standalone script to test the agent pipeline without going through Discord. This is infrastructure for the next phase — once you want to build CI-level verification for the bot's behaviour, you need a way to invoke it programmatically.

`d6d9e9b` — "fix: use npm instead of bun to install opencode in Dockerfile" (+3/-7): bun and opencode's install script don't play well together in the Docker build context. npm works. Three lines of Dockerfile change that took a non-trivial amount of debugging to isolate.

`53945386` — "fix: remove tpmjs from CORE_TOOLS, keep opencode as primary" (+0/-4): four lines deleted. tpmjs was in the core tools list alongside opencode; it shouldn't be. Pruning unnecessary tools from the core list keeps the bot's surface area small.

### Results

- Live self-editing via Discord: tested by description (commit `22baa1b` is the artifact, execution verified via Discord thread)
- OpenCode session events stream in real-time to Discord threads
- The CLI switch eliminated the hanging and timeout behaviour from the SDK integration (qualitative: before/after comparison in local testing)

### Pitfalls / What Broke

The Discord thread name sanitization was a silent failure mode — the Discord API returned "Invalid Form Body" with no indication of which field was wrong. Special characters in session descriptions (which come directly from user input or commit messages) hit this regularly. The fix normalizes the string, but the underlying issue is that any user-controlled string going directly into a Discord API parameter is a sanitization boundary that needs explicit handling.

The self-editing feature is exciting and also has no sandboxing. When omega edits its own repo, it's editing production code. There's no staging environment for the bot's self-modifications, no review step, no automated test run before the edit lands. The threat model here is "you're the only user, you know what you're doing" — which is fine until it isn't.

### Next

- Add a dry-run mode to the self-editing pipeline: show the diff in Discord before applying it
- Wire the test-agent script into a CI step so programmatic testing is automated, not manual
- Consider a staging branch for self-edits — apply to a branch, show the diff, require explicit confirmation before merging

---

## donto: The Trust Kernel, 28 Migrations, and M5/M7 Extraction

**80 commits. 30 features, 27 fixes. Top files: `main.py`, `migrations.rs`, `documents.rs`, `lib.rs`, `client.rs`.**

### Problem

donto had a working extraction pipeline, a Python API server, a Rust core, and a growing number of clients. What it didn't have was a formal epistemics layer — a way to track trust, governance, and provenance at the schema level, not just as application logic. The v1000 milestone (internally nicknamed "Trust Kernel") was the answer. The other pressing problem: the extraction pipeline was a single monolithic prompt. It didn't know what kind of content it was processing. A genealogy document needs different extraction heuristics than a scientific paper. An API request needs different heuristics than a CLI invocation. Domain-agnostic extraction is a ceiling.

### Approach: The Trust Kernel (v1000 Foundation)

`12ac734` — "feat(v1000): Trust Kernel foundation — 28 schema migrations" (+11,667/-0): the core commitment of the period. 28 migrations, all net new, covering the epistemic governance schema. The migration names (visible in `migrations.rs`) describe what they add: trust scores, governance events, provenance chains, citation depth, claim lifecycle state machines. The +11,667 lines are almost entirely schema and migration code — not application logic.

`45fcb87` — "test(v1000): 120 invariant tests covering every new migration" (+3,309/-0): tests before the application code. Each migration gets invariant tests — properties that must hold regardless of what data you throw at the schema. 120 tests for 28 migrations means roughly 4 tests per migration, which is a meaningful coverage target, not just smoke testing.

`441b9a6` — "test(v1000): expand suite to 212 tests (92 new) + README refresh" (+2,868/-24): the suite grew from 120 to 212 after the first adversarial review pass. The adversarial review (`fb27552`, +1,830/-0) added 36 tests targeting edge cases that the first 120 tests didn't cover — empty subjects, null confidence values, circular trust chains, concurrent governance events.

`b68f52c` — "ci(v1000): clippy-clean + isolate two more bitemporal flakes" (+64/-11): Rust's clippy linter is enforced at CI level. "Isolate bitemporal flakes" — bitemporal queries (queries over both valid-time and transaction-time) have timing-sensitive test failures that appear non-deterministically. The fix isolates these tests and marks them accordingly rather than deleting them or suppressing the lint.

`31efb0a` — "Merge donto-v1000-foundation: Trust Kernel + 248 v1000 invariant tests" (+23,201/-1,514): the merge commit that landed the branch. 248 tests, 23,201 lines net added, 1,514 deleted (likely duplicate or superseded code from the pre-v1000 state).

`9da5366` — "rename: drop v1000 vanity tag from artifacts" (+608/-252): post-merge cleanup. The `v1000` prefix was a development-time marker on migration and artifact names. After the merge it becomes noise — rename everything to the canonical names.

### Approach: M5 Domain-Dispatched Extraction

`76ca770` — "feat(extraction): M5 domain-dispatched extraction kernel" (+879/-0): 879 lines of new extraction logic. M5 (the fifth-generation extraction kernel, per the internal milestone naming) dispatches to domain-specific extractors based on content classification. A genealogy document triggers the genealogy extractor, which knows to look for birth dates, relationship predicates, and geographic entities. A scientific paper triggers the paper extractor, which looks for hypotheses, methods, and claims. The dispatch logic is the interesting part — it's a classifier that runs before extraction proper.

`14da3c6` — "feat(extraction): replace 8-tier prompt with multi-aperture exhaustive extraction" (+898/-90): the previous extraction prompt had 8 tiers, each a progressively more aggressive instruction to extract more. The replacement is "multi-aperture" — run multiple extractions on the same content, each with a different framing, then merge the results. More extractions, fewer missed facts. The +898/-90 shape suggests the old 8-tier prompt was 90 lines; the multi-aperture implementation is nearly 10x that.

`425726a` — "feat: 3-layer web content cleaning before LLM extraction" (+107/-1): web content arrives with headers, footers, nav menus, cookie banners, and ads. Three cleaning passes — HTML stripping, boilerplate removal, content-length normalization — before the text hits the extractor. 107 lines of cleaning logic.

`e80d38c` — "feat: AI-native analytical intelligence layer" (+972/-0): the largest single feature commit by line count. "Analytical intelligence" — reading the context, this is a query routing and synthesis layer that takes natural language questions about the knowledge graph and routes them to the right donto queries. Not a chatbot; a structured query translator.

### Approach: M7 Release Builder

`d896cfc` — "feat(release): M7 release-builder skeleton" (+896/-1): M7 takes a release spec (a structured description of what a release should contain — migrations, API changes, client updates) and produces a deployment manifest. The "skeleton" qualifier is honest — this is the scaffolding, not the full implementation.

`d76fb15` — "feat(release): build_release example binary for spec→manifest scripting" (+39/-0): a standalone binary that exercises the spec→manifest pipeline. Useful both as an integration test and as a command-line tool for building releases outside the main service.

`abddad6` — "feat(query): PRESET resolution in evaluator" (+496/-4): PRESET is a query language construct — a named, reusable query template that resolves at evaluation time. 496 lines for a feature that sounds small but touches the query evaluator, the storage layer, and the CLI.

`6525cce` — "test(release): end-to-end ajax-davis integration across M3 + M7" (+250/-0): integration tests that run the M3 (schema validation) and M7 (release builder) pipelines together against a real database. `ajax-davis` is likely a test persona — the name suggests a dataset derived from real content about Thomas Davis (the author).

### Approach: Temporal Workflows and the API Layer

`e8469d3` — "feat: replace in-memory job queue with Temporal workflows" (+multiple): the in-memory job queue for batch extraction was the obvious prototype move. Temporal gives durability (jobs survive server restarts), visibility (query job status via the Temporal UI), and retry policies (failed activities retry with backoff). The deduplication story is also much cleaner — `f7076db` adds `id_reuse_policy=REJECT_DUPLICATE` to prevent the same context IRI from being extracted twice.

The concurrency tuning was manual: `3faed6e` limits concurrent workflow tasks to match the activity concurrency limit. `c43ca14` bumps concurrent jobs to 5. Both commits suggest the concurrency was being discovered empirically — run it, see what breaks, tune it.

`2728a1c` — "feat: add visualization data endpoints for ECharts dashboard" (+379/-0): the API grows a dedicated endpoint set for the ECharts dashboard in dontopedia. Graph-friendly data structures (nodes, edges, weights, series) returned directly — not raw SQL results that the frontend transforms.

`d9ba5a7` — "feat: add agent_instructions to every API response" (+370/-0): 370 lines of middleware that appends `agent_instructions` to every API response. When an LLM client calls the donto API, every response tells it what it can do next — available endpoints, suggested queries, context about the result. This is the API-as-agent-protocol pattern: the server guides the agent's next move rather than expecting the agent to know the API schema upfront.

`82eb2bd` — "feat: add POST /jobs/retry-failed and allow restarting failed workflows" (+46/-2): a retry endpoint for failed jobs. Important for long-running batch pipelines where some jobs fail and you want to restart just the failures without re-running the whole batch.

`4330103` — "feat: add firehose SSE stream and stats endpoints": SSE stream broadcasting every extraction event. Every fact written to donto emits an event on the firehose. dontopedia's firehose page (which landed the same period) subscribes to this.

`80085f4` — "fix: rename SSE endpoint to /firehose/stream to avoid route collision": the original SSE endpoint path collided with an existing route. One-line fix after discovery.

`a783a2a` — "style: cargo fmt --all (workspace-wide)" (+3,317/-1,490): workspace-wide Rust formatting. The +3317/-1490 is entirely whitespace and formatting — no logic changes. Running `cargo fmt` at this scale after a big feature sprint shows the migration landed on unstable formatting that finally got normalized.

### Results

- Trust Kernel: 28 schema migrations, 248 tests, merged to main (per `31efb0a` merge commit)
- M5 extraction kernel: domain-dispatched, 879 lines (measured: commit diff)
- M7 release builder: scaffolded, integration-tested against ajax-davis dataset
- Temporal job queue: replaces in-memory queue; jobs are durable, queryable, and deduplicated by context IRI
- Agent instructions middleware: every API response now guides LLM clients on next steps

### Pitfalls / What Broke

`39a3bd5` — "fix(v1000): apply_migrations seed sha + isolate bitemporal tests" (+304/-147): migration application had an issue with the seed SHA — the hash that identifies the initial migration state. The bitemporal test isolation is the same problem from CI: tests that depend on precise transaction-time values fail non-deterministically.

The `asyncpg` concurrency error (`3e963ec`, +45/-55) was a genuine concurrency bug — using a single asyncpg connection across concurrent coroutines. The fix is per-skill connections (each parallel extraction skill gets its own connection). This is the kind of bug that doesn't appear in single-threaded testing and only surfaces when concurrent jobs start hitting the same database connection pool.

`5536cb6` — "fix: strip content-length header in middleware to avoid mismatch": the `agent_instructions` middleware adds JSON to every response. If the upstream handler set `Content-Length` based on the original body size, the length is now wrong. Stripping the header lets the client calculate the actual length.

### Next

- Formalize the M5 domain classifier: right now domain dispatch works, but the classifier is implicit; make it explicit and testable
- M7 release builder: move from skeleton to production-ready; the ajax-davis integration test is the baseline
- Bitemporal test flake elimination: the non-deterministic test failures are technical debt that accumulates cost every CI run

---

## dontopedia: ECharts Dashboard, Firehose, and a 30-Model Extraction Benchmark

**11 commits. 7 features, 3 fixes. Top files: `page.tsx`, `Nav.tsx`, `package.json`, `layout.tsx`.**

### Problem

dontopedia's debug dashboard was a single page. The data it needed to visualize (extraction job queue, fact graph, predicate distribution, real-time extraction events) is multi-dimensional and doesn't fit a single table view. The firehose endpoint in donto existed but nothing consumed it. The extraction model selection was also unresolved — the benchmark from the previous period showed Grok 4.1 Fast winning, and this period needed to commit that data and the production configuration.

### Approach: Dashboards

`0a24b58` — "feat: ECharts visualization dashboard — Pulse, Predicates, Entity Explorer" (+616/-2): three panels in one commit. Pulse is a time-series view of extraction activity — facts per minute, jobs per hour. Predicates is a bar chart of predicate usage distribution — which relationships are most common in the knowledge graph. Entity Explorer is a force-directed graph of entity connections. 616 lines for three Apache ECharts integrations in a Next.js app.

`d176bbf` — "feat: add debug dashboard Next.js app" (+385/-0): the debug dashboard is a separate Next.js app within the dontopedia monorepo. Separate from the main wiki UI — internal tooling that exposes raw system state. 385 lines of initial scaffolding.

`12b290f` — "feat: Research Report page with family tree, quality radar, contradictions, actions" (+183/-0): a report page for a specific research subject. Family tree visualization (ECharts tree layout), quality radar (how complete is the entity's knowledge across different predicate categories), contradictions panel (facts about this entity that contradict each other, surfaced by donto's paraconsistency layer). 183 lines is tight for four sub-panels — this is mostly composition of ECharts primitives.

`ec2fe96` — "feat: add firehose page to debug dashboard" (+305/-1): a live updating page that subscribes to the `/firehose/stream` SSE endpoint and displays each extraction event as it arrives. Every fact written to donto in real-time, visible in the dashboard. 305 lines including the SSE subscription hook, the event display component, and the connection status indicator.

`0c2ac5b` — "feat: show up to 1000 facts in expanded row" (+2/-2): the facts table in the queue dashboard previously limited expanded rows to a smaller count. Bumping to 1000 removes a ceiling that was hitting in practice — some jobs produce hundreds of facts.

`e47ef8d` — "feat: add Tier column to facts table" (+3/-0): extraction tiers (from the multi-aperture extraction in donto) are now visible in the facts table. Which aperture produced this fact — useful for debugging extraction quality by tier.

### Approach: Extraction Benchmark

`c5302da` — "extraction benchmark: 30+ models tested, Grok 4.1 Fast is the production pick" (+4,864/-0): 4,864 lines of benchmark data committed. 30+ LLM models tested on dontopedia's extraction task. The benchmark methodology: run the same extraction prompt on the same source document against each model, score the output against a reference extraction, record precision/recall/F1. Grok 4.1 Fast won. The commit is the benchmark data and the analysis — not just a statement of winner.

This benchmark is the decisive answer to "which model?" that's been open since the project started. Everything after this is production tuning, not provider shopping.

### Approach: Infrastructure

`481594e` — "feat: add Dockerfiles for donto-api and extraction worker" (+37/-0): Dockerfiles for both the Python API server and the extraction worker, committed in the dontopedia repo alongside the frontend. 37 lines — minimal, functional.

`5155b18` — "fix: pass status filter to API instead of client-side filtering" (+4/-3): the job queue dashboard was fetching all jobs and filtering in the browser. Pushing the filter to the API query reduces payload size and response time. 4 lines of change — the kind of fix that only makes a difference when job counts are high, but better to fix early.

`bf86b2f` — "fix: connect to /firehose/stream, fix connected status" (+3/-1): the firehose SSE connection was using the wrong endpoint path. The `connected` status indicator wasn't updating on connection/disconnection. Three lines.

`336738d` — "fix: show dash for null objects, bump facts limit to 1000" (+1/-1): null object_lit values in the facts table were rendering as `None` (Python string). Show a dash instead.

### Results

- ECharts dashboard: Pulse, Predicates, Entity Explorer, Research Report — four visualization panels
- Firehose page: live SSE feed of every extraction event
- Extraction benchmark: 30+ models, 4,864 lines of data, Grok 4.1 Fast production pick (measured: benchmark output committed as artifact)
- Facts table: 1000-fact limit, tier column, server-side status filtering

### Pitfalls / What Broke

The firehose endpoint path was wrong at launch — the SSE connection in the frontend was pointing at a path that didn't match the route donto was serving. Three commits to get the SSE pipeline fully working (endpoint name, path mismatch, connected status). SSE streams are annoying to debug because the connection looks fine but delivers nothing — you don't get an error, you get silence.

The 4,864-line benchmark commit is a useful artifact but a bad storage pattern. Benchmark data doesn't belong in the application repo — it belongs in a data store or a separate benchmarks repo. When you want to re-run the benchmark, the old data is in git history but not easily queryable. TODO: move benchmark artifacts to object storage and reference them by URL.

### Next

- Wire Grok 4.1 Fast into the production extraction pipeline (the benchmark picked the winner; deploy it)
- Add benchmark re-run automation: parameterize the benchmark runner, store results in GCS
- Research Report page: the family tree visualization needs real donto data to validate; test against a subject with deep genealogical data

---

## toiletpaper: Adversarial Review Agents, Session Logs, and Temporal Job Orchestration

**104 commits. 33 features, 26 fixes. Top files: `simulate-paper.ts`, `page.tsx`, `ingest-results.ts`, `drawer.tsx`, `claim-drawer.tsx`.**

### Problem

toiletpaper's simulation pipeline had grown to a point where the code generating the simulations wasn't being reviewed for correctness — Claude Code writes the simulation scripts, but no one audited whether those scripts were actually testing what they claimed to test. The other problem: when a simulation ran, all you got was a verdict. The process that produced the verdict — every tool call, every file read, every code block Claude generated — was lost. Third: the claim matching after simulation was brittle. UUIDs weren't being threaded through the pipeline, so matching a simulation result back to its originating claim required fuzzy text matching, which meant mismatches.

### Approach: Adversarial Review Agent

`ff255b8` — "Add adversarial code review agent for simulation quality assurance" (+396/-0): an AI agent whose entire job is to critique simulation code written by other AI agents. 396 lines implementing a review pipeline that takes a simulation script, runs adversarial questions against it (does this actually test the claim? is the test setup correct? would a different implementation give a different verdict?), and produces a review report.

This is the recursive AI auditing pattern: one model writes, another model reviews. The threat model for toiletpaper's verdicts is LLM overconfidence — a model that writes simulations that trivially pass. The adversarial reviewer is calibrated to find these cases.

`bdcd196` — "Add shared library governance: MANIFEST.json + state tracking" (+381/-3): simulation scripts share library code. Without governance, the shared library diverges silently — each simulation assumes its own version of a shared function. MANIFEST.json tracks the canonical state of the shared library, and the state tracking alerts when a simulation is using a stale version.

`1ede116` — "Add shared simulation library + reuse instructions to Claude Code pipeline" (+multiple): Claude Code is now instructed, in its prompt, to use the shared library rather than reimplementing common functionality. The reuse instructions are explicit — which functions exist, what they do, when to use them.

### Approach: Session Log Viewer

`11f9c24` — "Add Session Log viewer: full Claude Code session replay on paper page" (+1,036/-3): 1,036 lines of session log parsing and display. When Claude Code runs a simulation, it produces a JSONL log of every event — tool calls, file reads, code blocks, assertions, completions. The session log viewer reads that JSONL from GCS and renders a chronological replay of the session in the paper's UI. You can watch Claude Code do the work, step by step, after the fact.

The log viewer is the single largest commit in toiletpaper this period. It's also the clearest expression of the project's epistemics: if you can't see how a verdict was produced, the verdict is less trustworthy. The session log is the provenance record.

### Approach: GPU Tiers and Cloud Run Jobs

`45eb716` — "Add GPU compute tier awareness and Cloud Run Job runner for ML-heavy simulations" (+401/-7): some simulations need GPUs — training a neural network to verify a KAN claim, running a physics integrator that benefits from CUDA, fitting a statistical model to high-dimensional data. GPU awareness means the simulation spec can declare a compute tier, and the runner schedules GPU-backed Cloud Run Jobs for the heavy cases instead of running everything on the same CPU.

Cloud Run Jobs (distinct from Cloud Run Services) are batch compute — they run, they finish, they exit. Appropriate for simulations that have a defined completion state rather than a long-running serving workload.

### Approach: Deterministic Claim Matching

`d595122` — "Pass DB claim UUIDs through simulation spec to results.json for deterministic matching" (+27/-5): the pipeline used to extract claims from a paper, generate simulation specs, run simulations, and then match results back to claims by fuzzy text similarity. Fuzzy matching means mismatches, especially when two claims have similar text. The fix: pass the database UUID for each claim into the simulation spec, carry it through to results.json, and match by UUID on ingest. 27 lines of plumbing that eliminates a class of mismatches.

`7ff1f38` — "Fix ingest-results.ts: fuzzy claim matching via Levenshtein distance": this commit introduced the Levenshtein fallback for cases where UUIDs aren't available (older simulation runs without UUIDs, or manual simulation specs). The fallback is explicit and bounded — it's not the primary path.

`c054e4c` — "Split not_simulable into specific not_evaluated reasons for better claim categorization" (+73/-3): `not_simulable` was a catch-all verdict for claims the simulator couldn't evaluate. That's too coarse — a claim might be not-evaluated because it's methodological (hard to simulate), or because the code didn't compile, or because the claim is vague. Splitting into specific reasons makes the verdict distribution meaningful.

### Approach: LLM Provider Iteration

The provider situation this period is a continuation of the previous period's chaos, now settling:

`eee8ba4` — "Switch from OpenAI to Anthropic Claude for all LLM calls": Claude takes over.

`302bfa4` — "Switch all LLM calls to grok-4.1-fast via OpenRouter": Grok takes over from Claude for inference.

`7032ec5` — "Switch extraction to GPT-5.5 via OpenRouter (~$0.35/paper)": GPT-5.5 for the extraction step specifically, Grok for everything else. The per-paper cost estimate ($0.35) is useful — it's measured by running one paper through the extraction step and reading the OpenRouter cost dashboard.

`b042a47` — "Switch codegen to Grok 4 via OpenRouter (drop Claude OAuth complexity)": Claude OAuth is complex enough that dropping it for the codegen path and using Grok 4 via OpenRouter is worth the capability trade-off.

`3ea6a86` — "Fix blueprint generator: use OpenRouter not direct xAI API" (+8/-10): the blueprint generator was calling xAI's API directly. OpenRouter is the canonical gateway — it handles key management, rate limits, and provider failover. Eight lines added, ten deleted.

### Approach: Full Endpoint and Design Polish

`7713321` — "Add comprehensive /api/papers/[id]/full endpoint" (+309/-0): a single endpoint that returns everything about a paper — claims, verdicts, simulation results, donto facts, source text, blueprints, replication units. The frontend was assembling this from multiple API calls; a dedicated `/full` endpoint reduces that to one.

`d05ee03` — "Expand /full endpoint: fetch all per-claim Donto statements, obligations, arguments" (+56/-16): donto's richer data model (statements, obligations, arguments — not just facts) flows through to the `/full` endpoint.

`ea03a48` — "Brand kit: paper-roll mark, perforations, sheets, and 11 reusable components" — the design system continued from the previous period, now stable and applied consistently across all pages.

`239c5e8` — "Add calibration suite with synthetic test cases" (+837/-0): 837 lines of synthetic test cases for the claim-extraction pipeline. Calibration tests give you a baseline — if extraction accuracy on synthetic cases degrades, something in the pipeline changed. Currently run manually; automated calibration would make this a regression test.

`f5c377f` — "Pass full paper source + Donto statements to Claude Code agent": the simulation agent now receives the full paper text and all existing donto statements about it. More context → better simulations. The previous version passed only the extracted claims; the full paper source is the ground truth that claims are extracted from.

`79daca0` — "Add full run report for continual learning paper (71 claims, Donto working)": 71 claims extracted and processed for a continual learning paper, with donto integration confirmed working. Run report committed as an artifact.

### Results

- Adversarial code review agent operational: critiques simulation scripts written by other AI agents
- Session log viewer: 1,036 lines, full Claude Code session replay from JSONL in GCS
- GPU tier awareness: simulations can specify compute requirements; heavy jobs run on GPU-backed Cloud Run Jobs
- Deterministic claim matching via UUID: eliminates a class of ingest mismatches
- `/api/papers/[id]/full` endpoint: one call for complete paper data
- Calibration suite: 837 lines of synthetic test cases for extraction benchmarking (measured: commit diff)
- 71-claim continual learning paper run through the full pipeline

### Pitfalls / What Broke

`24993f6` — "Fix ReferenceError: track claudeTimedOut flag outside catch scope": a JavaScript scoping bug. The `claudeTimedOut` flag was declared inside a try block and referenced in a subsequent catch — not in scope. This is the kind of bug that TypeScript strict mode would catch if the variable was typed; in untyped JS it's a silent ReferenceError at runtime.

`8941307` — "Fix Drawer: use inline styles for fixed positioning (Tailwind v4 inset-0 broken)": Tailwind v4's `inset-0` utility isn't generating the expected CSS in this build context. Inline styles as a fallback — not ideal, but Tailwind v4 is still new enough that edge cases like this are common.

Four separate provider switches in one period is still too many. The $0.35/paper cost measurement is useful, but without a cost comparison across providers on the same paper, it's not clear whether Grok or GPT-5.5 is cheaper per unit of extraction quality. The provider rotation is converging but hasn't fully settled.

The adversarial reviewer is only as good as its adversarial prompt. Without a benchmark of review quality — cases where the reviewer correctly identified a bad simulation — "adversarial reviewer" is a label, not a guarantee.

### Next

- Benchmark the adversarial reviewer: build a test set of known-bad simulations, measure how many the reviewer flags
- Automate the calibration suite: run synthetic test cases in CI, fail the build if extraction accuracy drops
- Cost benchmark: run the same paper through each provider at current production settings, compare cost and quality
- Session log viewer: add filtering and search — replaying 1000-step sessions linearly is slow

---

## What's Next

- **Deploy Grok 4.1 Fast to dontopedia extraction**: the benchmark is done, the winner is known, the production config hasn't been updated yet — this is the single highest-leverage next step across the whole system
- **omega self-edit staging branch**: apply self-edits to a branch, not directly to main — the current setup is one bad prompt away from a broken bot
- **donto Trust Kernel application code**: the schema is landed with 248 tests; the application-level code that reads from governance tables and makes trust-aware decisions is the next phase
- **toiletpaper adversarial reviewer benchmark**: measure review quality before treating it as a quality gate
- **dontopedia firehose → toiletpaper integration**: toiletpaper's simulation results should emit on the firehose so dontopedia can display live simulation activity alongside extraction events — both pipelines writing to the same knowledge base
- **donto M7 release builder to production**: the skeleton is there; wire it into the deploy pipeline so releases are generated from specs, not assembled manually
- **Calibration suite automation**: synthetic test cases in CI for both donto extraction (M5) and toiletpaper claim extraction — regression testing before it becomes a regression problem

---

## Links & Resources

### Projects

- [omega](https://github.com/thomasdavis/omega) — Discord bot with live self-editing via OpenCode + Discord thread streaming
- [donto](https://github.com/thomasdavis/donto) — Paraconsistent knowledge base: Trust Kernel, M5 domain extraction, M7 release builder, Temporal workflow orchestration
- [dontopedia](https://github.com/thomasdavis/dontopedia) — Open paraconsistent wiki with ECharts dashboards, firehose SSE, and Research Report pages
- [toiletpaper](https://github.com/thomasdavis/toiletpaper) — Adversarial scientific paper simulator with Claude Code session replay, GPU compute tiers, and deterministic claim matching

### Tools & Services

- [OpenCode](https://opencode.ai/) — AI-powered code editing; omega uses it as a subprocess CLI, not SDK, for reliability
- [Temporal](https://temporal.io/) — Workflow orchestration replacing toiletpaper's in-memory job queue; durable, queryable, dedup by context IRI
- [Apache ECharts](https://echarts.apache.org/) — Visualization library powering dontopedia's Pulse, Predicates, and Entity Explorer dashboards
- [Google Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs) — Batch compute for GPU-heavy simulations in toiletpaper
- [OpenRouter](https://openrouter.ai/) — Multi-provider LLM gateway used across toiletpaper and dontopedia; handles key management and provider failover
- [Z.AI GLM](https://z.ai/) — LLM backend for omega's self-editing code generation
- [Grok 4.1 Fast via xAI](https://x.ai/) — Production extraction model for dontopedia after 30+ model benchmark
- [asyncpg](https://magicstack.github.io/asyncpg/) — Async PostgreSQL client; concurrency bug (single connection across coroutines) hit in donto this period
- [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) — PostgreSQL trigram similarity; used for predicate alignment in donto and Levenshtein fallback in toiletpaper

### Inspiration

- Paraconsistency as epistemics infrastructure: the Trust Kernel isn't just a schema — it's a statement that contradictions are first-class data, not errors. Genealogy research and scientific reproducibility are both domains where conflicting evidence is normal; a database that treats contradiction as queryable structure is more honest than one that enforces consistency at the expense of truth
- The recursive AI auditing loop: one model writes simulation code, another model adversarially reviews it, the combination is more trustworthy than either alone. Not foolproof, but directionally right — the same principle as pair review in human code development
- Commit `22baa1b` as a demo: a bot that can rewrite itself in response to a Discord message, stream the rewrite as live events back to the same thread, and apply the change to its own running codebase is a different class of tool than a bot that can answer questions about code
