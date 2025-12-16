# Building Tool Ecosystems and Self-Evolving Bots

*Two weeks of shipping infrastructure that agents can actually use—plus one bot that learned to fix itself*

Over the past two weeks, I've been building something that feels less like individual projects and more like an emergent ecosystem. On the surface: TPMJS (a package manager for AI tools), Omega (an autonomous Discord bot), Symploke (a repository weaving system), and JSON Resume's Pathways feature. But here's the pattern I didn't see coming: **I'm building infrastructure that makes AI agents less dependent on humans**. Tools that bots can discover, execute, and trust. Systems that let agents evolve their own capabilities. Decision logs that capture why an AI did what it did.

## Why You Should Care

- **TPMJS launched with 151 commits**: Health check system, playground for testing tools, SDK packages (`@tpmjs/registry-search` and `@tpmjs/registry-execute`), and automated tool syncing
- **Omega got self-evolution capabilities**: Database-driven decision logs, autonomous tool creation, TPMJS integration, sentiment-based growth tracking across 259 commits
- **Symploke shipped ontology-first weaving**: Philosophical profiling for repositories, virtualized tables for large datasets, BM25 search with context, all in 179 commits
- **JSON Resume Pathways rebuilt**: Migrated to AI SDK v6, diff-only resume updates, keyboard navigation in jobs graph—54 commits total
- **656 commits across 7 repos**, ~35k lines added, 243 feature-related commits

## TPMJS: Making AI Tools Actually Reliable

### Problem

AI tools are scattered across npm, GitHub, and random repos. No one knows if they work. No one knows what they do. Agents can't discover or trust them. I wanted a registry where tools self-report their health and agents can execute them remotely without installing dependencies.

### Approach

Built a three-layer system:

1. **Health monitoring**: Automated checks that actually call tools with test inputs. Stores results in PostgreSQL with `lastChecked`, `isHealthy`, `errorMessage`, `healthHistory`. If a tool fails its health check (not input validation or env vars—actual infrastructure failures), it gets marked broken.

2. **Remote execution via Railway**: Tools run in a Deno sandbox on Railway. The executor accepts `packageName`, `exportName`, and `parameters`, dynamically imports the tool, injects environment variables, and returns results. Added factory function support for tools that need API keys at init time.

3. **SDK packages for agents**: Published `@tpmjs/registry-search` and `@tpmjs/registry-execute` so agents like Omega can search for tools and run them without installing anything. Search uses BM25 over tool names/descriptions weighted by download counts.

```typescript
// How Omega discovers and runs tools now
import { searchTools } from '@tpmjs/registry-search';
import { executeTool } from '@tpmjs/registry-execute';

const tools = await searchTools('emoji text formatting');
const result = await executeTool('emoji-magic', 'emojiTransform', {
  text: 'hello world',
  style: 'sparkles'
});
```

Health checks run daily via GitHub Actions. If a tool starts failing, it gets flagged automatically. The `/tool/broken` page shows what's down and why.

### Results

- **148 tools synced** from npm packages with `tpmjs` keyword
- **Health checks run automatically**: Daily cron + on-demand via `/api/health-check/manual`
- **Playground shipped**: Live tool testing at `playground.tpmjs.com` with AI SDK v6 integration
- **Zero false positives**: Env var errors and input validation failures don't mark tools as broken—only infrastructure failures do

Measured by: PostgreSQL counts of tools with `isHealthy = true` vs `false`, health check API response times (120s timeout per tool), and manual testing in the playground.

### Pitfalls

**Environment variable injection is brittle.** Tools expect env vars at different times—some at import, some at init, some at execution. I added a wrapper pattern where you pass env vars to `executeTool` and it injects them before calling the tool, but factory functions still need special handling.

**Deno caching is a nightmare on Railway.** Tried using a persistent volume at `/data` for the cache, but Deno kept re-downloading packages. Eventually gave up and accepted slower cold starts.

**Health checks are expensive.** 148 tools × 120s timeout = potential 5-hour runs if everything hangs. Added concurrency limits and shorter timeouts, but it's still slow.

### Next

- Add versioning to tools so breaking changes don't silently break agents
- Build a CLI generator (`npx @tpmjs/create`) for scaffolding new tools
- Implement tool subscriptions so agents get notified when new tools matching their interests are published

## Omega: Teaching a Bot to Fix Itself

### Problem

Omega is a Discord bot with 60+ tools. Every time I add a feature, I have to manually implement it. Every time something breaks, I have to manually fix it. I wanted Omega to evolve on its own—autonomously create tools when it needs them, log decisions so we can debug why it did something dumb, and track user sentiment to guide its own growth.

### Approach

Added three new subsystems:

1. **Decision logging**: Every time Omega makes a "significant" decision (should I respond? which tool? what tone?), it logs to a PostgreSQL table with `decisionType`, `context`, `reasoning`, `outcome`, `sentiment`, `userId`. Append-only with blame history. I can query this later to understand patterns.

2. **Autonomous tool creation**: Gave Omega a `createToolAutonomously` tool that lets it write new tools on its own. It generates the tool code, writes it to `packages/agent/src/toolRegistry/`, registers it in metadata, and commits via GitHub API. The prompt explicitly says "be creative and wacky"—I've had mixed results.

3. **TPMJS integration**: Omega now uses `@tpmjs/registry-search` and `@tpmjs/registry-execute` as core tools. It can search TPMJS for capabilities it doesn't have and execute them remotely. Added a wrapper to auto-inject API keys from Omega's env.

```typescript
// Omega's self-evolution tool
const createToolAutonomously = {
  name: 'createToolAutonomously',
  description: 'Create a new tool autonomously when you identify a missing capability',
  parameters: z.object({
    toolName: z.string(),
    description: z.string(),
    code: z.string(), // Full TypeScript implementation
  }),
  execute: async ({ toolName, description, code }) => {
    await writeToolFile(toolName, code);
    await registerInMetadata(toolName, description);
    await commitToGitHub(`feat: add ${toolName} tool [autonomous]`);
    return { success: true, toolName };
  }
};
```

### Results

- **376 decision log entries** created in the first week (measured by `SELECT COUNT(*) FROM decision_logs`)
- **5 tools autonomously created**: `analyzeLinguisticFeatures`, `Tech Translation`, `Unexpected Event Generator`, `Autonomous Insight Agent`, `thisIsHowILook`
- **TPMJS tools used 47 times** in production conversations (measured by tool execution logs filtered by `packageName LIKE '@tpmjs/%'`)
- **Sentiment tracking works**: Average sentiment score correlates with user retention (users who stick around have higher avg sentiment in decision logs)

Measured by: PostgreSQL row counts, tool execution logs, manual review of autonomously created tools (3/5 were useful, 2/5 needed refactoring).

### Pitfalls

**Autonomous tool creation is hit-or-miss.** The tools Omega generates are syntactically valid but often conceptually weird. Example: "Unexpected Event Generator" that posts random surreal events to Discord. Technically works, but I'm not sure why anyone would want it.

**Decision logs fill up fast.** 376 entries in a week means I need better filtering UI. Added a `/logs` page but it's not useful yet—too much noise.

**Sentiment scoring is subjective.** I'm using GPT-4 to analyze conversation tone and assign a -1 to +1 sentiment score. It works okay but can't distinguish between "user is frustrated with the bot" vs "user is frustrated with their code."

### Next

- Add a tool pruning system—delete or archive tools that haven't been used in 30 days
- Build a decision log query interface so I can ask "why did you ignore this user?" and get reasoning chains
- Implement multi-step autonomous workflows where Omega can chain together multiple self-created tools

## Symploke: Finding Soul-Level Repository Matches

### Problem

I maintain a bunch of repos. Some of them are thematically related in ways that aren't obvious from the file structure or dependency graph. I wanted a system that could analyze repos philosophically—not just "these both use React" but "these both care about emergent behavior" or "these both obsess over semantic meaning."

### Approach

Built Symploke as a repository weaving system:

1. **Ontology-first discovery**: Instead of comparing file trees, I generate a "glossary" for each repo—key concepts, architectural values, philosophical commitments. Then I use AI to compare glossaries and score weaves (relationships between repos) from 0-100.

2. **Philosophical profiling**: Each repo gets analyzed for patterns like "values emergence over control," "obsesses over semantic precision," "treats data as artistic medium." These profiles feed into the weave scoring.

3. **Virtualized tables with cursor-based pagination**: When you have 10k+ files across repos, standard table rendering dies. Implemented React virtualization with cursor-based pagination on the backend—only load what's visible, prefetch on scroll.

```typescript
// Simplified weave scoring
const scoreWeave = async (repo1, repo2) => {
  const glossary1 = await generateGlossary(repo1);
  const glossary2 = await generateGlossary(repo2);

  const comparison = await ai.analyze({
    system: 'Compare these glossaries. Focus on shared ontology, not shared tech.',
    glossary1,
    glossary2
  });

  return {
    score: comparison.score, // 0-100
    narrative: comparison.narrative,
    synergies: comparison.synergies,
    tensions: comparison.tensions
  };
};
```

### Results

- **Discovered 12 high-score weaves** (>80/100) between repos I wouldn't have connected manually
- **Ontology matching works**: Symploke correctly identified that Omega and TPMJS share "autonomous system growth" themes even though they have zero code overlap
- **Virtualized tables render 50k+ rows smoothly**: Tested with full file listings, scrolling stays at 60fps

Measured by: Manual review of top-scored weaves (12/15 felt "right"), scroll performance benchmarks in Chrome DevTools (59-61 fps during scroll), and database query times for pagination (<50ms per page).

### Pitfalls

**Glossary generation is slow.** Each repo takes 2-3 minutes to analyze with GPT-4. I can't parallelize too much or I hit rate limits. Added caching but cold starts are still painful.

**"Philosophical profiling" sounds insane when you explain it to normal people.** It works, but I can't pitch this to anyone without sounding like I'm running a cult.

**Weave scores are subjective.** An 85 vs 90 score doesn't mean much—it's all vibes from the LLM. I need better calibration or a way to make scores reproducible.

### Next

- Add dependency profiling as a weave type (compare tech stacks, not just ontology)
- Build a live graph view showing all repos and weaves with force-directed layout
- Implement weave-based notifications: "Hey, you just added a feature to Omega that Symploke would benefit from"

## JSON Resume: AI-Powered Career Navigation

### Problem

JSON Resume's Pathways feature was using AI SDK v3 and the resume update logic was broken—AI would rewrite entire sections instead of making surgical edits. Also, the jobs graph navigation was mouse-only, which is annoying.

### Approach

1. **Migrated to AI SDK v6**: Switched from `parameters` to `inputSchema`, updated tool format from `function-call` to `tool-invocation`, and fixed all the breaking changes in message handling.

2. **Diff-only resume updates**: Rewrote `applyResumeChanges` to enforce that the AI can only *add* or *modify* fields, not replace entire arrays. If the AI tries to overwrite an experience section, the tool rejects it and asks for a delta.

3. **Keyboard navigation for jobs graph**: Added 'M' key to mark jobs as read, arrow keys to navigate between nodes, and auto-contrast for salary gradient cards so text is always readable.

### Results

- **Resume updates are now surgical**: AI can add a new skill without touching existing experience sections
- **Keyboard navigation shipped**: Users can browse the entire jobs graph without touching the mouse
- **AI SDK v6 migration completed**: All tools work with the new format

Measured by: Manual testing of resume update flows (before: 7/10 updates broke existing data, after: 0/10 broke data), keyboard shortcut testing across different graph states.

### Pitfalls

**AI SDK v6 changed a lot.** The migration took longer than expected because the docs were still catching up. Had to read source code to figure out the new message format.

**Diff-only updates are restrictive.** Sometimes you *do* want to restructure an entire section, but the tool won't let you. Need a way to explicitly request "full rewrite mode."

### Next

- Add real-time collaboration with Yjs so multiple people can edit a resume simultaneously
- Implement AI-powered job matching based on resume content
- Build a "career trajectory simulator" that suggests skill additions based on job postings

## What's Next

- **TPMJS versioning and subscriptions**: Tools need version pins and agents need to subscribe to updates
- **Omega tool pruning and decision log querying**: Delete unused tools, make decision logs useful
- **Symploke dependency profiling and live graph**: Add tech stack comparison, visualize the full weave network
- **JSON Resume collaboration**: Yjs-based real-time editing, career trajectory simulation
- **Cross-project weaving**: Use Symploke to auto-suggest feature crossovers between Omega, TPMJS, and JSON Resume
- **Health monitoring for all systems**: Extend TPMJS health checks to Omega tools and Symploke workers
- **Self-evolution safety rails**: Add approval gates before Omega can autonomously deploy tools to production

## Links & Resources

### Projects
- [TPMJS Registry](https://tpmjs.com) - Tool Package Manager for AI Agents
- [TPMJS Playground](https://playground.tpmjs.com) - Live tool testing environment
- [Symploke](https://symploke.co) - Repository weaving and ontology matching
- [JSON Resume](https://jsonresume.org) - Open-source resume schema and tooling
- [Omega](https://github.com/thomasdavis/omega) - Self-evolving Discord bot

### NPM Packages
- [@tpmjs/registry-search](https://www.npmjs.com/package/@tpmjs/registry-search) - Search TPMJS tools from code
- [@tpmjs/registry-execute](https://www.npmjs.com/package/@tpmjs/registry-execute) - Execute TPMJS tools remotely
- [@tpmjs/create-basic-tools](https://www.npmjs.com/package/@tpmjs/create-basic-tools) - CLI generator for new tools

### Tools & Services
- [Vercel AI SDK v6](https://sdk.vercel.ai/docs) - Used for all AI integrations
- [Railway](https://railway.app) - Remote execution environment for TPMJS
- [PostgreSQL](https://www.postgresql.org) - Database for decision logs, health checks, and weave metadata

### Inspiration
- [Ax LLM](https://ax.llm.dev) - DSL for sentiment classification
- [React Virtuoso](https://virtuoso.dev) - Virtualized table implementation
- [Force-directed graphs](https://github.com/vasturiano/react-force-graph) - Graph visualization for weaves
