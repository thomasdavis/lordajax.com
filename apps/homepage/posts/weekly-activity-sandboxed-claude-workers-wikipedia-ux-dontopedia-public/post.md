# Sandboxed Claude Workers, Wikipedia-Style UX, and the Week Dontopedia Went Public

*Running AI extraction agents in Docker cages, building a Wikipedia interface for a wiki that argues with itself, and teaching an Aboriginal language OS to clone git repos — 76 commits that are all, somehow, the same question in different costumes.*

There's a through-line in this fortnight I didn't explicitly plan: every project is building infrastructure for *machines that hold opinions*. dontopedia is a paraconsistent wiki where every fact carries a source, a timestamp, and a confidence level — contradiction is a feature, not a bug, and the extraction worker now pulls 1000+ facts per session because I finally removed the arbitrary cap that was silently truncating research. The Claude sandbox work is about running an AI agent autonomously inside a Docker container — eight commits iterating on credential mounting, Linux capability flags, and `su-exec` vs `su` argv semantics — because the worker needs to research topics and write what it finds directly into donto without human babysitting. kukuos completed the git clone stack in Kuku Yalanji: DNS, HTTP, SHA1, zlib INFLATE (all three modes), and a git clone tool — all written in an Aboriginal Australian language running on an i386 kernel with a hard rule that nothing external can be borrowed. donto hardened the underlying PostgreSQL extension with test coverage and server fixes. jsonresume.org migrated its entire docs infrastructure in one 45,979-line commit. Across 5 repos and 76 commits: the theme is building the thing itself rather than wrapping someone else's thing, and then making it publicly accessible before it's finished.

## Why You Should Care

- **dontopedia is now fully public**: auth was ripped out entirely in `281a2d9` — no login, no gate, the wiki is open; the article view now has Wikipedia-style layout, sections, infobox, knowledge graph, right-click menus, and floating action bars
- **Claude runs sandboxed in Docker as an extraction worker**: ~8 commits iterating through root → su → su-exec → cap-drop ALL → re-add DAC_OVERRIDE; the worker can research and write facts autonomously within container limits
- **Extraction cap removed**: the prompt now explicitly says "extract 1000+ per session" — a previously implicit ceiling was silently truncating long research sessions, and `48370e2` caught it: 946 facts were being dropped on one article
- **Document upload landed**: images and PDFs are now first-class donto sources (`6d39b12`, +1185/-6); every source type the worker encounters can be attached to facts
- **kukuos completed the full git clone stack**: DNS (RFC 1035), HTTP GET, SHA1 (RFC 3174), zlib INFLATE (stored + fixed + dynamic Huffman all pass), and git clone — 2,200+ lines of Kuku Yalanji across 5 protocol commits
- **Table component from zero**: sortable, filterable, paginated, selectable, resizable — `55d01a1`, +1197/-223 — the core data-viewing primitive for the whole dontopedia UI

---

## dontopedia: Building the Wikipedia Interface for a Wiki That Argues With Itself

**51 commits. `page.tsx` alone: 15 commits, +1090/-656 lines.**

### Problem

dontopedia started as a demo surface for donto — the paraconsistent knowledge base underneath. "Every claim has a source, a time, and an opinion." But the UI was barebones: a list of statements, no structure, no navigation, no real way to explore a knowledge base with thousands of facts. Several problems existed simultaneously:

The **article page** was basic — no Wikipedia-style sections, no infobox, no timeline, no graph view. A fact about a person's birth date looked the same as a fact about their published work. No semantic hierarchy.

The **extraction worker** had silent caps: the prompt capped output at some implicit number, and `48370e2` — "bump history limit 500→5000 (946 facts were being truncated)" — revealed that an entire article's worth of facts were being dropped before they reached the database. The worker was also going through OpenAI's structured output mode, which rejects `z.string().url()` (the Zod schema for source URLs) because OpenAI doesn't support `format: uri` in JSON Schema.

The **Claude sandbox** was completely broken. Running Claude Code as an autonomous worker inside Docker — mounting credentials, dropping privileges, and passing flags through `su` — hit at least six different blockers across eight commits.

**Auth** was gating everything. dontopedia is supposed to be an open wiki. Having a login wall was making that untrue.

### Approach: The Article View

`page.tsx` in `apps/web/src/app/article/[slug]/` became the most-edited file in the repo (15 commits). The progression was additive:

`b8aaf2b` — "Wikipedia-style layout + per-entity timeline" (+714/-121): the first full-layout commit. Sections extracted from donto predicates, an infobox, a timeline of events grouped chronologically.

`f2089bc` — "full Wikipedia layout + Base UI Tabs/Dialog" (+604/-474): the large deletion count (474) is the old custom tab and dialog implementation being replaced with Base UI primitives — headless components that are accessible by default without building that from scratch.

`4398f3a` — "article: expose all of donto's power" (+958/-241): the kitchen sink. Every query capability in donto surfaced through the article view — related entities, confidence bands, contradiction flags, context annotations.

`3c64e5f` — "richer Wikipedia-style UX + sourced citations" (+286/-102): citation numbers in the article text now link to their source URLs. This is the thing that makes dontopedia feel like Wikipedia rather than a database dump.

`a82cc10` — "nice URL slugs + clickable source links + source URL storage" (+127/-18): the article URL is now `/article/thomas-davis` rather than `/article/did:donto:abc123:...`. Source URLs are stored on facts and rendered as clickable links in the References section (`8ab97cd`).

`852cf06` — "sort sections by semantic importance (Wikipedia order)" (+37/-1): sections now sort by a hardcoded semantic hierarchy (biography before bibliography, career before personal life) instead of by insertion order or predicate alphabetical sort.

`2e1afd2` — "infobox: max 3 values per predicate, cap 30 rows" (+16/-6): without this, an infobox for a prolific writer has 47 publishers listed. The cap makes it scannable. `aa5bde9` added birth/family/school/career/social predicates to the infobox schema (+11/-3).

`85990da` — "prettifyLabel: split camelCase" (+13/-5): `heldOffice` → `Held Office`. Small, but without it every predicate name in the infobox looks like code variable names.

### Approach: Knowledge Graph and Table Component

`7e20caf` — "Graph component + Articles index + Knowledge graph view" (+1182/-0): one commit, three things. A D3 force-directed graph of all entities and their relationships. An index page listing all articles in the knowledge base. A dedicated "knowledge graph" view that lets you navigate the entity-relationship structure visually. 1182 lines from zero.

`55d01a1` — "ui: Table component — sortable, filterable, paginated, selectable, resizable" (+1197/-223): the core data primitive for the whole app. The table renders lists of statements, search results, and article indices. Sortable by any column, filterable with text input, paginated for large result sets, individual row selection, and resizable columns. This is the kind of component you write once and use everywhere — the `-223` deletion count shows it replaced simpler table implementations that had been scattered across views.

`d93034f` — "article: statement detail drawer" (+585/-1): select any statement in the article and open a drawer with the full donto representation: source, confidence, bitemporal timestamps, related statements, contradiction flags. This is the "all-donto-power surface" — everything the database knows about that specific claim, not just the display-friendly version.

`61cbd08` — "articles: split into server page + client table" (+168/-55): the articles index was a Server Component trying to render a client-side interactive table, which hits the RSC restriction on rendering functions as props. Split into a server page that fetches data and a client component that handles interactivity.

### Approach: The Claude Sandbox

Eight commits iterating toward a working Docker sandbox for running Claude Code as an autonomous research agent. In order:

`1a03393` — "run as root": the first attempt. Root can read everything — `~/.claude.json` is at `/root/.claude.json` and docker containers default to root. Works, but root running arbitrary AI agent code is the least-defended configuration.

`56d9f2c` — "entrypoint copies creds then drops to claude user": copy `/root/.claude.json` to `/home/claude/.claude.json` at startup, then drop to the `claude` user with `su`.

`9c1aa89` — "use su-exec (preserves argv cleanly)": `su claude -- claude ...` mangles the argument list in ways that break Claude's flag parsing. `su-exec` is a 200-line binary that does `setuid + setgid + exec` — no shell, no argv mangling, the argument list reaches Claude exactly as written.

`0249a33` — "entrypoint copies creds to writable $HOME": `$HOME` wasn't writable after the credential copy step.

`8130664` — "mount /root/.claude.json too (claude keeps OAuth there)": Claude keeps OAuth tokens in a separate location from the API key config.

`d783c77` — "chmod 0777 /home/claude (cap-drop ALL removes DAC_OVERRIDE)": `--cap-drop ALL` removes `DAC_OVERRIDE` — the capability that lets root ignore file permission checks. Without `DAC_OVERRIDE`, even root can't read a file with mode 600 owned by another user. Setting the home directory to 0777 is a workaround that works inside the container's isolation boundary.

`f4dae6b` — "--permission-mode bypassPermissions + WebSearch allowlist": the Claude Code flag that disables interactive permission prompts (necessary for autonomous operation) plus an explicit MCP tool allowlist.

`6f774e2` — "cap-add CHOWN/DAC_OVERRIDE/SETUID/SETGID": the final approach — drop all capabilities, then re-add exactly the ones the credential-copy and privilege-drop flow requires. Defense-in-depth: the container can't do most Linux privileged operations, only the specific ones the entrypoint needs.

The honest assessment: `bypassPermissions` inside a Docker container with limited network egress and a specific capability set is sandboxed-with-limits, not zero-trust. The threat model is preventing the worker from accessing host credentials or doing things outside the research task — not preventing a sophisticated escape. `eb83e2e` notes that Reddit MCP works locally but hits 403 in the datacenter (the hosting provider's IP block is flagged by Reddit), so the datacenter worker falls back to other research sources.

### Approach: Extraction Worker Overhaul

`c168ec1` — "extraction: direct-parse Claude's structured block (skip OpenAI)" (+198/-1): the extraction pipeline now talks directly to Claude and parses its output, bypassing OpenAI's structured output mode. The reason: `2549b4b` — "drop z.string().url() (OpenAI rejects format: uri)" — OpenAI's structured output rejects Zod schemas with URL format validation. Source URLs on facts were either broken or required removing the type constraint.

`e42fbac` — "no fact limit — extract 1000+ per session if sources support it" (+14/-6): the prompt previously had an implicit ceiling. In practice, sessions with long research transcripts were hitting it. Removed. The follow-up `4492979` — "extract EVERY thing — examples are just examples, not limits" — tightened the wording after finding that Claude was treating the number of examples in the prompt (which happened to be 5 or 10) as the implied extraction target.

`8827349` — "upgrade research prompt — Dontopedia-aware + structured output" (+76/-8): the worker now understands dontopedia's own ontology when extracting. It knows which predicates exist, how subjects should be identified, what counts as a valid source. This reduces the normalizer's job.

`546d6fe` — "normaliser prompt — handle Claude's loose output" (+61/-28): Claude's direct output isn't always perfectly schema-compliant — predicate names vary, confidence values come out as strings instead of floats, etc. The normalizer pass reformats before writing to donto.

`4808b81` — "prettifyContext: preserve UUID tails (research/hypothesis/etc contexts)" (+10/-1): context IRIs contain semantic meaning in their UUID suffix (the context type — research, hypothesis, observation). The prettifier was stripping this, making context annotations unreadable.

`fd31d55` — "worker prompt: require a name fact per minted subject" (+4/-0): every entity created by the worker must have at least one name fact. Without this requirement, the worker was creating anonymous entities — subject IRIs with facts but no human-readable identifier, which are invisible in any UI that relies on labels.

`561d1d0` — "worker: harden assertFacts — drop malformed facts, batch-then-one-by-one" (+?): the fact-writing step now validates each fact before writing, drops malformed entries instead of failing the entire batch, and falls back to one-by-one insertion if the batch fails. This means a single bad fact doesn't abort the entire extraction session.

### Approach: SSE, Document Upload, and Auth

The research worker streams its progress back to the browser via Server-Sent Events. Getting SSE to work through the full stack — Next.js → Caddy reverse proxy → browser — required work at every layer:

`fe491dd` — "web: SSE proxy route — runtime=nodejs + anti-buffering headers": Next.js edge runtime buffers SSE responses by default. Forcing `runtime=nodejs` and adding `X-Content-Type-Options: nosniff` and `Cache-Control: no-cache` prevents buffering.

`8b4c459` — "Caddy path match w/ flush_interval -1 + Next proxy headers": Caddy buffers by default too. `flush_interval -1` tells Caddy to flush immediately on every write. The path matcher routes SSE requests differently from regular API calls.

`fda273e` — "agent-runner: hijack SSE reply + flushHeaders + keepalive": explicit `flushHeaders()` call after the SSE headers are sent, plus a keepalive ping every N seconds. Without keepalive, load balancers and proxies that haven't seen traffic in 30-60 seconds close the connection.

`6d39b12` — "document upload: images/PDFs as first-class donto sources" (+1185/-6): attaching a PDF as a source for facts. The worker can now receive a document, extract facts from it, and cite the document as the source. 1185 lines is the upload handling, preview, and integration with the donto source schema.

`281a2d9` — "rip auth entirely — Dontopedia is fully public": single commit. All authentication middleware removed. The wiki is public. Every article, every statement, every source.

`8c2e742` — "sandbox: add reddit-mcp-buddy MCP server" (+20/-2): the research worker can use Reddit as a source when running locally. The MCP server connects to Reddit's API and retrieves relevant threads for research topics.

`d3a04a0` — "worker: hoist @temporalio/* + add workflow as direct dep": Temporal is the workflow orchestration layer for research sessions — each session is a Temporal workflow that can be paused, resumed, and replayed. Hoisting the packages fixes the monorepo resolution.

### Results

- Article view: from bare statement list to Wikipedia-style layout with infobox, sections, timeline, graph, citation links, right-click menus, and floating action bars (measured: 15 commits to `page.tsx`, +1090/-656 net lines)
- Knowledge graph view: +1182 lines, zero to shipped
- Table component: +1197 lines, covers sortable/filterable/paginated/selectable/resizable
- Extraction cap removed: previously capped at an implicit number; `48370e2` found 946 facts being dropped from a single article — that's now fixed
- Auth removed: dontopedia publicly accessible as of `281a2d9`
- Document upload: +1185 lines of new capability

### Pitfalls / What Broke

The sandbox threat model is worth stating clearly: `bypassPermissions` + Docker + specific capability grants is sandboxed-with-limits. It's not an air-gap. The worker has network access, can write to its mounted volumes, and runs Claude with permission bypass enabled. The container boundary and the capability restrictions are the defense. Reddit 403 in production is a real research gap.

The SSE implementation is the most fragile part of the stack. Four commits across three layers (Next.js, Caddy, application keepalive) — any change to the proxy configuration or Next.js runtime will likely break at least one layer silently. SSE through a reverse proxy is always like this.

`48370e2` — "bump history limit 500→5000" — is evidence that a limit was silently truncating data for some duration before someone noticed. The 946 facts that were dropped were invisible: no error, no warning, just missing data. Limits like this should probably be exposed in monitoring rather than discovered by accident.

### Next

- Test the document upload pipeline against real research PDFs
- Reddit MCP in production: either work around the 403 (different egress IP, proxy layer) or document it as a dev-only capability
- Explore the knowledge graph view against real data to find which entity clusters are most interesting to navigate

---

## donto: Server Fixes, CLI Polish, and 2,000 Lines of Tests

**8 commits. Top files: `Cargo.lock`, `main.rs`, `Cargo.toml`, `Dockerfile`.**

### Problem

donto is the PostgreSQL extension underlying dontopedia — the Rust/pgrx layer that handles paraconsistent fact storage, bitemporal versioning, and subject identity. Three concrete problems this period:

1. `dontosrv/browse` was returning stale data — not applying the bitemporal filter for current facts
2. The `--bind` address for `dontosrv` was hardcoded and didn't read the `DONTO_BIND` environment variable, breaking Docker deployments
3. Test coverage was thin enough that CI passing didn't tell you much about correctness

### Approach

`e670c9b` — "dontosrv: read --bind from DONTO_BIND env" (+1/-1): one line. The server previously hardcoded the bind address. `DONTO_BIND` was documented but silently ignored. One line to read the env var, one line deleted from the hardcoded block.

`5a2c8b1` — "dontosrv/browse: predicates+contexts use upper(tx_time) is null" (+2/-2): the bitemporal fix. donto stores facts with transaction-time ranges — `lower(tx_time)` for when the fact was asserted, `upper(tx_time)` for when it was retracted. `upper(tx_time) IS NULL` means "this fact is current — it has no end time." The browse endpoint was querying without this filter, returning all historical states. Two lines changed, but the endpoint was returning incorrect data for the entire history of the project.

`db07d4f` — "dontosrv/search: match by subject IRI and any literal, not just label" (+50/-7): search was matching only against the `label` predicate — entity names. Now matches against subject IRIs and any literal value, which means searching for "Brisbane" finds entities that have Brisbane as a fact value, not just entities named Brisbane. The +50/-7 shape suggests a meaningful query rewrite, not a flag toggle.

`06e3ee5` — "donto-client: add ./react subpath export" (+2/-1): the client library now exposes a `/react` subpath for React-specific hooks and utilities. Without this, dontopedia had to do runtime detection or import the entire client. The subpath makes the dependency explicit.

For CLI: `f4b43f7` — "donto CLI: rich help, man page, shell completions, reference doc" (+439/-15). The CLI now has formatted help text, a man page generated from the command definitions, and completion scripts for bash, zsh, and fish. The reference doc auto-generates from the same source.

For tests: `f3e3681` — "Deepen test coverage; wire sccache into CI" (+1112/-4) and `f14ed04` — "More tests; sccache in pgrx container; CLAUDE.md note" (+1062/-1). Combined: ~2,174 lines of new test code. sccache (Mozilla's Rust compilation cache) was wired into both the outer CI job and the pgrx Docker container — they need separate configuration because they run in different environments with different cache paths.

`3cdb8da` — "CI + lint cleanup; fix pgrx extension end-to-end in Docker" (+4450/-1477): the largest single commit in this period for donto. pgrx compiles against a full Postgres installation inside Docker — the container needs Postgres headers, the pgrx framework, and Rust all coordinated. This was broken. The +4450/-1477 shape means the fix was infrastructure replacement, not a targeted patch.

### Results

- `dontosrv/browse` bitemporal filter fixed — was returning wrong data, now correctly returns only current facts
- `dontosrv/search` now searches by subject IRI and any literal value (measured: +50 lines of query expansion)
- `DONTO_BIND` environment variable now respected (measured: git diff on the bind address line)
- CLI ships with man page and shell completions for three shells (+439 lines)
- ~2,174 lines of new test code (measured: sum of the two test expansion commits)
- pgrx extension end-to-end build and test passing in Docker (per commit message)

### Pitfalls / What Broke

The `f14ed04` CLAUDE.md note is a tell: when you document a configuration in the same commit you add it, the configuration is fragile. sccache paths in the pgrx container are environment-coupled — if the container image is updated, the cache path silently breaks and CI goes back to full rebuilds with no error message, no failure.

The search expansion (`db07d4f`) is a broad change: matching against any literal means searching for common values ("true", "1", "null") could return almost everything. Whether that's the right trade-off depends on what actual search queries look like in production.

The bitemporal filter bug (`upper(tx_time) IS NULL`) was presumably live for some time before this fix. The browse endpoint was a common code path. Any dontopedia feature built on top of it was showing stale or incorrect data. Duration of the bug: unknown, but the fix is in the same week as heavy dontopedia UI work, which suggests it was discovered during development of the article view.

### Next

- Measure actual CI time improvement from sccache — wired but the before/after timing is undocumented
- Audit other endpoints for the same missing bitemporal filter pattern
- Distributable CLI binaries for target platforms — man page and completions are there, installation path is not

---

## kukuos: A Kuku Yalanji OS That Can Now Clone Git Repositories

**12 commits. ~3,200 lines across protocol implementations.**

### Problem

kukuos is an i386 operating system and stack-language compiler written entirely in Kuku Yalanji — an Aboriginal Australian language from Far North Queensland. The project's constraint is absolute (`5b3df46` — "CLAUDE.md: no shortcuts — every artefact written in Kuku"): every component must be self-written in the language.

This period's goal: the git clone stack. That dependency tree is DNS → HTTP → SHA1 → zlib INFLATE → git object format → git clone. Each layer had to be implemented in Kuku before the next was possible.

There was also a regression to make: `03e5e09` — "Remove paper.kuku and PDF: Kuku-emitted LaTeX into tectonic was a shortcut" (+9/-254). The project had a Kuku program that generated LaTeX source, compiled by tectonic. The CLAUDE.md rule says tectonic is an external tool — that makes using it a shortcut. PDF generation was removed to enforce the constraint.

### Approach: The Protocol Stack in Dependency Order

`91bb969` — `binal.kuku`: DNS A-record resolver, RFC 1035, UDP, resolving against 8.8.8.8. 270 lines. The first rung. DNS is what converts `github.com` into an IP address the TCP stack can connect to.

`f9ebc61` — `bayan-mana.kuku`: HTTP GET client, described in the commit as "rung 1 of the git-clone stack." 266 lines. The GET client wraps the DNS resolver and the TCP layer. Everything above this layer uses it.

`2df9f1e` — SHA1 + static file server: SHA1 (RFC 3174 test vectors, for git object integrity verification) and `bayan-bana.kuku` (a static file server). 603 lines total. SHA1 is how git verifies that a downloaded object is what was requested.

`246e3ab` + `d5206c0` — `bana-yanyil.kuku`: zlib INFLATE in two commits:
- `246e3ab`: 716 lines. "stored blocks work, Huffman WIP." The stored block mode (deflate with no compression, just block framing) passes. Fixed and dynamic Huffman modes are in progress.
- `d5206c0`: +7/-1. "full zlib INFLATE in Kuku — stored, fixed, dynamic all green." Seven lines to complete two Huffman decode modes and pass all RFC test vectors.

`24454ba` — `bayan-binalku.kuku`: git clone. 675 lines. "git clone in Kuku (stored-only zlib, loose objects, walker)." Resolves the remote URL via DNS, fetches via HTTP, verifies with SHA1, inflates with INFLATE, parses loose object format, walks the object tree.

`27b19ae` — HTTP server extended: new `bama-wari` socketcall primitive (+200/-0). The server gained a socket-level primitive that the HTTP stack builds on. `7cd44b2` — "bayan-daya: manpage-style homepage" (+164/-23): the HTTP server's root page now lists every available Kuku command in manpage format.

`d719b7e` — README: "how-it-works sections" (+158/-0): the README now has sections explaining the compiler pipeline, the kernel architecture, the `--bama` flag, the autograd system, and the Transformer implementation. This is documentation that treats the project as a real system to understand, not just a novelty.

`910365a` — "shell: strip English from banner" (+4/-6): the boot sequence no longer contains English. Every layer of the OS speaks Kuku.

### The No-Shortcuts Rule in Practice

The `03e5e09` removal is the most interesting commit in the kukuos section. `paper.kuku` was a Kuku program that generated LaTeX source. The generated LaTeX was then compiled by tectonic. The CLAUDE.md rule (`5b3df46`) draws the line: Kuku generating input for an external tool is a shortcut. The PDF capability is gone until it can be implemented directly in Kuku — which means implementing a PDF writer in Kuku, including the binary format, compression, font embedding, and layout engine. That's a significant undertaking.

The distinction matters philosophically: the project is about building a complete computing environment in a language. Delegating the final compilation step to an external tool means the environment is incomplete. The rule enforces completeness at the cost of capability.

### Results

- Full zlib INFLATE in Kuku: stored, fixed Huffman, and dynamic Huffman all pass test vectors (per commit message "all green")
- git clone working for stored-only zlib, loose objects (measured: 675-line implementation per commit)
- DNS A-record resolution via UDP to 8.8.8.8, RFC 1035 compliant (per commit)
- HTTP GET client + static file server both implemented in Kuku
- Shell banner entirely in Kuku — no English at any layer
- PDF generation removed (deliberate regression to enforce the no-shortcuts rule)

### Pitfalls / What Broke

The git clone has a stated limitation: "stored-only zlib." Pack files with delta compression — the dominant format in any non-trivial real-world repository — don't work. The implementation can clone a repository that was committed with `--no-compression`, but that's not how GitHub repos work.

The zlib story: `246e3ab` lands 716 lines with Huffman "WIP," then `d5206c0` lands 7 lines and the tests go green. That 7-line diff either fixed a single off-by-one in the bit-stream reader or patched something more fundamental. Without reading the diff, it's impossible to say whether the Huffman decoder is correct in general or correct for the specific test vectors.

PDF generation is gone. The OS lost a capability to gain integrity. If you need to produce PDFs from kukuos data, you're back to square one until the native PDF writer is implemented.

### Next

- Delta compression: INFLATE for all deflate variants is complete; git pack-file delta decoding is the next protocol layer for real-world repo cloning
- PDF writer in Kuku: the no-shortcuts rule killed tectonic; recovering PDF capability means implementing the binary format natively
- Wire `bayan-binalku.kuku` (git clone) with `bayan-bana.kuku` (static file server) for a self-hosting scenario: the OS serving its own source and cloning from itself

---

## jsonresume.org: Docs Migration and Three CI Fixes

**4 commits: 1 feature, 2 fixes, 1 CI change. +45,979/-24,898 lines.**

### Problem

The jsonresume.org documentation was running on Nextra. The move to Fumadocs was the primary change this period — a full framework swap for the docs site. Alongside that: two CI workflow bugs that were blocking clean deploys.

### Approach

`88e4cd8` — "feat(docs): replace Nextra with Docwright + Fumadocs, deploy to GH Pages" (+45,979/-24,898): the largest commit in the entire two-week period by line count. Most of that line count is generated content, MDX restructuring, and the Fumadocs configuration — not application logic. Nextra and Fumadocs are both Next.js-based documentation frameworks; Fumadocs has stronger search, better navigation primitives, and doesn't require next.js pages-router patterns.

`8d0d733` — "ci(docs): add standalone deploy workflow (no Docwright dependency)" (+70/-0): the original deploy workflow depended on Docwright running first. A standalone workflow means the docs site can deploy manually or in response to content changes without triggering the full Docwright pipeline.

`8ed0a67` — "fix(docs): fix workflow YAML — remove special chars and secrets-in-if" (+8/-17): GitHub Actions specifically flags using secrets in `if:` conditions because the secret value can appear in log output. The fix was removing the pattern. The special character issue was a YAML parsing problem — probably an unquoted string with a colon.

`c9ed5d3` — "fix(ci): use packageManager pnpm version from package.json" (+0/-1): one line deleted. The workflow pinned pnpm at an explicit version. When `package.json` declared a different version, the build used the wrong package manager version. Removing the pin lets the workflow inherit from the project declaration.

### Results

- Documentation migrated from Nextra to Fumadocs and deploying to GH Pages (measured: +45,979/-24,898 lines in one commit — the line count is real but mostly auto-generated content)
- Standalone deploy workflow: docs can deploy without the Docwright dependency
- pnpm version pin removed: one fewer source of version drift between CI and local development

### Pitfalls / What Broke

A 45,979-line commit is impossible to review properly. Content errors, broken cross-references, or missing pages in the migration won't show up in code review — they'll surface when users hit a 404 or find incorrect documentation. The commit message confirms the framework swap but says nothing about content fidelity.

The secrets-in-if fix (`8ed0a67`) is a security pattern fix, not just a bug fix. The original workflow had a genuine security issue: secret values in conditional expressions can leak to CI logs. The fix is correct but it implies the original workflow was violating GitHub's stated security recommendations, potentially for some time.

### Next

- Verify the Fumadocs deploy against the live GH Pages site — 45,979 lines of content restructuring is the kind of change that silently 404s old URLs that other sites may link to
- Check other CI workflows in the jsonresume monorepo for the same secrets-in-if pattern

---

## davis-native-title-sources: One Commit

**1 commit. Minimal activity.**

One commit this period. No detail in the activity data — likely a configuration or content update. The repo name suggests it's a data repository related to Australian Aboriginal native title land claims, which is thematically connected to the kukuos work (also focused on an Aboriginal Australian language). Whether these two repos are intentionally related or just share a domain interest isn't visible from the commit metadata.

### Next

- If native title sources and kukuos share research interest or data dependencies, documenting that relationship would clarify the project landscape

---

## What's Next

- **dontopedia Reddit MCP in production**: the research worker can't hit Reddit from the datacenter (403 from the hosting provider's IP). Either resolve the IP issue, implement a proxy layer, or document Reddit as dev-only capability and adjust the worker's research strategy accordingly
- **dontopedia document upload QA**: `6d39b12` is +1185 lines of new functionality; needs testing against real PDFs and images in a production-like research session before it can be considered reliable
- **kukuos delta compression**: INFLATE is complete across all deflate modes; git pack-file delta decoding is the specific piece that unlocks real-world repository cloning
- **kukuos self-hosting**: `bayan-binalku.kuku` (git clone) + `bayan-bana.kuku` (static file server) exist; wire them together so the OS can serve and clone its own source
- **donto sccache measurement**: the before/after CI timing is undocumented; that number determines whether the configuration complexity is load-bearing
- **donto bitemporal audit**: the `upper(tx_time) IS NULL` bug in the browse endpoint could affect other endpoints; worth a pass over the query layer to find matching patterns
- **jsonresume Fumadocs deploy verification**: 45,979 lines of content restructuring — verify the live GH Pages site for broken URLs and missing content

---

## Links & Resources

### Projects
- [dontopedia](https://github.com/thomasdavis/dontopedia) — Paraconsistent wiki built on donto: every claim has a source, a time, and an opinion
- [donto](https://github.com/thomasdavis/donto) — PostgreSQL extension for paraconsistent knowledge storage, Rust/pgrx
- [kukuos](https://github.com/australia/kukuos) — i386 OS and stack-language compiler written entirely in Kuku Yalanji, an Aboriginal Australian language from Far North Queensland
- [jsonresume.org](https://github.com/jsonresume/jsonresume.org) — JSON Resume mono repo: homepage, registry, job search, documentation

### Tools & Services
- [pgrx](https://github.com/pgcentralfoundation/pgrx) — Framework for writing PostgreSQL extensions in Rust; handles the glue between Rust and the Postgres extension ABI
- [su-exec](https://github.com/ncopa/su-exec) — Minimal setuid+setgid+exec for containers; avoids the argv mangling that `su` introduces when used in Docker entrypoints
- [Base UI](https://base-ui.com/) — Headless UI primitives (used for Tabs and Dialog in dontopedia's article view)
- [Fumadocs](https://fumadocs.vercel.app/) — Next.js documentation framework (the Nextra replacement in jsonresume.org)
- [Temporal](https://temporal.io/) — Workflow orchestration used for dontopedia research sessions — each extraction session is a Temporal workflow
- [sccache](https://github.com/mozilla/sccache) — Mozilla's shared compilation cache for Rust; reduces CI rebuild times by caching compiled artifacts across runs
- [reddit-mcp-buddy](https://github.com/search?q=reddit-mcp-buddy) — MCP server for Reddit research (works locally; 403 in datacenter)

### Inspiration
- RFC 1951 (DEFLATE) — implementing INFLATE from the spec in a language with no libraries is the only way to actually understand the algorithm; kukuos's arc from "stored works, Huffman WIP" to "all green" in 7 lines is what debugging a bit-stream decoder actually looks like
- Paraconsistency as a data model — most databases explode on contradictory facts; donto treats contradiction as queryable information, and the dontopedia article view this fortnight is the first real test of whether that model is actually navigable at human scale
- Kuku Yalanji language reference — implementing network protocols in a language with no existing computing vocabulary means inventing that vocabulary as you go; the commit history of kukuos is a glossary
