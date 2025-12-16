# Two Weeks of Teaching Bots to Package-Manage Themselves

*I accidentally built npm for AI agents, then taught my Discord bot to use it*

I've been building AI agents for a while now, and every time I wanted to give one a new capability, I'd write a function, wrap it in a schema, register it in a loader, deploy it. Repeat 100 times. It was getting ridiculous. So I built TPMJS — a package manager where AI agents can search for tools, install them dynamically, and execute them in sandboxed environments. Then I plugged it into Omega (my Discord bot), and watched it start browsing its own package registry mid-conversation.

The real story here isn't just "I made a tool registry." It's that I'm building an ecosystem where bots aren't hand-coded with fixed capabilities — they're composable systems that can grow their own skill trees. This period had 660 commits across 7 repos, but the through-line is clear: dynamic capability loading, self-evolution databases, and making AI agents less brittle.

## Why You Should Care

- **Launched TPMJS** — a full tool package manager with npm-style registry, SDK packages (`@tpmjs/registry-search`, `@tpmjs/registry-execute`), health checks, and a live playground at playground.tpmjs.com
- **Built Omega's self-evolution engine** — decision logging, sentiment tracking, autonomous growth capabilities, all backed by PostgreSQL
- **Shipped JSON Resume Pathways** — AI career coach that updates your resume via tool calls and integrates with a jobs graph
- **Automated everything** — activity posts auto-merge, Claude auto-fixes CI failures, Twitter posts new blogs, comics auto-generate from PRs
- **Made bots talk to each other** — bot-to-bot protocol with @mention rules so Omega and Claude can coordinate

## TPMJS: npm for AI Agents

### Problem

Every AI project I touched had the same pattern: a `/tools` directory with dozens of hand-written functions, each wrapped in AI SDK tool schemas. Adding a new capability meant editing 3-4 files, redeploying, hoping nothing broke. Sharing tools across projects? Copy-paste hell. Versioning? Good luck.

I needed a way for agents to discover and load capabilities at runtime without me hardcoding everything.

### Approach

Built a full package manager inspired by npm:

```typescript
// Search the registry
const results = await searchRegistry({
  query: 'generate image',
  limit: 10
});

// Execute a tool dynamically
const result = await executeRegistryTool({
  packageName: '@tpmjs/emoji-magic',
  toolName: 'generateEmoji',
  parameters: { prompt: 'a robot reading a book' }
});
```

The architecture has three layers:
1. **Registry** — PostgreSQL database syncing from npm packages tagged with `tpmjs-tool`, tracking health status, download counts, schemas
2. **SDK packages** — `@tpmjs/registry-search` and `@tpmjs/registry-execute` so any agent can browse and run tools
3. **Railway executor** — Deno-based sandbox that loads tools from npm, injects env vars, executes them, returns results

Health checks run daily via GitHub Actions. Tools that fail infrastructure checks get marked as broken (but not for missing API keys or bad inputs — I learned that distinction after marking half the registry as broken).

### Results

- **151 commits** on TPMJS across two weeks (measured by git log filtering)
- **Live playground** at playground.tpmjs.com where you can chat with GPT-4 and watch it dynamically load tools
- **SDK packages published** to npm — `@tpmjs/registry-search@0.1.1` and `@tpmjs/registry-execute@0.1.1`
- **Generator CLI** — `npx @tpmjs/create-basic-tools` scaffolds new tool packages with defensive patterns baked in
- **Automatic schema sync** — tools update the database with their schemas on first execution

I can now add a tool to the ecosystem by publishing an npm package with a `tpmjs-tool` keyword. No central deployment. No manual registration.

### Pitfalls

- **Zod v3 vs v4 schema serialization broke everything** — AI SDK v6 uses Zod v4, half of npm uses v3, and they serialize JSON Schema differently. I ended up with fallback extraction logic and manual schema sanitization for `type: 'None'` nonsense.
- **Factory functions don't cache well** — tools that return factory functions (for API key injection) bypass my caching layer. I had to disable caching entirely to ensure fresh env vars.
- **Railway Deno cache was slower than no cache** — tried adding a persistent volume for Deno's cache to speed up tool loading. It somehow made things worse. Reverted.
- **OpenAI's tool naming rules are stricter than AI SDK** — had to sanitize tool names to replace invalid characters for playground compatibility

### Next

- Add usage analytics so I can see which tools agents actually use
- Build a "tool recommendation engine" that suggests tools based on conversation context
- Add versioning support — right now it's latest-only
- Create a web UI for browsing the registry (not just the playground)

## Omega's Self-Evolution: Bots Learning from Vibes

### Problem

Omega (my Discord bot) was getting smarter, but it had no memory of why it made decisions. I'd see it route a message one way, then do the opposite an hour later. No learning. No growth.

I wanted Omega to track its own reasoning, learn from sentiment, and evolve its behavior over time.

### Approach

Built an append-only decision log with blame history:

```sql
CREATE TABLE decision_log (
  id SERIAL PRIMARY KEY,
  decision_type TEXT NOT NULL,
  context JSONB,
  reasoning TEXT,
  outcome JSONB,
  sentiment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Every time Omega makes a non-trivial decision (respond or ignore, which tool to use, etc.), it logs:
- What it decided
- Why it decided that
- How it felt about the message (via sentiment classification)
- What happened afterward

I also added a `getUserProfile` tool so Omega can look up past interactions, preferences, appearance data — turning every conversation into a stateful session.

Then I wired up TPMJS so Omega can search for and execute registry tools mid-conversation. It went from ~30 hardcoded tools to 1000+ available dynamically.

### Results

- **329 lines of conversation tracking** schema added (measured by PR diff)
- **Decision log query tool** lets Omega search its own memory with keyword filters
- **Sentiment-based routing** classifies messages before deciding to respond (using Ax LLM DSL — more on that below)
- **Self-evolution PR template** for when Omega wants to propose code changes to itself (not production yet, but the schema is ready)

Omega now says things like "I see you asked about X before, here's an update" or "based on your profile, I think you'd prefer Y". It's creepy in a good way.

### Pitfalls

- **Not a medical diagnosis** — I'm tracking user "feelings" and "sentiment" in the database, but this is explicitly not clinical. It's opt-in, deletable, and purely for UX personalization.
- **Logs grow unbounded** — no TTL or archival strategy yet. I'll hit a scaling wall eventually.
- **Safety rails are half-baked** — the self-evolution schema exists, but I haven't fully implemented approval workflows. Right now it's theoretical.

### Next

- Add decision feedback loops — let users thumbs-up/down Omega's choices
- Build a "rules of engagement" system so Omega can codify its own heuristics
- Implement the full self-evolution workflow with GitHub PR creation

## JSON Resume Pathways: AI Career Coaching

### Problem

I maintain jsonresume.org, and the resume editor was static. You edited JSON by hand, picked a theme, exported PDF. Boring.

I wanted an AI that could interview you, update your resume in real-time, and integrate with job data.

### Approach

Built "Pathways" — an AI chat interface using AI SDK v6 streamText with an `updateResume` tool:

```typescript
const updateResumeTool = tool({
  description: 'Update the user resume with new information',
  inputSchema: z.object({
    diff: z.string().describe('JSON patch or partial update')
  }),
  execute: async ({ diff }) => {
    const updated = applyResumeChanges(currentResume, diff);
    saveResume(updated);
    return { success: true };
  }
});
```

The AI asks questions ("What did you accomplish at Company X?"), then calls the tool to patch your resume JSON. The UI updates live via Yjs and Pusher.

I also integrated it with the jobs-graph visualization — a D3 force-directed graph of job postings with salary gradients and keyboard navigation.

### Results

- **54 commits on jsonresume.org** (measured by repo-specific git log)
- **Tool format migrated to AI SDK v6** — switched from `parameters` to `inputSchema`, rewrote message handlers for the new `tool-invocation` format
- **Live collaboration** via Pusher broadcasting Yjs updates
- **Jobs graph enhancements** — added remote-only toggle, hide-filtered toggle, percentile-based salary gradients, auto-contrast for readability

The AI can now hold a full career conversation and your resume updates as you talk.

### Pitfalls

- **AI SDK v6 tool format changes broke everything** — the message structure shifted from `function-call` to `tool-invocation`, and I had to rewrite all the client-side rendering logic.
- **Resume state updates hit React closure issues** — passing `setResume(prev => ...)` to the tool didn't work. Had to switch to direct value updates.
- **Diff-only enforcement is hard** — I wanted the AI to only send changes, not full resume replacements, but the prompt engineering for that is tricky.

### Next

- Add resume templates beyond the default theme
- Integrate embeddings for job-resume matching
- Build a "career trajectory" timeline view

## Smaller Wins Across Repos

### MobTranslate: Supabase Migration

Migrated all dictionary API routes from static JSON files to Supabase. Before: ~150 lines of file I/O and manual caching. After: direct SQL queries with proper indexes. Measured by line diff: +197/-150.

### lordajax.com: Automated Everything

- **Activity post auto-merge** — PRs with the `activity-post` label skip Claude review and merge automatically
- **Twitter integration** — new blog posts auto-tweet with proper link validation
- **Claude auto-PR workflow** — creates PRs from issues with prefilled templates

The meta-fun here is that this blog post you're reading was generated by the same workflow I'm describing.

### Omega: Comics, Maps, and Bot Protocols

- **Comic storage in PostgreSQL** — moved from filesystem to database with `image_store` table
- **Map snapshots for locations** — when someone mentions a physical location, Omega generates a static map image and Google Maps link
- **Bot-to-bot @mention protocol** — Omega and Claude can now coordinate via explicit @mentions

I also integrated OpenRouter as a fallback LLM provider and added ffmpeg video generation (though I haven't stress-tested that yet).

## What's Next

- **TPMJS HN launch** — adding final polish (usage stats, better docs) before posting to Hacker News
- **Omega self-evolution v1** — finish the PR creation workflow so Omega can propose its own code changes
- **Resume Pathways public beta** — currently live but undocumented, need to write guides
- **Multi-bot coordination** — let Omega, Claude, and other agents collaborate on tasks
- **Smarter tool routing** — use BM25 or embeddings to suggest tools based on conversation context (I added BM25 search to Omega but haven't wired it to tool selection yet)
- **Health monitoring dashboard** — TPMJS tracks tool health, but there's no UI to browse broken tools or see trends
- **Schema registry for arbitrary data** — started building a system where Omega can dynamically create PostgreSQL tables for user data (like "track my workouts" or "save my recipes") without me writing migrations

## Links & Resources

### Projects
- [TPMJS Registry](https://tpmjs.com) — tool package manager for AI agents
- [TPMJS Playground](https://playground.tpmjs.com) — chat with GPT-4 and watch it load tools
- [JSON Resume](https://jsonresume.org) — open-source resume standard
- [Omega AI](https://omegaai.dev) — Discord bot with self-evolution
- [MobTranslate](https://mobtranslate.com) — crowd-sourced translation platform

### NPM Packages
- [@tpmjs/registry-search](https://www.npmjs.com/package/@tpmjs/registry-search) — search the tool registry
- [@tpmjs/registry-execute](https://www.npmjs.com/package/@tpmjs/registry-execute) — execute registry tools remotely
- [@tpmjs/create-basic-tools](https://www.npmjs.com/package/@tpmjs/create-basic-tools) — scaffold new tool packages

### Tools & Services
- [Vercel AI SDK v6](https://sdk.vercel.ai/docs) — the tool execution framework I'm using everywhere
- [Railway](https://railway.app) — where the TPMJS executor runs
- [Ax LLM](https://github.com/ax-llm/ax) — DSL for structured AI tasks (used for sentiment classification)
