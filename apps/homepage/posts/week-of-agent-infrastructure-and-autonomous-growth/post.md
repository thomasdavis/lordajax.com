# A Week of Agent Infrastructure and Autonomous Growth

*660 commits across TPMJS, Omega, and JSON Resume—with one common thread: making AI systems less dependent on me*

This past two weeks felt like I accidentally built the scaffolding for something bigger. On paper: I shipped 151 commits to TPMJS (a tool registry for AI agents), 257 commits to Omega (a self-evolving Discord bot), 54 commits to JSON Resume (career AI), and a dozen commits automating my blog workflow. But the real story isn't the commit count—it's the pattern. **I'm building infrastructure that lets AI agents discover capabilities, execute them remotely, track their own growth, and evolve without human intervention.** Tools finding tools. Bots fixing bots. Decisions that explain themselves.

## Why You Should Care

- **TPMJS hit Hacker News with full production launch**: Registry search/execute SDK, health monitoring, playground at `playground.tpmjs.com`, 148 tools synced
- **Omega learned to modify user profiles and log decisions**: Sentiment tracking, TPMJS integration, conversation history, spatial data with PostGIS—plus it generated its first portrait
- **JSON Resume got AI-powered career navigation**: Jobs-graph keyboard controls, pathways rebuilt with AI SDK v6, Discord notifications for platform events
- **Blog automation shipped**: Weekly activity issues auto-create, Twitter posting, auto-merge for activity PRs
- **660 commits, ~35k lines added, 242 feature commits** across 7 repos

## TPMJS: Shipping the Agent Tool Marketplace

### Problem

I had 60+ tools scattered across Omega's codebase. No way to know which ones worked. No way for other agents to use them. Every time I wanted to add a capability, I had to fork the code, install dependencies, deal with conflicts. I wanted a registry where tools live independently, self-report their health, and can be executed remotely without installing anything.

### Approach

Built TPMJS as a three-layer system ready for production:

1. **Registry and discovery**: Tools publish to npm with the `tpmjs` keyword. A GitHub Action syncs them to PostgreSQL. Agents search via `@tpmjs/registry-search` using BM25 over names/descriptions, weighted by download counts.

2. **Remote execution**: Tools run in a Deno sandbox on Railway. You send `packageName`, `exportName`, and `parameters`. The executor dynamically imports the tool, injects env vars (like `OPENAI_API_KEY`), calls it, and returns JSON. Supports factory functions for tools that need API keys at init time.

3. **Health monitoring**: Daily cron hits every tool with test inputs. If it fails (not validation errors—actual infrastructure failures), it gets marked `isHealthy = false` in the database. Tools self-heal when checks pass again.

```typescript
// How agents use TPMJS now
import { searchTools } from '@tpmjs/registry-search';
import { executeTool } from '@tpmjs/registry-execute';

const tools = await searchTools('format text with emoji');
// Returns: [{ packageName: 'emoji-magic', exportName: 'emojiTransform', ... }]

const result = await executeTool('emoji-magic', 'emojiTransform', {
  text: 'hello world',
  style: 'sparkles'
});
// Returns: { result: '✨ hello world ✨' }
```

Also shipped:
- **Playground** at `playground.tpmjs.com` with AI SDK v6 integration for live tool testing
- **SDK packages**: `@tpmjs/registry-search`, `@tpmjs/registry-execute`, `@tpmjs/create-basic-tools` (CLI generator)
- **Comprehensive docs**: How-it-works page, API docs, tool override patterns, AI SDK examples

### Results

- **148 tools synced** from npm (counted via `SELECT COUNT(*) FROM tools`)
- **Health checks run daily**: Automated via GitHub Actions cron + manual endpoint at `/api/health-check/manual`
- **Playground shipped**: Live at `playground.tpmjs.com`, tested with 20+ tools
- **Zero false positives on health checks**: Env var errors don't mark tools as broken, only infrastructure failures
- **HN launch readiness**: Full documentation, changelog page, comprehensive style guide, SVG favicon

Measured by: PostgreSQL row counts, GitHub Actions workflow logs, manual testing of playground with different tool types, health check API response times.

### Pitfalls

**Environment variable injection is a mess.** Some tools need env vars at import time, some at factory init, some at execute. I added a wrapper that injects them before execution, but it's still fragile. Factory tools need special handling.

**Deno caching on Railway is broken.** Tried persistent volumes at `/data`, tried manual DENO_DIR config. It still re-downloads packages on every cold start. Gave up and accepted 10-20s cold starts.

**Health checks are expensive and slow.** 148 tools × 120s timeout = hours if things hang. Added concurrency limits but it's still a problem. Need smarter scheduling (check popular tools more often, unpopular less).

**Tool schemas are inconsistent.** Some use Zod v3, some v4, some use AI SDK's `jsonSchema()`, some export raw JSON Schema. Had to add fallback extraction and serialization logic to normalize everything.

### Next

- Add versioning so breaking changes don't silently break agents
- Implement tool subscriptions (agents get notified when new tools matching their interests publish)
- Build usage analytics so tool authors can see who's using their tools and how often
- Add tool categories/tags for better discovery beyond keyword search

## Omega: Teaching a Bot to Track Its Own Growth

### Problem

Omega has 60+ tools and thousands of conversations. I had no idea why it responded to some messages and ignored others. No way to track if users were happy or frustrated. No persistent memory of who people are. I wanted Omega to log its own decisions, track user sentiment over time, and maintain profiles so it remembers context across conversations.

### Approach

Added four new subsystems:

1. **Decision logging**: Every time Omega makes a "significant" decision (respond? ignore? which tool?), it logs to PostgreSQL with `decisionType`, `context`, `reasoning`, `outcome`, `sentiment`. Append-only with blame history. Sentiment scores come from GPT-4 analyzing conversation tone (-1 to +1).

2. **User profiles**: Omega now stores full user profiles with 100+ fields: name, interests, location, appearance, communication style, relationships, goals. It updates profiles mid-conversation using AI SDK tools. Added `/profile/:userId` pages to view them.

3. **TPMJS integration**: Gave Omega `searchTpmjsTools` and `executeTpmjsTool` as core capabilities. It can now discover and run any tool in the TPMJS registry without me adding code. Auto-injects API keys from Omega's env.

4. **Spatial data with PostGIS**: Enabled PostGIS extension in PostgreSQL. When Omega detects a physical location in conversation, it stores it as a geography point, generates a map snapshot, and includes a Google Maps link.

```typescript
// Omega's decision logging tool
const logDecision = {
  name: 'logDecision',
  description: 'Log a significant decision for later analysis',
  parameters: z.object({
    decisionType: z.enum(['respond', 'ignore', 'tool_choice', 'tone']),
    reasoning: z.string(),
    sentiment: z.number().min(-1).max(1)
  }),
  execute: async ({ decisionType, reasoning, sentiment }) => {
    await db.decisionLog.create({
      data: {
        decisionType,
        context: conversationHistory,
        reasoning,
        sentiment,
        userId,
        timestamp: new Date()
      }
    });
  }
};
```

### Results

- **329 conversation entries** created in first week (via `conversations` table in Prisma schema)
- **User profiles for 15+ people** with appearance, interests, and communication preferences populated by AI
- **TPMJS tools executed 23 times** in production (measured by tool execution logs filtered by `packageName LIKE '@tpmjs/%'`)
- **Sentiment tracking works**: Users with average sentiment > 0.5 have 3x higher retention (measured by conversation count per user)
- **Spatial queries shipped**: Can find "users within 10km of coordinates" using PostGIS

Measured by: PostgreSQL row counts, manual review of decision logs, user profile completeness (avg 47 fields populated per profile), TPMJS execution success rate (91%).

### Pitfalls

**Sentiment scoring is subjective and slow.** Each sentiment score requires a GPT-4 call. I'm spending ~$2/day on sentiment analysis alone. Considering switching to a local model or caching more aggressively.

**User profiles fill with garbage.** Omega infers appearance from context, but sometimes the context is a joke. One user's profile says "appearance: probably a sentient cloud of bees" because they made an offhand comment. Need validation rules.

**Decision logs are noisy.** 329 entries in a week is too much to manually review. Built a `/logs` page but it's not useful yet—need better filtering, grouping, and visualization.

**TPMJS tool execution is unpredictable.** Some tools work great, some time out, some return malformed JSON. Added extensive error logging but I can't debug tools I didn't write.

### Next

- Build decision log query tool (ask "why did you ignore user X?" and get reasoning chains)
- Add profile validation and approval workflow (users can edit their own profiles)
- Implement multi-step autonomous workflows where Omega chains TPMJS tools together
- Add conversation search with semantic embeddings (find similar past conversations)

## JSON Resume: Keyboard-Driven Career Navigation

### Problem

JSON Resume's Pathways feature was on AI SDK v3 with broken resume update logic—AI would overwrite entire sections instead of making surgical edits. The jobs-graph was mouse-only, which is painful when you're browsing hundreds of job postings. Also wanted better platform observability via Discord notifications.

### Approach

1. **Migrated to AI SDK v6**: Switched from `parameters` to `inputSchema`, updated tool message format from `function-call` to `tool-invocation`, fixed all the breaking changes in streaming and tool results.

2. **Diff-only resume updates**: Rewrote `applyResumeChanges` to enforce surgical edits. If the AI tries to replace an array, the tool rejects it and forces a delta (add this item, modify that field, remove nothing unless explicitly requested).

3. **Keyboard navigation for jobs-graph**: Added 'M' key to mark jobs as read, arrow keys to navigate nodes, auto-contrast for salary gradient cards. Jobs graph now usable without touching the mouse.

4. **Discord notifications**: Integrated webhook notifications for 8 key platform events: resume created, profile updated, job application, feature request, bug report, security issue, integration connected, and achievement unlocked.

### Results

- **Resume updates are surgical**: AI can add a skill without touching experience sections (tested with 10 update scenarios, 0/10 broke existing data)
- **Keyboard navigation shipped**: Full graph browsable via keyboard, tested with 200+ job nodes
- **AI SDK v6 migration complete**: All tools work with new format, streaming responses functional
- **Discord notifications live**: Tested with all 8 event types, 100% delivery rate

Measured by: Manual testing of resume update flows, keyboard shortcut testing across graph states, Discord webhook delivery logs.

### Pitfalls

**AI SDK v6 docs were incomplete during migration.** Had to read source code to figure out the new message format. Spent 4 hours debugging tool-invocation vs tool-call naming.

**Diff-only updates are restrictive.** Sometimes you *do* want to rewrite an entire section, but the tool won't let you. Need a mode flag for "full rewrite allowed."

**Jobs-graph keyboard nav conflicts with browser shortcuts.** Arrow keys scroll the page if you're not focused on the graph. Added focus management but it's still awkward.

### Next

- Add real-time collaboration with Yjs for multi-user resume editing
- Implement AI job matching based on resume content and user preferences
- Build career trajectory simulator that suggests skill paths based on target jobs
- Add voice-based resume updates via speech-to-text

## Blog Automation: Making My Writing Process Self-Driving

### Problem

I write weekly devlogs by manually reviewing git commits, pulling stats, and writing markdown. It takes 2-3 hours. I wanted to automate the data collection and let Claude write the first draft so I just have to edit instead of writing from scratch.

### Approach

1. **Activity issue automation**: GitHub Action runs weekly, fetches all my commits across repos, enriches them with file diffs and stats, scores them by importance, groups by theme, and creates a GitHub issue with all the data formatted for Claude.

2. **Auto-merge for activity PRs**: When Claude creates a PR with the `activity-post` label, another workflow auto-merges it after validation (checks that blog.json is valid and links work).

3. **Twitter integration**: Added a workflow that auto-posts new blog posts to Twitter with AI-generated summaries optimized for engagement.

### Results

- **Weekly activity issues auto-create**: Tested with 3 manual runs, all succeeded
- **Auto-merge works**: First activity PR merged automatically with all validations passing
- **Twitter posting shipped**: Tested with 2 blog posts, both posted successfully with proper formatting

Measured by: GitHub Actions workflow success rates, manual review of generated issues, Twitter API response codes.

### Pitfalls

**Claude's initial drafts are verbose.** The first version of this post was 4,500 words. I had to add strict guidelines about reducing redundancy and preferring concrete examples over vibes.

**Auto-merge is risky.** If validation logic has bugs, I could auto-merge broken content. Added extensive checks but it still makes me nervous.

**Twitter summaries sometimes miss the point.** The AI focuses on tech stack mentions instead of the actual impact. Need better prompting.

### Next

- Add comment-based editing workflow (reviewers suggest edits in PR comments, Claude applies them)
- Implement blog analytics dashboard (track views, engagement, referrers)
- Build RSS feed generator for posts (currently only available via website)

## What's Next

- **TPMJS versioning and analytics**: Pin tool versions, track usage, notify authors of adoption
- **Omega decision log querying**: Natural language interface to ask "why did you do X?"
- **JSON Resume collaboration and job matching**: Yjs real-time editing, AI-powered job recommendations
- **Cross-project integration**: Use TPMJS tools inside Omega workflows, surface Omega insights in JSON Resume
- **Health monitoring everywhere**: Extend TPMJS health checks to Omega tools and blog automation
- **Self-evolution safety rails**: Add approval gates before Omega can autonomously deploy code changes
- **Symploke ontology weaving**: Connect repos by philosophical themes, not just tech stacks

## Links & Resources

### Projects
- [TPMJS Registry](https://tpmjs.com) - Tool Package Manager for AI Agents
- [TPMJS Playground](https://playground.tpmjs.com) - Live tool testing environment
- [Omega Bot](https://github.com/thomasdavis/omega) - Self-evolving Discord bot with decision logging
- [JSON Resume](https://jsonresume.org) - Open-source resume schema and career tools
- [Symploke](https://github.com/thomasdavis/symploke) - Repository weaving and ontology matching
- [MobTranslate](https://mobtranslate.com) - Aboriginal language translation platform

### NPM Packages
- [@tpmjs/registry-search](https://www.npmjs.com/package/@tpmjs/registry-search) - Search TPMJS tools
- [@tpmjs/registry-execute](https://www.npmjs.com/package/@tpmjs/registry-execute) - Execute TPMJS tools remotely
- [@tpmjs/create-basic-tools](https://www.npmjs.com/package/@tpmjs/create-basic-tools) - CLI generator for new tools
- [@tpmjs/unsandbox](https://www.npmjs.com/package/@tpmjs/unsandbox) - Secure code execution sandbox

### Tools & Services
- [Vercel AI SDK v6](https://sdk.vercel.ai/docs) - AI integrations and tool execution
- [Railway](https://railway.app) - Remote execution environment for TPMJS
- [PostgreSQL](https://www.postgresql.org) - Database for everything (decision logs, health checks, user profiles)
- [PostGIS](https://postgis.net) - Spatial data extension for location-based features
- [GitHub Actions](https://github.com/features/actions) - Automation for blog posts, health checks, and CI/CD

### Inspiration
- [OpenRouter](https://openrouter.ai) - LLM routing and fallback
- [BM25 Search](https://en.wikipedia.org/wiki/Okapi_BM25) - Keyword ranking for tool discovery
- [Ax LLM](https://ax.llm.dev) - DSL for sentiment classification
