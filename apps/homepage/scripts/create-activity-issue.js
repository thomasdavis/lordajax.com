const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ============================================================================
// Configuration (env vars with defaults)
// ============================================================================
const CONFIG = {
  DAYS: parseInt(process.env.DAYS, 10) || 14,
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
// Create GitHub issue (keep existing @claude instructions)
// ============================================================================
async function createActivityIssue(activityMarkdown, dateRange) {
  const issueTitle = `Weekly Activity: ${dateRange.startFormatted} to ${dateRange.endFormatted}`;

  // Split activity markdown into chunks if needed
  const activityChunks = chunkContent(activityMarkdown);
  console.log(`   Activity markdown: ${activityMarkdown.length} chars, split into ${activityChunks.length} chunk(s)`);

  // Issue body contains activity data; instructions will be in final @claude comment
  let issueBody;
  let remainingChunks;

  const firstChunk = `# Weekly GitHub Activity Blog Post Request

${activityChunks[0]}

---
_Full instructions for @claude will be posted in a comment after all activity data._`;

  if (firstChunk.length <= GITHUB_MAX_BODY) {
    issueBody = firstChunk;
    remainingChunks = activityChunks.slice(1);
  } else {
    // First chunk too big, put placeholder in issue body
    issueBody = `# Weekly GitHub Activity Blog Post Request

_Activity data is split across comments below due to size. Full instructions for @claude will be posted in the final comment._`;
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
  const claudeTriggerComment = `@claude All activity data has been posted above. Please create a high-quality devlog following these guidelines:

---

## Instructions

You are an expert technical writer and editor for developer devlogs. You are writing as Lord Ajax ("I write software and shitty poetry").

**Your job:** Turn the activity summary above into a high-signal weekly devlog with a strong narrative, concrete evidence, and consistent structure. Write in first person ("I").

---

### Voice

**Keep:** Blunt, funny, confident, builder-focused. Willing to mention hacks, trade-offs, and half-baked experiments.

**Remove:**
- Repetitive hype phrases ("super easy", "stupidly easy", "took 30 minutes") — use sparingly, max once per post
- Corporate/product-marketing tone — if it sounds like a promo or docs page, make it weirder or more personal
- Vague statements ("improved deployment") — replace with specifics ("spent a dozen commits fighting Railway's config file path behaviour")

**Audience:** Developers, technical founders, and future-me reading this as a lab notebook.

---

### Required Structure

#### 1. Title + Hook
- Clear human title (e.g., "A Week of Teaching My Bots and Monorepos to Behave")
- One-sentence italic subtitle that captures the vibe

#### 2. Thesis / Connecting Thread (1 paragraph, near the top)
What's the bigger thing I seem to be building without fully admitting it yet? Surface the hidden pattern across repos.

#### 3. Why You Should Care (4-6 bullets)
Quick skimmable list of what shipped. Concrete deliverables, not vibes.

#### 4. Major Sections (one per theme/project worth covering)

Each section MUST include:
- **Problem:** What was broken or missing?
- **Approach:** What did I try? Include code snippets where useful.
- **Results:** At least 1 measurable or falsifiable detail. How was it measured?
- **Pitfalls / What Broke:** At least 1 honest limitation, hack, or failure.
- **Next:** 1-3 bullets on what's coming.

**Skip repos that only had infrastructure work, bug fixes, or dependency updates.**
Depth over completeness — it's okay to skip boring repos entirely.

#### 5. What's Next (3-7 bullets)
Concrete future directions. Bonus if they span multiple repos.

#### 6. Links & Resources
Group by: Projects, NPM Packages, Tools & Services, Inspiration.

---

### Evidence Rules

- For each numeric claim, add one sentence describing how it was measured (even roughly)
- If measurement is unknown, rewrite as qualitative ("felt faster") or add a TODO
- Never claim "secure/safe" absolutely — use "sandboxed with limits" and note threat model
- Never imply clinical diagnosis — if profiling users, say "not diagnosis", "opt-in", "deletable"

---

### Editing Rules

- Reduce redundancy by merging similar paragraphs
- Prefer specific verbs and concrete artifacts over vibes
- Keep skimmable: use headings, bullets, and callouts
- Trim long tool/feature lists: show 2-3 examples and link out for the rest
- Don't explain generic tech (PostgreSQL, BM25, monorepo) unless there's a surprising twist

---

### Working With Commits

- Scan commit titles for patterns: shared tech, similar problems across repos, features that support each other
- Open interesting commits and skim the diff for concrete examples
- Use commits as evidence, not a checklist to exhaust

---

### Output Format

Output ONLY the finished blog post in Markdown:
- \`#\` title at top
- Italic subtitle
- Thesis paragraph
- "Why You Should Care" bullets
- \`##\` sections with the Problem/Approach/Results/Pitfalls/Next structure
- "What's Next" section
- "Links & Resources" section

Do NOT include these instructions or meta commentary.
Do NOT restate the issue text.

---

### Final Steps

After writing the blog post:

1. Create a new folder in \`apps/homepage/posts/\` with a slugified name based on the title (e.g., \`weekly-activity-teaching-bots-and-monorepos-to-behave\`)
2. Save the blog post as \`post.md\` inside that folder (e.g., \`apps/homepage/posts/weekly-activity-teaching-bots-and-monorepos-to-behave/post.md\`)
3. Update \`apps/homepage/blog.json\` to add the new post entry at the beginning of the \`posts\` array:
   - Use \`"source": "./posts/your-folder-name/post.md"\`
   - Include \`"type": "ai"\`
   - Include \`"createdAt": "YYYY-MM-DD"\` with today's date
4. DO NOT add any footer about "generated from X commits" — end with Links & Resources
5. Create a pull request with your changes and label it \`"activity-post"\``;

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
