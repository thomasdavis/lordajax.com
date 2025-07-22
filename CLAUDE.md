# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a monorepo containing a personal website/blog (homepage) and an AI/ML playground application. It uses Turborepo with pnpm workspaces for dependency management.

## Commands

### Development
```bash
# Install dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Run specific app
pnpm --filter homepage dev
pnpm --filter playground dev
```

### Build
```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter homepage build
pnpm --filter playground build
```

### Code Quality
```bash
# Lint all packages
pnpm lint

# Format code with Prettier
pnpm format
```

### Homepage App Commands
```bash
# Generate static site from blog.json
cd apps/homepage && npx json-blog

# Preview generated site
cd apps/homepage && npx json-blog --serve
```

## Architecture

### Monorepo Structure
- **apps/**: Contains individual applications
  - **homepage/**: Static blog site using JSON Blog CLI
  - **playground/**: Next.js app for AI/ML experiments
- **packages/**: Shared packages
  - **eslint-config-custom/**: Shared ESLint configuration
  - **tsconfig/**: Shared TypeScript configurations
  - **ui/**: Shared React component library

### Homepage App
- Uses JSON Blog CLI (v2.15.0) to generate static sites
- Configuration in `apps/homepage/blog.json` defines:
  - Site metadata (title, author, description)
  - Navigation pages
  - Blog posts (local markdown or remote URLs)
- Posts are in `apps/homepage/posts/` as markdown files
- Generated HTML output goes to `apps/homepage/docs/`
- To add a new blog post: Add entry to blog.json and create corresponding markdown file

### Playground App
- Next.js application with AI/ML integrations:
  - OpenAI API integration
  - Pinecone vector database
  - TensorFlow.js for ML operations
  - Prisma ORM (though schema not present)
- Custom URL rewrites in next.config.js for different AI endpoints
- Server-side rendering with styled-components
- Environment variables needed: `OPENAI_API_KEY`

### Key Dependencies
- **Build**: Turborepo, pnpm workspaces
- **Frontend**: React, Next.js, styled-components
- **AI/ML**: OpenAI, Pinecone, TensorFlow.js
- **Database**: Prisma (configuration needed)
- **Blog**: JSON Blog CLI

## Important Notes

1. This is a monorepo - always use pnpm and filter flags for package-specific operations
2. The homepage app generates static files - run the build command after blog changes
3. Playground app requires OpenAI API key in environment variables
4. No test suite exists - manual testing required
5. Use Turborepo for parallel builds and caching benefits