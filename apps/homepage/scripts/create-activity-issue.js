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
  try {
    const details = { owner, repo };

    // Get repository info
    try {
      const { data: repoData } = await octokit.repos.get({ owner, repo });
      details.description = repoData.description;
      details.topics = repoData.topics || [];
      details.homepage = repoData.homepage;
      details.language = repoData.language;
      details.stars = repoData.stargazers_count;
      details.url = repoData.html_url;
    } catch (e) {}

    // Get README
    try {
      const { data: readme } = await octokit.repos.getReadme({ owner, repo });
      const readmeContent = Buffer.from(readme.content, 'base64').toString('utf-8');
      details.readme = readmeContent.slice(0, 800); // First 800 chars
    } catch (e) {}

    // Get package.json
    try {
      const { data: packageFile } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json',
      });
      const packageContent = Buffer.from(packageFile.content, 'base64').toString('utf-8');
      details.packageJson = JSON.parse(packageContent);
    } catch (e) {}

    // Skip file structure to save space

    return details;
  } catch (error) {
    console.error(`Error fetching repository details for ${owner}/${repo}:`, error.message);
    return null;
  }
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

    // Fetch recent events using authenticated user's event feed
    // This gets more data than public-only when authenticated
    let events = [];
    try {
      // First verify we're authenticated and get the actual username
      const { data: user } = await octokit.users.getAuthenticated();
      console.log(`Authenticated as: ${user.login}`);

      // Use the user events endpoint (authenticated = more data)
      const response = await octokit.request('GET /users/{username}/events', {
        username: user.login,
        per_page: 100,
      });
      events = response.data || [];
      console.log(`Fetched ${events.length} total events for user ${user.login}`);
    } catch (error) {
      console.error('Error with authenticated request, falling back:', error.message);
      // Fallback to public events with provided username
      try {
        const response = await octokit.activity.listPublicEventsForUser({
          username,
          per_page: 100,
        });
        events = response.data || [];
        console.log(`Fetched ${events.length} public events (fallback)`);
      } catch (fallbackError) {
        console.error('Error fetching events:', fallbackError.message);
        events = [];
      }
    }

    // Filter events from the past week
    const recentEvents = events.filter(
      event => new Date(event.created_at) > new Date(sinceDate)
    );

    // Process events and collect unique repositories
    for (const event of recentEvents) {
      if (event.type === 'PushEvent') {
        const [owner, repoName] = event.repo.name.split('/');

        if (!repoDetails.has(event.repo.name)) {
          const details = await fetchRepositoryDetails(owner, repoName);
          if (details) {
            repoDetails.set(event.repo.name, details);
          }
        }

        const latestCommitSha = event.payload.head;
        const codeSnippets = await fetchCommitCode(owner, repoName, latestCommitSha);

        // Safely handle commits array
        const commits = event.payload.commits || [];

        activities.push({
          type: 'commits',
          repo: event.repo.name,
          count: commits.length,
          messages: commits.map(c => c.message),
          branch: event.payload.ref ? event.payload.ref.replace('refs/heads/', '') : 'unknown',
          codeSnippets: codeSnippets,
          repoDetails: repoDetails.get(event.repo.name),
        });
      } else if (event.type === 'CreateEvent') {
        const [owner, repoName] = event.repo.name.split('/');

        if (!repoDetails.has(event.repo.name)) {
          const details = await fetchRepositoryDetails(owner, repoName);
          if (details) {
            repoDetails.set(event.repo.name, details);
          }
        }

        activities.push({
          type: 'created',
          repo: event.repo.name,
          ref_type: event.payload.ref_type,
          ref: event.payload.ref,
          repoDetails: repoDetails.get(event.repo.name),
        });
      } else if (event.type === 'PullRequestEvent') {
        activities.push({
          type: 'pr',
          repo: event.repo.name,
          action: event.payload.action,
          title: event.payload.pull_request.title,
          body: event.payload.pull_request.body,
          url: event.payload.pull_request.html_url,
        });
      } else if (event.type === 'IssuesEvent') {
        activities.push({
          type: 'issue',
          repo: event.repo.name,
          action: event.payload.action,
          title: event.payload.issue.title,
          body: event.payload.issue.body,
          url: event.payload.issue.html_url,
        });
      }
    }

    // Also fetch recent starred repos
    const { data: starred } = await octokit.activity.listReposStarredByUser({
      username,
      per_page: 10,
      sort: 'created',
    });

    const recentStars = starred.filter(
      repo => new Date(repo.starred_at) > new Date(sinceDate)
    );

    if (recentStars.length > 0) {
      activities.push({
        type: 'starred',
        repos: recentStars.map(r => ({
          name: r.full_name,
          description: r.description,
          language: r.language,
          url: r.html_url,
        })),
      });
    }

    // Fetch recent repositories directly for comprehensive coverage
    try {
      const { data: repos } = await octokit.repos.listForUser({
        username,
        sort: 'pushed',
        per_page: 30,
      });

      for (const repo of repos) {
        if (new Date(repo.pushed_at) > new Date(sinceDate)) {
          try {
            const { data: commits } = await octokit.repos.listCommits({
              owner: repo.owner.login,
              repo: repo.name,
              since: sinceDate,
              per_page: 10,
            });

            if (commits.length > 0 && !repoDetails.has(repo.full_name)) {
              const details = await fetchRepositoryDetails(repo.owner.login, repo.name);
              if (details) {
                repoDetails.set(repo.full_name, details);
              }

              activities.push({
                type: 'recent_commits',
                repo: repo.full_name,
                count: commits.length,
                messages: commits.map(c => c.commit.message),
                repoDetails: details,
              });
            }
          } catch (e) {
            // Skip if we can't access commits
          }
        }
      }
    } catch (e) {
      console.error('Error fetching user repos:', e.message);
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
    } else if (activity.type === 'starred') {
      repoActivities['_starred'] = [activity];
    }
  });

  // Generate detailed activity breakdown
  for (const [repo, acts] of Object.entries(repoActivities)) {
    if (repo === '_starred') {
      markdown += `### ⭐ Starred Repositories\n\n`;
      acts[0].repos.forEach(r => {
        markdown += `- **[${r.name}](${r.url})** - ${r.description || 'No description'} (${r.language || 'Unknown'})\n`;
      });
      markdown += `\n`;
      continue;
    }

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
      if (activity.type === 'commits' || activity.type === 'recent_commits') {
        markdown += `\n- **${activity.count} commits** ${activity.branch ? `to \`${activity.branch}\`` : ''}\n`;
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
      } else if (activity.type === 'created') {
        markdown += `\n- Created ${activity.ref_type}: ${activity.ref || 'repository'}\n`;
      } else if (activity.type === 'pr') {
        markdown += `\n- Pull Request ${activity.action}: [${activity.title}](${activity.url})\n`;
        // Limit PR body to 100 chars
        if (activity.body) {
          markdown += `  ${activity.body.slice(0, 100)}...\n`;
        }
      } else if (activity.type === 'issue') {
        markdown += `\n- Issue ${activity.action}: [${activity.title}](${activity.url})\n`;
        // Skip issue body to save space
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
2. **Metadata:** Include the following immediately after the title:
   \`\`\`
   **text:** human
   **code:** AI
   \`\`\`
3. **Content Style:**
   - Technical and comprehensive, explaining both what AND why
   - Heavy use of code examples from actual implementations (shown above)
   - Include links to GitHub repos, npm packages, documentation
   - Explain the problem any projects solve before diving into implementation
   - Show actual usage examples, CLI commands, API calls
   - Discuss technical architecture and design decisions
   - Include installation instructions and getting started guides
   - Reference dependencies and explain why they were chosen
   - Write as if teaching other developers

4. **Structure:**
   - Introduction: Brief overview of what was worked on this week
   - Main sections: Deep dive into the most significant projects/work
   - Code examples: Use the actual code snippets provided above
   - Links: Include all relevant GitHub, npm, documentation links
   - Conclusion: Summary and potential next steps

### Implementation Steps:
1. Create a new markdown file in \`apps/homepage/posts/\` with a slugified filename
2. Write the blog post content following the format and style above
3. Update \`apps/homepage/blog.json\` to add the new post entry at the beginning of the posts array
4. Ensure the post has proper formatting and all links work
5. Create a pull request with your changes and label it "activity-post"

### Example Post Structure:
\`\`\`markdown
# Weekly Activity: [Descriptive Subtitle]

**text:** human
**code:** AI

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
