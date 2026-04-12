# Symbiogenesis, Void Entities, and Forty-Four Algorithms That Didn't Exist Two Weeks Ago

*Building a genomics compute engine from scratch, projecting faces through Matrix rain, and silently patching a job board that had been wrong for months.*

There's something I didn't notice until I was writing this: the two main projects from this fortnight are both fundamentally about the same question. Yalumba is asking: *given two DNA sequences, how do I know if the people they came from are related?* Prematrix is asking: *given a face in the real world, how do I project it into a digital rain of falling characters?* These look nothing alike. One is bioinformatics, one is a Matrix fan project. But both are about measuring similarity — about taking two complex objects and producing a number that tells you how close they are. The difference is whether the objects are genomes or faces, and whether "close" means "parent-child" or "projected onto the same pixel." The genomics work shipped 44 comparison algorithms and benchmarked them on real CEPH pedigree data. The Matrix work shipped AI-powered face landmark extraction and a triplanar UV projection system. Both are asking: what does it mean for two things to be the same?

## Why You Should Care

- **44 relatedness-detection algorithms benchmarked** on real CEPH pedigree data (1463 samples from a 6-member pedigree) — from basic Jaccard through symbiogenesis-inspired recombination distance to spectral ecology with holonomy curvature
- **Module persistence v3 PASSES all pairs** with +3.36% separation and +0.13% gap improvement over baseline — related pairs consistently score higher than unrelated pairs across the full benchmark set
- **LaTeX PDF generation system** automatically produces downloadable research papers after each benchmark run — 30-page PDFs with scientific formatting, ~180KB each
- **Prematrix shipped animated void entities** — real 3D models (shark, robot, humanoids) floating outside room windows, normalized to human scale after a multi-commit battle with GLB root transforms
- **Face reconstruction pipeline** evolved from GPT-4 Vision landmark extraction to MediaPipe Face Mesh 468-point detection — client-side, no API call per frame
- **jsonresume.org job search silently defaulted to 7 days** — fixed to 90 in both the TUI and the API, catching a misconfiguration that was making the job board return almost nothing

---

## yalumba: A Genomics Compute Engine, 44 Algorithms, and Papers I'm Writing to Myself

**69 commits. 59 features. 2 fixes. ~24,000 lines added (mostly generated reports and LaTeX papers).**

### Problem

The problem is relatedness detection: given two people's DNA sequence data, can you tell if they're related — and specifically, can you distinguish parent-child pairs from unrelated pairs? This sounds like a solved problem. It is not, particularly at the algorithmic level when you're building your own compute layer from scratch and don't want to just wrap a bioinformatics library you don't understand.

The project started with a clean slate — `feat: initialize yalumba genomics compute engine` — and needed everything: a data pipeline for real genomic data, an algorithm framework, benchmarks on real pedigree data, and a way to report results systematically so you can tell whether a new algorithm is actually better or just differently wrong.

### Approach: The Algorithm Framework

The first real foundation was `feat: experiment framework with 16 pluggable algorithms`. The design: each algorithm is a function that takes two sample arrays (representing variant call data) and returns a score. The runner iterates all algorithm × sample-pair combinations, scores them, and produces a ranked leaderboard. The key benchmark metric is *separation* — how far apart are the related-pair scores from the unrelated-pair scores?

```typescript
// packages/symbiogenesis/src/run.ts — simplified
const results = algorithms.map(algo => {
  const relatedScores = relatedPairs.map(([a, b]) => algo.score(a, b));
  const unrelatedScores = unrelatedPairs.map(([a, b]) => algo.score(a, b));
  return {
    name: algo.name,
    separation: mean(relatedScores) - mean(unrelatedScores),
    gap: min(relatedScores) - max(unrelatedScores), // worst-case gap
  };
});
```

Separation and gap are a dual-track quality signal: separation tells you the average-case performance, gap tells you whether *any* related pair scores below *any* unrelated pair. Gap > 0 means perfect classification on the benchmark set — no overlap between the two distributions.

### Approach: Real Data — GIAB and CEPH

The project moved from synthetic data to real data in the commit `feat: real data analysis — CEPH trio from 1000 Genomes`, then expanded to `feat: CEPH 1463 as default benchmark dataset` — a 6-member pedigree with 1463 samples from the GIAB (Genome in a Bottle) project. This is publicly available genomic reference data, which means the ground truth is known: family relationships are documented.

The cross-dataset validation commit (`feat: cross-dataset validation report — CEPH 1463 reveals population sharing challenge`) turned up a genuinely interesting problem: population-level allele sharing is high enough that naive similarity algorithms can't distinguish "related" from "same population." Two people from the same ethnic background share a lot of variants just because of shared ancestry from centuries ago. This motivated the more sophisticated spectral ecology and module persistence approaches — you need to normalize against the population baseline, not just measure raw similarity.

### Approach: The Algorithm Ladder — From Jaccard to Spectral Ecology

The commit history reads like a research notebook. In rough order:

1. **Basic algorithms** (Jaccard, allele sharing, run-length encoding) — established the baseline
2. **Symbiogenesis-inspired algorithms** — `feat: symbiogenesis-inspired algorithms — recombination distance is #1` — 8 new run-length variants, recombination distance took the top spot
3. **Population-baseline algorithms** — `feat: population-baseline algorithms — haplotype continuity solves CEPH` — normalizing against the population distribution rather than raw counts
4. **Spectral ecology** — 10 versions over the two weeks, from v1 through v10, implementing increasingly complex ideas: pair-coupled ecosystem transport (v3, +4.93% sep), persistence fields (v6), Sinkhorn symmetry (v7), holonomy curvature (v8, +1.62% sep), intrinsic curvature tensor (v9, +3.20% sep)
5. **Module persistence** and **coalition transfer** — the most recent work, with v3 of both passing all pairs

The spectral ecology v3 commit is the inflection point: `feat: spectral ecology v3 — pair-coupled ecosystem transport (+4.93% sep)` added 5047 lines and 24 deletions. That's a large commit for a single percentage improvement, but "ecosystem transport" means treating the genomic variant profile as a flow network and solving for equilibrium — not a three-liner.

The progression from v3 to v10 is iterative refinement with honest wins and losses:
- v6 persistence fields: best gap -3.21% (a negative gap means some related pairs still score below unrelated pairs — not passing)
- v7 Sinkhorn symmetry: 55% cooperative pairs, gap -0.61%
- v8 holonomy curvature: +1.62% separation, still failing the gap test
- v9 intrinsic curvature tensor: +3.20% separation, getting closer
- v10: hybrid approach combining v9 and v10 ideas

The spectral ecology work also generated three research papers in LaTeX: a 1303-line holonomy curvature report, a 1328-line complete 10-version arc, and a 1354-line constraint compatibility tensor paper.

### Approach: LaTeX Paper Generation

One of the odder features: `feat: LaTeX PDF generation system + downloadable papers`. After each experiment run, the system generates a LaTeX paper from the results — includes algorithm description, benchmark results tables, and theoretical interpretation. The PDFs are ~179KB-182KB per paper (measured from commit messages for module stability and coalition transfer papers).

```typescript
// After benchmark: auto-generate both markdown report and LaTeX paper
await generateMarkdownReport(results);
await generateLatexPaper(results, {
  title: `${algorithmName} Experiment`,
  includeTheory: true,
});
```

The papers run 1300-2310 lines of LaTeX. The 2310-line theoretical framework paper (`feat: theoretical framework paper — 2310-line position paper for external review`) is explicitly a "position paper for external review." Writing papers to yourself to clarify your own thinking is either a debugging technique or a warning sign. Possibly both.

### Approach: Representation Audit

The commit self-described as "the most important experiment in the project": `feat: representation audit — the most important experiment in the project`. The question: is the module extraction deterministic? Are the representations stable across runs?

The answer, after a 1799-line audit paper, was: *not reliably*. The `DETERMINISTIC module extraction + canonicalization` commit addressed this with a canonical module builder that normalizes the representation before any algorithm touches it. The follow-up `feat: wire canonical builder into ecology pipeline + fix audit` (+442/-34) integrated it into the spectral ecology pipeline.

This matters because if the input representation is stochastic, a "3% improvement" could be noise. The canonical builder converts the module extraction to deterministic before downstream algorithms run.

### Results

- 44 algorithms benchmarked across 7 categories and 3 datasets (from commit `feat: final state — 44 algorithms, 7 categories, 3 datasets`)
- Module persistence v3: +3.36% separation, +0.13% gap improvement (commit message)
- Coalition transfer v3: +1.97% separation, +0.06% gap improvement (commit message)
- Spectral ecology v3: +4.93% separation on CEPH dataset (commit message)
- Rare-Run P90: +583% improvement on CEPH benchmark — the current single-algorithm champion (commit `feat: 39 algorithms — rare-run P90 is new champion (+583% on CEPH)`)
- LaTeX PDFs: 179KB (module stability), 182KB (coalition transfer), auto-generated post-benchmark

### Pitfalls / What Broke

Module stability v4 failed after iterating 6 weight combinations: `feat: module stability v4 — iterated 6 weight combos, still fails`. The commit is in the history as evidence of the search space explored, not a success story.

The representation audit revealed that some earlier algorithm comparisons were comparing apples to stochastic apples. When module extraction isn't deterministic, a measured improvement could be random variation. Some earlier results need a rerun with the canonical builder to be trusted.

The docs site deployment required removing Vercel from the workflow — it conflicted with GitHub Pages for the same domain. And `fix(docs): add @types/node for Vercel build` is the kind of fix that takes 30 seconds and represents 20 minutes of confusion.

### Next

- Rerun all 44 algorithms with the deterministic canonical representation in place — some early results may have been noise
- Module stability v5 — the v4 weight-space search is exhausted; need a different algorithmic approach
- External review of the 2310-line theoretical framework paper — it was written explicitly for this

---

## prematrix: Void Entities, Face Projection, and the Eternal Problem of Model Scale

**67 commits. 26 features. 11 fixes.**

### Problem

The previous period established prematrix as a Matrix rain corridor with basic room structure. What was missing: an ECS entity system, animated models in the void outside windows, working face projection (it disappeared on movement), a polished bullet time system, mobile controls, and a finalized room design. The experience was technically there but not inhabitable.

### Approach: The Room, Finally

The room went through a multi-commit design evolution: started multi-room with doors, became single-room, got wider (2x width/depth), gained windows on every wall, had door openings converted to archways. The final state: 28x28 square room, no random sizing (removed because it caused layout bugs), window on every wall, archways instead of doors.

```typescript
// After many iterations: fixed square room
// commit 974bd6b: "Fix room to be 28x28 square — no random sizing"
const ROOM_SIZE = { width: 28, depth: 28, height: 4 };
```

Void entities — the figures floating outside the windows — required their own tuning loop. Far enough to feel exterior (orbit radius 150+ units) but close enough to see detail through the glass (scaled down to recognizable human size). Two lines of logic, about a week of iteration to converge.

### Approach: Model Loading and Scale Normalization

The model loading system graduated from procedural placeholder entities to real animated GLB files. Six models were added in a single commit — shark, robot, xbot, hvgirl, michelle, milktruck (+87/-15) — after triplanar UV projection was working.

Scale normalization was the recurring problem. Target: all humanoid models normalized to 1.8m, capped at 2.2m for room placement. In practice:

- HVGirl and Michelle were massive — `scale: 0.3` and a stricter clamp fixed them
- Fox and horse models were added, then removed twice because "sizing never works"
- The final state: humanoids clamped to 2.2m, void entities at their own scale, foxes and horses gone with the commit message note intact

The underlying issue: individual model `scale` values in GLB files compound with root node transforms. Without inspecting each GLB's root node, output scale is unpredictable. The fix was case-by-case scale overrides for deviating models — not elegant, but the animals didn't survive the process at all.

### Approach: Triplanar UV Projection

The Matrix rain shader needed to apply consistently across all loaded models regardless of their original UV layout. The solution was triplanar world-space UV projection: sample the texture from all three axes, blend based on surface normals.

```glsl
// Triplanar sampling: blend XY, YZ, XZ projections weighted by abs(normal)
vec3 blendWeights = abs(vNormal);
blendWeights = blendWeights / (blendWeights.x + blendWeights.y + blendWeights.z);

vec4 xProj = texture2D(uMatrix, vWorldPos.yz * uScale);
vec4 yProj = texture2D(uMatrix, vWorldPos.xz * uScale);
vec4 zProj = texture2D(uMatrix, vWorldPos.xy * uScale);

vec4 color = xProj * blendWeights.x + yProj * blendWeights.y + zProj * blendWeights.z;
```

This meant adding all six models in one commit without any per-model UV fiddling. The rain pattern falls through everything uniformly — walls, humanoids, the shark, all the same green characters.

### Approach: Face Reconstruction

The pipeline: capture face via webcam → extract landmarks → project back through the Matrix rain shader → rain characters rearrange themselves to form your face.

First implementation used GPT-4 Vision for landmark extraction — one API call per capture. Debugging this required a dedicated red debug mode (red channel reserved for face data, high-contrast palette for other layers), a smiley face test pattern, then a Red John smiley as the next test pattern. The face projection was disappearing on movement because `uDebugMode` was being reset to false on every render frame — a classic stateless-shader problem where the JS side assumed uniform state persisted.

```typescript
// The bug: uniform only set on mode toggle
// The fix: set it every frame unconditionally
function render() {
  shader.uniforms.uDebugMode.value = debugMode; // set every frame
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
```

GPT-4V was then replaced with MediaPipe Face Mesh for 468-point real-time detection — client-side, no API call per frame. Accuracy difference: GPT-4V returned approximate landmark positions; MediaPipe returns precise x/y/z coordinates for all 468 points at camera framerate.

### Approach: Bullet Time Rewrite

The bullet time system got a full rewrite: dynamic trail ribbon behind the bullet, slower bullet velocity, air ripple distortion effects. Walking direction was fixed in the same commit because the control state was shared. Left-click shoots. `FirstPersonControls.ts` accumulated 176 lines and 35 deletions across 4 commits to get to this state.

### Approach: Mobile Controls and Pretext

Mobile: 158 lines added (+158/-1) for on-screen joystick zone and action buttons. Then a separate 129-line commit for full touch event handling. During mobile integration, desktop pointer lock got broken — the mobile detection was blocking the pointer lock request. Two-line fix.

Pretext replaced naive `measureText` for Matrix rain character sizing — browser font metrics are unreliable enough that the rain tiling was breaking at certain zoom levels. Pretext provides accurate advance widths, making the glyph grid precise.

The layer system was redesigned from ad-hoc logic to a single configurable slider (1-6 layers) with a debug panel that supports copy/paste config sharing via serialized JSON.

### Results

- 6 animated models loading with consistent triplanar UV — no seams on any surface (visual inspection across all models)
- MediaPipe face landmark detection running at interactive framerates (qualitative; formal FPS benchmark TODO)
- Face projection persistent across movement — regression test added in commit `d7bcfc4`
- Mobile joystick controls working on device (qualitative — tested during development)
- Cloudflare CDN cache headers in prod, disabled in dev (commit `664680e`, environment-conditional logic)

### Pitfalls / What Broke

Fox and horse models were added and removed twice. The git history has it verbatim: "Remove foxes and horses from rooms — sizing never works." The scale normalization edge case with quadruped models (non-standard root node hierarchies, different proportions) wasn't worth solving for the feature value they provided. Removed.

East/west wall movement broke due to a hardcoded corridor X clamp from the old room system that didn't translate to the world system's coordinate space. Deleting 8 lines fixed it — the kind of bug that's obviously wrong once you find it.

Desktop pointer lock broke during mobile integration and affected the primary input method for desktop users. Two-line fix, but it was in the window.

### Next

- Multiplayer: ECS and world system are architecturally ready; WebSocket entity sync is the missing layer
- Sound: bullet time needs a slowdown SFX; the rain needs ambient audio
- Void entity behaviors: currently passive orbit; they should react to player proximity

---

## jsonresume.org: The Two Commits That Quietly Mattered

**2 commits. 2 fixes.**

### Problem

The job search feature on jsonresume.org defaulted to 7 days of history. Most jobs are posted and fill over 30-90 day cycles, so a 7-day window was returning almost nothing — silently, without error. The failure mode was sparse results, not a crash, which makes it easy to miss.

The API was also swallowing error details. When the job fetch failed, callers got a silent empty result with no diagnostic information.

### Approach

Two surgical changes across three files:

```javascript
// Before (cli.js, useJobs.js, route.js — all had their own hardcoded value)
const defaultDays = 7;

// After
const defaultDays = 90;
```

`fix(jobs): change default days to 90 and surface error details` — changed `defaultDays` in `useJobs.js` and `route.js`, added error propagation so failure details come back in the API response. `fix(jobs): update TUI and CLI default days to 90` — updated `cli.js` and the TUI config, 3 lines changed in each.

The notable thing: there was no shared constant. Three separate files, three separate values, three separate updates required. Each was independent — which is why the bug survived as long as it did.

### Results

Default job search window increased from 7 to 90 days (measured: git diff on `defaultDays`). The practical result is qualitative — searches should return roughly 12-13x more results because 90/7 ≈ 12.8x the time window, assuming roughly uniform job posting distribution over time.

### Pitfalls / What Broke

This is a classic "no shared constants" bug. Three entry points (TUI, web hook, API) all had the same value hardcoded independently. The fix was three separate edits; the root cause — no `DEFAULT_DAYS` constant — is still there.

### Next

- Introduce a shared `DEFAULT_DAYS` constant so this can't drift independently across three entry points again
- Verify TUI surfaces API error details client-side — the fix propagated errors in the API response, but the TUI may still be swallowing them

---

## What's Next

- **yalumba canonical rerun**: All 44 algorithms need re-benchmarking with the deterministic canonical representation. Some early results may be noise from stochastic module extraction.
- **Module stability v5**: The v4 weight-space search is exhausted. Need a fundamentally different approach — the commit history shows what didn't work; the next step is a different search space entirely.
- **External review of the theoretical framework paper**: 2310 lines written explicitly "for external review." That review hasn't happened yet.
- **Prematrix multiplayer**: ECS world system is structurally ready. WebSocket layer is the only missing piece.
- **Face + void entities**: The face detection pipeline and the void entity system both exist. Connecting them — projecting captured faces onto the orbiting entities — is the obvious next step.
- **jsonresume.org `DEFAULT_DAYS` constant**: Three hardcoded values in three files is a future bug. Extract it.
- **Prematrix audio**: Bullet time without a slowdown SFX is wrong. Rain needs ambient sound. Both are in the obvious-but-unstarted category.

---

## Links & Resources

### Projects
- [yalumba](https://github.com/thomasdavis/yalumba) — Genomics compute engine: relatedness detection algorithms, CEPH benchmarks, spectral ecology
- [prematrix](https://github.com/thomasdavis/prematrix) — Matrix rain 3D world with animated models, face projection, bullet time
- [jsonresume.org](https://github.com/jsonresume/jsonresume.org) — The JSON Resume mono repo: homepage, registry, job search

### Tools & Services
- [MediaPipe Face Mesh](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) — 468-point real-time face landmark detection, client-side, no API calls
- [GIAB (Genome in a Bottle)](https://www.nist.gov/programs-projects/genome-bottle) — Reference genomic datasets; CEPH 1463 pedigree is the primary benchmark dataset
- [Pretext](https://github.com/nicolo-ribaudo/tc39-proposal-pretext) — Accurate glyph measurement for text layout; used for Matrix rain character sizing
- [Three.js](https://threejs.org/) — 3D rendering for prematrix
- [LaTeX](https://www.latex-project.org/) — Auto-generated experiment papers; each benchmark run produces a downloadable PDF
- [Cloudflare CDN](https://cloudflare.com/) — Cache headers baked into the prematrix build, environment-conditional

### Inspiration
- Spectral ecology as a metaphor for genomic relatedness — treating variant profiles as ecosystem flows rather than binary feature vectors is an unusual framing and it's producing the best results
- The representation audit lesson: you can't build a good distance metric without first stabilizing your representations — measure your measurement system before trusting its outputs
