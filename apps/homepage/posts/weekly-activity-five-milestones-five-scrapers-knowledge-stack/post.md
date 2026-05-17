# Five Milestones, Five State Scrapers, and the Week the Knowledge Stack Got a Spine

*When your fact extractor gains cryptographic signing, your side project scrapes every reachable Australian parliament, and the whole thing starts to look less like a hobby and more like infrastructure.*

The hidden pattern across this period: I'm building a verifiable, provenance-tracked epistemic stack, and I keep adding layers without stopping to name the thing. donto landed M5 through M9 in two weeks — domain-dispatched extraction, five linguistic importers, a release builder, content-addressed blob storage, and Ed25519 cryptographic signing. toiletpaper added GPU compute tiers, adversarial review agents, and a full Claude Code session log viewer. dontopedia grew a debug dashboard, ECharts visualizations, and a Research Report page that surfaces contradictions as first-class data. omega kept the self-editing pipeline functional. And democracy — a brand new repo, initial commit dropped in this period — scraped Australian federal and state parliamentary rosters, deployed to GCE with Caddy, and started letting people write to their representatives. Taken together: raw web content → structured facts → signed releases → visual dashboards → public tools. Whether I planned it that way or not, that is a stack.

## Why You Should Care

- **democracy shipped to production**: scrapers for 6 Australian parliamentary jurisdictions (federal + five states), deployed on GCE with Caddy + Let's Encrypt auto-TLS; SA is a Sitecore SPA stub pending Playwright
- **donto completed M5 through M9**: domain-dispatched extraction, five linguistic importers (CLDF/UD/UniMorph/LIFT/EAF), a release builder with RO-Crate export, content-addressed blob substrate, and Ed25519/did:key signing — all landed in 92 commits
- **donto v1000 Trust Kernel**: 28 schema migrations, 212+ invariant tests, formal epistemics baked into the schema rather than application logic
- **toiletpaper added an adversarial code review agent and GPU compute tiers**: simulation scripts now get adversarially reviewed by a second LLM; ML-heavy simulations can schedule GPU-backed Cloud Run Jobs
- **dontopedia Research Report page**: family tree, quality radar, contradictions panel — structured epistemic summary for any entity in the graph
- **lordajax.com got a warm-paper theme redesign and a Dockerfile** so Cloud Run deployments actually work

---

## democracy: Scraping Australian Parliament Into a Database

**16 commits. Initial commit: +9,829 lines. Top files: `init.sh`, `docker-compose.prod.yml`.**

### Problem

Australia has a federal parliament and six state/territory parliaments. If you want to contact all your representatives simultaneously — federal MP, state MP, senators, upper and lower house members — you need their contact details in one machine-readable place. No such place exists. Parliamentary rosters are scattered across government websites with incompatible tech stacks, no unified API, and no bulk download option. The existing tools for writing to MPs only handle federal.

### Approach

The initial commit (`ba755a1`, +9,829/-0) dropped the full federal pipeline in one shot: scrapers, database schema, API, frontend, and email dispatch. That's not ideal commit discipline — but it's how this kind of thing starts. Get everything working, then organize.

State scrapers followed in two bursts. NSW, VIC, QLD, and ACT got scrapers in `2b3bf40` (+894/-2) by reading official parliamentary API endpoints and roster pages. WA, TAS, and NT followed in `39dd9ab` (+698/-9). All state scrapers needed browser User-Agent headers (`35c91d4`) because state parliament sites rate-limit or block requests that don't look like a browser.

Pre-scraped rosters were committed as JSON (`1d7e156`, +89/-6) so the init pipeline can populate the database without live network access. The import script is a single pnpm command added in `56ba86b`:

```bash
pnpm run import-rosters
```

Geographic boundary data comes from two sources: NSW via NSWEC electoral boundaries, all other states via ABS SED 2025 datasets (`b6125a2`, +438/-10). The boundary data maps a user's address to their electoral districts.

Production deployment: Caddy as reverse proxy with Let's Encrypt auto-TLS (`9c59060`, +51/-4). The initial config used `tls internal` (self-signed) because the domain was behind Cloudflare in "Full" SSL mode — Cloudflare's proxy terminates TLS but still wants to talk TLS to your origin. Internal TLS makes Cloudflare happy without needing a public cert (`3495afd`, +8/-3). The full production stack lives in `docker-compose.prod.yml` plus a GCE VM startup script (`7fad07f`, +160/-0).

Mail sending broke twice after initial deploy. `542e870` fixed a 500 on the `/send` endpoint — the captured-mail container was writing to a non-writable path in the production compose config. `ea81f9b` moved captured mail to `/tmp` (always writable) and dropped an unnecessary volume mount. These are the infrastructure bugs you only see in production because local dev has different mount points.

The UI was extended to include state upper-house reps and to group representatives by chamber (`cbf365e`, +63/-32). Default selection is federal only — most people writing "to their MP" mean their federal MP.

### Results

- 6 jurisdictions scraped and importable (measured: committed JSON rosters for each state in `data/rosters/`)
- Production deployment live on GCE with Caddy auto-TLS (artifact: VM startup script + `docker-compose.prod.yml`)
- UI groups representatives by chamber and defaults to federal-only selection

### Pitfalls / What Broke

South Australia is missing. The SA parliament uses a Sitecore SPA — it renders entirely in client-side JavaScript and doesn't expose scrapeable HTML. The code has a stub scraper with a comment noting it needs Playwright. This is the correct call: ship five working scrapers rather than blocking on one that needs a headless browser, but the SA gap means the project doesn't cover all Australians.

Mail sending required two post-deploy fix commits. The failure mode was a silent 500 — no useful error message from the container, just a failed HTTP request. The root cause was a volume write permission issue that only surfaces in the production compose config, not in dev. The fix is correct but the discovery process was slow.

### Next

- SA scraper with Playwright: headless browser session to handle the Sitecore SPA, committed roster JSON
- Roster update automation: state parliamentary rosters change after elections; a cron job to re-scrape and update committed JSON
- Address-to-electorate precision: ABS SED boundary polygon intersection can be slow; investigate spatial index options

---

## donto: Five Milestones, a Trust Kernel, and Content-Addressed Everything

**92 commits. 41 features, 28 fixes. Top files: `main.rs`, `Cargo.lock`, `ROADMAP-NEXT.md`, `Cargo.toml`.**

This was the largest single-repo sprint of the period. Five milestones landed. Each one is worth walking through separately.

### Problem

The extraction pipeline was monolithic and domain-agnostic — the same prompt for genealogy, science, and legal documents. The query language (DontoQL) was at v1 and missing key clause types from the PRD. There was no content-addressed storage for source documents, so extracted facts couldn't reference their exact source location. Linguistic data importers didn't exist. The release pipeline was manual. And nothing was cryptographically signed — outputs were attributable to the process in spirit but not in cryptographic practice.

### Approach: M5 — Domain-Dispatched Extraction and Policy Checks

`76ca770` — domain-dispatched extraction kernel: the extractor now classifies incoming content and routes to a domain-specific extraction prompt. Genealogy documents hit the genealogy extractor; scientific papers hit the paper extractor. The domain classifier runs before extraction proper.

`14da3c6` — multi-aperture exhaustive extraction replaces the 8-tier prompt (+898/-90): the previous approach had 8 progressively aggressive extraction tiers in a single prompt. The replacement runs multiple extractions on the same content, each with a different framing, then merges results. More extractions, fewer missed facts. The +898/-90 shape tells the story — 90 lines of old prompt replaced by nearly 900 lines of dispatch and merge logic.

`a025d14` — reviewer-acceptance analyzer (+446/-17): an M5 sub-component that scores extracted facts on plausibility, specificity, and evidence quality. The goal is filtering LLM hallucinations before they reach the database.

`ef1e7b2` — `--policy-check` flag for `donto extract`: extractions can now validate governance policy before writing. If the source is classified as restricted or the user lacks permission, the write is blocked at the CLI level, not after the fact.

### Approach: M6 — Five Linguistic Importers

M6 is the linguistic data ingestion layer. Five importers shipped across three commits, totalling 3,633 lines of importer code:

- **CLDF** (Cross-Linguistic Data Formats): `1e2bf79`, +995/-0. The standard for cross-linguistic comparison databases.
- **Universal Dependencies / CoNLL-U**: `48528e1`, +788/-0. Annotated syntax trees in the UD standard format.
- **UniMorph, LIFT, EAF**: `3e266bd`, +1850/-0. Three more in one commit — morphological features, dictionary exchange format, and ELAN time-aligned speech annotations.

The CLI surface (`d00d2a7`, +135/-0):

```bash
donto ling cldf <path>     # Import CLDF dataset
donto ling ud <path>       # Import CoNLL-U file
donto ling unimorph <path> # Import UniMorph dataset
donto ling lift <path>     # Import LIFT dictionary
donto ling eaf <path>      # Import ELAN annotation file
```

Each importer maps the source format's entity and relationship model to donto's fact types. The EAF importer is the most interesting — it handles time-aligned annotations, meaning spoken utterances with start/end timestamps become queryable facts with temporal coordinates.

### Approach: M7 — Release Builder and RO-Crate Export

`d896cfc` — release-builder skeleton (+896/-1): a release spec is a structured description of what a release should contain — which migrations, API changes, client updates. The builder takes the spec and produces a deployment manifest. Think `make release` but the makefile is data, not code.

`acda3a1` — RO-Crate export skeleton (+249/-1): RO-Crate is the Research Object packaging standard used by academic repositories and data archives. Exporting to RO-Crate makes donto outputs compatible with institutional data management systems without custom integration work.

`d8a6dc0` — M7 CLI subcommands (+148/-0):

```bash
donto release build    # Build a release manifest from a spec
donto release pipeline # Run the full release pipeline
```

`d1e12b7` — end-to-end release pipeline integration test (+169/-1): M7 gets an integration test against real data before being called done.

### Approach: M9 — Ed25519 Signing and DID Keys

`b4c227f` — release envelope with Ed25519/did:key signing (+662/-3): every donto release is now cryptographically signed. Ed25519 signatures on the release manifest, using `did:key` as the key identifier format. This means releases are attributable to a keypair, not just to "the process that produced them." 662 lines covering the key management, signing, and verification logic, plus 18 new linguistic frame types that M6 importers needed in the schema.

The Trust Kernel (v1000, `12ac734`) is what makes M9 meaningful — the governance schema tracks who signed what and when, with full audit trail.

### Approach: Blob Substrate and Evidence Links

`9c0489f` — content-addressed blob substrate (+1,235/-0): every document ingested into donto is stored by its content hash. Ingest the same document twice, get the same address. Foundation for deduplication and for evidence references.

`7b1eeef` — evidence links on every extracted statement (+140/-16): each fact now has an `evidence_link` pointing to the exact byte range in the source blob where the fact was found. Not "this came from document X" — "this came from sentence 3, paragraph 2 of document X at revision Y." This is the difference between hearsay and evidence as a data model.

### Approach: DontoQL v2

`2737828` — DontoQL v2, full PRD §11 clause surface: the query language gained the complete set of clauses specified in the PRD — POLICY ALLOWS, modality operators, extraction-level filters.

`e823683` — WITH evidence attaches evidence rows to query results (+368/-16): queries can now request their evidence inline. One query, facts plus sources.

`abddad6` — PRESET resolution in the evaluator: named, reusable query templates that resolve at evaluation time. The +496 lines touch the evaluator, storage layer, and CLI — small feature name, large footprint.

### Approach: Benchmarks

`69c67be` — H2/H3/H5/H7 benchmarks + ROADMAP-NEXT handoff (+409/-39): four hypothesis benchmarks committed as code. Each `H` corresponds to a research hypothesis in the donto roadmap. The benchmarks measure whether the system's extraction behavior matches predicted behavior.

`ef1e7b2` — H6/H8/H9 benchmarks (+468/-14): three more, completing the H-series through H9.

The benchmark methodology: define a hypothesis about system behavior, write a test exercising that behavior against a real dataset, record pass/fail. These aren't unit tests — they're empirical claims about epistemic properties. If H7 fails, the system isn't behaving as designed with respect to that hypothesis.

### Approach: v1000 Trust Kernel

`12ac734` — Trust Kernel foundation, 28 schema migrations (+11,667/-0): the formal epistemics layer. 28 migrations covering trust scores, governance events, provenance chains, citation depth, claim lifecycle state machines. All schema, no application logic — the constraint system is in the database.

`45fcb87` — 120 invariant tests covering every migration (+3,309/-0): tests before application code. Each migration gets invariant tests — properties that must hold regardless of what data you insert. 120 tests for 28 migrations is roughly 4 per migration, which is meaningful coverage, not smoke testing.

`441b9a6` — expand suite to 212 tests (92 new) (+2,868/-24): the adversarial review pass (`fb27552`) added 36 tests targeting edge cases — empty subjects, null confidence values, circular trust chains, concurrent governance events. The suite grew from 120 to 212 after someone tried to break it.

`31efb0a` — merge donto-v1000-foundation: 248 v1000 invariant tests: the merge commit. 248 tests, 23,201 lines net added.

### Results

- 5 milestones (M5-M9) landed (measured: ROADMAP-NEXT history, each marked as completed)
- 5 linguistic importers: 3,633 lines of importer code (measured: commit diffs for `1e2bf79`, `48528e1`, `3e266bd`)
- Ed25519 signing on release envelopes (artifact: `b4c227f`)
- Content-addressed blob substrate with byte-precise evidence links
- H2/H3/H5/H6/H7/H8/H9 benchmarks committed (7 benchmark commits)
- Trust Kernel: 28 migrations, 248 tests, merged to main

### Pitfalls / What Broke

`b72615f` — close F-1: NOT NULL + fail-closed DEFAULT on `donto_document.policy_id` (+132/-54): a schema bug from early migrations. `policy_id` was nullable, meaning documents could be inserted without a policy — fail-open by default. The fix adds NOT NULL and a fail-closed default. F-1 is the internal bug reference; the fact that it has a reference number suggests this was known and deferred.

`535f90a` — validate POLICY ALLOWS action up-front (+41/-25): DontoQL queries with policy checks weren't validating before running the query. Validation now happens at parse time. Fail fast, not after the expensive work.

`39a3bd5` — apply_migrations seed SHA + isolate bitemporal tests: bitemporal query tests have timing-sensitive failure modes that appear non-deterministically. The fix isolates them and marks them; doesn't fix the underlying timing sensitivity. Correct triage, but they're still there.

`3e963ec` — use separate connections per skill: a genuine asyncpg concurrency bug. Using one connection across concurrent coroutines fails when multiple parallel extraction jobs hit the same connection pool. Only appears in concurrent execution, not in sequential tests.

### Next

- M7 release builder to production: the skeleton is there, the integration tests pass; wire into the deploy pipeline
- M5 domain classifier: make dispatch explicit and testable rather than implicit in the extraction prompt
- Bitemporal test flake elimination: isolated but not fixed; the timing sensitivity is real debt

---

## omega: Self-Editing Bot Improvements and the Refactor That Ate 10,000 Lines

**12 commits. 4 features, 7 fixes. Top files: `opencode.ts`, `opencodeService.ts`, `package.json`.**

### Problem

omega is the Discord bot at the centre of the AI tooling stack. Two problems this period: (1) the OpenCode SDK integration was unreliable — sessions timed out, connections hung, output was inconsistent; (2) the codebase had accumulated significant duplication across the tool modules.

### Approach

`a2ebe7f` — switch opencode from SDK to CLI (+123/-153): the SDK went out, subprocess CLI invocation came in. Net negative — deleting more than adding — because the SDK interaction code was verbose and a subprocess call is a few lines. Reliability is qualitative: sessions that previously hung now complete.

`22baa1b` — live self-editing via OpenCode + Z.AI GLM integration (+432/-4): the main feature. omega takes a description of a change, invokes OpenCode on its own repo path, and applies the edit. The Z.AI GLM provides the LLM backend for code generation. 432 lines covering command handling, OpenCode invocation, repo path resolution, and Discord response formatting.

`6f2e68a` — make repo path configurable, export `getRepoPath` (+8/-3): the repo path was hardcoded inside the Docker container. `getRepoPath` is now an exported function reading from config. This matters as soon as you want to test locally or change the container mount point — which is immediately.

`21537dd` — stream OpenCode session events to Discord thread in real-time (+79/-15): every tool call, file read, and edit from an OpenCode session gets posted to a Discord thread as it happens. The thread name sanitization bug (`e376e13`) — special characters in session descriptions caused Discord API rejections with a vague "Invalid Form Body" error — got fixed alongside.

`ffdf976` — update deps, add tests, eliminate duplicate code (+5,022/-10,364): the largest commit by line count. Net -5,342 lines. The shape says significant deduplication — code living in multiple places got consolidated. This kind of cleanup is easy to defer and accumulates fast in an actively developed bot.

`d6d9e9b` — use npm instead of bun to install opencode in Dockerfile (+3/-7): bun doesn't reliably install opencode's npm package in the Docker build context. npm does. Three lines of Dockerfile fix after non-trivial debugging to isolate which package manager was the problem.

### Results

- Self-editing via Discord: confirmed working (commit `22baa1b` is the artifact; streaming confirmed via `21537dd`)
- OpenCode CLI switch: eliminated SDK timeout and hang behavior (qualitative before/after comparison)
- Net -5,342 lines after the refactor commit (measured: commit diff `ffdf976`)

### Pitfalls / What Broke

The Discord "Invalid Form Body" error is a bad failure mode — the API returns a vague error with no indication of which field is wrong. In this case, special characters in session descriptions (coming from user input or commit messages) violated Discord's thread name constraints silently until a sanitization step was added. Any user-controlled string going into a Discord API call is a sanitization boundary.

The self-edit feature has no sandboxing. When omega edits its own repo, it's editing production code, immediately, with no diff review and no automated test run before the edit lands. The threat model is "single user, know what you're doing" — which is correct for now, but not forever.

### Next

- Dry-run mode for self-edits: show the proposed diff in Discord before applying
- Staging branch for self-modifications: apply edits to a branch, require explicit confirmation before merge
- CI integration for the test-agent script (`d2805b2`): automated programmatic bot testing

---

## dontopedia: Research Reports, Debug Dashboards, and Live Firehose

**10 commits. 7 features, 3 fixes. Top files: `page.tsx`, `Nav.tsx`, `package.json`, `layout.tsx`.**

### Problem

dontopedia's debug tooling was a single page. The data available from donto — entity graphs, predicate distributions, real-time extraction events, structured entity summaries — needed more surface area. The firehose SSE endpoint in donto existed; nothing consumed it. The Research Report concept had no UI implementation.

### Approach

`d176bbf` — add debug dashboard Next.js app (+385/-0): a separate Next.js app within the dontopedia monorepo. Internal tooling, separate from the main wiki UI. Raw system state, not user-facing polish.

`0a24b58` — ECharts visualization dashboard — Pulse, Predicates, Entity Explorer (+616/-2): three panels in one commit. Pulse is a facts-per-minute time series. Predicates is a predicate usage bar chart — which relationships dominate the knowledge graph. Entity Explorer is a force-directed entity connection graph. All three using Apache ECharts.

`ec2fe96` — firehose page to debug dashboard (+305/-1): SSE subscriber page that shows every extraction event from donto in real-time. 305 lines covering the SSE hook, event display component, and connection status indicator.

`12b290f` — Research Report page with family tree, quality radar, contradictions, actions (+183/-0): four sub-panels in 183 lines:

- **Family tree**: ECharts tree layout of entity relationships
- **Quality radar**: how complete is this entity's data across predicate categories (spider chart)
- **Contradictions**: facts about this entity that contradict each other, surfaced by donto's paraconsistency layer
- **Actions**: available queries and extractions for this entity

The contradictions panel is the one that matters most conceptually. A wiki where contradictory facts are surfaced rather than resolved is a different thing from Wikipedia — it's honest about uncertainty rather than forcing consensus.

`e47ef8d` — add Tier column to facts table (+3/-0): extraction tiers from donto's multi-aperture extraction are now visible in the facts table. Which aperture produced this fact — useful for debugging extraction quality by tier, not just by job.

`5155b18` — pass status filter to API instead of client-side filtering (+4/-3): the job queue dashboard was fetching all jobs and filtering in the browser. Four lines to push the filter server-side. Makes a difference when job counts are high.

### Results

- 4 visualization panels operational: Pulse, Predicates, Entity Explorer, Research Report (measured: commit diffs)
- Firehose page: live SSE feed from `/firehose/stream`
- Research Report: family tree, quality radar, contradictions, actions (artifact: `12b290f`)
- Facts table: 1000-fact limit (`0c2ac5b`), tier column, server-side filtering

### Pitfalls / What Broke

The firehose connection took three commits to fully work: wrong endpoint path (`bf86b2f`), wrong connected status logic, null object display (`336738d`). SSE streams fail silently when the path is wrong — you get a connection that delivers nothing and a "connected" status indicator that lies. Worse failure mode than a hard error.

`481594e` — Dockerfiles for donto-api and extraction worker (+37/-0): these are in the dontopedia repo, not the donto repo. That's a placement question that'll cause confusion when the repos diverge; they probably belong in donto or in a dedicated infra repo.

### Next

- Research Report: test against an entity with deep genealogical data in donto; the family tree visualization needs real graph depth to validate
- Firehose → Discord integration: high-confidence extraction events should trigger notifications
- Entity Explorer: click-through to entity detail pages

---

## toiletpaper: Adversarial Review, GPU Tiers, and the Session Log That Shows Its Work

**50 commits. 21 features, 12 fixes. Top files: `simulate-paper.ts`, `page.tsx`, `ingest-results.ts`, `drawer.tsx`, `claim-drawer.tsx`.**

### Problem

The simulation pipeline had three compounding problems. First: no one was auditing whether Claude Code's simulation scripts were actually testing what they claimed to test — the simulator writes simulation code using an LLM; that LLM can generate code that trivially passes without actually verifying the claim. Second: GPU-heavy simulations (neural networks, physics integrators) were running on CPU-only instances and timing out. Third: claim matching after simulation was fuzzy-text-based, so two claims with similar wording would mismatch.

### Approach: Blueprint Layer and Adversarial Review

`b371b99` — replication blueprint layer for simulation planning (+359/-3): blueprints are structured simulation plans. Before Claude Code writes any code, the blueprint layer produces a spec: what will be tested, what methods will be used, what success criteria apply. Blueprint → simulation code → adversarial review is the full pipeline.

`ff255b8` — adversarial code review agent for simulation quality assurance (+396/-0): an AI agent whose job is to critique simulation code written by other AI agents. The review pipeline asks adversarial questions: does this actually test the claim? is the test setup correct? would a different implementation give a different verdict? 396 lines.

`bdcd196` — shared library governance: MANIFEST.json + state tracking (+381/-3): simulation scripts share library code. Without governance, the shared library diverges silently — each simulation assumes its own version of a shared function. MANIFEST.json tracks canonical state.

`1ede116` — shared simulation library + reuse instructions to Claude Code pipeline: Claude Code's prompt now explicitly instructs it to use the shared library rather than reimplementing common functionality. The reuse instructions name which functions exist and when to use them.

`239c5e8` — calibration suite with synthetic test cases (+837/-0): 837 lines of synthetic test cases with known outcomes. If extraction accuracy on synthetic cases degrades, something changed. Currently run manually; calibration in CI is the next step.

### Approach: GPU Compute Tiers

`45eb716` — GPU compute tier awareness and Cloud Run Job runner (+401/-7): simulation specs can declare a compute tier. CPU simulations run as before; GPU-heavy simulations get scheduled as Cloud Run Jobs against GPU-backed instances. 401 lines covering tier detection, job scheduling, and the runner.

Cloud Run Jobs (distinct from Cloud Run Services) are batch compute — they run, they finish, they exit. Appropriate for simulations that have a defined completion state.

### Approach: Deterministic Claim Matching

`d595122` — pass DB claim UUIDs through simulation spec to results.json (+27/-5): UUID-based matching replaces fuzzy text matching as the primary path. The claim's database UUID flows through: extraction → blueprint → simulation spec → results.json → ingest. Match by UUID, fall back to Levenshtein (`7ff1f38`) for older runs without UUIDs. 27 lines of plumbing that eliminates a class of mismatches.

`c054e4c` — split `not_simulable` into specific reasons (+73/-3): `not_simulable` was a catch-all verdict. Splitting into specific categories (methodological, vague claim, compile failure, etc.) makes the verdict distribution meaningful rather than a black hole.

### Approach: Session Log Viewer

`11f9c24` — Session Log viewer: full Claude Code session replay on paper page (+1,036/-3): Claude Code produces a JSONL event log during simulation. 1,036 lines of log parsing and UI code to replay that log chronologically. Every tool call, file read, code block, and assertion — viewable after the fact, from GCS.

The session log is the provenance record for verdicts. If you can't see how a verdict was produced, it's less trustworthy. The viewer closes that gap.

### Approach: Provider Iteration

The provider situation this period:

`302bfa4` — all LLM calls → Grok 4.1 Fast via OpenRouter: Grok takes over inference.

`7032ec5` — extraction → GPT-5.5 via OpenRouter (~$0.35/paper): GPT-5.5 for extraction specifically, Grok for everything else. The per-paper cost ($0.35) is measured from the OpenRouter cost dashboard after running one paper through the extraction step.

`b042a47` — codegen → Grok 4 via OpenRouter (drops Claude OAuth complexity): Claude OAuth is complex enough that Grok 4 via OpenRouter is worth the capability trade-off for the codegen path.

`3ea6a86` — blueprint generator → OpenRouter not direct xAI API (+8/-10): the blueprint generator was calling xAI directly. OpenRouter handles key management and provider failover — use the gateway.

Three provider switches in two weeks is still too many. The settling point appears to be: Grok 4 for inference and codegen, GPT-5.5 for extraction, OpenRouter as universal gateway.

### Approach: Full Endpoint and Design

`7713321` — comprehensive `/api/papers/[id]/full` endpoint (+309/-0): one call returns everything about a paper — claims, verdicts, simulation results, donto facts, source text, blueprints. The frontend was assembling this from multiple API calls.

`d05ee03` — expand `/full` endpoint: per-claim donto statements, obligations, arguments (+56/-16): donto's richer data model (not just facts, but obligations and arguments) flows through to the frontend.

`58f90dc` — GCS artifact storage for simulation files (+127/-3): simulation artifacts (specs, results, session logs) now live in GCS rather than on the instance. Survives restarts, accessible from multiple services.

### Results

- Adversarial code review agent: operational, critiques simulation code written by other AI agents
- GPU tier awareness: GPU-backed Cloud Run Jobs for ML-heavy simulations
- UUID-based deterministic claim matching eliminates text-match mismatches
- Session log viewer: 1,036 lines, full Claude Code replay from JSONL in GCS
- Calibration suite: 837 lines of synthetic test cases
- `/api/papers/[id]/full` endpoint: single call for complete paper data including donto statements
- $0.35/paper extraction cost at GPT-5.5 pricing (measured: OpenRouter dashboard, one paper)

### Pitfalls / What Broke

`24993f6` — fix ReferenceError: track `claudeTimedOut` flag outside catch scope: a JavaScript scoping bug. `claudeTimedOut` was declared inside a `try` block and referenced in a subsequent `catch`. TypeScript strict mode would have caught this. It didn't because the file wasn't strictly typed.

`8941307` — fix Drawer: use inline styles for fixed positioning (Tailwind v4 `inset-0` broken): Tailwind v4's `inset-0` utility isn't generating the expected CSS in this build context. Inline styles as a fallback — not ideal, but Tailwind v4 is new enough that build-context edge cases appear regularly.

`4431a23` — fix build: remove JSX comments + fix `blueprintData` unknown type: JSX comments in a non-JSX file caused a Docker build failure. TypeScript's `unknown` type on `blueprintData` required an explicit cast. Both are the kind of thing that passes local lint and fails CI.

The adversarial reviewer has no benchmark yet. "Adversarial reviewer" is currently a label — we don't have a test set of known-bad simulations to measure how many the reviewer correctly flags. Without that, the adversarial review is a good idea in search of a measurement.

### Next

- Benchmark the adversarial reviewer: build a test set of known-bad simulations, measure catch rate
- Automate the calibration suite: run synthetic test cases in CI, fail the build on regression
- GPU tier cost benchmarking: measure execution time and cost for GPU vs. CPU Cloud Run Jobs on the same simulation type

---

## lordajax.com: Warm Paper, Serif Prose, and a Docker Deploy That Works

**5 commits. Theme redesign + deployment infrastructure.**

### Problem

The theme was stale. The site had no container-based deployment path, which meant Cloud Run deploys were manual and undocumented. The projects page was a curated subset rather than the full body of work.

### Approach

`ab3e0e3` — switch theme to jsonblog-generator-mono (+2,569/-282): a full template swap, not incremental edits. The mono theme landed first as the foundation.

`5e9ccf2` — redesign as warm-paper + serif prose + mono UI, v0.2.0 (+373/-242): warm paper background, serif body text, monospace UI chrome. The `v0.2.0` tag in the commit message suggests a deliberate design version, not just a style tweak. 373 lines added, 242 deleted — the new design is larger than what it replaced.

`7e5ccbf` — Dockerfile for Cloud Run / Apex deployments (+49/-0): 49 lines packaging the static site for container-based serving. The site can now be deployed to Cloud Run without manual build steps or SSH into a server.

`cba0d3a` — nginx: disable browser cache so theme/HTML deploys reflect immediately (+4/-0): nginx was caching responses long enough that theme changes weren't visible without a hard refresh. Four lines: `Cache-Control: no-store` for static assets. Should have been there from the start.

`ecf48fc` — rewrite projects page with full body of work (+168/-49): democracy, donto, dontopedia, toiletpaper, omega — the projects page now reflects what's actually being built.

### Results

- Theme redesigned to warm-paper + serif prose (v0.2.0)
- Dockerfile committed: Cloud Run deployment is now repeatable
- nginx cache headers fixed: theme changes visible immediately after deploy
- Projects page updated with current body of work

### Pitfalls / What Broke

The theme switch (`ab3e0e3`, +2,569/-282) is immediately superseded by the redesign (`5e9ccf2`, +373/-242). There's a large commit in history that exists mainly as a stepping stone. Not a bug, but it's noise in `git log`.

The nginx cache issue is a good reminder that browser cache headers belong in the initial nginx config, not as a fix after the first theme deploy confuses you. The failure mode is "deploy worked, looks unchanged, spend time debugging CI" — a two-minute config change that costs thirty minutes of confusion.

### Next

- Automated static build: `json-blog` generation in CI, not manual
- Cloud Run deploy step using the new Dockerfile

---

## What's Next

- **democracy SA scraper with Playwright**: the only missing Australian jurisdiction; needs a headless browser to handle the Sitecore SPA; roster JSON to be committed once scraped
- **donto M7 release builder to production**: integration tests pass against the ajax-davis dataset; the gap is wiring the builder into the actual deploy pipeline
- **toiletpaper adversarial reviewer benchmark**: build a known-bad simulation test set and measure catch rate before treating the reviewer as a quality gate
- **dontopedia firehose → Discord notifications**: high-confidence extraction events should surface to a Discord channel; closes the loop from extraction to human awareness
- **calibration suites in CI**: synthetic test cases for both donto M5 extraction and toiletpaper claim extraction, failing the build on regression rather than running manually
- **donto bitemporal test flake elimination**: isolated but not fixed; the timing sensitivity in bitemporal queries is real debt accruing interest every CI run
- **GPU tier cost benchmarking in toiletpaper**: measure actual execution time and cost comparison for the same simulation type on GPU vs. CPU Cloud Run

---

## Links & Resources

### Projects

- [democracy](https://github.com/australia/democracy) — Write to your Australian federal and state MPs/Senators in a single message; GCE + Caddy + Let's Encrypt production deployment
- [donto](https://github.com/thomasdavis/donto) — Paraconsistent knowledge base: M5-M9 milestones, Trust Kernel v1000, DontoQL v2, Ed25519 signing, content-addressed blob substrate, five linguistic importers
- [dontopedia](https://github.com/thomasdavis/dontopedia) — Open paraconsistent wiki: ECharts dashboards, Research Report page, live firehose SSE feed, debug dashboard
- [toiletpaper](https://github.com/thomasdavis/toiletpaper) — Adversarial scientific paper simulator: GPU compute tiers, blueprint layer, session log viewer, adversarial review agents
- [omega](https://github.com/thomasdavis/omega) — Self-editing Discord bot: OpenCode CLI integration, live session streaming, Z.AI GLM code generation
- [lordajax.com](https://github.com/thomasdavis/lordajax.com) — This site; warm-paper theme v0.2.0, Cloud Run Dockerfile

### Tools & Services

- [Caddy](https://caddyserver.com/) — Reverse proxy with Let's Encrypt auto-TLS; used in democracy's GCE deployment; `tls internal` mode for Cloudflare Full SSL compatibility
- [Apache ECharts](https://echarts.apache.org/) — Visualization library powering dontopedia's Pulse, Predicates, Entity Explorer, and Research Report panels
- [OpenCode](https://opencode.ai/) — AI code editing invoked as a subprocess CLI in omega; SDK reliability issues led to the switch
- [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs) — Batch compute for GPU-heavy simulations in toiletpaper; distinct from Cloud Run Services — these run, finish, and exit
- [OpenRouter](https://openrouter.ai/) — Multi-provider LLM gateway: Grok 4 for inference, GPT-5.5 for extraction at ~$0.35/paper; handles key management and provider failover
- [Temporal](https://temporal.io/) — Workflow orchestration for donto's batch extraction; durable, queryable, deduplicated by context IRI
- [ABS SED 2025](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3) — Australian Bureau of Statistics Statistical Electorate Division dataset; geographic boundary data for democracy's electorate mapping
- [RO-Crate](https://www.researchobject.org/ro-crate/) — Research Object packaging standard; donto M7 exports to RO-Crate for academic repository compatibility
- [did:key](https://w3c-ccg.github.io/did-method-key/) — Decentralized identifier method used for Ed25519 key references in donto M9 release envelopes
- [Z.AI GLM](https://z.ai/) — LLM backend for omega's self-editing code generation via OpenCode

### Inspiration

- Provenance as data structure: every extracted fact this period got an `evidence_link` pointing to the exact byte range in the source document at a specific revision. The gap between "this came from a source" and "here is the exact text I derived this from, verifiable by content hash" is the gap between citation and evidence. Building the latter is harder and more honest.
- The adversarial review loop: one model writes simulation code, a second model adversarially reviews it. Neither is sufficient alone — the writer optimizes for passing, the reviewer optimizes for finding failure modes. Closer to correct than either alone. Not foolproof; the reviewer's quality is still unmeasured, which is the next thing to fix.
- Parliamentary data as infrastructure gap: no machine-readable unified Australian parliamentary roster exists. Building democracy was driven by a practical need (contact your representatives in one message) but the underlying problem — that civic data requires reverse-engineering government websites to access — is a governance issue, not a technical one. The scrapers work; the question is why they were necessary.
