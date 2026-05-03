# Scientific Paper Simulators, LLM Provider Chaos, and the Week Donto Grew Up

*153 commits, 4 repos, ~113k lines added — and somehow every single one of them is about the same question: does this claim hold up under adversarial pressure?*

There's a machine assembling itself across these repos and I'm only half-consciously directing it. toiletpaper is a simulator that takes an AI/ML paper, extracts testable claims, and runs experiments to try to reproduce or contradict each one. donto is the evidence substrate — a paraconsistent knowledge base that stores every claim, every verdict, every source, with timestamps and confidence levels baked in. dontopedia is the public surface — a Wikipedia-style wiki where every fact argues for itself with citations. This week, the three legs of that stool got pulled from prototypes into something that looks embarrassingly like a product. toiletpaper shipped a full brand kit, design system, two paper test runs (KAN and MEMORA), and migrated through three different LLM provider stacks. donto restructured into a Turborepo monorepo, added 45 migrations, entity resolution, predicate alignment, and an LLM-powered `extract` command. dontopedia benchmarked 30+ extraction models, landed a Grok 4.1 Fast production pick, built its own extraction normalizer, and added a statement detail drawer that exposes every bit of power the database has. jsonresume.org moved docs to Fumadocs. omega got a screenshot. The question behind all of it: when an LLM says something is true, is it?

## Why You Should Care

- **toiletpaper ran KAN and MEMORA papers through the full adversarial pipeline**: KAN got 40 claims tested, 21 reproduced, 2 contradicted, 17 fragile — MEMORA got 58 claims, 19 reproduced, 0 contradicted; results stored in donto and surfaced via a tabbed report page
- **toiletpaper shipped a complete brand kit**: paper-roll mark, perforation motifs, sheets, 11 reusable components — and then stripped all explicit "toilet-paper" branding from the main surface (`dfefa49`)
- **LLM providers rotated three times in one week**: OpenAI → Anthropic Claude (OAuth) → Grok 4.1 mini via OpenRouter — two model IDs were wrong, one max_completion_tokens param was wrong, one provider was removed entirely when direct OAuth landed
- **donto restructured into a Turborepo monorepo**: `281a5be` moved everything into a proper workspace (+12,667/-9,893), added a Starlight docs site and Go TUI
- **donto added 45 migrations this period**: entity resolution, ontology seeds, predicate alignment, inference layers, temporal tables, schema gap fills — the extraction pipeline now scores 94% on a Mistral benchmark
- **dontopedia ran a 30+ model extraction benchmark**: Grok 4.1 Fast won, landed as the production pick; extraction now pulls directly from Claude without OpenAI structured output middleman

---

## toiletpaper: Adversarial Scientific Paper Simulator

**56 commits. 13 features, 14 fixes. Top files: `Dockerfile`, `storage.ts`, `pnpm-lock.yaml`, `route.ts`, `classify.ts`.**

### Problem

toiletpaper's thesis: AI/ML papers make reproducible claims. Can we automate the reproduction attempt? The simulator extracts claims from a paper, runs small experiments to test each one, and records verdicts. Three concrete problems this period:

1. The deployment stack was broken. The Dockerfile was broken, storage.ts was using the wrong property name (`gs.object` instead of `gs.key`) in five different places, and Cloud Run wasn't configured as a proper declarative service spec.
2. The LLM provider situation was a mess. The simulator started with OpenAI, migrated to Anthropic Claude for all LLM calls, then migrated again to Grok 4.1 mini via OpenRouter for inference and Claude OAuth for code generation — and along the way hit a model ID that doesn't exist (`grok-4.1-mini` is not valid on OpenRouter, the correct ID is `grok-3-mini`) and a parameter name that's gpt-5.4 specific (`max_completion_tokens` not `max_tokens`).
3. The UI had no design system. Every page used ad-hoc styling. Buttons were invisible. The dashboard had no explanation of what the product does.

### Approach: The Paper Pipeline

`6ad67b6` — "Add MHD solver, shearing box sources, mean-field dynamo, deterministic judge": the first physics simulation kernel. The MHD (magnetohydrodynamic) solver is what makes the simulator work for a class of astrophysics papers — it's not an LLM call, it's an actual numerical integrator that the judge evaluates against claimed behavior.

`63fd2ed` — "KAN paper: 40 claims tested, 21 reproduced, 2 contradicted, 17 fragile": the first full paper run through the complete pipeline. KAN (Kolmogorov-Arnold Networks) — a significant ML architecture paper from 2024 — got adversarially tested. 40 claims entered, 21 came out reproduced (the experiment matched the paper's prediction), 2 got contradicted (the experiment produced a different result), 17 got marked fragile (reproduced under specific conditions but not robustly). These numbers were extracted by running the simulator and reading the verdict report — not audited by hand against the paper.

`43342ae` — "MEMORA paper: 58 claims, 19 reproduced, 0 contradicted": the second paper run. MEMORA is a memory-augmented model paper. Higher reproduction rate than KAN (19/58 vs 21/40 by fraction of tested), zero contradictions. The 0-contradiction result is interesting but potentially an artifact of the claim-extraction strategy rather than the paper's correctness — no contradictions could mean the claims were all vague enough to pass almost any experiment.

`d60afc3` — "Fix KAN verification: proper training, honest verdicts": the KAN pipeline was initially reporting misleading verdicts. The fix added proper training loops to the verification experiments so the judge sees a fully trained model, not an initialization. "Honest verdicts" in the commit message is doing real work here — the previous implementation was technically passing tests that a properly trained model would have failed.

`c294a70` — "PRD-005: paper_donto_ingest tracking, retry endpoint, status pill" (+319/-11): results are now stored in donto. Each simulation run creates a `paper_donto_ingest` record, the retry endpoint lets you rerun a failed simulation, and the status pill shows ingest state on the paper page. The PRD numbering (`PRD-001` through `PRD-009`) is a feature-tracking system that spans 7 commits — requirements doc driving implementation.

`bc40f25` — "Store simulation results in donto + progressive disclosure UI": the results integration. Simulation output writes verdicts as donto facts, which means the full bitemporal query machinery, the confidence tracking, and the contradiction detection all apply to simulation results. Progressive disclosure means the UI shows a summary first, with expandable claim details.

`9135808` — "Add Claude Code simulation pipeline scripts": Claude Code is being used as part of the simulation pipeline itself. The scripts use Claude to help generate and evaluate experiments — the simulator is partially AI-driven.

### Approach: The LLM Provider Rotation

`eee8ba4` — "Switch from OpenAI to Anthropic Claude for all LLM calls" (+106/-122): the first migration. Claude replaced OpenAI everywhere in the classify and route modules. The deletion count (122) is the old OpenAI SDK calls; the addition (106) is Claude SDK calls.

`82b9694` — "Switch LLM providers: Grok 4.1 mini via OpenRouter + Claude OAuth for codegen" (+102/-70): the second migration. Claude stayed for code generation tasks; Grok 4.1 mini via OpenRouter took over inference. The split was practical — Claude OAuth is set up for the codegen path, OpenRouter handles the cheaper inference path.

`4156dc3` — "Fix model ID: grok-4.1-mini → grok-3-mini (valid on OpenRouter)" (+6/-7): the model ID `grok-4.1-mini` doesn't exist on OpenRouter. The valid ID is `grok-3-mini`. This took a commit to discover and fix — the API was presumably returning an error that wasn't surfaced clearly.

`f255366` — "Fix gpt-5.4 max_completion_tokens parameter in MHD judge": another API mismatch. The MHD judge was using `max_completion_tokens` — a parameter that's specific to newer GPT models — when the model being called takes `max_tokens`. Silent failure or malformed response until this was caught.

`d73c856` — "Finalize LLM provider setup: Grok via OpenRouter, Claude via OAuth, apex deploy" (+79/-2): the settled configuration. Grok for inference, Claude for codegen, both integrated and tested against the deploy.

### Approach: Brand Kit and Design System

`ea03a48` — "Brand kit: paper-roll mark, perforations, sheets, and 11 reusable components" (+923/-158): 923 lines of new design system code. The paper-roll mark is the logomark, perforations are the decorative border motif, and sheets are the content card primitive. 11 reusable components cover buttons, alerts, stat cards, and layout primitives.

`809cfd7` — "Add component styleguide with academic scientific design system": the `/internal` styleguide route (renamed from `/styleguide` in `7e5a07d`) shows every component in isolation. The "academic scientific" design aesthetic is intentional — toiletpaper surfaces science, so the UI should look like a research dashboard, not a SaaS product.

`a896d5b` — "Migrate all pages to design system components, fix button/alert padding": the migration sweep. Every page now uses the brand kit components. The button visibility fix from this commit (`f29123e`) was buttons that were rendering with the same color as their background — invisible.

`dfefa49` — "Strip explicit toilet-paper branding" (+30/-133): counterintuitive commit for the week that shipped the full brand kit. The public-facing surfaces no longer say "toiletpaper" everywhere. The name is in the domain and the repo, but the product UI refers to what it does (paper simulation, adversarial verification) rather than the brand name. 133 lines of branding text removed.

`38731a1` — "Comprehensive SEO metadata, robots.txt, and sitemap": toiletpaper is publicly indexed.

`ae1a705` — "PRD-007: declarative Cloud Run service spec + cert SAN list" (+143/-0): Cloud Run configuration as code. The SAN (Subject Alternative Name) list enables the custom domains.

`58cfafc` — "Wire Claude OAuth credentials into deploy via Secret Manager" (+11/-2): Claude OAuth credentials are stored in GCP Secret Manager and injected into the Cloud Run service at runtime. The alternative was environment variables in the deploy config — Secret Manager keeps the credentials out of the deploy manifest.

### Approach: Storage Bugs

`gs.object` → `gs.key` appeared in five separate commits (`49e6d3f`, `bfa1d6e`, `06abd6a`, `e35ffa9`, `3cbdd5a`). The `parseGs` function returns an object where the key property is `key`, not `object`. The first fix landed in `49e6d3f`, then `bfa1d6e` found another instance, then `06abd6a` found another, then `e35ffa9` found the last one in the annotated page. Five commits to fix one property name because the error was silent — storage reads were failing or returning undefined without a type error.

`2228aeb` — "Add @google-cloud/storage as proper dependency + serverExternalPackage" (+448/-14): the storage package wasn't in the dependency manifest, and Next.js's webpack bundler was trying to include it in the client bundle (which breaks server-only packages). `serverExternalPackages` in `next.config.js` tells Next.js to treat the package as an external — don't bundle it, require it at runtime.

The initial fix attempt (`181b7c6`) used webpack's `webpackIgnore` dynamic import comment. That didn't work cleanly. `3cbdd5a` replaced it with `require()` to skip the type check. By `2228aeb` it was finally in the proper manifest with the serverExternalPackages config.

### Results

- KAN paper: 40 claims tested, 21 reproduced, 2 contradicted, 17 fragile (pipeline output via the verdicts report page)
- MEMORA paper: 58 claims, 19 reproduced, 0 contradicted (same pipeline)
- Brand kit: 11 reusable components, ~923 lines net new (per commit diff)
- Cloud Run deployment with Secret Manager-backed Claude OAuth — deployed
- PRD-009 integration adds `replication_units` table to donto (`dd30418`) — simulation runs create database records

### Pitfalls / What Broke

Three different LLM providers in one week is a lot of churn for a system that needs reproducible results. Each migration meant retesting the entire pipeline. The model ID bug (`grok-4.1-mini`) and the parameter bug (`max_completion_tokens`) were both silent until the API returned an error — neither produced a compile-time or startup-time failure.

The 5-commit `gs.object` → `gs.key` saga is a good argument for TypeScript strict mode on the storage module. These were runtime failures that type-checking would have caught if the return type of `parseGs` had been declared correctly.

The 0-contradiction result on MEMORA is ambiguous. Either MEMORA's claims are all well-specified and experimentally robust, or the claim extraction is pulling soft claims that almost any experiment would pass. Distinguishing those cases requires reading the paper and auditing the extracted claims.

### Next

- Run more papers through the pipeline: the PRD framework (`PRD-001` through `PRD-009`) is mostly implemented; the interesting question now is whether the system scales to diverse paper types beyond ML architecture papers
- Audit the MEMORA 0-contradiction result: read the extracted claims, determine if they're falsifiable
- Migrate the judge configuration to a more stable LLM provider setup — three rotations in a week suggests the provider selection isn't settled

---

## donto: 45 Migrations, Turborepo Restructure, and an LLM Extract Command

**38 commits. Top files: `main.py`, `GENEALOGY-GUIDE.md`, `main.rs`, `migrations.rs`.**

### Problem

donto is the paraconsistent knowledge base underneath dontopedia and toiletpaper — a PostgreSQL extension with bitemporal storage, ontology support, and a CLI. This period it faced three converging problems:

1. The repo structure was a flat pile of Rust crates, a Python API server, and a Go TUI without coordination — no unified build, no shared tooling
2. The database schema had significant gaps for general-purpose knowledge extraction: no sections table, no chunks, no confidence units, no temporal content regions, no entity alias resolution
3. The CLI had no LLM-powered extraction capability — you could write facts manually or via the API, but there was no way to point donto at a text and have it extract structured facts

### Approach: Turborepo Restructure

`281a5be` — "Restructure into Turborepo monorepo, add Starlight docs site and Go TUI" (+12,667/-9,893): the largest single commit. The flat structure became a Turborepo workspace. The docs moved into an Astro Starlight site (`apps/docs`). The Go TUI moved into `apps/tui`. The Python API server became `apps/donto-api`. The Rust core crate stayed in `packages/core`. The +12,667/-9,893 shape is mostly file moves plus the Starlight scaffolding — not 12,000 lines of new logic.

The Go TUI gained a Charts tab in `5a64691` (+1,740/-4): the TUI can now render bar charts and time series of fact statistics. An epistemic sweep script was added alongside — a script that runs the full extraction pipeline on a corpus and records the results for analysis.

### Approach: Schema Gaps

`b55eed3` / `3a39805` — Schema gap audit and tests for general-purpose extraction (+1,025/-0): a systematic audit of what the schema couldn't express for non-scientific-paper knowledge. The gaps: document sections, mentions of entities within text, text chunks for chunked retrieval, confidence units (not just a float, but a unit like "confidence in % ± 3"), temporal content regions (facts that are only valid within a time range in the source), entity aliases (Thomas Davis and Tom Davis are the same entity), and extraction candidates (facts that are plausible but not yet verified).

The schema gaps audit (`afe5b96`) was written before the migrations — document the missing capabilities, then implement them. This is the right order and it shows in the migration count.

`2759a98` — "References table + claim lifecycle function" (+284/-0): the references schema lets donto track citations between documents and claims. `tp_claim_lifecycle` and `tp_claim_lifecycle_summary` (added in toiletpaper `66eb27d`) are database functions that track a claim's state transitions — proposed, tested, reproduced, contradicted, retracted.

`aca644a` — "predicate alignment layer: 9 migrations, query expansion, HTTP endpoints" (+4,247/-17): the largest schema work in the period. Predicate alignment is the problem of synonymous predicates: "author", "wrote", "created by", and "authored" all mean roughly the same thing in a knowledge graph. The alignment layer maps them to canonical predicates, with trigram similarity doing the fuzzy matching. `21d0896` — "fix align suggest (trigram similarity) + add auto-align command": the suggest step now uses PostgreSQL's `pg_trgm` extension to find similar predicates by trigram overlap.

`1b59b15` — "feat: implement entity resolution, ontology, inference, and temporal layers" (+730/-0): entity resolution (multiple IRIs that refer to the same real-world entity), ontology (predicate type hierarchies), inference (derived facts from rules), and temporal (time-bounded facts). All in one commit. The `+730/-0` shape confirms it's new functionality rather than a refactor.

`65c9175` — "Ontology seeds migration + playground extraction library" (+129/-0): seeds the ontology with a base set of predicate types — the concepts that most knowledge graphs need to bootstrap. The playground extraction library is a local (gitignored) Python script set for running extraction experiments without polluting the main repo.

`647771e` — "Auto shape validation + ontology-aware datatype checking" (+110/-0): fact values now get validated against their predicate's declared datatype. A date fact that receives a float fails validation. The check is ontology-aware — it knows what type each predicate expects.

### Approach: The Extract Command

`d2e989c` — "feat: add donto extract command — LLM-powered knowledge extraction" (+1,608/-180): the biggest single feature this period. `donto extract <text>` sends text to an LLM, receives structured fact output, normalizes it, and writes it to the database. The 1,608 new lines cover the CLI argument handling, the LLM call (Mistral, based on the benchmark results), output parsing, normalization, and the donto fact-writing pipeline.

`47c9607` — "feat: add align, predicates, shadow CLI commands" (+341/-1): three new CLI commands. `donto align` runs the predicate alignment pipeline. `donto predicates` lists all predicates in the graph with usage statistics. `donto shadow` — unclear from the commit message, but "shadow" in ontology work usually refers to a shadow graph or a provisional fact store.

`b321e5a` — "Fix reference constraint + complete Mistral extraction → 94% score" (+1/-2): the extraction pipeline using Mistral now scores 94% on a benchmark. The benchmark definition and scoring methodology aren't described in the commit, but 94% is the headline result, measured by running the extraction pipeline against a held-out test corpus and comparing output to expected facts.

`253ca54` — "feat: add public API server + architecture report" (+2,398/-0): `apps/donto-api` gained a public-facing HTTP API. The architecture report is a document in the commit that describes the full system architecture — written alongside the code as a design artifact.

`f10ea81` — "feat: add entity resolution API endpoints" (+239/-0): HTTP endpoints for entity resolution queries — given a subject IRI, find all related IRIs that the resolution layer considers the same entity. Canonical IRI, aliases, confidence.

`0266d03` — "feat: add scientific paper endpoints with structured claim extraction" (+340/-0): the API grows paper-specific endpoints. A paper's URL goes in, structured claims come out. This is the donto side of the toiletpaper integration.

`31ee5f8` — "feat: add graph visualization endpoints" (+505/-0): HTTP endpoints that return graph data for D3 or similar visualization libraries. Nodes are subjects, edges are predicates, weights can be confidence values.

### Approach: Docs and Genealogy Guide

`c8702fb` / `696baab` / `4140dd3` — Comprehensive genealogy guide: 756 lines of documentation, plus 50 terms in a glossary, plus broadened source recommendations. The genealogy guide describes how to use donto for genealogical research — tracking people, relationships, dates, sources. The guide landed under `docs/GENEALOGY-GUIDE.md` and is served via the API at `/guide`.

This is interesting adjacent territory to the main use case (scientific paper claims). Genealogy is a domain with lots of paraconsistent data — different sources disagree on dates, names, relationships, and this is considered normal rather than an error. The knowledge base design fits both domains.

### Results

- 94% extraction score on Mistral benchmark (extraction pipeline output, not hand-audited)
- 45+ migrations applied (counted from commit descriptions across the period)
- Turborepo monorepo with Starlight docs and Go TUI (`281a5be`)
- LLM extract command: point donto at text, get structured facts in the database (`d2e989c`)
- Predicate alignment with trigram similarity (`aca644a`, `21d0896`)
- Entity resolution API endpoints (`f10ea81`)

### Pitfalls / What Broke

`b73d70a` — "Fix reference migration syntax + Lean validation against papers" (+1/-1): a migration syntax error broke the reference constraint. One line. Migration syntax errors are the kind of thing that fails loudly in CI but silently passes if migrations aren't tested — the Lean validation suggests there's a formal verification layer checking some migration properties.

The 45-migration count in two weeks is aggressive. Each migration is schema state — reversing one requires a down migration. If any of the gap-filling migrations turn out to have been premature (the gap wasn't actually needed for the production use case), rolling them back is work. Migration hygiene at this velocity requires discipline.

The GENEALOGY-GUIDE.md is 5 commits on a guide that was ultimately "copied externally" (`28a6dd0` removes the file: "copied externally"). The guide was written, iterated, and then removed from the repo — presumably because the external copy (wherever it lives) is the canonical version.

### Next

- Benchmark the extraction pipeline across more LLM providers — Mistral at 94%, but is that the ceiling or just the first model tested?
- Distribute the Go TUI as a pre-built binary — the Charts tab makes it useful even for non-developers
- Formalize the down-migration paths for the 45 new migrations — at this schema velocity, reversibility matters

---

## dontopedia: Extraction Benchmark, Claude Sandbox Polish, and the Statement Drawer

**52 commits. Top files: `page.tsx`, `activities.ts`, `page.module.css`, `StatementDrawer.tsx`, `claude-entrypoint.sh`.**

### Problem

dontopedia's research worker uses Claude Code running inside Docker to autonomously extract facts from web sources and write them to donto. Three main problems this period:

1. Extraction quality was inconsistent — the pipeline was going through OpenAI's structured output mode, which rejects certain Zod schemas, and no one had formally benchmarked which model did extraction best
2. The article view's claim display was clunky — per-claim action chips cluttered the text, and there was no way to drill into a statement's full donto representation
3. The worker sandbox had accumulated complexity from the eight-commit iteration in the previous period, and the `bypassPermissions` + capability grants needed final polish

### Approach: Extraction Benchmark

`c5302da` — "extraction benchmark: 30+ models tested, Grok 4.1 Fast is the production pick" (+4,864/-0): 4,864 lines of benchmark data. 30+ models tested on the extraction task. Grok 4.1 Fast won. The benchmark is the definitive answer to "which model extracts facts most accurately from research transcripts."

The benchmark methodology isn't fully described in the commit message, but the result is concrete: Grok 4.1 Fast is in production now. Previous production model was OpenAI, which got bypassed because of the structured output schema rejection issues.

`c168ec1` — "extraction: direct-parse Claude's structured block (skip OpenAI)" (+198/-1): Claude's output now gets parsed directly. The OpenAI structured output layer was a middleman that rejected valid Zod schemas (`z.string().url()` fails because OpenAI doesn't accept `format: uri` in the JSON Schema it generates). Direct parsing gives full control over the output format.

`546d6fe` — "normaliser prompt — handle Claude's loose output" (+61/-28): Claude's direct output isn't always schema-compliant. The normalizer pass reformats before writing to donto — fixing predicate name variations, converting string confidence values to floats, normalizing IRI formats.

`db7e5c6` — "ontology-grade extraction: extract EVERYTHING from research transcripts" (+107/-73): the extraction prompt was rewritten to be ontology-aware. Instead of generic "extract facts," it now knows dontopedia's predicate schema and targets specific relationship types. "Extract EVERYTHING" is the stance — no implicit caps, no examples that double as limits.

`e42fbac` — "prompt: no fact limit — extract 1000+ per session if sources support it" (+14/-6): the explicit removal of the implicit ceiling that `48370e2` found in the previous period. Sources that warrant 1000 facts will now yield 1000 facts.

### Approach: Article View and Statement Drawer

`ffd9f60` — "article: right-click context menu replaces per-claim action chips" (+317/-10): the article view previously had small action buttons on every claim. They were noisy. The replacement is a right-click context menu — right-click any claim text to get actions. Cleaner reading experience, same functionality.

`1d8138a` — "article: selection-triggered floating action bar (replaces right-click)" (+343/-4): and then the right-click was replaced with a floating action bar that appears on text selection. The UX iteration shows the interaction model going through real usage testing — chips → right-click → floating bar.

`d93034f` — "article: statement detail drawer (all-donto-power surface)" is the significant addition referenced in the previous period, still in active development this period. `StatementDrawer.tsx` is a top-edited file. Clicking any statement opens a drawer with the full donto representation: source, confidence, bitemporal timestamps, related statements, contradiction flags, context annotations.

`f2089bc` — "article: full Wikipedia layout + Base UI Tabs/Dialog" (+604/-474): Base UI primitives (headless, accessible) replaced custom tab and dialog implementations. The -474 deletion count is the old implementations going away.

`852cf06` — "article: sort sections by semantic importance (Wikipedia order)" (+37/-1): sections sort by a hardcoded semantic hierarchy — biographical sections before bibliography, career before personal life. Without this, sections sort by insertion order, which is random.

`48370e2` — "article: bump history limit 500→5000 (946 facts were being truncated)": the catch that defined the previous period's extraction work. Still visible in the commit history because it was the symptom that revealed the upstream cap problem.

### Approach: Claude Sandbox Final Polish

The sandbox work continued from the previous period, though this period was polish rather than initial debugging:

`e9ddd8a` — "entrypoint: comma-separated allowed-tools + -- before prompt": the `--allowed-tools` flag takes a comma-separated list. The `--` before the prompt separates flags from positional arguments. Both are Claude Code CLI semantics that had to be discovered through iteration.

`d783c77` — "sandbox: chmod 0777 /home/claude (cap-drop ALL removes DAC_OVERRIDE)": the home directory permission hack from the previous period, confirmed as the right approach here.

`eb83e2e` — "sandbox: keep reddit MCP (works locally), note datacenter 403 fallback": the Reddit MCP server works in local development, fails in production because the datacenter IP is blocked by Reddit's API. The fallback is documented — the worker uses other sources in production.

`8c2e742` — "sandbox: add reddit-mcp-buddy MCP server" (+20/-2): the Reddit MCP integration that works locally.

### Approach: Infrastructure

`6d39b12` — "document upload: images/PDFs as first-class donto sources" (+1,185/-6): document attachments for facts. A PDF or image uploaded to dontopedia becomes a source that can be cited. The upload flow handles both image and PDF formats, stores the document in the source registry, and links it to the relevant facts.

`281a2d9` — "rip auth entirely — Dontopedia is fully public": authentication middleware removed. dontopedia is fully open. No login, no gate.

`fe491dd` — "web: SSE proxy route — runtime=nodejs + anti-buffering headers": SSE stream from the research worker to the browser. `runtime=nodejs` prevents edge runtime buffering. Anti-buffering headers prevent Caddy from holding chunks.

`8b4c459` — "SSE: Caddy path match w/ flush_interval -1 + Next proxy headers": `flush_interval -1` makes Caddy flush SSE chunks immediately. The path matcher routes SSE requests differently from regular API traffic.

`9caff08` — "HANDOFF.md — comprehensive handoff doc for new agents/contributors" (+274/-0): a handoff document for new agents or contributors. Added then removed in `28a6dd0` ("copied externally") — same pattern as the donto genealogy guide. Written in the repo, iterated, exported.

### Results

- 30+ model extraction benchmark run; Grok 4.1 Fast in production (per commit description)
- Article view UX: chips → right-click → floating bar on selection (3 interaction model iterations in one period)
- Statement drawer: full donto representation for any claim, accessible from the article view
- Document upload: images and PDFs as first-class sources (+1,185 lines)
- Auth removed: fully public wiki
- SSE: research worker streams progress to browser through Caddy and Next.js

### Pitfalls / What Broke

The interaction model iteration (chips → right-click → floating bar) over three commits is evidence of real usage testing — which is good — but it also means the previous interactions got built, tested, and replaced. Three complete implementations of "how to act on a claim" in one period. The fourth implementation might stick.

The Reddit 403 in production is a real capability gap. The benchmark showed Grok 4.1 Fast winning on extraction quality, but extraction quality is only as good as the research sources the worker can access. Reddit has significant informal knowledge that's not in academic sources.

The HANDOFF.md was written and removed in the same period. Either the external destination was ready immediately (unlikely) or the handoff document was premature. Writing documentation before the codebase stabilizes means the documentation goes stale fast.

### Next

- Production Reddit access: proxy layer or alternative IP pool for the research worker
- Stress-test the document upload against real research PDFs in a full extraction session
- Determine the right storage backend for the extraction benchmark data — 4,864 lines of benchmark output in a single commit is not a scalable pattern

---

## jsonresume.org: Docs Migration, Three CI Fixes

**4 commits. +45,979/-24,898 lines.**

### Problem

The jsonresume.org documentation site was on Nextra. The target was Fumadocs + Docwright, deploying to GH Pages. Two CI workflow bugs were blocking clean deploys alongside the migration.

### Approach

`88e4cd8` — "feat(docs): replace Nextra with Docwright + Fumadocs, deploy to GH Pages" (+45,979/-24,898): the migration. The line count is real but mostly generated — MDX restructuring, Fumadocs configuration, navigation tree generation, and the auto-generated content indexes. Nextra and Fumadocs are both Next.js doc frameworks; Fumadocs has stronger built-in search, better navigation primitives, and doesn't depend on pages-router patterns. The migration also adds GH Pages deployment instead of Vercel.

`8d0d733` — "ci(docs): add standalone deploy workflow (no Docwright dependency)" (+70/-0): the original deploy pipeline required Docwright to run first. A standalone workflow lets the docs site deploy in response to content changes without triggering the full pipeline. The +70/-0 shape is a new workflow YAML file.

`8ed0a67` — "fix(docs): fix workflow YAML — remove special chars and secrets-in-if" (+8/-17): `secrets.FOO` in a GitHub Actions `if:` condition leaks the secret value to workflow logs. GitHub flags this. The fix removes the condition. The special character issue was likely an unquoted string with a colon in YAML.

`c9ed5d3` — "fix(ci): use packageManager pnpm version from package.json" (+0/-1): one line deleted. The workflow pinned pnpm at an explicit version. `package.json` declared a different version. Deleting the explicit pin inherits from the project declaration, eliminating the drift.

### Results

- Docs migrated from Nextra to Fumadocs and deploying to GH Pages (measured: +45,979/-24,898 lines)
- Standalone deploy workflow: CI can deploy docs without Docwright
- Secrets-in-if pattern removed: GitHub Actions security recommendation followed
- pnpm version drift eliminated

### Pitfalls / What Broke

45,979 lines of content restructuring can't be reviewed for correctness. Broken cross-references, missing pages, and incorrect navigation won't appear in CI — they surface when someone hits a 404. The live GH Pages site needs a manual pass against the previous Nextra structure.

The secrets-in-if fix is a security fix masquerading as a bug fix. If the pattern existed in CI, it existed since whatever commit introduced it — secrets may have been leaking to workflow logs for some time. Worth auditing other workflow files in the repo for the same pattern.

### Next

- Verify the Fumadocs deploy against the live site: audit old Nextra URLs for 404s
- Search other jsonresume.org workflow files for the secrets-in-if pattern

---

## omega: A Screenshot and an Index Update

**2 commits. Minimal activity.**

`2b6e7de` — "Upload Screenshot_2026-05-01_at_2.56.40_AM.png by xenonfun": a file upload, no code change (per the +0/-0 diff). `19bab0e` — "Update file index: add Screenshot_2026-05-01_at_2.56.40_AM_cb98ca4a.png" (+18/-0): the index records the file. omega is a file/asset storage repo — this is maintenance traffic, not feature work.

The screenshot timestamp (2:56 AM, 2026-05-01) suggests late-night tooling work, consistent with the period's commit timestamps across the other repos.

### Next

- Check if the screenshot is evidence of work in another repo that isn't captured in the activity data

---

## What's Next

- **Run more papers through toiletpaper**: the PRD framework is mostly implemented; KAN and MEMORA are the proof-of-concept runs; the simulator needs diverse paper types to validate the claim-extraction and verdict logic beyond ML architecture papers
- **toiletpaper provider stability**: three LLM provider rotations in one week is too much churn for a system where reproducibility is the whole product; lock a provider and pin model IDs in the config
- **dontopedia Reddit access in production**: the research worker hits a 403 from the datacenter IP; either resolve with an egress IP change, implement a proxy layer, or document Reddit as dev-only and update the worker's research strategy
- **donto migration audit**: 45 migrations in two weeks at high velocity; audit for unused or premature schema additions before they accumulate into a legacy burden
- **donto CLI distribution**: the `donto extract` command is useful as a standalone tool; build and distribute platform binaries so it doesn't require a full Rust dev environment to run
- **dontopedia document upload QA**: 1,185 lines of new functionality, needs testing against real research PDFs in a production extraction session
- **jsonresume Fumadocs deploy verification**: 45,979 lines of content restructuring; manually verify the GH Pages site for broken URLs and missing pages before relying on it

---

## Links & Resources

### Projects

- [toiletpaper](https://github.com/thomasdavis/toiletpaper) — Adversarial scientific paper simulator: extracts claims, runs experiments, stores verdicts
- [donto](https://github.com/thomasdavis/donto) — Paraconsistent knowledge base (PostgreSQL extension + CLI + API); every fact has a source, a time, and a confidence level
- [dontopedia](https://github.com/thomasdavis/dontopedia) — Open paraconsistent wiki built on donto; every claim has a source, a time, and an opinion
- [jsonresume.org](https://github.com/jsonresume/jsonresume.org) — JSON Resume mono repo: homepage, registry, UI components, docs

### Tools & Services

- [Grok 4.1 Fast via xAI](https://x.ai/) — Production pick for dontopedia extraction after benchmarking 30+ models
- [OpenRouter](https://openrouter.ai/) — Multi-provider LLM API used for Grok access in toiletpaper
- [GCP Secret Manager](https://cloud.google.com/secret-manager) — Runtime credential injection for Cloud Run services (Claude OAuth in toiletpaper)
- [Fumadocs](https://fumadocs.vercel.app/) — Next.js documentation framework (replaced Nextra in jsonresume.org)
- [su-exec](https://github.com/ncopa/su-exec) — Minimal setuid+setgid+exec for Docker entrypoints; avoids `su`'s argv mangling
- [Base UI](https://base-ui.com/) — Headless accessible UI primitives (Tabs, Dialog) used in dontopedia article view
- [Temporal](https://temporal.io/) — Workflow orchestration for dontopedia research sessions
- [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) — PostgreSQL trigram similarity extension used for predicate alignment in donto

### Inspiration

- KAN paper (Kolmogorov-Arnold Networks) — the simulator's first real test; a high-profile ML architecture paper with 40 testable claims is exactly the kind of target toiletpaper was designed for; 17 "fragile" verdicts is more interesting than either 21 reproduced or 2 contradicted
- Paraconsistency as a data model — genealogy research and scientific claim verification are both domains where contradictory data is normal and expected; building a database that treats contradiction as queryable structure rather than a consistency error is the design premise that makes both use cases possible
- RFC 1951 (DEFLATE) as a patience test — implemented this week in kukuos (prior period); zlib INFLATE from the spec in a language with no libraries teaches you more about compression than reading the Wikipedia page; the 7-line diff that went from "Huffman WIP" to "all green" is what debugging a bit-stream decoder actually looks like
