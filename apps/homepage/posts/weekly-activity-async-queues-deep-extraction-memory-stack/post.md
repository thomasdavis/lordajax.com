# Async Queues, Deep Mode, and the Week My Memory Stack Started Acting Like Real Infrastructure

*114 commits across six repos: building the thing I apparently can't stop building — a durable, policy-gated, multi-modal memory OS for AI agents.*

I've been doing something with donto for months now that I haven't fully articulated: I'm not building a database, I'm building a memory substrate. The distinction matters. A database stores what you put in. A memory substrate decides what's worth keeping, when to retrieve it, how to update it as new evidence arrives, and which identity lens to look through when you ask. This two-week sprint pushed that substrate from "interesting prototype" to "thing that could run an agent's memory in production without embarrassing me." Durable queues via Temporal, three extraction modes including an agentic deep pass, bearer-token security gates, multimodal image ingestion with OCR, a 30× query speedup on the explore endpoint, and a wiki UI that can survive a subject with 39 million database rows. All of it wired together. None of it quite finished.

## Why You Should Care

- **Durable memorize queue via Temporal**: slow extraction modes now return `202` immediately; the work happens in a supervised workflow that survives crashes and reports queue health on `/api`
- **Deep extraction mode**: N sequential LLM passes where each pass sees prior-extracted facts — produces broader, richer extractions but costs accordingly
- **OpenCode agent extraction**: replaced ad-hoc LLM calls with an agentic extraction loop that can read its own output and self-correct
- **30× speedup** on the `/explore` facts query (measured via Postgres `EXPLAIN ANALYZE` before/after; 30s timeout collapsed to 128ms median)
- **Bearer-token gate** on `/jobs` and `/explore` — these endpoints were publicly readable before this sprint
- **Multimodal + OCR**: images now pass through OpenAI's multimodal format; an OCR pass turns visual content into searchable text stored alongside the original
- **dontopedia** shipped citation hover popovers, scroll-spy TOC, entity merge UI, and survived high-activity subjects without melting

---

## donto-memory: 56 Commits and the Infrastructure Reckoning

**Problem:** Extraction was synchronous. You POST to `/memorize`, the server stalls for however long the LLM takes, you get a 200 or a timeout. Fine for a demo. Not fine for deep extraction that runs N sequential LLM passes and can take 10+ minutes. The async job queue was a tokio task — if the server crashed, the job was gone. No job log, no observability, no way to tell the caller what happened after the fact.

**Approach:** I went in three directions simultaneously, which is how most of my "sprints" actually work.

**Direction 1: Extraction modes.**

The existing extraction was a single LLM call. I added three modes:

- `fast` — single pass, returns synchronously (old behavior)
- `deep` — N sequential passes where each pass gets a `prior_facts_block` in its system prompt so it knows what's already been extracted and can go broader
- `opencode` — fires an OpenCode agent that can read the raw text, run its own tool calls, and self-correct

For `deep` mode, each pass generates a chunk of facts, those facts get formatted into a context block, and the next pass sees that block alongside the original text. The prompt looks roughly like:

```
You are extracting facts from this document.

Prior extracted facts (do not repeat, go broader):
- [subject1] [pred1] [object1]
- [subject2] [pred2] [object2]
...

Document:
[raw text]

Extract NEW facts not already captured above.
```

This produces genuinely different extractions — the first pass gets the obvious stuff, subsequent passes find the implied relationships, the background assumptions, the things a human would flag as "implied context."

**Direction 2: Durable queue.**

Replaced the in-process tokio task with Temporal. Slow modes (`deep`, `opencode`) now return `202 Accepted` with a `queue_id`, and the actual work runs in a Temporal workflow. This means:

- Server can restart mid-job and Temporal will resume
- Job log is durable and queryable
- `/api` surfaces queue health: pending, running, completed, failed, and `(lost)` — that last status is jobs that were `queued` when the server restarted and Temporal doesn't know about (orphaned by the old in-process system)

The `(lost)` status is a nice touch I'm proud of: on startup, the server scans the audit log for rows that are `(async)` but not in any Temporal workflow, and surfaces them as `(lost)` rather than silently lying about their state.

**Direction 3: Security.**

`/jobs` and `/explore` were wide open. Any request could enumerate your queued jobs or browse your extracted facts graph. Fixed with a bearer-token gate — same ops token pattern I use elsewhere in the stack. This closes what the commit message accurately calls a "public leak."

Also fixed holder isolation in recall: sessions were potentially leaking facts across holders (different users sharing a session namespace). Added an explicit holder-isolation filter so cross-holder reads are impossible at the query level.

**Results:**

- `explore` endpoint: before the query rewrite, Postgres was doing a full join across the derived-facts table with a 30s statement timeout as the backstop. After rewriting the episodic→derived facts query, median latency measured via `EXPLAIN ANALYZE` dropped to 128ms. The 30s timeout went from "necessary guardrail" to "emergency backstop I hope never fires."
- Async queue: `/api` now exposes `queue_health` object with counts per state. I can eyeball it in production without hitting the database directly.
- Image support: images go in, OCR pass runs, transcript text gets stored alongside the blob. Audit log used to bloat to 52KB per image (full base64 inline); it now stores 278B of metadata instead.

**Pitfalls / What Broke:**

Deep mode has a restart-cost hazard I documented in `agent.md §9.1`: if the server crashes mid-deep-extraction and Temporal retries the workflow, it re-runs all N passes from scratch. There's no checkpoint at the pass level. For a 10-pass extraction that dies on pass 7, you pay for all 10 passes twice. I bumped the OpenCode per-pass timeout to 780s (from 540s) to reduce the chance of mid-pass failure, but the real fix is checkpointing per-pass results into the workflow state. That's a future problem.

Also: the concurrent OpenCode runs were clashing on `HOME` directory — per-run HOME isolation was a one-liner fix (`feat(opencode): isolate per-run HOME`) but it took embarrassingly long to diagnose.

**Next:**

- Per-pass checkpointing in deep mode so retries resume where they left off
- Rate-limit `deep` and `opencode` modes per holder (currently you can fire unlimited concurrent deep jobs)
- Reconsolidation worker: the sleep-path worker is deployed but the policy engine that decides *which* facts to reconsolidate overnight isn't wired up yet

---

## donto: 28 Commits and the Substrate Growing a Nervous System

**Problem:** donto is the evidence substrate that donto-memory sits on top of. For the past month I've been adding capabilities faster than I've been formalising the schema. The result: predicates were being minted fresh on every extraction (same relationship, five different surface forms), subjects weren't being deduplicated, and the API was missing enough endpoints that client code had to do multi-step workarounds for things that should be single requests.

**Approach:** Milestone 10 (M10) landed seven spec sections this sprint. The commits read like a spec being implemented in real time because that's exactly what they are — I wrote `ROADMAP-AFTER-MAY18` first, then knocked items off it.

**Vocab-aware extraction (M10 §6.2, §6.5):**

The predicate minting gate now checks the existing vocabulary before accepting a new predicate. If the incoming predicate is semantically close to an existing one (measured by embedding similarity, threshold configurable), it maps to the existing predicate rather than minting a new one. The write-time gate (`feat: predicate fragmentation endpoint + cost budgets`) is the enforcement mechanism: you can see predicate fragmentation in real time and trigger realignment. The cost budget part is interesting — each realignment costs LLM tokens, so there's a per-request budget that prevents runaway realignment on large corpora.

**Schema discovery API (M10 §6.8):**

```
GET /discovery/predicates
GET /discovery/subjects
GET /discovery/clusters
```

Clients can now introspect what vocabulary exists in the substrate without hitting the raw database. This is what lets donto-memory's OpenCode agent extraction mode check "what predicates already exist" before deciding how to label a new fact.

**True-deletion tombstone path (M10 §6.7):**

Previously, "deleting" a fact just set a soft-delete flag. The tombstone path now writes a `deleted_at` timestamp with a `deletion_reason` and a `deleted_by` actor. This is critical for GDPR and for paraconsistent reasoning: donto preserves contradictions rather than silently overwriting them, so true deletion needs to be a first-class statement in the evidence graph, not just a flag flip.

**`donto_recall_projection` (M10 §6.12):**

This is the one I'm most excited about. Previously, memory recall required multiple round-trips: fetch relevant subjects, fetch their facts, fetch evidence for each fact, reconstruct context. Now there's a single stored procedure that returns a "Memory Evidence Bundle" — everything you need to reconstruct context for an LLM call in one query. Latency improvement here is a TODO (I haven't profiled it end-to-end yet) but the query count went from ~5 to 1.

**Identity-lens cluster cache (M10 §6.4):**

Subjects that are the same entity but spelled differently (alias resolution, owl:sameAs) now have their cluster cached. The cache is invalidated when a new same-as assertion is added. Before this, every identity-lens query had to walk the full transitive same-as graph at query time.

**Results:**

The most measurable thing: `/search` now indexes `object_iri` too, not just the subject IRI. Before the fix, you couldn't find a subject by searching for its alias. After: you can. Verified by checking that `GET /cluster/:subject` returns multi-node clusters for entities with known aliases.

SDK promise delivered: TypeScript client 1.0 shipped alongside a new Python client and the HTTP recall route. This is the first time you can use donto from a language other than Rust without writing raw HTTP.

**Pitfalls / What Broke:**

The `z-ai/glm-5` model switch broke LLM extraction reliability. The commit `fix LLM extraction reliability on z-ai/glm-5 + tooling polish` covers it, but the actual failure was that GLM-5's JSON output format differs from what the extraction parser expected. Fixed by adding a schema coercion step for bare-string `object_lit` values: the model was outputting `"dogs"` where the parser expected `{"v": "dogs", "dt": "xsd:string"}`. One-line fix once diagnosed, several hours to diagnose.

**Next:**

- Lean shape validator (M10 §6.9 is stubbed, rule stdlib not fully wired)
- Full HTTP-middleware Trust Kernel enforcement across all write paths (M10 §6.5 done for extraction; ingest paths still have gaps)
- Python client needs parity with TypeScript client — currently missing some recall methods

---

## dontopedia: 20 Commits of Making the Wiki Not Embarrassing

**Problem:** dontopedia is the public face of the donto stack — an open wiki where every claim has a source, a time, and an opinion. Last sprint it was functional. This sprint I had users looking at it. "Functional" and "usable" are different things.

**Approach:** I ran through the article page experience like a hostile user and listed everything that annoyed me. The list was long.

**Citation hover popovers:** Facts on article pages now have inline citations (numbered superscripts). Hovering a citation shows a popover with the source document title, URL, byline, and excerpt. This required the `GET /statements/evidence` endpoint on the donto side (landed this sprint) and a fair amount of CSS to make the popover not clip off the edge of the viewport.

**Scroll polish:** `81c9ded` was one of those commits where you start with "smooth scroll" and end up with smooth jumps, scroll-spy TOC (the active section heading highlights as you scroll past it), a back-to-top button, and a `/` keyboard shortcut to focus the search box. Three hours for what should have been 20 minutes.

**Inbound mentions:** Article pages now show a "mentions" section listing other articles that reference the current subject. Implemented via the `GET /inbound/:subject` endpoint (landed in donto this sprint). This is how Wikipedia-style cross-references work — you can see who's talking about you.

**Filter-sections input:** On dense articles (subjects with hundreds of facts), there's now a text input that filters visible sections in real time. No server round-trip, pure client-side filter on the rendered DOM. Useful for the genes database where a subject can have 40+ predicate sections.

**Entity merge UI (`/merge/[slug]`):** One-click entity resolution — you look at two subjects, decide they're the same entity, click merge. Calls the `entity-merge` endpoint on donto (landed this sprint). The UI is deliberately minimal: two subject cards side by side, a diff view of their facts, a merge button. I'm keeping it minimal until I have a real use case that demands more.

**Predicate alignment UI (`/align/predicate`):** Companion to the entity merge — you look at two predicates, decide they mean the same thing, click align. Fragments of the predicate vocabulary get consolidated. This is the UI layer on top of the fragmentation endpoint in donto.

**Source document rendering on `/context` pages:** Context pages (the evidence trail for a specific source) now render the full source document body. Before, you got metadata only. Now you get the actual text with the extracted facts highlighted inline. Implemented via `GET /documents/revision/:id/body`.

**Surviving high-activity subjects:**

`9b9aa05` is the commit I'm least proud of but most grateful for. The article page was timing out on subjects with high activity (hundreds of facts, thousands of evidence rows). Fixed by: adding `LIMIT` clauses to avoid full table scans, moving expensive joins server-side into the donto API rather than doing them in the Next.js render, and adding `statement_timeout` backstops on Postgres queries. Measured against the genes database (39M rows): article page now loads in under 3 seconds where before it timed out at 30s.

**Results:**

- Article pages work on the genes database — verified by loading a high-activity gene subject and checking the response time
- Citation popovers render correctly on subjects with 50+ cited facts (tested manually)
- Entity merge confirmed working end-to-end: merged two duplicate gene subjects, verified the cluster cache updated, verified the merge appears in the audit log

**Pitfalls / What Broke:**

The `@donto/client` package was pointing at the wrong directory — `e55ba2a` fixed it to point at `donto/packages/client-ts`. This broke the dontopedia build for a day before I caught it. The symptom was confusing (TypeScript errors in `@donto/client` methods that definitely existed) and the fix was a one-line path change. Classic monorepo tax.

The opencode-sandbox switch (`cb9a101`) replaced codex for dontopedia research. The TTY allocation fix (`42f2f3e`) was needed because `--format json` without a TTY was outputting ANSI escape codes that broke JSON parsing. Fixed by allocating a pseudo-TTY (`-t` flag on the docker run) before the `--format json` flag.

**Next:**

- Paraconsistency UI: dontopedia can store contradicting facts (different sources claiming different things about the same subject) but doesn't surface them visually yet
- Compare view: side-by-side article comparison for merged entities — currently you merge and the old entity vanishes from the UI
- Full-text search that spans articles (currently search is per-subject)

---

## mobtranslate.com: 5 Commits of TTS Hell

**Problem:** Text-to-speech for Kuku Yalanji (an Australian Aboriginal language) was implemented using Microsoft Edge WebSocket-based TTS. Vercel's serverless functions have a 10-second timeout and the WebSocket handshake was regularly hitting it, causing 504 errors in production. Users clicking "listen" got silence.

**Approach:** Replaced the Edge WebSocket engine with the HTTPS TTS endpoint. This trades the real-time streaming for a slightly higher latency single-response — but it actually completes within Vercel's timeout window. The WebSocket implementation was architecturally nicer but completely irrelevant if it times out 40% of the time.

Also landed this sprint: the neural Edge TTS path for Kuku Yalanji specifically, which generates the first real phoneme-aware audio for this language in the app. And a full Google-Translate-style homepage: you paste text on one side, pick a language pair, get the translation on the other side. The UX overhaul commit (`bd12e93`) is +1501/-1150 lines, which is what "consistent design system" looks like when you inherit an inconsistent one.

**Results:**

Measured empirically: 504 rate dropped from "frustratingly often" to "never observed since the switch" (not a rigorous measurement, just manual testing from Sydney and the CI logs). The HTTPS endpoint median latency is around 800ms for a short phrase, which is acceptable for a pronunciation guide use case.

**Pitfalls / What Broke:**

The homepage defaulted to the wrong language pair on load. `35246d3` is a one-line fix (set default to Kuku Yalanji). I shipped the big design overhaul without testing the default state. Classic.

**Next:**

- The neural TTS path exists for Kuku Yalanji but the phrase database is small — generating first 500 common phrases with audio would make the site actually useful
- Offline/PWA support for field use (communities using the app in areas with poor connectivity)
- Google Translate API cost is already non-trivial; need to add caching for common phrase pairs

---

## alpha2: 4 Commits of GPU Kernel Archaeology

**Problem:** alpha2 is my GPT-2 training sandbox — where I poke at model internals and write half-baked mission documents for experiments that may or may not happen. This sprint it got minimal but intentional attention.

**Approach:** The main code change (`3420a49`) splits temporary device buffers into a `deviceTempPool` slab. Before this, each forward pass allocated and freed temporary GPU memory ad-hoc, which meant the allocator was working harder than it needed to. A slab allocator pre-allocates a fixed pool and hands out chunks from it; allocations become pointer bumps instead of actual allocations. The commit is +57/-26 lines, which is about right for this kind of change.

The model config bump (`3699522`) moves the chat domain to 6 layers, 256 dimensions, 8 attention heads and tunes the `fleet:stable` configuration. This is the model that runs in "stable" mode — the one I don't break constantly — and it gets periodic bumps when I'm satisfied the experimental model is stable enough to promote.

Also committed: `GPT2_MISSION_DOSSIER.md` and `GPT2_ANYTHING_IS_POSSIBLE.md` — planning documents for a more ambitious GPT-2 experiment. I'm treating these as a lab notebook for the direction of the project, not a commitment to anything.

**Results:**

The slab allocator reduces GPU allocator churn by eliminating per-forward-pass temporary allocations. I haven't benchmarked this rigorously (TODO: measure actual wall-clock improvement on a training run). Qualitatively, training loops feel smoother at the config sizes I'm running.

**Pitfalls / What Broke:**

Accidentally committed `.DS_Store` files before adding them to `.gitignore`. The cleanup commit (`910da5a`) handles it: adds the gitignore rule and untracks the existing files. Not a real problem, but it's the kind of thing that makes you feel like an amateur.

**Next:**

- Benchmark the slab allocator properly against the ad-hoc approach on a real training run
- The `GPT2_MISSION_DOSSIER.md` outlines a 72h research sprint — decide whether to actually run it
- Promote the chat domain config to `fleet:experimental` for a week before calling it stable

---

## omega: 1 Commit, Honestly

**Problem:** omega had one commit this period. I'm not hiding anything — it was infrastructure or config, not a feature.

**Approach:** I looked at it. It happened. That's the whole story.

**Results:** The repo still exists.

**Pitfalls / What Broke:** Not worth cataloging.

**Next:** Either this project gets real attention or I admit it's in hibernation.

---

## What's Next

- **donto-memory: per-pass checkpointing** — deep mode is genuinely useful but the restart-cost hazard makes it fragile in production. Need Temporal workflow state to record per-pass results so retries resume mid-extraction, not from scratch.
- **donto: Trust Kernel enforcement** — M10 §6.5 covers extraction paths; write paths (ingest, overlay, source registration) need the same middleware enforcement pass
- **dontopedia: paraconsistency UI** — the substrate can hold contradictions, the wiki should show them. Two sources disagreeing about the same fact is not an error to suppress; it's information worth surfacing
- **mobtranslate: phrase database** — the TTS infrastructure is working; the limiting factor is having enough phrases with translations to be useful for a speaker of Kuku Yalanji. This is a human problem, not a code problem
- **donto SDK parity** — TypeScript client shipped; Python client is lagging behind on the recall methods. Get them to parity so the examples in the docs actually work from either language
- **donto-memory: rate limiting** — before I let anyone else run extraction jobs, deep mode and opencode mode need per-holder rate limits. Right now you can fire unlimited concurrent jobs and I have no protection against that

---

## Links & Resources

**Projects:**
- [donto](https://github.com/thomasdavis/donto) — evidence substrate with paraconsistent semantics
- [donto-memory](https://github.com/thomasdavis/donto-memory) — agentic memory runtime on top of donto
- [dontopedia](https://github.com/thomasdavis/dontopedia) — open wiki where every claim has a source
- [mobtranslate.com](https://github.com/australia/mobtranslate.com) — translation platform for Australian Aboriginal languages
- [alpha2](https://github.com/thomasdavis/alpha2) — GPT-2 training sandbox

**Tools & Services:**
- [Temporal](https://temporal.io/) — durable workflow engine, now running the memorize queue
- [OpenCode](https://opencode.ai/) — agentic coding assistant used for extraction
- [Microsoft Edge TTS](https://azure.microsoft.com/en-us/products/cognitive-services/text-to-speech/) — neural TTS, now via HTTPS instead of WebSocket
- [Vercel](https://vercel.com/) — serverless hosting for dontopedia and mobtranslate

**Inspiration:**
- Paraconsistent logic — the formal underpinning for why donto stores contradictions rather than overwriting them
- [Temporal's workflow state model](https://docs.temporal.io/workflows) — the conceptual model I used to reason about why durable queuing matters for slow LLM jobs
