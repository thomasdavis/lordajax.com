# Weekly Activity: GitHub Automation, Database Migrations, and Tooling Improvements

This week was all about infrastructure improvements across multiple projects: fixing critical bugs in GitHub activity tracking, building database migration tooling for Omega, refining the TPMJS specification, improving demo hosting for JsonBlog, and polishing documentation for Blocks. Let's dive into the technical details.

## Fixing GitHub Activity Detection

The weekly activity script that generates these blog posts had a critical bug—it was only fetching the first 100 commits instead of all activity. This week I completely overhauled the system to be more reliable and comprehensive.

### The Problem

The original script used multiple approaches to fetch GitHub activity:
- User events API (limited to 300 events)
- Organization events API (limited to 100 events)
- Starred repository tracking
- Complex aggregation logic across all sources

This created several issues:
1. **Pagination was broken** - Only fetched first page of results (100 items max)
2. **Missed organization commits** - Events API doesn't always include org repo commits
3. **Overly complex** - Multiple data sources with different formats to aggregate

### The Solution: GitHub Search API

I simplified everything down to a single, reliable API: GitHub's code search.

```javascript
// apps/homepage/scripts/create-activity-issue.js

// Use ONLY GitHub Search API to find all commits
const searchQuery = `author:${username} committer-date:>=${sinceDate}`;
const searchResults = await octokit.search.commits({
  q: searchQuery,
  sort: 'committer-date',
  order: 'desc',
  per_page: 100,
});

// Pagination to fetch ALL results
let allCommits = [...searchResults.data.items];
let page = 2;

while (searchResults.data.items.length === 100 && page <= 10) {
  const nextPage = await octokit.search.commits({
    q: searchQuery,
    sort: 'committer-date',
    order: 'desc',
    per_page: 100,
    page,
  });

  if (nextPage.data.items.length === 0) break;
  allCommits = allCommits.concat(nextPage.data.items);
  page++;
}
```

The Search API has key advantages:
- **Finds commits across ALL repositories** (personal AND organization)
- **Supports pagination** - can fetch up to 1000 results (10 pages × 100 items)
- **Single data source** - simpler code, more reliable
- **Date filtering** - built into the query syntax

### Private Repository Filtering

The script was accidentally including private repositories in blog posts, which could leak sensitive information. I added filtering during repository detail fetching:

```javascript
async function fetchRepositoryDetails(owner, repo) {
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });

    // Skip private repositories
    if (repoData.private) {
      console.log(`Skipping private repository: ${owner}/${repo}`);
      return null;
    }

    // Continue fetching package.json, README, etc.
    // ...
  } catch (error) {
    console.error(`Error fetching details for ${owner}/${repo}:`, error.message);
    return null;
  }
}
```

Now only public repositories appear in weekly activity summaries.

### Improved Logging

To debug repository filtering issues, I added comprehensive logging:

```javascript
console.log(`Total commits found: ${allCommits.length}`);
console.log('Repositories with commits:');

const repoCommitCounts = {};
allCommits.forEach(commit => {
  const repoFullName = commit.repository.full_name;
  repoCommitCounts[repoFullName] = (repoCommitCounts[repoFullName] || 0) + 1;
});

Object.entries(repoCommitCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([repo, count]) => {
    console.log(`  ${repo}: ${count} commits`);
  });
```

This makes it easy to verify all repositories are being detected and understand which repos had the most activity.

**Repository**: [thomasdavis/lordajax.com](https://github.com/thomasdavis/lordajax.com)
**Package**: jsonresume.org

## Omega: Building SQLite to PostgreSQL Migration Infrastructure

[Omega](https://github.com/thomasdavis/omega) is my self-coding Discord bot—an AI agent with full access to edit its own codebase. This week I built comprehensive migration tooling to move from SQLite (file-based, local development) to PostgreSQL (production-ready, Railway hosting).

### Why Migrate?

SQLite works great for local development, but has limitations for production:
- **No concurrent writes** - locks the entire database
- **File-based** - doesn't work well with container deployments
- **Limited scalability** - not designed for high-traffic applications

PostgreSQL solves all these problems and is the standard for production web apps.

### Migration Architecture

The migration is split into three phases:

**Phase 1: Schema Creation** (completed)
- Create PostgreSQL tables matching SQLite schema
- Add indexes for query performance
- Preserve all constraints and relationships

**Phase 2: Data Export** (automated)
- Export all data from SQLite tables to JSON
- Preserve relationships and data integrity
- Handle NULL values and data type conversions

**Phase 3: Data Import** (automated)
- Import JSON data into PostgreSQL
- Verify data integrity
- Update sequences for auto-increment fields

### Implementation

I created a migration API endpoint that executes phases 2-3:

```typescript
// apps/web/app/api/migrate/route.ts
import { NextResponse } from 'next/server';
import { exportAllTables, importAllTables } from '@repo/database';

/**
 * Migration API Endpoint
 * Executes SQLite to PostgreSQL data migration (Phases 2-3)
 *
 * Usage: POST /api/migrate
 */
export async function POST() {
  try {
    console.log('Starting migration...');

    // Phase 2: Export from SQLite
    console.log('Phase 2: Exporting SQLite data...');
    const exportedData = await exportAllTables();

    // Phase 3: Import to PostgreSQL
    console.log('Phase 3: Importing to PostgreSQL...');
    await importAllTables(exportedData);

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      exportedData,
      nextSteps: [
        'Verify data in PostgreSQL',
        'Update DATABASE_URL to use PostgreSQL',
        'Test all database operations',
        'Remove SQLite database file',
      ],
    });
  } catch (error) {
    console.error('Migration failed:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      recommendation: 'Check logs for details. Database remains unchanged.',
    }, { status: 500 });
  }
}

// Status endpoint for checking migration progress
export async function GET() {
  return NextResponse.json({
    phase1: 'Complete ✅',
    phase2: 'Ready (run POST /api/migrate)',
    phase3: 'Ready (run POST /api/migrate)',
  });
}
```

### Migration Execution

The migration can be executed via API or Railway shell:

```bash
# Via API
curl -X POST https://omega-web.railway.app/api/migrate

# Via Railway shell
railway shell
node run-migration.js
```

The `run-migration.js` script:

```javascript
import { exportAllTables, importAllTables } from '@repo/database';

async function migrate() {
  console.log('Starting migration...');

  // Export from SQLite
  const data = await exportAllTables();
  console.log('Exported data:', data);

  // Import to PostgreSQL
  await importAllTables(data);
  console.log('Import complete!');
}

migrate().catch(console.error);
```

### Migration Guide

I created comprehensive documentation in the migration guide:

```markdown
# SQLite to PostgreSQL Migration

## Quick Start

Phase 1 is complete ✅ (schema created with indexes)

To complete Phases 2-3:

1. Via Railway shell (recommended):
   ```bash
   railway shell
   node run-migration.js
   ```

2. Via API endpoint:
   ```bash
   curl -X POST https://omega-web.railway.app/api/migrate
   ```

## What Each Phase Does

### Phase 1: Schema Creation ✅
- Created 6 PostgreSQL tables matching SQLite schema
- Added indexes for performance
- Tables: tools, tool_usage, conversations, artifacts, blog_posts, kv_storage

### Phase 2: Data Export
- Exports all data from SQLite to JSON
- Preserves relationships and data integrity

### Phase 3: Data Import
- Imports JSON data to PostgreSQL
- Updates sequences for auto-increment fields
- Verifies data integrity
```

**Repository**: [thomasdavis/omega](https://github.com/thomasdavis/omega)
**Package**: discord-ai-bot

## TPMJS: Refining the Tool Package Specification

[TPMJS](https://github.com/tpmjs/tpmjs) is a Tool Package Manager for AI agents—think npm, but for AI tools. This week I made several significant improvements to the specification to make it simpler and more intuitive.

### Replacing `authentication` with `envVars`

The original spec had an `authentication` field that tried to categorize auth types:

```json
{
  "authentication": {
    "type": "api_key",
    "required": true
  }
}
```

This was too restrictive. Different tools need different environment variables beyond just auth (API endpoints, config values, feature flags). I replaced it with a general `envVars` array:

```json
{
  "env": [
    {
      "name": "OPENAI_API_KEY",
      "description": "API key for OpenAI services",
      "required": true
    },
    {
      "name": "OPENAI_BASE_URL",
      "description": "Custom API endpoint (optional)",
      "required": false,
      "default": "https://api.openai.com/v1"
    }
  ]
}
```

This is more flexible and clearer—it explicitly lists ALL environment variables a tool needs.

### Renaming `envVars` to `env`

For consistency with standard conventions, I renamed the field from `envVars` to simply `env`:

```typescript
// packages/schema/src/tpmjs-schema.ts

export const TpmjsEnvSchema = z.object({
  name: z.string().describe('Environment variable name (e.g., OPENAI_API_KEY)'),
  description: z.string().describe('Human-readable description of what this env var is for'),
  required: z.boolean().describe('Whether this env var is required for the tool to function'),
  default: z.string().optional().describe('Default value if not provided'),
});

export const TpmjsRichSchema = z.object({
  // ... other fields
  env: z.array(TpmjsEnvSchema).optional().describe('Environment variables required by this tool'),
});
```

Shorter, cleaner, more standard.

### Removing Redundant Fields

The spec had several fields that duplicated information already in `package.json`:

- `links` → Use `package.json` `repository` and `homepage` fields
- `tags` → Use `package.json` `keywords` field
- `status` → Not needed in tool metadata

I removed all these fields:

```typescript
// Before
export const TpmjsRichSchema = z.object({
  category: z.string(),
  description: z.string(),
  links: TpmjsLinksSchema.optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['stable', 'beta', 'experimental']).optional(),
  env: z.array(TpmjsEnvSchema).optional(),
});

// After
export const TpmjsRichSchema = z.object({
  category: z.string(),
  description: z.string(),
  env: z.array(TpmjsEnvSchema).optional(),
});
```

Now the TPMJS fields only contain information that's NOT already in `package.json`. This follows the principle of single source of truth.

### Removing `example` from Minimal Tier

The minimal tier required an `example` field showing tool usage. This was redundant with standard package documentation (README, docs site). I removed it:

```typescript
// Before
export const TpmjsMinimalSchema = z.object({
  category: z.string(),
  description: z.string(),
  example: z.string(),
});

// After
export const TpmjsMinimalSchema = z.object({
  category: z.string(),
  description: z.string(),
});
```

Now the minimal tier is truly minimal—just category and description.

### Updated Documentation

All documentation was updated to reflect these changes:

- [Specification page](https://tpmjs.dev/spec) - Full field reference
- [Publishing guide](https://tpmjs.dev/publish) - Examples of each tier
- [HOW_TO_PUBLISH_A_TOOL.md](https://github.com/tpmjs/tpmjs/blob/main/HOW_TO_PUBLISH_A_TOOL.md) - Step-by-step guide

Example minimal tool package.json:

```json
{
  "name": "@tpmjs/example-tool",
  "version": "1.0.0",
  "description": "Example tool for demonstration",
  "tpmjs": {
    "category": "text-generation",
    "description": "Generates text using AI models"
  }
}
```

Example rich tool package.json:

```json
{
  "name": "@tpmjs/openai-tool",
  "version": "2.1.0",
  "tpmjs": {
    "category": "text-generation",
    "description": "Generate text using OpenAI GPT models",
    "env": [
      {
        "name": "OPENAI_API_KEY",
        "description": "Your OpenAI API key",
        "required": true
      }
    ],
    "examples": [
      {
        "name": "basic-completion",
        "description": "Simple text completion",
        "code": "await openai.complete({ prompt: 'Hello' })"
      }
    ],
    "frameworks": ["vercel-ai", "langchain"]
  }
}
```

**Repository**: [tpmjs/tpmjs](https://github.com/tpmjs/tpmjs)
**Package**: @tpmjs/monorepo

## JsonBlog: Dedicated Subdomains for Demo Hosting

[JsonBlog](https://github.com/jsonblog/jsonblog) is a tool for generating static blogs from JSON configuration. The project has a marketplace of different generators (themes/templates). This week I significantly improved how demos are hosted.

### The Problem

Previously, demos were hosted under a single domain with path-based routing:

- `demos.jsonblog.dev/boilerplate/` - Boilerplate generator demo
- `demos.jsonblog.dev/tailwind/` - Tailwind generator demo

This caused asset loading issues. Generators expect to be hosted at the root (`/`), so they reference assets like:

```html
<link rel="stylesheet" href="/main.css">
<script src="/bundle.js"></script>
```

With path-based routing, these assets 404 because they're looking for `/main.css` instead of `/boilerplate/main.css`.

### The Solution: Dedicated Subdomains

I created separate Vercel projects for each generator, each on its own subdomain:

- **boilerplate.demos.jsonblog.dev** → Boilerplate generator project
- **tailwind.demos.jsonblog.dev** → Tailwind generator project

Each generator is now served at the root of its own subdomain, so all assets load correctly.

### Implementation

1. **Create Vercel projects** for each generator
2. **Add DNS records** for each subdomain:

```
# DNS Configuration
boilerplate.demos.jsonblog.dev → CNAME → cname.vercel-dns.com
tailwind.demos.jsonblog.dev → CNAME → cname.vercel-dns.com
```

3. **Update generator registry** with new URLs:

```typescript
// apps/homepage/src/lib/generators.ts
export const GENERATORS = [
  {
    name: '@jsonblog/generator-boilerplate',
    slug: 'boilerplate',
    demoUrl: 'https://boilerplate.demos.jsonblog.dev',
    // ... other fields
  },
  {
    name: '@jsonblog/generator-tailwind',
    slug: 'tailwind',
    demoUrl: 'https://tailwind.demos.jsonblog.dev',
    // ... other fields
  },
];
```

4. **Configure each Vercel project** to serve static files with clean URLs:

```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

Now each generator demo works perfectly, with all assets loading correctly.

### Marketplace Header

I also added a consistent header to marketplace pages for better navigation:

```typescript
// apps/homepage/src/app/marketplace/[slug]/page.tsx
import { Header } from '@/components/Header';

export default async function GeneratorPage({ params }) {
  const generator = await getGeneratorBySlug(params.slug);

  return (
    <>
      <Header />
      <main>
        {/* Generator details */}
      </main>
    </>
  );
}
```

```typescript
// apps/homepage/src/app/marketplace/page.tsx
import { Header } from '@/components/Header';

export default async function MarketplacePage() {
  return (
    <>
      <Header />
      <main>
        {/* Marketplace grid */}
      </main>
    </>
  );
}
```

This provides consistent navigation across the entire marketplace.

**Repository**: [jsonblog/jsonblog](https://github.com/jsonblog/jsonblog)
**Package**: jsonblog

## Blocks: Documentation and UI Polish

[Blocks](https://github.com/thomasdavis/blocks) is a semantic validation framework for AI development. This week I made several documentation improvements and UX enhancements.

### AI Slogan Rotation with Persistence

The Blocks homepage has an AI-generated slogan that changes periodically. I improved this to:
1. Limit to maximum 3 slogans
2. Persist slogans to localStorage
3. Rotate through existing slogans before generating new ones

```typescript
// apps/docs/app/ai-slogan.tsx
const STORAGE_KEY = 'blocks-ai-slogans';
const MAX_SLOGANS = 3;

export function AISlogan() {
  const [slogans, setSlogans] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setSlogans(parsed.slogans || []);
      setCurrentIndex(parsed.currentIndex || 0);
    }
  }, []);

  const generateOrRotate = async () => {
    if (slogans.length < MAX_SLOGANS) {
      // Generate new slogan
      const newSlogan = await generateSlogan();
      const updated = [...slogans, newSlogan];
      setSlogans(updated);
      setCurrentIndex(updated.length - 1);

      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        slogans: updated,
        currentIndex: updated.length - 1,
      }));
    } else {
      // Rotate to next slogan
      const nextIndex = (currentIndex + 1) % slogans.length;
      setCurrentIndex(nextIndex);

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        slogans,
        currentIndex: nextIndex,
      }));
    }
  };

  // ... typing animation logic
}
```

This creates a better user experience—slogans persist across page loads, and you get variety without constantly hitting the AI API.

### Updated Validator Configuration Docs

The Blocks documentation still referenced the old nested validator structure. I updated it to show the new simplified array format:

```typescript
// OLD (nested structure)
const config = {
  validators: {
    schema: {},
    shape: {},
    custom: {
      myValidator: { run: async () => {} }
    }
  }
};

// NEW (flat array)
const config = {
  validators: [
    'schema',          // Built-in validator (string)
    'shape.ts',        // File-based validator (string)
    'domain',          // Another built-in (string)
    {                  // Custom validator (object)
      name: 'myValidator',
      run: async (context) => {
        // validation logic
      }
    }
  ]
};
```

Updated examples throughout the docs:

```typescript
// apps/docs/content/docs/examples/json-resume-themes.mdx

// Validator configuration
validators: [
  'schema',      // Validate against JSON Resume schema
  'shape.ts',    // Check TypeScript types
  {
    name: 'semantic-html',
    run: async ({ output }) => {
      // Custom validation logic
    }
  }
]
```

### Removed Visual Validation References

The visual validation feature was removed from Blocks in a previous release (moved to separate package). I cleaned up all remaining references:

- Removed `test_samples` field documentation
- Updated `test_data` to reflect new union type (`string | any`)
- Removed visual validation examples from JSON Resume themes doc
- Cleaned up configuration docs to remove visual validator sections

```markdown
# Before
## Visual Validators

Visual validators use AI to analyze screenshots...

## Test Samples

The `test_samples` field provides multiple test cases...

# After
## Test Data

The `test_data` field provides test input (inline or file path):

```yaml
test_data: "./test-resume.json"  # File path
```

or

```yaml
test_data:                       # Inline object
  basics:
    name: "Test User"
```
```

Now the docs accurately reflect the current feature set.

**Repository**: [thomasdavis/blocks](https://github.com/thomasdavis/blocks)
**Package**: blocks

## Reflections

This week's work reinforced several important principles:

### Simplicity Over Complexity

The GitHub activity script refactor is a perfect example. The original approach used multiple APIs and complex aggregation logic. The new version uses a single API (Search) and is both simpler AND more capable.

**Lesson**: Before adding complexity, look for simpler solutions that do more.

### Single Source of Truth

The TPMJS spec cleanup removed fields that duplicated `package.json` data. This follows the principle that every piece of knowledge should have one authoritative representation.

**Lesson**: Don't repeat yourself across configuration files. Pick one source of truth and reference it.

### Infrastructure Enables Features

The Omega migration work isn't adding features—it's building infrastructure that enables future scalability. Sometimes the most important work is invisible to users.

**Lesson**: Invest in infrastructure before you need it, not when you're already struggling.

### Documentation Drift

The Blocks documentation still referenced removed features and old APIs. Documentation requires active maintenance, not just one-time writing.

**Lesson**: When you change APIs, update documentation immediately. Future you will thank present you.

## Links

### Projects
- **This Blog**: [github.com/thomasdavis/lordajax.com](https://github.com/thomasdavis/lordajax.com)
- **Omega Discord Bot**: [github.com/thomasdavis/omega](https://github.com/thomasdavis/omega)
- **TPMJS**: [github.com/tpmjs/tpmjs](https://github.com/tpmjs/tpmjs) | [tpmjs.dev](https://tpmjs.dev)
- **JsonBlog**: [github.com/jsonblog/jsonblog](https://github.com/jsonblog/jsonblog) | [jsonblog.dev](https://jsonblog.dev)
- **Blocks Framework**: [github.com/thomasdavis/blocks](https://github.com/thomasdavis/blocks) | [blocks.thomasdavis.dev](https://blocks.thomasdavis.dev)

### Demos
- [Boilerplate Generator](https://boilerplate.demos.jsonblog.dev)
- [Tailwind Generator](https://tailwind.demos.jsonblog.dev)

### Tools & Services
- [GitHub Search API](https://docs.github.com/en/rest/search) - Code and commit search
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API client
- [Railway](https://railway.app) - Application deployment platform
- [Vercel](https://vercel.com) - Static site hosting
- [Prisma](https://www.prisma.io) - Database ORM
- [Zod](https://zod.dev) - TypeScript schema validation

This post was generated by Claude Code based on structured GitHub activity data and written following explicit format requirements.
