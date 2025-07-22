const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Initialize clients
const octokit = new Octokit({
  auth: process.env.GH_ACCESS_TOKEN || process.env.GITHUB_TOKEN,
});

// Get current date in YYYY-MM-DD format
const getCurrentDate = () => {
  const date = new Date();
  return date.toISOString().split('T')[0];
};

// Get date 2 weeks ago
const getTwoWeeksAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 14);
  return date.toISOString();
};

// Fetch code snippets from recent commits
async function fetchCommitCode(owner, repo, sha) {
  try {
    const { data: commit } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });
    
    // Get first 3 file changes with actual code
    const codeSnippets = [];
    for (const file of commit.files.slice(0, 3)) {
      if (file.patch && file.filename.match(/\.(js|ts|json|md|yml|yaml)$/)) {
        codeSnippets.push({
          filename: file.filename,
          patch: file.patch.slice(0, 500), // First 500 chars
          additions: file.additions,
          deletions: file.deletions,
        });
      }
    }
    return codeSnippets;
  } catch (error) {
    return [];
  }
}

// Fetch GitHub activity for the past 2 weeks
async function fetchGitHubActivity(username) {
  try {
    const since = getTwoWeeksAgo();
    const activities = [];

    // Fetch recent commits
    const { data: events } = await octokit.activity.listPublicEventsForUser({
      username,
      per_page: 100,
    });

    // Filter events from the last 2 weeks
    const recentEvents = events.filter(
      event => new Date(event.created_at) > new Date(since)
    );

    // Process different event types
    for (const event of recentEvents) {
      if (event.type === 'PushEvent') {
        const [owner, repoName] = event.repo.name.split('/');
        const latestCommitSha = event.payload.head;
        const codeSnippets = await fetchCommitCode(owner, repoName, latestCommitSha);
        
        activities.push({
          type: 'commits',
          repo: event.repo.name,
          count: event.payload.commits.length,
          messages: event.payload.commits.map(c => c.message),
          branch: event.payload.ref.replace('refs/heads/', ''),
          codeSnippets: codeSnippets,
        });
      } else if (event.type === 'CreateEvent') {
        activities.push({
          type: 'created',
          repo: event.repo.name,
          ref_type: event.payload.ref_type,
          ref: event.payload.ref,
        });
      } else if (event.type === 'PullRequestEvent') {
        activities.push({
          type: 'pr',
          repo: event.repo.name,
          action: event.payload.action,
          title: event.payload.pull_request.title,
        });
      } else if (event.type === 'IssuesEvent') {
        activities.push({
          type: 'issue',
          repo: event.repo.name,
          action: event.payload.action,
          title: event.payload.issue.title,
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
      repo => new Date(repo.starred_at) > new Date(since)
    );

    if (recentStars.length > 0) {
      activities.push({
        type: 'starred',
        repos: recentStars.map(r => ({
          name: r.full_name,
          description: r.description,
          language: r.language,
        })),
      });
    }

    return activities;
  } catch (error) {
    console.error('Error fetching GitHub activity:', error);
    return [];
  }
}

// Generate blog post content
async function generateBlogPost(activities) {
  const hasActivity = activities.length > 0;

  // Create activity summary
  let activitySummary = '';
  if (hasActivity) {
    activitySummary = `
GitHub Activity Summary from the past 2 weeks:
${activities
  .map(a => {
    if (a.type === 'commits') {
      const commitDetails = a.messages.slice(0, 3).map(m => `  - "${m}"`).join('\n');
      let result = `- Repository: ${a.repo} (${a.count} commits on ${a.branch})\n${commitDetails}`;
      
      if (a.codeSnippets && a.codeSnippets.length > 0) {
        result += '\n  Code changes:';
        for (const snippet of a.codeSnippets) {
          result += `\n  File: ${snippet.filename} (+${snippet.additions} -${snippet.deletions})`;
          result += `\n\`\`\`diff\n${snippet.patch}\n\`\`\``;
        }
      }
      return result;
    } else if (a.type === 'created') {
      return `- Created ${a.ref_type} "${a.ref || 'repository'}" in ${a.repo}`;
    } else if (a.type === 'pr') {
      return `- ${a.action} PR: "${a.title}" in ${a.repo}`;
    } else if (a.type === 'issue') {
      return `- ${a.action} issue: "${a.title}" in ${a.repo}`;
    } else if (a.type === 'starred') {
      const starDetails = a.repos.slice(0, 3).map(r => `  - ${r.name}: ${r.description || 'No description'}`).join('\n');
      return `- Starred ${a.repos.length} repositories:\n${starDetails}`;
    }
  })
  .join('\n')}`;
  }

  const systemPrompt = `You are Thomas Davis (Lord Ajax), a software engineer writing technical blog posts. Your style:
- Technical and code-focused
- Shows actual implementations with code blocks
- Explains what you built and how it works
- No philosophical musings or life lessons
- Direct, practical, sharing technical knowledge
- Focuses on the code and technical decisions
- Often shows package.json dependencies, CLI commands, API endpoints
- Explains technical architecture and implementation details

Your posts are for other developers who want to see what you're building and how.`;

  const userPrompt = hasActivity
    ? `Based on this GitHub activity, write a technical blog post about what was built. Focus on:
- Show actual code snippets from the project
- Explain technical implementation details
- Include package.json dependencies, CLI commands, or API examples
- Describe the architecture or technical approach
- Share specific code patterns or solutions

Activity:
${activitySummary}

Format:
# [Short Technical Title]

**text:** human
**code:** AI

[Technical content with code blocks]`
    : `Write a short, inspiring blog post (200-300 words) in the style of Nietzsche's philosophical reflections, but applied to software engineering and creation. Make it personal and motivating for yourself as a creator. Focus on themes like:
- The will to create
- Overcoming technical obstacles
- The joy of building
- Digital craftsmanship
- The programmer as artist

Format the response as:
# [Title]

**text:** human
**code:** AI

[Blog content in markdown]`;

  try {
    const result = await generateText({
      model: openai('gpt-4-turbo-preview'),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.8,
      maxTokens: 1000,
    });

    return result.text;
  } catch (error) {
    console.error('Error generating blog post:', error);
    throw error;
  }
}

// Generate filename from title
function generateFilename(content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (!titleMatch) return `auto-post-${getCurrentDate()}.md`;

  const title = titleMatch[1];
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug}.md`;
}

// Update blog.json with new post
function updateBlogJson(filename, title) {
  const blogJsonPath = path.join(__dirname, '..', 'blog.json');
  const blogJson = JSON.parse(fs.readFileSync(blogJsonPath, 'utf8'));

  const newPost = {
    title: title,
    source: `./posts/${filename}`,
    createdAt: getCurrentDate(),
  };

  // Add to beginning of posts array
  blogJson.posts.unshift(newPost);

  fs.writeFileSync(blogJsonPath, JSON.stringify(blogJson, null, 2) + '\n');
}

// Main function
async function main() {
  try {
    console.log('Fetching GitHub activity...');
    const activities = await fetchGitHubActivity('thomasdavis');

    console.log(`Found ${activities.length} activities`);

    console.log('Generating blog post...');
    const blogContent = await generateBlogPost(activities);

    // Extract title
    const titleMatch = blogContent.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : 'Auto-generated Post';

    // Generate filename and save
    const filename = generateFilename(blogContent);
    const filepath = path.join(__dirname, '..', 'posts', filename);

    console.log(`Writing post to ${filename}...`);
    fs.writeFileSync(filepath, blogContent);

    // Update blog.json
    console.log('Updating blog.json...');
    updateBlogJson(filename, title);

    console.log('Blog post generated successfully!');
  } catch (error) {
    console.error('Error generating blog post:', error);
    process.exit(1);
  }
}

// Run the script
main();
