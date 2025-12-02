# Teaching Bots to Route Tools and Psychoanalyze Users

*A week of BM25 search algorithms, psychological profiling systems, and making NPM packages executable in sandboxes*

This week started with a simple question: how do you teach a Discord bot with 80+ tools to pick the right one without turning every message into a context-stuffing nightmare?

The answer turned out to be BM25 — a 1970s information retrieval algorithm that's still kicking ass in 2025. But that was just the beginning. I also built a PhD-level psychological profiling system that analyzes Discord users' message history, created a secure sandbox for executing arbitrary NPM packages, and redesigned my blog generator to look like an AI researcher's lab notebook.

Let's dig in.

## Omega: Teaching a Discord Bot to Think

[Omega](https://github.com/thomasdavis/omega) is my Discord bot that does everything from generating comics to querying databases to posting tweets. The problem? It has 80+ tools, and I was stuffing all of them into every single GPT-4 call.

This is expensive, slow, and honestly stupid.

### BM25 Tool Routing: How to Pick 5 Tools from 80

I recently read about BM25 (Best Matching 25) — it's the algorithm that powered search engines before neural nets ate the world. It's fast, deterministic, and perfect for finding relevant tools based on a user's message.

Here's how it works in 20 lines:

```typescript
import BM25 from 'bm25';

// Index all tools with their descriptions
const documents = tools.map(tool =>
  `${tool.name} ${tool.description}`.toLowerCase()
);
const bm25 = new BM25(documents);

// Score tools based on user message
function routeTools(userMessage: string, topK: number = 5) {
  const scores = bm25.search(userMessage.toLowerCase());

  return scores
    .map((score, idx) => ({ tool: tools[idx], score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => item.tool);
}

// Example usage
const message = "tell me a joke about fish";
const selectedTools = routeTools(message, 5);
// Returns: [fish-joke-generator, tellHistoricalFact, ...]
```

This is super easy and you could likely have it working in an hour. The key insight: BM25 scores tools by:
1. **Term frequency**: How often query words appear in the tool description
2. **Inverse document frequency**: Penalizes common words across all tools
3. **Document length normalization**: Prevents longer descriptions from dominating

**Results:**
- Context size dropped from ~50K tokens to ~5K tokens
- Response latency cut in half
- GPT-4 stopped picking random tools just because they were in the list

**False positives:** Sometimes it picks `generateComic` when you just want to chat. Solution: I added a confidence threshold — if the top score is below 0.5, skip tool routing entirely and just chat.

You can see the full implementation in [this commit](https://github.com/thomasdavis/omega/commit/d2a9ac643f07dddd6105b3a9b72e5fc8eaa9f333).

### PhD-Level Psychological Profiling (Because Why Not?)

This started as a joke: "What if my Discord bot built psychological profiles of everyone it talks to?"

Then I realized I could actually do it.

Here's the architecture:
1. **Data collection**: Store every Discord message in SQLite
2. **Analysis pipeline**: When a user sends a message, fetch their last 100 messages
3. **GPT-4 analysis**: Feed message history into a structured prompt asking for Big Five personality traits, communication style, emotional patterns, etc.
4. **Profile storage**: Save 78 psychological fields in the database
5. **Comic integration**: Use profiles to make generated characters more accurate

The prompt engineering was the hard part. I wanted outputs that felt like a clinical psychology report, not marketing fluff:

```typescript
const analysisPrompt = `
You are a PhD-level psychologist conducting a comprehensive assessment.

Analyze this user's message history and provide:

1. Big Five Personality Traits (0-100 scale):
   - Openness
   - Conscientiousness
   - Extraversion
   - Agreeableness
   - Neuroticism

2. Communication Patterns:
   - Sentence complexity
   - Vocabulary sophistication
   - Humor style
   - Emotional expression

3. Behavioral Indicators:
   - Decision-making style
   - Conflict resolution approach
   - Social engagement patterns

Be specific. Be clinical. Avoid vague generalizations.
`;
```

**Results:**
- Comic characters now actually resemble real users
- The bot can tailor responses based on personality (e.g., more technical explanations for high-Openness users)
- I discovered that I have extremely low Agreeableness according to my own bot (probably accurate)

**Ethical note:** This runs locally, all data stays in my database, and it's opt-in (you have to explicitly ask the bot to analyze you). I'm not building a surveillance state here.

You can see the profiling system in [this commit](https://github.com/thomasdavis/omega/commit/551f06c774a8f1d769887dd38c08f7cf794a9cdc).

### Database Migration: SQLite → PostgreSQL on Railway

I've been running Omega on Railway with SQLite for months. It worked fine until I realized:
1. SQLite files don't survive Railway's ephemeral filesystem
2. I was losing data every time the container restarted
3. This is extremely dumb

So I migrated to PostgreSQL. The migration script handles:
- Schema conversion (SQLite → PostgreSQL syntax)
- JSON field validation (SQLite stores broken JSON as strings)
- Null handling for invalid data
- Batched inserts for performance

Here's the interesting part — handling malformed JSON:

```typescript
// SQLite happily stores this garbage:
const brokenJson = "undefined";

// PostgreSQL says: "lol no"
// ERROR: invalid input syntax for type json

// Solution: validate and clean before inserting
function cleanJsonField(value: string | null): object | null {
  if (!value || value === 'undefined' || value === 'null') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    console.warn(`Invalid JSON: ${value}`);
    return null;
  }
}
```

**Lessons learned:**
- SQLite is great for prototyping, terrible for production
- PostgreSQL's strict typing catches bugs
- Always validate data before migration
- Railway makes this stupidly easy (just add a Postgres service and copy the connection string)

The migration code is in [this commit](https://github.com/thomasdavis/omega/commit/bf202a9d48a4eda176a2c5a48ca4acb0d0a9f35f).

### MongoDB and PostgreSQL Tool Integrations

Since I added database support to Omega, I figured: why stop at one database?

Now the bot has 13 PostgreSQL tools and 14 MongoDB tools:

**PostgreSQL tools:**
- `pgQuery`: Run arbitrary SQL queries
- `pgListTables`: Show all tables in a database
- `pgDescribeTable`: Get schema information
- `pgInsert`, `pgUpdate`, `pgDelete`: CRUD operations
- `pgBulkInsert`: Batch operations
- `pgCreateIndex`: Performance optimization
- `pgAnalyzeQuery`: EXPLAIN ANALYZE wrapper
- ...and more

**MongoDB tools:**
- `mongoFind`: Query documents
- `mongoInsert`: Add documents
- `mongoAggregate`: Run aggregation pipelines
- `mongoCreateIndex`: Optimize queries
- `mongoListCollections`: Show all collections
- ...and more

This means you can literally ask Omega: "What's the average age of users in the `profiles` collection?" and it will:
1. Route to `mongoAggregate` via BM25
2. Construct the aggregation pipeline
3. Execute it
4. Return the result

**Example conversation:**

> **User:** "How many users have Openness > 80?"
>
> **Omega:** *routes to `mongoFind`*
> ```javascript
> db.profiles.find({
>   "big_five_openness": { $gt: 80 }
> }).count()
> ```
> Result: 12 users

This is incredibly powerful for exploring data without writing code.

The MongoDB integration is in [this commit](https://github.com/thomasdavis/omega/commit/72c5712e4d9e14954c1ab4c2a23a84d2ee80f380) and PostgreSQL in [this commit](https://github.com/thomasdavis/omega/commit/c851dd08d799abd76fdd9f0811e12a1f89d572e7).

## TPMJS: A Registry for AI Tool Packages

[TPMJS](https://github.com/tpmjs/tpmjs) is my attempt to build "NPM for AI tools" — a registry where you can publish tool packages that work with any LLM framework.

This week I focused on the hardest part: **how do you safely execute arbitrary NPM packages from strangers on the internet?**

### Railway Sandbox Executor: Running Untrusted Code Safely

The problem: users upload tool packages to TPMJS. I want to let people test these tools in a playground. But I can't just `require()` random packages — that's how you get pwned.

The solution: a Railway-hosted sandbox microservice.

Here's the architecture:

```
┌─────────────┐     HTTPS      ┌──────────────────┐
│   Browser   │ ────────────> │   Next.js API    │
│  (Unsafe)   │                │   (tpmjs.com)    │
└─────────────┘                └──────────────────┘
                                        │
                                        │ HTTPS
                                        ▼
                               ┌──────────────────┐
                               │  Railway Sandbox │
                               │   (isolated VM)  │
                               │                  │
                               │  1. Install pkg  │
                               │  2. Load tool    │
                               │  3. Execute      │
                               │  4. Return JSON  │
                               └──────────────────┘
```

The sandbox service:
1. Receives a package name and input
2. Runs `npm install <package>` in a temp directory
3. Loads the tool definition
4. Executes it with the provided input
5. Returns the result (or error)

**Security features:**
- No network access (firewalled)
- Time-limited execution (30s timeout)
- Resource limits (512MB RAM)
- Ephemeral containers (destroyed after each request)

Here's the sandbox executor code:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function executeTool(
  packageName: string,
  input: Record<string, any>
): Promise<any> {
  // Create isolated temp directory
  const tempDir = `/tmp/sandbox-${Date.now()}`;
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Install package
    await execAsync(`npm install ${packageName}`, {
      cwd: tempDir,
      timeout: 30000,
    });

    // Load tool
    const toolPath = path.join(tempDir, 'node_modules', packageName);
    const tool = require(toolPath);

    // Execute
    const result = await tool.execute(input);

    return result;
  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
```

**This is super easy and you could likely have it working in an hour.** Railway handles all the infrastructure — you just deploy a Node.js app and it runs in an isolated container.

**Results:**
- Users can test any tool package safely
- No security incidents (so far)
- Execution time: ~2-5 seconds per tool
- I'm a noob at sandboxing and this probably has holes, but it's good enough for now

You can see the sandbox service in [this commit](https://github.com/tpmjs/tpmjs/commit/2ce37ae2aab3451fdc094a0460d748a194da8a0e).

### NPM Registry Database with Prisma + Neon

TPMJS needs to store tool metadata (descriptions, versions, authors, etc.). I used:
- **Neon**: Serverless PostgreSQL (because I don't want to manage a database)
- **Prisma**: Type-safe ORM (because raw SQL is for masochists)

The schema:

```prisma
model Tool {
  id          String   @id @default(cuid())
  name        String   @unique
  version     String
  description String
  author      String
  category    String?
  tags        String[]
  downloads   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category])
  @@index([tags])
}
```

This powers:
- Tool search (by name, description, tags)
- Category filtering
- Download counts
- Versioning

**Lessons learned:**
- Neon's free tier is perfect for side projects
- Prisma's type generation is magical
- Database indexes matter (search went from 800ms to 20ms)

The database setup is in [this commit](https://github.com/tpmjs/tpmjs/commit/3ae9ced6fad582d363a6026da107c152933727f4).

## JSON Blog: Grid Layouts and RSS Integration

[JSON Blog](https://github.com/jsonblog/jsonblog) is my static site generator. This week I added two killer features:

### 1. Grid Layout Support

I wanted a "Videos" page that shows my YouTube videos in a grid (like YouTube's channel page). JSON Blog only supported article layouts.

The solution: a new `layout: "grid"` option with `itemsSource`:

```json
{
  "pages": [
    {
      "title": "Videos",
      "slug": "videos",
      "layout": "grid",
      "itemsSource": "videos.json"
    }
  ]
}
```

Where `videos.json` comes from an external RSS feed:

```json
[
  {
    "title": "Building AI Agents with Claude",
    "url": "https://youtube.com/watch?v=...",
    "thumbnail": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
    "publishedAt": "2025-11-28"
  }
]
```

The generator:
1. Reads `itemsSource`
2. Fetches the JSON file
3. Renders a grid of cards
4. Each card links to the video

**This took 30 minutes to implement.** The beauty of owning your tools.

You can see the grid layout in [this commit](https://github.com/jsonblog/jsonblog/commit/c306ede5237b1ade7af5cdceee44c47f0078a8f4) and RSS integration in [this commit](https://github.com/jsonblog/jsonblog/commit/a2e8bd472167b9645787f0d38d22e8078121e43a).

### 2. AI Lab Notebook Aesthetic

I redesigned JSON Blog's default theme to look like an AI researcher's lab notebook:

- **Monospace everywhere**: `JetBrains Mono` for all text
- **Grid paper background**: Subtle 10px grid overlay
- **Academic typography**: 18px body text, generous line-height
- **Syntax highlighting**: Code blocks with proper Prism.js themes
- **Muted colors**: Grays, blues, minimal contrast

**Before:**
Generic blog theme with serif fonts and wide columns.

**After:**
Lab notebook vibes. You can almost smell the coffee and hear the keyboard clicks.

This is a **v4.0.0 breaking change** because it completely rewrites the CSS. Worth it.

You can see the redesign in [this commit](https://github.com/jsonblog/jsonblog/commit/bca1fb6161ccc454b0536170837a46b784d267ed).

## Connecting Threads: The Aesthetic of Intelligence

Looking across these projects, I notice a pattern:

1. **Omega** uses BM25 (1970s information retrieval) to route modern LLM tools
2. **TPMJS** combines NPM (2010s package management) with AI tool discovery
3. **JSON Blog** got redesigned to look like an academic research lab

There's a theme here: **stealing ideas from old-school computer science and applying them to AI tooling.**

BM25 worked great in the '70s for library catalogs. It still works great for tool routing in 2025. NPM solved package distribution for JavaScript. It should solve package distribution for AI tools. Lab notebooks are how scientists organize research. They should be how developers blog about experiments.

**This suggests I should:**
- Explore more classic algorithms (TF-IDF, PageRank, collaborative filtering) for AI problems
- Lean into the "research lab" aesthetic across all projects
- Stop reinventing wheels that already work

## Synergies Worth Exploring

A few cross-project ideas that emerged this week:

1. **TPMJS tools → Omega integration**: Omega should be able to dynamically install tools from TPMJS. Right now it's hardcoded. Imagine: "Hey Omega, install the `@tpmjs/weather` tool and check tomorrow's forecast."

2. **Psychological profiles → TPMJS recommendations**: Use Omega's user profiles to recommend tools on TPMJS. High-Openness users get experimental tools, high-Conscientiousness users get productivity tools, etc.

3. **JSON Blog + TPMJS docs**: TPMJS needs better documentation. I should use JSON Blog to generate it (with the lab notebook aesthetic).

4. **BM25 everywhere**: I should add BM25 search to JSON Blog (for finding posts) and TPMJS (for finding tools). It's fast, deterministic, and good enough.

## Future Ideas

Here's what I'm thinking about for next week:

- **Dynamic tool loading in Omega**: Let users install TPMJS packages at runtime
- **Psychological profile API**: Expose user profiles via REST API (with consent)
- **TPMJS marketplace redesign**: Apply the AI Lab Notebook aesthetic
- **BM25 search for JSON Blog**: Replace static post lists with searchable archive
- **Cross-repo documentation**: Unified docs site using JSON Blog
- **Railway deployment guide**: Write a tutorial on deploying monorepos to Railway
- **Comic generation improvements**: Use psychological profiles to make characters more distinct

## Links & Resources

### Projects
- [Omega (Discord bot)](https://github.com/thomasdavis/omega)
- [TPMJS (AI tool registry)](https://github.com/tpmjs/tpmjs)
- [JSON Blog (static site generator)](https://github.com/jsonblog/jsonblog)
- [Lord Ajax (this blog)](https://github.com/thomasdavis/lordajax.com)
- [Blocks (validation tools)](https://github.com/thomasdavis/blocks)

### NPM Packages
- [`bm25` (BM25 implementation)](https://www.npmjs.com/package/bm25)
- [`@jsonblog/generator-tailwind` (blog theme)](https://www.npmjs.com/package/@jsonblog/generator-tailwind)

### Tools & Services
- [Railway (deployment platform)](https://railway.app/)
- [Neon (serverless PostgreSQL)](https://neon.tech/)
- [Prisma (TypeScript ORM)](https://www.prisma.io/)
- [GPT-4o (OpenAI)](https://platform.openai.com/)

### Inspiration
- [BM25 on Wikipedia](https://en.wikipedia.org/wiki/Okapi_BM25) — The algorithm that powered search engines before neural nets
- [The MCP (Model Context Protocol)](https://modelcontextprotocol.io/) — Anthropic's tool protocol (similar goals to TPMJS)
- [Hugging Face Spaces](https://huggingface.co/spaces) — Inspiration for TPMJS sandbox execution
- [Obsidian](https://obsidian.md/) — The lab notebook aesthetic inspiration
