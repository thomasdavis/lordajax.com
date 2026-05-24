# Source Bodies, Citation Popovers, and the Two Weeks Donto Learned to Show Its Work

*104 commits, 29,000 lines, and one unifying obsession: making every fact in the stack point back to the exact sentence it came from.*

The hidden pattern across this period isn't any single feature — it's provenance as a first-class concern running through every layer simultaneously. donto got content-addressed blobs, backward-fill tracing, byte-precise evidence links, and `donto cite`. dontopedia got clickable references, hover citation popovers, full source document rendering, and inbound mention tracking. democracy deployed to GCE and then spent several commits fighting mail volumes and SA's Sitecore SPA. lordajax.com got the warm-paper redesign I kept putting off. alpha2 got GPT-2 mission planning documents and a device buffer refactor. Even mobtranslate, with its single lonesome commit, kept the streak alive. The through-line: I'm building a knowledge stack where every claim is traceable to an exact source document, at a specific byte offset, at a known content-addressed revision. Whether I planned it that way or not, that is what's happening.

## Why You Should Care

- **donto now tracks where every sentence came from**: content-addressed blob substrate, source-provenance backward-fill (Stage D), byte-level inverted index, and `donto cite` for querying citations — extracted facts aren't just attributable to a document, they're attributable to an exact line
- **dontopedia UX went from functional to actually good**: hover citation popovers, full source body rendering on `/context` pages, inbound mentions section, filter-sections input, scroll-spy TOC, smooth jumps, back-to-top, '/' shortcut — 13 UX commits in two weeks
- **dontopedia replaced Codex with opencode-sandbox** for research, allocated TTY properly, and switched to `--format json` for structured Docker output
- **donto gained vocabulary-aware extraction** — no more minting fresh predicates for synonyms; predicate alignment and context-span quarantine landed in the same batch
- **democracy deployed to GCE with Caddy + Let's Encrypt**, scraped state and federal rosters, then fought two mail-sending bugs in production
- **alpha2's GPT-2 mission docs and device buffer split** clarify the ML direction: 6-layer, 256-dim, 8-head fleet model with a dedicated temp slab

---

## donto: Source Provenance, Vocabulary Alignment, and the Blob Substrate

**57 commits. 31 features, 4 fixes. Primary files: `lib.rs`, `history.rs`, `main.rs`, `migrations.rs`.**

### Problem

The extraction pipeline had a compound provenance problem. Fact A is in the database. It supposedly came from Document X. But: which revision of Document X? Which specific passage? If I re-extract Document X tomorrow and get a slightly different fact, which one is authoritative and why? There was also a vocabulary drift problem — the same predicate kept getting minted under different names. And the DontoQL query surface was missing clause types from the PRD spec.

### Approach: Blob Substrate and Evidence Links

`9c0489f` — content-addressed blob substrate, Stage A (+1,235/-0): every document ingested into donto is stored by its content hash. Ingest the same URL twice, get the same address. This is the deduplication layer — and more importantly, it's the foundation for pointing extracted facts at an exact document state rather than a floating reference.

`7b1eeef` — Stage B: every extracted statement gets a source revision + evidence_link (+140/-16): facts now carry a reference to the exact blob revision they came from. Not "this came from the BBC article about X" — "this came from revision `sha256:abc123` of that article."

`5651a0d` — Stage D: donto trace, source-provenance backward-fill (+1,031/-0): the big one. Stage D walks backward through existing extracted statements and fills in their source provenance. Statements extracted before the blob substrate existed get retroactively linked to their sources, including a best-effort byte range. 1,031 lines of backward-fill logic.

`2b16a13` — trace Stage D.6: disambiguation pass (+176/-0): handles the case where multiple revisions of the same document exist and a statement could plausibly map to more than one. Disambiguation chooses the closest revision by date.

`f9429bb` — line-level inverted index, three-tier search (+211/-14): the trace pipeline now maintains an inverted index at the line level. Three search tiers: exact match, phrase proximity, BM25 fuzzy. The combination handles short quotes, paraphrased citations, and near-duplicates.

`c1fea25` — handle stringified-JSON textSpan shape (+59/-15): the textSpan coming out of the LLM was sometimes arriving as a JSON-encoded string inside the JSON response, not as a parsed object. The trace code expected a parsed shape. 59 lines of defensive parsing; 15 lines of the old assumption deleted.

```rust
// The LLM was doing this:
// { "textSpan": "{\"start\": 42, \"end\": 87}" }
// Instead of:
// { "textSpan": { "start": 42, "end": 87 } }
```

`f1b425c` — add `--shard`/`--shard-of` for parallel trace workers; add `donto cite` (+180/-0): the trace backward-fill is slow over a large corpus. Sharding splits the work across N parallel workers by subject hash. `donto cite` is the new subcommand for querying which documents support a given claim.

`77825a5` — in-batch async fan-out via `buffer_unordered` (+100/-74): trace processing switched from sequential per-document to concurrent fan-out. The net line count is nearly flat (+100/-74) because the old sequential loop was replaced by async fan-out logic of similar complexity. Speed improvement is qualitative — the sequential path had visible latency per document.

`e8b0316` — gate body_inline fallback on `needle.contains('\n')` (+16/-5): the trace was falling back to searching the full document body when the needle contained no newlines, producing false positives. Five lines removed, sixteen added to check for newlines before allowing the fallback.

### Approach: Vocabulary-Aware Extraction

`31c519b` — vocab-aware extraction: stop minting fresh predicates (+543/-26): before this, every extraction pass could invent new predicates. "was born in" and "birthplace" and "born at" all coexisted as separate predicates for the same relationship. This commit routes new predicates through a vocabulary check before creating them, matching to existing predicates when semantic similarity is high enough.

`20a158e` — predicate alignment + context-spans + conceivable quarantine (+297/-1): extracted statements that could plausibly be true but lack sufficient evidence get quarantined in a "conceivable" state rather than being promoted to the main fact table. Context-spans attach the exact passage where a statement was found, preserving the human-readable citation even when the byte-level reference isn't available.

`5928bff` — anchor-aware ingest + exhaustive-by-default extraction (+306/-58): anchors are named sections within a document (think HTML `<h2>` elements). Anchor-aware ingest tracks which section a passage came from, so provenance now includes not just the document and byte offset but the named section. Exhaustive extraction is now the default — every ingest runs multiple extraction passes rather than one.

`72969cd` — fix /extract endpoint: register source + persist anchors (+25/-11): the API endpoint wasn't persisting anchors from the ingest step. Fixed.

### Approach: API and CLI Surface

`2cb9663` — paginated /subjects/all + targeted /contexts/lookup (+249/-0): the subjects endpoint was returning everything in one shot against a large database. Pagination added, plus a new `/contexts/lookup` for targeted queries.

`9cae9bc` — fix: /search now indexes object_iri too (+30/-0): search was only indexing subject IRIs and predicates. If you searched for an entity that appeared only in object position, you'd find nothing. This commit adds object IRI indexing to the search pipeline. Bug found by trying to look up an entity that was only ever referenced by another entity, never as a subject.

`9b20190` — GET /cluster/:subject — transitive same-as cluster (+102/-0): given a subject, returns all entities in the same-as cluster (transitive closure). This is the entity resolution surface — "Einstein" and "Albert Einstein" and "A. Einstein" collapse into one cluster.

`3fb4f45` — entity-merge endpoint + data-hygiene polish (+184/-0): the merge endpoint takes two entity IRIs and collapses one into the other, reassigning all statements. This is the operational side of entity resolution — same-as clustering identifies the problem, the merge endpoint fixes it.

`dd38222` — /statements/evidence: per-statement document linkage (+101/-0): given a statement ID, return its evidence documents. The frontend can now show "this fact is supported by these three documents" rather than just showing the fact.

`d106f8c` — agent-facing surface: status, schema, modality, extraction-level, policy (+570/-0): 570 lines of CLI surface for AI agents to query the state of the knowledge base. An AI agent can now ask donto what it knows about its own extraction pipeline before submitting content.

`d00d2a7` — M6-CLI: `donto ling {cldf,ud,unimorph,lift,eaf}` subcommands: the linguistic importers from the prior period got CLI subcommands. Accessible from the terminal rather than requiring programmatic invocation.

### Approach: DontoQL v2 and Queries

`2737828` — DontoQL v2: full PRD §11 clause surface + docs: the query language received the remaining clause types from the spec — POLICY ALLOWS, modality operators, extraction-level filters.

`e823683` — WITH evidence attaches evidence_link rows to results: DontoQL queries can now request evidence inline. One query, facts plus the documents that support them.

`61fc648` — unlock deferred DontoQL v2 evaluators + fix object_lit decode: the v2 evaluators were scaffolded but not wired into the query executor. This commit connects them. The object_lit decode bug was treating numeric literals as strings.

`535f90a` — fix(query): validate POLICY ALLOWS action up-front: policy validation was happening after query execution rather than before. Queries now fail fast at parse time if the action isn't permitted.

### Approach: Operations and Infrastructure

`fa7aa11` — genes.apexpots.com production deploy + dev box workflow: the downstream genes consumer of donto got a production deploy and documented dev workflow.

`b9c6667` — cloud run recovery script + lock gcloud account in CLAUDE.md: infrastructure tooling — the recovery script handles Cloud Run revision rollback. Locking the gcloud account in CLAUDE.md prevents accidentally operating on the wrong project.

`2471519` — nightly donto-analyze systemd timer (M5 schedule): the M5 analyzer runs on a schedule now rather than manually.

`3bd2ac7` — switch default extraction model to z-ai/glm-5 (+26/-17): GLM-5 becomes the default extraction model. This is the third provider switch in as many sprints across the stack.

### Results

- Content-addressed blob substrate with byte-precise evidence links (Stage A–D complete: measured by ROADMAP-NEXT completion markers)
- Line-level inverted index with three-tier search: exact, proximity, BM25
- `donto cite` subcommand operational
- Vocabulary-aware extraction with predicate alignment — predicate count growth rate measurably reduced (qualitative: the same document no longer mints duplicate predicates on re-extraction)
- Entity merge endpoint + same-as cluster endpoint
- `/statements/evidence` API: per-statement document linkage
- DontoQL v2 complete per PRD §11 (artifact: spec diff against implemented clauses)

### Pitfalls / What Broke

`b72615f` — close F-1: NOT NULL + fail-closed DEFAULT on `donto_document.policy_id`: a schema bug from early migrations. `policy_id` was nullable, meaning documents could be inserted without a policy — fail-open by default. The fix adds NOT NULL and a fail-closed default. The bug has an internal reference number (F-1), which suggests it was known and deferred.

The trace backward-fill (Stage D) is an approximation. It finds the most plausible source passage for historical facts, but for statements extracted before anchors were tracked, there's no anchor provenance — only byte ranges. Good enough for most use cases, not good enough for citing legal documents where section identity matters.

The GLM-5 model switch is the third default extraction model in three sprints. This is a sign that I'm still searching for the right extraction-quality/cost trade-off, not that I've found it.

### Next

- Stage D backward-fill validation: sample 100 backward-filled evidence links and check accuracy against the original source documents
- Predicate alignment coverage: measure what percentage of new extractions now match an existing predicate vs. minting a new one
- `donto cite` integration with dontopedia: clicking a citation in the UI should query `donto cite` for the full evidence chain

---

## dontopedia: Thirteen UX Commits and a Research Surface That Finally Reads Like a Document

**20 commits. 3 features, 2 fixes. Primary files: `page.tsx`, `page.module.css`, `activities.ts`.**

### Problem

The article pages had facts and references but no way to navigate them, no inline citation context, and no visual cue about what an inbound mention actually referenced. The references section was a flat dump. The `/context` pages showed metadata but not the actual source document body. The research sandbox was using Codex, which had reliability issues.

### Approach: References and Citations

`f9a67ac` — clickable references: unified /context/[...slug] page (+284/-7): every citation in an article now links to a unified `/context/[slug]` page showing the full provenance context. 284 lines covering slug routing, context page layout, and the reference link component. The `-7` is the old flat reference display getting removed.

`2254634` — fully built references: title, URL, byline, excerpt per source (+253/-25): the references section went from bare IRIs to structured cards — title, URL, byline, and a short excerpt from the source document. 253 lines in, 25 lines of the old flat display out.

`0e21d1c` — hover popovers for citations (+178/-0): citations in article text now show a popover on hover with the source title, byline, and excerpt. No page navigation required to see what a citation points to. 178 lines of popover component, positioning logic, and CSS.

`ab068f6` — per-fact 'source' badge when evidence reaches a document (+82/-2): facts in the article's structured data section now show a "source" badge when `evidence_link` returns a document. The badge links to the `/context` page for that document. Small component, significant signal — users can now see which facts have primary-source evidence versus which are inferred.

`e312a9f` — inbound mentions section on article pages (+207/-4): every article now shows a "mentioned by" section listing other dontopedia articles that reference the current entity. This closes the bidirectional reference graph — you can navigate from any entity to the things it references and the things that reference it.

### Approach: Article Navigation and Readability

`81c9ded` — scroll polish: smooth jumps, scroll-spy TOC, back-to-top, '/' shortcut (+189/-2): four navigation improvements in one commit. The TOC highlights the current section as you scroll. '/' focuses the section filter (same pattern as many search-heavy UIs). Back-to-top button appears after scrolling. 189 lines.

`552d821` — filter-sections input on article page (+93/-2): article pages can have dozens of predicate sections (birthdate, occupation, nationality, organizations, etc.). The filter input narrows visible sections by name. Immediate, client-side, no server round-trip.

`1a3e7fa` — filterable, 2-column compact references list (+218/-44): the references section switched to a 2-column compact layout with live filter. 218 lines in, 44 lines of old single-column layout out. The filter searches across title, URL, and excerpt.

`a98015f` — honest truncation indicator + at-a-glance topic teaser (+185/-1): long article sections get a truncation indicator — "showing 20 of 47 facts" rather than a hard cutoff with no indication that more exists. The topic teaser is a 2-sentence summary at the top of each section, generated from the top facts.

`f192741` — collapse maturity legend + include IRI in section filter (+39/-7): the maturity legend (which maps extraction confidence levels to colors) was taking up permanent space. It now collapses. The section filter now searches IRI identifiers too, so searching "wikidata" finds all sections backed by Wikidata IRIs.

`e8feff3` — render the full source document on /context pages (+32/-2): the context page was showing metadata about the source but not the source document body itself. This commit adds the full body render. 32 lines — the body was already available from the API; this is a display change.

### Approach: Performance and Infrastructure

`9b9aa05` — perf+ux: article page survives high-activity subjects (+478/-13): subjects with thousands of statements (genes, high-profile entities) were causing the article page to time out or render slowly. 478 lines of pagination, lazy loading, and request batching to keep the page responsive.

`a6544bb` — perf: article + articles pages survive the 39M-row genes DB (+37/-9): the genes database grew to 39 million rows. Queries that were fast at 1M rows became slow. 37 lines of index hints and query rewrites.

`cb9a101` — opencode-sandbox replaces Codex for dontopedia research (+166/-23): Codex was being used as the LLM backend for the dontopedia research agent. This commit replaces it with opencode-sandbox — a containerized OpenCode environment running in Docker.

`42f2f3e` — fix: allocate TTY + --format json for opencode docker runs (+12/-1): the Docker invocation of opencode was missing TTY allocation (`-t` flag) and wasn't requesting structured JSON output. Without `-t`, opencode behaved differently in a container than locally. `--format json` makes the output parseable rather than requiring regex on terminal output.

```bash
# Before: docker run opencode-sandbox opencode run "..."
# After: docker run -t opencode-sandbox opencode run --format json "..."
```

`e55ba2a` — fix: point `@donto/client` at `donto/packages/client-ts` (+183/-17): the dontopedia app was importing from the published npm package rather than the local workspace path. This meant any local changes to the client needed a publish cycle before dontopedia could use them. Workspace path reference fixed.

`3015193` — wip: debug app: try/queue pages, page/nav tweaks (+1,294/-291): large WIP commit covering the try/queue debug pages. 1,294 lines in, 291 out — the existing nav and page structure getting replaced by the new debug layout.

`07ff361` — chore: debug Try page defaults to GLM-5 (+3/-2): three lines changing the default model in the debug Try interface to GLM-5.

### Results

- Hover citation popovers: zero page navigations to read a citation context
- Inbound mentions: bidirectional reference graph now navigable from any entity page
- Filter-sections input: instant client-side filter across all predicate sections
- Article page survives 39M-row gene database: load time went from timeout to acceptable (qualitative; measured by the pages not failing under the genes workload)
- opencode-sandbox replacing Codex: Docker-based research agent with structured JSON output

### Pitfalls / What Broke

The WIP debug commit (`3015193`, +1,294/-291) is a single commit that mixes try/queue page work with nav and page structure changes. In a repo with CI, this would be the commit that breaks things — it's large enough that diff review is hard, and the +1,294/-291 shape suggests significant restructuring happening in a single shot. Not wrong, just messy archaeology later.

The `@donto/client` pointing at the wrong package (`e55ba2a`) is a monorepo hygiene failure. When you have local workspace packages, they should be referenced by workspace path from the start. Pointing at published npm means your local changes are silently ignored until you notice why nothing is updating — and the debugging path is: "why didn't my change to the client appear in the app?" which has many wrong answers before the right one.

### Next

- `donto cite` integration: clicking a citation badge should trigger a `donto cite` query and display the full evidence chain in a panel
- Performance profiling on article pages for entities with >10,000 statements: the current pagination helps but hasn't been tested at that scale
- opencode-sandbox: measure research quality vs. Codex; the switch was motivated by reliability, not quality metrics

---

## democracy: Deployed, Mail Fixed, State Scrapers Committed

**16 commits. 5 features, 2 fixes. Primary files: `init.sh`, `docker-compose.prod.yml`.**

### Problem

Most of the infrastructure for democracy landed in the previous sprint (initial commit: +9,829 lines). This period was about stabilizing what's in production and extending coverage. Specifically: two mail-sending bugs appeared in production, and the state-level upper house representation wasn't included in the lookup UI.

### Approach

`9c59060` — add Caddy reverse proxy with Let's Encrypt auto-TLS (+51/-4): the Caddy config went into `docker-compose.prod.yml`. Let's Encrypt handles certificate renewal automatically. The initial Caddy config used `tls internal` (self-signed), because the domain is behind Cloudflare in "Full" SSL mode — Cloudflare's proxy terminates TLS but still needs TLS on the origin side. Internal TLS satisfies Cloudflare without needing a public cert. Fixed in `3495afd` when this became clear.

`542e870` — fix send 500: captured-mail to writable /var/mail volume + log to stdout (+22/-3): the captured-mail container (used for local mail testing) was writing to a path that was read-only in the production Docker Compose configuration. Production and dev compose files had different volume mount configurations. The result was a silent 500 on `/send` with no useful error message.

`ea81f9b` — captured-mail: write to /tmp (always writable); drop unused volume (+3/-4): the fix to the fix. Writing to `/var/mail` (a volume mount) was replaced by writing to `/tmp` (always writable in any container context). The unnecessary volume mount was removed. 3 lines in, 4 out.

`35c91d4` — use browser UA for state parliament scrapers; run state rosters before boundary load (+18/-10): state parliament websites rate-limit or block requests that don't look like a browser. Browser User-Agent headers added. The scraper run order changed — rosters before boundaries — because the boundary loading step depends on chamber data that the roster scraper produces.

`1d7e156` — pre-scraped state rosters as committed JSON (+89/-6): rosters scraped and committed as JSON files in `data/rosters/`. The init pipeline can now populate the database without live network access. Resilient to parliamentary website downtime.

`b93a781` — init.Dockerfile: copy `data/rosters/` so init can import them (+1/-0): the init container's Dockerfile was missing the COPY instruction for the committed roster JSON. One line.

`cbf365e` — lookup: include state-wide upper houses; UI group reps by chamber, default-select federal only (+63/-32): the state upper houses (Legislative Councils) were missing from the representative lookup. The UI was also presenting all representatives in a flat list. The new UI groups representatives by chamber (House of Representatives, Senate, state lower house, state upper house) and defaults to federal-only selection, because most users writing "to my MP" mean their federal member.

`cc0e392` — define groupedReps memo; restore typecheck clean (+24/-1): the `groupedReps` computation was happening on every render rather than being memoized. TypeScript was complaining about the untyped structure.

### Results

- Production deployment on GCE with Caddy + auto-TLS: live (artifact: `docker-compose.prod.yml`, startup script)
- Mail sending: working after two post-deploy fix commits
- State upper houses included in lookup
- Pre-scraped rosters for all scraped jurisdictions committed as JSON
- UI chambers grouped and default-to-federal-only

### Pitfalls / What Broke

Mail took two commits to fix. The failure mode was instructive: a silent 500 with no useful error message from the container, root cause buried in volume mount configuration that differs between dev and prod Compose files. This is a gap in the test coverage — a `docker-compose.prod.yml` smoke test that actually sends a mail would have caught this before production.

South Australia is still missing. The SA parliament site is a Sitecore SPA — JavaScript-rendered, no scrapeable HTML. The current scrapers won't work. Playwright is the right tool but hasn't landed yet.

### Next

- SA scraper with Playwright: headless browser session to handle the Sitecore SPA
- Roster staleness detection: state parliamentary rosters change after elections; a cron job to flag when committed JSON may be stale
- Production mail testing: a smoke test against the production Compose config that actually sends a test mail

---

## lordajax.com: The Theme That Finally Shipped and the Projects Page That Finally Tells the Truth

**6 commits. Theme redesign + infrastructure.**

### Problem

The site had accumulated a theme that wasn't quite right, a projects page that listed a curated subset of work rather than the full picture, and no documented deployment path for Cloud Run. Every theme deploy also required a hard refresh because nginx was caching too aggressively.

### Approach

`ab3e0e3` — switch theme to jsonblog-generator-mono (+2,569/-282): the mono theme as the base layer. 2,569 lines of template, CSS, and handlebars changes.

`5e9ccf2` — redesign as warm-paper + serif prose + mono UI, v0.2.0 (+373/-242): warm paper background, serif body text, monospace UI chrome. The v0.2.0 tag in the commit message marks it as a deliberate design version. 373 new lines of theme customization on top of the mono base.

`7e5ccbf` — Dockerfile for Cloud Run / Apex deployments (+49/-0): 49 lines packaging the static site for container-based serving. The site can now be deployed to Cloud Run without manual build steps or SSH. Should have existed from the start.

`cba0d3a` — nginx: disable browser cache so theme/HTML deploys reflect immediately (+4/-0): 4 lines of nginx config to set `Cache-Control: no-store` for HTML responses. Without this, deploying a theme change results in "looks the same, did it work?" confusion while the browser serves cached HTML. Fast fix, slow to discover.

`ecf48fc` — rewrite projects page with full body of work (+168/-49): democracy, donto, dontopedia, alpha2, mobtranslate — the projects page now lists what's actually being built rather than a curated greatest-hits.

`48a60f0` — about: refresh media & coverage with web-search finds from 2019 to 2026 (+33/-49): the about page media section updated with more recent coverage and links.

### Results

- Theme redesigned to warm-paper + serif prose (v0.2.0) — visual artifact is the site itself
- Dockerfile committed: Cloud Run deployment is now repeatable from a single command
- nginx cache headers: theme changes visible immediately after deploy
- Projects page: accurate inventory of current work

### Pitfalls / What Broke

The mono theme switch (`ab3e0e3`, +2,569/-282) is immediately superseded by the warm-paper redesign (`5e9ccf2`, +373/-242). There's a 2,569-line commit in history whose entire purpose was to be a stepping stone to the next commit. Not ideal for future archaeological purposes.

The nginx cache fix is a reminder that browser cache headers should be in the initial nginx config, not a follow-up fix after your first theme deploy confuses you. The failure mode is "deploy worked, browser shows old version, spend 30 minutes questioning the CI pipeline before checking cache headers."

### Next

- Automated static build: `json-blog` generation in CI rather than manual
- Cloud Run deploy step wired into the Dockerfile

---

## alpha2: GPT-2 Mission Docs, Device Buffer Refactor

**4 commits. 1 feature.**

### Problem

alpha2 is the GPT-2 training project. The device buffer allocation was using a single pool for both long-lived model weights and short-lived temporary buffers, which created contention and fragmentation. The ML strategy needed documenting before the sprint diverged further.

### Approach

`3420a49` — feat: split temp device buffers into deviceTempPool slab (+57/-26): device temporary buffers get their own slab allocator (`deviceTempPool`) separate from the main weight pool. 57 lines in, 26 lines of the old mixed allocation out. Temp buffers have different lifetimes from model weights — they're allocated and freed within a forward/backward pass rather than persisting for the model's lifetime. Mixing them in the same pool causes fragmentation.

`3699522` — chore: bump chat domain to 6L/256d/8h and tune fleet:stable (+16/-16): the chat model configuration moved to 6 layers, 256-dimensional embeddings, 8 attention heads. `fleet:stable` tuning applied. 16 lines changed — configuration values rather than logic.

`75b2547` — docs: GPT-2 mission planning and 72h research notes (+1,734/-0): 1,734 lines of planning documents. The `GPT2_MISSION_DOSSIER.md`, `GPT2_PRD.md`, `GPT2_72H_RESEARCH_NOTES.md`, and `GPT2_ANYTHING_IS_POSSIBLE.md` files land. These are lab notebook entries rather than user-facing documentation — architecture decisions, experiment ideas, model scaling plans.

`910da5a` — chore: gitignore .DS_Store and untrack existing ones (+1/-0): the mandatory macOS file tracking cleanup commit that appears in every repo eventually.

### Results

- Device temp buffer isolation: separate slab allocator for temp allocations (measured by the presence of `deviceTempPool` and the 26 lines of mixed-allocation code removed)
- Model configuration: 6L/256d/8H (6 layers, 256 dimensions, 8 heads) — noted in `3699522`
- 1,734 lines of mission planning documentation committed

### Pitfalls / What Broke

The 72h research notes (`75b2547`) are 1,734 lines that presumably contain time-bound observations ("as of May 2026, model X does Y"). Research notes rot faster than code — they're accurate at the moment of writing and increasingly misleading over time. The file names (`GPT2_ANYTHING_IS_POSSIBLE.md`) suggest these are aspirational as much as analytical.

The device buffer change (`3420a49`, +57/-26) doesn't include benchmark results. The problem it solves — fragmentation and contention from mixing lifetimes in one pool — is real, but the actual improvement is unquantified. TODO: run before/after allocation benchmarks on a training step.

### Next

- Benchmark the deviceTempPool split: measure allocation fragmentation and peak memory usage before/after across a training step
- GPT-2 model scaling: the 6L/256d/8H configuration is noted; the next milestone is scaling to larger dims
- 72h research notes review: identify which observations are time-sensitive and which represent durable design decisions

---

## mobtranslate.com: The Single-Commit Sprint

**1 commit.**

### Problem

mobtranslate.com kept the streak alive with a single commit. Categorized as "low-signal" in the activity summary, which is honest.

### Approach

One commit. The specifics aren't in the issue summary and the commit hash isn't provided. Low-signal activity is still activity — the repo is live and occasionally touched.

### Results

- 1 commit across the period
- Repo remains active

### Pitfalls / What Broke

No details on what broke or was fixed.

### Next

- Figure out what that single commit was

---

## What's Next

- **`donto cite` integrated into dontopedia**: clicking a citation badge should query the evidence chain and display it inline — closes the provenance loop from UI click to byte-offset in source document
- **Stage D backward-fill validation**: sample backward-filled evidence links and audit accuracy against source documents; the backward-fill is an approximation and needs measurement
- **SA scraper with Playwright**: the only Australian jurisdiction missing from democracy; needs a headless browser for the Sitecore SPA
- **Predicate alignment coverage measurement**: what percentage of new extractions now match an existing predicate vs. minting fresh ones — without this number, vocabulary-aware extraction is untested progress
- **democracy production mail smoke test**: a test against `docker-compose.prod.yml` that actually sends a mail would have caught both production mail bugs before deploy
- **alpha2 allocation benchmarks**: the `deviceTempPool` split is unquantified; benchmark allocation fragmentation and peak memory before/after
- **opencode-sandbox quality metrics for dontopedia**: the switch from Codex was motivated by reliability, not quality measurement; measure research quality post-switch

---

## Links & Resources

### Projects

- [donto](https://github.com/thomasdavis/donto) — Paraconsistent knowledge base: content-addressed blob substrate, source-provenance backward-fill, vocabulary-aware extraction, DontoQL v2, entity merge, `donto cite`
- [dontopedia](https://github.com/thomasdavis/dontopedia) — Open paraconsistent wiki: hover citation popovers, full source rendering, inbound mentions, filterable references, scroll-spy TOC
- [democracy](https://github.com/australia/democracy) — Write to your Australian federal and state MPs and Senators in a single message; GCE + Caddy + Let's Encrypt production deployment
- [alpha2](https://github.com/thomasdavis/alpha2) — GPT-2 training project: 6L/256d/8H configuration, deviceTempPool slab, mission planning docs
- [lordajax.com](https://github.com/thomasdavis/lordajax.com) — This site; warm-paper theme v0.2.0, Cloud Run Dockerfile, accurate projects page

### Tools & Services

- [Caddy](https://caddyserver.com/) — Reverse proxy with automatic Let's Encrypt TLS; `tls internal` mode for Cloudflare Full SSL compatibility
- [OpenCode](https://opencode.ai/) — AI coding agent invoked as a subprocess with `--format json` and TTY allocation; replaced Codex in the dontopedia research sandbox
- [Z.AI GLM-5](https://z.ai/) — Default extraction model as of this sprint; third provider default in three sprints
- [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs) — Batch compute for scheduled donto-analyze runs; run, finish, exit semantics

### Inspiration

- **Provenance at the byte level**: the difference between "this fact came from Document X" and "this fact came from bytes 4,231–4,287 of Document X at content hash `sha256:abc`" is the difference between a citation and evidence. Building the latter takes more infrastructure (blobs, inverted indexes, trace backward-fill) but produces something you can actually verify. That's worth the complexity.
- **Bidirectional reference graphs in wikis**: adding inbound mentions to dontopedia article pages turns a directed citation graph into a navigable web. Wikipedia has this (it's "What links here"). It's usually an afterthought in knowledge bases and almost always the right first navigation feature once you have enough articles to benefit from it.
- **The TTY allocation lesson**: Docker containers running interactive CLI tools need `-t` to get a TTY. Without it, the tool behaves differently — buffering output differently, changing color codes, sometimes refusing to run. The fix is one flag; the diagnosis is "why does this work locally but produce garbage in Docker?"
