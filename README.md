# Lord Ajax's Personal Website & Blog

A modern, automated personal website and blog built with a monorepo architecture, featuring intelligent blog post generation powered by AI.

[![Deploy](https://github.com/thomasdavis/lordajax.com/actions/workflows/auto-blog-post.yml/badge.svg)](https://github.com/thomasdavis/lordajax.com/actions/workflows/auto-blog-post.yml)

## 🚀 Features

- **Intelligent Blog Generation**: Automatically creates technical blog posts based on GitHub activity using GPT-4o
- **Static Site Generation**: Fast, SEO-friendly blog using JSON Blog CLI
- **AI/ML Playground**: Experimental workspace with OpenAI, Pinecone, and TensorFlow.js integrations
- **Automated Content**: GitHub Actions generate new blog posts every 2 weeks
- **Monorepo Architecture**: Turborepo with pnpm workspaces for optimal development experience

## 📁 Project Structure

```
lordajax.com/
├── .github/workflows/     # GitHub Actions for automated blog generation
├── apps/
│   ├── homepage/          # Personal blog/website (JSON Blog CLI)
│   │   ├── blog.json      # Blog configuration and post definitions
│   │   ├── docs/          # Generated static HTML files
│   │   ├── pages/         # Static pages (About, Projects)
│   │   ├── posts/         # Blog posts in Markdown
│   │   └── scripts/       # AI-powered blog post generation
│   └── playground/        # Next.js AI/ML experimentation app
├── packages/
│   ├── eslint-config-custom/  # Shared ESLint configuration
│   ├── tsconfig/              # Shared TypeScript configurations
│   └── ui/                    # Shared UI component library
├── CLAUDE.md              # Documentation for Claude Code AI assistant
└── turbo.json             # Turborepo pipeline configuration
```

## 🤖 Intelligent Blog Generation

The standout feature of this project is its AI-powered blog post generation system that:

### **Deep Repository Analysis**
- Fetches README files, package.json, and project structure from GitHub
- Analyzes commit diffs and code changes over the past 2 weeks
- Understands project context and whether it's the first post about a project

### **Smart Content Creation**
- Detects new projects and writes introduction posts with installation guides
- For existing projects, focuses on recent updates and improvements
- Includes actual code snippets from commits, not hypothetical examples
- Automatically generates relevant links (GitHub, npm, documentation)

### **Technical Focus**
- Written for developers by developers
- No philosophical content - pure technical value
- Includes architecture decisions, dependencies, and usage examples
- Shows CLI commands, API endpoints, and implementation details

### **Automation**
- Runs every 2 weeks via GitHub Actions
- Falls back to Nietzsche-inspired content if no GitHub activity
- Automatically commits and builds the updated blog

## 🛠 Technology Stack

### **Core Technologies**
- **Turborepo**: Monorepo build system with intelligent caching
- **pnpm**: Fast, disk space efficient package manager
- **JSON Blog CLI**: Static site generator with single JSON configuration

### **Homepage App**
- **JSON Blog CLI v2.3.1**: Custom blog engine
- **Vercel AI SDK**: GPT-4o integration for content generation
- **@octokit/rest**: GitHub API integration for activity analysis
- **Markdown**: Content format for posts and pages

### **Playground App**
- **Next.js 14**: React framework with SSR
- **TypeScript**: Type-safe development
- **OpenAI**: Large language model integration
- **Pinecone**: Vector database for embeddings
- **TensorFlow.js**: Machine learning in JavaScript
- **Prisma**: Database ORM (schema pending)
- **Styled Components**: CSS-in-JS styling

## 🚀 Getting Started

### **Prerequisites**
- Node.js 22.x or higher
- pnpm 8.x or higher

### **Installation**
```bash
# Clone the repository
git clone https://github.com/thomasdavis/lordajax.com.git
cd lordajax.com

# Install dependencies
pnpm install
```

### **Development**
```bash
# Run all apps in development mode
pnpm dev

# Run specific app
pnpm --filter homepage dev
pnpm --filter playground dev

# Build all apps
pnpm build

# Lint and format
pnpm lint
pnpm format
```

### **Blog Management**
```bash
# Generate a new blog post manually
cd apps/homepage
npm run generate-post

# Preview the blog locally
npm run dev

# Build static site
npm run build
```

## ⚙ Configuration

### **Environment Variables**
Create a `.env` file in the project root:
```bash
# Required for blog post generation
OPENAI_API_KEY=your_openai_api_key_here
GH_ACCESS_TOKEN=your_github_personal_access_token

# Optional for playground app
PINECONE_API_KEY=your_pinecone_api_key
```

### **GitHub Secrets**
For automated blog generation, configure these repository secrets:
- `OPENAI_API_KEY`: OpenAI API key for content generation
- `GH_ACCESS_TOKEN`: GitHub Personal Access Token with repo access

### **Blog Configuration**
Edit `apps/homepage/blog.json` to customize:
- Site metadata (title, description)
- Navigation pages
- Blog post entries
- Author information

## 🤖 AI Integration Details

### **Blog Post Generation Process**
1. **Activity Analysis**: Scans GitHub events from past 2 weeks
2. **Repository Research**: Fetches detailed project information
3. **Context Detection**: Determines if writing about project for first time
4. **Content Generation**: Uses GPT-4o to create technical blog post
5. **Automatic Publishing**: Commits new post and rebuilds site

### **Content Quality Features**
- Real code snippets from actual commits
- Installation and usage instructions
- Technical architecture explanations
- Relevant links to GitHub, npm, documentation
- Professional formatting with proper markdown structure

## 📝 Blog Post Examples

The AI system generates posts like:
- **"Introducing llm-benchmark"**: Complete project introduction with installation guide
- **"Enhancements in llm-benchmark"**: Update posts focusing on recent changes
- **Technical deep-dives**: Architecture decisions and implementation details

Each post includes:
- Project overview and purpose
- Code examples from actual commits
- Installation instructions
- Usage examples and CLI commands
- Links to repositories and documentation

## 🔧 Development Conventions

### **AI SDK Usage**
- Always use Vercel AI SDK, never OpenAI SDK directly
- Use GPT-4o model for all AI generation tasks
- Research latest documentation when implementing new features

### **Code Quality**
- TypeScript preferred for type safety
- Follow existing patterns and conventions
- Use Turborepo for parallel builds and caching

### **Monorepo Operations**
- Use `pnpm --filter <app>` for app-specific operations
- Leverage Turborepo's intelligent caching
- Maintain shared configurations in packages/

## 📈 Performance & SEO

- **Static Site Generation**: Fast loading times and SEO optimization
- **Intelligent Caching**: Turborepo caches builds and operations
- **Minimal Dependencies**: Homepage app has zero runtime dependencies
- **Modern Architecture**: Leverages modern JavaScript tooling

## 🤝 Contributing

This is a personal website, but feel free to:
- Report issues with the automated blog generation
- Suggest improvements to the AI content generation
- Share feedback on the technical architecture

## 📄 License

MIT License - feel free to use this architecture for your own personal website.

## 🔗 Links

- **Live Site**: [lordajax.com](https://lordajax.com)
- **GitHub**: [thomasdavis/lordajax.com](https://github.com/thomasdavis/lordajax.com)
- **Twitter**: [@ajaxdavis](https://twitter.com/ajaxdavis)
- **JSON Resume**: [registry.jsonresume.org/thomasdavis](https://registry.jsonresume.org/thomasdavis)

---

**Built with ❤️ by Thomas Davis (Lord Ajax)**  
*Automated blog posts powered by GPT-4o and GitHub Actions*