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

// Fetch code snippets from recent commits
async function fetchCommitCode(owner, repo, sha) {
  try {
    const { data: commit } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });

    // Get meaningful file changes
    const codeSnippets = [];
    const importantFiles = commit.files.filter(file =>
      file.filename.match(/\.(js|ts|jsx|tsx|json|md|yml|yaml|py|go|rs)$/) &&
      !file.filename.includes('lock') &&
      !file.filename.includes('node_modules')
    );

    // Limit to 2 files with shorter patches
    for (const file of importantFiles.slice(0, 2)) {
      if (file.patch) {
        codeSnippets.push({
          filename: file.filename,
          patch: file.patch.slice(0, 300), // Limit patch size
          additions: file.additions,
          deletions: file.deletions,
          status: file.status,
        });
      }
    }
    return codeSnippets;
  } catch (error) {
    return [];
  }
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

      // Get the latest commit for code snippets
      const latestCommit = commits[0];
      const codeSnippets = await fetchCommitCode(owner, repoName, latestCommit.sha);

      activities.push({
        type: 'commits',
        repo: repoFullName,
        count: commits.length,
        messages: commits.map(c => c.commit.message),
        branch: 'various',
        codeSnippets: codeSnippets,
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
function formatActivityAsMarkdown(activities, repoDetails, dateRange) {
  if (activities.length === 0) {
    return `No significant GitHub activity was detected for the period ${dateRange.startFormatted} to ${dateRange.endFormatted}.

This might be a good opportunity to write about a technical topic, tool, or concept instead of activity-based content.`;
  }

  let markdown = `## Activity Summary\n\n`;
  markdown += `**Period:** ${dateRange.startFormatted} to ${dateRange.endFormatted}\n`;
  markdown += `**Total Activities:** ${activities.length}\n`;
  markdown += `**Repositories:** ${repoDetails.size}\n\n`;

  // Group activities by repository
  const repoActivities = {};
  activities.forEach(activity => {
    if (activity.repo) {
      if (!repoActivities[activity.repo]) {
        repoActivities[activity.repo] = [];
      }
      repoActivities[activity.repo].push(activity);
    }
  });

  // Generate detailed activity breakdown
  for (const [repo, acts] of Object.entries(repoActivities)) {

    const details = repoDetails.get(repo);
    markdown += `### 📦 ${repo}\n\n`;

    if (details) {
      if (details.url) markdown += `**Repository:** ${details.url}\n`;
      if (details.description) markdown += `**Description:** ${details.description}\n`;
      if (details.language) markdown += `**Language:** ${details.language}\n`;
      if (details.stars) markdown += `**Stars:** ${details.stars}\n`;
      if (details.topics && details.topics.length > 0) {
        markdown += `**Topics:** ${details.topics.join(', ')}\n`;
      }
      markdown += `\n`;

      if (details.readme) {
        markdown += `<details>\n<summary>README Excerpt</summary>\n\n${details.readme}\n\n</details>\n\n`;
      }

      // Simplified package info
      if (details.packageJson && details.packageJson.name) {
        markdown += `**Package:** ${details.packageJson.name}\n\n`;
      }
    }

    // Activity details
    markdown += `**Activity:**\n`;
    acts.forEach(activity => {
      if (activity.type === 'commits') {
        markdown += `\n- **${activity.count} commits**\n`;
        // Limit to 3 commit messages
        activity.messages.slice(0, 3).forEach(msg => {
          markdown += `  - "${msg}"\n`;
        });

        if (activity.codeSnippets && activity.codeSnippets.length > 0) {
          markdown += `\n  **Code Changes:**\n`;
          activity.codeSnippets.forEach(snippet => {
            markdown += `\n  **${snippet.filename}** (+${snippet.additions} -${snippet.deletions})\n`;
            markdown += `  \`\`\`diff\n${snippet.patch}\n  \`\`\`\n`;
          });
        }
      }
    });

    markdown += `\n---\n\n`;
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

Please create a comprehensive technical blog post based on the GitHub activity above. The blog post should:

### Content Requirements:
1. **Title Format:** Start with "Weekly Activity: " followed by a descriptive subtitle about the main focus
2. **Content Style:**
   - Technical and comprehensive, explaining both what AND why
   - Heavy use of code examples from actual implementations (shown above)
   - Include links to GitHub repos, npm packages, documentation
   - Explain the problem any projects solve before diving into implementation
   - Show actual usage examples, CLI commands, API calls
   - Discuss technical architecture and design decisions
   - Include installation instructions and getting started guides
   - Reference dependencies and explain why they were chosen
   - Write as if teaching other developers

3. **Structure:**
   - Introduction: Brief overview of what was worked on this week
   - Main sections: Deep dive into the most significant projects/work
   - Code examples: Use the actual code snippets provided above
   - Links: Include all relevant GitHub, npm, documentation links
   - Conclusion: Summary and potential next steps

### Implementation Steps:
1. Create a new markdown file in \`apps/homepage/posts/\` with a slugified filename
2. Write the blog post content following the format and style above
3. Update \`apps/homepage/blog.json\` to add the new post entry at the beginning of the posts array with \`"type": "ai"\`
4. Ensure the post has proper formatting and all links work
5. Create a pull request with your changes and label it "activity-post"

### Example Post Structure:
\`\`\`markdown
# Weekly Activity: [Descriptive Subtitle]

This week I focused on [main theme]...

## Project Name

[Technical explanation with code examples]

\`\`\`bash
# Installation or usage example
\`\`\`

[More detailed content...]

## Technical Details

[Architecture, decisions, implementation]

## Links
- GitHub: [url]
- npm: [url]

\`\`\`

---

@claude Please analyze the activity above and create a high-quality technical blog post following these guidelines.`;

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
