const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const { openai } = require('@ai-sdk/openai');
const { generateText } = require('ai');

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
    } catch (e) {}

    // Get README
    try {
      const { data: readme } = await octokit.repos.getReadme({ owner, repo });
      const readmeContent = Buffer.from(readme.content, 'base64').toString('utf-8');
      details.readme = readmeContent.slice(0, 3000); // First 3000 chars
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

    // Get recent files structure
    try {
      const { data: contents } = await octokit.repos.getContent({
        owner,
        repo,
        path: '',
      });
      details.structure = contents.filter(item => item.type === 'file' || item.type === 'dir')
        .map(item => ({ name: item.name, type: item.type }))
        .slice(0, 20);
    } catch (e) {}

    // Get CLI usage if it's a CLI tool
    if (details.packageJson && details.packageJson.bin) {
      details.isCLI = true;
      details.cliCommands = Object.keys(details.packageJson.bin);
    }

    return details;
  } catch (error) {
    console.error(`Error fetching repository details for ${owner}/${repo}:`, error.message);
    return null;
  }
}

// Fetch code snippets from recent commits with more context
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
      file.filename.match(/\.(js|ts|jsx|tsx|json|md|yml|yaml)$/) &&
      !file.filename.includes('lock') &&
      !file.filename.includes('node_modules')
    );

    for (const file of importantFiles.slice(0, 5)) {
      if (file.patch) {
        codeSnippets.push({
          filename: file.filename,
          patch: file.patch,
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

// Check if we've written about this project before
async function hasWrittenAbout(projectName) {
  const blogJsonPath = path.join(__dirname, '..', 'blog.json');
  const blogJson = JSON.parse(fs.readFileSync(blogJsonPath, 'utf8'));
  
  return blogJson.posts.some(post => 
    post.title.toLowerCase().includes(projectName.toLowerCase()) ||
    post.source.toLowerCase().includes(projectName.toLowerCase())
  );
}

// Fetch GitHub activity with deep analysis
async function fetchGitHubActivity(username) {
  try {
    const since = getTwoWeeksAgo();
    const activities = [];
    const repoDetails = new Map();

    // Fetch recent events
    const { data: events } = await octokit.activity.listPublicEventsForUser({
      username,
      per_page: 100,
    });

    // Filter events from the last 2 weeks
    const recentEvents = events.filter(
      event => new Date(event.created_at) > new Date(since)
    );

    // Process events and collect unique repositories
    for (const event of recentEvents) {
      if (event.type === 'PushEvent') {
        const [owner, repoName] = event.repo.name.split('/');
        
        // Fetch repository details if not already fetched
        if (!repoDetails.has(event.repo.name)) {
          const details = await fetchRepositoryDetails(owner, repoName);
          if (details) {
            repoDetails.set(event.repo.name, details);
          }
        }

        const latestCommitSha = event.payload.head;
        const codeSnippets = await fetchCommitCode(owner, repoName, latestCommitSha);
        
        activities.push({
          type: 'commits',
          repo: event.repo.name,
          count: event.payload.commits.length,
          messages: event.payload.commits.map(c => c.message),
          branch: event.payload.ref.replace('refs/heads/', ''),
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
      repo => new Date(repo.starred_at) > new Date(since)
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

    return { activities, repoDetails };
  } catch (error) {
    console.error('Error fetching GitHub activity:', error);
    return { activities: [], repoDetails: new Map() };
  }
}

// Generate intelligent blog post
async function generateBlogPost(activities, repoDetails) {
  const hasActivity = activities.length > 0;

  // Identify the main project to write about
  let mainProject = null;
  let isNewProject = false;
  
  if (hasActivity) {
    // Find the most active repository
    const repoActivity = {};
    activities.forEach(a => {
      if (a.repo) {
        repoActivity[a.repo] = (repoActivity[a.repo] || 0) + 1;
      }
    });
    
    const mostActiveRepo = Object.entries(repoActivity)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostActiveRepo) {
      mainProject = repoDetails.get(mostActiveRepo[0]);
      if (mainProject) {
        const projectName = mostActiveRepo[0].split('/')[1];
        isNewProject = !(await hasWrittenAbout(projectName));
      }
    }
  }

  // Create comprehensive activity summary with all details
  let activitySummary = '';
  if (hasActivity) {
    activitySummary = activities
      .map(a => {
        if (a.type === 'commits') {
          let summary = `Repository: ${a.repo} (${a.count} commits on ${a.branch})\n`;
          summary += `Commit messages:\n${a.messages.map(m => `  - "${m}"`).join('\n')}`;
          
          if (a.repoDetails) {
            summary += `\n\nRepository Details:\n`;
            summary += `- Description: ${a.repoDetails.description || 'No description'}\n`;
            summary += `- Language: ${a.repoDetails.language || 'Unknown'}\n`;
            summary += `- Stars: ${a.repoDetails.stars || 0}\n`;
            if (a.repoDetails.topics?.length > 0) {
              summary += `- Topics: ${a.repoDetails.topics.join(', ')}\n`;
            }
            if (a.repoDetails.homepage) {
              summary += `- Homepage: ${a.repoDetails.homepage}\n`;
            }
            if (a.repoDetails.readme) {
              summary += `\nREADME excerpt:\n${a.repoDetails.readme.slice(0, 1000)}\n`;
            }
            if (a.repoDetails.packageJson) {
              summary += `\npackage.json details:\n`;
              summary += `- Name: ${a.repoDetails.packageJson.name}\n`;
              summary += `- Version: ${a.repoDetails.packageJson.version}\n`;
              summary += `- Description: ${a.repoDetails.packageJson.description || 'None'}\n`;
              if (a.repoDetails.packageJson.scripts) {
                summary += `- Scripts: ${Object.keys(a.repoDetails.packageJson.scripts).join(', ')}\n`;
              }
              if (a.repoDetails.packageJson.dependencies) {
                const deps = Object.keys(a.repoDetails.packageJson.dependencies).slice(0, 5);
                summary += `- Key dependencies: ${deps.join(', ')}\n`;
              }
              if (a.repoDetails.isCLI) {
                summary += `- CLI commands: ${a.repoDetails.cliCommands.join(', ')}\n`;
              }
            }
          }
          
          if (a.codeSnippets?.length > 0) {
            summary += `\nCode changes:\n`;
            a.codeSnippets.forEach(snippet => {
              summary += `\nFile: ${snippet.filename} (${snippet.status}, +${snippet.additions} -${snippet.deletions})\n`;
              summary += `\`\`\`diff\n${snippet.patch}\n\`\`\`\n`;
            });
          }
          
          return summary;
        } else if (a.type === 'pr') {
          return `Pull Request ${a.action}: "${a.title}" in ${a.repo}\nURL: ${a.url}\n${a.body ? `Description: ${a.body.slice(0, 200)}` : ''}`;
        } else if (a.type === 'issue') {
          return `Issue ${a.action}: "${a.title}" in ${a.repo}\nURL: ${a.url}`;
        } else if (a.type === 'starred') {
          return `Starred repositories:\n${a.repos.map(r => `- ${r.name}: ${r.description || 'No description'} (${r.language || 'Unknown language'})\n  URL: ${r.url}`).join('\n')}`;
        } else if (a.type === 'created') {
          let summary = `Created ${a.ref_type} "${a.ref || 'repository'}" in ${a.repo}`;
          if (a.repoDetails) {
            summary += `\nProject: ${a.repoDetails.description || 'No description'}`;
          }
          return summary;
        }
      })
      .join('\n\n---\n\n');
  }

  const systemPrompt = `You are Thomas Davis (Lord Ajax), a skilled software engineer writing in-depth technical blog posts for your personal blog. 

Your writing style:
- Technical and comprehensive, explaining both what AND why
- Heavy use of code examples from actual implementations
- Include links to GitHub repos, npm packages, documentation
- Explain the problem the project solves before diving into implementation
- Show actual usage examples, CLI commands, API calls
- Discuss technical architecture and design decisions
- Include installation instructions and getting started guides
- Reference dependencies and explain why they were chosen
- No philosophical musings - pure technical content
- Write as if teaching other developers how to use/understand the project

Important guidelines:
- If this is the FIRST post about a project, write an introduction post explaining what it is, why it was built, and how to use it
- If you've written about the project before, focus on recent updates and improvements
- Always include relevant links (GitHub, npm, documentation, etc.)
- Show real code from the commits, not hypothetical examples
- Explain technical decisions and trade-offs
- Include performance considerations if relevant
- Mention future roadmap items if apparent from the activity`;

  const userPrompt = hasActivity
    ? `${isNewProject ? 'This is the FIRST blog post about this project, so write an introduction post.' : 'This is an update post about ongoing work.'}

Write a comprehensive technical blog post based on this GitHub activity. Include:
- What the project does and why it exists (if first post)
- Technical implementation details with code examples
- How to install and use it
- Architecture decisions
- Links to GitHub, npm, docs, etc.
- Recent improvements or features added

${mainProject ? `Main project focus: ${mainProject.owner}/${mainProject.repo}` : ''}

Full activity details:
${activitySummary}

Format:
# [Clear, Descriptive Title]

**text:** human
**code:** AI

[Comprehensive technical content with code blocks, links, and examples]`
    : `Write a technical blog post about a specific programming concept, tool, or technique that would interest other developers. Make it practical with code examples.

Format:
# [Technical Title]

**text:** human
**code:** AI

[Technical content with examples]`;

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      maxCompletionTokens: 3000, // Allow longer posts
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
    console.log('Starting intelligent blog post generation...');
    console.log('Fetching GitHub activity and analyzing repositories...');
    
    const { activities, repoDetails } = await fetchGitHubActivity('thomasdavis');
    
    console.log(`Found ${activities.length} activities across ${repoDetails.size} repositories`);
    
    console.log('Generating comprehensive blog post...');
    const blogContent = await generateBlogPost(activities, repoDetails);
    
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