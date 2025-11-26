# Weekly Activity: Visual Validation, Omega Evolution, and GitHub Automation

This week was focused on three major themes: building a comprehensive visual validation system for Blocks, enhancing the Omega self-coding Discord bot with new capabilities, and improving GitHub automation workflows. Let's dive into the technical details of each project.

## Visual Validation System for Blocks

The biggest technical achievement this week was implementing a hybrid visual validation system for [Blocks](https://github.com/thomasdavis/blocks)—my domain-driven validation framework for AI development. The new system combines deterministic WCAG validation with AI-powered visual analysis.

### The Problem

When building template systems (like JSON Resume themes, blog templates, or landing pages), you need to validate more than just functional correctness. Visual quality matters: color contrast, typography hierarchy, responsive design, and overall aesthetic coherence. Traditional validation can't catch these issues, and manual review doesn't scale.

### The Solution: Hybrid Validation

I built a three-component system that validates visual semantics at multiple levels:

#### 1. Screenshot Capture with Playwright

First, we render HTML templates and capture screenshots across multiple viewports:

```typescript
import { chromium, Browser, Page } from 'playwright';

export class ScreenshotCapture {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async captureScreenshot(params: {
    html: string;
    viewport: { width: number; height: number };
  }): Promise<Buffer> {
    if (!this.browser) await this.initialize();

    const page = await this.browser!.newPage({
      viewport: params.viewport,
    });

    await page.setContent(params.html, {
      waitUntil: 'networkidle',
    });

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
    });

    await page.close();
    return screenshot;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
```

This allows us to test templates across mobile, tablet, and desktop viewports automatically.

#### 2. Deterministic WCAG Validation with axe-core

For accessibility compliance, I integrated [axe-core](https://github.com/dequelabs/axe-core)—the industry standard for automated accessibility testing:

```typescript
import { AxePuppeteer } from '@axe-core/puppeteer';
import puppeteer from 'puppeteer';

export class AxeValidator {
  async validateAccessibility(html: string): Promise<{
    passes: number;
    violations: Array<{
      id: string;
      impact: string;
      description: string;
      nodes: Array<{
        html: string;
        target: string[];
      }>;
    }>;
  }> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html);

    // Run axe accessibility tests
    const results = await new AxePuppeteer(page)
      .options({ runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })
      .analyze();

    await browser.close();

    return {
      passes: results.passes.length,
      violations: results.violations.map(v => ({
        id: v.id,
        impact: v.impact || 'unknown',
        description: v.description,
        nodes: v.nodes.map(n => ({
          html: n.html,
          target: n.target,
        })),
      })),
    };
  }
}
```

axe-core validates:
- Color contrast ratios (4.5:1 for body text, 7:1 for AAA compliance)
- Proper heading hierarchy
- Alt text for images
- Form label associations
- Keyboard navigation support

The key advantage? It's **deterministic and fast** (~2 seconds), with zero AI costs.

#### 3. AI-Powered Vision Analysis with GPT-4o

For holistic visual quality analysis, I extended the AIProvider with vision capabilities:

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export class AIProvider {
  async validateVisualSemantics(params: {
    screenshots: Array<{
      viewport: string;
      imageBase64: string;
    }>;
    blockDefinition: string;
    requirements: string[];
  }): Promise<{
    isValid: boolean;
    issues: Array<{
      message: string;
      severity: 'error' | 'warning';
      viewport?: string;
    }>;
  }> {
    const schema = z.object({
      isValid: z.boolean(),
      issues: z.array(z.object({
        message: z.string(),
        severity: z.enum(['error', 'warning']),
        viewport: z.string().optional(),
      })),
    });

    const prompt = `You are validating visual design quality for a web template.

Block Definition:
${params.blockDefinition}

Requirements:
${params.requirements.join('\n')}

Analyze the screenshots and validate:
1. Color contrast and readability
2. Typography hierarchy and consistency
3. Layout integrity and alignment
4. Responsive design across viewports
5. Visual hierarchy and information flow
6. Overall aesthetic quality

Return validation results with specific issues found.`;

    const result = await generateObject({
      model: openai('gpt-4o'),
      schema,
      prompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...params.screenshots.map(s => ({
              type: 'image' as const,
              image: s.imageBase64,
            })),
          ],
        },
      ],
    });

    return result.object;
  }
}
```

The AI vision model can catch subjective issues that deterministic tools miss:
- Typography that's technically accessible but poorly sized for readability
- Color palettes that meet contrast ratios but clash aesthetically
- Layouts that are functionally correct but visually unbalanced
- Responsive breakpoints that create awkward text wrapping

### Integrating into Blocks

The visual validation system integrates seamlessly into the Blocks workflow through schema extensions:

```yaml
# blocks.yml
blocks:
  modern_professional_theme:
    description: "Clean, professional resume theme"
    inputs:
      - name: resume
        type: entity.resume
    outputs:
      - name: html
        type: string
    visual_validation:
      viewports:
        - name: mobile
          width: 375
          height: 667
        - name: tablet
          width: 768
          height: 1024
        - name: desktop
          width: 1920
          height: 1080
      rules:
        - "Must meet WCAG AA standards (4.5:1 contrast ratio)"
        - "Typography must follow modular scale"
        - "Must be print-friendly (max 2 pages)"
        - "Must work across all viewports"

validators:
  visual:
    enabled: true
    use_ai: true
    ai_model: "gpt-4o-mini"  # Cost-effective for development
```

When you run `blocks validate modern_professional_theme`, the system:
1. Captures screenshots across all defined viewports
2. Runs axe-core accessibility tests (fast, deterministic)
3. Analyzes with GPT-4o vision (holistic, semantic)
4. Reports all issues with severity levels

### Cost Optimization

Visual validation with AI can get expensive quickly. Here's my approach:

- **Development**: Use `gpt-4o-mini` (~$0.01 per image)
- **Production/CI**: Upgrade to `gpt-4o` (~$0.05 per image)
- **Hybrid approach**: Always run axe-core (free), only use AI for final validation

For a typical theme with 3 viewports, one validation run costs ~$0.03 in development—negligible compared to the time saved catching visual regressions.

### Published Package

The visual validation system is now available as an npm package:

```bash
npm install @blocksai/visual-validators
```

Full documentation: [blocks.thomasdavis.dev/validators/visual-validation](https://blocks.thomasdavis.dev)

## Omega: Self-Coding Discord Bot Evolution

[Omega](https://github.com/thomasdavis/omega) continues to evolve through conversations. This week saw several significant enhancements to the bot's capabilities and development workflow.

### Tool Inspection Capabilities

One fascinating addition was the `inspectTool` feature—Omega can now introspect and explain its own tools. When a user asks "How does the artifact tool work?", Omega reads the source code and uses AI to analyze and explain it:

```typescript
// apps/bot/src/agent/tools/inspectTool.ts
import { tool } from 'ai';
import { z } from 'zod';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const inspectToolTool = tool({
  description: 'Inspect and analyze the internal workings of another tool. Provides transparency about tool capabilities, implementation, and design decisions.',
  parameters: z.object({
    toolName: z.string().describe('Name of the tool to inspect'),
    aspect: z.enum(['overview', 'implementation', 'parameters', 'examples'])
      .optional()
      .describe('Specific aspect to focus on'),
  }),
  execute: async ({ toolName, aspect = 'overview' }) => {
    // Read the tool's source code
    const toolPath = join(process.cwd(), 'apps/bot/src/agent/tools', `${toolName}.ts`);
    const sourceCode = await readFile(toolPath, 'utf-8');

    // Analyze with AI
    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: 'You are a code analysis assistant specialized in explaining tool implementations.',
      prompt: `Analyze this tool and explain its ${aspect}:

\`\`\`typescript
${sourceCode}
\`\`\`

Provide a clear, comprehensive explanation suitable for developers.`,
    });

    return text;
  },
});
```

This self-documenting capability makes Omega more transparent and helps users understand what each tool does under the hood.

### GitHub PR Merge Tool

Previously, when users said "merge this PR," Omega would close it instead. I added a proper `githubMergePRTool` that actually merges pull requests:

```typescript
// apps/bot/src/agent/tools/github.ts
export const githubMergePRTool = tool({
  description: 'Merge a GitHub pull request by PR number. Use this when the user wants to merge a PR to deploy changes, complete a feature, or integrate approved code.',
  parameters: z.object({
    owner: z.string().describe('Repository owner/org'),
    repo: z.string().describe('Repository name'),
    pull_number: z.number().describe('Pull request number'),
    merge_method: z.enum(['merge', 'squash', 'rebase'])
      .optional()
      .default('squash')
      .describe('Merge method to use'),
  }),
  execute: async ({ owner, repo, pull_number, merge_method }) => {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    try {
      // Check if PR is mergeable
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number,
      });

      if (!pr.mergeable) {
        return {
          success: false,
          message: 'PR has conflicts and cannot be merged automatically',
        };
      }

      // Merge the PR
      const { data: merge } = await octokit.pulls.merge({
        owner,
        repo,
        pull_number,
        merge_method,
      });

      return {
        success: true,
        sha: merge.sha,
        message: `Successfully merged PR #${pull_number}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to merge: ${error.message}`,
      };
    }
  },
});
```

Now Omega correctly interprets user intent and performs the right action.

### Unsandbox Code Execution Improvements

Omega has a code execution tool powered by [Unsandbox](https://unsandbox.io)—a service that runs untrusted code in secure sandboxes. This week I added demonstration mode support:

```typescript
// apps/bot/src/lib/unsandbox/client.ts
export class UnsandboxClient {
  constructor(config: UnsandboxConfig) {
    // DEMO MODE: Use empty bearer token if no API key is set
    const apiKey = process.env.UNSANDBOX_API_KEY || '';

    this.config = {
      baseURL: config.baseURL || 'https://api.unsandbox.io',
      apiKey,
      timeout: config.timeout || 30000,
    };
  }

  async executeCode(params: {
    language: string;
    code: string;
    timeout?: number;
  }): Promise<ExecutionResult> {
    // In demo mode (empty API key), Unsandbox allows limited free executions
    const response = await fetch(`${this.config.baseURL}/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: params.language,
        code: params.code,
        timeout: params.timeout || 10000,
      }),
    });

    if (response.status === 401 && !this.config.apiKey) {
      return {
        success: false,
        error: 'Demo mode quota exceeded. Set UNSANDBOX_API_KEY for unlimited usage.',
      };
    }

    const result = await response.json();
    return result;
  }
}
```

This allows people to try Omega without setting up API keys, with a clear upgrade path when they hit demo limits.

### Blog Post UI Improvements

Omega can create blog posts and render them with proper markdown formatting. I significantly improved the renderer this week:

```typescript
// apps/bot/src/lib/blogRenderer.ts
function markdownToHTML(markdown: string, ttsEnabled: boolean): string {
  let html = markdown;

  // Blockquotes (must be processed before paragraphs)
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Headers with proper hierarchy
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>');

  // Code blocks with syntax highlighting classes
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g,
    (_, lang, code) => `<pre class="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code class="language-${lang || 'plaintext'}">${escapeHtml(code.trim())}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g,
    '<code class="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
  );

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-600 hover:text-blue-800 underline">$1</a>'
  );

  // Lists
  html = html.replace(/^\* (.*$)/gim, '<li class="ml-6 list-disc">$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li class="ml-6 list-disc">$1</li>');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, match =>
    `<ul class="my-4 space-y-2">${match}</ul>`
  );

  // Paragraphs
  html = html.split('\n\n').map(para => {
    if (!para.trim() || para.startsWith('<')) return para;
    return `<p class="my-4 leading-relaxed">${para}</p>`;
  }).join('\n\n');

  return html;
}
```

The renderer now properly handles:
- Nested markdown elements (blockquotes, lists, code blocks)
- Tailwind CSS classes for responsive design
- Syntax highlighting hooks for code blocks
- Proper semantic HTML structure

## GitHub Workflow Automation Improvements

This week I made several improvements to the GitHub automation workflows that power this blog and the Omega development process.

### Filtering Private Repositories

The weekly activity script was including private repositories in blog posts, which could leak sensitive information. I added filtering:

```javascript
// apps/homepage/scripts/create-activity-issue.js
async function fetchRepositoryDetails(owner, repo) {
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });

    // Skip private repositories
    if (repoData.private) {
      console.log(`Skipping private repository: ${owner}/${repo}`);
      return null;
    }

    // Fetch package.json to determine package name
    let packageName = repo;
    try {
      const { data: packageJson } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json',
      });

      const content = Buffer.from(packageJson.content, 'base64').toString();
      const parsed = JSON.parse(content);
      packageName = parsed.name || repo;
    } catch (e) {
      // No package.json, use repo name
    }

    return {
      url: repoData.html_url,
      description: repoData.description,
      language: repoData.language,
      stars: repoData.stargazers_count,
      readme: await fetchReadmeExcerpt(owner, repo),
      packageName,
    };
  } catch (error) {
    console.error(`Error fetching details for ${owner}/${repo}:`, error.message);
    return null;
  }
}
```

Now only public repositories appear in weekly activity posts.

### Auto-Merge Workflow Enhancements

I improved the auto-merge workflow to handle CI checks more reliably:

```yaml
# .github/workflows/auto-merge-claude.yml
name: Auto-Merge Claude PRs

on:
  workflow_run:
    workflows: ["CI Checks"]
    types:
      - completed

jobs:
  auto-merge:
    name: Enable Auto-Merge After CI Passes
    runs-on: ubuntu-latest
    if: |
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.event == 'pull_request'

    steps:
      - name: Get PR number
        id: pr
        run: |
          PR_NUMBER=$(gh pr list --head ${{ github.event.workflow_run.head_branch }} --json number --jq '.[0].number')
          echo "number=$PR_NUMBER" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Check PR labels
        id: labels
        run: |
          LABELS=$(gh pr view ${{ steps.pr.outputs.number }} --json labels --jq '.labels[].name')
          if echo "$LABELS" | grep -q "activity-post"; then
            echo "is_activity_post=true" >> $GITHUB_OUTPUT
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Enable auto-merge
        if: steps.labels.outputs.is_activity_post == 'true'
        run: |
          gh pr merge ${{ steps.pr.outputs.number }} --auto --squash
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The key improvement: instead of triggering on PR creation, it triggers when CI checks complete. This prevents race conditions where auto-merge is enabled before checks finish.

## New Project: tpmjs

I started a new project called [tpmjs](https://github.com/tpmjs/tpmjs)—a "Tool Package Manager" for AI agents. The concept is to create a standardized way to distribute, install, and evaluate AI tools (similar to how npm works for JavaScript packages).

The initial planning created three foundation issues:

1. **Build a specification** - Define the schema for tool packages (metadata, dependencies, versioning)
2. **Build a registry or mirror npm** - Decide between a new registry or leveraging npm's infrastructure
3. **Add example model comparisons** - Create benchmark evaluations showing how different models perform with the same tools

This is still in the early stages, but the goal is to solve the distribution problem for AI tools. Right now, every AI agent implements tools from scratch. With tpmjs, you could do:

```bash
tpm install @tools/web-search
tpm install @tools/code-execution
tpm install @tools/github-api
```

And have standardized, tested, evaluated tools ready to use.

## Other Updates

### Blocks Animation Fix

The Blocks landing page had a typing animation for slogans that was skipping the first character. Fixed it with a substring approach:

```typescript
// Immediately set first character
setDisplayedText(currentSlogan.substring(0, 1));
setCharIndex(1);

// Start typing remaining characters
const typingInterval = setInterval(() => {
  setCharIndex((prevIndex) => {
    if (prevIndex < currentSlogan.length) {
      setDisplayedText(currentSlogan.substring(0, prevIndex + 1));
      return prevIndex + 1;
    } else {
      clearInterval(typingInterval);
      setTimeout(() => nextSlogan(), 2000);
      return prevIndex;
    }
  });
}, 40);
```

Now the full text displays correctly: "Blocks" instead of "locks".

### Documentation Expansion

Added comprehensive documentation for the Blocks visual validation system and created two detailed example case studies:

1. **JSON Resume Themes** - Shows how to validate resume template rendering with semantic HTML, WCAG accessibility, and responsive design
2. **Blog Content Validator** - Demonstrates AI-powered content quality validation for humor, tone, and engagement

Documentation deployed at [blocks.thomasdavis.dev](https://blocks.thomasdavis.dev).

## Reflections

This week demonstrated the power of combining different validation approaches:

**Deterministic + AI = Best of Both Worlds**

- Deterministic tools (axe-core) catch objective issues quickly and cheaply
- AI vision models catch subjective quality problems that rules can't encode
- Together, they provide comprehensive coverage

**Self-Documenting Systems**

- Tools that can explain themselves (inspectTool) reduce onboarding friction
- When code can analyze and document its own behavior, it stays maintainable
- AI agents benefit enormously from structured introspection capabilities

**Automation Requires Structure**

- The GitHub workflows only work because data is structured (issues, labels, PRs)
- Blocks validation only works because domains are explicitly modeled
- AI code generation only works when constraints are formalized

The pattern I'm seeing: **explicit semantics enable automated validation, which enables confident AI code generation**. The more structure you add upfront (domain models, schemas, explicit requirements), the more automation becomes reliable.

## Links

### Projects
- **Blocks Framework**: [github.com/thomasdavis/blocks](https://github.com/thomasdavis/blocks) | [Documentation](https://blocks.thomasdavis.dev)
- **Omega Discord Bot**: [github.com/thomasdavis/omega](https://github.com/thomasdavis/omega)
- **tpmjs**: [github.com/tpmjs/tpmjs](https://github.com/tpmjs/tpmjs)
- **This Blog**: [github.com/thomasdavis/lordajax.com](https://github.com/thomasdavis/lordajax.com)

### NPM Packages
- [@blocksai/cli](https://www.npmjs.com/package/@blocksai/cli) - Blocks CLI
- [@blocksai/ai](https://www.npmjs.com/package/@blocksai/ai) - AI validators
- [@blocksai/visual-validators](https://www.npmjs.com/package/@blocksai/visual-validators) - Visual validation system

### Tools & Services
- [Playwright](https://playwright.dev) - Browser automation for screenshots
- [axe-core](https://github.com/dequelabs/axe-core) - Accessibility testing
- [Unsandbox](https://unsandbox.io) - Secure code execution
- [Vercel AI SDK](https://sdk.vercel.ai) - AI application framework
- [Claude Code](https://claude.ai/code) - AI pair programming

This post was generated by Claude Code based on structured GitHub activity data and written following explicit format requirements.
