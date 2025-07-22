# Auto Blog Post Generator Setup

This GitHub Action automatically generates blog posts every 2 weeks based on your GitHub activity or writes Nietzsche-inspired reflections if no activity is found.

## Required GitHub Secrets

You need to add the following secrets to your repository:

### 1. OPENAI_API_KEY

1. Go to your repository on GitHub
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key (get one from https://platform.openai.com/api-keys)

### 2. GH_ACCESS_TOKEN

1. Create a GitHub Personal Access Token:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Give it a name like "Auto Blog Post Generator"
   - Select scopes: `repo` (full control) and `read:user`
   - Generate and copy the token
2. Add it as a repository secret:
   - Name: `GH_ACCESS_TOKEN`
   - Value: Your GitHub Personal Access Token

## How It Works

The workflow runs every 2 weeks on Sunday at 10am UTC and:

1. Fetches your GitHub activity from the past 2 weeks (commits, PRs, issues, starred repos)
2. If activity is found: Generates a technical blog post reflecting on your work
3. If no activity: Writes a Nietzsche-inspired philosophical reflection on software creation
4. Automatically commits the new post to your repository
5. Rebuilds the blog with the new content

## Manual Trigger

You can also manually trigger the workflow:
1. Go to the **Actions** tab in your repository
2. Select "Auto Generate Blog Post"
3. Click "Run workflow"

## Customization

- **Frequency**: Edit the cron schedule in `.github/workflows/auto-blog-post.yml`
- **AI Model**: Update the model in `apps/homepage/scripts/generate-blog-post.js` (currently uses GPT-4, will use o3 when available)
- **Writing Style**: Modify the prompts in the script to adjust tone and content