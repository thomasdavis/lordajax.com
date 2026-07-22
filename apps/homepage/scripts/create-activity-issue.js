const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ============================================================================
// Configuration (env vars with defaults)
// ============================================================================
const CONFIG = {
  // 7 to match the weekly Sunday cron. A 14-day window under a weekly cadence
  // re-narrated every commit across consecutive posts — the corpus's biggest tell.
  DAYS: parseInt(process.env.DAYS, 10) || 7,
  MAX_COMMITS: parseInt(process.env.MAX_COMMITS, 10) || 1000,
  MAX_ENRICHED_COMMITS: parseInt(process.env.MAX_ENRICHED_COMMITS, 10) || 120,
  MAX_COMMITS_PER_REPO: parseInt(process.env.MAX_COMMITS_PER_REPO, 10) || 30,
  CONCURRENCY_LIMIT: 5,
  CACHE_DIR: path.join(__dirname, '../.cache/activity-issue'),
};

// Initialize Octokit
const octokit = new Octokit({
  auth: process.env.GH_ACCESS_TOKEN || process.env.GITHUB_TOKEN,
});

// ============================================================================
// Cache helpers
// ============================================================================
function ensureCacheDir() {
  if (!fs.existsSync(CONFIG.CACHE_DIR)) {
    fs.mkdirSync(CONFIG.CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(owner, repo, sha) {
  return `${owner}-${repo}-${sha}.json`;
}

function getFromCache(owner, repo, sha) {
  const cacheFile = path.join(CONFIG.CACHE_DIR, getCacheKey(owner, repo, sha));
  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveToCache(owner, repo, sha, data) {
  ensureCacheDir();
  const cacheFile = path.join(CONFIG.CACHE_DIR, getCacheKey(owner, repo, sha));
  fs.writeFileSync(cacheFile, JSON.stringify(data));
}

// ============================================================================
// Date helpers
// ============================================================================
function getDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - CONFIG.DAYS);

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    startFormatted: startDate.toISOString().split('T')[0],
    endFormatted: endDate.toISOString().split('T')[0],
  };
}

// ============================================================================
// Noise detection heuristics
// ============================================================================
const DEPENDENCY_PATTERNS = [
  /^bump/i, /^chore.*dep/i, /^update.*dep/i, /dependabot/i,
  /^npm/i, /^yarn/i, /^pnpm/i, /renovate/i, /greenkeeper/i,
];

const FORMAT_PATTERNS = [
  /^format/i, /^lint/i, /^prettier/i, /^style:/i, /^chore.*lint/i,
  /^fix.*lint/i, /eslint/i, /^chore.*format/i,
];

const DEPENDENCY_FILES = [
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Gemfile.lock',
  'Cargo.lock', 'poetry.lock', 'composer.lock', 'go.sum',
];

const CONFIG_ONLY_FILES = [
  '.eslintrc', '.prettierrc', '.editorconfig', 'tsconfig.json',
  '.gitignore', '.nvmrc', '.node-version',
];

function isDependencyCommit(commit, files = []) {
  const title = commit.commit?.message?.split('\n')[0] || '';
  if (DEPENDENCY_PATTERNS.some(p => p.test(title))) return true;

  if (files.length > 0) {
    const allDeps = files.every(f =>
      DEPENDENCY_FILES.some(dep => f.filename?.endsWith(dep)) ||
      f.filename?.includes('package.json')
    );
    if (allDeps) return true;
  }
  return false;
}

function isFormatCommit(commit, files = []) {
  const title = commit.commit?.message?.split('\n')[0] || '';
  if (FORMAT_PATTERNS.some(p => p.test(title))) return true;

  if (files.length > 0) {
    const allConfig = files.every(f =>
      CONFIG_ONLY_FILES.some(cfg => f.filename?.includes(cfg))
    );
    if (allConfig && files.length <= 3) return true;
  }
  return false;
}

function isLowSignal(commit, enrichedData) {
  if (!enrichedData) return false;
  const { files = [], stats = {} } = enrichedData;

  // Very small changes to config files only
  if (stats.total < 20 && files.length <= 2) {
    const allBoring = files.every(f =>
      CONFIG_ONLY_FILES.some(cfg => f.filename?.includes(cfg)) ||
      DEPENDENCY_FILES.some(dep => f.filename?.endsWith(dep))
    );
    if (allBoring) return true;
  }

  return isDependencyCommit(commit, files) || isFormatCommit(commit, files);
}

// ============================================================================
// Commit scoring (higher = more impactful)
// ============================================================================
function scoreCommit(commit, enrichedData) {
  let score = 0;
  const title = commit.commit?.message?.split('\n')[0] || '';

  // Penalize low-signal commits heavily
  if (enrichedData?.isLowSignal) {
    return -100;
  }

  // Size-based scoring
  if (enrichedData?.stats) {
    const { additions = 0, deletions = 0, total = 0 } = enrichedData.stats;
    // Prefer medium-sized changes (not too small, not massive refactors)
    if (total >= 10 && total <= 500) score += 20;
    else if (total > 500) score += 10;
    else if (total < 10) score -= 5;

    // Bonus for balanced changes (not just deletions or additions)
    if (additions > 0 && deletions > 0) score += 5;
  }

  // File count scoring
  if (enrichedData?.files) {
    const fileCount = enrichedData.files.length;
    if (fileCount >= 2 && fileCount <= 10) score += 15;
    else if (fileCount > 10) score += 5;
  }

  // Title-based scoring
  if (/^feat/i.test(title)) score += 25;
  if (/^add/i.test(title)) score += 20;
  if (/^implement/i.test(title)) score += 20;
  if (/^fix/i.test(title) && !/lint|format|typo/i.test(title)) score += 15;
  if (/^refactor/i.test(title)) score += 10;
  if (/ship|launch|release/i.test(title)) score += 20;
  if (/api|endpoint|route/i.test(title)) score += 10;
  if (/database|migration|schema/i.test(title)) score += 10;
  if (/auth|security/i.test(title)) score += 10;
  if (/test/i.test(title) && !/fix test/i.test(title)) score += 5;

  // Penalize boring commits
  if (/^merge/i.test(title)) score -= 20;
  if (/^wip/i.test(title)) score -= 10;
  if (/typo/i.test(title)) score -= 15;
  if (/readme/i.test(title) && !/^feat/i.test(title)) score -= 5;

  return score;
}

// ============================================================================
// Theme extraction (keyword-based clustering)
// ============================================================================
const THEME_KEYWORDS = {
  'Database & Migrations': ['database', 'migration', 'schema', 'postgres', 'sqlite', 'mongo', 'prisma', 'sql', 'query'],
  'API & Backend': ['api', 'endpoint', 'route', 'server', 'backend', 'rest', 'graphql', 'handler'],
  'AI & ML': ['ai', 'ml', 'model', 'gpt', 'llm', 'openai', 'claude', 'embedding', 'vector', 'prompt'],
  'UI & Frontend': ['ui', 'frontend', 'component', 'react', 'vue', 'css', 'style', 'layout', 'design'],
  'DevOps & Infrastructure': ['deploy', 'ci', 'cd', 'docker', 'kubernetes', 'railway', 'vercel', 'aws', 'infra'],
  'Testing & Quality': ['test', 'spec', 'jest', 'playwright', 'coverage', 'lint', 'type'],
  'Authentication & Security': ['auth', 'login', 'session', 'token', 'security', 'permission', 'role'],
  'CLI & Tooling': ['cli', 'command', 'script', 'tool', 'build', 'webpack', 'vite', 'turbo'],
  'Documentation': ['doc', 'readme', 'guide', 'tutorial', 'comment'],
  'Performance': ['perf', 'speed', 'cache', 'optimize', 'fast', 'slow'],
  'Refactoring': ['refactor', 'clean', 'reorganize', 'restructure', 'simplify'],
  'New Features': ['feat', 'feature', 'add', 'implement', 'new', 'ship', 'launch'],
};

function extractThemes(enrichedCommits) {
  const themeScores = {};
  const themeCommits = {};

  for (const [themeName, keywords] of Object.entries(THEME_KEYWORDS)) {
    themeScores[themeName] = 0;
    themeCommits[themeName] = [];
  }

  for (const commit of enrichedCommits) {
    if (commit.enrichedData?.isLowSignal) continue;

    const title = commit.commit?.message?.split('\n')[0]?.toLowerCase() || '';
    const files = commit.enrichedData?.files?.map(f => f.filename?.toLowerCase() || '') || [];
    const text = [title, ...files].join(' ');

    for (const [themeName, keywords] of Object.entries(THEME_KEYWORDS)) {
      const matchCount = keywords.filter(kw => text.includes(kw)).length;
      if (matchCount > 0) {
        themeScores[themeName] += matchCount * (commit.score > 0 ? commit.score : 1);
        themeCommits[themeName].push(commit);
      }
    }
  }

  // Sort themes by score and filter to top 3-8
  const sortedThemes = Object.entries(themeScores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return sortedThemes.map(([name, score]) => ({
    name,
    score,
    commits: themeCommits[name]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5),
    repos: [...new Set(themeCommits[name].map(c => c.repoFullName))],
  })).filter(t => t.commits.length >= 1);
}

// ============================================================================
// Concurrency helper
// ============================================================================
async function asyncPool(concurrency, items, fn) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);

    if (concurrency <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

// ============================================================================
// Fetch commit details with caching
// ============================================================================
async function enrichCommit(owner, repo, sha) {
  // Check cache first
  const cached = getFromCache(owner, repo, sha);
  if (cached) {
    return cached;
  }

  try {
    const { data } = await octokit.repos.getCommit({ owner, repo, ref: sha });

    const enriched = {
      files: (data.files || []).map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch?.slice(0, 500), // Truncate patch
      })),
      stats: data.stats || { additions: 0, deletions: 0, total: 0 },
      sha,
    };

    saveToCache(owner, repo, sha, enriched);
    return enriched;
  } catch (e) {
    console.error(`  ⚠ Failed to enrich ${owner}/${repo}@${sha.slice(0, 7)}: ${e.message}`);
    return null;
  }
}

// ============================================================================
// Repository details (keep existing)
// ============================================================================
async function fetchRepositoryDetails(owner, repo) {
  const details = { owner, repo };

  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    if (repoData.private) {
      console.log(`  ⊘ ${owner}/${repo} is PRIVATE - skipping`);
      return null;
    }
    details.description = repoData.description;
    details.topics = repoData.topics || [];
    details.homepage = repoData.homepage;
    details.language = repoData.language;
    details.stars = repoData.stargazers_count;
    details.url = repoData.html_url;
  } catch (e) {
    console.error(`  ⚠ Error accessing ${owner}/${repo}: ${e.message}`);
    return null;
  }

  return details;
}

// ============================================================================
// Main fetch + enrich logic
// ============================================================================
async function fetchAndEnrichActivity(username, sinceDate) {
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`👤 Authenticated as: ${user.login}\n`);

  // Search commits
  const searchQuery = `author:${user.login} committer-date:>=${sinceDate}`;
  console.log(`🔍 Searching: ${searchQuery}`);

  let allCommits = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && allCommits.length < CONFIG.MAX_COMMITS) {
    const { data } = await octokit.search.commits({
      q: searchQuery,
      sort: 'committer-date',
      order: 'desc',
      per_page: 100,
      page,
    });

    if (page === 1) console.log(`   Found ${data.total_count} total commits`);
    allCommits = allCommits.concat(data.items);
    hasMore = data.items.length === 100 && allCommits.length < data.total_count;
    page++;
  }

  console.log(`   Fetched ${allCommits.length} commits\n`);

  // Group by repo
  const commitsByRepo = new Map();
  for (const commit of allCommits) {
    const repoFullName = commit.repository.full_name;
    if (!commitsByRepo.has(repoFullName)) {
      commitsByRepo.set(repoFullName, []);
    }
    commitsByRepo.get(repoFullName).push({ ...commit, repoFullName });
  }

  console.log(`📦 Repos with commits: ${commitsByRepo.size}`);

  // Filter private repos and fetch details
  const repoDetails = new Map();
  const publicRepos = [];

  for (const [repoFullName, commits] of commitsByRepo.entries()) {
    const [owner, repoName] = repoFullName.split('/');
    const details = await fetchRepositoryDetails(owner, repoName);
    if (details) {
      repoDetails.set(repoFullName, details);
      publicRepos.push({ repoFullName, commits, details });
      console.log(`  ✓ ${repoFullName}: ${commits.length} commits`);
    }
  }

  console.log(`\n🔓 Public repos: ${publicRepos.length}\n`);

  // Decide which commits to enrich
  const commitsToEnrich = [];
  for (const { repoFullName, commits } of publicRepos) {
    // Take up to MAX_COMMITS_PER_REPO per repo
    const subset = commits.slice(0, CONFIG.MAX_COMMITS_PER_REPO);
    commitsToEnrich.push(...subset);
  }

  // Cap total enriched commits
  const finalToEnrich = commitsToEnrich.slice(0, CONFIG.MAX_ENRICHED_COMMITS);
  console.log(`🔬 Enriching ${finalToEnrich.length} commits (limit: ${CONFIG.MAX_ENRICHED_COMMITS})...\n`);

  // Enrich with concurrency
  let enrichedCount = 0;
  await asyncPool(CONFIG.CONCURRENCY_LIMIT, finalToEnrich, async (commit) => {
    const [owner, repo] = commit.repoFullName.split('/');
    const enriched = await enrichCommit(owner, repo, commit.sha);
    commit.enrichedData = enriched;

    if (enriched) {
      commit.enrichedData.isLowSignal = isLowSignal(commit, enriched);
      commit.score = scoreCommit(commit, enriched);
    } else {
      commit.score = scoreCommit(commit, null);
    }

    enrichedCount++;
    if (enrichedCount % 20 === 0) {
      console.log(`   Enriched ${enrichedCount}/${finalToEnrich.length}`);
    }
  });

  console.log(`   ✓ Enriched ${enrichedCount} commits\n`);

  // Compile all enriched commits
  const allEnrichedCommits = finalToEnrich.filter(c => c.enrichedData);

  return {
    publicRepos,
    repoDetails,
    allEnrichedCommits,
    totalCommits: allCommits.length,
  };
}

// ============================================================================
// Generate stats
// ============================================================================
function generateStats(allEnrichedCommits, publicRepos, totalCommits) {
  const fileChanges = new Map(); // filename -> { additions, deletions, count }
  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalFilesChanged = 0;

  for (const commit of allEnrichedCommits) {
    const files = commit.enrichedData?.files || [];
    for (const f of files) {
      totalAdditions += f.additions || 0;
      totalDeletions += f.deletions || 0;

      const existing = fileChanges.get(f.filename) || { additions: 0, deletions: 0, count: 0 };
      existing.additions += f.additions || 0;
      existing.deletions += f.deletions || 0;
      existing.count += 1;
      fileChanges.set(f.filename, existing);
    }
    totalFilesChanged += files.length;
  }

  const mostEditedFiles = [...fileChanges.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  return {
    totalCommits,
    reposCount: publicRepos.length,
    enrichedCommits: allEnrichedCommits.length,
    totalAdditions,
    totalDeletions,
    totalFilesChanged,
    mostEditedFiles,
  };
}

// ============================================================================
// Generate executive summary
// ============================================================================
function generateExecutiveSummary(themes, publicRepos, stats) {
  const bullets = [];

  // Top themes
  const topThemes = themes.slice(0, 3).map(t => t.name);
  if (topThemes.length > 0) {
    bullets.push(`**Primary focus areas:** ${topThemes.join(', ')}`);
  }

  // Most active repos
  const sortedRepos = [...publicRepos]
    .sort((a, b) => b.commits.length - a.commits.length)
    .slice(0, 3);
  if (sortedRepos.length > 0) {
    bullets.push(`**Most active repos:** ${sortedRepos.map(r => `[${r.repoFullName.split('/')[1]}](https://github.com/${r.repoFullName})`).join(', ')}`);
  }

  // Stats summary
  bullets.push(`**${stats.totalCommits} commits** across **${stats.reposCount} repos**`);
  bullets.push(`**~${stats.totalAdditions.toLocaleString()}** lines added, **~${stats.totalDeletions.toLocaleString()}** deleted`);

  // Feature count estimate
  const featureCommits = publicRepos.flatMap(r => r.commits)
    .filter(c => /^(feat|add|implement|ship)/i.test(c.commit?.message || ''));
  if (featureCommits.length > 0) {
    bullets.push(`**${featureCommits.length} feature-related commits** identified`);
  }

  return bullets.slice(0, 7);
}

// ============================================================================
// Categorize commits by theme for a single repo
// ============================================================================
function categorizeCommitsByTheme(commits) {
  const themeCommits = {};
  const uncategorized = [];

  for (const commit of commits) {
    const title = commit.commit?.message?.split('\n')[0]?.toLowerCase() || '';
    const files = commit.enrichedData?.files?.map(f => f.filename?.toLowerCase() || '') || [];
    const text = [title, ...files].join(' ');

    let matched = false;
    for (const [themeName, keywords] of Object.entries(THEME_KEYWORDS)) {
      const matchCount = keywords.filter(kw => text.includes(kw)).length;
      if (matchCount > 0) {
        if (!themeCommits[themeName]) {
          themeCommits[themeName] = [];
        }
        themeCommits[themeName].push(commit);
        matched = true;
        break; // Assign to first matching theme only
      }
    }

    if (!matched) {
      uncategorized.push(commit);
    }
  }

  // Sort themes by number of commits
  const sortedThemes = Object.entries(themeCommits)
    .sort((a, b) => b[1].length - a[1].length);

  return { sortedThemes, uncategorized };
}

// ============================================================================
// Format activity as high-signal markdown
// ============================================================================
function formatActivityAsMarkdown(publicRepos, repoDetails, allEnrichedCommits, dateRange) {
  if (publicRepos.length === 0) {
    return `No significant GitHub activity was detected for the period ${dateRange.startFormatted} to ${dateRange.endFormatted}.`;
  }

  const themes = extractThemes(allEnrichedCommits);
  const stats = generateStats(allEnrichedCommits, publicRepos, publicRepos.reduce((sum, r) => sum + r.commits.length, 0));
  const execSummary = generateExecutiveSummary(themes, publicRepos, stats);

  let md = '';

  // ─────────────────────────────────────────────────────────────────────────
  // Executive Summary
  // ─────────────────────────────────────────────────────────────────────────
  md += `## Executive Summary\n\n`;
  md += `**Period:** ${dateRange.startFormatted} to ${dateRange.endFormatted}\n\n`;
  execSummary.forEach(b => { md += `- ${b}\n`; });
  md += `\n`;

  // ─────────────────────────────────────────────────────────────────────────
  // Per-Repo Details (All commits grouped by theme)
  // ─────────────────────────────────────────────────────────────────────────
  // Separate high-signal vs low-signal repos
  const highSignalRepos = [];
  const lowSignalRepos = [];

  for (const { repoFullName, commits, details } of publicRepos) {
    const repoEnriched = commits.filter(c => c.enrichedData);
    const highSignalCommits = repoEnriched.filter(c => !c.enrichedData?.isLowSignal);

    if (highSignalCommits.length >= 2 || commits.length >= 5) {
      highSignalRepos.push({ repoFullName, commits, details, repoEnriched, highSignalCommits });
    } else {
      lowSignalRepos.push({ repoFullName, commits, details });
    }
  }

  if (highSignalRepos.length > 0) {
    md += `## Per-Repo Details\n\n`;

    for (const { repoFullName, commits, details, repoEnriched } of highSignalRepos) {
      const repoUrl = details?.url || `https://github.com/${repoFullName}`;
      const repoShort = repoFullName.split('/')[1];

      md += `### [${repoShort}](${repoUrl})\n\n`;

      if (details?.description) {
        md += `> ${details.description}\n\n`;
      }

      // Summary stats
      const featureCount = commits.filter(c => /^(feat|add|implement)/i.test(c.commit?.message || '')).length;
      const fixCount = commits.filter(c => /^fix/i.test(c.commit?.message || '')).length;
      md += `**Summary:** ${commits.length} commits`;
      if (featureCount > 0) md += `, ${featureCount} features`;
      if (fixCount > 0) md += `, ${fixCount} fixes`;
      md += `\n\n`;

      // Top files touched
      const fileCounts = new Map();
      for (const c of repoEnriched) {
        for (const f of c.enrichedData?.files || []) {
          fileCounts.set(f.filename, (fileCounts.get(f.filename) || 0) + 1);
        }
      }
      const topFiles = [...fileCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (topFiles.length > 0) {
        md += `**Top files:** ${topFiles.map(([f]) => `\`${f.split('/').pop()}\``).join(', ')}\n\n`;
      }

      // Group ALL commits by theme
      const { sortedThemes, uncategorized } = categorizeCommitsByTheme(commits);

      // Output commits grouped by theme
      for (const [themeName, themeCommits] of sortedThemes) {
        md += `#### ${themeName}\n\n`;
        // Sort by score within theme
        const sortedCommits = [...themeCommits].sort((a, b) => (b.score || 0) - (a.score || 0));
        for (const c of sortedCommits) {
          const shortSha = c.sha.slice(0, 7);
          const url = `https://github.com/${repoFullName}/commit/${c.sha}`;
          const title = c.commit?.message?.split('\n')[0] || '';
          const statsStr = c.enrichedData?.stats
            ? ` (+${c.enrichedData.stats.additions}/-${c.enrichedData.stats.deletions})`
            : '';
          md += `- [\`${shortSha}\`](${url}) ${title}${statsStr}\n`;
        }
        md += `\n`;
      }

      // Output uncategorized commits if any
      if (uncategorized.length > 0) {
        md += `#### Other\n\n`;
        const sortedUncategorized = [...uncategorized].sort((a, b) => (b.score || 0) - (a.score || 0));
        for (const c of sortedUncategorized) {
          const shortSha = c.sha.slice(0, 7);
          const url = `https://github.com/${repoFullName}/commit/${c.sha}`;
          const title = c.commit?.message?.split('\n')[0] || '';
          const statsStr = c.enrichedData?.stats
            ? ` (+${c.enrichedData.stats.additions}/-${c.enrichedData.stats.deletions})`
            : '';
          md += `- [\`${shortSha}\`](${url}) ${title}${statsStr}\n`;
        }
        md += `\n`;
      }
    }
  }

  // Low-signal repos
  if (lowSignalRepos.length > 0) {
    md += `### Low-Signal Repos\n\n`;
    md += `_These repos had minimal activity or only dependency/config changes:_\n\n`;
    for (const { repoFullName, commits } of lowSignalRepos) {
      const repoShort = repoFullName.split('/')[1];
      md += `- **${repoShort}**: ${commits.length} commits\n`;
    }
    md += `\n`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────────────────
  md += `## Stats\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total commits | ${stats.totalCommits} |\n`;
  md += `| Repos touched | ${stats.reposCount} |\n`;
  md += `| Commits enriched | ${stats.enrichedCommits} |\n`;
  md += `| Lines added | ~${stats.totalAdditions.toLocaleString()} |\n`;
  md += `| Lines deleted | ~${stats.totalDeletions.toLocaleString()} |\n`;
  md += `\n`;

  if (stats.mostEditedFiles.length > 0) {
    md += `**Most-edited files:**\n`;
    for (const [filename, data] of stats.mostEditedFiles) {
      md += `- \`${filename}\` (${data.count} commits, +${data.additions}/-${data.deletions})\n`;
    }
    md += `\n`;
  }

  return md;
}

// ============================================================================
// Chunk text for GitHub's 65536 char limit
// ============================================================================
const GITHUB_MAX_BODY = 60000; // Leave some buffer

function chunkContent(content, maxSize = GITHUB_MAX_BODY) {
  const chunks = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point (prefer section headers, then newlines)
    let breakPoint = maxSize;

    // Look for ## header within the last 20% of the chunk
    const searchStart = Math.floor(maxSize * 0.8);
    const searchArea = remaining.slice(searchStart, maxSize);
    const headerMatch = searchArea.lastIndexOf('\n## ');
    if (headerMatch !== -1) {
      breakPoint = searchStart + headerMatch + 1;
    } else {
      // Fall back to last newline
      const lastNewline = remaining.lastIndexOf('\n', maxSize);
      if (lastNewline > maxSize * 0.5) {
        breakPoint = lastNewline + 1;
      }
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint);
  }

  return chunks;
}

// ============================================================================
// Escape @mentions to prevent triggering bots
// ============================================================================
function escapeAtMentions(text) {
  // Replace @username patterns with escaped version (except in the trigger comment)
  // This prevents accidentally triggering Claude multiple times from commit messages
  return text.replace(/@(\w+)/g, '`@$1`');
}

// ============================================================================
// Create GitHub issue (keep existing @claude instructions)
// ============================================================================
async function createActivityIssue(activityMarkdown, dateRange) {
  const issueTitle = `Weekly Activity: ${dateRange.startFormatted} to ${dateRange.endFormatted}`;

  // Escape any @mentions in the activity data to prevent multiple triggers
  const escapedMarkdown = escapeAtMentions(activityMarkdown);

  // Split activity markdown into chunks if needed
  const activityChunks = chunkContent(escapedMarkdown);
  console.log(`   Activity markdown: ${activityMarkdown.length} chars, split into ${activityChunks.length} chunk(s)`);

  // Issue body contains activity data; instructions will be in final @claude comment
  let issueBody;
  let remainingChunks;

  const firstChunk = `# Weekly GitHub Activity Blog Post Request

${activityChunks[0]}

---
_Full instructions will be posted in a comment after all activity data._`;

  if (firstChunk.length <= GITHUB_MAX_BODY) {
    issueBody = firstChunk;
    remainingChunks = activityChunks.slice(1);
  } else {
    // First chunk too big, put placeholder in issue body
    issueBody = `# Weekly GitHub Activity Blog Post Request

_Activity data is split across comments below due to size. Full instructions will be posted in the final comment._`;
    remainingChunks = activityChunks;
  }

  // Create the issue
  const response = await octokit.issues.create({
    owner: 'thomasdavis',
    repo: 'lordajax.com',
    title: issueTitle,
    body: issueBody,
    labels: ['blog-post', 'automated'],
  });

  console.log(`✅ Created issue #${response.data.number}: ${issueTitle}`);
  console.log(`   URL: ${response.data.html_url}`);

  // Add remaining chunks as comments
  if (remainingChunks.length > 0) {
    console.log(`   Adding ${remainingChunks.length} additional comment(s)...`);

    for (let i = 0; i < remainingChunks.length; i++) {
      const chunkHeader = remainingChunks.length > 1
        ? `## Activity Data (Part ${i + 2}/${activityChunks.length})\n\n`
        : `## Activity Data (Continued)\n\n`;

      await octokit.issues.createComment({
        owner: 'thomasdavis',
        repo: 'lordajax.com',
        issue_number: response.data.number,
        body: chunkHeader + remainingChunks[i],
      });

      console.log(`   ✓ Added comment ${i + 1}/${remainingChunks.length}`);
    }
  }

  // Final comment to trigger @claude after all data is posted
  const claudeTriggerComment = `@claude All activity data has been posted above. Please write this week's devlog following these guidelines:

---

## Instructions

You are Lord Ajax ("I write software and shitty poetry"), writing your own weekly devlog. First person. Blunt, funny, self-aware, builder-focused. The blog openly discloses these are AI-written — so don't fake being human, just make it genuinely worth reading: specific, honest, and varied. This is a lab notebook, not a press release.

**The one rule that matters most: signal over volume.** A quiet week is a short, honest post. Only run long when the work actually earns it. Never pad. Never write a section about a repo that has nothing interesting to say.

---

### Before you write: read the last two posts

Look at the two most recent posts in \`apps/homepage/posts/\` (newest folders / by \`createdAt\` in \`blog.json\`). **Do NOT re-report any commit, feature, number, or anecdote already covered there.** If this window overlaps a previous one, dedupe by commit — only write about what's genuinely new. Don't re-explain a project you already introduced.

---

### Length

Length follows substance. Target roughly **1,500–2,500 words** for a normal week; go shorter if it was quiet, longer only if the work truly warrants it. Do not aim for a word count — aim for the interesting stuff and stop.

---

### Voice

**Keep:** blunt, funny, confident, willing to admit hacks, dead-ends, and half-baked experiments.

**Remove:**
- Hype ("stupidly easy", "killer feature", "at scale", "it just works", "this feels like magic", "premium", "significantly enhance", "the npm for X").
- Corporate/marketing tone — if it reads like a promo or a docs page, make it more personal or cut it.
- Vague filler ("improved deployment") — replace with the specific ("spent a dozen commits fighting Railway's config-path behaviour").

**Banned recurring tics** (these appear in every prior post — do not use them): "the hidden pattern / unifying thread", "every repo is a node in a larger graph/ecosystem", "I broke this into N parallel tracks", "I used to call it X but it's actually Y", "is doing a lot of load-bearing work", "that's the tell", "isn't a nice-to-have", "net-negative line count is a good sign", "30 seconds of work / 20 minutes of confusion", "X hell". A "## Why You Should Care" highlight reel is banned. Rotate your phrasing; if you catch yourself writing a stock transition, cut it.

---

### Structure — earn it, don't stamp it

- **Open cold** on the single most interesting, hardest, or most surprising thing that actually happened this week. NOT a repo roll-call, a commit tally, or a grand thesis about what you're "really" building.
- **Give a full section only to a repo/thread with a real story.** Collapse trivial, dependency-only, or dormant repos into a single one-line roundup at the end (e.g. \`Also touched: foo (deps), bar (config)\`). A one-commit repo with nothing to say gets one line, or is omitted. The activity report above already separates high-signal from low-signal repos — trust that split.
- **No fixed template.** The Problem → Approach → Results → Pitfalls → Next shape is available where it fits, but a project can just as well be a single paragraph, a deep-dive on one bug, or one dry sentence. **Vary the structure** across sections and across weeks.
- End with a short, honest "what's next" only if you actually have concrete next steps — don't manufacture them.

---

### Evidence & honesty (this is the whole point)

- **Every number must trace to the activity data above** (commit counts, files changed, line diffs) and be consistent with what past posts said. Do NOT invent runtime or engagement metrics the data can't support: no fps, cache-hit %, npm downloads, forks, retention/accuracy %, $/call, or funnels ("5→5→5→3"). If you didn't measure it, say so plainly or drop the claim.
- **If a repo has no real commit detail, OMIT it.** Never write "Without specific commit data I can only note that X typically…". No content is better than filler.
- **Line counts size a diff; they do not measure work, risk, or completeness.** Never write "(measured: git diff on X)" or "the +A/-B shape suggests…". Back a claim with a real outcome (a before/after, a pass rate, a latency) or state "no measurement — diff size only".
- Keep the honesty posture that already works: separate "shipped" from "verified", flag weak signals as weak — but as one honest aside, not a per-sentence reflex.
- Never claim "secure/safe" absolutely — say "sandboxed, with these limits" and name the threat model. Never imply clinical diagnosis — if profiling users, say "not a diagnosis", "opt-in", "deletable".

---

### Code blocks

Include a code block ONLY if it is quoted **verbatim from the repo** (reference the file path + commit) AND the code itself is the insight — the actual bug, a genuinely non-obvious decision. **Never invent route handlers, SQL, YAML, or config, and never paste stock framework boilerplate** (auth providers, theme toggles, fetch wrappers, whole class files). Max ~3 snippets in the whole post; otherwise link to the line on GitHub.

---

### Title

Name the single most interesting, hardest, or most surprising artifact of the week. **Vary the form** — a flat declarative, one concrete detail, or a question. Do NOT use the "Two Weeks of X, Y, and Z" / "A, B, and the Week [clause]" mold (every prior title uses it), and no "In which I… / Or: How I accidentally…" subtitle. Don't reuse a reframe from the body as the title.

---

### Output format

Output ONLY the finished post in Markdown:
- \`#\` title on the first line (an optional one-line italic subtitle may follow).
- The body, structured as the material warrants.
- End with a single honest footer line disclosing authorship, e.g. \`_This devlog was written by AI from my public GitHub activity._\` — exactly one sentence, no "generated from N commits", no in-body "this is the post you're reading" victory laps.

Do NOT output these instructions, meta commentary, or a restatement of the issue text. Do NOT emit the literal markers \`**text:**\` or \`**code:**\` anywhere in the post.

---

### Final steps

After writing the post:

1. Create \`apps/homepage/posts/<slug>/post.md\` where \`<slug>\` is a slugified version of your title.
2. Update \`apps/homepage/blog.json\` — add the new entry at the **start** of the \`posts\` array with all four fields:
   - \`"title"\`: the exact title text from your \`#\` H1 (required — do not leave it blank/undefined)
   - \`"source": "./posts/<slug>/post.md"\`
   - \`"createdAt": "YYYY-MM-DD"\` (today's date)
   - \`"type": "ai"\`
3. **Create a pull request** with the \`gh\` CLI:
   - Commit the changes, then create and push a branch whose name starts with \`claude/\`.
   - Run: \`gh pr create --title "Weekly Activity: [Your Title]" --body "Auto-generated devlog. Fixes #[issue-number]" --label "activity-post" --label "automated"\`
   - The PR MUST have the \`activity-post\` label for auto-merge to work.`;

  await octokit.issues.createComment({
    owner: 'thomasdavis',
    repo: 'lordajax.com',
    issue_number: response.data.number,
    body: claudeTriggerComment,
  });
  console.log(`   ✓ Added @claude trigger comment with full instructions`);

  return response.data;
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  try {
    console.log('🚀 Starting high-signal activity collection...\n');
    console.log(`⚙  Config: DAYS=${CONFIG.DAYS}, MAX_COMMITS=${CONFIG.MAX_COMMITS}, MAX_ENRICHED=${CONFIG.MAX_ENRICHED_COMMITS}, MAX_PER_REPO=${CONFIG.MAX_COMMITS_PER_REPO}\n`);

    const dateRange = getDateRange();
    console.log(`📅 Period: ${dateRange.startFormatted} to ${dateRange.endFormatted}\n`);

    const { publicRepos, repoDetails, allEnrichedCommits } = await fetchAndEnrichActivity('thomasdavis', dateRange.start);

    console.log('📝 Generating high-signal markdown...\n');
    const activityMarkdown = formatActivityAsMarkdown(publicRepos, repoDetails, allEnrichedCommits, dateRange);

    console.log('🎫 Creating GitHub issue...\n');
    await createActivityIssue(activityMarkdown, dateRange);

    console.log('\n✨ Done! Issue created with themes, rankings, and stats.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
