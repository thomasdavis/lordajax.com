const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Initialize Octokit
const octokit = new Octokit({
  auth: process.env.GH_ACCESS_TOKEN || process.env.GITHUB_TOKEN,
});

// Get current date in YYYY-MM-DD format
const getCurrentDate = () => {
  const date = new Date();
  return date.toISOString().split('T')[0];
};

// Get date range for the week
const getDateRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

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

  const totalCommits = activities.reduce((sum, act) => sum + act.count, 0);

  let markdown = `## Activity Summary\n\n`;
  markdown += `**Period:** ${dateRange.startFormatted} to ${dateRange.endFormatted}\n\n`;
  markdown += `**Total Commits:** ${totalCommits}\n`;
  markdown += `**Repositories:** ${repoDetails.size}\n\n`;

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

    markdown += `**${activity.count} commits:**\n\n`;

    // List ALL commits with links
    const commits = activity.commitData || [];
    commits.forEach(commit => {
      const shortSha = commit.sha.substring(0, 7);
      const commitUrl = `https://github.com/${activity.repo}/commit/${commit.sha}`;
      const message = commit.commit.message.split('\n')[0]; // First line only
      markdown += `- [\`${shortSha}\`](${commitUrl}) ${message}\n`;
    });

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

You are a senior engineer and writer. Your job is to turn this weekly activity summary + commit list into a compelling, narrative-style blog post.

You are given:
- A high-level activity summary (dates, repos, commit counts)
- Full lists of commits (titles + links) across multiple repos
- Ability to click into any commit to inspect the diff if needed

Write as if you are the author of this work, in first person ("I").

### GOAL

Write a single, coherent blog post that:

- Tells a story about what I was trying to achieve this week
- Highlights the most interesting technical decisions and problems
- Shows how work across multiple repos connects into a bigger vision
- Is enjoyable to read for intermediate-to-advanced developers

Focus on **depth over breadth**.
It is totally fine to ignore many commits and zoom in on 1–3 key themes.

### AUDIENCE & VOICE

- Audience: developers and technical founders
- Assume they have general web/infra/AI context but have never seen this codebase before
- Voice:
  - First person ("I", "my")
  - Conversational and honest, mildly opinionated
  - Confident but not arrogant
  - Willing to admit trade-offs, hacks, and unfinished edges

Avoid corporate or marketing fluff. No "synergy", no "leverage".

### HOW TO USE THE COMMITS

1. **Scan everything first**
   - Look over the Activity Summary and all commit titles across repos
   - Group them mentally into 2–4 themes

2. **Pick a main storyline**
   - Choose ONE primary storyline for the post
   - Optionally include 1–2 smaller side stories as sub-sections

3. **Use commit links for depth**
   - When something looks interesting, click the commit and scan the diff
   - Pull out key details: data structures, APIs, patterns, weird bugs, or refactors
   - Use those details to tell a story, not to list code line-by-line

4. **DO NOT do this**
   - Do NOT write a chronological "then I did X, then Y" recap
   - Do NOT mention every repo or every commit
   - Do NOT dump a bullet-point list of changes

### STRUCTURE

Use roughly this structure:

1. **Title**
   - Catchy but clear
   - Examples: "Teaching My Self-Evolving Bot to Clean Up Its Own Mess" or "A Week of Making Omega Less Janky and More Autonomous"

2. **Subtitle**
   - One sentence that adds context: what this week was about in human language

3. **Intro (1–3 short paragraphs)**
   - Set the scene: what problem or goal defined this week?
   - Reference the time period and scope lightly
   - Hook the reader with some tension (a tricky bug, design dilemma, constraint)

4. **Main sections (2–4 sections)**
   For each main theme:
   - Use a clear heading
   - Explain:
     - What the situation was before
     - What hurt / what was messy
     - What I decided to change, and why
     - How I implemented it at a high level (reference key commits)
     - What I learned or what still feels iffy
   - Prioritise **insight** over exhaustive detail

5. **Small section: "Tiny Changes That Added Up" (optional)**
   - Briefly mention a handful of smaller commits that improved DX, performance, or reliability
   - Explain why these boring changes actually matter

6. **Links & Resources**
   - Add a "## Links & Resources" section near the end
   - Include clickable links to:
     - All GitHub repositories mentioned
     - Any npm packages referenced
     - Documentation sites
     - Tools or frameworks discussed
   - Format as a clean bulleted list with descriptions

7. **Closing section: "What's Next"**
   - Share what this week unlocked
   - Mention the next few steps or experiments you're excited about
   - List 2-4 future ideas or directions being considered
   - If appropriate, invite readers to follow the repos or try the project

### STYLE & QUALITY GUARDRAILS

- Don't apologise for imperfections; instead, frame them as trade-offs or iterations
- Prefer concrete phrases over vague ones
- Feel free to have opinions (why this architectural choice? why this library?)
- Explain acronyms and project names briefly on first use

### OUTPUT FORMAT

- Output **only** the finished blog post in Markdown
- Include:
  - An H1 title at the top (\`# ...\`)
  - A short italic subtitle under the title
  - Logical headings (\`##\`, \`###\`) for sections
  - Occasional bullet lists where it aids clarity
  - Optional short code blocks if they concretely illustrate a point
  - A "## Links & Resources" section with all relevant links
  - A "## What's Next" section with future ideas

Do NOT include meta commentary about how you wrote the post.
Do NOT restate these instructions.
Just output the blog post.

### FINAL STEPS

After writing the blog post:

1. Create a new markdown file in \`apps/homepage/posts/\` with a slugified filename (e.g., \`weekly-activity-nov-24-2025.md\`)
2. Update \`apps/homepage/blog.json\` to add the new post entry at the beginning of the posts array with \`"type": "ai"\`
3. Create a pull request with your changes and label it "activity-post"

@claude Please review the commits above and create a high-quality narrative blog post following these guidelines!`;

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
