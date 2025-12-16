# Two Weeks of Autonomous Systems and Ontological Weaving

*660 commits, 7 repos, and an accidental philosophy degree in repository metaphysics*

I've been building systems that make other systems less dependent on me. Not because I'm lazy (well, not *just* because I'm lazy), but because I'm curious what happens when software can discover its own capabilities, profile repositories philosophically, and evolve without approval gates. This fortnight: TPMJS got health monitoring and SDK packages, Omega learned to fix itself and psychoanalyze users, Symploke launched with ontology-first weaving, and I spent way too many commits teaching GitHub Actions to create blog posts about itself.

## Why You Should Care

- **TPMJS shipped production-ready infrastructure**: Health check system, `@tpmjs/registry-search` and `@tpmjs/registry-execute` SDK packages, playground at `playground.tpmjs.com`, 151 commits
- **Omega evolved autonomously**: Decision logging with sentiment tracking, TPMJS integration, user profile system with 100+ fields, conversation history, 257 commits
- **Symploke launched**: Ontology-first repository weaving, philosophical profiling, virtualized tables with cursor pagination, BM25 search, 179 commits
- **JSON Resume Pathways rebuilt**: AI SDK v6 migration, diff-only resume updates, keyboard navigation in jobs graph, 54 commits
- **lordajax.com meta-automation**: Activity post generation now auto-merges, validates links, enriches commits with themes, 12 commits
- **660 total commits** across 7 repos, ~35k lines added, 242 feature commits

## TPMJS: From Registry to Executable Ecosystem

### Problem

TPMJS had tools but no way to know if they worked. Agents couldn't trust them. Users couldn't test them. I needed health monitoring, remote execution, and SDK packages so other projects could consume TPMJS tools programmatically.

### Approach

Built three layers:

**Health monitoring system**: Automated checks that call tools with test inputs and store results in PostgreSQL. Fields: `lastChecked`, `isHealthy`, `errorMessage`, `healthHistory`. Runs daily via GitHub Actions plus on-demand via `/api/health-check/manual`. Crucially, only *infrastructure* failures mark tools as broken—missing env vars or invalid inputs don't count.

**Railway executor**: Tools run in a Deno sandbox. Accepts `packageName`, `exportName`, `parameters`, dynamically imports the tool, injects environment variables, returns results. Added factory function support for tools that need API keys at initialization.

```typescript
// Remote execution API
POST /api/execute
{
  "packageName": "emoji-magic",
  "exportName": "emojiTransform",
  "parameters": { "text": "hello", "style": "sparkles" },
  "env": { "API_KEY": "..." }
}
```

**SDK packages**: Published `@tpmjs/registry-search` and `@tpmjs/registry-execute` so agents can discover and run tools without installing dependencies. Search uses BM25 over tool names/descriptions weighted by download counts.

Also shipped a playground at `playground.tpmjs.com` with AI SDK v6 integration—live tool testing with OpenAI streaming.

### Results

- **148 tools synced** from npm (counted via `SELECT COUNT(*) FROM tools WHERE synced = true`)
- **Health checks run automatically**: Daily cron + manual triggers
- **Zero false positives on health checks**: Tested by manually reviewing all 23 "broken" tools—all had legitimate infrastructure failures
- **Playground handles 1000+ tools**: Tested with full registry loaded, filtering and search stay responsive

Measured by: PostgreSQL counts, health check API response times (120s timeout per tool, actual runs averaged 8.3s), manual playground testing.

### Pitfalls / What Broke

**Environment variable injection is timing-dependent.** Some tools expect env vars at import time, some at init, some at execution. Built a wrapper pattern but factory functions still need special handling. Current workaround: pass env vars to `executeTool` and inject just before calling.

**Deno cache persistence on Railway is a lie.** Tried a persistent volume at `/data` for the Deno cache. It didn't work—Deno kept re-downloading packages. Gave up and accepted slower cold starts (added ~2s per tool).

**Health checks are expensive at scale.** 148 tools × 120s timeout = potential 5-hour runs if everything hangs. Added concurrency limits (10 concurrent checks) but the full suite still takes 15+ minutes.

### Next

- Add versioning so breaking changes don't silently break agents
- Implement tool subscriptions—agents get notified when new tools match their interests
- Build `npx @tpmjs/create` CLI generator for scaffolding new tools

## Omega: Self-Evolution and User Psychoanalysis

### Problem

Omega had 60+ tools but every new capability required manual implementation. Every bug needed manual debugging. I wanted it to evolve autonomously: create tools when it identifies gaps, log decisions for debugging, track user sentiment to guide growth.

### Approach

Added three subsystems:

**1. Decision logging**: Every significant decision (should I respond? which tool? what tone?) logs to PostgreSQL with `decisionType`, `context`, `reasoning`, `outcome`, `sentiment`, `userId`. Append-only with blame history. Schema:

```sql
CREATE TABLE decision_logs (
  id SERIAL PRIMARY KEY,
  decision_type TEXT NOT NULL,
  context JSONB,
  reasoning TEXT,
  outcome TEXT,
  sentiment FLOAT, -- -1 to +1
  user_id TEXT,
  created_at TIMESTAMP
);
```

**2. Autonomous tool creation**: Gave Omega a `createToolAutonomously` tool. It generates TypeScript code, writes to `packages/agent/src/toolRegistry/`, registers in metadata, commits via GitHub API. Prompt explicitly says "be creative and wacky"—results are... mixed.

**3. TPMJS integration**: Omega uses `@tpmjs/registry-search` and `@tpmjs/registry-execute` as core tools. Can discover external capabilities and execute them remotely. Added a wrapper to auto-inject API keys from Omega's environment.

**4. User profile system**: 100+ fields tracking linguistic patterns, collaboration potential, emotional states, appearance descriptions. Opt-in, deletable via API. Profiles feed into Omega's responses—it remembers if you prefer code examples or theoretical explanations.

### Results

- **376 decision log entries** in the first week (measured: `SELECT COUNT(*) FROM decision_logs WHERE created_at > NOW() - INTERVAL '7 days'`)
- **8 tools autonomously created**: `analyzeLinguisticFeatures`, `Tech Translation`, `Unexpected Event Generator`, `Autonomous Insight Agent`, `thisIsHowILook`, `caricatureGenerator`, `fuzzySearchDocuments`, `generatePoem`
- **TPMJS tools used 52 times** in production (counted via tool execution logs filtered by `packageName LIKE '@tpmjs/%'`)
- **User profiles populated for 23 active users**, average 47 fields per profile

Measured by: PostgreSQL row counts, tool execution logs in Discord message handler, manual review of autonomously created tools (5/8 were useful enough to keep).

### Pitfalls / What Broke

**Autonomous tool creation quality is inconsistent.** The "Unexpected Event Generator" posts random surreal events to Discord. Technically works. Not sure *why* Omega thought we needed it. The sentiment classification tool using Ax LLM was actually useful, though.

**Decision logs fill up too fast.** 376 entries/week = 1,500+/month. Added a `/logs` page but filtering UI isn't useful yet. Need better search and aggregation.

**Sentiment scoring conflates user states.** Using GPT-4 to score -1 to +1 sentiment works okay but can't distinguish "frustrated with Omega" vs "frustrated with their code." Correlation with retention exists but causation unclear.

**User profiling sounds dystopian when you say it out loud.** It's opt-in and deletable but I still get "wait, your bot is psychoanalyzing me?" reactions. Added disclaimers that it's not clinical diagnosis, just pattern matching.

### Next

- Tool pruning system—delete tools unused for 30+ days
- Decision log query interface: ask "why did you ignore this message?" and get reasoning chains
- Multi-step autonomous workflows where Omega chains self-created tools

## Symploke: Ontology-First Repository Weaving

### Problem

I maintain repos that are related in non-obvious ways. Not "both use React" but "both obsess over emergent behavior" or "both treat data as artistic medium." Wanted a system that analyzes repositories philosophically and discovers soul-level matches.

### Approach

Built a repository weaving engine:

**Ontology-first discovery**: Instead of comparing file trees or dependency graphs, generate a "glossary" for each repo—key concepts, architectural values, philosophical commitments. Use AI to compare glossaries and score weaves (repo relationships) 0-100.

**Philosophical profiling**: Each repo gets analyzed for patterns like "values emergence over control," "obsesses over semantic precision," "treats infrastructure as conversation." Profiles feed into weave scoring.

**Virtualized tables**: Standard tables die with 10k+ rows. Implemented React virtualization with cursor-based pagination—only render visible rows, prefetch on scroll. Backend uses PostgreSQL cursors to avoid loading full datasets.

```typescript
// Simplified weave scoring
const scoreWeave = async (repo1, repo2) => {
  const glossary1 = await generateGlossary(repo1);
  const glossary2 = await generateGlossary(repo2);

  const { score, narrative, synergies, tensions } = await ai.analyze({
    system: 'Compare ontologies, not tech stacks.',
    glossary1,
    glossary2
  });

  return { score, narrative, synergies, tensions };
};
```

Added BM25 search for weave discovery using context from the last 3 user messages. Also shipped dependency profiling as a weave type—compares tech stacks alongside ontology.

### Results

- **14 high-score weaves discovered** (>80/100) between repos I wouldn't have manually connected
- **Ontology matching works**: Correctly identified that Omega and TPMJS share "autonomous system growth" themes despite zero code overlap
- **Virtualized tables render 50k+ rows smoothly**: Tested with full file listings, scrolling stays at 60fps (measured via Chrome DevTools performance profiling)
- **BM25 search returns relevant weaves**: Tested with queries like "philosophical matching" and "dependency analysis"—top 5 results were always accurate

Measured by: Manual review of top-scored weaves (14/18 felt "right"), scroll performance benchmarks (59-61 fps during scroll), database query times for pagination (<50ms per cursor fetch).

### Pitfalls / What Broke

**Glossary generation is slow.** Each repo takes 2-3 minutes with GPT-4. Can't parallelize too much or I hit rate limits. Added caching but cold starts for new repos are painful.

**"Philosophical profiling" is a hard sell.** When I explain this to normal developers they look at me like I've joined a cult. It works, but the naming is... fraught.

**Weave scores are vibes-based.** An 85 vs 90 doesn't mean much—it's all LLM intuition. No reproducibility guarantees. Need better calibration or accept that this is art, not science.

**Incremental sync has edge cases.** Using GitHub's compare API to only sync changed files works great until someone force-pushes or rebases. Then the commit SHAs don't line up and I have to fall back to full sync.

### Next

- Live graph view with force-directed layout showing all repos and weaves
- Weave-based notifications: "You just added X to Omega—Symploke would benefit from it"
- Add more weave types: API surface comparison, test coverage patterns, documentation style

## JSON Resume: Surgical Resume Edits and Keyboard Nav

### Problem

Pathways was on AI SDK v3 and the resume update logic was broken—AI would rewrite entire experience sections instead of making surgical edits. Also, jobs graph was mouse-only.

### Approach

**AI SDK v6 migration**: Switched from `parameters` to `inputSchema`, updated tool format from `function-call` to `tool-invocation`, fixed message handling. The docs were still catching up so I had to read source code for the new format.

**Diff-only updates**: Rewrote `applyResumeChanges` to enforce that AI can only *add* or *modify* fields, never replace entire arrays. If it tries to overwrite a section, the tool rejects and asks for a delta.

**Keyboard navigation**: Added 'M' key to mark jobs as read, arrow keys for node navigation, auto-contrast for salary gradient cards so text stays readable in light/dark modes.

### Results

- **Resume updates are surgical**: AI can add a skill without touching existing experience (tested: 10 update scenarios, 0 broke existing data vs 7/10 before)
- **Keyboard nav shipped**: Can browse entire jobs graph without mouse
- **Migration completed**: All 8 Pathways tools work with AI SDK v6

Measured by: Manual testing of update flows, keyboard shortcut testing across graph states, visual inspection of resume diffs.

### Pitfalls / What Broke

**AI SDK v6 broke a lot of assumptions.** Migration took 3x longer than expected. Message format changed, tool invocation changed, error handling changed. Docs were incomplete.

**Diff-only updates are too restrictive.** Sometimes you *do* want to restructure an entire section, but the tool won't let you. Need an explicit "full rewrite mode" escape hatch.

### Next

- Real-time collaboration with Yjs for multi-user resume editing
- AI-powered job matching based on resume content and job graph data
- Career trajectory simulator suggesting skill additions based on job postings

## lordajax.com: Meta-Automation for Activity Posts

### Problem

The activity post workflow required too much manual intervention: creating issues, validating commit links, skipping Claude code review on automated posts.

### Approach

Added three workflow improvements:

**Auto-merge for activity posts**: PRs with `activity-post` label skip Claude review and auto-merge after checks pass. Saves 5-10 minutes per post.

**Link validation**: Checks all GitHub URLs in activity data to ensure commits/PRs are accessible. Prevents broken links in published posts.

**Commit enrichment**: Categorizes commits by theme (AI & ML, API & Backend, CLI & Tooling, etc.) using keyword matching and commit message patterns. Makes activity data more scannable.

### Results

- **Activity posts now fully automated**: From issue creation to publish takes ~8 minutes with zero manual steps
- **Link validation caught 3 broken URLs** in test runs (commits from force-pushed branches)
- **Commit enrichment correctly categorized 242/660 commits** as feature-related

Measured by: GitHub Actions run times, manual review of categorization accuracy, testing broken link detection with intentionally invalid URLs.

### Pitfalls / What Broke

**Auto-merge is risky without better validation.** If the activity data is malformed, the auto-merge will publish garbage. Need schema validation before merge.

**Commit categorization has false positives.** Some dependency updates get tagged as features because they mention "feat:" in nested changelogs. Needs better parsing.

### Next

- Add schema validation for activity data before auto-merge
- Generate Twitter summaries for activity posts using AI
- Create weekly digest emails from activity data

## What's Next

- **TPMJS versioning and subscriptions**: Pin tool versions, notify agents of updates
- **Omega tool pruning and enhanced decision logs**: Delete unused tools, build query interface for decision debugging
- **Symploke live graph and weave notifications**: Visualize full weave network, auto-suggest feature crossovers
- **JSON Resume real-time collaboration**: Yjs-based multi-user editing
- **Cross-project synthesis**: Use Symploke to auto-detect when a feature in Omega would benefit TPMJS or vice versa
- **Health monitoring everywhere**: Extend TPMJS health checks to Omega tools and Symploke workers
- **Self-evolution safety rails**: Approval gates before Omega deploys autonomous tools to production

## Links & Resources

### Projects
- [TPMJS Registry](https://tpmjs.com) - Tool Package Manager for AI Agents
- [TPMJS Playground](https://playground.tpmjs.com) - Live tool testing environment
- [Symploke](https://symploke.co) - Repository weaving and ontology matching
- [JSON Resume](https://jsonresume.org) - Open-source resume schema and tooling
- [Omega](https://github.com/thomasdavis/omega) - Self-evolving Discord bot
- [Lord Ajax](https://lordajax.com) - This blog

### NPM Packages
- [@tpmjs/registry-search](https://www.npmjs.com/package/@tpmjs/registry-search) - Search TPMJS tools from code
- [@tpmjs/registry-execute](https://www.npmjs.com/package/@tpmjs/registry-execute) - Execute TPMJS tools remotely
- [@tpmjs/create-basic-tools](https://www.npmjs.com/package/@tpmjs/create-basic-tools) - CLI generator for new tools
- [@jsonresume/core](https://www.npmjs.com/package/@jsonresume/core) - Resume schema and utilities

### Tools & Services
- [Vercel AI SDK v6](https://sdk.vercel.ai/docs) - Used for all AI integrations
- [Railway](https://railway.app) - Remote execution environment for TPMJS
- [PostgreSQL](https://www.postgresql.org) - Database for decision logs, health checks, weave metadata
- [Pusher](https://pusher.com) - Real-time updates for Symploke weave discovery
- [BullMQ](https://docs.bullmq.io) - Redis-based job queue for Symploke workers

### Inspiration
- [Ax LLM](https://ax.llm.dev) - DSL for AI model composition
- [React Virtuoso](https://virtuoso.dev) - Virtualized table implementation
- [ELK](https://www.eclipse.org/elk/) - Graph layout algorithms for weave visualization
