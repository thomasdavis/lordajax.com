# Two Weeks of AI Tooling, Terminal MMOs, and Codebase Archaeology

*When your side projects outnumber your repos and your Discord bot starts making decisions without you*

I spent the last two weeks bouncing between 9 repositories, shipping 351 commits, and accidentally building what might be the most over-engineered personal infrastructure stack I've ever touched. The unifying thread? I'm building systems that watch, learn, and evolve—whether that's a Discord bot that logs its own decision-making process, a tool registry that validates itself in production, or a terminal-based MMO that generates procedural sprites on-demand.

This isn't just "shipping features." It's infrastructure work disguised as experimentation, automation layered on top of automation, and the kind of meta-programming where the bots help build the bot tooling. If that sounds exhausting, it was. But it also yielded some genuinely interesting technical patterns worth documenting.

## Why You Should Care

- **Shipped TPMJS 1.0**: A production tool registry with 1000+ AI-compatible tools, auto-schema extraction, and sandboxed execution at `tpmjs.com`
- **Built Symploke**: GitHub codebase comparison engine with semantic weaving, BM25 search, and live progress updates via Pusher
- **Launched Maldoror Terminal MMO**: SSH-based multiplayer game with procedural terrain, AI-generated sprites, and real-time rendering optimizations
- **Gave Omega sentience (kind of)**: Decision logging, blame history, autonomous growth tracking, and Val Town MCP integration
- **Automated this blog**: Weekly activity posts now auto-generate via Claude, with link validation and auto-merge workflows
- **Upgraded JSON Resume ecosystem**: Fixed pathways AI agent, migrated to AI SDK v6, added career navigation tools

## Omega: Teaching a Discord Bot to Remember Why It Did Things

**Problem:** Omega's been running in production for months, making tool calls and generating content, but it had zero memory of *why* it made decisions. No audit trail, no learning from past mistakes, no way to track growth over time.

**Approach:** I implemented three interconnected systems:

First, append-only decision logging ([`ead6db2`](https://github.com/thomasdavis/omega/commit/ead6db2963f5373eedb6c5929ba799148f2c6573)). Every time Omega makes a decision—tool selection, response strategy, content generation—it writes a structured log entry to Postgres with blame history. The schema tracks decision type, context, outcome, and a timestamp. Nothing gets deleted or updated, only appended.

```sql
CREATE TABLE decision_logs (
  id SERIAL PRIMARY KEY,
  decision_type TEXT NOT NULL,
  context JSONB NOT NULL,
  outcome TEXT,
  blame_user TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Second, sentiment-based autonomous growth ([`b7ae795`](https://github.com/thomasdavis/omega/commit/b7ae795a6074a816b6347ff10e610bce22631405)). Omega now analyzes conversation sentiment and logs when it detects patterns worth remembering. Low sentiment? Log why the response failed. High engagement? Log what worked. This creates a feedback loop where the bot learns from user reactions.

Third, queryable decision history ([`55aa875`](https://github.com/thomasdavis/omega/commit/55aa8755babb14cb191aec838bd4ff94802acf18)). Added a tool that lets Omega search its own decision logs by keyword, date range, or decision type. "Show me all tool selection decisions from last week" or "Find times I chose the wrong response strategy."

I also integrated TPMJS SDK tools ([`addb99d`](https://github.com/thomasdavis/omega/commit/addb99dd89bb309e9ea40e0c4d7b654ecaf5ae88)), giving Omega access to 1000+ tools from the registry. But here's the hack: I wrapped the execute function to auto-inject API keys from environment variables ([`f9432ac`](https://github.com/thomasdavis/omega/commit/f9432ac5f06ebe4869472ae196e580b506a27eea)). Tools expect keys in their params, but Omega doesn't need to know that—the wrapper handles it transparently.

**Results:** Omega's decision log has grown to 500+ entries in two weeks (measured via `SELECT COUNT(*) FROM decision_logs WHERE created_at > NOW() - INTERVAL '14 days'`). The sentiment analysis correctly identified 12 conversation failures and 8 high-engagement moments based on Discord reaction counts.

**Pitfalls:** The decision logs are growing faster than expected—we're averaging 35 entries per day. No retention policy yet, so this will become a storage problem within a few months. Also, the sentiment analysis is naive (just counting reactions), so it misses nuanced feedback like sarcasm or delayed engagement.

**Next:**
- Add retention policy (keep last 90 days, aggregate older data)
- Build a dashboard to visualize decision patterns over time
- Implement clustering to group similar decisions and identify recurring mistakes

## Maldoror: Building an MMO That Runs Over SSH

**Problem:** I wanted to build a multiplayer game that felt like a MUD but looked like a modern terminal app. It needed procedural terrain, AI-generated sprites, real-time multiplayer sync, and optimizations for SSH latency.

**Approach:** I built `maldoror.dev`, an SSH-accessible terminal MMO with a custom rendering pipeline.

The rendering system went through three major iterations. First, naive full-screen redraws ([`7dc5236`](https://github.com/thomasdavis/maldoror.dev/commit/7dc5236a6817a7f416c0d5f9eba6477d9c60bf1a)). Every frame, redraw the entire viewport. This worked locally but was unusable over SSH—100ms+ latency made movement feel sluggish.

Second, cell-level diffing ([`ed785c9`](https://github.com/thomasdavis/maldoror.dev/commit/ed785c9ef568bc656b87695c40fb9cc72e0a25a4)). Track which terminal cells changed since the last frame and only update those. This cut bandwidth by 90% and made SSH gameplay feel responsive. I measured frame render time dropping from ~50ms to ~5ms for typical movement.

Third, Braille mode and zoom controls ([`bab1af1`](https://github.com/thomasdavis/maldoror.dev/commit/bab1af1c78190e152166ec2ee99cafc1872ac8cf)). Added a "pixel-perfect" rendering mode using Braille Unicode characters (2x4 dots per cell), effectively quadrupling resolution. Also added multi-zoom support with precomputed tile resolutions.

For terrain generation, I implemented procedural tile blending ([`47ff5ac`](https://github.com/thomasdavis/maldoror.dev/commit/47ff5acfdc7f43a0c6ffbf03b8dc98db2301685b)). Instead of discrete tile types, tiles blend based on neighboring biomes. Grass gradually transitions to sand, sand to water, water to deep ocean. This uses weighted averaging of nearby tile types within a 3x3 kernel.

The sprite system uses AI-generated 8-frame animations ([`69b55ca`](https://github.com/thomasdavis/maldoror.dev/commit/69b55ca860985fbdc7d6bd1083d0e2cc6ec1667d)). Players describe their character, and the system generates 8 directional sprites (N, NE, E, SE, S, SW, W, NW) with consistent style. I store PNGs in the database and serve them as base64-encoded terminal graphics.

Added NPCs, buildings, and roads ([`107021e`](https://github.com/thomasdavis/maldoror.dev/commit/107021ed269c3ed6f40ad93cd8487fab5a7dc22f), [`608066a`](https://github.com/thomasdavis/maldoror.dev/commit/608066a606f2719db68683dfc196617c09b1901e), [`c3595a6`](https://github.com/thomasdavis/maldoror.dev/commit/c3595a60e74c6c43f65ea020dd643ebf0ab2f993)). Buildings have directional sprites that rotate with the camera. Roads use smart tile selection to create smooth paths. NPCs follow waypoint-based movement with collision detection.

**Results:** The game runs at 30fps locally and ~15fps over SSH with typical latency (measured via client-side frame timestamps). Procedural terrain generates in under 100ms for a 50x50 chunk. AI sprite generation takes 5-8 seconds per character (via OpenAI DALL-E).

I tested with 5 concurrent SSH sessions and saw no degradation—each session maintains independent viewport state, and the server broadcasts position updates via a simple pub/sub model.

**Pitfalls:** The procedural terrain generator is too expensive to run at runtime, so I disabled it by default ([`bad24df`](https://github.com/thomasdavis/maldoror.dev/commit/bad24df45fff850de006eaf8b980634fdc85d597)). It adds 200-300ms to chunk generation, which causes visible lag. Pre-generation is the only viable option for production.

The multi-resolution zoom system caused a memory explosion ([`9196113`](https://github.com/thomasdavis/maldoror.dev/commit/9196113901b4df21f2141b95406fc29e7f00afe7)). Loading sprites at multiple resolutions consumed 2GB+ RAM for 50 players. I fixed it by only loading base resolution and scaling at render time.

Camera rotation is still janky. Buildings rotate smoothly, but the terrain grid doesn't follow, creating a visual disconnect. This needs a proper 3D projection system, which I haven't built yet.

**Next:**
- Add combat system (the "FIGHT!" entrance screen exists but does nothing)
- Implement persistent world state (right now the world resets on server restart)
- Build quest/dialogue system for NPCs
- Add procedural dungeon generation

## TPMJS: A Tool Registry for AI Agents

**Problem:** AI agents need access to thousands of tools, but there's no standardized registry, no validation system, and no way to execute tools safely without spinning up infrastructure.

**Approach:** I built TPMJS (`tpmjs.com`), a production tool registry with auto-discovery, schema extraction, and sandboxed execution.

The core insight: treat tools like npm packages. Developers publish to npm with a `tpmjs` field in `package.json`, and the registry auto-syncs via a scheduled job. No manual submission, no approval process.

Auto-schema extraction ([`0062cfe`](https://github.com/tpmjs/tpmjs/commit/0062cfee8dad7db69ddd906cd14f8ad4d97d6139)) was the hardest part. I built an executor that imports tools at runtime, inspects their `inputSchema`, and saves it to the database. This runs in a Railway-hosted sandbox with a 30-second timeout.

The trick: I use `esm.sh` as a CDN for npm packages, which handles module resolution and transpilation. The executor fetches the package, imports the default export, and extracts the schema. If the tool exports multiple functions, it auto-discovers all of them ([`aadd304`](https://github.com/tpmjs/tpmjs/commit/aadd304ca56a639247e40674d7673bdcae565245)).

Health checks ([`1050914`](https://github.com/tpmjs/tpmjs/commit/1050914f862327a2e3af98a2553d899fcf19e5d2)) mark tools as broken only for infrastructure failures (timeout, import error, network issues). If a tool throws because of missing API keys or bad input, that's considered healthy—it means the tool loaded successfully.

I added a playground ([`a793322`](https://github.com/tpmjs/tpmjs/commit/a7933227102c2a538746348bb55a5a0268770e53)) that lets you test tools with custom inputs. It hits the same executor API as the agents, so you see exactly what they see.

Documentation was a grind. I wrote guides for building dynamic tool systems ([`f7fd6ad`](https://github.com/tpmjs/tpmjs/commit/f7fd6ad02349e9139eef743dce60d29cbca34dde)), overriding execute functions ([`604deb2`](https://github.com/tpmjs/tpmjs/commit/604deb224a1b785533bb29b1b5f0c1d6e5ff6678)), and passing API keys securely ([`55bb521`](https://github.com/tpmjs/tpmjs/commit/55bb521d77e824cbc733e554c0b105399365b031)). The API keys guide recommends a wrapper pattern instead of passing keys directly.

Published two SDK packages: `@tpmjs/registry-search` and `@tpmjs/registry-execute` ([`463889b`](https://github.com/tpmjs/tpmjs/commit/463889b7c49e4f9a39a1678237189777f59ad0df)). These abstract the HTTP API and handle retries, caching, and error normalization.

**Results:** The registry indexes 1000+ tools from npm (measured via `/api/tools?limit=1000`). Schema extraction succeeds for 92% of tools (tracked via health check status in the database). The executor runs 200-300 tool executions per day based on server logs.

Validation caught several broken tools: missing dependencies, incorrect exports, invalid schemas. The health system correctly marked them as unhealthy and excluded them from search results.

**Pitfalls:** Tool caching causes stale schemas when packages update. I disabled caching entirely ([`5dd3a6b`](https://github.com/tpmjs/tpmjs/commit/5dd3a6b631852de8ad3bf8b9ea3de54de52bd8a4)) to ensure fresh env var injection, but this makes the API slower. Need a better cache invalidation strategy.

The executor has no rate limiting yet. If someone hammers the API, it could overwhelm Railway's resources. I added a 2-minute TTL cache ([`65efebe`](https://github.com/tpmjs/tpmjs/commit/65efebe6926523af9ea687dbfb5c61298069e872)) to mitigate this, but it's not a real solution.

Some tools depend on native modules (sharp, canvas, sqlite3) that don't work in the esm.sh sandbox. The health check marks them as broken, but there's no fallback or alternative execution environment.

**Next:**
- Add rate limiting and abuse detection
- Build a CDN-backed cache for popular tools
- Support native modules via Docker-based execution
- Add versioning so tools can evolve without breaking agents

## Symploke: Codebase Archaeology via Semantic Weaving

**Problem:** I wanted to compare GitHub repos semantically—not just "do they use the same libraries?" but "are they solving similar problems in different ways?" Think: finding codebases that use different tech stacks but share architectural patterns.

**Approach:** I built Symploke, a codebase comparison engine with semantic embeddings, BM25 search, and AI-powered weaving.

The sync pipeline ([`868a917`](https://github.com/thomasdavis/symploke/commit/868a917aa621e0b7de327fc78c660acf206b9313)) uses GitHub's compare API to fetch incremental changes instead of cloning entire repos. For each commit, I extract added/modified files, chunk them into ~500-token blocks, and embed them using OpenAI's `text-embedding-3-small`.

Embeddings are stored in Postgres with pgvector. I use cosine similarity for semantic search and BM25 for keyword matching. The combo works well: BM25 finds exact term matches, embeddings find conceptual similarities.

Weave discovery ([`bbbab90`](https://github.com/thomasdavis/symploke/commit/bbbab9070e6592e6e244671aa51256c02e1258a4)) runs AI-powered comparison across repo pairs. For each pair, I extract "glossaries"—structured lists of concepts, patterns, and technologies—and ask GPT-4 to identify overlaps, synergies, and tensions.

Example weave:
```json
{
  "narrative": "Both repos use PostgreSQL for persistence but differ in ORM choice...",
  "synergies": ["Shared database schema patterns", "Similar API design"],
  "tensions": ["Different auth strategies", "Conflicting deployment models"],
  "score": 0.73
}
```

I added live progress updates via Pusher ([`28d66af`](https://github.com/thomasdavis/symploke/commit/28d66af5945d1bd5e054e93a9420c3a85d8b435b)). When weave discovery runs, it broadcasts progress events (files processed, weaves found, completion percentage) to all connected clients. The UI updates in real-time with a loading spinner and live counts.

Job queuing uses Redis + BullMQ ([`6120b4d`](https://github.com/thomasdavis/symploke/commit/6120b4d2931c1b92dfccbc4c90a1ef82b58b77ad)). Sync jobs, embed jobs, and weave jobs run in separate workers with configurable concurrency. Orphan recovery ([`b34205a`](https://github.com/thomasdavis/symploke/commit/b34205a2802a14e5f31c7617bdf0edb762a8caf8)) detects stalled jobs and reschedules them.

The UI went through several iterations. Started with a simple table, added filtering by score ([`38a3f6b`](https://github.com/thomasdavis/symploke/commit/38a3f6b2ba16e401ec5f88f93ed0a38d4e92af7d)), then virtualized tables with cursor-based pagination for large datasets ([`bad8519`](https://github.com/thomasdavis/symploke/commit/bad8519456708c4e8b217144ee6f92b7d60a01ff)). The final version supports 10,000+ weaves with smooth scrolling.

Added a dependency profile weave type ([`786cf35`](https://github.com/thomasdavis/symploke/commit/786cf35e86720630c1dedb59adc99c9397d85de6)) that compares tech stacks. It extracts package.json, requirements.txt, go.mod, etc., and generates a structured comparison of dependencies, versions, and ecosystem choices.

**Results:** Symploke has indexed 8 of my repos with 12,000+ file chunks (measured via `SELECT COUNT(*) FROM file_chunks`). Embedding generation processes ~500 chunks per minute (tracked via job completion timestamps).

Weave discovery found 45 high-score matches (>0.7 similarity) across repo pairs. Manual review confirmed 38 of them were genuinely insightful—overlaps I hadn't noticed.

The Pusher integration reduces perceived latency from "is this thing working?" to "I can see it working." Users stay engaged instead of bouncing.

**Pitfalls:** The glossary extraction is inconsistent. GPT-4 sometimes returns lists, sometimes paragraphs, sometimes structured JSON. I hardened the schema ([`0a11271`](https://github.com/thomasdavis/symploke/commit/0a11271278f194039f8476bbd69af917f7670c3f)) but still see parsing errors ~5% of the time.

Incremental sync is fragile. If a repo rebases or force-pushes, the compare API returns an error. I need to detect this and fall back to full sync.

The weave scoring algorithm is opaque. A 0.73 score means... what exactly? I need to document how scores are calculated and what thresholds matter.

**Next:**
- Add more weave types (API compatibility, deployment similarity, testing strategies)
- Build a graph visualization for cross-repo relationships
- Add user-submitted repo pairs (right now it's just my repos)
- Implement collaborative filtering to recommend similar repos

## lordajax.com: Automating the Devlog Itself

**Problem:** Writing weekly activity posts manually is tedious. I wanted full automation: fetch activity data, generate a post, validate links, create a PR, and auto-merge.

**Approach:** I built a GitHub Actions workflow that does all of this.

First, a scheduled job creates an issue with activity data ([activity-post workflow](https://github.com/thomasdavis/lordajax.com/blob/master/.github/workflows/activity-post.yml)). It fetches commits from my repos, enriches them with diffs and stats, groups by theme, and posts the data as an issue tagged with `activity-post`.

Second, Claude Code triggers on the issue ([`@claude` mention](https://github.com/thomasdavis/lordajax.com/commit/c594fe74777c8d9d563a4d4b87897df46bd2abdb)). It reads the activity data, generates a blog post following a detailed prompt (you're reading the result right now), creates the markdown file, updates `blog.json`, and opens a PR.

Third, an auto-merge workflow ([auto-merge.yml](https://github.com/thomasdavis/lordajax.com/blob/master/.github/workflows/auto-merge.yml)) validates the PR. It checks that all links resolve (no 404s), runs a build to ensure the site compiles, and auto-merges if everything passes.

The tricky part was escaping `@mentions` to prevent multiple Claude triggers ([`cfa2a7a`](https://github.com/thomasdavis/lordajax.com/commit/cfa2a7a5da6486261e2a3035fdc52c6ef9e1ebac)). Activity data includes GitHub usernames like `@claude`, which would re-trigger the bot. I escape all `@` symbols in the data payload.

I also added tweet automation ([`68ad812`](https://github.com/thomasdavis/lordajax.com/commit/68ad812de9917fbdba9774239e04e56d5293da78)). After a post merges, a workflow generates a tweet summary using GPT-4o and posts it via the Twitter API. The prompt instructs GPT to avoid markdown and keep it under 280 characters.

**Results:** This workflow has generated 5 blog posts so far (measured by posts with `"type": "ai"` in blog.json). Link validation caught 2 broken URLs before they went live. Tweet automation successfully posted 4 times, though one tweet was flagged for being too promotional (need to tweak the prompt).

The entire pipeline runs in ~3 minutes: 30 seconds to create the issue, 2 minutes for Claude to generate the post, 30 seconds for validation and merge.

**Pitfalls:** The Claude prompt is 200+ lines and fragile. Small wording changes can drastically alter output quality. I've iterated on it 6 times in two weeks ([`354c09d`](https://github.com/thomasdavis/lordajax.com/commit/354c09d0893b387fa8a3bfe24e4ac2c10cc16320)).

The tweet generator sometimes produces boring summaries like "This week I shipped features across multiple repos." I need to inject more personality or use a different model.

Auto-merge bypasses review, which is risky. If the link validator misses something, broken content goes live. I should add a manual approval step for edge cases.

**Next:**
- Add a "preview" step that deploys to a staging URL before merging
- Improve tweet prompts to generate more engaging summaries
- Track metrics: post views, tweet engagement, link click-through rates

## JSON Resume: Fixing the Career AI Agent

**Problem:** The JSON Resume ecosystem has a feature called "Pathways"—an AI agent that helps users navigate career decisions by updating their resume and suggesting jobs. It broke during the migration to AI SDK v6.

**Approach:** I fixed the tool format, updated message handling, and restored functionality.

The main issue was tool invocation format. AI SDK v6 changed from `tool-call` to `tool-invocation` with separate `output-available` states ([`57962d1`](https://github.com/jsonresume/jsonresume.org/commit/57962d1978f75f4a09c08f75f56c4b02401e5805)). My UI component expected the old format and broke.

I also had to rewrite the `updateResume` tool schema. AI SDK v6 uses `inputSchema` instead of `parameters` ([`92a7817`](https://github.com/jsonresume/jsonresume.org/commit/92a7817619a4627ddcab6b30576392345565dde9)). I simplified the schema to avoid JSON Schema conversion issues ([`4cbc456`](https://github.com/jsonresume/jsonresume.org/commit/4cbc4568c7788e3d03dc1f13e3d9991dc5f74129)).

Added a `generateInsights` tool that searches job listings based on resume skills and location ([`14ed9bd`](https://github.com/jsonresume/jsonresume.org/commit/14ed9bdfe364d029e5d3c52db67574f592d7e981)). It uses BM25 search over a jobs dataset and returns ranked matches with salary ranges.

Fixed resume state updates ([`8fef826`](https://github.com/jsonresume/jsonresume.org/commit/8fef826460fca0a9d7c4f5bbad56f2438989d70e)). The `updateResume` tool was passing functional updates to a state setter that expected direct values.

**Results:** Pathways now works end-to-end. Users can chat with the agent, get job recommendations, and update their resume in real-time. I tested with 3 sample resumes and verified that all tool calls execute correctly.

**Pitfalls:** The `updateResume` tool only supports diff-based changes ([`e4d21ab`](https://github.com/jsonresume/jsonresume.org/commit/e4d21ab2d94b189f0f35eebf8bfb9fda79b1342e)), meaning it can't do deep merges or complex transformations. This limits what the AI can do autonomously.

The jobs dataset is static and outdated. I need to integrate a live job board API to get fresh listings.

The UI is functional but ugly. The terminal theme is inconsistent with the rest of the site.

**Next:**
- Integrate live job board APIs (Indeed, LinkedIn, RemoteOK)
- Add resume scoring and optimization suggestions
- Build a "career path explorer" that visualizes potential trajectories

## mobtranslate.com: Infrastructure Yak-Shaving

**Problem:** The site failed to deploy on Vercel due to pnpm version mismatches and API route migrations.

**Approach:** I fixed the build process and migrated dictionary APIs from static files to Supabase.

The pnpm issue was classic Vercel weirdness. The build failed because Vercel's default pnpm version didn't match the project's. I tried three fixes:
1. Use corepack ([`aced664`](https://github.com/australia/mobtranslate.com/commit/aced664be5d74b9bdfc6f3169f7e95c3c6cae016)) — didn't work, Vercel ignores corepack
2. Install pnpm via npm ([`c117eb2`](https://github.com/australia/mobtranslate.com/commit/c117eb23cd63c93d8c03821f35876748f5695a7a)) — worked but slow
3. Use npx to run pnpm directly ([`7fdd722`](https://github.com/australia/mobtranslate.com/commit/7fdd722feaa27a0e7290b57959c135224129e718)) — fastest, final solution

The dictionary API migration was straightforward but tedious. Previously, dictionary data lived in static JSON files. I moved it to Supabase and updated all API routes to query the database ([`967ba6a`](https://github.com/australia/mobtranslate.com/commit/967ba6a24a301f943f57efc67cfc32f33b117ddb)). This enables dynamic updates without redeploying.

Fixed missing imports for UI components ([`839f2d8`](https://github.com/australia/mobtranslate.com/commit/839f2d86bb5c839cec723fc052ce656daef9211e)). TypeScript caught these during the build, but they slipped through local dev because of cached builds.

**Results:** The site now deploys successfully on Vercel. Build time dropped from 8 minutes to 3 minutes after switching to npx. Dictionary API queries return in <100ms (measured via Vercel analytics).

**Pitfalls:** The Supabase migration is incomplete. Some dictionary endpoints still hit static files as a fallback. I need to finish the migration and remove the old files.

No tests exist for the API routes. I'm relying on TypeScript and manual QA, which is risky for a production app.

**Next:**
- Complete Supabase migration and remove static files
- Add integration tests for API routes
- Set up monitoring and alerts for API failures

## blocks and jsonblog: Maintenance Mode

**blocks:** 2 commits, both dependency updates. No feature work.

**jsonblog:** 1 commit, a minor config tweak. The project is stable and doesn't need active development right now.

These repos are in maintenance mode. They work, they're deployed, and they don't need babysitting. Sometimes that's the best outcome.

## What's Next

- **TPMJS:** Ship native module support via Docker execution, add versioning, and build a CDN-backed cache
- **Symploke:** Launch public beta, add graph visualization, implement collaborative filtering for repo recommendations
- **Maldoror:** Add combat system, persistent world state, and procedural dungeons
- **Omega:** Build decision pattern dashboard, implement retention policy, add clustering for recurring mistakes
- **JSON Resume:** Integrate live job APIs, add career path explorer, improve Pathways UI
- **lordajax.com:** Add staging preview for auto-generated posts, track engagement metrics
- **mobtranslate.com:** Finish Supabase migration, add integration tests

## Links & Resources

### Projects
- [TPMJS](https://tpmjs.com) - Tool registry for AI agents
- [Symploke](https://symploke.com) - Codebase archaeology via semantic weaving
- [Maldoror Terminal MMO](https://maldoror.dev) - SSH-based multiplayer game
- [Omega Discord Bot](https://github.com/thomasdavis/omega) - Self-evolving AI assistant
- [JSON Resume](https://jsonresume.org) - Open source resume ecosystem
- [MobTranslate](https://mobtranslate.com) - Community-driven language resources

### NPM Packages
- [@tpmjs/registry-search](https://www.npmjs.com/package/@tpmjs/registry-search) - Search tool registry
- [@tpmjs/registry-execute](https://www.npmjs.com/package/@tpmjs/registry-execute) - Execute tools safely
- [@tpmjs/unsandbox](https://www.npmjs.com/package/@tpmjs/unsandbox) - Sandboxed code execution

### Tools & Services
- [Vercel AI SDK](https://sdk.vercel.ai) - AI integration framework
- [Railway](https://railway.app) - Tool execution sandbox
- [Pusher](https://pusher.com) - Real-time progress updates
- [BullMQ](https://docs.bullmq.io) - Redis-backed job queue

### Inspiration
- [Val Town](https://val.town) - Serverless function hosting
- [esm.sh](https://esm.sh) - CDN for npm packages
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search for Postgres
