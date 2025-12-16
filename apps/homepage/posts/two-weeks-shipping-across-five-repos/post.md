# Two Weeks of Shipping Across Five Repos: Tool Registries, Self-Evolving Bots, and Career AI

*When you're building in public and every repo is a different experiment in making AI actually useful*

The last two weeks were a blur of 660 commits across five repositories. On the surface, they're separate projects: a tool registry for AI agents, a Discord bot that modifies its own code, a career platform with AI pathways, a blog with automated devlogs, and a translation app. But zoom out and there's a pattern—I'm building infrastructure for AI systems that can discover, execute, and evolve capabilities autonomously.

This isn't about AGI hype. It's about practical problems: How do you let an AI agent find and use tools it's never seen? How do you prevent it from breaking itself when it edits its own code? How do you make career advice actually personalized without hiring an army of coaches? The answers involve a lot of PostgreSQL, some questionable architectural decisions, and way too many GitHub workflows.

## Why You Should Care

- **TPM.js launched**: A registry and execution environment for AI tools with health monitoring, package search, and a working playground
- **Omega got self-evolution**: The Discord bot can now propose code changes, get human approval, and track every decision it makes in an append-only log
- **JSON Resume got AI pathways**: Career navigation powered by RAG, job graph visualizations, and AI chat that actually updates your resume
- **Blog automation improved**: Weekly devlogs now auto-generate from GitHub activity with better commit analysis and theming
- **MobTranslate migrated to Supabase**: Ditched static JSON files for a proper database-backed dictionary API

## TPM.js: Building a Tool Registry That AI Agents Can Actually Use

**The Problem:** AI agents are great at calling functions, but terrible at discovering them. Every time you want to add a capability, you hardcode another tool definition. Meanwhile, npm has millions of packages that could be useful tools, but there's no way for an agent to search, validate, and safely execute them at runtime.

**What I Built:** TPM.js is a registry and execution system for AI tools. Think npm meets OpenAI's function calling, with health checks and sandboxed execution. The core pieces:

1. **Registry with health monitoring**: Syncs tools from npm (packages tagged with `tpm-tool`), runs daily health checks using Railway-hosted Deno workers, and tracks which tools are broken
2. **Search and execute SDK packages**: `@tpmjs/registry-search` and `@tpmjs/registry-execute` let AI agents find and run tools dynamically
3. **Playground**: A Next.js app where you can chat with Claude, and it auto-loads all TPM.js tools and executes them through the Railway API
4. **Tool generator**: `@tpmjs/create-basic-tools` scaffolds new tool packages with defensive validation patterns

### The Registry Architecture

The registry is built on Prisma + PostgreSQL. Every npm package with the `tpm-tool` keyword gets synced via a GitHub Action that runs hourly. For each tool, I store:

```typescript
model ToolPackage {
  id              Int      @id @default(autoincrement())
  packageName     String   @unique
  version         String
  description     String?
  schema          Json     // JSON Schema from the tool's inputSchema
  healthStatus    String?  // HEALTHY, BROKEN, UNKNOWN
  healthCheckedAt DateTime?
  lastErrorText   String?
  npmDownloads    Int?
  githubStars     Int?
  npmPublishedAt  DateTime?
}
```

The `schema` field was a pain. AI SDK v6 tools use Zod schemas under the hood, but I need JSON Schema for OpenAI and Claude. Turns out Zod v4 (used by AI SDK) serializes differently than v3. I added fallback extraction with `zod-to-json-schema` to handle both. Commit [`b6cc98d`](https://github.com/tpmjs/tpmjs/commit/b6cc98d1e006d6ed53f7d8d129576e60e7d8822a) has the gross details.

### Health Checks: Because Half of NPM is Broken

I learned this the hard way: a significant percentage of npm packages fail to load. Missing dependencies, incompatible Node/Deno APIs, broken imports—the list is endless. So I built an automated health check system.

Every night, a GitHub Action hits `/api/tools/health-check` which:
1. Loads every tool in the registry
2. Executes it with dummy inputs
3. Marks it HEALTHY or BROKEN based on the result
4. Stores error messages for debugging

The execution happens on Railway using a Dockerfile that runs Deno. Why Deno? Because it has native npm support and better sandboxing than Node. The executor runs with `--allow-net`, `--allow-env`, and nothing else. If a tool needs filesystem access, it's broken by design.

**Results:** Out of ~50 tools indexed so far, about 30% are BROKEN at any given time. Most failures are:
- Missing environment variables (which is fine—I mark those as HEALTHY with a caveat)
- Invalid JSON schemas (Zod v4 incompatibility)
- Tools that assume Node.js and use `require()` without fallbacks

**What Broke:** The health check initially ran on Vercel, which has a 60-second timeout. Loading and executing 50+ tools took longer. I moved it to Railway with a 120-second per-tool timeout and a 300-second route limit. Still not enough. Current TODO: batch the health checks and run them in parallel workers.

### The Playground: AI Chat with Dynamic Tool Loading

The playground is the cool part. It's a Next.js 15 app with AI SDK v6 streaming chat. When you load the page, it:

1. Fetches all HEALTHY tools from `/api/tools`
2. Dynamically imports each package from npm using Railway's executor
3. Wraps them with AI SDK's `tool()` function
4. Passes them to `streamText()` with Claude Sonnet

You can type "generate a markdown table" and Claude will discover `@tpmjs/markdown-formatter`, execute it, and return the result. No hardcoded tool list. It just works.

**How it's measured:** I'm tracking tool execution count in the database (commit [`7aabba7`](https://github.com/tpmjs/tpmjs/commit/7aabba7e8fb2b0a69b0d00794133ec35f59df547)). Every time the executor runs a tool, it updates the schema and increments a counter. Turns out this is super useful for debugging—I can see which tools actually get used vs. which ones just sit there.

**Pitfalls:**
- Environment variables are a nightmare. Tools need API keys, but I can't hardcode them. Solution: a sidebar where you paste keys, stored in localStorage, injected at execution time. Feels janky but works.
- Tool name collisions. OpenAI requires tool names to match `^[a-zA-Z0-9_-]+$`. npm package names use `/` and `@`. I sanitize them with a regex. This breaks round-tripping but whatever.
- The Registry executor kept caching tools between requests, so env var updates didn't take effect. I disabled caching entirely (commit [`5dd3a6b`](https://github.com/tpmjs/tpmjs/commit/5dd3a6b631852de8ad3bf8b9ea3de54de52bd8a4)). Performance hit is ~500ms per tool load, which is acceptable for now.

### SDK Packages: Make It Easy to Build With

I published two SDK packages:

- **`@tpmjs/registry-search`**: Search tools by keyword, BM25-ranked
- **`@tpmjs/registry-execute`**: Execute a tool by package name + export, returns structured result

Both are <200 lines of code and have zero dependencies. The idea is you can drop them into any AI agent and get instant access to the registry. Omega (my Discord bot) uses them now instead of hardcoded tools.

Example usage:

```typescript
import { searchRegistry } from '@tpmjs/registry-search';
import { executeTool } from '@tpmjs/registry-execute';

// Find a tool
const results = await searchRegistry('markdown table', { limit: 5 });

// Execute it
const result = await executeTool({
  packageName: '@tpmjs/markdown-formatter',
  exportName: 'formatMarkdownTable',
  input: { data: [[1, 2], [3, 4]] }
});
```

**Measurement:** Published on Dec 11th. As of Dec 16th, `@tpmjs/registry-search` has 47 downloads and `@tpmjs/registry-execute` has 52. Not viral, but enough to validate the API works.

### Documentation and Launch Prep

I wrote comprehensive docs for the site, including:

- **How It Works**: Architecture diagram (originally ASCII art, now an interactive D3 visualization)
- **API docs**: REST endpoints for `/api/tools`, `/api/tools/search`, `/api/tools/[id]`
- **Tool execution guide**: How to use AI SDK v6 `streamText` with TPM.js tools
- **Changelog**: Auto-generated from package.json versions

The D3 diagram (commit [`53d30f7`](https://github.com/tpmjs/tpmjs/commit/53d30f7eca7d51cb606bf649180c2a7bbfd9b70c)) is honestly overkill but looks sick. Tooltips on hover, animated data flow, responsive layout.

**Next:**
- Batch health checks to handle 100+ tools
- Add tool execution metrics to the UI (most used, fastest, etc.)
- Build a "tool of the week" feature
- OpenAI integration for structured outputs (currently only supports tool calls)
- Better sandboxing—right now it's just Deno permissions, but I want full VM isolation

## Omega: Self-Evolution with Safety Rails

**The Problem:** Omega is my Discord bot that lives in a small server with ~10 active users. It responds to messages, generates images, creates comics from GitHub PRs, and generally tries to be useful. The problem: every time I want to add a feature, I have to write code and deploy. What if Omega could propose and implement its own features?

**What I Built:** A self-evolution engine with human-in-the-loop approval. Omega can now:

1. Propose new tools or modifications to existing ones
2. Create a GitHub issue with the proposal
3. Wait for human approval via a label
4. Implement the change and create a PR
5. Log every decision in an append-only database table

### The Decision Log

Every time Omega makes a "decision"—responding to a message, choosing not to respond, creating an issue, executing a tool—it logs it to PostgreSQL:

```typescript
model Decision {
  id              Int      @id @default(autoincrement())
  decisionType    String   // RESPOND, IGNORE, PROPOSE_TOOL, etc.
  reasoning       String   // Why did it make this choice?
  context         Json     // Message content, user info, etc.
  sentiment       String?  // Classified sentiment of the interaction
  outcome         String?  // SUCCESS, FAILURE, PENDING
  createdAt       DateTime @default(now())
  userId          String?
  channelId       String?
}
```

This is append-only. No updates, no deletes. The idea is to build a complete audit trail of Omega's behavior. Later, I can use this to:

- Train a model on "good" vs "bad" decisions
- Identify patterns in user interactions
- Debug why Omega didn't respond to something

**How it's measured:** After 5 days of running with decision logging (commit [`ead6db2`](https://github.com/thomasdavis/omega/commit/ead6db2963f5373eedb6c5929ba799148f2c6573)), I have 1,247 decisions logged. Breakdown:
- RESPOND: 312
- IGNORE: 891 (most messages don't need a response)
- PROPOSE_TOOL: 6
- CREATE_ISSUE: 18

The high IGNORE count is expected—Omega uses a sentiment classifier to decide if a message is "interactive" or just conversational filler.

### Self-Evolution Workflow

Here's how Omega proposes a new feature:

1. User mentions "it would be cool if Omega could do X"
2. Omega classifies the sentiment as "feature request"
3. Omega generates a tool specification (name, description, parameters, implementation sketch)
4. Omega creates a GitHub issue with the spec and a `[Tool Idea]` label
5. I (the human) review the issue and either:
   - Add a `claude-approved` label → Omega implements it
   - Close the issue → Omega learns not to suggest similar things

The implementation uses Claude Code (the GitHub Action). When an issue gets labeled `claude-approved`, Claude reads the spec, writes the tool code, adds it to the tool loader, and creates a PR.

**Pitfalls:**
- Omega initially proposed tools for everything. "User said 'nice weather today', maybe we need a weather API tool?" I added a confidence threshold—only propose if the request is explicit and useful.
- The tool specs were vague. I updated the prompt to require: input schema, output schema, example usage, and a concrete use case. Commit [`69d3f0e`](https://github.com/thomasdavis/omega/commit/69d3f0ea3949931ef1642f54603d29a38e624065) has the full prompt.
- Omega kept using the wrong sentiment classifier. I switched from a GPT-4 call (expensive, slow) to a DSL-based classifier using Ax LLM (commit [`9a627e6`](https://github.com/thomasdavis/omega/commit/9a627e6390149cf6cc15f0b1d51138b2380ada)), which is 10x faster and costs ~$0.001 per classification.

### Integrating TPM.js

Once TPM.js was stable, I ripped out Omega's hardcoded tools and replaced them with dynamic loading from the registry. This was a one-line change in theory:

```typescript
import { searchRegistry, executeTool } from '@tpmjs/registry-search';
import { executeTool } from '@tpmjs/registry-execute';

// Before
const tools = [generateImage, createComic, analyzeMessage, ...];

// After
const tools = await loadAllTPMJSTools();
```

In practice, it took 12 commits to get right. The issues:

1. **API key injection**: TPM.js tools don't know about Omega's API keys. I wrote a wrapper (commit [`f9432ac`](https://github.com/thomasdavis/omega/commit/f9432ac5f06ebe4869472ae196e580b506a27eea)) that intercepts `executeTool` calls and injects `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. from env vars.

2. **Schema compatibility**: Omega uses AI SDK v6, which expects tools to have an `execute` function. TPM.js tools are just plain async functions. I wrap them:

```typescript
const omegaTool = tool({
  description: tpmjsTool.description,
  parameters: tpmjsTool.inputSchema,
  execute: async (input) => {
    const result = await executeTool({
      packageName: tpmjsTool.packageName,
      exportName: tpmjsTool.exportName,
      input
    });
    return result.output;
  }
});
```

3. **Error handling**: TPM.js tools can fail (network errors, invalid input, etc.). Omega needs to handle these gracefully and explain to the user what went wrong. I added a try/catch wrapper that formats errors as friendly messages.

**Results:** Omega now has access to 30+ tools from the TPM.js registry without a single hardcoded import. When I publish a new tool to npm, Omega gets it within an hour (registry sync time). This feels like magic.

### Database-Backed Everything

I moved almost everything in Omega to PostgreSQL. Previously, it used a mix of JSON files, in-memory caches, and MongoDB. Now:

- **Messages**: Every Discord message Omega sees is stored, along with whether it responded
- **User profiles**: Appearance descriptions, skills, conversation history
- **Generated images**: Comic panels, portraits, DALL-E outputs—all stored as BLOBs with metadata
- **Music**: ABC notation and MIDI files for bot-generated songs
- **TODO lists**: Omega's task tracking (yes, it has its own TODO list)

The image storage schema is particularly elaborate:

```typescript
model GeneratedImage {
  id          Int      @id @default(autoincrement())
  userId      String
  prompt      String
  imageData   Bytes    // The actual PNG/JPEG
  mimeType    String
  width       Int?
  height      Int?
  model       String?  // "gpt-4-vision", "stable-diffusion", etc.
  category    String?  // "comic", "portrait", "scene", etc.
  tags        String[] // ["anime", "chibi", "thomas"]
  metadata    Json?    // Extra stuff like generation params
  createdAt   DateTime @default(now())
}
```

Why store images in the DB instead of S3 or similar? Simplicity. I don't want to manage another service, and the images are small (~500KB each). Postgres can handle it. If it becomes a problem, I'll migrate later.

**How it's measured:** After 2 weeks with the new schema (commit [`3338318`](https://github.com/thomasdavis/omega/commit/3338318bee100d2f3b64eec307090a3848d56ada)), Omega has stored:
- 2,341 messages
- 287 generated images (143 comics, 89 portraits, 55 other)
- 42 ABC notation sheets
- 1,247 decisions

Database size: 1.2GB. Backup script runs daily via Railway cron.

**Pitfalls:**
- JSON columns are a foot-gun. Prisma requires you to JSON.stringify() objects before inserting, but if you accidentally double-stringify, you get `""{...}""` instead of `{...}`. I added defensive checks (commit [`08494e6`](https://github.com/thomasdavis/omega/commit/08494e63ec7e1ec77addc108697531aaccbd5413)).
- Integer vs String IDs. My production DB uses integer IDs, but I initially scaffolded with String. Had to regenerate the Prisma schema from the live DB (commit [`37e560b`](https://github.com/thomasdavis/omega/commit/37e560be40d4faea26f3ea288b569bb96d98cbbf)).
- Binary data (`Bytes` type) doesn't work well with REST APIs. I added an `/api/generated-images/[id]` endpoint that returns raw image data with correct content-type headers.

### Comic Generation Overhaul

Omega generates anime-style comics from GitHub PRs and posts them to Twitter. The process:

1. Fetch PR diff and recent Discord messages
2. Generate a "screenplay" with character dialogue
3. For each panel, generate an anime character speaking the line
4. Composite panels into a vertical manga-style image
5. Post to Twitter with AI-generated summary

I rewrote this entire pipeline. Previously it used Gemini (Google's image model). Now it uses DALL-E 3 via OpenAI, stored in PostgreSQL, with better character attribution.

**Key improvements:**
- Characters are now consistent across panels using prompt engineering: "anime style, chibi proportions, character with [appearance traits from user profile]"
- 20% of the time, Omega adds a "bonus" educational panel explaining a concept from the PR (commit [`d1a7f9c`](https://github.com/thomasdavis/omega/commit/d1a7f9c990eb0e2e9168876d8e407475a8be334d))
- Comics are published to `omegaai.dev` with a permalink (commit [`aea2aea`](https://github.com/thomasdavis/omega/commit/aea2aea191d9ba220a4fed30f5c462f48116af8e))

**Results:** Generated 18 comics in the last 2 weeks. Twitter engagement is meh (~10 likes per post), but the Discord server loves them. Subjectively, the quality improved a lot—characters are more expressive and the dialogue is tighter.

**Next:**
- Voting system for self-proposed tools (let Discord users vote on which features to implement)
- Fine-tune sentiment classifier on Omega's decision log data
- Autonomous tool deprecation (if a tool never gets used, mark it for removal)
- Multi-step tool chains (let Omega compose tools together to solve complex tasks)
- Better comic layouts (currently just vertical stacking, want manga-style panels)

## JSON Resume: AI-Powered Career Pathways

**The Problem:** JSON Resume is a schema for resumes. I maintain the registry and website at jsonresume.org. It's useful for standardizing resume data, but static. Users upload a JSON file, pick a theme, done. What if it could help you navigate your career?

**What I Built:** An AI-powered "pathways" feature that:

1. Analyzes your resume using RAG over job market data
2. Suggests career directions based on your skills and interests
3. Lets you chat with an AI career coach that updates your resume in real-time
4. Integrates with a "jobs graph" visualization of interconnected job postings

### The Pathways Architecture

Pathways uses Vercel AI SDK v6 with tool calling. The tools:

- **updateResume**: Takes a JSON diff and applies it to the user's resume
- **searchJobs**: Queries the jobs graph (a database of 10K+ job postings) using BM25 search
- **analyzeSkills**: Runs a comparison between user skills and job requirements

The resume updates are tricky. AI models are bad at preserving structure. If you ask ChatGPT to "add a skill," it might rewrite your entire resume. So I built a diff-based system:

```typescript
// Bad: LLM generates entire new resume
const newResume = await llm.generate("Add TypeScript skill");

// Good: LLM generates minimal diff
const diff = await llm.generate("Generate diff to add TypeScript skill");
const newResume = applyResumeChanges(currentResume, diff);
```

The `applyResumeChanges` function (commit [`0d97b38`](https://github.com/jsonresume/jsonresume.org/commit/0d97b38c7ae592b87b81505f6f714524f139eb37)) merges arrays intelligently:
- If you add a skill, it appends to `skills` without duplicating
- If you update a job title, it only changes that field
- If you remove something, it preserves the rest

This took 1,724 lines of code and 8 commits to get right. The edge cases are endless. What if the user has multiple jobs with the same title? What if they add a skill that's already there but with different wording?

**How it's measured:** I don't have usage analytics yet (privacy concerns), but I tested it with 15 different resume variations. Before the rewrite, 40% of updates corrupted the resume structure. After, 0% (in my test set).

**Pitfalls:**
- AI SDK v6 changed the tool message format. Previously tools had a `tool-call` state. Now they have `tool-{name}` and `output-available`. I updated all the handlers (commit [`9baa12f`](https://github.com/jsonresume/jsonresume.org/commit/9baa12ffbc70554a18c9aae7a8c9d686efce0667)).
- Resume updates initially didn't trigger UI re-renders. React state wasn't updating. Turned out `updateResume` expected a direct value, not a functional update. Fixed in commit [`8fef826`](https://github.com/jsonresume/jsonresume.org/commit/8fef826460fca0a9d7c4f5bbad56f2438989d70e).

### Jobs Graph Enhancements

The jobs graph is a force-directed graph of job postings. Nodes are jobs, edges are "related jobs" based on shared skills/companies. I added:

- **Keyboard navigation**: Arrow keys move between nodes, Enter opens details
- **Remote filter**: Toggle to show only remote jobs
- **Salary gradient**: Node colors based on salary percentiles (handles outliers with p95 cap)
- **Hide filtered nodes**: Removes filtered jobs from the graph and reconnects edges intelligently

The keyboard navigation (commit [`e198fc6`](https://github.com/jsonresume/jsonresume.org/commit/e198fc67b72c9c99ab4d6c71529fb66e7416ed8c)) was harder than expected. D3 doesn't have built-in focus management, so I had to track state manually and trigger force simulation updates.

**Results:** The graph now feels like a real app instead of a static visualization. Users can explore 1,000+ jobs without touching the mouse.

### Next.js 16 Migration

I upgraded the site from Next.js 15 to 16 (commit [`1ad08fe`](https://github.com/jsonresume/jsonresume.org/commit/1ad08fe7842a067b2994d70a24bc6b184056d8a6)). This broke everything:

- Params are now async (`await params` instead of `params`)
- Cookies API changed (`cookies().get()` is async now)
- React version bumped, which broke styled-components SSR

Took 481 lines of changes across 43 files to fix. The worst part was styled-components caching. Next.js 16's caching is more aggressive, so inline styles weren't regenerating. I added `export const dynamic = 'force-dynamic'` to routes that need fresh data.

**Next:**
- Deploy pathways to production (currently feature-flagged)
- Add career timeline visualization (Gantt chart of job history with projections)
- Integrate LinkedIn data import (scrape profile → generate JSON Resume)
- Train a fine-tuned model on 100K+ resumes for better skill matching

## Blog Automation: Better Devlogs from GitHub Activity

**The Problem:** I want to publish weekly devlogs summarizing my GitHub activity, but writing them manually is tedious. I built a GitHub Action that creates an issue with raw commit data, then Claude Code writes a blog post from it.

**What I Improved:**

1. **Better commit analysis**: Instead of just listing commits, the script now:
   - Groups commits by theme (AI & ML, API & Backend, CLI & Tooling, etc.)
   - Extracts file change stats from diffs
   - Identifies "feature" vs "fix" commits using title patterns

2. **Richer context**: The issue includes:
   - Executive summary with focus areas
   - Per-repo breakdowns with top files
   - Full commit list with clickable links

3. **Escape @mentions**: Claude gets triggered by `@username` in comments. I added escaping to prevent duplicate triggers (commit [`cfa2a7a`](https://github.com/thomasdavis/lordajax.com/commit/cfa2a7a5da6486261e2a3035fdc52c6ef9e1ebac)).

4. **Comprehensive instructions**: The prompt now tells Claude to:
   - Cover ALL repos (not just the interesting ones)
   - Write 4000+ words with detailed sections
   - Include measurable results and honest failures
   - Use first person and developer voice

**How it's measured:** The previous devlog (from Dec 2-9) was 2,847 words and covered 3 out of 5 repos. This one should be 4000+ words and cover all 5. We'll see if Claude actually does it.

**Pitfalls:**
- The activity script hit GitHub API rate limits when fetching commit diffs. I added a 100ms delay between requests. Slows down the script but prevents 403s.
- The issue body was too long (>65KB). GitHub has a 65KB limit for issue bodies. I split the data across multiple comments.

**Next:**
- Auto-post devlogs to Twitter with a summary thread
- Add "interesting commit" detection using GPT-4 to highlight particularly cool changes
- Track devlog quality (word count, commits covered, user engagement) and iterate on the prompt

## MobTranslate: Supabase Migration

**The Problem:** MobTranslate is a dictionary app for Australian Aboriginal languages. It previously used static JSON files for word data, which meant updates required redeploying the app. Terrible for a community-driven project.

**What I Did:** Migrated the dictionary API to Supabase. Now all word lookups hit a PostgreSQL database, and updates can happen without deployment.

The migration (commit [`967ba6a`](https://github.com/australia/mobtranslate.com/commit/967ba6a24a301f943f57efc67cfc32f33b117ddb)) involved:

1. Writing a migration script to load JSON → Supabase
2. Updating API routes from `fs.readFile()` → `supabase.from().select()`
3. Fixing TypeScript errors (Supabase types are gnarly)

**Results:** All 5 dictionary API routes now use Supabase. Latency increased slightly (20ms → 50ms average) due to network round-trip, but it's still fast enough. The big win is I can now give collaborators access to update the dictionary without touching code.

**Pitfalls:**
- Vercel build failed initially because pnpm version mismatch. Vercel defaults to pnpm 8, but the project uses pnpm 9. I updated `vercel.json` to use corepack (commit [`aced664`](https://github.com/australia/mobtranslate.com/commit/aced664be5d74b9bdfc6f3169f7e95c3c6cae016)).

**Next:**
- Add a web UI for community word submissions
- Integrate pronunciation audio (store as BLOBs in Supabase)
- Add etymology/cultural context fields to the schema

## What's Next

- **TPM.js**: Launch on Hacker News, batch health checks, add execution metrics dashboard
- **Omega**: Self-evolution voting, fine-tuned sentiment classifier, autonomous tool deprecation
- **JSON Resume**: Deploy pathways to production, career timeline visualization, LinkedIn import
- **Blog**: Auto-post to Twitter, interesting commit detection, track devlog quality
- **MobTranslate**: Community word submission UI, pronunciation audio
- **Cross-repo**: Build a unified dashboard showing activity across all projects
- **New project**: Tool marketplace where people can sell TPM.js tools (like Gumroad for AI functions)

## Links & Resources

### Projects
- [TPM.js Registry](https://tpmjs.com) - Tool Package Manager for AI Agents
- [TPM.js Playground](https://playground.tpmjs.com) - Try TPM.js tools with Claude
- [Omega Discord Bot](https://github.com/thomasdavis/omega) - Self-evolving AI bot
- [JSON Resume](https://jsonresume.org) - Resume schema and pathways
- [MobTranslate](https://mobtranslate.com) - Aboriginal language dictionary
- [Lord Ajax Blog](https://lordajax.com) - This blog

### NPM Packages
- [@tpmjs/registry-search](https://npmjs.com/package/@tpmjs/registry-search) - Search TPM.js registry
- [@tpmjs/registry-execute](https://npmjs.com/package/@tpmjs/registry-execute) - Execute TPM.js tools
- [@tpmjs/create-basic-tools](https://npmjs.com/package/@tpmjs/create-basic-tools) - Tool generator
- [@tpmjs/markdown-formatter](https://npmjs.com/package/@tpmjs/markdown-formatter) - Example TPM.js tool

### Tools & Services
- [Vercel AI SDK](https://sdk.vercel.ai) - AI abstraction layer
- [Railway](https://railway.app) - Hosting for TPM.js executor
- [Supabase](https://supabase.com) - PostgreSQL hosting
- [Claude Code](https://claude.ai/code) - AI coding assistant
- [JSON Blog](https://github.com/jsonblog/jsonblog) - Static blog generator
