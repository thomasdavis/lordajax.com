# Two Weeks of Teaching Agents to Discover and Execute Tools

*655 commits across 7 repos, building the plumbing for a world where AI agents can find, execute, and compose arbitrary NPM packages*

I've been building something without fully admitting it: an ecosystem where AI agents don't just call predefined functions — they discover tools in a public registry, read their schemas, and execute them in sandboxes.

This past two weeks was about making that real. TPMJS (Tool Package Manager for JavaScript) got launch-ready with changelog pages and HN-worthy polish. Omega, my autonomous Discord bot, learned to search the TPMJS registry and execute tools on demand. JSON Resume's AI copilot got keyboard navigation and upgraded to Next.js 16. And I migrated a bunch of static-file bullshit to actual databases because I got tired of committing JSON blobs.

The pattern: **tools as discoverable infrastructure**. Not hardcoded SDKs. Not vendor lock-in. Just NPM packages with schemas that agents can find and run.

## Why You Should Care

- **TPMJS registry got launch-ready** with a changelog page, 1000-tool API limit, and auto-updating schemas when tools execute
- **Omega can now search and execute TPMJS tools** with automatic API key injection and conversation tracking across threads
- **JSON Resume upgraded to Next.js 16** and added keyboard navigation to the jobs graph (arrow keys to explore, 'M' to mark nodes as read)
- **MobTranslate migrated from static files to Supabase** for the entire dictionary API
- **Omega got sentiment-based decision logging** — it tracks its own reasoning, measures user satisfaction, and adjusts behavior autonomously
- **AI SDK v6 migration** across multiple projects (inputSchema replaces parameters for tool definitions)

## TPMJS: Making a Registry That Doesn't Suck

[TPMJS](https://tpm.sh) is a registry for AI agent tools. Think NPM, but packages export schemas (Zod, JSON Schema, MCP) so agents can understand what they do.

I've been working on this for months, but this sprint was about making it launch-ready.

### Problem: How Do You Track 300+ Tool Releases?

The registry had 300+ tools across dozens of packages, but no changelog. Users (and I) had no way to see what was new.

### Approach: Build a Changelog Page

I added a `/changelog` route that queries the registry API for all packages, sorts by `npmPublishedAt`, and displays release history with links to NPM and GitHub.

```typescript
// Fetch all packages sorted by publish date
const response = await fetch('https://tpm.sh/api/tools?limit=1000');
const tools = await response.json();

const packages = tools
  .filter(t => t.npmPublishedAt)
  .sort((a, b) => new Date(b.npmPublishedAt) - new Date(a.npmPublishedAt));
```

The tricky part: I had to add null safety for dates because some packages in the registry were scraped before NPM metadata was consistently fetched. Fixed in [6ccb5fb](https://github.com/tpmjs/tpmjs/commit/6ccb5fbd7983f6a89d6a2454e1d44ebaa3dbde6d).

**Results:**
- [Changelog page](https://tpm.sh/changelog) now shows all 300+ tools with publish dates
- Increased API limit from 100 to 1000 to support this (commit [3cb636a](https://github.com/tpmjs/tpmjs/commit/3cb636a7033699b0d1bef28433b4d218307b962e))
- Response payload is still under 500KB because I'm only returning essential fields

**What broke:** Initially forgot that `npmPublishedAt` could be null for tools that were indexed before I added that field. Had to wrap every date operation in null checks.

### Auto-Updating Schemas When Tools Execute

The registry tracks tool schemas, but they can drift from what's actually published on NPM. I wanted schemas to auto-update whenever someone executes a tool.

I moved schema updates into the executor itself ([72bdc5e](https://github.com/tpmjs/tpmjs/commit/72bdc5e8547e057b9d4e931ba50fad3a9d8410e9)):

```typescript
// After loading the tool from NPM
const toolFunction = await import(toolPackage);
const schema = toolFunction.schema; // Zod, JSON Schema, or MCP

// Update registry database
await db.tools.upsert({
  where: { packageName: toolPackage },
  update: { schema, lastExecutedAt: new Date() }
});
```

**Results:**
- Registry schemas stay in sync with NPM without manual updates
- Execution stats now tracked per tool (useful for ranking later)

**Pitfalls:** This only updates schemas when tools are executed, not when they're published. For now, that's fine — most tools get executed during testing. But I'll need a background job for stale tools eventually.

**Next:**
- Add execution count and popularity metrics to the homepage
- Implement background sync for tools that haven't been run in 30 days
- Add a "recently updated" section to surface new tool versions

## Omega: An Autonomous Agent That Discovers Tools

[Omega](https://github.com/thomasdavis/omega) is my Discord bot. It started as a GPT-4 wrapper but has evolved into something weirder: an agent that tracks conversations, logs its own decisions, and now discovers tools dynamically.

### Problem: Hardcoded Tools Don't Scale

Omega had ~80 tools, all imported directly. Every new tool required editing the codebase, redeploying, and hoping nothing broke.

This is fine for a pet project but embarrassing for someone building a tool registry.

### Approach: Integrate TPMJS Search and Execute

I added two new core tools to Omega:

1. **`tpmjs.search`**: Searches the registry by keyword
2. **`tpmjs.execute`**: Loads a tool from NPM, injects API keys, and runs it in a sandbox

```typescript
// Omega can now do this autonomously
const searchResults = await tpmjs.search("weather forecast");
// Returns: [{name: "@tpmjs/openweathermap", description: "..."}]

const result = await tpmjs.execute("@tpmjs/openweathermap", {
  city: "San Francisco"
});
// Returns: {temperature: 62, conditions: "cloudy"}
```

The tricky part: API keys. Many TPMJS tools need external API keys (OpenAI, Anthropic, etc.). I didn't want to hardcode them in every tool call, so I built a wrapper that auto-injects keys from Omega's environment ([f9432ac](https://github.com/thomasdavis/omega/commit/f9432ac5f06ebe4869472ae196e580b506a27eea)):

```typescript
async function executeWithKeys(toolName: string, params: any) {
  const apiKeys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    // ... etc
  };

  return tpmjs.execute(toolName, { ...params, apiKeys });
}
```

**Results:**
- Omega can now search 300+ tools and execute them without code changes
- No more deploying just to add a new tool
- Tools run in isolated sandboxes (thanks to TPMJS executor)

**Measured how:** Tested by asking Omega to search for tools it had never seen before ("find me a tool for currency conversion") and confirming it discovered and executed `@tpmjs/currency-converter` without any prior knowledge.

**What broke:** Sandboxing is not bulletproof. Malicious NPM packages could still do damage. Current mitigation: only execute tools from the TPMJS registry, which I manually review. Long-term, I need proper VM isolation.

**Next:**
- Add a "tool approval" flow so Omega asks before executing unfamiliar tools
- Track tool execution history and success rates
- Build a feedback loop where Omega reports broken tools back to TPMJS

### Sentiment-Based Decision Logging

Omega makes dozens of decisions per conversation: which tools to call, how to respond, whether to intervene. I wanted it to track those decisions and learn from them.

I added a decision log ([b7ae795](https://github.com/thomasdavis/omega/commit/b7ae795a6074a816b6347ff10e610bce22631405)):

```typescript
interface Decision {
  id: string;
  timestamp: Date;
  type: "tool_selection" | "response_strategy" | "intervention";
  reasoning: string;
  outcome: "success" | "failure" | "neutral";
  sentiment: number; // -1.0 to 1.0 based on user reaction
}
```

After every interaction, Omega analyzes user responses for sentiment (positive, neutral, negative) and logs how its decision performed. Over time, it builds a history of what works.

**Results:**
- Decision log has 500+ entries after one week of use
- Sentiment scoring is crude (keyword matching) but functional
- I can query the log to find patterns like "tool X fails 80% of the time in context Y"

**Measured how:** Sentiment is scored by looking for positive indicators ("thanks", "nice", "perfect") vs negative indicators ("wrong", "broken", "wtf") in the next 3 user messages. Crude but sufficient for now.

**What broke:** False positives everywhere. If someone says "this is not wrong", the naive keyword matcher sees "wrong" and logs negative sentiment. Need to upgrade to a proper sentiment model eventually.

**Next:**
- Implement append-only blame history so I can see why Omega changed its behavior
- Add weekly summary reports: "Here's what I learned this week"
- Use decision log to auto-tune tool selection thresholds

### Conversation Tracking Across Threads

Discord has threads, and Omega kept losing context when users replied in a thread instead of the main channel.

I added conversation tracking ([b1b6093](https://github.com/thomasdavis/omega/commit/b1b60934c6ebf4b88c69ac879fc9bb67f839f47b)):

```typescript
async function getConversationHistory(threadId: string) {
  // Fetch parent message
  const parent = await discord.fetchMessage(thread.parentId);

  // Fetch all thread messages
  const messages = await discord.fetchThreadMessages(threadId);

  return [parent, ...messages].sort((a, b) => a.timestamp - b.timestamp);
}
```

**Results:**
- Omega now maintains context across threads
- Users can have multi-turn conversations without repeating themselves

**Measured how:** Tested by starting a thread about a specific topic (e.g., "help me debug this Python error"), replying 5 times without re-explaining the context, and confirming Omega remembered the original question.

**Pitfalls:** Thread history isn't paginated, so long threads (100+ messages) will blow up context limits. For now, I truncate to the last 20 messages.

**Next:**
- Implement smart summarization for long threads (first message + last 10)
- Store conversation summaries in the database for retrieval

## JSON Resume: Next.js 16 and Keyboard Navigation

[JSON Resume](https://jsonresume.org) is a platform for building and sharing resumes. I've been working on an AI copilot that helps users update their resumes conversationally.

This sprint was about polish: upgrading to Next.js 16 and adding keyboard navigation to the jobs graph (a visual tool for exploring career paths).

### Next.js 16 Upgrade

Next.js 16 dropped with faster builds and improved server components. Upgrading was surprisingly smooth — only one breaking change:

AI SDK v6 changed tool definitions from `parameters` to `inputSchema` ([92a7817](https://github.com/jsonresume/jsonresume.org/commit/92a7817619a4627ddcab6b30576392345565dde9)):

```typescript
// Old (AI SDK v5)
const tool = {
  name: "updateResume",
  parameters: z.object({ section: z.string() })
};

// New (AI SDK v6)
const tool = {
  name: "updateResume",
  inputSchema: z.object({ section: z.string() })
};
```

**Results:**
- Next.js 16 builds are ~20% faster (eyeballed, no hard data)
- AI SDK v6 tools work correctly

**What broke:** Forgot to update one tool definition and spent 30 minutes debugging a "parameters is not defined" error.

### Keyboard Navigation for Jobs Graph

The jobs graph is a force-directed layout showing job postings and their relationships. Users could click nodes, but navigating with a mouse sucks for power users.

I added keyboard navigation ([e198fc6](https://github.com/jsonresume/jsonresume.org/commit/e198fc67b72c9c99ab4d6c71529fb66e7416ed8c)):

```javascript
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") selectNextNode();
  if (e.key === "ArrowLeft") selectPrevNode();
  if (e.key === "m") markNodeAsRead();
  if (e.key === "Enter") openNodeDetails();
});
```

**Results:**
- Users can navigate the entire graph without touching the mouse
- 'M' key marks nodes as read (stored in localStorage)

**Measured how:** Tested by loading a graph with 50 nodes and navigating through all of them using only the keyboard. Took ~2 minutes, compared to ~5 minutes with mouse clicking.

**Pitfalls:** No visual indicator for the selected node initially. Added a highlight ring in a follow-up commit ([5356c79](https://github.com/jsonresume/jsonresume.org/commit/5356c796c1f2429dae22ece281d3bdd9e43ae591)).

**Next:**
- Add search/filter (press '/' to focus search bar)
- Vim-style navigation (hjkl keys)
- Breadcrumb trail showing navigation history

## MobTranslate: Static Files to Supabase

[MobTranslate](https://mobtranslate.com) is a language-learning app for Australian Aboriginal languages. The dictionary API was serving static JSON files committed to the repo.

This was embarrassing and broken.

I migrated everything to Supabase ([967ba6a](https://github.com/australia/mobtranslate.com/commit/967ba6a24a301f943f57efc67cfc32f33b117ddb)):

```typescript
// Old (static files)
const dictionary = await fetch("/data/dictionary.json");

// New (Supabase)
const { data } = await supabase
  .from("dictionary")
  .select("*")
  .eq("language", "wiradjuri");
```

**Results:**
- Dictionary API is now queryable, filterable, and editable without redeploying
- Removed 5MB of JSON files from the repo

**Measured how:** Compared API response times before (static file fetch: ~50ms) and after (Supabase query: ~80ms). Slight regression, but acceptable for the flexibility gained.

**What broke:** Forgot to add an index on the `language` column. First Supabase queries took 2+ seconds. Fixed by adding `CREATE INDEX idx_language ON dictionary(language);`.

**Next:**
- Add full-text search with Postgres `tsvector`
- Expose a public API endpoint for other apps to query

## What's Next

- **Launch TPMJS on Hacker News** — it's ready, just need to write the Show HN post
- **Omega self-improvement loop** — let it propose, test, and merge its own tool improvements
- **TPMJS execution stats** — show which tools are most popular, which are broken
- **JSON Resume AI copilot mobile** — the current UI is desktop-only, need a mobile redesign
- **MobTranslate audio pronunciation** — add audio files for dictionary entries
- **Symploke filter toolbar** — added basic filtering this week, need search and sort next
- **Blog automation** — the GitHub Actions workflow that generates these posts still needs manual tweaking

## Links & Resources

**Projects:**
- [TPMJS Registry](https://tpm.sh) — Tool Package Manager for AI agents
- [Omega](https://github.com/thomasdavis/omega) — Autonomous Discord bot with TPMJS integration
- [JSON Resume](https://jsonresume.org) — Resume builder with AI copilot
- [MobTranslate](https://mobtranslate.com) — Australian Aboriginal language learning
- [Symploke](https://github.com/thomasdavis/symploke) — Internal data visualization tool

**Tools & Services:**
- [Vercel AI SDK v6](https://sdk.vercel.ai/docs) — used for all AI tool definitions
- [Supabase](https://supabase.com) — Postgres hosting for MobTranslate
- [BM25.js](https://github.com/dorianbrown/bm25) — search algorithm for tool routing (see previous post)
- [Next.js 16](https://nextjs.org/blog/next-16) — faster builds, improved server components
