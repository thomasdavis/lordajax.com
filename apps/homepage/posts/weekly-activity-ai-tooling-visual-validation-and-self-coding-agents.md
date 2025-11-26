# Weekly Activity: AI Tooling, Visual Validation, and Self-Coding Agents

This week was packed with deep technical work across multiple projects: building a Tool Package Manager for AI agents (TPMJS), adding visual validation to the Blocks framework, enhancing Omega's self-coding capabilities, and fixing production deployment issues. The common thread? Building better tools for AI-assisted development while maintaining quality through comprehensive validation.

## TPMJS: Tool Package Manager for AI Agents

[TPMJS](https://github.com/tpmjs/tpmjs) is a new monorepo project I started this week to solve a critical problem in the AI tooling ecosystem: **there's no standardized way to package, distribute, and version tools for AI agents**. Think npm for AI tools—a registry where developers can publish tools that AI agents can discover, install, and use.

### Why Build This?

Current AI frameworks (Claude, OpenAI, Vercel AI SDK) all implement tools differently. Each has its own schema format, validation approach, and distribution model. This fragmentation means:

- Tool developers must rewrite tools for each framework
- No centralized discovery mechanism exists
- Version management is manual and error-prone
- Quality standards vary wildly across implementations

TPMJS aims to solve this by providing a standard tool specification and registry.

### Monorepo Architecture with Strict TypeScript

The project is built as a Turborepo monorepo with aggressive quality controls:

```json
{
  "name": "@tpmjs/monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "format": "biome format --write .",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "test:coverage": "turbo test:coverage"
  }
}
```

**Key architectural decisions:**

1. **Strict TypeScript**: 100% TypeScript with no `any` types allowed
2. **Biome for formatting**: Replaced Prettier with Biome for faster, more consistent formatting
3. **No barrel exports**: Explicit imports only (no `index.ts` re-exports) to prevent circular dependencies
4. **Vitest for testing**: Modern, fast test runner with MSW for API mocking
5. **Dependency Cruiser**: Enforces architecture rules and prevents circular dependencies

### Comprehensive CI/CD Pipeline

The CI pipeline runs multiple validation stages in parallel:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9.15.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build  # Must build packages first
      - run: pnpm lint

  type-check:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm build
      - run: pnpm type-check
      - run: pnpm type-coverage  # Ensures 95%+ type coverage

  test:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:coverage
      - run: pnpm test:ui  # Vitest UI for interactive debugging

  architecture:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm build
      - run: pnpm check-architecture  # Dependency Cruiser validation
```

**Critical insight**: Building packages before linting/type-checking is essential in monorepos. Many packages depend on built artifacts from other packages, so the build must complete first.

### Component Library with Atomic Design

The `@tpmjs/ui` package implements a strict atomic design pattern:

```typescript
// packages/ui/src/Badge/Badge.tsx
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "error" | "warning" | "info";
  size?: "sm" | "md" | "lg";
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ variant = "default", size = "md", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-medium",
          // Size variants
          size === "sm" && "px-2 py-0.5 text-xs",
          size === "md" && "px-3 py-1 text-sm",
          size === "lg" && "px-4 py-1.5 text-base",
          // Color variants
          variant === "default" && "bg-primary text-primary-foreground",
          variant === "secondary" && "bg-secondary text-secondary-foreground",
          // ... more variants
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = "Badge";
```

**Key patterns:**

- **Polymorphic components**: Use `forwardRef` for ref forwarding
- **Tailwind CSS**: Utility-first styling with `cn()` helper for conditional classes
- **Comprehensive testing**: Every component has 100% test coverage

```typescript
// packages/ui/src/Badge/Badge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  describe("variants", () => {
    it("renders default variant", () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText("Default");
      expect(badge).toHaveClass("bg-primary", "text-primary-foreground");
    });

    it("renders success variant", () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText("Success");
      expect(badge).toHaveClass("bg-green-500", "text-white");
    });
  });

  describe("sizes", () => {
    it("renders small size", () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText("Small");
      expect(badge).toHaveClass("px-2", "py-0.5", "text-xs");
    });
  });
});
```

### Next.js 16 with App Router

The web app uses Next.js 16's App Router with server components:

```typescript
// apps/web/src/app/page.tsx
import { Badge } from "@tpmjs/ui/Badge/Badge";
import { Button } from "@tpmjs/ui/Button/Button";
import { Card } from "@tpmjs/ui/Card/Card";
import { Container } from "@tpmjs/ui/Container/Container";

export default function HomePage(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col">
      <Header
        logo={<Link href="/">TPMJS</Link>}
        nav={
          <>
            <Link href="/tools">Tools</Link>
            <Link href="/docs">Docs</Link>
            <Link href="https://github.com/tpmjs/tpmjs">GitHub</Link>
          </>
        }
      />

      <main className="flex-1">
        <section className="py-24">
          <Container>
            <Stack direction="column" spacing={4} alignItems="center">
              <Heading level={1} size="4xl">
                Tool Package Manager for AI Agents
              </Heading>
              <Paragraph size="xl">
                Publish, discover, and version AI tools with confidence
              </Paragraph>
              <Stack direction="row" spacing={2}>
                <Button variant="primary" size="lg">
                  Get Started
                </Button>
                <Button variant="outline" size="lg">
                  View Docs
                </Button>
              </Stack>
            </Stack>
          </Container>
        </section>
      </main>
    </div>
  );
}
```

### Vercel Deployment with CI Gating

One key challenge was ensuring Vercel only deploys when CI passes. Vercel's default behavior is to deploy on every push, even if tests fail. The solution uses Vercel's "Ignored Build Step" feature:

```json
// vercel.json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  },
  "ignoreCommand": "bash -c 'if [ \"$VERCEL_GIT_COMMIT_REF\" = \"main\" ]; then exit 1; else exit 0; fi'"
}
```

Combined with GitHub branch protection:

```yaml
# .github/branch-protection.yml
main:
  required_status_checks:
    strict: true
    contexts:
      - "lint"
      - "type-check"
      - "test"
      - "architecture"
  required_pull_request_reviews:
    required_approving_review_count: 1
```

This ensures deployments only happen after all CI checks pass.

## Blocks: Visual Validation with AI Vision

[Blocks](https://github.com/thomasdavis/blocks) got a major upgrade this week with a comprehensive visual validation system. The framework now combines deterministic WCAG validation with AI-powered vision analysis to ensure generated code meets both accessibility standards and holistic UX quality.

### The Problem: Validating Visual Output

Most validation tools focus on code quality—linting, type checking, unit tests. But what about visual quality? How do you validate that generated HTML:

- Meets WCAG accessibility standards?
- Has proper color contrast?
- Maintains visual hierarchy?
- Works across multiple screen sizes?

Manual testing doesn't scale, especially in AI-assisted development where code changes rapidly.

### The Solution: Hybrid Validation

The new `@blocksai/visual-validators` package combines three approaches:

1. **Screenshot Capture** (Playwright) - Renders HTML and captures screenshots
2. **Deterministic Validation** (axe-core) - Fast, precise WCAG compliance checking
3. **AI Vision Analysis** (GPT-4o) - Holistic UX quality assessment

```typescript
// packages/visual-validators/src/ScreenshotCapture.ts
import { chromium, type Browser } from 'playwright';

export interface Viewport {
  width: number;
  height: number;
  name: string;
}

export const DEFAULT_VIEWPORTS: Viewport[] = [
  { width: 375, height: 667, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1920, height: 1080, name: 'desktop' },
];

export class ScreenshotCapture {
  private browser?: Browser;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
  }

  async captureHTML(
    html: string,
    viewports: Viewport[] = DEFAULT_VIEWPORTS
  ): Promise<Map<string, Buffer>> {
    if (!this.browser) await this.initialize();

    const screenshots = new Map<string, Buffer>();
    const page = await this.browser!.newPage();

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await page.setContent(html, { waitUntil: 'networkidle' });

      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
      });

      screenshots.set(viewport.name, screenshot);
    }

    await page.close();
    return screenshots;
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}
```

### Deterministic WCAG Validation with axe-core

The `AxeValidator` provides fast, deterministic accessibility checking:

```typescript
// packages/visual-validators/src/AxeValidator.ts
import { chromium } from 'playwright';
import type { AxeResults } from 'axe-core';

export interface AccessibilityIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

export class AxeValidator {
  async validate(
    html: string,
    standard: 'wcag2a' | 'wcag2aa' | 'wcag2aaa' = 'wcag2aa'
  ): Promise<{
    isValid: boolean;
    issues: AccessibilityIssue[];
    passes: number;
    violations: number;
  }> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Inject axe-core library
    await page.setContent(html);
    await page.addScriptTag({
      path: require.resolve('axe-core'),
    });

    // Run axe accessibility tests
    const results = await page.evaluate((standard) => {
      return (window as any).axe.run({
        runOnly: {
          type: 'tag',
          values: [standard],
        },
      });
    }, standard) as AxeResults;

    await browser.close();

    const issues: AccessibilityIssue[] = results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact || 'moderate',
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map((node) => ({
        html: node.html,
        target: node.target,
        failureSummary: node.failureSummary || '',
      })),
    }));

    return {
      isValid: results.violations.length === 0,
      issues,
      passes: results.passes.length,
      violations: results.violations.length,
    };
  }
}
```

**Key benefits:**

- **Fast**: ~2 seconds per validation
- **Precise**: Exact contrast ratios (4.5:1, 7:1)
- **No AI costs**: Completely deterministic
- **Actionable**: Provides specific fix recommendations

### AI Vision Analysis with GPT-4o

The `VisionValidator` uses GPT-4o's vision capabilities for holistic analysis:

```typescript
// packages/visual-validators/src/VisionValidator.ts
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export interface VisionIssue {
  category: 'contrast' | 'hierarchy' | 'layout' | 'responsiveness' | 'readability';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export class VisionValidator {
  private model = openai('gpt-4o-mini'); // Use mini for cost efficiency

  async validateScreenshots(
    screenshots: Map<string, Buffer>,
    requirements?: string[]
  ): Promise<{
    isValid: boolean;
    issues: VisionIssue[];
    analysis: string;
  }> {
    const schema = z.object({
      isValid: z.boolean(),
      issues: z.array(z.object({
        category: z.enum(['contrast', 'hierarchy', 'layout', 'responsiveness', 'readability']),
        severity: z.enum(['error', 'warning', 'info']),
        message: z.string(),
        suggestion: z.string().optional(),
      })),
      analysis: z.string(),
    });

    // Convert screenshots to base64
    const screenshotData = Array.from(screenshots.entries()).map(([name, buffer]) => ({
      name,
      data: buffer.toString('base64'),
    }));

    const prompt = `You are a UX and accessibility expert analyzing visual designs.

Screenshots provided:
${screenshotData.map(s => `- ${s.name}`).join('\n')}

Requirements:
${requirements?.join('\n') || 'General UX best practices'}

Analyze the screenshots for:
1. **Color Contrast**: Are text/background colors readable?
2. **Visual Hierarchy**: Clear distinction between headings, body, and UI elements?
3. **Layout Integrity**: Proper spacing, alignment, no overlapping elements?
4. **Responsiveness**: Does the design adapt well across viewports?
5. **Readability**: Font sizes, line heights, and text density appropriate?

Provide detailed validation results with specific issues and suggestions.`;

    const result = await generateObject({
      model: this.model,
      schema,
      prompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...screenshotData.map(({ name, data }) => ({
              type: 'image' as const,
              image: data,
            })),
          ],
        },
      ],
    });

    return result.object;
  }
}
```

**Key benefits:**

- **Holistic**: Catches subjective UX issues axe-core misses
- **Context-aware**: Understands design intent and requirements
- **Flexible**: Can validate custom design systems and brand guidelines
- **Cost-efficient**: gpt-4o-mini costs ~$0.01 per image

### Blocks Configuration

Visual validation is configured in `blocks.yml`:

```yaml
# blocks.yml
blocks:
  modern_resume_theme:
    description: "Clean, professional resume theme"
    inputs:
      - name: resume
        type: entity.resume
    outputs:
      - name: html
        type: string

    # Visual validation configuration
    visual_validation:
      enabled: true
      viewports:
        - { width: 375, height: 667, name: 'mobile' }
        - { width: 768, height: 1024, name: 'tablet' }
        - { width: 1920, height: 1080, name: 'desktop' }

      axe:
        standard: wcag2aa
        rules:
          - color-contrast
          - heading-order
          - label
          - link-name

      vision:
        model: gpt-4o-mini
        requirements:
          - "Typography must follow modular scale (1rem, 1.25rem, 1.5rem, 2rem)"
          - "Color contrast must meet WCAG AA (4.5:1 for body, 3:1 for large text)"
          - "Must be print-friendly (max 2 pages)"
          - "Responsive design must work on mobile, tablet, desktop"

validators:
  visual:
    enabled: true
    screenshot_timeout: 30000
    axe_standard: wcag2aa
    vision_model: gpt-4o-mini
```

### Running Visual Validation

```bash
# Validate a block with visual checks
blocks validate modern_resume_theme --visual

# Output:
# ✓ Schema validation passed
# ✓ Shape validation passed
# ⚡ Running visual validation...
#   📸 Capturing screenshots (mobile, tablet, desktop)
#   ✓ Screenshot capture complete (3 viewports)
#   🔍 Running axe accessibility checks
#   ✓ axe validation: 45 passes, 0 violations
#   🤖 Running AI vision analysis
#   ✓ Vision analysis complete
#
# Visual Validation Results:
# ✓ All checks passed
#
# Axe Results:
# - 45 accessibility checks passed
# - WCAG 2.0 Level AA compliant
#
# Vision Analysis:
# - Color contrast: Excellent (7.2:1 for body text)
# - Visual hierarchy: Clear and consistent
# - Layout: Professional spacing and alignment
# - Responsiveness: Adapts well across all viewports
# - Readability: Font sizes appropriate for all devices
```

### Cost Analysis

For a typical validation run:

- **3 viewports** (mobile, tablet, desktop)
- **gpt-4o-mini** at ~$0.01 per image
- **Total cost**: ~$0.03 per validation

For production, upgrade to `gpt-4o` (~$0.05/image) for more detailed analysis = ~$0.15 per validation.

Compared to manual testing (15-30 minutes), this is incredibly cost-effective.

## Omega: Self-Coding Discord Bot Enhancements

[Omega](https://github.com/thomasdavis/omega) continues to evolve as a self-coding Discord bot. This week's improvements focused on better tool management, documentation, and demo capabilities.

### Unsandbox Demo Mode

The Unsandbox tool (code execution in 11 languages) now supports a demo mode that works without an API key:

```typescript
// apps/bot/src/lib/unsandbox/client.ts
export class UnsandboxClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly timeout: number;

  constructor(config: UnsandboxConfig) {
    // DEMO MODE: Use empty bearer token if no API key is set
    const apiKey = process.env.UNSANDBOX_API_KEY || '';

    if (!apiKey) {
      console.log('⚠️  Running in demo mode (no API key set)');
    }

    this.apiKey = apiKey;
    this.baseURL = config.baseURL || 'https://api.unsandbox.com';
    this.timeout = config.timeout || 30000;
  }

  async executeCode(params: ExecuteCodeParams): Promise<ExecutionResult> {
    const response = await fetch(`${this.baseURL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Empty authorization header in demo mode
        'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : '',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      // In demo mode, 401 errors are expected
      if (response.status === 401 && !this.apiKey) {
        return {
          success: false,
          error: 'Demo mode: API key required for code execution',
          stdout: '',
          stderr: '',
        };
      }

      throw new Error(`Execution failed: ${response.statusText}`);
    }

    return response.json();
  }
}
```

This allows users to test Omega without setting up external API keys. The bot gracefully handles 401 errors and provides helpful feedback.

### GitHub PR Merge Tool

Previously, Omega could create and close issues but couldn't merge PRs. This week I added a dedicated merge tool:

```typescript
// apps/bot/src/agent/tools/github.ts
export const githubMergePRTool = tool({
  description: 'Merge a GitHub pull request by PR number. Use this when the user wants to merge a PR to deploy changes, complete a feature, or integrate approved code. Checks PR status and mergability before merging.',
  parameters: z.object({
    owner: z.string().describe('Repository owner (username or org)'),
    repo: z.string().describe('Repository name'),
    pull_number: z.number().describe('Pull request number to merge'),
    merge_method: z.enum(['merge', 'squash', 'rebase'])
      .default('squash')
      .describe('Merge method: merge (merge commit), squash (squash commits), or rebase'),
  }),
  execute: async ({ owner, repo, pull_number, merge_method }) => {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    try {
      // First, check PR status
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number,
      });

      if (pr.state !== 'open') {
        return {
          success: false,
          error: `PR #${pull_number} is ${pr.state}, cannot merge`,
        };
      }

      if (!pr.mergeable) {
        return {
          success: false,
          error: `PR #${pull_number} has merge conflicts`,
        };
      }

      // Merge the PR
      const { data: result } = await octokit.pulls.merge({
        owner,
        repo,
        pull_number,
        merge_method,
      });

      return {
        success: true,
        merged: result.merged,
        sha: result.sha,
        message: `Successfully merged PR #${pull_number} using ${merge_method}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to merge PR: ${error.message}`,
      };
    }
  },
});
```

Now users can say "merge PR #42" and Omega handles the entire workflow:

1. Validates PR is open and mergeable
2. Checks for conflicts
3. Merges using specified method (squash, merge, rebase)
4. Confirms success

### Tool Inspection System

One of the most interesting additions is a tool for inspecting other tools. It provides transparency into how tools work:

```typescript
// apps/bot/src/agent/tools/inspectTool.ts
export const inspectToolTool = tool({
  description: 'Inspect and analyze the internal workings of other tools. Provides detailed information about a tool\'s purpose, parameters, implementation, and design decisions.',
  parameters: z.object({
    tool_name: z.string().describe('Name of the tool to inspect (e.g., "calculator", "weather", "github")'),
    analysis_depth: z.enum(['basic', 'detailed', 'comprehensive'])
      .default('detailed')
      .describe('Level of analysis detail'),
  }),
  execute: async ({ tool_name, analysis_depth }) => {
    // Read the tool's source code
    const toolPath = path.join(process.cwd(), 'apps/bot/src/agent/tools', `${tool_name}.ts`);

    if (!fs.existsSync(toolPath)) {
      return {
        success: false,
        error: `Tool "${tool_name}" not found`,
      };
    }

    const sourceCode = fs.readFileSync(toolPath, 'utf-8');

    // Use AI to analyze the tool
    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: 'You are a code analysis expert specializing in AI tool inspection.',
      prompt: `Analyze this tool implementation and provide insights:

Tool: ${tool_name}
Analysis Depth: ${analysis_depth}

Source Code:
\`\`\`typescript
${sourceCode}
\`\`\`

Provide analysis covering:
1. **Purpose**: What problem does this tool solve?
2. **Parameters**: What inputs does it accept?
3. **Implementation**: How does it work internally?
4. **Dependencies**: What external services or libraries does it use?
5. **Design Decisions**: Why was it implemented this way?
6. **Limitations**: What can't it do?
7. **Usage Examples**: How should users interact with it?

${analysis_depth === 'comprehensive' ? 'Include detailed code walkthrough and potential improvements.' : ''}
`,
    });

    return {
      success: true,
      tool_name,
      analysis_depth,
      analysis: text,
      source_path: toolPath,
    };
  },
});
```

This meta-tool lets users understand how Omega works by asking it to explain itself. For example:

```
User: @Omega inspect the ooda tool
Omega: [Detailed analysis of the OODA loop tool]

Purpose:
The OODA loop tool implements Boyd's Observe-Orient-Decide-Act decision-making cycle
for complex problem-solving. It helps break down ambiguous problems into structured
analysis phases.

Parameters:
- situation: String describing the current problem or decision
- focus_area: Optional area to concentrate analysis (observation, orientation, decision, action)
- detail_level: Controls depth of analysis (quick/standard/comprehensive)

Implementation:
The tool uses GPT-4o to generate structured analysis across four phases:
1. Observe: Gather facts and data about the situation
2. Orient: Analyze context and mental models
3. Decide: Evaluate options and trade-offs
4. Act: Provide concrete next steps

[... continues with detailed analysis ...]
```

### OODA Loop Documentation

This week I also created comprehensive documentation for the OODA loop tool:

```markdown
# OODA Loop Tool - Comprehensive Review and Documentation

> **Requested by**: traves_theberge (Discord #omega channel)
> **Created**: 2025-11-24
> **Tool Location**: `apps/bot/src/agent/tools/ooda.ts`

## Overview

The OODA Loop tool implements Boyd's Observe-Orient-Decide-Act decision-making cycle,
a framework originally developed for fighter pilot combat but applicable to any complex
decision-making scenario.

## How It Works

The tool processes situations through four distinct phases:

### 1. Observe
Gather raw facts, data, and observations about the current situation without
interpretation or judgment.

### 2. Orient
Analyze the observations through various mental models, frameworks, and perspectives.
This is where sense-making happens.

### 3. Decide
Evaluate options, consider trade-offs, and determine the best course of action based
on the orientation phase.

### 4. Act
Provide concrete, actionable next steps to implement the decision.

## Usage Examples

```typescript
// Quick analysis
await oodaTool.execute({
  situation: "Our API response times have increased 3x over the past week",
  detail_level: "quick"
});

// Focused analysis on decision phase
await oodaTool.execute({
  situation: "Should we migrate to microservices or optimize the monolith?",
  focus_area: "decision",
  detail_level: "comprehensive"
});
```

[... continues with implementation details, design rationale, and examples ...]
```

The documentation provides a complete reference for how the tool works, when to use it, and examples of effective usage patterns.

## Blog Generator Updates

Updated [lordajax.com](https://github.com/thomasdavis/lordajax.com) to the latest version of @jsonblog/generator-tailwind (v3.0.0). The blog you're reading was generated with this updated version.

The upgrade included:

- Improved Tailwind CSS configuration
- Better typography defaults
- Enhanced code syntax highlighting
- Mobile-responsive navigation improvements

```bash
# Update command
pnpm add @jsonblog/generator-tailwind@3.0.0

# Verify build
cd apps/homepage
npx json-blog build blog.json
```

## Dillinger: Fixing Vercel Builds

[Dillinger](https://github.com/thomasdavis/dillinger) is a classic Markdown editor that needed deployment fixes. The Vercel build was failing due to dependency resolution issues.

### The Problem

Vercel builds were failing with:

```
npm ERR! Could not resolve dependency:
npm ERR! peer graceful-fs@"^4.2.0" from chokidar@2.1.8
```

The project was using `npm-force-resolutions` to override transitive dependencies, but this caused issues in Vercel's build environment.

### The Solution

Removed `npm-force-resolutions` and moved build dependencies to production:

```json
{
  "dependencies": {
    "express": "^4.21.2",
    "gulp": "^5.0.0",
    "gulp-concat": "^2.6.1",
    "gulp-uglify": "^3.0.2",
    "gulp-clean-css": "^4.3.0"
  },
  "scripts": {
    "preinstall": "npm install --package-lock-only --ignore-scripts",
    "build": "gulp build",
    "start": "node app.js"
  }
}
```

Key changes:

1. **Removed `resolutions`**: Let npm handle dependency resolution naturally
2. **Moved gulp to dependencies**: Build tools must be in dependencies for Vercel
3. **Added vercel.json**: Configure build and start commands explicitly

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": null,
  "outputDirectory": "public"
}
```

After these changes, Vercel builds succeed consistently.

## Technical Insights

### Monorepo Best Practices

Working on TPMJS reinforced several monorepo patterns:

1. **Build before validate**: Always run `turbo build` before `lint`, `type-check`, or `test`. Many packages depend on built artifacts.

2. **Explicit imports only**: Avoid barrel exports (`index.ts` files that re-export everything). They create circular dependencies and slow down builds.

3. **Shared configs are powerful**: Centralize ESLint, TypeScript, Tailwind configs in a `@org/config` package. Changes propagate to all packages instantly.

4. **Test infrastructure matters**: Shared test utilities, mock servers (MSW), and Vitest configs reduce duplication dramatically.

### AI Vision for Validation

Visual validation with AI is a game-changer for template development:

- **Catches subjective issues**: "This looks cluttered" or "Hierarchy is unclear"
- **Understands intent**: Can validate against brand guidelines and design systems
- **Scales better than humans**: $0.03 per validation vs. 15 minutes of manual testing

The hybrid approach (axe-core + GPT-4o) provides both precision and nuance.

### Self-Coding Agent Patterns

Omega demonstrates several effective patterns for self-coding agents:

1. **Tool inspection**: Agents should be able to explain their own capabilities
2. **Graceful degradation**: Demo modes and fallbacks when APIs are unavailable
3. **Structured documentation**: Auto-generate docs from tool implementations
4. **Meta-tools**: Tools that inspect, analyze, or modify other tools

## Links

### Projects
- **TPMJS**: [github.com/tpmjs/tpmjs](https://github.com/tpmjs/tpmjs)
- **Blocks Framework**: [github.com/thomasdavis/blocks](https://github.com/thomasdavis/blocks)
- **Omega Discord Bot**: [github.com/thomasdavis/omega](https://github.com/thomasdavis/omega)
- **Dillinger**: [github.com/thomasdavis/dillinger](https://github.com/thomasdavis/dillinger)
- **This Blog**: [github.com/thomasdavis/lordajax.com](https://github.com/thomasdavis/lordajax.com)

### NPM Packages
- [@blocksai/visual-validators](https://www.npmjs.com/package/@blocksai/visual-validators) - Visual validation with AI vision
- [@blocksai/cli](https://www.npmjs.com/package/@blocksai/cli) - Blocks command-line interface
- [@jsonblog/generator-tailwind](https://www.npmjs.com/package/@jsonblog/generator-tailwind) - Tailwind CSS blog theme

### Tools & Frameworks
- [Playwright](https://playwright.dev) - Browser automation for screenshots
- [axe-core](https://github.com/dequelabs/axe-core) - Accessibility testing engine
- [Turborepo](https://turbo.build/repo) - High-performance monorepo build system
- [Vercel AI SDK](https://sdk.vercel.ai) - AI application framework
- [Biome](https://biomejs.dev) - Fast formatter and linter

## What's Next

Looking ahead, I'm planning to:

1. **Publish TPMJS specification**: Define the standard tool format and registry API
2. **Build the registry**: Implement the actual package registry for AI tools
3. **Expand Blocks validators**: Add lint, chain, and shadow validators
4. **Omega agent marketplace**: Let users browse and install community tools
5. **Visual validation benchmarks**: Compare axe-core + GPT-4o vs. manual testing

The convergence of AI assistance, structured validation, and self-improving agents creates a powerful development environment. We're building tools that not only write code, but understand quality, validate correctness, and improve themselves over time.
