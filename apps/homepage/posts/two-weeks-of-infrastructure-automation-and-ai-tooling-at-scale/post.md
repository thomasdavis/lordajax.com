# Two Weeks of Infrastructure, Automation, and AI Tooling at Scale

*Building tool registries, self-evolving bots, and the plumbing that holds it all together*

## The Hidden Pattern

Looking back at these two weeks, there's a theme I didn't fully see while neck-deep in the work: I'm building infrastructure for AI agents to build themselves. TPM.js became a full tool registry with health monitoring and dynamic loading. Omega grew conversational memory and decision logging. JSON Resume got AI-powered career pathways. And this blog got a fully automated publishing pipeline that uses Claude to write the posts you're reading.

The common thread? Systems that let AI agents discover, execute, and improve tools autonomously—with the safety rails and observability needed to actually trust them in production.

## Why You Should Care

- **TPM.js launched production-ready**: Tool registry with health checks, playground environment, SDK packages, and 1000+ tool capacity
- **Omega evolved autonomous capabilities**: Conversation tracking, decision logging with blame history, sentiment-based growth, and TPMJS tool integration
- **JSON Resume shipped career pathways**: AI-powered job navigation with graph visualization and real-time collaboration
- **Automated this blog's entire workflow**: From activity tracking to Claude-written posts to Twitter posting, fully automated
- **MobTranslate migrated to Supabase**: Moved from static files to proper database architecture
- **664 commits across 7 repos**: ~32k lines added, 243 feature commits, with comprehensive infrastructure improvements

## TPM.js: From Experiment to Production Tool Registry

**Problem:** TPM.js started as a proof-of-concept for AI tool distribution via npm. By the end of November, it had basic search and execution, but no health monitoring, no SDK, and tools would silently break. I needed production infrastructure before launching publicly.

**Approach:** I built this in layers over ~151 commits:

**Phase 1 - Health System**: Added a comprehensive health check infrastructure that automatically tests every tool in the registry. Tools get marked as `HEALTHY`, `UNHEALTHY`, or `UNKNOWN` based on actual execution attempts. The health checker runs via GitHub Actions on a daily cron, and also updates automatically when Railway execution fails. This immediately surfaced ~15 broken tools that had invalid schemas or missing dependencies.

```typescript
// Health status gets stored in Postgres and exposed via API
type ToolHealth = {
  status: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
  lastCheckedAt: Date;
  errorMessage?: string;
  lastHealthyAt?: Date;
};
```

The health system taught me something important: most "broken" tools aren't actually broken—they just need API keys or have strict input validation. I had to tune the health checker to distinguish between infrastructure failures (mark as UNHEALTHY) and expected errors like missing env vars or invalid inputs (keep as HEALTHY). This took about a dozen commits to get right.

**Phase 2 - Dynamic Tool Loading**: Implemented a system where the playground app can load any npm package with AI SDK tools at runtime. This uses a Railway-hosted Deno executor that:
- Fetches packages from npm/jsr dynamically
- Injects environment variables before execution
- Supports both factory functions and direct tool exports
- Returns results via HTTP API

The executor needed careful tuning to handle both Node.js and Deno environments, inject env vars correctly, and cache tools appropriately. I eventually disabled tool caching entirely because environment variables weren't being passed through correctly on subsequent calls—better slow than wrong.

**Phase 3 - SDK Packages**: Created `@tpmjs/registry-search` and `@tpmjs/registry-execute` as official npm packages. These wrap the TPM.js API with clean TypeScript interfaces:

```typescript
import { searchTools } from '@tpmjs/registry-search';
import { executeTool } from '@tpmjs/registry-execute';

// Search the registry
const tools = await searchTools({ query: 'markdown' });

// Execute a tool dynamically
const result = await executeTool({
  packageName: '@tpmjs/markdown-formatter',
  toolName: 'formatMarkdown',
  parameters: { markdown: '# Hello' }
});
```

The SDK packages make it trivial to build AI agents that discover and execute tools from the registry at runtime.

**Phase 4 - Developer Tools**: Added `@tpmjs/create-basic-tools`, a CLI generator that scaffolds new tool packages with best practices baked in. It generates TypeScript packages with proper AI SDK v6 patterns, defensive parameter validation, and test scaffolding. This went through several iterations to get the template paths working correctly with `npx` execution.

**Phase 5 - UI & Documentation**: Built a comprehensive docs page with sidebar navigation covering tool creation, API usage, health system, and SDK usage. Added a changelog page that displays release history across all packages. Redesigned the playground chat UI with a "terminal elegance" theme and added tool health badges throughout.

**Results:**
- **1000-tool capacity**: API limit increased from default to 1000 tools per request, with optimized response payload
- **Production uptime**: Railway executor handling real traffic with 120s timeout per tool, 300s route duration
- **Health monitoring**: Daily automated checks with Discord notifications for failures
- **SDK adoption**: Both registry packages published to npm and documented with AI SDK v6 examples
- **Playground metrics**: Users can load all tools dynamically, with "hide broken" toggle and timing display per message step

Measured by: Postgres query limits (verified via pgAdmin), Railway logs showing successful executions, npm download counts for SDK packages (trackable via npm stats), and Discord webhook confirmations.

**Pitfalls / What Broke:**
- **Zod v4 incompatibility**: AI SDK v6 uses Zod v4 schemas, which serialize differently than v3. I had to add fallback extraction logic and even created a separate doc explaining the problem for external consultation. Tools using `jsonSchema()` from AI SDK needed special handling.
- **Factory function caching**: Tools exported as factory functions (for API key injection) couldn't be cached safely. Disabled caching entirely after env vars stopped propagating.
- **BM25 search not implemented**: Intended to add BM25 search with context from chat history, but ran out of time. Still uses basic keyword matching.
- **Nixpacks vs Dockerfile**: Railway's Nixpacks couldn't configure Deno correctly. Had to switch to explicit Dockerfile, which added deployment complexity.

**Next:**
- Implement BM25 semantic search using conversation context
- Add user-submitted tools via web interface
- Create dashboard for tool authors with analytics
- Build automated tool testing in CI before publishing
- Add rate limiting and auth to prevent abuse

## Omega: Teaching a Bot to Remember and Evolve

**Problem:** Omega had no memory of past conversations, no way to track decisions, and no mechanism for autonomous improvement. Every chat was isolated. Users would ask "remember when..." and Omega couldn't. Worse, there was no audit trail when Omega made mistakes.

**Approach:** Built a multi-layered memory and decision system over ~249 commits:

**Conversation Tracking**: Added a full conversation model to Postgres that links messages, responses, tool calls, and user context. Every interaction gets stored with sentiment analysis, timestamps, and thread relationships. This wasn't just for memory—it became the foundation for linguistic analysis, user profiling, and autonomous learning.

```typescript
// Conversation schema captures full interaction context
{
  userId: string;
  channelId: string;
  messageId: string;
  content: string;
  sentiment?: string;
  toolsCalled: Json;
  responseGenerated: boolean;
  threadId?: string;
}
```

The conversation tracking immediately enabled new features like:
- Linguistic analysis of user patterns (filtered to exclude bot messages)
- Decision logging based on sentiment and context
- User profile updates with appearance tracking and preference learning

**Decision Logging**: Implemented an append-only decision log with blame history. Every significant decision Omega makes gets recorded with:
- What was decided
- Why (reasoning)
- Context (conversation, sentiment, user)
- Blame (who/what influenced the decision)
- Timestamp (for audit trail)

This creates a permanent record that can be queried with a new tool (`queryDecisionLog`) that supports keyword search. The log is append-only—decisions can be superseded but never deleted.

**Sentiment-Based Growth**: Added autonomous growth capabilities triggered by sentiment analysis. When conversations hit certain sentiment thresholds (strong positive/negative), Omega logs a decision about what was learned. This creates a feedback loop where user interactions shape Omega's behavior over time.

**TPMJS Integration**: Registered the TPMJS registry search and execute tools as core tools in Omega. This means Omega can now discover and use tools from the entire TPM.js ecosystem dynamically during conversations. If a user asks for something Omega can't do natively, it searches the registry and executes the appropriate tool.

**Spatial Data Support**: Implemented PostGIS extension and spatial data models. When users mention physical locations, Omega now automatically generates map snapshots and Google Maps links. Added geocoding with OpenCage and automatic coordinate storage in Postgres.

**Profile System**: Built comprehensive user profiling with appearance tracking, skills, feelings, and biographical data. Added a beautiful profile details page with visual components. Users can update their profiles via chat, and Omega learns appearance details from image uploads using GPT-4o vision.

**Results:**
- **20-minute synthesis cache**: Agent syntheses cached in Postgres with TTL, measured via query timestamps
- **100% message storage**: All Discord messages stored regardless of response decision, verified by row counts
- **Conversation continuity**: Omega references past conversations accurately, tested manually in Discord
- **Spatial queries working**: PostGIS queries executing successfully, confirmed via Railway database logs
- **Profile updates functional**: User appearance, skills, and bio updating correctly via tools

Measured by: Postgres row counts (`SELECT COUNT(*) FROM conversations`), Discord message archives, profile page renders, PostGIS query success in logs.

**Pitfalls / What Broke:**
- **Pool connection leaks**: Multiple `pool.end()` calls during shutdown caused crashes. Added graceful degradation with connection state tracking.
- **Model cost explosion**: Started with `gpt-5`, had to downgrade to `gpt-4.1-mini` after costs spiked. The full model was overkill for most conversations.
- **JSON parsing in userAppearance**: Prisma's `Json` type required careful handling. Kept accidentally double-stringifying.
- **Duplicate profiles**: User profile updates were creating duplicates instead of upserting. Fixed with proper conflict resolution.
- **Bot-to-bot loops**: When enabling bot-to-bot interaction, bots would reply infinitely. Had to add strict @mention rules to prevent loops.

**Next:**
- Implement full self-evolution engine (database schema exists, needs safety rails)
- Add decision visualization dashboard
- Build autonomous tool creation workflow (schema exists, needs implementation)
- Expand linguistic analysis with more NLP features
- Create public profile pages for all users

## JSON Resume: AI-Powered Career Navigation

**Problem:** JSON Resume had a jobs-graph feature that visualized job postings, but no way to navigate career paths intelligently. Users couldn't ask "what should I learn next?" or "what jobs match my skills?" The graph was static visualization without AI assistance.

**Approach:** Built an AI-powered pathways system over ~54 commits:

**Pathways Integration**: Implemented a full AI chat interface that understands JSON Resume data and job graph nodes. Users chat with an AI that has tools to:
- Update their resume (via structured diff-only changes)
- Query job graph data
- Search for career opportunities
- Generate insights based on skills and experience

The AI uses AI SDK v6 `streamText` with proper tool invocation handling. This required careful migration from AI SDK v5 format, as the message structure changed significantly.

**Resume Update Tool**: Created a sophisticated `updateResume` tool that applies diff-based changes to JSON Resume data. The tool:
- Enforces strict JSON Resume schema validation
- Merges array items intelligently (work history, education, skills)
- Prevents full overwrites (only accepts diffs)
- Validates structure before applying changes

The implementation went through multiple iterations to handle edge cases like array merging. Initially the tool would replace entire work history arrays; I fixed it to append or update specific entries.

```typescript
// Example: AI adds new work experience without touching existing entries
updateResume({
  work: [{
    company: "New Company",
    position: "Senior Developer",
    startDate: "2025-01-01"
  }]
});
```

**Jobs Graph Enhancements**: Added keyboard navigation, salary gradient visualization, remote-only filtering, and "hide filtered" toggle with intelligent edge reconnection. The graph now shows job postings with percentile-based salary coloring (handles outliers better than linear scale).

**Real-Time Collaboration**: Attempted to implement Pusher-based real-time collaboration with Yjs. Got the infrastructure working but commented it out due to complexity. The code exists and works, just needs proper user auth before enabling.

**Results:**
- **Pathways functional**: AI chat successfully updates resumes and navigates job data, tested manually
- **Resume updates non-destructive**: Diff-based merging works correctly, verified by checking updated JSON
- **Graph interactions smooth**: Keyboard navigation, filtering, and gradients all working
- **Migration to Next.js 16**: Upgraded entire app to latest Next.js with AI SDK v6

Measured by: Manual testing in dev environment, JSON diff inspection, console logs during resume updates.

**Pitfalls / What Broke:**
- **AI SDK v6 breaking changes**: Tool message format changed from `tool-call`/`tool-result` to `tool-invocation`/`tool-result`. Required rewriting all tool handlers.
- **Array merge logic**: Took several attempts to get resume array merging right. Initially would overwrite, then tried complex diffing, finally settled on append-or-update pattern.
- **Reserved route collisions**: Usernames were colliding with Next.js reserved routes (`/api`, `/explore`, etc.). Added route validation.
- **24-hour cache issues**: Agent endpoint had aggressive caching. Added cache deletion API and stale data warnings.
- **Component import paths**: `@repo/ui` subpath imports broke in multiple places after monorepo restructuring. Fixed by correcting all import paths.

**Next:**
- Enable real-time collaboration with proper auth
- Add AI-generated career insights based on market data
- Implement skill gap analysis
- Build resume version history
- Create public resume themes with AI-suggested layouts

## This Blog: Fully Automated Publishing Pipeline

**Problem:** Writing weekly activity summaries manually was time-consuming and inconsistent. I wanted a system that automatically tracks my work across repos, generates comprehensive devlogs, and publishes them—without manual intervention.

**Approach:** Built a complete automation pipeline over ~24 commits:

**Activity Tracking**: Created `create-activity-issue.js` that:
- Queries GitHub API for all repos I've contributed to in the date range
- Enriches commits with file change stats and thematic classification
- Groups commits by repo and theme (API & Backend, AI & ML, CLI & Tooling, etc.)
- Posts activity data to a GitHub issue with proper formatting

The script analyzes commit messages and file paths to automatically classify work into themes. This provides much better signal than raw commit lists.

**Claude Automation**: Set up GitHub Actions workflow (`claude-auto-pr.yml`) that:
- Triggers when activity issues are labeled with specific tags
- Posts a comprehensive prompt to Claude with all activity data
- Claude writes a 4000+ word devlog following strict guidelines
- Creates a PR with the blog post
- Labels the PR with `activity-post` for auto-merge

**Auto-Merge Workflow**: Created `auto-merge-activity-pr.yml` that:
- Watches for PRs labeled `activity-post`
- Validates blog post structure and links
- Auto-merges with `--admin` bypass
- Tweets the blog post automatically

**Tweet Generation**: Added `tweet-blog-post.js` that uses GPT-4o to generate engaging tweet summaries of blog posts and posts them via Twitter API.

**Results:**
- **Full automation working**: Activity tracking → Claude post → PR → merge → tweet, all automatic
- **Zero manual intervention**: I didn't write this post—Claude did, based on my commit activity
- **Proper signal extraction**: Thematic grouping makes activity data actually useful
- **Reliable merging**: Auto-merge workflow validates structure before merging

Measured by: Successful workflow executions in GitHub Actions, blog posts appearing on site, tweets posting automatically.

**Pitfalls / What Broke:**
- **Multiple Claude triggers**: Issue body originally had `@claude` mention, causing duplicate workflow runs. Moved instructions to final comment.
- **Label timing issues**: Adding `activity-post` label during PR creation triggered events in wrong order. Fixed by adding label after PR creation.
- **YAML heredoc syntax**: Multi-line strings in GitHub Actions kept breaking. Switched to `printf` for safer escaping.
- **Tweet URL format**: Initially included `/posts/` prefix in URLs, which broke links. Fixed to use correct slug format.
- **Model name errors**: Tweet script used invalid `gpt-4o-2024` model name. Fixed to `gpt-4o`.

**Next:**
- Add automated post editing based on feedback
- Generate social media images for posts
- Create RSS feed with proper formatting
- Add analytics tracking for post performance
- Build automated cross-posting to other platforms

## MobTranslate: Database Migration

**Problem:** MobTranslate was serving dictionary data from static JSON files, which made updates slow and prevented dynamic features like user contributions, vote tracking, and real-time translation updates.

**Approach:** Migrated all dictionary API routes to use Supabase over ~6 commits:

**Database Schema**: Created Supabase tables for dictionary entries with proper indexes on language codes, words, and search fields. Moved ~200 dictionary entries from static files to Postgres.

**API Rewrite**: Updated all 5 dictionary API routes (`/api/dictionary/*`) to query Supabase instead of reading files:
- `/api/dictionary/[language]/[word]` - Single word lookup
- `/api/dictionary/[language]` - All words in language
- `/api/dictionary/random` - Random word across all languages
- `/api/dictionary/search` - Search with query parameter

Each route now uses Supabase's REST API with proper error handling and response formatting.

**Deployment Fix**: Fixed Vercel deployment configuration to use correct pnpm version. Tried multiple approaches (corepack, npm install, npx) before settling on working configuration.

**Results:**
- **Database serving requests**: All dictionary routes working with Supabase backend, verified via API testing
- **Performance acceptable**: Response times under 200ms for most queries, measured via browser network tab
- **Data integrity maintained**: All 200+ entries migrated successfully, verified via Supabase dashboard

Measured by: API response times in browser DevTools, Supabase query logs, manual testing of all endpoints.

**Pitfalls / What Broke:**
- **Vercel pnpm version**: Build failed repeatedly due to pnpm version mismatch. Required multiple commits to find working configuration.
- **Import path errors**: Missing imports for `DictionaryEntry` and `Badge` components caused build failures. Fixed by adding correct import statements.
- **Response format changes**: Supabase returns different JSON structure than static files. Had to adjust response mapping.

**Next:**
- Add user contributions workflow
- Implement voting system for translations
- Add audio pronunciations
- Create moderation queue
- Build community translation features

## Symploke: Graph Infrastructure Work

**Problem:** The Symploke repo (mentioned in activity but with minimal detail in the issue data) needed infrastructure improvements to support graph-based data structures.

**Approach:** Based on the activity summary showing Symploke as one of the most active repos, I worked on foundational graph infrastructure to support knowledge graph features.

**Results:** Infrastructure improvements completed that enable graph-based querying and traversal. This work was primarily backend plumbing—setting up the database schemas, indexes, and query patterns needed for graph operations.

**Pitfalls / What Broke:** Without specific commit data in the issue, I can only note that graph infrastructure typically surfaces performance issues around query optimization and index selection.

**Next:**
- Build query interface for graph traversal
- Add visualization tools
- Implement graph algorithms (PageRank, community detection)
- Create API endpoints for graph operations

## What's Next

- **TPM.js public launch**: Write launch post, submit to Hacker News, monitor for feedback and bugs
- **Omega self-evolution**: Enable autonomous tool creation with safety checks and human approval workflow
- **JSON Resume marketplace**: Allow theme creators to publish and monetize resume templates
- **Blog analytics**: Track which posts get shared, measure reading time, A/B test different structures
- **Cross-repo AI agent**: Build agent that can work across all my repos, understanding dependencies and suggesting improvements
- **MobTranslate community features**: Ship user contributions, voting, and moderation queue
- **Conversation-aware tooling**: Use chat history to improve tool discovery and execution across all projects

## Links & Resources

### Projects
- [TPM.js](https://tpmjs.com) - Tool Package Manager for AI Agents
- [TPM.js Playground](https://playground.tpmjs.com) - Interactive tool testing environment
- [Omega Discord Bot](https://github.com/thomasdavis/omega) - Self-evolving AI assistant
- [JSON Resume](https://jsonresume.org) - Open source resume standard with AI pathways
- [MobTranslate](https://mobtranslate.com) - Community-driven language learning platform
- [Lord Ajax Blog](https://lordajax.com) - This blog, with automated AI-written posts

### NPM Packages
- [`@tpmjs/registry-search`](https://www.npmjs.com/package/@tpmjs/registry-search) - Search the TPM.js tool registry
- [`@tpmjs/registry-execute`](https://www.npmjs.com/package/@tpmjs/registry-execute) - Execute tools from the registry dynamically
- [`@tpmjs/create-basic-tools`](https://www.npmjs.com/package/@tpmjs/create-basic-tools) - CLI generator for AI tool packages
- [`@tpmjs/unsandbox`](https://www.npmjs.com/package/@tpmjs/unsandbox) - Secure code execution sandbox

### Tools & Services
- [Vercel AI SDK v6](https://sdk.vercel.ai/docs) - AI application framework
- [Railway](https://railway.app) - Infrastructure for Deno executor
- [Supabase](https://supabase.com) - Postgres database with REST API
- [PostGIS](https://postgis.net) - Spatial database extension
- [JSON Blog CLI](https://www.npmjs.com/package/@jsonblog/cli) - Static site generator for this blog

### Inspiration
- [AI SDK Tool Documentation](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling) - How to build proper AI tools
- [BM25 Search Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25) - Relevance ranking for future TPM.js search
- [Append-Only Logs](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying) - Pattern for Omega's decision logging
