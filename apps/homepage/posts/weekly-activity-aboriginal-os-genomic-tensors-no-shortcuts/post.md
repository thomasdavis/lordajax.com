# An Aboriginal Language OS, Genomic Curvature Tensors, and the No-Shortcuts Rule

*Implementing zlib INFLATE, git clone, and holonomy curvature from scratch in the same fortnight — because the only thing worse than unnecessary complexity is borrowed complexity you don't understand.*

There's a pattern in this fortnight I didn't plan: every project is building the thing, not wrapping it. kukuos implemented DNS, SHA1, zlib INFLATE, and a git clone stack entirely in Kuku Yalanji — an Aboriginal Australian language from Far North Queensland — because the project's new CLAUDE.md rule is literally "no shortcuts: every artefact written in Kuku." yalumba iterated spectral ecology from v8 through v10, published three papers' worth of LaTeX, and passed the module persistence and coalition transfer benchmarks — all with custom math on real CEPH genomic data, no bioinformatics library in sight. donto hardened a PostgreSQL extension through sccache integration, CI cleanup, and aggressive test expansion. jsonresume got two quiet fixes that unblocked a job search nobody noticed was broken. Across four repos and 87 commits: ~37,705 lines added, ~3,029 deleted, and one formalized rule about what it means to build something yourself.

## Why You Should Care

- **git clone, fully in Kuku Yalanji**: kukuos now implements the entire git clone stack from scratch — DNS A-record resolution (RFC 1035), HTTP GET, SHA1 (RFC 3174), and zlib INFLATE (stored + fixed + dynamic Huffman) — compiled from an Aboriginal Australian language running on an i386 kernel
- **zlib INFLATE complete in Kuku**: stored, fixed Huffman, and dynamic Huffman modes all pass test vectors — a 716-line addition in `bana-yanyil.kuku`, landed across three commits from "stored works, Huffman WIP" to "full INFLATE, all green"
- **Module persistence v3 and coalition transfer v3 both PASS**: +3.36% / +1.97% separation improvements on CEPH data with positive gap — no related pair scoring below any unrelated pair on the benchmark set
- **Spectral ecology pushed to v10**: 10 versions of the algorithm in the history, culminating in an intrinsic curvature tensor approach and a 2310-line theoretical framework paper written for external review
- **donto CI hardened**: sccache wired into CI and Docker containers, ~2,174 lines of new test code across two commits, and a full pgrx end-to-end Docker fix that was blocking the entire pipeline
- **jsonresume job search fixed**: default days changed from 7 to 90 across CLI, TUI, and API — silently returning almost nothing for what was probably months

---

## kukuos: Building a git Clone Stack, One Protocol at a Time, in an Aboriginal Language

**12 commits. ~2,900 lines added across protocol implementations.**

### Problem

kukuos is an i386 operating system and stack-language compiler written entirely in Kuku Yalanji — an Aboriginal Australian language from Far North Queensland. The constraint is absolute: every artefact in the repo must be written in Kuku. This fortnight's work was extending the standard library to the point where the OS can clone a git repository over HTTP — which means implementing DNS, HTTP, SHA1, and zlib from scratch, in that language, on that kernel.

Before this period: the HTTP server (`bayan-daya.kuku`) existed, but the client side was incomplete. The zlib implementation (`bana-yanyil.kuku`) was started but only handled stored blocks. The DNS resolver didn't exist. The git clone tool didn't exist.

### Approach: The Protocol Stack

The commits tell the story in dependency order:

1. **DNS A-record resolver** — `91bb969`: `binal.kuku`, RFC 1035, UDP, resolving against 8.8.8.8. 270 lines. You can't git-clone without knowing where to connect.
2. **HTTP GET client** — `f9ebc61`: `bayan-mana.kuku`, described as "rung 1 of the git-clone stack." 266 lines.
3. **SHA1** — included in `2df9f1e` alongside `bayan-bana.kuku` (static file server). SHA1 is how git verifies object integrity (RFC 3174). 603 lines total in that commit.
4. **zlib INFLATE** — `246e3ab` through `d5206c0`: `bana-yanyil.kuku`, in three stages:
   - First commit: 716 lines — stored blocks pass, Huffman WIP
   - One more commit (+7/-1): fixed and dynamic Huffman all pass test vectors — "full INFLATE in Kuku — stored, fixed, dynamic all green"
5. **git clone** — `24454ba`: `bayan-binalku.kuku` — 675 lines, "git clone in Kuku (stored-only zlib, loose objects, walker)"

The order is the dependency graph. That's what from-scratch looks like: you implement DNS before HTTP, SHA1 before git objects, inflate before anything that uses it. The HTTP server got extended in the same period: `bayan-daya.kuku` added a `socketcall` primitive (`bama-wari`), and gained a manpage-style homepage that lists every available Kuku command — 164 lines added, 23 deleted.

### The CLAUDE.md Rule

One commit is just: `5b3df46: CLAUDE.md: no shortcuts rule — every artefact written in Kuku (+46/-0)`. 46 lines of policy documentation about what the project is and isn't. The previous state included `paper.kuku` — a Kuku program that emitted LaTeX compiled by tectonic. That commit (`03e5e09`) was a reversal: "Remove paper.kuku and PDF: Kuku-emitted LaTeX into tectonic was a shortcut."

The distinction matters: emitting LaTeX from Kuku and having tectonic compile it was deemed a shortcut because tectonic is external. The rule now is that the output must be Kuku's direct output — not a generator for some other tool's input. The 46-line CLAUDE.md formalizes this. It's the kind of constraint you write down because you've already broken it once and want a documented boundary for next time.

The shell banner also lost all English in `910365a` (+4/-6). The OS speaks Kuku at every layer now — no English in the boot sequence.

### Results

- Full zlib INFLATE passing stored, fixed, and dynamic Huffman test vectors (per commit message)
- git clone in 675 lines of Kuku, handling stored-only zlib, loose objects, and a tree walker — enough to clone a simple repository with no delta compression
- DNS A-record resolution via UDP to 8.8.8.8, RFC 1035 compliant
- HTTP server with a manpage-style homepage listing every available Kuku command
- English fully stripped from the shell banner

### Pitfalls / What Broke

The zlib story isn't fully clean. The commit log shows `246e3ab`: "zlib INFLATE in Kuku — stored works, Huffman WIP." The fix took one more commit at +7/-1 lines. That's either an elegant single-point fix in the Huffman decode loop or a patch over something deeper — can't tell without the diff.

The git clone has a stated limitation: "stored-only zlib" means it works on repositories where objects are stored uncompressed. Real-world git repos use delta compression extensively. The clone is a foundation, not a production tool yet.

The paper.kuku removal is an honest regression — PDF generation capability went away to enforce the no-shortcuts rule. The OS can't produce PDFs until that capability is reimplemented directly in Kuku.

### Next

- Delta compression: INFLATE for all deflate variants is done; git pack-file delta compression is the next protocol layer for real-world repo cloning
- Wire the HTTP static file server (`bayan-bana.kuku`) and the git clone tool (`bayan-binalku.kuku`) together for a self-hosting scenario
- The README's "how-it-works" sections are still in English; eventually they'll need Kuku equivalents or at least a bilingual treatment

---

## yalumba: Spectral Ecology v8–v10, Passing Module Persistence, and Papers Written to Myself

**69 commits. 59 features. 2 fixes. ~30,000 lines added (the majority is LaTeX papers and generated reports).**

### Problem

The previous fortnight initialized yalumba and benchmarked 44 algorithms across 7 categories on real CEPH pedigree data. The main outstanding problem: the spectral ecology approach was accumulating versions (v3 through v7) but none had achieved a positive gap — meaning some related pairs were still scoring below some unrelated pairs, which means the classifier isn't clean on the benchmark set. Module persistence and coalition transfer had the same issue — better separation than baseline, but gap still negative.

A deeper problem emerged via the representation audit: module extraction wasn't deterministic. If the input representation is stochastic, a measured +3% improvement could be noise. Everything downstream of the module extractor was potentially unreliable.

### Approach: Deterministic Representations First

The canonical builder landed first: `feat: DETERMINISTIC module extraction + canonicalization paper (+1618/-0)`. This established a normalized, deterministic representation before any algorithm touches the data. Then `feat: wire canonical builder into ecology pipeline + fix audit (+442/-34)` integrated it into the spectral ecology pipeline.

The audit visualization page (`feat: audit visualization page + canonical module builder + gh-pages config (+1765/-1)`) makes the determinism guarantees inspectable via the deployed docs site. The gh-pages config was added in the same commit. After that commit, any result measured on the canonical representation is trustworthy.

The PAUSE invariant is documented separately: `docs: PAUSE invariant design — representation must be stabilized first (+20/-1)`. Written in the middle of active development to formalize: don't proceed with algorithm comparison until the representation is stable. It's the kind of constraint document you write after you've realized you almost made the mistake.

### Approach: Spectral Ecology v8–v10

Three more versions this period, each with a corresponding paper:

**v8 — Holonomy Curvature**: The initial commit added holonomy curvature and a 2310-line theoretical paper (`feat: spectral ecology v8 — holonomy curvature + 2310-line theoretical paper (+420/-1)`). A follow-up revision applied a self-baseline modification — using each sample's own curvature as its baseline rather than a global one — and measured +1.62% separation improvement (`feat: spectral ecology v8 — holonomy self-baseline, +1.62% separation (+161/-190)`). The paper runs 1303 lines of LaTeX.

**v9 — Intrinsic Curvature Tensor**: `feat: spectral ecology v9 — intrinsic curvature tensor, +3.20% separation (+379/-0)`. Best single-version improvement in the spectral ecology track. The 1354-line paper covers the constraint compatibility tensor formulation in full.

**v10 — Hybrid Approach**: `feat: spectral ecology v9-v10 — intrinsic curvature + hybrid approach (+121/-0)`, then `feat: spectral ecology v10 paper — 1328-line complete 10-version arc (+1328/-0)`. The v10 paper documents the entire development arc — what changed between versions, what worked, what didn't.

The 2310-line theoretical framework paper (`feat: theoretical framework paper — 2310-line position paper for external review (+2370/-0)`) is the largest LaTeX artifact in the project. It spans the full spectral ecology work and is described explicitly as written for external review.

### Approach: Module Persistence and Coalition Transfer Crossing the Threshold

Both algorithms passed the gap threshold this period:

**Module persistence v3**: `feat: module persistence v3 PASSES all pairs (+3.36% sep, +0.13% gap) (+211/-219)`. Gap positive at +0.13%: the worst related-pair score is above the best unrelated-pair score. The classification boundary exists on the benchmark set.

**Coalition transfer v3**: `feat: coalition transfer v3 PASSES all pairs (+1.97% sep, +0.06% gap) (+34/-33)`. Same story, different algorithm family. Barely passing — +0.06% gap — but passing.

Auto-generated papers for both: module stability experiment as 1316-line LaTeX + 179KB PDF, coalition transfer experiment as 1315-line LaTeX + 182KB PDF. The PDF sizes are in commit messages because they're part of what ships.

The honest counterpoint: module stability v4 searched 6 weight combinations and failed all of them (`feat: module stability v4 — iterated 6 weight combos, still fails (+68/-124)`). The commit is evidence of what the search space covers, not a success.

### Approach: Tooling and Infrastructure

`feat: @yalumba/compute — native C library + TypeScript FFI bindings` added a compiled C layer for computationally intensive operations. `feat: wire @yalumba/compute into experiments package` integrated it into the experiments runner. The genomics operations that were bottlenecking in pure TypeScript now go through the C layer.

`feat: run-one.ts — single algorithm runner with detailed instrumentation` is the debugging interface: run a single algorithm against the full benchmark with verbose output. When you want to understand why an algorithm is failing particular pairs, you run it in isolation instead of reading aggregated reports.

`feat: LaTeX PDF generation system + downloadable papers` and `feat: redesigned LaTeX system — 30-page paper, clean scientific design` refined the automatic paper generation. After each experiment run, the system generates a LaTeX paper from results — description, benchmark tables, theoretical interpretation. The PDFs are ~179–182KB each, auto-generated.

The wine palette commit (`feat: wine palette from Winesmiths Shiraz — text is gray/black, brand is ornamental`) is in there. The docs site has a color scheme derived from a bottle of Shiraz. The commit title is the full explanation.

### Results

- Module persistence v3: +3.36% separation, +0.13% gap (measured against CEPH benchmark, related vs. unrelated pair scoring distribution)
- Coalition transfer v3: +1.97% separation, +0.06% gap (same methodology)
- Spectral ecology v9: +3.20% separation improvement — best single spectral ecology version
- v10 paper: 1328 lines documenting the full 10-version development arc
- Theoretical framework: 2310 lines written for external review
- Native C compute layer wired into experiments package
- Audit visualization deployed to gh-pages with canonical representation guarantees

### Pitfalls / What Broke

Module stability v4 is the main failure on record — six weight combinations tried, all failing. The approach is exhausted; v5 needs a different starting point, possibly a different objective function.

Vercel was removed from the CI workflow (`docs: remove Vercel deploy from workflow, update CLAUDE.md +3/-5`). Vercel and GitHub Pages were pointed at the same domain. Vercel lost. The docs tutorial app also needed `@types/node` to build (`fix(docs): add @types/node for Vercel build`) — a two-minute fix representing longer confusion about why Vercel's Node build environment doesn't include Node types without explicit declaration.

The gap metrics for both passing algorithms are thin: +0.06% and +0.13% respectively. They pass on the benchmark set but the margin is not robust. One unusual sample pair could flip either algorithm back to failing. The results are real but fragile.

### Next

- Module stability v5: the weight-space search is exhausted — need a different algorithmic approach, possibly changing the objective function entirely
- External review of the 2310-line theoretical framework — it was written for this and it hasn't happened yet
- The gap margins for module persistence and coalition transfer are thin; additional algorithm improvement needed before these are production-robust

---

## donto: PostgreSQL Extensions, sccache, and Tests Until Docker Says Yes

**4 commits. ~6,600 lines added, ~1,500 deleted.**

### Problem

donto is a PostgreSQL extension built with pgrx — Rust code that runs inside the database engine. The problem this period: the CI pipeline was unreliable, the Docker build for the pgrx extension was broken end-to-end, and test coverage was thin enough that a CI pass didn't tell you much.

### Approach

Four commits, in order of what was blocking what:

**`3cdb8da`: "CI + lint cleanup; fix pgrx extension end-to-end in Docker" (+4450/-1477).** The largest commit in the repo. pgrx compiles against a full Postgres installation, which means the Docker container for building the extension is complex — it needs Postgres headers, the pgrx framework, and Rust all coordinated. The previous state had this broken. The +4450/-1477 shape suggests significant infrastructure restructuring rather than just a config fix: large deletion counts in CI/Docker contexts usually mean replacing a broken approach with a working one rather than patching the broken one.

**`f3e3681`: "Deepen test coverage; wire sccache into CI" (+1112/-4).** sccache is Mozilla's shared compilation cache for Rust — without it, every CI run recompiles the entire dependency tree from scratch. With sccache pointed at a storage backend, incremental builds reuse cached artifacts. 1112 lines of additions here is predominantly new test code; the -4 is the config change to enable caching.

**`f14ed04`: "More tests; sccache in pgrx container; CLAUDE.md note" (+1062/-1).** sccache extended into the pgrx Docker container specifically. The container build is separate from the outer CI job's cache path — it needs its own sccache configuration because it runs in a different environment. A CLAUDE.md note was added documenting the setup, presumably because the configuration is environment-coupled enough that it would be easy to accidentally break.

**`f4b43f7`: "donto CLI: rich help, man page, shell completions, reference doc" (+439/-15).** The user-facing layer: formatted help text, a generated man page, and shell completions for bash, zsh, and fish. This is the part users actually see.

### Results

- pgrx extension end-to-end build and test passing in Docker (per commit message)
- ~2,174 lines of new test code across the coverage expansion commits (+1112 + +1062, mostly tests)
- CLI with man page and shell completions for three shells
- sccache in both CI job and pgrx Docker container — qualitatively faster subsequent build times (before/after CI minute count: TODO)

### Pitfalls / What Broke

The +4450/-1477 commit is opaque for future debugging. If something breaks in the CI infrastructure after that commit, `git bisect` has a large haystack to work through. The justification — fixing a broken Docker build — is real, but the commit is a black box.

The CLAUDE.md note in commit `f14ed04` is a tell: when you add documentation about a configuration in the same commit you add the configuration, it usually means the configuration is fragile. Environment-coupled sccache paths are the kind of thing that silently breaks when the CI image is updated.

### Next

- Measure actual CI time improvement from sccache — the cache is wired but the before/after numbers aren't documented; that measurement determines whether the configuration complexity is load-bearing
- CLI has man page and completions; distributable binaries for target platforms are the natural next step
- The purpose of the extension itself isn't fully stated in the commit messages — the heavy test expansion suggests active feature development, but the shape of what donto actually does remains implicit in the tests rather than explicit in the docs

---

## jsonresume.org: Two Commits, One Silent Bug, Potentially Many Months of Sparse Results

**2 commits. 2 fixes.**

### Problem

The job search on jsonresume.org defaulted to 7 days. Job boards operate on 30-90 day posting cycles — a 7-day window quietly returns almost nothing. No error, no warning, just sparse results. The failure mode is invisible, which is how it survives.

Separately: the API swallowed error details. When the job fetch failed, callers got an empty result with no diagnostic information — the worst kind of failure because you can't tell if you got no jobs or if the request failed.

### Approach

```javascript
// Before — cli.js, useJobs.js, route.js each with their own hardcoded value:
const defaultDays = 7;

// After
const defaultDays = 90;
```

Two commits, three files. `fix(jobs): change default days to 90 and surface error details` touched `useJobs.js` and `route.js` — changed the default and added error propagation to the API response. `fix(jobs): update TUI and CLI default days to 90` updated `cli.js` and the TUI config. Three lines changed in each.

The notable thing: there was no shared constant. Three separate entry points, three separate hardcoded values, three separate updates required. Each was independent — which is why the bug could exist in the first place.

### Results

Default search window: 7 → 90 days (measured: git diff on `defaultDays`). Theoretical result density: ~12.8x more results assuming roughly uniform job posting distribution over time (90/7 ≈ 12.8). Whether job postings distribute uniformly over 90 days is unknown — the 12.8x is a ceiling estimate.

### Pitfalls / What Broke

The root cause is still live: no `DEFAULT_DAYS` constant. Three separate files, three separate values. The fix was three separate edits; the next drift will look exactly the same and survive just as long.

### Next

- Extract a shared `DEFAULT_DAYS` constant — a one-line change in impact, significant in preventing future silent divergence
- Verify the TUI surfaces propagated API errors to the user — error propagation was added at the API level, but the TUI display layer may still be discarding the details silently

---

## What's Next

- **kukuos delta compression**: INFLATE for stored/fixed/dynamic deflate is done. Git pack-file delta compression is the next protocol layer — without it, cloning any non-trivial real-world repository fails.
- **kukuos self-hosting**: The HTTP static file server and the git clone tool both exist. Wiring them together so the OS can serve and clone its own source is the interesting structural milestone.
- **yalumba module stability v5**: Six weight combinations tried and failed in v4. The search space is exhausted; need a different objective function or a different algorithm family entirely.
- **yalumba external review**: The 2310-line theoretical framework was written explicitly "for external review." That review hasn't happened. Sending it somewhere is the action item.
- **donto sccache benchmarks**: sccache is wired in but the before/after CI time numbers aren't documented. That measurement determines whether the configuration complexity is justified.
- **donto packaging**: CLI ships with man page and shell completions. Distributable binaries for target platforms are the missing piece.
- **jsonresume DEFAULT_DAYS constant**: Three hardcoded values in three files. Extract it before the next person touches one file and forgets the other two.

---

## Links & Resources

### Projects
- [kukuos](https://github.com/australia/kukuos) — i386 OS and stack-language compiler written entirely in Kuku Yalanji, an Aboriginal Australian language from Far North Queensland
- [yalumba](https://github.com/thomasdavis/yalumba) — Genomics compute engine: relatedness detection algorithms benchmarked on real CEPH pedigree data
- [donto](https://github.com/thomasdavis/donto) — PostgreSQL extension (pgrx/Rust) with CLI, man page, and shell completions
- [jsonresume.org](https://github.com/jsonresume/jsonresume.org) — JSON Resume mono repo: homepage, registry, job search

### Tools & Services
- [pgrx](https://github.com/pgcentralfoundation/pgrx) — Framework for writing PostgreSQL extensions in Rust; handles the glue between Rust and the Postgres extension API
- [sccache](https://github.com/mozilla/sccache) — Mozilla's shared compilation cache for Rust; dramatically reduces CI rebuild times by caching compiled artifacts across runs
- [GIAB (Genome in a Bottle)](https://www.nist.gov/programs-projects/genome-bottle) — Reference genomic datasets; CEPH 1463 pedigree is the primary yalumba benchmark dataset
- [tectonic](https://tectonic-typesetting.github.io/) — LaTeX engine used (then removed) in kukuos — the one tool that qualified as a shortcut under the no-shortcuts rule

### Inspiration
- Kuku Yalanji language reference — implementing network protocols in a language with no existing computing vocabulary means inventing that vocabulary as you go; the commit history of kukuos is a glossary of computing terms in Kuku
- RFC 1951 (DEFLATE) — the thing you implement when you want to know how gzip actually works instead of just calling `zlib.decompress()`; the three-commit arc from "stored works" to "all green" is what reading an RFC looks like
- Spectral ecology as a framework for genomic distance — treating variant profiles as ecosystem flow networks is an unusual framing that has produced the most interesting results in the yalumba benchmark; v8–v10 are the most direct application of differential geometry to genomics in a weekend-project context
