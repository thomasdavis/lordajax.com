# A Week of GPU Kernel Tuning, Physics Jenga, and Building the npm for AI Tools

*371 commits, 6 repos, one overarching obsession: making the machines go faster so I can build weirder things on top of them.*

There's a thread running through everything I shipped this week. I'm building an AI training stack from scratch — custom Vulkan GPU kernels, a web training dashboard, a post-training chat pipeline — and simultaneously trying to figure out what comes *after* the training is done. The answer keeps pointing toward tooling: tool registries, agentic UIs, editor integrations. tpmjs is supposed to be the npm for AI tools, and the more I train models with alpha2, the clearer it becomes that a model without good tool access is just a fancy autocomplete. Meanwhile symploke grew a Jenga game and a GitHub mates feature. I'm not sure how that happened either, but here we are.

## Why You Should Care

- **alpha2** shipped a full nanochat post-training pipeline — supervised fine-tuning, a bootstrap script, and auto-generated model report pages with embedded chat
- **GPU throughput gains measured in tok/s** across ~80 performance commits — individual wins from +1% to +50%, stacking to meaningful compound improvements on L4 hardware
- **tpmjs** added 9 new editors to its install flow, tool permissions + approval flows, and a redesigned agentic UI; the install script now auto-detects re-runs and skips already-configured editors
- **symploke** shipped a full 3D Jenga dependency visualization game and a GitHub Mates feature (find coding soulmates via AI profile matching) in the same two-week window
- **omega** implemented "Right to be Forgotten" profile deletion with full cascade
- **Mixed precision training** (f16 activations, dynamic loss scaling) went in for alpha2, with the cast kernels written in Vulkan WGSL

---

## alpha2 — GPU Kernel Tuning at Scale, Post-Training, and UI Componentization

**Problem:** The training loop was leaving a lot of GPU cycles on the floor. The JavaScript overhead around the Vulkan dispatch calls was measurable — per-step buffer array materializations, per-op view allocations, push constants being reconstructed every step. At the same time, I had a trained model with nowhere to go: no chat inference pipeline, no way to run fine-tuning, no reporting page. And the frontend was a pile of one-off components that shared no code.

**Approach:** I took three parallel tracks this fortnight.

*Performance track:* The hot loop profiling was brutal. The biggest single wins came from removing allocation in the inner loop:

```typescript
// Before: recreated every step
const bufferArray = op.inputs.map(b => b.handle);

// After: precomputed at graph pack time
// saves ~4% tok/s per measured A/B run of 20 iterations
```

Push constant memoization gave +16.89% tok/s by itself — four floats being packed into a buffer every single op invocation, every single step. Caching the packed representation when inputs don't change was the fix. GPU stat probes (nvidia-smi calls to check memory pressure) were running every step on machines that don't even have NVIDIA hardware — disabling that gave +50.42% on non-NVIDIA hosts. I tuned adaptive sync thresholds, collapsed tape.clear passes, rewrote the grad norm computation to use in-place tree reduction instead of allocating scratch arrays, and added configurable train log cadence (which alone gave +75.35% tok/s because it turns out JSON stringification every step is expensive).

*Post-training track:* Built the nanochat pipeline — a supervised fine-tuning stage that takes a trained base model and a chat-format dataset and produces a conversational model. The bootstrap scripts handle dataset prep, the loop script handles the training orchestration, and Claude skills are included for autonomous re-running. I also built a BPE-8k tokenizer variant for fine corpus work and added auto-generated model report pages that pull training metrics, show the full pipeline used, and embed a live chat widget.

*UI componentization track:* Moved all complex charts into `@alpha/ui` package with full theme support, dark/light mode, and a styleguide page. Interactive charts with synced pinned step markers across the run detail page. Click-to-add markers persist to localStorage per run. The run detail page now polls every 15 seconds instead of 60.

Also shipped: flash attention kernels, mixed precision (f16 activations + dynamic loss scaling with `--fp16` flag), cooperative matmul on the L4 profile, and a Symbiogenesis mode (`--symbio`) that does evolutionary architecture search on FFN activations — trying different activation functions during training and keeping the ones that lower loss.

**Results:** Cumulative throughput improvements are hard to measure in aggregate because each commit was A/B tested against the prior stable baseline — the benchmark loop itself evolved to handle this, with retry logic for unstable runs, compile timeout guards, and smoke test preflight. Individual measured wins included: +50.42% tok/s (disabling gpu probes on non-NVIDIA), +40.45% (skip nvidia-smi on non-NVIDIA), +34.43% (benchmark from metrics.jsonl + sparse logging), +28.12% (reuse grad norm scratch arrays), +28.01% (choose best retry attempt in benchmark loop). The matmul improvements — coop tiling on L4 with 2x2 shared memory, swizzling, kMulti=4 — gave +14-30% depending on context length, measured by the benchmark loop running 5+ iterations with warm-up.

**Pitfalls / What Broke:** Cooperative matmul caused NaN gradients in the backward pass. The fix was disabling coop during backward — straightforward in retrospect, painful to debug. The f16 cast kernel also had a clamp bug: values outside the f16 range (±65504) were wrapping to NaN in the backward pass instead of being clamped. Mixed precision training is genuinely tricky because you need the loss scaling to be adaptive (NaN detection → scale reduction → recovery), and I had at least three commits fighting the LR recovery logic to only reset on actual spikes, not NaN steps. The `--fp16=false` flag on the L4 profile wasn't being respected on explicit override — fixed, but it's the kind of thing that burns hours.

**Next:**
- Run nanochat pipeline end-to-end on a properly sized dataset and get coherent chat outputs
- Measure the actual quality delta between base model and fine-tuned model on a held-out eval set
- Get coop matmul working in the backward pass without causing NaN — the forward gains are real and I'm leaving performance on the table

---

## tpmjs — The npm for AI Tools, Now With Editor Support and Tool Permissions

**Problem:** tpmjs is supposed to be the package registry for AI agent tools — you publish a tool, agents install it, MCP servers serve it. The install flow was incomplete: it only handled a couple of editors, the omega chat UI was rough, and there was no permission model for tools (every tool you installed got full trust, which is a bad default for an agentic system). The setup page also had a broken sign-in redirect bug that ate claim codes.

**Approach:** The install.sh script is the entry point — it's what you run when you want to configure your editor(s) to use tpmjs as an MCP server. I added 9 new editors to the setup flow in one commit and then Codex in a follow-up. The idempotency PR was significant: the script now detects which editors are already configured and skips them, so re-running after adding a new editor doesn't break your existing setup. The Codex integration required MCP streamable HTTP spec compliance — Codex uses a slightly different endpoint format than Claude Desktop.

Tool permissions got a full schema update: tools now declare what they need (filesystem access, network calls, etc.), there's an approval flow for first-time use, and the dynamic discovery system enriches tool metadata at install time. The compose package landed too, which lets you build higher-order tools out of primitives.

The omega UI — the agentic chat interface inside tpmjs — went through three redesigns in two weeks. First iteration: brutalist command center aesthetic. Second: sleek modern agentic aesthetic. The chronological rendering of multi-step tool calls was broken — tool call results were appearing before their invocations, which made the conversation unreadable. Fixed by storing messages with strict ordering metadata and rendering from a sorted timeline. Error surfaces for API key decryption failures went to the UI instead of dying silently in the server.

```typescript
// The chronological fix: store events with sequence numbers
// and reconstruct the timeline client-side
type ConversationEvent = {
  sequenceNum: number;
  type: 'message' | 'tool_call' | 'tool_result';
  // ...
}
```

**Results:** The install.sh script went from handling 2 editors to 10. The idempotency check is based on config file presence + a marker comment, verified manually across Claude Desktop, Cursor, and Codex. The tool permissions schema and approval flow shipped with 2299 lines added across DB migrations, API routes, and UI — measured by the commit diff. Discord #tpmjs gets a notification on each new user signup.

**Pitfalls / What Broke:** The omega UI had an animation library causing a white screen on load — removed it. The useSearchParams hook on the setup page was causing a React hydration error because it wasn't wrapped in Suspense. The Codex TOML config format is subtly different from Claude Desktop's JSON format, and I got the auth header structure wrong on the first pass — it uses a `[headers]` section, not inline auth. The `callbackUrl` parameter on the sign-in page wasn't being respected, so OAuth redirects sent users to the homepage instead of back to setup.

**Next:**
- Ship the compose package publicly and document how to build compound tools
- Instrument tool invocation telemetry so publishers can see which tools are actually being used
- Make the omega UI handle streaming tool call results (currently batches on completion)

---

## symploke — 3D Jenga + GitHub Mates: Two Apps That Shouldn't Work But Do

**Problem:** symploke was missing two things: a compelling demo of what dependency graph visualization could look like in 3D, and a social feature to justify why you'd care about your dependency graph in relation to other developers. I wanted something playful for the former and something slightly uncanny for the latter.

**Approach:** The Jenga game uses React Three Fiber + Rapier physics to render a tower of dependency blocks in 3D. Each block represents a package; you can drag blocks out with mouse interaction and watch the tower fall. The physics implementation went through many iterations:

- First try: spring-damper drag (blocks flew upward when released)
- Second try: face-normal push mechanics with a power slider (better, but blocks were flipping the whole stack on click-hold)
- Fix: zero the rigid body interaction when idle, cap velocity during drag, lock Y velocity to zero
- Final: anti-gravity restored only when the dragged block is sinking, lower friction coefficients, lighter blocks

The tower collapse on page load was its own bug — the tower would fall over instantly before the physics settled. Fixed by deferring the initial physics activation.

GitHub Mates uses BullMQ jobs to crawl a user's GitHub profile and find other users with similar tech stacks. The matching is AI-driven (narrative match + teaser prompt), with results cached behind a background job queue to avoid GitHub API rate limits. Each profile page shows the raw activity data and full match reasoning. OG meta tags on all mates pages for link previews.

The UI redesign used a proper design system throughout — no more one-off button styles, consistent focus rings using `outline` instead of `box-shadow`, gap-based layout for input+button pairs. Dark mode toggle shipped.

**Results:** The Jenga app went from zero to playable in the two-week window — measured by the fact that it's live and the tower no longer immediately collapses. The mates app handles the full pipeline from GitHub username → crawl job → profile match → display, with deduplication on BullMQ jobs (fixed a bug where the same username would queue multiple crawl jobs). The R3F ecosystem was upgraded to React 19 compatible versions after a version incompatibility broke builds. CVE-2025-55184 in Next.js was patched.

**Pitfalls / What Broke:** The `split()` call in the mates crawler was hitting `undefined` values in the activity data and crashing — fixed with null guards. The physics is still not perfect: very slow block pushes occasionally cause the tower to destabilize in weird ways because the collision detection at near-zero velocity is noisy. The Jenga "how to play" overlay exists because the drag mechanics are not immediately obvious.

**Next:**
- Add package metadata to Jenga blocks (version, weekly downloads) so it's actually informative, not just chaotic
- Make the mates matching more engineering-signal-dense — currently biased toward language stack, should weight commit patterns and repo topics more
- Wire Jenga into live npm registry data instead of static fixtures

---

## jsonresume.org — Monorepo Hygiene and CLAUDE.md Optimization

**Problem:** The turbo.json and .env.example were out of sync with the actual Vercel environment variables being used in deployment. The CLAUDE.md was 600-token bloated with redundant context that was slowing down every AI-assisted operation in the repo.

**Approach:** Two commits, no drama. First: synced the Vercel env keys into turbo.json's `globalEnv` array and updated .env.example to match the full set of expected variables. This matters because turbo uses the env key list to determine cache invalidation — missing a key means cache hits when there should be misses, or vice versa. Second: condensed the CLAUDE.md from its previous length down to ~600 tokens by removing redundant sections and keeping only the high-signal instructions.

**Results:** +35/-10 on the env sync commit, +61/-942 on the CLAUDE.md condensation — that -942 is the kind of number that makes you question what the original file even contained. Measured by token count in the CLAUDE.md commit message.

**Pitfalls / What Broke:** Nothing broke, which for a config sync commit is either good engineering or luck. The CLAUDE.md trim is a one-way operation — if any of the removed context was load-bearing for specific AI workflows, I won't know until those workflows fail.

**Next:**
- Audit cache hit rates in turbo after the env key sync to verify the fix worked
- Nothing major in this repo this week — it's in maintenance mode while alpha2 gets all the attention

---

## omega — Right to be Forgotten

**Problem:** Users of the omega platform (an agentic AI system with persistent profiles) had no way to delete their data. GDPR and general good-faith data handling requires a deletion path. The first implementation PR had a duplicate metadata entry in the tool definitions — two `deleteMyProfile` entries in the index, which would cause ambiguous tool resolution.

**Approach:** Two PRs (one from an external contributor, one fix pass). The feature adds a `deleteMyProfile` tool that cascades deletion across the user's profile data, uploaded files, and associated records. A deduplication safety net was added to the tool loader to catch future duplicate metadata entries before they cause runtime issues.

```typescript
// Deduplication safety net in toolLoader
const seen = new Set<string>();
const deduped = tools.filter(t => {
  if (seen.has(t.name)) return false;
  seen.add(t.name);
  return true;
});
```

File uploads (foxhop's backstory and profile image) also landed this week — the file index gets updated automatically on upload.

**Results:** The deletion feature shipped across two PRs: 354 lines added in the first, 379+/-198 in the second (which refactored the implementation after review). The dedup safety net catches duplicates before dispatch, verified by the commit that removed the actual duplicate entry.

**Pitfalls / What Broke:** The duplicate metadata entry was caught in review rather than by a test. The tool loader is trusted to deduplicate at runtime now, but the root cause (easy to accidentally add a duplicate entry to a flat JSON index) isn't fixed — it's just mitigated.

**Next:**
- Add a CI check that validates tool index uniqueness
- Consider moving the tool metadata from flat JSON to a directory-based format where each tool owns its own file

---

## pokemon-games — One Commit

**Problem:** Something needed to change.

**Approach:** One commit.

**Results:** One commit happened. I didn't catalog what it was, and the activity data labeled this a "minimal activity / dependency or config change" repo.

**Pitfalls / What Broke:** Unknown.

**Next:**
- Probably nothing, unless I get the urge to write a Pokémon AI at 2am

---

## What's Next

- **nanochat end-to-end**: Run the full post-training pipeline on alpha2 with a real dataset and measure whether the fine-tuned model actually follows instructions better than the base model. If it does, write about what the training data distribution looks like.
- **tpmjs tool telemetry**: Publishers need to know if anyone is using their tools. Add invocation counts and error rates to the registry dashboard.
- **symploke Jenga + live data**: Swap static package fixtures for live npm registry queries — make the tower represent an actual project's dependency tree.
- **alpha2 coop matmul in backward pass**: The forward pass gains (+14-28% on L4) are real. Getting the same gains in backward without NaN requires understanding exactly which memory access pattern causes the corruption.
- **alpha2 beam search**: Landed this week with a -4.86% tok/s cost. Whether that's worth the output quality improvement for the nanochat use case is an open question.
- **omega file index automation**: The current upload flow requires a manual index update commit. Automate this as part of the upload handler.
- **tpmjs compose package**: Document it properly and make it the default way to build compound tools, not a hidden package.

---

## Links & Resources

### Projects
- [alpha2](https://github.com/thomasdavis/alpha2) — Custom Vulkan GPU training stack for transformer models
- [tpmjs](https://github.com/tpmjs/tpmjs) — Tool Package Manager for AI agents
- [symploke](https://github.com/thomasdavis/symploke) — Dependency graph visualization, Jenga game, and GitHub Mates
- [jsonresume.org](https://github.com/jsonresume/jsonresume.org) — Open standard for machine-readable resumes
- [omega](https://github.com/thomasdavis/omega) — Persistent agentic AI platform

### Tools & Services
- [Rapier](https://rapier.rs/) — Rust physics engine, used for the Jenga tower simulation
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — React renderer for Three.js
- [BullMQ](https://docs.bullmq.io/) — Redis-backed job queue, used in symploke for profile crawl jobs
- [Turborepo](https://turbo.build/repo) — Monorepo build system with caching
- [Railway](https://railway.app/) — Deployment platform for alpha2 and tpmjs web services
- [Vulkan / WebGPU WGSL](https://www.w3.org/TR/WGSL/) — Shading language used for all custom GPU kernels in alpha2
