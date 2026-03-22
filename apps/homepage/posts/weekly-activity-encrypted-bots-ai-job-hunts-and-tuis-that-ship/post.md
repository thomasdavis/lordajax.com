# A Week of Encrypted Bots, AI-Ranked Job Hunts, and TUIs That Actually Ship

*187 commits across 8 repos and a growing suspicion that everything I build is secretly the same tool.*

The thread running through all of this: I'm building a layered stack of AI-native developer utilities that quietly depend on each other. The job search CLI uses Claude Code skills. The autonomous coding agent now has a proper session model. The personal agent (Omega) got end-to-end encrypted messaging over SSH. The tool registry for AI agents pushed toward a Product Hunt launch. None of these are standalone toys — they're pieces of a workflow where agents talk to agents, tools are versioned like npm packages, and the developer interface is a TUI instead of a browser tab. I'm not sure I planned it that way, but here we are with ~45k lines added in two weeks.

## Why You Should Care

- **`@jsonresume/jobs` CLI hit v0.14.1** — a full terminal job search browser with HyDE embeddings, LLM reranking, dossier research via Claude Code, and a split-pane TUI built on React Ink
- **8gent-code's agent monolith got decomposed** into focused modules, gained a proper session spec (v2), background process management, loop detection, and a headless CLI harness
- **Omega got SSHMail** — an encrypted messaging tool that sends/receives messages via `ssh.sshmail.dev`, with the private key baked into Railway env vars (after several commits fighting base64 encoding edge cases)
- **tpmjs** pushed to launch-ready with a master MCP registry server, a full CLI reference docs page, blog post about MCP vs CLI vs REST, and security/SEO polish for Product Hunt
- **mobtranslate.com** got a complete visual redesign with warm earth tones, 458 new tests, and 4 new language games
- **8gent-code's TUI** went from fake processing simulations to real agent event streaming, with a Ctrl+B background process sidebar and always-visible input

---

## jsonresume.org — The Job Search CLI That Got Serious

**Problem:** The job search feature existed but was basically "here's a list of jobs, good luck." No intelligent ranking, no way to research companies in-depth, no persistent state between sessions, no decent terminal interface.

**Approach:** Over 74 commits (31 features, 29 fixes), I rebuilt the entire job search stack from scratch. The ranking pipeline now does two passes: an initial fast pass with vector similarity, then optional HyDE (Hypothetical Document Embeddings) and LLM reranking as background tasks. The TUI was built with React Ink and has evolved through about 10 version bumps in two weeks.

The dossier feature is the most interesting part. When you hit `d` on a job, it kicks off a Claude Code CLI session that researches the company and writes a structured dossier to disk. Status icons appear in the job list so you can see which companies you've already researched. You can switch between multiple dossiers without restarting the CLI — that was a four-commit fight (`347c337`, `1f76d2a`, and two more).

The analytics report ended up being substantial: 8 new analytics sections added in `c3e8d0c`, covering skill matching, pipeline throughput, and job source breakdown. `df008bc` added the initial full-page report (+3394 lines, which tells you how much data the pipeline was sitting on but not surfacing).

The API went from a 100-job limit to 500 in `0b8d079`. The `/export` vector similarity endpoint for resume search landed in `c7aa943`. The auto-login flow in `8c5b6b1` means `npx @jsonresume/jobs` just works without manual token setup.

```bash
npx @jsonresume/jobs browse          # interactive TUI
npx @jsonresume/jobs report          # analytics report
npx @jsonresume/jobs search "backend engineer remote"
```

**Results:** The package hit v0.14.1 — version numbers are tracked in the package.json, so that's 14+ minor versions in two weeks. The job list now loads in two passes: fast initial results within a few seconds, reranked results appearing in the background. Measured by watching the TUI status bar update.

**Pitfalls / What Broke:**
- The dossier export kept crashing in several different ways: filename too long (ENAMETOOLONG), file not writing, crash on exit when processes were still running. Fixed across `7b23fd8`, `5b156f6`, `a5c2042`. Still probably has edge cases.
- `pgvector` returns embeddings as strings, not float arrays. Negative feedback was silently broken until `1e495a8` caught the type mismatch.
- CI kept failing because the TypeScript types weren't happy with nullable fields — fixed by switching to a nullable schema for OpenAI structured outputs in `c2809df`.
- `HyDE` + reranking caused request timeouts for some users. Made them opt-in in `07bdb1c`. The tradeoff is real: better results vs. 3-second wait.

**Next:**
- Make the dossier research faster (currently spawns a full Claude Code session, which has significant startup overhead)
- Add team/culture scoring from dossier data into the ranking signal
- Persist negative feedback vectors properly — the fuzzy matching in skill adjacency was a band-aid

---

## 8gent-code — Autonomous Coding Agent Gets Structure

**Problem:** The agent was a 3421-line monolith (`agent.ts`) that had grown past the point where you could reason about it. No session persistence, no loop detection, no way to run it headlessly for testing, and the TUI was simulating fake processing instead of streaming real events.

**Approach:** The big refactor landed in `ffa58c9` — decomposing the monolith into focused modules. This wasn't cosmetic; it was necessary to add session persistence without the whole thing collapsing.

Session spec v2 (`ff15a21`, +1256 lines) introduced a proper data model aligned with the Vercel AI SDK's message format, so sessions could be stored to disk and replayed. The debugger app (`9070d26`) gives you a browser UI to inspect past sessions, and `735fd87` added Copy as JSON and URL-based session routing.

The harness CLI (`3bb6751`, +1324 lines) was the other major add — a headless way to run 8gent sessions programmatically and check results. This enabled the `--task` flags (`da80155`, `3790e84`) for running structured benchmark tasks like "build a Next.js hello world" and seeing whether the agent actually completes them.

Loop detection (`8389846`) works by keeping a lightweight run log and watching for repeated tool calls with the same arguments. The agent also got a "orient first" rule (`5fec4bb`): always `list_files` before making any path assumptions. I added this after watching the agent confidently write to paths that didn't exist.

The TUI refactor is its own saga:
- `116e3ef`: non-blocking agent with always-visible input
- `cac7076`: wire real agent events into UI (replacing fake simulation)
- `85e3adc`: `useLayout` hook for centralized panel/pane state
- `1eb724a`: Ctrl+B to toggle a background process panel (+505/-4)
- `1011ff8`: make the process panel a right sidebar instead of full-screen

**Results:** The agent can now sustain multi-turn conversations with full history (`4349959`). Background task promotion is automatic — if a command runs longer than a threshold, it gets moved to the background process panel without blocking the UI. Loop detection measurably prevents runaway sessions (verified by watching the run log fill up without triggering infinite tool calls).

**Pitfalls / What Broke:**
- `z-ai/glm-5` model support was added for the harness but the full-stack task (`da80155`) is explicitly flagged as "a task 8gent cannot do yet" — which is honest documentation that the benchmark currently fails
- The TUI color system was using theme-unsafe hex colors throughout. `b510962` replaced them with `dimColor`/`bold` across all components — should have done this earlier, the visual glitches were embarrassing
- `.env` loading order: the TUI was looking for env files relative to the binary's location, not the current directory. `dee85cd` fixed this but it took too long to catch

**Next:**
- Get the fullstack task passing — that's the real benchmark
- The debugger app needs a diff view between session versions
- Connect 8gent's session model to tpmjs so tool calls are logged centrally

---

## omega — Personal Agent Gets Encrypted Mail

**Problem:** Omega (my personal AI agent) had no secure communication channel. If I wanted to send it a task while away from my machine, I had to either use an API key in plaintext or not do it at all.

**Approach:** SSHMail (`dcc406f`, +400 lines) is a tool that wraps `ssh.sshmail.dev` — it uses your SSH private key to send and receive end-to-end encrypted messages. The implementation lives in `sshmail.ts` and exposes `send_message` and `read_inbox` as agent tools. The inbox by default only shows unread messages; `8e17cee` added an `includeRead` param to show everything.

Railway's environment variables store the private key, which sounds fine until you discover that Railway URL-encodes some characters and base64-encodes others depending on which UI you used to set the variable. Three commits (`a8eb665`, `1aad20f`, and a fix in `8e17cee`) went into making the key parsing actually bulletproof. The final approach tries raw, base64-decoded, and URL-decoded variants in order.

The expert panel system (`d6fbe2f`, +4102/-731) is a different beast: 11 AI "expert" personas that independently analyze a user profile and synthesize their takes. This is **not** psychological diagnosis — it's structured prompting for building richer profile summaries, all opt-in and deletable. The data model originally used `z.record()` which turned out to be incompatible with how the synthesis results were being consumed — `6b198ae` switched it to `z.array()`.

The profile UI got a substantial polish pass in `108f5af` (+340/-99): tab bar overflow fixed, gallery layout improved, null states handled properly. Before this, empty profile sections showed broken layout.

**Results:** Omega now has a working inbox. You can send an encrypted message from any machine with your SSH key, and the agent will read it in its next cycle. The key parsing handles at least 4 different Railway environment variable encoding scenarios (manually tested by setting the key through different Railway UI paths).

**Pitfalls / What Broke:**
- The expert panel analysis is compute-heavy — 11 parallel AI calls per profile synthesis. No rate limiting yet, which will matter at scale
- `MetaSynthesisSchema` schema change (`z.record` → `z.array`) was a breaking change on existing stored data. Anyone with cached synthesis results would hit a parse error until the data was regenerated
- The file index commits (`157a4e3`, `9a5026f`, `2f69d45`) are automated uploads that bulk up the commit count but aren't feature work — just artifact tracking

**Next:**
- SSHMail reply threading (currently sends flat messages with no thread context)
- Expert panel synthesis caching — regenerating 11 experts every profile load is wasteful
- Comics/blog page was fixed (`f7b7adf`) but the underlying image generation pipeline still needs more resilience

---

## tpmjs — Tool Package Manager for AI Agents Approaches Launch

**Problem:** tpmjs (think: npm for AI agent tools) had the core functionality but wasn't ready for public launch — no blog, incomplete docs, auth gaps, and enough lint errors to fail CI.

**Approach:** The two-week push was pure launch prep. The MCP server (`d011ead`, +635 lines) exposes the entire tpmjs registry as an MCP endpoint — you can point any MCP-compatible client at it and get tool search/execution. The CLI got a `--search` flag for collection management (`18ac53e`) and a full reference docs page (`fe21ff2`, +871 lines).

The blog post on MCP vs CLI vs REST (`ccca801`, initial +440 lines, then heavily revised in `f49026c`) went through three or four rewrites. The final version has counter-arguments and honest concessions rather than pure advocacy — `eb5646f` added logging/observability and `4ca39e2` added the security angle. The `adc4728` commit added Claude Code example prompts to the protocol section, which is meta in a good way: the blog about AI tool protocols now has AI tool usage examples.

Auth got tightened: `79d9087` allows unauthenticated tool search, `d05fadf` allows unauthenticated MCP discovery (initialize, tools/list), and `28c6438` fixed a mismatch between the CLI's expected endpoint format and what the API was serving. The pattern is "read is free, execute requires auth" which is the right default.

`85a8db4` (+912/-305) was the big production-ready sweep: SEO meta tags, security headers (CSP, HSTS, X-Frame-Options), copy review, and dependency audit. Separately, `14ea45d` added `Permissions-Policy` and `X-Permitted-Cross-Domain-Policies` headers. Then `dbaa3b4` had to revert some of the security headers because they were breaking the Vercel deploy — security hardening meets platform constraints.

**Results:** CI now passes. The MCP server endpoint is live. The blog post is published with actual research data in the comparison matrix. The package resolves collection slugs properly (`b312c07`, which also deleted 2148 lines of old code — always satisfying when a fix removes more than it adds).

**Pitfalls / What Broke:**
- Security headers broke the Vercel deploy — specifically the headers that Vercel sets itself were conflicting with `vercel.json` overrides. The revert in `dbaa3b4` is a partial fix; the right approach is probably to use `next.config.js` headers instead
- The auto-merge pipeline (`70614b0`) added issue closing but it's unclear if the labels are wired correctly end-to-end
- Pre-existing lint and architecture errors in `f07bef1` took a dedicated commit to resolve — the kind of debt that accumulates when you're shipping fast

**Next:**
- Product Hunt / Hacker News launch (the `85a8db4` commit message explicitly says this was the goal)
- Connect tpmjs tools to 8gent's tool execution pipeline
- The skills.md platform doc (`cb81b09`) needs a proper landing page, not just a markdown file

---

## mobtranslate.com — Complete Redesign + Test Suite

**Problem:** mobtranslate.com (a platform for Australian indigenous language translation) was visually inconsistent, had dark/light mode contrast bugs, and had zero automated tests. The translator widget was bright white in dark mode, hero text was unreadable, and the mobile menu had an offset problem.

**Approach:** The visual redesign (`9473c79`, +3966/-2396) replaced everything with a warm earth-tone design system — terracotta, sandstone, ochre. The goal was something that felt appropriate for indigenous language content rather than generic SaaS blue.

From a dark mode perspective, the fixes were surgical: `549090b` tackled homepage and translator contrast issues, `60be413` replaced broken `white/opacity` Tailwind syntax with explicit `rgba()` values (apparently the shorthand doesn't work in all contexts), `8d44d47` changed the translator textarea from bright white to subtle dark, and `37edc6b` bumped up white opacity values in the hero for readability. That's four commits for one dark mode pass, which is pretty normal.

The test suite (`f87f09e`, +5739/-9) landed at 458 tests with CI integration. The CI integration required `47dd8ff` to defer env var checks in the embedding generation module — previously the module would throw at import time if environment variables weren't set, which broke the CI build step.

Four new language games landed in `110ac44` (+1669/-136). The major codebase cleanup in `b108dd3` (+544/-636) addressed security issues, logging, edge cases, and accessibility — that net negative line count is a good sign.

**Results:** 458 tests now run in CI (count comes from the test suite's output, verified by the `f87f09e` commit message). The dark mode contrast issues are fixed across the three main surfaces (hero, translator, dashboard). The CI build passes.

**Pitfalls / What Broke:**
- `TypeScript` had issues with `_node` prop and `initialLiked` prop interfaces (`5781c1e`) — these were pre-existing but surfaced when the redesign changed component boundaries
- `Select` component had a case-sensitive import that only failed on Linux CI (`08dd4ac`) — classic local-works-fine-CI-fails
- Unauthenticated users were hitting the dashboard and getting a blank page instead of a sign-in prompt — `0c62377` added the redirect, but it probably should have been there from the start

**Next:**
- The earth-tone design system needs to be documented as a style guide
- Language games could use difficulty settings — currently all games are the same complexity level
- The embedding generation pipeline needs load testing with the new CI env var handling

---

## daimon, alpha2, styleguide-skill — Keeping the Lights On

These three repos had minimal activity (3, 2, and 3 commits respectively) — mostly dependency updates and config changes based on the low-signal designation.

**daimon** (3 commits): No detail in the activity summary, likely dependency bumps or environment config.

**alpha2** (2 commits): Same — minimal activity, likely housekeeping.

**styleguide-skill** (3 commits): Given the name and the week's theme, probably had some style guide updates fed from the tpmjs or 8gent work. No breaking changes expected.

The honest assessment: these repos exist in the ecosystem but weren't the focus this sprint. They'll probably get attention when the larger projects need something specific from them.

---

## What's Next

- **Connect the ecosystem**: 8gent's session model + tpmjs tool registry should be wired together so tool calls are centrally logged. Right now these are two separate surfaces for the same concept.
- **Job search dossier performance**: the Claude Code CLI spawn for dossier research has too much startup overhead. Either pre-warm it or replace it with a direct API call.
- **SSHMail threading**: flat messages work but any real async workflow needs thread context — subject lines, reply-to chains, something.
- **tpmjs public launch**: the code is ready, the blog post exists, the MCP server is running. Ship it.
- **8gent fullstack task**: the headless harness can now run benchmark tasks. The `--task fullstack` flag exists but explicitly fails. Making it pass is the current north star for agent capability.
- **mobtranslate test coverage**: 458 tests sounds like a lot until you look at what's tested — mostly API routes. The TUI components and the translator widget logic are mostly untested.
- **Omega expert panel caching**: 11 AI calls per synthesis is not going to scale. Even a 1-hour TTL cache would cut 95% of the compute.

---

## Links & Resources

### Projects
- [jsonresume.org](https://github.com/jsonresume/jsonresume.org) — JSON Resume monorepo
- [8gent-code](https://github.com/PodJamz/8gent-code) — Autonomous coding agent
- [omega](https://github.com/thomasdavis/omega) — Personal AI agent
- [tpmjs](https://github.com/tpmjs/tpmjs) — Tool Package Manager for AI agents
- [mobtranslate.com](https://github.com/australia/mobtranslate.com) — Indigenous language translation platform

### NPM Packages
- [`@jsonresume/jobs`](https://www.npmjs.com/package/@jsonresume/jobs) — Terminal job search CLI, now at v0.14.1

### Tools & Services
- [ssh.sshmail.dev](https://ssh.sshmail.dev) — Encrypted messaging over SSH (used in Omega SSHMail integration)
- [React Ink](https://github.com/vadimdemedes/ink) — React for CLIs (used in `@jsonresume/jobs` TUI)
- [Vercel AI SDK](https://sdk.vercel.ai) — Used throughout for LLM integration (the `generateText` import pattern)
- [Railway](https://railway.app) — Deployment platform for Omega (source of several env var encoding fights)

### Inspiration
- HyDE (Hypothetical Document Embeddings) — the embedding technique behind the job search reranking. The original paper is from Precise Zero-Shot Dense Retrieval Without Relevance Labels (Gao et al.)
