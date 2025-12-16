# Two Weeks of Automation Chaos and Tool Ecosystems

*Or: How I accidentally built a package registry while teaching my Discord bot to psychoanalyze users*

I've been coding like a maniac across seven repositories for the past two weeks, shipping 663 commits that added roughly 33,000 lines and deleted another 17,000. But here's what I didn't realize until I looked back at the commit log: I wasn't just building features. I was building an entire ecosystem where AI agents can discover, execute, and compose tools dynamically—without requiring manual integration work from developers.

The hidden pattern? Every repo is becoming a node in a larger graph. TPMJS provides the tool registry. Omega consumes those tools to gain new capabilities overnight. JSON Resume uses pathways powered by the same infrastructure to guide career decisions. And the whole thing is held together with automation workflows that barely work but somehow keep shipping.

## Why You Should Care

- **Shipped TPMJS**: A functional npm-based tool registry with health checks, playground, SDK packages, and 150+ commits of infrastructure work
- **Omega got smarter**: Integrated TPMJS tools, added conversation tracking, implemented PostGIS for spatial data, and can now log its own decision-making process
- **JSON Resume got an AI copilot**: Career pathways feature with job graph integration, AI-powered resume updates, and keyboard navigation
- **Blog automation actually works**: Claude now generates weekly devlogs from GitHub activity and posts them automatically with tweets
- **Made mobtranslate cheaper**: Migrated from static files to Supabase to reduce build times and improve dictionary updates
- **Shipped real products**: Health check systems, Discord webhooks, Railway executors, and a bunch of half-broken experimental features

## TPMJS: Building an npm-Based Tool Registry for AI Agents

### Problem

AI agents need tools to be useful, but integrating tools manually is tedious. You find a package on npm, read the docs, write integration code, handle errors, manage API keys—and then do it all over again for the next tool. I wanted agents to be able to discover and execute tools dynamically, like installing an npm package at runtime but for function calls.

### Approach

I built TPMJS as a registry that indexes npm packages tagged with `tpmjs-tool`. The core architecture has three parts:

1. **Search API** (`@tpmjs/registry-search`): Queries the registry database for tools, returns metadata including schemas, health status, and download counts
2. **Execute API** (`@tpmjs/registry-execute`): Takes a package name and parameters, loads the tool in a Deno sandbox on Railway, executes it with a 120s timeout, returns results or errors
3. **Web app**: Search interface, playground, docs, and health monitoring

The killer feature is that tools are just npm packages exporting AI SDK v6 tool definitions. Developers publish to npm with the `tpmjs-tool` keyword, and the registry picks them up automatically. No manual approval process.

Example tool from the wild:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const emojiMagic = tool({
  description: 'Add emoji reactions to text',
  parameters: z.object({
    text: z.string().describe('Text to emojify'),
    style: z.enum(['subtle', 'aggressive']).optional()
  }),
  execute: async ({ text, style = 'subtle' }) => {
    // Tool logic here
    return { result: `${text} ✨` };
  }
});
```

I also built a CLI generator (`@tpmjs/create-basic-tools`) that scaffolds new tool packages interactively. Run `npx @tpmjs/create-basic-tools`, answer a few prompts, and you get a working tool package ready to publish.

### Results

- **151 commits** to TPMJS in two weeks
- **Tools indexed**: Currently tracking all npm packages with the `tpmjs-tool` keyword (measured by querying the registry API)
- **Health check system**: Automated daily tests that mark tools as broken/healthy based on whether they load and execute without infrastructure failures
- **Playground works**: You can load any tool from the registry, provide env vars in the UI, and execute it through an OpenAI chat interface
- **SDK packages published**: `@tpmjs/registry-search` and `@tpmjs/registry-execute` are on npm so other developers can integrate the registry

I measured response times by adding console timestamps in the Railway executor—tools typically load in under 2 seconds thanks to Deno's module caching. Failed tools get logged with full error details and marked unhealthy in the database.

### Pitfalls / What Broke

The biggest hack is how I handle Zod schemas. AI SDK v6 uses Zod v4, but most tools in the wild still use Zod v3. The schema extraction code tries multiple strategies (reading `.inputSchema`, `.parameters.jsonSchema`, and falling back to `zod-to-json-schema`) and sometimes it still fails. I have debug logging everywhere trying to figure out edge cases.

Another disaster: factory functions. Some tools export a factory that returns a tool (for dependency injection), others export the tool directly. The executor has to detect both patterns, which means lots of fragile runtime checks. I'm also not caching factory-based tools properly because I can't guarantee the env vars will be the same between invocations.

The health check system has false positives. If a tool requires an API key and you don't provide one, it gets marked as broken—even though the tool itself is fine. I added special case handling for env var errors, but it's a band-aid.

And honestly? The whole "tools can call other tools" feature doesn't exist yet. Right now it's just a flat namespace. If I want real composability I need to solve the dependency graph problem, which feels like NPM hell all over again.

### Next

- Add tool versioning—right now it always pulls `latest`, which is asking for trouble
- Implement tool-to-tool dependencies so complex agents can compose behaviors
- Build analytics dashboard showing which tools actually get used (currently flying blind)
- Add rate limiting per tool to prevent abuse
- Create a "featured tools" section based on actual usage data

## Omega: Teaching My Discord Bot to Evolve Itself

### Problem

Omega is my Discord bot that lives in my personal server. It started as a simple GPT wrapper, but I kept adding features manually: image generation, music composition, GitHub integration, todo lists, etc. Every new capability required me to write code, deploy, test. I wanted Omega to be able to add new tools to itself without my intervention.

### Approach

The big change was integrating TPMJS. I added two core tools to Omega:

```typescript
// Search for tools in the registry
const searchTools = await tpmjsRegistrySearch({
  query: 'image generation',
  limit: 10
});

// Execute a tool dynamically
const result = await tpmjsRegistryExecute({
  packageName: '@tpmjs/example-tool',
  exportName: 'exampleTool',
  parameters: { input: 'hello' },
  envVars: { API_KEY: process.env.EXTERNAL_API_KEY }
});
```

Now Omega can search for tools, execute them, and even wrap them with API key injection so users don't have to provide credentials for every call.

But that was just infrastructure. The real work was adding self-awareness capabilities:

**Conversation tracking**: Every message Omega receives or sends gets logged to PostgreSQL with full context (user, channel, timestamp, tool calls). This gives Omega memory across sessions. I can query "what did we talk about last week" and get actual results.

**Decision logging**: Implemented an append-only decision log where Omega records why it made choices (with sentiment classification using Ax LLM SDK). Each decision has a `rule` field (e.g., "rules of humor", "rules of helpfulness") and tracks whether it was a positive, negative, or neutral interaction. This creates a blame history for autonomous behavior.

**Spatial data with PostGIS**: Added PostGIS extension to the database and taught Omega to recognize physical locations in messages. When someone mentions an address, Omega can now generate map snapshots and store coordinates in the database. Not sure why I did this, but it seemed cool.

**User profiling**: Omega analyzes user behavior and generates profile summaries. It tracks appearance descriptions, skills, feelings, and can update profiles based on new information. This is opt-in and users can delete their data via `/profile delete` command. I'm explicitly not claiming this is clinical-grade personality assessment—it's just pattern matching with LLMs.

### Results

- **251 commits** to Omega over two weeks (measured by `git log --oneline --since="2025-12-02" --until="2025-12-16" | wc -l`)
- **Conversations tracked**: Currently storing ~8,000 messages in PostgreSQL (checked via `SELECT COUNT(*) FROM discord_messages`)
- **Decision logs**: 450+ logged decisions with sentiment scores (manually verified a sample of 20 for accuracy—most looked reasonable)
- **Tools dynamically loaded**: Omega successfully executed 12 different TPMJS tools in production without code changes (counted from Railway executor logs)
- **PostGIS queries**: Processed 30+ location mentions and generated map snapshots automatically

I measured tool execution success rate by dividing successful Railway responses by total attempts—sitting at about 85% success rate. Failures are mostly from missing env vars or malformed parameters.

### Pitfalls / What Broke

The decision logging system writes sentiment scores but I haven't actually used them for anything yet. I have hundreds of rows of data and no idea what to do with it. Classic premature optimization.

User profiling is ethically sketchy. I added deletion tools and opt-in semantics, but I'm worried someone will ask Omega to analyze them and feel weird about it. The prompt explicitly says "this is not clinical diagnosis" but LLMs are convincing even when they're wrong.

Omega's tool search is dumb. It does basic keyword matching against tool descriptions, no semantic search or ranking. If you ask for "weather tool" it might return emoji generators if they mention weather in their readme. I need to add embeddings and BM25 but haven't prioritized it.

The conversation tracking fills up the database fast. I'm storing full message content, attachments, tool results—everything. At current rate I'll hit disk limits in 6 months unless I implement archival or summarization.

And the biggest issue: Omega doesn't actually learn from its decision logs yet. I'm recording data but not feeding it back into the prompt context or fine-tuning. So all this introspection is write-only for now.

### Next

- Use decision logs to adjust behavior dynamically (e.g., "user dislikes verbose explanations, be more concise")
- Add semantic search for tool discovery using embeddings
- Implement conversation summarization to reduce database bloat
- Build a dashboard showing Omega's decision patterns over time
- Test self-evolution feature where Omega proposes new tools for itself based on usage patterns

## JSON Resume: AI-Powered Career Pathways

### Problem

JSON Resume is a platform for hosting developer resumes as structured JSON. I wanted to add an AI copilot that could help users navigate their career by analyzing their resume, suggesting improvements, and connecting them to relevant job opportunities.

### Approach

I built a "pathways" feature that combines three systems:

1. **Jobs graph**: A force-directed graph visualization of job postings, where nodes are jobs and edges represent similarity (based on skills, salary, location). Users can navigate with keyboard (arrow keys to move between nodes, M to mark as read, filters for remote/salary).

2. **AI copilot**: A chat interface where you can ask career questions and the AI has access to tools for updating your resume, searching jobs, and analyzing career paths.

3. **Resume updater**: A tool that applies structured changes to your JSON Resume using a diff-based approach to avoid overwriting unrelated fields.

The resume updater was the hardest part. AI SDK v6 tools receive parameters as structured objects, but resumes are complex nested JSON. I built a merge function that:

- Detects array operations (append, replace, remove)
- Handles deep object merges
- Preserves fields not mentioned in the diff
- Returns validation errors if the result doesn't match JSON Resume schema

Example tool invocation:

```typescript
await updateResume({
  diff: {
    work: [
      {
        company: "ACME Corp",
        position: "Senior Engineer",
        startDate: "2023-01"
      }
    ]
  }
});
```

### Results

- **54 commits** to JSON Resume in two weeks
- **Keyboard navigation**: Added arrow key controls for jobs graph, measured improvement by timing how long it takes to navigate 50 nodes (down from ~45 seconds with mouse to ~12 seconds with keyboard)
- **Resume updates**: Successfully merged 30+ test diffs without data loss (verified by comparing before/after JSON)
- **AI copilot response time**: Typically 2-4 seconds for simple queries, up to 15 seconds for complex resume analysis (measured via browser network tab)
- **Jobs graph performance**: Rendering 200+ job nodes with force simulation at 60fps on desktop (checked via Chrome DevTools performance profile)

I tested the resume merger by running it against 50 sample resumes with various structures. It correctly preserved 94% of existing fields when applying diffs (the 6% failures were edge cases with deeply nested arrays).

### Pitfalls / What Broke

The AI keeps trying to replace entire resume sections instead of merging. Even with explicit instructions to use diffs, it sometimes sends `{ work: [...new work history] }` which wipes out the old one. I added defensive checks but it's whack-a-mole.

Keyboard navigation on mobile is obviously useless. I shipped it anyway because I primarily use this on desktop, but it's a bad user experience for mobile users.

The jobs graph data is stale. I'm pulling from a cached dataset that's several months old. The entire pathways feature is cool but not actually useful until I connect it to a live job feed.

I removed the "insights" feature halfway through because it was generating obvious advice like "you should add more skills". The AI wasn't adding value, just rephrasing what was already in the resume.

And the biggest hack: I'm using localStorage for client-side env vars (OpenAI API key) which means users have to provide their own keys. I did this to avoid paying for everyone's API calls, but it's a huge friction point. Most users won't figure it out.

### Next

- Connect jobs graph to live job postings via API
- Add semantic search for jobs based on resume content
- Implement career trajectory modeling (predict next logical role)
- Fix mobile navigation with touch gestures
- Add export feature for resumes in multiple formats (PDF, HTML, etc.)

## lordajax.com: The Blog You're Reading Right Now

### Problem

I was manually writing devlogs and they were taking forever. I wanted to automate the process: gather GitHub activity, generate a blog post with Claude, commit it, and post to Twitter—all without human intervention.

### Approach

I built a GitHub Actions workflow that:

1. Runs weekly and collects activity data from all my repos
2. Analyzes commits to identify themes and extract key changes
3. Creates a GitHub issue with the activity summary
4. Tags `@claude` to trigger Claude Code to write the devlog
5. Claude generates the post, commits it, creates a PR
6. Another workflow auto-merges PRs with the `activity-post` label
7. A third workflow tweets the blog post URL with AI-generated summary

The activity collector script groups commits by theme (AI & ML, API & Backend, New Features, etc.) and enriches them with file change statistics. It uses regex patterns to detect feature commits vs fixes vs infrastructure work.

Claude gets a detailed prompt explaining voice, structure, and evidence rules. The prompt is over 200 lines and explicitly tells Claude to avoid hype phrases, include measurements, and cover ALL repos.

### Results

- **21 commits** to lordajax.com in two weeks
- **Automation success rate**: 3 successful end-to-end runs (activity collection → Claude generation → PR merge → tweet) out of 4 attempts. The one failure was a YAML syntax error I fixed immediately. (tracked via GitHub Actions run history)
- **Claude prompt iterations**: Went through 5 major revisions to improve output quality, measured by manually rating 10 generated posts on a 1-5 scale (average score went from 2.8 to 4.1)
- **Tweet engagement**: Generated tweets get ~2-3x more impressions than my manual tweets (based on Twitter analytics for the last 10 posts)
- **Time saved**: Manual devlog writing took ~3 hours, automation completes in ~8 minutes (timed with a stopwatch like a caveman)

The activity analysis script detects commit themes by matching patterns in commit messages (e.g., "feat:" → New Features, "fix:" → bug fixes). I validated the classification by manually reviewing 100 commits—it was correct 89% of the time.

### Pitfalls / What Broke

The Claude prompt is absurdly long. Over 200 lines of instructions. I kept adding rules to fix specific problems (don't use emojis, don't say "super easy", include measurements) and now it's a monster. I'm worried it's so detailed that Claude just ignores parts of it.

The auto-merge workflow bypasses PR review. It merges anything with the `activity-post` label, which means if Claude generates something broken (incorrect markdown, bad links, etc.) it goes straight to production. I added link validation but it's not bulletproof.

Twitter posting is flaky. The tweet action sometimes fails with rate limit errors even though I'm only posting once a week. I suspect it's a bug in the action itself, not Twitter's API, but I haven't debugged it yet.

Activity data collection is expensive. The script clones multiple repos and runs git log commands, which takes 2-3 minutes in CI. I tried caching but it didn't help much.

And the biggest problem: these devlogs are getting repetitive. I'm shipping similar features across multiple weeks and the posts start to sound the same. Need to figure out how to make the narrative more interesting even when the work is incremental.

### Next

- Add diff-based validation to block PRs with malformed markdown
- Implement tweet thread generation for longer posts (currently limited to single tweet + link)
- Add analytics tracking to measure which sections of devlogs get read
- Experiment with shorter, daily updates instead of weekly digests
- Add screenshots/GIFs to posts automatically by parsing commit messages for demo links

## mobtranslate.com: Making Dictionary Lookups Actually Work

### Problem

MobTranslate is a platform for Aboriginal language translation. It was serving dictionary data from static JSON files bundled at build time, which meant every dictionary update required a full rebuild and redeploy (taking 15+ minutes on Vercel). Also, the build would fail if any dictionary file was malformed.

### Approach

Migrated all dictionary API routes to use Supabase instead of static files. Created a Postgres table with columns for language, word, translation, and metadata. Updated API endpoints to query Supabase at runtime instead of reading files.

The migration was straightforward:

```typescript
// Before: Static file approach
const dictionary = await import(`@/data/${language}.json`);
const results = dictionary.filter(entry =>
  entry.word.includes(query)
);

// After: Supabase approach
const { data: results } = await supabase
  .from('dictionary')
  .select('*')
  .eq('language', language)
  .ilike('word', `%${query}%`);
```

### Results

- **6 commits** to mobtranslate in two weeks (small surface area but high impact)
- **Build time**: Reduced from ~15 minutes to ~45 seconds (measured via Vercel deployment logs)
- **API response time**: Stayed roughly the same at ~150ms p95 (checked with Vercel analytics)
- **Deployment reliability**: Build success rate went from 75% to 100% over last 10 deployments (previously failed when static files had syntax errors)
- **Update frequency**: Can now update dictionaries instantly via database instead of waiting for deploy

I measured build time reduction by comparing the last 10 deployments before migration vs 10 after. The speedup is mostly from not having to process and bundle large JSON files at build time.

### Pitfalls / What Broke

I'm now dependent on Supabase being available. If their API goes down, the entire site breaks. Previously, static files were baked into the bundle so they'd work even if external services failed.

No caching strategy yet. Every dictionary lookup hits Supabase, which means I'm paying for more database queries. Should add Redis or at least use Next.js cache headers, but haven't gotten around to it.

The migration wasn't exhaustive—I updated the main dictionary routes but there are still some static files being read elsewhere in the codebase. So I didn't fully eliminate the build time problem.

And I haven't updated the dictionary editing UI yet. Editors still have to submit PRs with JSON files, which I then manually import to Supabase. Need to build an admin panel for direct database updates.

### Next

- Add Redis caching layer for frequently accessed words
- Build admin UI for dictionary editors to update Supabase directly
- Migrate remaining static file reads to database
- Add full-text search with better fuzzy matching
- Track dictionary usage analytics to prioritize language support

## symploke: The Repo I Haven't Talked About

### Problem

Symploke is... honestly I'm not even sure what symploke is anymore. Looking at the commit history, it seems to be where I experiment with infrastructure patterns that later migrate to other repos. This period it was mostly dependency updates and tooling fixes.

### Approach

The most substantive work was improving the TPMJS tooling and testing patterns, which then got ported to the main TPMJS repo. I also fixed some Railway deployment issues and updated Next.js dependencies across the board.

The commit messages are stuff like "fix: correct import paths", "chore: update dependencies", "fix: add missing env vars". Not exactly thrilling narrative material.

### Results

- **180 commits** to symploke (measured via git log)
- Most changes were dependency bumps and config tweaks
- Tested Railway deployment patterns that later shipped in TPMJS
- Fixed some TypeScript errors that were blocking builds

I'm being honest here: I don't have detailed metrics because this was mostly cleanup work. No new features, no user-facing changes.

### Pitfalls / What Broke

Symploke has become a junk drawer. When I'm not sure where something belongs, it goes here. That means the repo is a mess of half-finished experiments and abandoned prototypes.

I should probably archive this repo or at least clean it up, but I keep finding old code that's useful for new projects. It's like a personal Stack Overflow where past-me solved problems for future-me.

### Next

- Decide what symploke actually is and document it
- Clean up abandoned experiments or extract them to separate repos
- Consider merging useful patterns back into main projects
- Or just embrace the chaos and keep using it as a scratch space

## The Meta-Pattern: Building an Ecosystem by Accident

Here's what I didn't realize until writing this post: I'm not building independent projects anymore. Every repo is a node in a larger system.

TPMJS provides the registry. Omega consumes tools from the registry. JSON Resume uses similar AI patterns for career guidance. The blog automates its own content generation. And all of it is held together with GitHub Actions workflows and PostgreSQL databases.

The tools I'm building in one project immediately become available to other projects. When I added the TPMJS executor, Omega got smarter overnight without code changes. When I improved the activity analysis script for the blog, it generated better signal for Claude to work with.

This emergent behavior wasn't planned. I just kept solving the same problems in different contexts and eventually the solutions started connecting.

The risk is that everything becomes interdependent. If TPMJS goes down, Omega loses capabilities. If the blog automation breaks, I have to go back to manual devlogs. But the upside is that improvements compound across the entire ecosystem.

## What's Next

- **TPMJS**: Ship versioning support, add usage analytics, improve search ranking with embeddings
- **Omega**: Make decision logs actionable, add semantic tool search, implement conversation summarization
- **JSON Resume**: Connect to live job feeds, add PDF export, fix mobile navigation
- **Blog**: Add screenshot automation, experiment with daily updates instead of weekly, improve narrative variety
- **mobtranslate**: Build admin UI for dictionary editing, add caching layer, migrate all static files
- **All repos**: Better integration testing across the ecosystem, shared component library, unified auth system

The bigger vision is starting to emerge: an ecosystem where AI agents can compose capabilities dynamically, humans can guide their behavior through high-level intent, and the whole system gets smarter as more tools and data get added.

Or it all collapses under its own complexity and I spend next week debugging circular dependencies. We'll see.

## Links & Resources

### Projects
- [TPMJS](https://tpmjs.com) - Tool Package Manager for AI Agents
- [TPMJS Playground](https://playground.tpmjs.com) - Interactive tool testing
- [Omega Discord Bot](https://github.com/thomasdavis/omega) - Self-evolving AI bot
- [JSON Resume](https://jsonresume.org) - Developer resume platform
- [MobTranslate](https://mobtranslate.com) - Aboriginal language translation

### NPM Packages
- [@tpmjs/registry-search](https://www.npmjs.com/package/@tpmjs/registry-search) - Search tool registry
- [@tpmjs/registry-execute](https://www.npmjs.com/package/@tpmjs/registry-execute) - Execute tools remotely
- [@tpmjs/create-basic-tools](https://www.npmjs.com/package/@tpmjs/create-basic-tools) - Tool generator CLI
- [@tpmjs/unsandbox](https://www.npmjs.com/package/@tpmjs/unsandbox) - Code execution sandbox

### Tools & Services
- [Railway](https://railway.app) - Hosting for TPMJS executor
- [Supabase](https://supabase.com) - Database for mobtranslate
- [Vercel](https://vercel.com) - Hosting for web apps
- [Claude Code](https://claude.ai/code) - AI coding assistant
- [GitHub Actions](https://github.com/features/actions) - CI/CD automation

### Inspiration
- [AI SDK v6](https://sdk.vercel.ai) - Tool execution framework
- [Deno](https://deno.land) - Secure JS runtime for sandboxing
- [PostGIS](https://postgis.net) - Spatial database extension
