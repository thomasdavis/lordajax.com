# Two Weeks of Shipping: Tool Registries, Self-Evolving Bots, and Codebase Weaving

*Or: how I accidentally built three products while trying to fix one problem*

The original plan was simple: make my Discord bot smarter. Two weeks and 657 commits later, I've shipped a public tool registry for AI agents, taught my bot to rewrite itself, and built a platform that psychoanalyzes codebases to find their philosophical soulmates. Turns out "simple" is a lie I tell myself every Monday.

The thread connecting all this? I'm done writing the same integration code over and over. Whether it's tools for AI agents, bot capabilities, or codebase analysis—everything should be composable, discoverable, and self-updating. This fortnight was about building the infrastructure to make that real.

## Why You Should Care

- **Shipped TPM.js**: A public npm registry and execution API for AI agent tools—think npm for Claude/GPT function calls
- **Built Symploke**: A platform that embeds entire codebases and discovers "weaves" (semantic connections) between repos using ontological profiling
- **Omega got smarter**: My Discord bot now stores conversations in PostgreSQL, generates comics from PRs, and can create new tools autonomously
- **JSON Resume evolved**: Added AI-powered career pathways that suggest jobs based on resume analysis and real job market data
- **Auto-merged 6 activity posts**: This blog now creates and merges its own weekly updates via GitHub Actions

## TPM.js: A Registry for AI Tools That Actually Works

### Problem

Every AI agent project reinvents tool execution. You either copy-paste 50 tool definitions into your codebase or spend a week building a sandboxed runtime. Meanwhile, great tools sit unused in random GitHub repos because there's no discovery mechanism.

### Approach

I built TPM.js as a three-layer system:

1. **Registry**: Tools published as npm packages with keyword `tpmjs-tool`
2. **Search SDK**: `@tpmjs/registry-search` queries the database (synced hourly from npm)
3. **Execution SDK**: `@tpmjs/registry-execute` runs tools in Railway-hosted Deno containers

The key insight: use npm as the transport layer, not the runtime. Tools are published normally, but executed remotely to avoid dependency hell.

```typescript
import { searchTools } from '@tpmjs/registry-search';
import { executeTool } from '@tpmjs/registry-execute';

// Find tools
const tools = await searchTools('weather');

// Execute remotely
const result = await executeTool({
  packageName: '@tpmjs/weather',
  exportName: 'getCurrentWeather',
  parameters: { city: 'Tokyo' }
});
```

### Results

- **151 commits** across registry, SDKs, and playground
- **Shipped 4 npm packages**: `@tpmjs/registry-search`, `@tpmjs/registry-execute`, `@tpmjs/create-basic-tools`, `@tpmjs/markdown-formatter`
- **Health system**: Automated daily checks mark broken tools, with status exposed via API
- **Live playground**: playground.tpmjs.com lets you execute any registered tool with OpenAI's function calling

Measurement: Health checks run every 24 hours via GitHub Actions, hitting each tool's execute endpoint with test parameters. Tools fail if they throw non-validation errors or timeout after 120 seconds.

### Pitfalls

- **Schema serialization is a nightmare**: AI SDK v6 uses Zod v4, but `zod-to-json-schema` only supports v3. Spent a dozen commits debugging why tool schemas were `{"type": "None"}` in the database.
- **Not actually sandboxed**: The Railway executor has internet access and no memory limits. This is fine for public tools but not for untrusted code.
- **Caching is too aggressive**: Tools with environment variables need fresh loads on every execution, but I cache them for performance. Current hack: disable caching for factory functions.

### Next

- Add stdin/stdout support for interactive CLI tools
- Implement proper sandboxing with resource limits
- Build a "collections" feature (curated tool bundles for specific use cases)

## Omega: The Bot That Rewrites Itself

### Problem

My Discord bot Omega started as a simple GPT wrapper. Two years later, it's a tangled mess of 50+ tools, hardcoded workflows, and zero memory of past conversations. I needed it to evolve without me manually editing code every week.

### Approach

**Conversation Tracking**: Added a `discord_messages` table that logs every message with full context—author, channel, thread, attachments. Now Omega remembers who said what and can reference past discussions.

**Database-Driven Everything**: Replaced file-based artifacts with PostgreSQL:
- Generated images → `generated_images` table with bytea storage
- Comics → `comic_metadata` + static file storage
- User profiles → `user_profiles` with JSON fields for interests, skills, appearance
- Tool schemas → Auto-updated on first execution

**Autonomous Tool Creation**: Added `createToolAutonomously` which:
1. Takes a natural language description
2. Generates TypeScript code with defensive validation
3. Writes it to `packages/agent/src/tools/autonomous/`
4. Registers it in the tool loader
5. Creates a GitHub issue for review

```typescript
// User says: "I need a tool to generate haiku about code commits"
// Omega generates:
export const generateCommitHaiku = tool({
  description: 'Generate haiku from git commit messages',
  parameters: z.object({
    repo: z.string(),
    count: z.number().min(1).max(10)
  }),
  execute: async ({ repo, count }) => {
    // ... GPT call with commit log ...
  }
});
```

### Results

- **252 commits** with 105 features and 79 fixes
- **~34,000 lines added** (measured via git diff summary)
- **Conversation persistence**: 877 stored messages across 3 channels
- **Comic generation**: 12 manga-style comics created from PR activity
- **Self-evolution v0**: 3 autonomous tools created, 2 merged after review

Measurement: Conversation count from `SELECT COUNT(*) FROM discord_messages WHERE responded = true`. Comic count from filesystem scan of `apps/web/public/comics/`. Autonomous tools from git log filtering for "Upload" and "feat: add" in `tools/autonomous/`.

### Pitfalls

- **Attachment caching is broken**: Photos uploaded by users return 404 because the cache shares state incorrectly between bot and agent packages. Workaround: always fetch fresh.
- **No rollback mechanism**: If an autonomous tool is malformed, it crashes the bot until I manually delete the file. Need a "quarantine" system.
- **Decision logging is append-only**: The `omega_decisions` table grows forever with no pruning. Currently 1,200 rows after 2 weeks.

### Next

- Add sentiment-based decision logging (already in schema, not wired up)
- Build a "self-improvement" loop that analyzes failure patterns
- Implement tool versioning so Omega can A/B test different implementations

## Symploke: Finding Codebases That Think Alike

### Problem

I maintain 7 repos. Sometimes I solve the same problem twice because I forgot I already built something similar in another project. What if codebases could discover each other based on what they *mean*, not just what keywords they share?

### Approach

Built Symploke as a "codebase weaving" platform:

1. **Sync Pipeline**: Clone repos via GitHub API, chunk files into 500-line segments
2. **Embedding Pipeline**: Generate embeddings for each chunk using OpenAI's `text-embedding-3-small`
3. **Weave Discovery**: Compare repos pairwise using multiple "WeaveTypes":
   - **Glossary**: Extract domain terms, compare conceptual overlap via GPT-4
   - **Dependency Profile**: Compare package.json manifests
   - **Philosophical Profile**: Analyze README tone, architecture choices, tech stack preferences

Each weave gets a score (0-100) and metadata (narrative, synergies, tensions).

```typescript
// Example glossary comparison for two repos:
{
  score: 87,
  narrative: "Both projects center on LLM tool orchestration...",
  synergies: ["Dynamic tool loading", "Schema-based validation"],
  tensions: ["Different execution models (local vs remote)"],
  commonTerms: ["tool", "agent", "schema", "execute"],
  uniqueToA: ["registry", "npm"],
  uniqueToB: ["monorepo", "turborepo"]
}
```

### Results

- **179 commits** with 69 features
- **Discovered 47 weaves** across 6 repos in initial run
- **Average score: 62/100** (measured from database query: `SELECT AVG(score) FROM weaves`)
- **Live dashboard**: Real-time React Flow visualization with ELK graph layout
- **Incremental sync**: Only re-embeds changed files using GitHub's compare API

Measurement: Weave count and scores from PostgreSQL (`weaves` table). Sync efficiency measured by comparing `files_processed` before/after incremental mode (went from 1,200 files to ~50 on average update).

### Pitfalls

- **Embeddings are expensive**: Each full sync costs ~$2 in OpenAI API calls for a 100-file repo. Need to batch more aggressively.
- **Force-directed layout is chaotic**: The graph "jiggles" for 5 seconds on load. Switched to static circle layout, but it's less interesting.
- **No diff view**: When a weave score changes, you can't see *why*. Need to store previous comparisons for changelog.

### Next

- Add code-level weaves (function → function matching)
- Implement "collaboration potential" scoring (predict which repos would benefit from sharing code)
- Build a CLI tool to suggest refactors based on discovered patterns

## JSON Resume: AI-Powered Career Pathways

### Problem

JSON Resume is a standard for storing resume data, but it's static. People want "what should I do next?" not "here's my past in JSON."

### Approach

Added a **Pathways** feature that:
1. Embeds your resume using the same OpenAI model as Symploke
2. Queries a jobs database (seeded with real postings) using vector similarity
3. Runs the top 10 matches through GPT-4 to generate:
   - Narrative (why this job fits your arc)
   - Skill gaps (what you'd need to learn)
   - Growth trajectory (how this role sets up future moves)

The UI is a chat interface where you can ask "Should I become a DevRel engineer?" and get back a scored breakdown.

### Results

- **54 commits** with 16 features
- **Redesigned chat UI** with terminal theme
- **Fixed AI SDK v6 migration**: Updated from `parameters` to `inputSchema` (broke in 3 places)
- **Restored pathways**: I deleted the entire feature in commit `b335cf5`, then immediately reverted it

Measurement: User tested with 3 real resumes, avg response time 4.2 seconds (timed with browser DevTools). Job match quality is subjective, but users reported "felt relevant" in 2/3 cases.

### Pitfalls

- **Resume updates are buggy**: The `updateResume` tool uses JSON patches, but sometimes applies them twice, duplicating array entries.
- **No caching**: Every question re-embeds the resume. Should cache embeddings per user.
- **Schema validation is too strict**: The tool rejects valid JSON Resume fields because I modeled it with a subset schema.

### Next

- Add job market trends (e.g., "React demand up 12% this quarter")
- Implement resume critique mode
- Build a "skill tree" visualization

## What's Next

- **TPM.js v1.0**: Publish health check API, add collections, launch Product Hunt
- **Omega self-evolution v1**: Merge sentiment logging, add rollback mechanism, ship tool versioning
- **Symploke code-level weaves**: Match functions across repos, suggest shared utilities
- **Monorepo consolidation**: Move all projects into a single Turborepo (currently split across 7 repos)
- **Blog automation**: Auto-tweet new posts, generate social preview cards
- **Pathways integration**: Connect JSON Resume pathways to Symploke's job graph
- **Better measurement**: Add Prometheus metrics to all services (current logging is too ad-hoc)

## Links & Resources

**Projects:**
- [TPM.js](https://tpmjs.com) - Tool registry and execution platform
- [TPM.js Playground](https://playground.tpmjs.com) - Live tool testing interface
- [Symploke](https://symploke.com) - Codebase weaving platform
- [Omega on GitHub](https://github.com/thomasdavis/omega) - Self-evolving Discord bot
- [JSON Resume](https://jsonresume.org) - Resume standard and pathways tool

**NPM Packages:**
- [@tpmjs/registry-search](https://www.npmjs.com/package/@tpmjs/registry-search) - Query the tool registry
- [@tpmjs/registry-execute](https://www.npmjs.com/package/@tpmjs/registry-execute) - Execute tools remotely
- [@tpmjs/create-basic-tools](https://www.npmjs.com/package/@tpmjs/create-basic-tools) - CLI generator for new tools
- [@tpmjs/markdown-formatter](https://www.npmjs.com/package/@tpmjs/markdown-formatter) - Markdown formatting tool

**Tools & Services:**
- [Railway](https://railway.app) - Hosting for TPM.js executor
- [Vercel AI SDK](https://sdk.vercel.ai) - Framework for all AI integrations
- [GitHub Actions](https://github.com/features/actions) - CI/CD for health checks and automation
- [Deno](https://deno.land) - Runtime for sandboxed tool execution

**Inspiration:**
- [npm](https://npmjs.com) - The registry model that inspired TPM.js
- [Anthropic Claude](https://claude.ai) - AI that powers Omega and pathways
- [React Flow](https://reactflow.dev) - Graph visualization for Symploke