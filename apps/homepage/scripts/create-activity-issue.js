const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Initialize Octokit
const octokit = new Octokit({
  auth: process.env.GH_ACCESS_TOKEN || process.env.GITHUB_TOKEN,
});

// Get current date in YYYY-MM-DD format
const getCurrentDate = () => {
  const date = new Date();
  return date.toISOString().split('T')[0];
};

// Get date range for the past 2 weeks
const getDateRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    startFormatted: startDate.toISOString().split('T')[0],
    endFormatted: endDate.toISOString().split('T')[0],
  };
};

// Fetch repository details including README, package.json, and recent files
async function fetchRepositoryDetails(owner, repo) {
  const details = { owner, repo };

  // Get repository info
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    // Skip private repositories
    if (repoData.private) {
      console.log(`Repository ${owner}/${repo} is PRIVATE - skipping`);
      return null;
    }
    details.description = repoData.description;
    details.topics = repoData.topics || [];
    details.homepage = repoData.homepage;
    details.language = repoData.language;
    details.stars = repoData.stargazers_count;
    details.url = repoData.html_url;
    console.log(`Repository ${owner}/${repo} is PUBLIC - including (${repoData.stargazers_count} stars)`);
  } catch (e) {
    console.error(`Error accessing repository ${owner}/${repo}: ${e.message}`);
    return null;
  }

  // Get README (optional - don't fail if not found)
  try {
    const { data: readme } = await octokit.repos.getReadme({ owner, repo });
    const readmeContent = Buffer.from(readme.content, 'base64').toString('utf-8');
    details.readme = readmeContent.slice(0, 800); // First 800 chars
  } catch (e) {
    // README is optional
  }

  // Get package.json (optional - don't fail if not found)
  try {
    const { data: packageFile } = await octokit.repos.getContent({
      owner,
      repo,
      path: 'package.json',
    });
    const packageContent = Buffer.from(packageFile.content, 'base64').toString('utf-8');
    details.packageJson = JSON.parse(packageContent);
  } catch (e) {
    // package.json is optional
  }

  return details;
}


// Fetch GitHub activity for the past week
async function fetchGitHubActivity(username, sinceDate) {
  try {
    const activities = [];
    const repoDetails = new Map();

    // Get authenticated user
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`Authenticated as: ${user.login}`);

    // Use GitHub Search API to find ALL commits across all repos (personal + orgs)
    const searchQuery = `author:${user.login} committer-date:>=${sinceDate}`;
    console.log(`Searching for commits with query: ${searchQuery}`);

    // Fetch ALL pages of results (GitHub limits to 100 per page, max 1000 total)
    let allCommits = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && allCommits.length < 1000) {
      const { data: searchResults } = await octokit.search.commits({
        q: searchQuery,
        sort: 'committer-date',
        order: 'desc',
        per_page: 100,
        page: page,
      });

      if (page === 1) {
        console.log(`Found ${searchResults.total_count} total commits`);
      }

      allCommits = allCommits.concat(searchResults.items);
      console.log(`Fetched page ${page}: ${searchResults.items.length} commits (total so far: ${allCommits.length})`);

      // Check if there are more pages
      hasMore = searchResults.items.length === 100 && allCommits.length < searchResults.total_count;
      page++;
    }

    console.log(`Fetched all ${allCommits.length} commits across ${page - 1} pages`);

    // Group commits by repository
    const commitsByRepo = new Map();
    for (const commit of allCommits) {
      const repoFullName = commit.repository.full_name;

      if (!commitsByRepo.has(repoFullName)) {
        commitsByRepo.set(repoFullName, []);
      }
      commitsByRepo.get(repoFullName).push(commit);
    }

    console.log(`\nCommits found across ${commitsByRepo.size} repositories:`);
    for (const [repo, commits] of commitsByRepo.entries()) {
      console.log(`  - ${repo}: ${commits.length} commits`);
    }

    console.log(`\nProcessing repositories...\n`);

    // Process each repository's commits
    for (const [repoFullName, commits] of commitsByRepo.entries()) {
      const [owner, repoName] = repoFullName.split('/');

      console.log(`Checking ${repoFullName}...`);

      // Fetch repo details and skip if private
      const details = await fetchRepositoryDetails(owner, repoName);
      if (!details) {
        // Repository is private or inaccessible (already logged in fetchRepositoryDetails)
        continue;
      }

      repoDetails.set(repoFullName, details);

      // Store all commit data (not just messages)
      activities.push({
        type: 'commits',
        repo: repoFullName,
        count: commits.length,
        commitData: commits, // Store full commit objects with SHA, message, etc.
        repoDetails: details,
      });

      console.log(`✓ Added ${commits.length} commits from ${repoFullName}\n`);
    }

    console.log(`Total activities found: ${activities.length} from ${repoDetails.size} repositories`);
    return { activities, repoDetails };
  } catch (error) {
    console.error('Error fetching GitHub activity:', error);
    return { activities: [], repoDetails: new Map() };
  }
}

// Format activity as markdown for the issue
function formatActivityAsMarkdown(activities, repoDetails, dateRange, allCommitData) {
  if (activities.length === 0) {
    return `No significant GitHub activity was detected for the period ${dateRange.startFormatted} to ${dateRange.endFormatted}.

This might be a good opportunity to write about a technical topic, tool, or concept instead of activity-based content.`;
  }

  let markdown = `## Activity Summary\n\n`;
  markdown += `**Period:** ${dateRange.startFormatted} to ${dateRange.endFormatted}\n\n`;

  // List all commits grouped by repository
  for (const activity of activities) {
    const details = repoDetails.get(activity.repo);

    markdown += `### 📦 [${activity.repo}](${details?.url || `https://github.com/${activity.repo}`})\n\n`;

    if (details) {
      if (details.description) markdown += `${details.description}\n\n`;
      const meta = [];
      if (details.language) meta.push(details.language);
      if (details.stars) meta.push(`⭐ ${details.stars}`);
      if (meta.length > 0) markdown += `${meta.join(' • ')}\n\n`;
    }

    // List most recent commits with links (cap at 150 to avoid GitHub issue size limits)
    const commits = activity.commitData || [];
    const commitsToShow = commits.slice(0, 150);
    const hasMore = commits.length > 150;

    commitsToShow.forEach(commit => {
      const shortSha = commit.sha.substring(0, 7);
      const commitUrl = `https://github.com/${activity.repo}/commit/${commit.sha}`;
      const message = commit.commit.message.split('\n')[0]; // First line only
      markdown += `- [\`${shortSha}\`](${commitUrl}) ${message}\n`;
    });

    if (hasMore) {
      markdown += `\n_...and ${commits.length - 150} more commits. [View all](${details?.url || `https://github.com/${activity.repo}`}/commits)_\n`;
    }

    markdown += `\n`;
  }

  return markdown;
}

// Create GitHub issue with activity
async function createActivityIssue(activityMarkdown, dateRange) {
  try {
    const issueTitle = `Weekly Activity: ${dateRange.startFormatted} to ${dateRange.endFormatted}`;

    const issueBody = `# Weekly GitHub Activity Blog Post Request

${activityMarkdown}

---

## Instructions for @claude

You are an expert technical writer and editor for developer devlogs. You are writing as Lord Ajax ("I write software and shitty poetry").

**Your job:** Turn these commits into a high-signal weekly devlog with a strong narrative, concrete evidence, and consistent structure. Write in first person ("I").

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
5. Create a pull request with your changes and label it \`"activity-post"\`

@claude Please review the commits above and create a high-quality devlog following these guidelines!`;

    const response = await octokit.issues.create({
      owner: 'thomasdavis',
      repo: 'lordajax.com',
      title: issueTitle,
      body: issueBody,
      labels: ['blog-post', 'automated'],
    });

    console.log(`✅ Created issue #${response.data.number}: ${issueTitle}`);
    console.log(`   URL: ${response.data.html_url}`);

    return response.data;
  } catch (error) {
    console.error('Error creating GitHub issue:', error.message);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log('🚀 Starting weekly activity collection...\n');

    const dateRange = getDateRange();
    console.log(`📅 Collecting activity from ${dateRange.startFormatted} to ${dateRange.endFormatted}\n`);

    const { activities, repoDetails } = await fetchGitHubActivity('thomasdavis', dateRange.start);

    console.log(`\n📊 Found ${activities.length} activities across ${repoDetails.size} repositories\n`);

    console.log('📝 Formatting activity as markdown...\n');
    const activityMarkdown = formatActivityAsMarkdown(activities, repoDetails, dateRange);

    console.log('🎫 Creating GitHub issue...\n');
    await createActivityIssue(activityMarkdown, dateRange);

    console.log('\n✨ Done! Issue created successfully. @claude will be notified.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
