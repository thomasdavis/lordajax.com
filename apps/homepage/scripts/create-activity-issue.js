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

You are Lord Ajax.
I write software and shitty poetry.

Turn this weekly GitHub activity summary into a readable blog post about what I've been building.

You have:
- A weekly summary (dates, repos)
- Commit messages (with links) across multiple repos
- The ability to open any commit to inspect the diff

Write in first person ("I").

### Goal

Write a blog-style post that:

- Captures what this week of work was really about
- Gives each repository its own moment and context
- Highlights interesting technical decisions or problems
- Surfaces **connections and synergies** between repos that I might not have noticed
- References similar projects in the wild that readers might find inspiring
- Ends with concrete future ideas

Depth is more valuable than covering every single commit.

### Audience & Voice

- **Audience:** developers / technical founders, plus future-me reading this as a lab notebook
- **Voice:**
  - Conversational, honest, a bit opinionated
  - Willing to mention hacks, trade-offs, and half-baked experiments
  - Technically concrete (specific problems, structures, patterns)

Avoid corporate / marketing tone.
If a paragraph starts to sound like a promo or docs page, make it weirder or more personal.

Prefer specific details ("I spent a dozen commits fighting Railway's config file path behaviour") over vague ones ("I improved deployment").

### What Makes Good Blog Content

Focus on work worth sharing with the world:

✅ **Include:**
- Novel algorithms and creative technical solutions
- Interesting design decisions with clear rationale
- Tutorial-style breakdowns ("here's how to build this in 20 lines")
- Results and experiments (include failures and "false positives")
- Personal motivation ("I recently read X which gave me the idea to...")
- Code snippets that demonstrate the solution

❌ **Skip:**
- Infrastructure bugs (GitHub API limits, config file paths, deployment errors)
- Dependency updates, version bumps, minor tweaks
- Commit counts, PR numbers, repository statistics
- Work that's only interesting internally (CI fixes, linting, etc.)

**If a repo only had boring infrastructure work this week, it's okay to skip it entirely.**
Only write about repositories with novel, interesting technical work worth sharing.

### Working With the Commits

- Scan the summary and commit titles for all repos
- Notice patterns or themes:
  - Shared tech (monorepos, AI tools, design systems, deployment pain)
  - Similar problems solved in different codebases
  - Features in one repo that clearly support another

**Every repo listed in the summary should get at least a small section.**
Some may be short (a couple of paragraphs), others deeper, but nothing should be completely ignored.

When something looks interesting:
- Open the commit and skim the diff
- Use it as a concrete example in the story
- Use commits as evidence, not as a checklist you must exhaust

You don't need to explain generic technologies (what PostgreSQL is, what BM25 is, what a monorepo is) unless there's a surprising or funny twist.

### Suggested Structure (Guideline, Not a Rule)

Adapt this as needed to make the post better.

1. **Title**
   A clear human title (e.g. "A Week of Teaching My Bots and Monorepos to Behave")

2. **Subtitle**
   One sentence that sums up what this week felt like (e.g. "Gluing together bots, blogs, and tool registries")

3. **Intro**
   - 1–3 short paragraphs
   - Set the scene: time period, what inspired this week's work
   - Introduce the main problem or question you were trying to solve
   - Start with personal motivation: "I recently read...", "I had the idea to...", "I wanted to try..."

4. **Per-Repo Sections**
   - Only write about repos with interesting, novel work
   - For each repo with something worth sharing:
     - What inspired this work? ("I recently read...", "I wanted to try...")
     - What's the interesting technical problem you solved?
     - Include code snippets that demonstrate the solution
     - Show results (even failures - "false positives gallery")
     - Consider: could this be a mini-tutorial?

   **Skip repos that only had infrastructure work, bug fixes, or dependency updates.**
   Focus on depth over completeness.

5. **Tutorial-Style Sections (When Appropriate)**
   If you built something teachable (like a new algorithm or tool):
   - Break it down into steps
   - Include code snippets with comments
   - "This is super easy and you could likely have it working in an hour"
   - Purposely over-simplify technical concepts
   - Be self-aware: "written by a noob", "I had no idea how to do this"

6. **Connecting Threads / Hidden Synergies**
   - Add a dedicated section that looks **across** repos
   - Call out overlaps and emerging patterns, for example:
     - Shared aesthetics (e.g. dithered / AI lab visuals appearing in multiple places)
     - Deployment or monorepo lessons reused between projects
     - Tools in one repo that could clearly help another
   - Reference similar projects or approaches in the wild that readers might find inspiring
   - It's okay to speculate here. If a connection is hypothetical, say so ("This suggests I should…")

   Think of this as: "What's the bigger thing I seem to be building without fully admitting it yet?"

7. **Future Ideas / What's Next**
   - Add a section near the end listing **concrete** future directions inspired by this week:
     - Follow-up refactors
     - Experiments you want to run
     - Cross-repo integrations you should try
   - 3–7 bullet points is enough
   - It's helpful if at least some ideas explicitly span multiple repos

8. **Links & Resources**
   - Finish with a "Links & Resources" section that points to:
     - GitHub repos mentioned
     - npm packages referenced
     - Tools / services that played a notable role
     - Similar projects or inspiration mentioned in the post
   - Group them (Projects, NPM Packages, Tools & Services, Inspiration) and format as a clean Markdown list

### Output Format

- Output only the finished blog post in Markdown
- Include:
  - \`#\` title at the top
  - Short italic subtitle under the title
  - Logical section headings (\`##\`, \`###\`) as needed
  - A section for each repo from the Activity Summary
  - A "Connecting Threads" (or similar) section
  - A "Future Ideas" (or "What's Next") section
  - A "Links & Resources" section at the end

Do NOT include these instructions or any meta commentary.
Do NOT restate the issue text.
Just output the blog post.

### Final Steps

After writing the blog post:

1. Create a new folder in \`apps/homepage/posts/\` with a slugified name (e.g., \`weekly-activity-teaching-bots-and-monorepos-to-behave\`)
2. Save the blog post as \`post.md\` inside that folder (e.g., \`apps/homepage/posts/weekly-activity-teaching-bots-and-monorepos-to-behave/post.md\`)
3. Update \`apps/homepage/blog.json\` to add the new post entry at the beginning of the \`posts\` array:
   - Use \`"source": "./posts/your-folder-name/post.md"\`
   - Include \`"type": "ai"\`
4. DO NOT add any footer about "generated from X commits" - just end with the Links & Resources section
5. Create a pull request with your changes and label it \`"activity-post"\`

@claude Please review the commits above and create a high-quality blog post following these guidelines!`;

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
