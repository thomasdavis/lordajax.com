# Weekly Activity: Database Migration Engineering and GitHub Automation Refinements

This week focused on two main technical areas: engineering a production-ready SQLite-to-PostgreSQL migration system for the Omega self-coding Discord bot, and refining GitHub activity automation for this blog. Let's dive into the technical details.

## Omega: Production Database Migration

[Omega](https://github.com/thomasdavis/omega) is a Discord bot that writes its own code. It started with zero functionality and has evolved through conversations to build 80+ tools. This week, the major focus was migrating Omega's database from SQLite to PostgreSQL to support production deployment on Railway.

### The Migration Challenge

Omega was initially built with SQLite for simplicity during development. However, deploying to Railway requires PostgreSQL for:

- **Durability**: Persistent storage across container restarts
- **Scalability**: Better concurrent access handling
- **Production features**: Connection pooling, replication, backups

The challenge: migrate existing data (user preferences, conversation history, tool usage stats) without losing anything or causing downtime.

### Migration Architecture

I designed a three-phase migration system:

#### Phase 1: Schema Creation

First, create identical PostgreSQL tables matching the SQLite schema:

```typescript
// Migration Phase 1: Create PostgreSQL schema
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL,
    },
  },
});

async function createSchema() {
  // Prisma automatically creates tables from schema.prisma
  // This includes all indexes and constraints
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "discordId" TEXT NOT NULL UNIQUE,
      "username" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL
    );
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "Conversation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "channelId" TEXT NOT NULL,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastMessageAt" TIMESTAMP(3) NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    );
  `;

  // Additional tables: Message, ToolUsage, UserPreference, ArtifactVersion
  // All with proper indexes and foreign key constraints
}
```

The key insight: use Prisma's schema-first approach. Define the schema once in `schema.prisma`, and Prisma generates the SQL for both databases.

#### Phase 2: Data Export from SQLite

Export all data from SQLite in a transaction-safe way:

```typescript
// packages/database/src/migration/export.ts
import Database from 'better-sqlite3';
import { writeFile } from 'fs/promises';

export async function exportAllTables() {
  const db = new Database(process.env.SQLITE_DB_PATH || './omega.db');

  const tables = ['User', 'Conversation', 'Message', 'ToolUsage', 'UserPreference', 'ArtifactVersion'];
  const exportData: Record<string, any[]> = {};

  // Export in dependency order (parents before children)
  for (const table of tables) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();

    // Convert SQLite timestamps to ISO strings for PostgreSQL
    const converted = rows.map(row => {
      const converted: any = { ...row };

      // Handle timestamp fields
      if (converted.createdAt) {
        converted.createdAt = new Date(converted.createdAt).toISOString();
      }
      if (converted.updatedAt) {
        converted.updatedAt = new Date(converted.updatedAt).toISOString();
      }
      if (converted.lastMessageAt) {
        converted.lastMessageAt = new Date(converted.lastMessageAt).toISOString();
      }

      return converted;
    });

    exportData[table] = converted;
    console.log(`Exported ${converted.length} rows from ${table}`);
  }

  // Write to JSON file for inspection/backup
  await writeFile(
    './migration-data.json',
    JSON.stringify(exportData, null, 2)
  );

  db.close();
  return exportData;
}
```

**Why JSON intermediate format?**
- Inspect the data before importing
- Backup in case import fails
- Debug timestamp conversion issues
- Verify foreign key relationships

#### Phase 3: Import to PostgreSQL

Import the exported data with proper transaction handling:

```typescript
// packages/database/src/migration/import.ts
import { PrismaClient } from '@prisma/client';

export async function importAllTables(data: Record<string, any[]>) {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.POSTGRES_URL },
    },
  });

  try {
    // Import in transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Import in dependency order
      const tables = ['User', 'Conversation', 'Message', 'ToolUsage', 'UserPreference', 'ArtifactVersion'];

      for (const table of tables) {
        const rows = data[table] || [];

        if (rows.length === 0) {
          console.log(`No data to import for ${table}`);
          continue;
        }

        // Use createMany for bulk insert (much faster than individual inserts)
        switch (table) {
          case 'User':
            await tx.user.createMany({ data: rows, skipDuplicates: true });
            break;
          case 'Conversation':
            await tx.conversation.createMany({ data: rows, skipDuplicates: true });
            break;
          case 'Message':
            await tx.message.createMany({ data: rows, skipDuplicates: true });
            break;
          case 'ToolUsage':
            await tx.toolUsage.createMany({ data: rows, skipDuplicates: true });
            break;
          case 'UserPreference':
            await tx.userPreference.createMany({ data: rows, skipDuplicates: true });
            break;
          case 'ArtifactVersion':
            await tx.artifactVersion.createMany({ data: rows, skipDuplicates: true });
            break;
        }

        console.log(`Imported ${rows.length} rows into ${table}`);
      }
    });

    console.log('Migration completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}
```

**Key design decisions:**

1. **Transaction wrapping**: All imports happen in one transaction. If any table fails, everything rolls back.
2. **createMany with skipDuplicates**: Idempotent—can re-run safely if partially completed.
3. **Dependency order**: Import parent tables (User) before children (Conversation, Message).

### Migration API Endpoint

To execute the migration from Railway's environment, I created an API endpoint:

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
    // Phase 2: Export from SQLite
    console.log('Starting export from SQLite...');
    const data = await exportAllTables();

    // Phase 3: Import to PostgreSQL
    console.log('Starting import to PostgreSQL...');
    const result = await importAllTables(data);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Migration completed successfully',
        stats: {
          tablesExported: Object.keys(data).length,
          totalRows: Object.values(data).reduce((sum, rows) => sum + rows.length, 0),
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET endpoint to check migration status
export async function GET() {
  return NextResponse.json({
    message: 'Migration endpoint ready',
    usage: 'POST /api/migrate to execute migration',
  });
}
```

**Why an API endpoint instead of a CLI script?**

- **Environment parity**: Runs in the same Railway environment with correct env vars
- **No local setup**: Don't need to configure DATABASE_URL locally
- **Logging**: Railway captures all console output for debugging
- **Testable**: Can test with GET before executing POST

### Railway Deployment Strategy

The migration documentation outlines a safe deployment process:

```bash
# Step 1: Verify PostgreSQL connection
railway run --service web npx prisma db push

# Step 2: Execute migration via API
curl -X POST https://omega-web.railway.app/api/migrate

# Step 3: Verify data integrity
railway run --service web npx prisma studio

# Step 4: Update DATABASE_URL environment variable
railway variables set DATABASE_URL=$POSTGRES_URL

# Step 5: Restart services
railway up --service web
railway up --service bot
```

The key safety measure: keep SQLite as the primary database until verifying PostgreSQL has all data correctly imported. Only then switch `DATABASE_URL`.

### Lessons Learned

**1. Type-safe migrations with Prisma**

Using Prisma's type-safe client prevented runtime errors. TypeScript caught mismatched field names and missing foreign keys at compile time.

**2. Idempotent operations**

The `skipDuplicates` flag makes the migration re-runnable. If it fails halfway, just run it again.

**3. Transaction atomicity**

Wrapping all imports in a single transaction ensures consistency. Either all data migrates or none of it does—no partial states.

**4. Timestamp conversion challenges**

SQLite stores timestamps as integers or strings. PostgreSQL expects ISO 8601 strings. Explicit conversion prevented silent data corruption.

**5. Module type configuration**

Had to add `"type": "module"` to the root `package.json` to support ES module imports in Railway's shell execution context:

```json
{
  "type": "module",
  "scripts": {
    "migrate": "node run-migration.js"
  }
}
```

This allowed running migration scripts with `import` statements directly.

## GitHub Activity Automation Improvements

The weekly activity blog posts are automated using GitHub Actions. This week I significantly simplified and improved the reliability of the activity fetching script.

### The Original Approach: Event-Based Fetching

The original script tried to capture activity by fetching multiple GitHub API endpoints:

```javascript
// OLD APPROACH - Complex and unreliable
async function fetchGitHubActivity(username, sinceDate) {
  const activities = [];

  // Fetch user events (only shows public events)
  const userEvents = await octokit.paginate(octokit.activity.listPublicEventsForUser, {
    username,
    per_page: 100,
  });

  // Fetch organization events for each org
  const orgs = await octokit.orgs.listForUser({ username });
  for (const org of orgs) {
    const orgEvents = await octokit.activity.listOrgEventsForAuthenticatedUser({
      username,
      org: org.login,
    });
    activities.push(...orgEvents);
  }

  // Fetch starred repositories
  const starred = await octokit.activity.listReposStarredByUser({ username });

  // Process all events...
}
```

**Problems with this approach:**

1. **Incomplete coverage**: Organization events API doesn't return all commits
2. **Complex logic**: Merging multiple event types, deduplicating, filtering
3. **Rate limiting**: Multiple API endpoints = more requests
4. **Private repos leaked**: Had to manually filter out private repos after fetching

### The New Approach: GitHub Search API

I refactored to use **only** the GitHub Search API:

```javascript
// apps/homepage/scripts/create-activity-issue.js
async function fetchGitHubActivity(username, sinceDate) {
  const activities = [];
  const repoDetails = new Map();

  // Single API call to find ALL commits
  const searchQuery = `author:${username} committer-date:>=${sinceDate}`;

  const commits = await octokit.paginate(octokit.search.issuesAndPullRequests, {
    q: searchQuery,
    sort: 'committer-date',
    order: 'desc',
    per_page: 100,
  });

  console.log(`Found ${commits.length} commits via search API`);

  // Group commits by repository
  for (const commit of commits) {
    const repoFullName = commit.repository_url.split('/').slice(-2).join('/');
    const [owner, repo] = repoFullName.split('/');

    if (!repoDetails.has(repoFullName)) {
      // Fetch repository details (includes privacy flag)
      const details = await fetchRepositoryDetails(owner, repo);

      // Skip private repositories
      if (!details) continue;

      repoDetails.set(repoFullName, details);
    }

    // Store commit info grouped by repo
    if (!activities[repoFullName]) {
      activities[repoFullName] = {
        commits: [],
        details: repoDetails.get(repoFullName),
      };
    }

    activities[repoFullName].commits.push({
      message: commit.commit.message,
      sha: commit.sha,
      date: commit.commit.committer.date,
    });
  }

  return activities;
}
```

**Why this is better:**

1. **Complete coverage**: Finds commits across personal repos AND organization repos
2. **Single query**: One API call instead of many
3. **Built-in filtering**: Search API only returns accessible commits
4. **Simpler code**: No event merging, no deduplication logic

### Filtering Private Repositories

The repository details fetcher explicitly checks privacy status:

```javascript
async function fetchRepositoryDetails(owner, repo) {
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });

    // Skip private repositories to avoid leaking sensitive info
    if (repoData.private) {
      console.log(`Skipping private repository: ${owner}/${repo}`);
      return null;
    }

    // Fetch package.json to determine package name
    let packageName = repo;
    try {
      const { data: packageJson } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json',
      });

      const content = Buffer.from(packageJson.content, 'base64').toString();
      const parsed = JSON.parse(content);
      packageName = parsed.name || repo;
    } catch (e) {
      // No package.json, use repo name
    }

    // Fetch README excerpt for context
    const readme = await fetchReadmeExcerpt(owner, repo);

    return {
      url: repoData.html_url,
      description: repoData.description,
      language: repoData.language,
      stars: repoData.stargazers_count,
      readme,
      packageName,
    };
  } catch (error) {
    console.error(`Error fetching details for ${owner}/${repo}:`, error.message);
    return null;
  }
}
```

Returning `null` for private repos ensures they never appear in the activity summary.

### The Complete Workflow

The GitHub Action that generates these posts:

```yaml
# .github/workflows/weekly-activity.yml
name: Weekly Activity

on:
  schedule:
    # Run every Sunday at 11:00 PM UTC
    - cron: '0 23 * * 0'
  workflow_dispatch:

jobs:
  create-activity-issue:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Create activity issue
        run: node apps/homepage/scripts/create-activity-issue.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

When triggered:
1. Fetches commits from the past week using Search API
2. Groups commits by repository
3. Fetches repository details (description, README, stars, language)
4. Generates structured issue body with all activity
5. Creates GitHub issue with `@claude` mention
6. Claude Code (via GitHub App) processes the issue and creates the blog post

### Benefits of This Automation

**Consistency**: Blog posts follow the same format every week

**Completeness**: Captures all commits across all accessible repos

**Context**: Includes repo descriptions, code diffs, commit messages

**Zero manual work**: Fully automated from commit to published blog post

## Technical Insights

### Search API vs Events API

GitHub's Search API is often overlooked but extremely powerful:

```javascript
// Events API - Multiple endpoints, incomplete coverage
const userEvents = await octokit.activity.listPublicEventsForUser({ username });
const orgEvents = await octokit.activity.listOrgEvents({ org });
// Miss commits to org repos if you're not watching them

// Search API - Single query, complete coverage
const commits = await octokit.search.commits({
  q: 'author:username committer-date:>=2025-11-24'
});
// Finds ALL commits where you're the author
```

The Search API can query across:
- Personal repositories
- Organization repositories
- Forked repositories
- Any public repository where you've committed

### Database Migration Patterns

The three-phase migration (schema → export → import) is a proven pattern:

**Phase separation** allows:
- Testing each phase independently
- Rolling back if issues discovered
- Running phases at different times (schema creation in dev, data migration in production)

**Transaction wrapping** ensures:
- Atomic operations (all-or-nothing)
- Consistency (no partial states)
- Isolation (concurrent requests don't interfere)

**Idempotent operations** enable:
- Re-running failed migrations safely
- Testing migrations multiple times
- Gradual rollout (can run on subset of data first)

## Links

### Projects
- **Omega Discord Bot**: [github.com/thomasdavis/omega](https://github.com/thomasdavis/omega)
- **This Blog**: [github.com/thomasdavis/lordajax.com](https://github.com/thomasdavis/lordajax.com)

### Tools & Technologies
- **Prisma ORM**: [prisma.io](https://prisma.io) - Type-safe database toolkit
- **Railway**: [railway.app](https://railway.app) - Infrastructure platform
- **GitHub Search API**: [docs.github.com/en/rest/search](https://docs.github.com/en/rest/search) - Advanced code and commit search
- **Claude Code**: [claude.ai/code](https://claude.ai/code) - AI pair programming

### Documentation
- **Prisma Migrations**: [prisma.io/docs/concepts/components/prisma-migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- **GitHub Actions**: [docs.github.com/en/actions](https://docs.github.com/en/actions)

---

*This post was generated by Claude Code based on structured GitHub activity data following explicit format requirements.*
