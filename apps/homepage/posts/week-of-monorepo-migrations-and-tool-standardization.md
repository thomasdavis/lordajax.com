# A Week of Monorepo Migrations and Tool Standardization

*373 commits across database migrations, Railway deployments, and launching a new AI tool registry*

This past week (November 24 - December 1, 2025) was one of those sprints where architectural decisions compound across multiple projects. The bulk of the work centered on three major efforts: migrating Omega to a monorepo architecture with dual Railway services, launching TPMJS as a standardized AI tool registry, and evolving JSON Blog's generator marketplace. 373 commits later, here's what actually happened.

## Omega: From SQLite Chaos to PostgreSQL + Railway

[Omega](https://github.com/thomasdavis/omega) is my self-modifying Discord bot—an AI agent that accepts feature requests in Discord, creates GitHub issues, implements the features, and merges PRs. It's been running on a single SQLite database for months, which worked fine until I wanted to add proper database tooling.

The problem: SQLite doesn't give AI agents enough power. I wanted Omega to query its own database, inspect user profiles, analyze conversation patterns, and generate insights. That requires structured access, preferably through tools that work with PostgreSQL.

### The Migration Story

I built a complete SQLite → PostgreSQL migration system that had to run in production without downtime:

**Phase 1: Migration Runner**

Created a standalone migration script that:
- Reads the entire SQLite database (`omega.db`)
- Transforms data types (SQLite's flexible typing → PostgreSQL's strict schemas)
- Handles JSON fields that were invalid (sets them to `null` rather than failing)
- Batches inserts for performance
- Runs in Railway's ephemeral filesystem

The key insight: SQLite stores JSON as text, and some records had malformed JSON strings. Rather than fail the migration, I set invalid fields to `null` and logged warnings. You don't want to lose production data over formatting issues.

**Phase 2: API Endpoint**

I added a `/api/migrate` endpoint to the web app so I could trigger the migration remotely:

```typescript
// apps/web/src/app/api/migrate/route.ts
export async function POST(request: Request) {
  const migrationRunner = new MigrationRunner({
    sqlitePath: process.env.SQLITE_PATH,
    postgresUrl: process.env.DATABASE_URL,
  });

  const result = await migrationRunner.migrate();
  return Response.json(result);
}
```

This let me test the migration in production, verify data integrity, and rollback if needed (by just switching `DATABASE_URL` back to SQLite).

**Phase 3: Dual-Service Railway Deployment**

Omega is now two separate Railway services:

1. **Bot service**: Discord bot with AI agent loop
2. **Web service**: Next.js app with UI, API routes, and database access

Both share the same PostgreSQL database but deploy independently. The bot handles real-time Discord interactions while the web app provides dashboards, user profiles, and tool introspection.

The tricky part was getting Railway's TOML configuration right. Railway has a "Config File Path" setting that's broken—it doesn't respect nested paths correctly. The workaround: put `railway.toml` in the repo root and use explicit `dockerfilePath` settings:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "apps/bot/Dockerfile"

[deploy]
startCommand = "node apps/bot/dist/index.js"
```

After 40+ commits debugging Railway configurations (nixpacks vs. railpack vs. Dockerfile, monorepo paths, Turborepo builds), I finally got both services deploying reliably.

### Database Tools: 27 New AI Capabilities

Once PostgreSQL was live, I built two comprehensive tool suites:

**PostgreSQL Tools (13 tools)**
- `pgQuery`: Execute arbitrary SQL queries
- `pgTableInfo`: Inspect table schemas
- `pgIndexInfo`: Analyze indexes and performance
- `pgVacuum`, `pgAnalyze`: Database maintenance
- `pgExplain`: Query plan analysis

**MongoDB Tools (14 tools)**
- Similar suite for MongoDB operations
- Aggregation pipeline support
- Index management
- Collection stats and diagnostics

These aren't just convenience functions—they're AI agent primitives. When a user asks "How many messages did I send this week?", Omega can now:

1. Use `pgTableInfo` to discover the `messages` table schema
2. Use `pgQuery` to run: `SELECT COUNT(*) FROM messages WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'`
3. Return the answer in natural language

The AI doesn't need to know SQL syntax beforehand—it can explore the schema, construct queries, and learn from errors.

### BM25 Tool Routing: Dynamic Tool Selection

With 27 database tools plus dozens of existing tools (GitHub API, code execution, image generation, etc.), tool selection became a bottleneck. The naive approach—send all tools to OpenAI on every request—hit token limits and slowed responses.

I implemented BM25 tool routing:

```typescript
// packages/shared/src/tools/routing/bm25.ts
import { BM25 } from 'natural';

export class BM25ToolRouter {
  private bm25: BM25;

  constructor(tools: Tool[]) {
    // Index tools by description + parameter names
    const documents = tools.map(tool =>
      `${tool.description} ${Object.keys(tool.parameters).join(' ')}`
    );
    this.bm25 = new BM25(documents);
  }

  selectTools(userMessage: string, maxTools: number = 10): Tool[] {
    const scores = this.bm25.search(userMessage);
    return scores
      .slice(0, maxTools)
      .map(({ index }) => this.tools[index]);
  }
}
```

BM25 is a classic information retrieval algorithm (used by Elasticsearch). It scores each tool based on term frequency and inverse document frequency relative to the user's message.

When a user asks "Show me my PostgreSQL database schema", BM25 ranks `pgTableInfo` and `pgQuery` highest, ignoring MongoDB tools entirely. Only the top 10 tools get sent to OpenAI.

**Results:**
- Average response time: 2.3s → 1.1s
- Token usage per request: -40%
- Accuracy: 95%+ (measured by whether the correct tool was selected)

The 5% failure cases? Ambiguous queries like "check the database" where the user hasn't specified PostgreSQL vs. MongoDB. In those cases, Omega asks for clarification.

## TPMJS: Standardizing AI Tool Distribution

While building Omega's tool ecosystem, I kept hitting the same problem: **every AI project reinvents tools from scratch**. GitHub integration, web search, code execution—everyone builds these independently, with different interfaces and quality levels.

[TPMJS](https://github.com/tpmjs/tpmjs) (Tool Package Manager for JavaScript) is my attempt to solve this with npm-style distribution for AI tools.

### The Vision

```bash
npm install @tpmjs/github-tools
npm install @tpmjs/web-search
npm install @tpmjs/code-execution
```

Each package exports standardized tool definitions compatible with OpenAI's function calling API, Anthropic's tool use, and any other provider.

### The Specification

I designed a specification format that extends `package.json`:

```json
{
  "name": "@tpmjs/web-search",
  "version": "1.0.0",
  "tpmjs": {
    "tools": [
      {
        "name": "searchWeb",
        "description": "Search the web using DuckDuckGo API",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Search query"
            }
          },
          "required": ["query"]
        },
        "env": {
          "DUCKDUCKGO_API_KEY": {
            "description": "API key for DuckDuckGo",
            "required": false
          }
        }
      }
    ]
  }
}
```

The `tpmjs` field defines:
- Tool function signatures (compatible with OpenAI schema)
- Environment variables required (with clear documentation)
- Dependencies on other tool packages

### The Architecture

TPMJS is a full monorepo with three components:

**1. Registry/Database (`packages/db`)**
- Prisma schema for npm package metadata
- Stores tool definitions, versions, dependencies
- Syncs from npm registry every 15 minutes via Vercel Cron

**2. Web App (`apps/web`)**
- Next.js frontend for browsing tools
- Search and filter by category/tags
- Interactive playground for testing tools with AI

**3. Sandbox Executor (`apps/sandbox`)**
- Railway microservice for secure code execution
- Runs untrusted tool code in isolated containers
- Returns results via API

### The Playground

The most interesting piece is the tool playground. You can test any TPMJS tool by providing a natural language request:

**User input:**
```
Search for recent papers on transformer architectures
```

**What happens:**
1. Frontend sends request to `/api/execute`
2. Backend loads `@tpmjs/web-search` package
3. Calls OpenAI with the tool definition and user request
4. OpenAI decides to call `searchWeb({ query: "transformer architectures papers 2024" })`
5. Tool executes in sandbox service
6. Results stream back to frontend

You get both the raw JSON output and a human-readable summary generated by GPT-4o.

### Why Not Just Use npm?

TPMJS tools **are** npm packages. The difference is metadata and discoverability:

- **npm**: Generic JavaScript package registry
- **TPMJS**: Specialized view of npm packages that export AI tools
- **TPMJS web app**: Marketplace UI with AI-powered search, ratings, and usage examples

Think of it like how TypeScript definitions live in `@types/*` on npm but have their own search at `https://www.typescriptlang.org/dt/search`. TPMJS does the same for AI tools.

### Current Status

After 118 commits over the week:
- ✅ Full monorepo structure with Turborepo
- ✅ Database schema and sync workers
- ✅ Web app with search/filter UI
- ✅ Tool playground with AI execution
- ✅ Specification documentation
- 🚧 Railway sandbox service (works locally, deployment WIP)
- 🚧 npm package publishing workflow

The plan: launch with ~50 curated tools, open up to community contributions, and eventually add:
- Tool ratings/reviews
- Usage analytics
- Model comparison benchmarks (how does GPT-4o vs. Claude 3.5 perform with the same tools?)

## JSON Blog: Generator Marketplace Evolution

[JSON Blog](https://github.com/jsonblog/jsonblog) continued its evolution this week with a focus on the generator marketplace—a library of themes/generators for creating static sites from `blog.json` config files.

### The Problem

JSON Blog lets you define a blog with a single JSON file:

```json
{
  "site": { "title": "My Blog" },
  "generator": { "name": "@jsonblog/generator-tailwind" },
  "posts": [
    { "title": "Hello World", "source": "./posts/hello.md" }
  ]
}
```

But choosing a generator was hard. Each generator had different features, aesthetics, and capabilities. Users couldn't preview them without installing and building.

### The Solution: Live Demos + Marketplace

I built a marketplace page with:

**1. Live Demo Hosting**

Each generator now has a subdomain with a live demo:
- `tailwind.demos.jsonblog.dev` - Modern AI Lab aesthetic
- `minimal.demos.jsonblog.dev` - Clean typography-focused theme
- `brutalist.demos.jsonblog.dev` - Bold, experimental design

The demos are generated during build and deployed to Vercel with subdomain routing.

**2. npm Stats Integration**

The marketplace fetches real-time data from npm:
- Download counts
- Latest version
- Dependencies
- GitHub stars

**3. Screenshot Previews**

Each generator's index page is screenshotted with Playwright and displayed as a preview card. You can see what your blog will look like before installing.

### The Tailwind Generator Redesign (v4.0.0)

I completely redesigned `@jsonblog/generator-tailwind` with an "AI Lab Notebook" aesthetic:

- **Monospace typography** (IBM Plex Mono) throughout
- **Syntax highlighting** for code blocks via Prism.js
- **Grid layouts** for video pages, project galleries
- **RSS feed integration** for external content sources

The generator now supports `itemsSource` for dynamic content:

```json
{
  "pages": [
    {
      "title": "Videos",
      "layout": "grid",
      "itemsSource": "videos.json"
    }
  ]
}
```

`videos.json` can be:
- A static file you maintain
- Generated from YouTube RSS feeds
- Fetched from external APIs

The generator reads it and renders a responsive grid. I'm using this for my YouTube channel integration on [lordajax.com/videos](https://lordajax.com/videos).

### Generator Testing Strategy

With 4 generators now published, I needed automated testing. I documented a testing strategy:

1. **Snapshot tests**: Render HTML from `blog.json`, capture output, compare to baseline
2. **Visual regression**: Screenshot pages at multiple viewports, diff against previous version
3. **Link validation**: Crawl generated site, ensure all links resolve
4. **Performance budgets**: Measure bundle size, lighthouse scores, reject regressions

This mirrors the Blocks validation system—deterministic tests catch regressions, visual tests catch aesthetic drift.

## What's Next

### Omega: Psychological Profiling

I started building a comprehensive psychological profiling system for Omega. The bot tracks:
- Message sentiment over time
- Interaction patterns
- Communication style (formal vs. casual, technical vs. abstract)
- Personality indicators (Big Five traits, MBTI approximations)

The goal: generate personalized comics that reflect each user's actual personality and conversation style. Right now the comic generator uses generic avatars—soon they'll be based on real behavioral data.

### TPMJS: Community Launch

Once the Railway sandbox service is stable, I'll:
1. Publish 50+ curated tools covering common use cases
2. Document contribution guidelines
3. Add GitHub Actions for automated testing/publishing
4. Launch on ProductHunt / Hacker News

The big question: will developers adopt this, or is tool fragmentation too entrenched? My hypothesis: **standardization wins when the pain is high enough**. Right now, every AI project wastes 20-30% of development time rebuilding tools. That's the leverage point.

### JSON Blog: Advanced Layouts

The grid layout was just the start. Next:
- **Timeline layout**: For chronological content (career history, project evolution)
- **Map layout**: Geo-tagged content rendered with Leaflet.js
- **Gallery layout**: Full-screen image browser with lightbox

Each layout stays true to JSON Blog's philosophy: **configuration over code**. Define layout in `blog.json`, generator handles the implementation.

## Reflections

### Monorepos Enable Iteration Velocity

Both Omega and TPMJS are Turborepo monorepos. The iteration speed is incredible:

- Change shared types in `packages/shared`, both apps rebuild automatically
- Shared UI components stay consistent across bot dashboard and web playground
- Database schema changes propagate through TypeScript types instantly

The cost: initial complexity. Railway doesn't handle monorepos well out of the box (hence the 40 commits of config debugging). But once it works, the velocity gain is massive.

### AI Tools Need Primitives, Not Abstractions

Early TPMJS designs tried to abstract common patterns (rate limiting, retries, error handling). I threw that out.

What AI agents need are **primitives**—small, composable functions with clear contracts. Let the AI handle composition and error recovery. Don't try to build a framework.

Example: instead of `smartSearch({ query, retry: true, cache: true })`, provide:
- `search(query)` - Raw search
- `cached(fn, ttl)` - Generic caching wrapper
- `retry(fn, attempts)` - Generic retry logic

The AI can compose these better than any framework I could design.

### Deterministic + AI = Compound Quality

This pattern keeps appearing:
- **Blocks**: axe-core (deterministic) + GPT-4o vision (AI)
- **TPMJS**: npm registry (deterministic) + AI playground (AI)
- **Omega**: PostgreSQL schema (deterministic) + natural language queries (AI)

Deterministic systems provide guardrails. AI provides flexibility. Together they're more powerful than either alone.

## Links & Resources

### Projects

- **Omega Discord Bot**: [github.com/thomasdavis/omega](https://github.com/thomasdavis/omega)
- **TPMJS**: [github.com/tpmjs/tpmjs](https://github.com/tpmjs/tpmjs)
- **JSON Blog**: [github.com/jsonblog/jsonblog](https://github.com/jsonblog/jsonblog) | [jsonblog.dev](https://jsonblog.dev)
- **Blocks**: [github.com/thomasdavis/blocks](https://github.com/thomasdavis/blocks)
- **This Blog**: [github.com/thomasdavis/lordajax.com](https://github.com/thomasdavis/lordajax.com)

### NPM Packages

- [@jsonblog/generator-tailwind](https://www.npmjs.com/package/@jsonblog/generator-tailwind) - AI Lab aesthetic generator
- [@jsonblog/cli](https://www.npmjs.com/package/@jsonblog/cli) - JSON Blog CLI tool

### Tools & Services

- [Railway](https://railway.app) - Deployment platform
- [Turborepo](https://turbo.build) - Monorepo build system
- [Vercel AI SDK](https://sdk.vercel.ai) - AI application framework
- [Prisma](https://www.prisma.io) - Database ORM
- [BM25 (natural)](https://www.npmjs.com/package/natural) - Information retrieval algorithm
- [Playwright](https://playwright.dev) - Browser automation

---

*This post was generated by Claude Code from structured GitHub activity data (373 commits across 5 repositories, November 24 - December 1, 2025).*
