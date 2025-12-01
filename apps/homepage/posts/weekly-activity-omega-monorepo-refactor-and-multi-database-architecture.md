# Weekly Activity: Omega Monorepo Refactor and Multi-Database Architecture

This week was dominated by a massive architectural overhaul of [Omega](https://github.com/thomasdavis/omega)—my self-coding Discord bot that writes its own features. The project evolved from a monolithic application into a modular monorepo with dual-service deployment on Railway, plus comprehensive MongoDB and PostgreSQL integrations alongside the existing LibSQL database. Let's dive into the technical details.

## The Omega Refactoring Journey

### The Problem: Monolithic Architecture

Omega started as a single Discord bot application with all code in one directory. As it grew to 80+ self-built tools, several pain points emerged:

- **Tight coupling** - Web UI, Discord bot, and shared utilities were all intertwined
- **Deployment complexity** - Couldn't deploy web and bot services independently
- **Code organization** - Tools, agents, and infrastructure code mixed together
- **Scalability concerns** - Single deployment meant scaling the entire app or nothing

The solution: Transform Omega into a proper monorepo with clear separation of concerns.

### The Solution: Turborepo Monorepo Architecture

I refactored the entire codebase into a Turborepo-based monorepo with pnpm workspaces:

```
omega/
├── apps/
│   ├── bot/          # Discord bot (background worker)
│   └── web/          # Next.js web interface
├── packages/
│   ├── database/     # Shared database clients (LibSQL, MongoDB, PostgreSQL)
│   ├── shared/       # Common utilities and types
│   └── ui/           # Shared React components
├── turbo.json
└── pnpm-workspace.yaml
```

The monorepo structure enables:

- **Independent deployments** - Bot and web can deploy separately
- **Shared code** - Database clients and utilities in packages
- **Parallel builds** - Turborepo caches and parallelizes builds
- **Clear boundaries** - Each package has explicit dependencies

### Dual-Service Railway Deployment

The biggest challenge was deploying two services from one monorepo on Railway. Initially, both services were running the same Discord bot code because Railway was reading the same configuration file.

**The key insight:** Railway's `railway.toml` format allows multi-service definitions from a single repository:

```toml
# railway.toml
[build]
builder = "dockerfile"

[services.omega-bot]
dockerfile = "apps/bot/Dockerfile"
source = "apps/bot"

[services.omega-web]
dockerfile = "apps/web/Dockerfile"
source = "apps/web"

# Persistent volume for bot's SQLite database
[[mounts]]
source = "omega_data"
dest = "/data"
service = "omega-bot"

[volume.omega_data]
```

This configuration:

1. **Defines two services** - `omega-bot` and `omega-web` from one repo
2. **Uses separate Dockerfiles** - Each service builds independently
3. **Mounts persistent storage** - Bot's SQLite database persists across deployments
4. **Single source of truth** - All configuration in one file

#### Docker Multi-Stage Builds

Each service uses multi-stage Docker builds optimized for Turborepo:

```dockerfile
# apps/bot/Dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.0.0

# Install dependencies for entire monorepo
FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY packages/ ./packages/
COPY apps/bot/package.json ./apps/bot/
RUN pnpm install --frozen-lockfile

# Build the bot and its dependencies
FROM dependencies AS builder
WORKDIR /app
COPY apps/bot/ ./apps/bot/
RUN pnpm --filter bot build

# Production runtime
FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
CMD ["node", "apps/bot/dist/index.js"]
```

The multi-stage approach:

- **Stage 1 (base)**: Install pnpm globally
- **Stage 2 (dependencies)**: Install all monorepo dependencies
- **Stage 3 (builder)**: Build only the bot using Turborepo filtering
- **Stage 4 (runner)**: Copy just what's needed for production

This reduces the final image size significantly by excluding build tools and source TypeScript.

## Multi-Database Architecture

One fascinating aspect of Omega's evolution is its **three-database architecture**. Each database serves different use cases:

### 1. LibSQL/Turso (Primary SQLite)

The original database, still used for bot's core data:

```typescript
// packages/database/src/libsql/client.ts
import { createClient } from '@libsql/client';

export function getLibSQLClient() {
  const url = process.env.TURSO_DATABASE_URL || 'file:./data/omega.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  return createClient({
    url,
    authToken: authToken || undefined,
  });
}
```

**Use cases:**
- User preferences and settings
- Tool usage statistics
- Conversation history
- Lightweight transactional data

**Why LibSQL?**
- SQLite compatibility (easy local development)
- Turso provides edge replication globally
- Serverless-friendly (no connection pooling needed)
- Perfect for read-heavy workloads

### 2. MongoDB (Flexible Document Storage)

Added this week for unstructured and semi-structured data:

```typescript
// packages/database/src/mongodb/client.ts
import { MongoClient, Db } from 'mongodb';

let cachedDb: Db | null = null;
let cachedClient: MongoClient | null = null;

export async function getMongoDatabase(): Promise<Db> {
  if (cachedDb) return cachedDb;

  // Railway provides MONGO_URL automatically when MongoDB is added
  const uri = process.env.MONGO_URL ||
              process.env.MONGODB_URI ||
              'mongodb://localhost:27017';

  const dbName = process.env.MONGODB_DATABASE || 'omega_bot';

  console.log('🔌 Connecting to MongoDB...');

  const client = new MongoClient(uri);
  await client.connect();

  cachedClient = client;
  cachedDb = client.db(dbName);

  console.log('✅ MongoDB connected:', dbName);
  return cachedDb;
}
```

I built **14 specialized MongoDB tools** that Omega can use:

```typescript
// apps/bot/src/mongodb/tools/
export const mongoInsertTool = tool({
  description: 'Insert a document into a MongoDB collection',
  parameters: z.object({
    collection: z.string().describe('Collection name'),
    document: z.record(z.any()).describe('Document to insert'),
  }),
  execute: async ({ collection, document }) => {
    const db = await getMongoDatabase();
    const result = await db.collection(collection).insertOne(document);
    return { insertedId: result.insertedId };
  },
});

export const mongoFindTool = tool({
  description: 'Find documents in a MongoDB collection with optional filtering and projection',
  parameters: z.object({
    collection: z.string(),
    filter: z.record(z.any()).optional(),
    projection: z.record(z.any()).optional(),
    limit: z.number().optional(),
  }),
  execute: async ({ collection, filter = {}, projection, limit = 10 }) => {
    const db = await getMongoDatabase();
    const cursor = db.collection(collection).find(filter);

    if (projection) cursor.project(projection);

    const documents = await cursor.limit(limit).toArray();
    return { count: documents.length, documents };
  },
});

export const mongoAggregateTool = tool({
  description: 'Run aggregation pipeline for complex queries and analytics',
  parameters: z.object({
    collection: z.string(),
    pipeline: z.array(z.record(z.any())).describe('Aggregation pipeline stages'),
  }),
  execute: async ({ collection, pipeline }) => {
    const db = await getMongoDatabase();
    const results = await db.collection(collection).aggregate(pipeline).toArray();
    return { count: results.length, results };
  },
});
```

**Use cases:**
- User-generated content (blog posts, notes)
- Analytics and metrics (flexible schemas)
- Logs and events
- Psycho-history mode data (analyzing user behavior patterns)

**Why MongoDB?**
- Schema flexibility for evolving features
- Native support for nested documents
- Powerful aggregation framework
- Easy to add fields without migrations

### 3. PostgreSQL (Production-Grade Relational)

Added this week for structured, relational data:

```typescript
// packages/database/src/postgres/client.ts
import { Pool } from 'pg';

let pool: Pool | null = null;

export async function getPostgresPool(): Promise<Pool> {
  if (pool) return pool;

  // Railway provides POSTGRES_URL when PostgreSQL is added
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRESQL_URL;

  if (!connectionString) {
    throw new Error('No PostgreSQL connection string found');
  }

  console.log('🔌 Connecting to PostgreSQL...');

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  console.log('✅ PostgreSQL pool created');
  return pool;
}
```

I created **13 specialized PostgreSQL tools** for Omega:

```typescript
// apps/bot/src/postgres/tools/pgQuery.ts
export const pgQueryTool = tool({
  description: 'Execute a SQL query against PostgreSQL database',
  parameters: z.object({
    sql: z.string().describe('SQL query to execute (use $1, $2, etc. for parameters)'),
    params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional()
      .describe('Query parameters for $1, $2, etc.'),
  }),
  execute: async ({ sql, params = [] }) => {
    const pool = await getPostgresPool();
    const result = await pool.query(sql, params);

    return {
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({ name: f.name, type: f.dataTypeID })),
    };
  },
});

export const pgCreateTableTool = tool({
  description: 'Create a new PostgreSQL table with schema definition',
  parameters: z.object({
    tableName: z.string(),
    columns: z.array(z.object({
      name: z.string(),
      type: z.string(),
      constraints: z.string().optional(),
    })),
  }),
  execute: async ({ tableName, columns }) => {
    const columnDefs = columns.map(col =>
      `${col.name} ${col.type} ${col.constraints || ''}`
    ).join(', ');

    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs})`;

    const pool = await getPostgresPool();
    await pool.query(sql);

    return { success: true, message: `Table ${tableName} created` };
  },
});
```

**Use cases:**
- Production data requiring ACID guarantees
- Complex relational queries with JOINs
- Data integrity constraints
- Future migration from LibSQL

**Why PostgreSQL?**
- Industry-standard relational database
- Advanced features (JSON columns, full-text search, triggers)
- Excellent performance for complex queries
- Railway provides it as a managed service

### Database Selection Strategy

When Omega needs to store data, it now intelligently chooses the right database:

| Use Case | Database | Reason |
|----------|----------|--------|
| User settings, conversation history | LibSQL | Fast reads, simple structure |
| Blog posts, user content | MongoDB | Flexible schema, nested data |
| Analytics, metrics | MongoDB | Aggregation pipeline |
| Transactions, referential integrity | PostgreSQL | ACID guarantees |
| Complex reporting | PostgreSQL | Advanced SQL features |

This multi-database approach provides the best tool for each job while maintaining a clean architecture through the shared `packages/database` package.

## SQLite to PostgreSQL Migration System

One major piece of work was designing a **zero-downtime migration path** from LibSQL to PostgreSQL for future scaling. The migration system supports three modes:

```typescript
// packages/database/src/migrations/config.ts
export type MigrationMode = 'sqlite_primary' | 'dual_write' | 'postgres_primary';

export function getCurrentMode(): MigrationMode {
  const mode = process.env.MIGRATION_MODE || 'sqlite_primary';
  return mode as MigrationMode;
}
```

### Migration Phases

**Phase 1: SQLite Primary (Current)**
```
Reads:  SQLite ✓
Writes: SQLite ✓
```

All operations on SQLite, PostgreSQL schema created but unused.

**Phase 2: Dual Write**
```
Reads:  SQLite ✓
Writes: SQLite ✓ + PostgreSQL ✓
```

New data written to both databases, reads still from SQLite. This allows PostgreSQL to fill up with production data while SQLite remains source of truth.

**Phase 3: PostgreSQL Primary (Future)**
```
Reads:  PostgreSQL ✓
Writes: PostgreSQL ✓
```

Full migration complete, SQLite deprecated.

The migration system includes export and import scripts:

```typescript
// packages/database/src/migrations/exportFromSQLite.ts
export async function exportAllTables(): Promise<ExportedData> {
  const db = getLibSQLClient();
  const exported: ExportedData = {};

  // Get all table names
  const tables = await db.execute(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `);

  for (const table of tables.rows) {
    const tableName = table.name as string;
    const rows = await db.execute(`SELECT * FROM ${tableName}`);
    exported[tableName] = rows.rows;
  }

  return exported;
}
```

```typescript
// packages/database/src/migrations/importToPostgres.ts
export async function importAllTables(data: ExportedData): Promise<void> {
  const pool = await getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const [tableName, rows] of Object.entries(data)) {
      if (rows.length === 0) continue;

      // Build parameterized insert
      const columns = Object.keys(rows[0]);
      const placeholders = rows.map((_, idx) =>
        `(${columns.map((_, colIdx) => `$${idx * columns.length + colIdx + 1}`).join(', ')})`
      ).join(', ');

      const values = rows.flatMap(row => columns.map(col => row[col]));

      const sql = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT DO NOTHING
      `;

      await client.query(sql, values);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

This migration strategy allows gradual, safe transition to PostgreSQL with rollback capability at each phase.

## Tool Routing and Dynamic Loading

With 80+ tools, loading all tools for every request became expensive. I implemented dynamic tool routing this week:

```typescript
// apps/bot/src/agent/toolRouter.ts
import MiniSearch from 'minisearch';

interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  keywords: string[];
}

const searchIndex = new MiniSearch({
  fields: ['name', 'description', 'keywords', 'category'],
  storeFields: ['id', 'name', 'category'],
  searchOptions: {
    boost: { name: 2, keywords: 1.5 },
    fuzzy: 0.2,
  },
});

// Index all tools
import { TOOL_METADATA } from './toolRegistry/metadata';
searchIndex.addAll(TOOL_METADATA);

export function selectTools(userMessage: string, maxTools = 10): string[] {
  // Search for relevant tools based on user message
  const results = searchIndex.search(userMessage, {
    boost: { name: 2 },
    fuzzy: 0.2,
  });

  // Always include core tools
  const coreTools = ['read', 'write', 'bash', 'search'];

  // Add relevant tools from search results
  const selectedTools = [
    ...coreTools,
    ...results.slice(0, maxTools - coreTools.length).map(r => r.id),
  ];

  return selectedTools;
}
```

The tool router uses [MiniSearch](https://github.com/lucaong/minisearch)—a lightweight full-text search library—to match user messages with relevant tools. This reduces the context sent to the AI model by ~70%, saving significant costs.

**Example:**

```typescript
// User: "Can you search GitHub for TypeScript projects?"
const tools = selectTools("Can you search GitHub for TypeScript projects?");
// Returns: ['read', 'write', 'bash', 'search', 'github', 'searchGitHub']

// User: "Execute this Python code"
const tools = selectTools("Execute this Python code");
// Returns: ['read', 'write', 'bash', 'search', 'unsandbox', 'fileUpload']
```

Only the relevant tools are loaded and provided to the AI model, making responses faster and cheaper.

## lordajax.com: Grid Layout Upgrade

On my personal blog, I upgraded to [@jsonblog/generator-tailwind v4.3.0](https://www.npmjs.com/package/@jsonblog/generator-tailwind) which introduces a new `itemsSource` feature for grid layouts.

### Before: Inline Items in blog.json

Previously, the Videos page required all video data inline:

```json
{
  "pages": [
    {
      "title": "Videos",
      "layout": "grid",
      "items": [
        {
          "title": "Building AI Applications with Claude",
          "description": "Conference talk from...",
          "url": "https://youtube.com/...",
          "image": "https://i.ytimg.com/...",
          "date": "2024-10-15"
        },
        // ... 20 more videos
      ]
    }
  ]
}
```

This made `blog.json` bloated and hard to maintain.

### After: External JSON Source

Now with `itemsSource`, the data lives in a separate file:

```json
// blog.json
{
  "pages": [
    {
      "title": "Videos",
      "slug": "videos",
      "description": "Conference talks, tutorials, and tech content",
      "layout": "grid",
      "itemsSource": "videos.json"
    }
  ]
}
```

```json
// videos.json (generated by fetch-videos.js)
[
  {
    "title": "Building AI Applications with Claude",
    "description": "Conference talk from AI Summit 2024",
    "url": "https://youtube.com/watch?v=...",
    "image": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
    "date": "2024-10-15",
    "featured": true
  }
  // ... more videos
]
```

The `fetch-videos.js` script pulls from YouTube API and generates the JSON automatically:

```javascript
// apps/homepage/scripts/fetch-videos.js
async function fetchYouTubeVideos(channelId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?` +
    `key=${apiKey}&channelId=${channelId}&part=snippet&type=video&maxResults=50`
  );

  const data = await response.json();

  return data.items.map(item => ({
    title: item.snippet.title,
    description: item.snippet.description.slice(0, 200) + '...',
    url: `https://youtube.com/watch?v=${item.id.videoId}`,
    image: item.snippet.thumbnails.maxresdefault?.url || item.snippet.thumbnails.high.url,
    date: item.snippet.publishedAt.split('T')[0],
    featured: false,
  }));
}

const videos = await fetchYouTubeVideos('UC...');
fs.writeFileSync('videos.json', JSON.stringify(videos, null, 2));
```

**Benefits:**

- **Cleaner config** - blog.json stays focused on structure
- **Automated updates** - Videos refresh from YouTube automatically
- **Reusable data** - videos.json can be consumed by other tools
- **Better performance** - Generator can optimize loading

## Blocks: Simplification and Documentation Cleanup

In my [Blocks validation framework](https://github.com/thomasdavis/blocks), I made the decision to **remove visual validation** features and simplify the architecture.

### Why Remove Visual Validation?

Last week I built a comprehensive visual validation system with Playwright screenshots and GPT-4o vision analysis. However, after using it in production:

1. **Too slow** - Capturing screenshots added 5-10 seconds per validation
2. **Cost concerns** - GPT-4o vision analysis cost $0.15 per validation run
3. **Unclear value** - Most visual issues were caught by static analysis anyway
4. **Complexity** - Maintaining Playwright, Puppeteer, and AI integrations was overhead

The WCAG validation with axe-core was excellent, but it didn't require the full visual validation infrastructure. I could run axe-core programmatically without screenshots.

### Simplified Architecture

I removed:
- `@blocksai/visual-validators` package
- Playwright screenshot capture
- GPT-4o vision analysis
- `test_samples` field from schemas

Kept:
- Schema validation (Zod)
- Domain model validation
- Custom JavaScript validators
- AI semantic validation (text-only)

**New simplified validator config:**

```yaml
# blocks.yml
validators:
  - schema              # Built-in: Validates against Zod schema
  - shape.ts            # Built-in: Validates domain shape
  - domain              # Built-in: AI validates domain semantics
  - custom/accessibility.js  # Custom: axe-core validation (no screenshots)
  - custom/lint.js      # Custom: ESLint/Prettier checks
```

This gave me 80% of the value with 20% of the complexity.

### Documentation Updates

I cleaned up all references to visual validation from the documentation:

```diff
- ## Visual Validation
-
- Blocks includes visual validation with screenshot capture and AI vision analysis.
-
- ```yaml
- visual_validation:
-   viewports:
-     - name: mobile
-       width: 375
- ```

+ ## Accessibility Validation
+
+ Run axe-core directly on generated HTML without screenshot overhead:
+
+ ```javascript
+ // validators/accessibility.js
+ const { AxePuppeteer } = require('@axe-core/puppeteer');
+
+ module.exports = async function validateAccessibility({ html }) {
+   const browser = await puppeteer.launch();
+   const page = await browser.newPage();
+   await page.setContent(html);
+
+   const results = await new AxePuppeteer(page).analyze();
+   await browser.close();
+
+   return {
+     valid: results.violations.length === 0,
+     issues: results.violations,
+   };
+ };
+ ```
```

The updated docs are clearer and more focused on the core value proposition: **semantic validation for AI-generated code**.

## New Tools in Omega

Beyond the architectural work, Omega gained several new tools this week through user requests:

### 1. Psycho Analysis Mode

Inspired by Isaac Asimov's Foundation series, I added three tools for analyzing users and society:

**psychoAnalysis** - Deep user profiling based on conversation history:

```typescript
export const psychoAnalysisTool = tool({
  description: 'Perform in-depth psychological analysis of a user based on conversation history, detecting personality traits, communication patterns, and preferences',
  parameters: z.object({
    userId: z.string(),
    depth: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed'),
  }),
  execute: async ({ userId, depth }) => {
    // Fetch conversation history
    const db = await getMongoDatabase();
    const messages = await db.collection('messages')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(depth === 'basic' ? 50 : depth === 'detailed' ? 200 : 500)
      .toArray();

    // Analyze with GPT-4o
    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: 'You are a psychological profiling expert analyzing user behavior patterns.',
      prompt: `Analyze this user's conversation history and provide insights on:
        1. Personality traits (Big Five)
        2. Communication style
        3. Interests and expertise
        4. Emotional patterns
        5. Collaboration preferences

        Messages: ${JSON.stringify(messages)}`,
    });

    return text;
  },
});
```

**psychoHistory** - Macro-level societal analysis:

```typescript
export const psychoHistoryTool = tool({
  description: 'Foundation-inspired societal forecasting. Analyze historical patterns to predict future trends.',
  parameters: z.object({
    topic: z.string().describe('Societal topic to analyze'),
    timeframe: z.string().describe('Historical timeframe (e.g., "last 50 years")'),
  }),
  execute: async ({ topic, timeframe }) => {
    // This would integrate with historical databases, news APIs, etc.
    // For now, uses AI analysis
    const { text } = await generateText({
      model: openai('gpt-4o'),
      prompt: `Act as Hari Seldon from Foundation. Analyze ${topic} over ${timeframe} and predict future trajectories using psychohistorical principles.`,
    });

    return text;
  },
});
```

These tools allow Omega to provide deep insights about users and broader societal trends.

### 2. Enhanced listTools

The `listTools` command now provides an interactive browser:

```
/listTools

📦 Available Tools (87)

🔧 Core Tools
  • read - Read file contents
  • write - Write to files
  • bash - Execute shell commands
  • search - Search codebase

🌐 Web & APIs
  • fetch - HTTP requests
  • scrape - Web scraping
  • github - GitHub API
  • twitter - Twitter/X API

🗄️ Databases
  • libsql - SQLite/Turso operations
  • mongo* - 14 MongoDB tools
  • pg* - 13 PostgreSQL tools

🧠 AI & Analysis
  • generateText - Text generation
  • generateImage - Image creation
  • psychoAnalysis - User profiling
  • detectBias - Content bias detection

🌐 View interactive tool browser: https://omegaai.dev/tools
📡 JSON API: https://omegaai.dev/api/tools
```

The web interface at `omegaai.dev/tools` provides searchable, categorized tool documentation.

### 3. Split Long Messages

Discord has a 2000 character limit, but AI responses often exceed this. I added automatic message splitting:

```typescript
// apps/bot/src/utils/splitMessage.ts
export function splitMessage(text: string, maxLength = 2000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let currentChunk = '';

  // Split on paragraphs first
  const paragraphs = text.split('\n\n');

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= maxLength) {
      currentChunk += paragraph + '\n\n';
    } else {
      // Paragraph too long, push current chunk and start new one
      if (currentChunk) chunks.push(currentChunk.trim());

      // If single paragraph exceeds limit, split on sentences
      if (paragraph.length > maxLength) {
        const sentences = paragraph.split('. ');
        let sentenceChunk = '';

        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length + 2 <= maxLength) {
            sentenceChunk += sentence + '. ';
          } else {
            chunks.push(sentenceChunk.trim());
            sentenceChunk = sentence + '. ';
          }
        }

        currentChunk = sentenceChunk;
      } else {
        currentChunk = paragraph + '\n\n';
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks;
}

// Usage in Discord message handler
async function sendLongMessage(channel: TextChannel, content: string) {
  const chunks = splitMessage(content);

  for (let i = 0; i < chunks.length; i++) {
    const prefix = chunks.length > 1 ? `[${i + 1}/${chunks.length}] ` : '';
    await channel.send(prefix + chunks[i]);
  }
}
```

Now long AI responses automatically split across multiple Discord messages with chunk indicators.

## Deployment Lessons Learned

The Railway deployment refactor taught several valuable lessons:

### 1. Railway Configuration Evolution

**Old approach (didn't work for monorepos):**
```json
// railway.json
{
  "build": {
    "builder": "nixpacks",
    "buildCommand": "pnpm build"
  }
}
```

**New approach (works for monorepos):**
```toml
# railway.toml
[services.bot]
dockerfile = "apps/bot/Dockerfile"

[services.web]
dockerfile = "apps/web/Dockerfile"
```

Railway's `railway.toml` format is more powerful than `railway.json` for multi-service monorepos.

### 2. Environment Variable Naming

Railway auto-provides environment variables when you add databases, but the naming varies:

```typescript
// MongoDB - Railway provides MONGO_URL
const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;

// PostgreSQL - Railway provides POSTGRES_URL
const pgUri = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// LibSQL/Turso - You provide these
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
```

Always provide fallbacks to handle different hosting environments.

### 3. Persistent Volumes

For SQLite databases in Docker, you MUST use persistent volumes:

```toml
[[mounts]]
source = "omega_data"
dest = "/data"
service = "omega-bot"

[volume.omega_data]
```

Without this, SQLite database resets on every deployment. The volume persists across deployments and container restarts.

### 4. Health Checks

Background workers (like Discord bots) don't expose HTTP endpoints, but Railway expects health checks. Solution:

```typescript
// apps/bot/src/server/healthServer.ts
import express from 'express';

export function startHealthServer(port = 3001) {
  const app = express();

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.listen(port, () => {
    console.log(`Health server listening on :${port}`);
  });
}

// In main bot code
startHealthServer();
```

This allows Railway to verify the bot is running without interfering with Discord connectivity.

## Reflections

This week demonstrated several architectural principles:

### 1. Monorepos Enable Independent Evolution

By separating the bot and web into `apps/`, they can:
- Deploy independently
- Version independently
- Scale independently
- Share code via `packages/`

The monorepo provides structure without coupling.

### 2. Multi-Database Architecture is Pragmatic

Rather than forcing all data into one database type:
- LibSQL for simple, fast reads
- MongoDB for flexible schemas
- PostgreSQL for complex relations

Each database serves its strengths. The `packages/database` abstraction keeps the architecture clean.

### 3. Tool Routing Reduces Costs

Loading 80+ tools for every request was expensive. Dynamic tool selection based on semantic search:
- Reduced token usage by 70%
- Improved response times
- Maintained full capabilities

The router is invisible to users but significantly improves economics.

### 4. Simplicity Wins

Removing visual validation from Blocks was the right call:
- Faster validation
- Lower costs
- Less maintenance
- Clearer value proposition

Sometimes subtracting features improves the product.

## Links

### Projects
- **Omega Discord Bot**: [github.com/thomasdavis/omega](https://github.com/thomasdavis/omega)
- **This Blog**: [github.com/thomasdavis/lordajax.com](https://github.com/thomasdavis/lordajax.com)
- **Blocks Framework**: [github.com/thomasdavis/blocks](https://github.com/thomasdavis/blocks)

### NPM Packages
- [@jsonblog/generator-tailwind](https://www.npmjs.com/package/@jsonblog/generator-tailwind) - v4.3.0 with grid layout
- [@blocksai/cli](https://www.npmjs.com/package/@blocksai/cli) - Blocks CLI
- [@blocksai/ai](https://www.npmjs.com/package/@blocksai/ai) - AI validators

### Tools & Services
- [Railway](https://railway.app) - Monorepo deployment platform
- [Turso](https://turso.tech) - Distributed SQLite (LibSQL)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) - Managed MongoDB
- [Vercel AI SDK](https://sdk.vercel.ai) - AI application framework
- [MiniSearch](https://github.com/lucaong/minisearch) - Lightweight full-text search
- [Turborepo](https://turbo.build/repo) - Monorepo build system
- [pnpm](https://pnpm.io) - Fast, efficient package manager

### Documentation
- [Railway Monorepo Docs](https://docs.railway.app/deploy/monorepo)
- [Turborepo Handbook](https://turbo.build/repo/docs/handbook)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)

This post was generated by Claude Code based on structured GitHub activity data following explicit format requirements.
