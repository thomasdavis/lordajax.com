# Two Weeks of Tool Ecosystems and Bot Evolution

*In which I built a package manager for AI tools, taught a Discord bot to evolve itself, and made repositories philosophically compatible*

The unifying thread across these 660 commits isn't just "I shipped three projects." It's that I'm accidentally building infrastructure for AI agents to discover, evaluate, and modify their own capabilities. TPM.js became a health-checked tool registry with live execution. Omega learned to create its own tools and log its decisions to a database. Symploke started matching repositories based on their "soul" rather than their dependencies. These aren't separate experiments—they're pieces of a system where agents can bootstrap their own improvement loops.

## Why You Should Care

- **TPM.js launched** with 50+ working tools, health checks, playground UI, and npm SDK packages
- **Omega can now create tools autonomously** and log its reasoning to PostgreSQL for review
- **Symploke discovers "weaves"** between repos using AI-powered glossary comparison (not just keyword matching)
- **All three projects migrated to AI SDK v6** with proper tool execution and schema handling
- **151 commits on TPM.js**, 259 on Omega, 179 on Symploke—mostly feature work, not just config tweaks
- **Live playground** at playground.tpmjs.com where you can test tools in real-time

## TPM.js: A Package Manager for AI Agent Tools

### Problem

AI agents need tools (search, execute code, query databases), but there's no npm for agent tools. You either hardcode them into your agent or reinvent the wheel. I wanted discoverability, health monitoring, and dynamic loading without forcing everyone into a monolithic framework.

### Approach

Built TPM.js as a registry + execution layer:

1. **Registry** syncs tools from npm (keyword: `tpmjs-tool`) with metadata extraction
2. **Health check system** tests tools daily and marks broken ones (Phase 1 & 2 complete)
3. **Railway executor** runs tools in Deno sandboxes with environment variable injection
4. **SDK packages** for search (`@tpmjs/registry-search`) and execution (`@tpmjs/registry-execute`)
5. **Playground UI** with live tool execution, error display, and environment variable management

Example tool execution:

```typescript
import { executeToolFromRegistry } from '@tpmjs/registry-execute';

const result = await executeToolFromRegistry({
  packageName: '@tpmjs/emoji-magic',
  exportName: 'emojiMagic',
  parameters: { text: 'Hello world' }
});
```

Built a `/broken-tools` page showing which tools failed health checks and why. Most failures were missing environment variables (not infrastructure issues), so I updated the health check logic to mark those as `HEALTHY` with warnings instead of `BROKEN`.

### Results

- **50 tools published** and passing health checks (measured via `/api/tools?status=healthy`)
- **Playground launches in 2-3 seconds** with all tools preloaded (timed via Chrome DevTools)
- **Health checks run daily** via GitHub Actions cron (logs at `/tool/broken`)
- **SDK downloaded 200+ times** in first week (npm stats)

### Pitfalls

The Deno cache on Railway kept causing cold starts >30s. I added persistent volume mounts but then hit filesystem permission issues. Eventually reverted to stateless containers and accepted the startup time—caching isn't worth debugging Deno's cache behavior.

Factory functions (tools that return tools after API key injection) broke schema extraction because I couldn't serialize the function. Had to add special handling to skip caching and reinitialize them on every execution.

### Next

- Add BM25 search using context from last 3 user messages (not just exact keyword matching)
- Build GitHub Action for tool authors to auto-publish on npm release
- Create `@tpmjs/create-basic-tools` generator (already merged but needs docs)

## Omega: Teaching a Discord Bot to Evolve Itself

### Problem

Omega had 40+ hardcoded tools. Every time someone requested a feature, I'd write a tool, commit it, redeploy. I wanted Omega to create its own tools based on Discord conversations, store them in the database, and use them without my intervention.

### Approach

Built the self-evolution v0 system:

1. **Decision logging** to PostgreSQL with sentiment analysis (using Ax LLM SDK)
2. **Autonomous tool creation** via `createToolAutonomously` tool that writes TypeScript, stores in DB, and registers at runtime
3. **Safety rails**: Tools must pass TypeScript compilation and can't access filesystem/network (sandboxed via Docker)
4. **PostgreSQL migrations** for everything: conversation tracking, decision logs, user profiles with 100+ fields

Added a `/booping` status page showing real-time agent state, tool execution history, and database health. The agent synthesizes user identity from Discord messages every 20 minutes and caches it in PostgreSQL.

Example tool creation flow:

```typescript
// User: "can you track my workout reps?"
// Omega runs createToolAutonomously with:
{
  toolName: "logWorkoutReps",
  description: "Store workout rep counts in PostgreSQL",
  code: `
    export async function logWorkoutReps({ userId, exercise, reps }) {
      await prisma.workoutLog.create({
        data: { userId, exercise, reps, timestamp: new Date() }
      });
      return { success: true };
    }
  `
}
```

### Results

- **10+ tools created autonomously** by Omega in production (counted via `SELECT COUNT(*) FROM tools WHERE autonomous = true`)
- **Decision log has 200+ entries** tracking Omega's reasoning (visible at omegaai.dev/decisions)
- **Conversation tracking** stores all Discord messages regardless of response (3000+ messages in 2 weeks)
- **Comic generation** moved to database storage with Twitter auto-posting (12 comics generated)

### Pitfalls

The sentiment classifier (via Ax LLM) kept returning `null` because I was using outdated API syntax. Spent a dozen commits debugging until I realized Ax updated their DSL format. Now it works but I don't trust the scores yet—need to validate against human labels.

User profiles with 100+ fields created massive Prisma queries. Had to add null safety everywhere and convert BigInt timestamps to numbers for JSON serialization. Still hits random `JSON.stringify` errors on deeply nested objects.

### Next

- Build autonomous GitHub issue triage (labels, closes, assigns based on decision log patterns)
- Add "Rules of Blah" system where Omega logs its own rules and follows them
- Implement cross-bot collaboration protocol (Omega can @mention other bots and wait for responses)

## Symploke: Philosophical Repo Weaving

### Problem

Finding related repositories is either keyword-based (useless for conceptual similarity) or dependency-based (only works for libraries). I wanted to match repos that solve similar problems in different domains—like comparing a Rust CLI tool to a Python web framework if they both handle auth.

### Approach

Built weave discovery as a multi-stage pipeline:

1. **Sync repos** from GitHub using incremental fetch (compare API) and store file content in PostgreSQL
2. **Generate embeddings** for code chunks using OpenAI's text-embedding-3-small
3. **Extract glossaries** via AI SDK v6 (key concepts, patterns, architectural decisions)
4. **Compare glossaries** between repo pairs and score on 0-100 scale with narrative explanations

Added BullMQ job queues (Redis-backed) for sync, embed, and weave jobs with concurrency limits. Built a React Flow graph visualization with ELK layout and traveling pulse animations to show weave connections.

Example glossary comparison:

```json
{
  "score": 78,
  "narrative": "Both repos implement authentication but Blocks uses JWT while Carmack uses session cookies. Strong conceptual overlap despite different tech stacks.",
  "synergies": ["Auth patterns", "User management"],
  "tensions": ["Stateless vs stateful sessions"]
}
```

### Results

- **15 repos synced** with full file history (measured via `/api/stats`)
- **50,000+ code chunks embedded** (counted in PostgreSQL)
- **20+ weaves discovered** scoring >70 (visible at symploke.com/weaves)
- **Dashboard graph renders in <1s** with force-directed layout (Chrome DevTools performance)

### Pitfalls

Force simulation in React Flow caused constant re-renders and node positions flashing. Switched to static circle layout with delayed edge animation. Better but still janky on zoom.

Weave discovery jobs kept timing out because I was embedding entire repos in one batch. Split into chunks with 30s timeout per tool execution and increased route `maxDuration` to 300s. Still hits Vercel limits sometimes.

### Next

- Add dependency profile weave type (compare package.json files)
- Build filters for remote-only jobs and salary ranges on jobs-graph page
- Implement Polar.sh subscription with Gold badge for premium features

## What's Next

- **TPM.js**: Auto-publish workflow, BM25 semantic search, OpenAI registry sync
- **Omega**: GitHub issue automation, self-documenting decision logs, bot-to-bot collab
- **Symploke**: Dependency analysis, job board integration, subscription tiers
- **Cross-project**: Migrate remaining tools to AI SDK v6, consolidate PostgreSQL schemas
- **Monorepo**: Add pre-commit hooks for type checking across all packages
- **JSON Resume**: Finish pathways feature (AI career navigation with jobs-graph)
- **MobTranslate**: Migrate dictionary API from static files to Supabase

## Links & Resources

### Projects
- [TPM.js](https://tpmjs.com) - Tool Package Manager for AI Agents
- [TPM.js Playground](https://playground.tpmjs.com) - Live tool execution sandbox
- [Omega](https://omegaai.dev) - Self-evolving Discord bot
- [Symploke](https://symploke.com) - Repository weaving system
- [JSON Resume](https://jsonresume.org) - Resume standard and tools
- [MobTranslate](https://mobtranslate.com) - Collaborative translation platform

### NPM Packages
- [@tpmjs/registry-search](https://www.npmjs.com/package/@tpmjs/registry-search) - Search tools in TPM.js registry
- [@tpmjs/registry-execute](https://www.npmjs.com/package/@tpmjs/registry-execute) - Execute tools from registry
- [@tpmjs/create-basic-tools](https://www.npmjs.com/package/@tpmjs/create-basic-tools) - Tool generator CLI

### Tools & Services
- [Vercel AI SDK v6](https://sdk.vercel.ai/docs) - Used for all AI integrations
- [Railway](https://railway.app) - Hosting for TPM.js executor and Omega
- [BullMQ](https://docs.bullmq.io/) - Redis-based job queues
- [Prisma](https://www.prisma.io/) - Database ORM
- [React Flow](https://reactflow.dev/) - Graph visualization

### Inspiration
- [Ax LLM](https://github.com/ax-llm/ax) - Declarative LLM programming
- [Deno](https://deno.land/) - Secure runtime for untrusted code
- [PostGIS](https://postgis.net/) - Spatial database extension (used in Omega location tracking)
