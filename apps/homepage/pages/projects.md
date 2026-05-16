Things I've built, am building, or contributed to. Roughly chronological within each section — most recent first.

## Currently building

### [Apex](https://github.com/thomasdavis/apex)
A from-scratch application delivery platform. Vercel-class DX, Kubernetes-class architecture, written in Rust, running on Google Cloud. Single `apex deploy` ships web apps, serverless functions, static sites, and cron jobs. Custom control plane, agent runtime, scheduler, builder, edge router — no Terraform, no Kubernetes, no Compose for prod. Successor to my Vercel and Railway workloads.

### [Donto](https://github.com/thomasdavis/donto)
An evidence operating system for contested knowledge — a Postgres-backed bitemporal paraconsistent quad store with an optional Lean 4 sidecar for derivations and machine-checkable certificates. Stores claims, who said them, when, what they were based on, what contradicts them, what's been formally certified. A database for facts that may be wrong.

### [Dontopedia](https://github.com/thomasdavis/dontopedia)
An open, paraconsistent wiki built on Donto. Every claim has a source, a time, and an opinion. Wikipedia-style UX over a knowledge graph that lets contradictions coexist.

### [Toiletpaper](https://github.com/thomasdavis/toiletpaper)
An adversarial scientific paper simulator. Takes a research paper (PDF/Markdown), uses GPT-5.4 to extract 50–180 testable claims, runs independent simulations (including a from-scratch MHD solver for physics papers), and produces a claim-by-claim verdict: reproduced, contradicted, fragile, or underdetermined. Four papers processed; one (KAN) had its G⁻⁴ grid-scaling claim measured at G⁻¹·⁵.

### [TPMJS](https://tpmjs.com)
The Tool Package Manager for AI Agents. npm-for-tools — a registry, CLI, and runtime sandbox for tools that LLM agents can discover, install, and execute safely. Pairs with a Cloud Run / Railway executor fleet for sandboxed code execution.

### [Omega](https://github.com/thomasdavis/omega)
A self-evolving AI Discord bot with 80+ specialized tools, a multi-database architecture, and autonomous development capabilities. Built on AI SDK v6, Discord.js, Next.js. Can write its own commands and merge its own PRs.

### [Blah](https://github.com/thomasdavis/blah)
An MCP framework / monorepo I've been iterating on for months. Spawned a small constellation: `anarchymcp.com`, `git-mcp`, `node-candidate-mcp-server`, `remote-mcp-server`, `valjs`, `beammcp`.

### [Lord Ajax](https://lordajax.com)
This site. Built on [JSON Blog](https://jsonblog.dev) with a custom theme — [`jsonblog-generator-mono`](https://www.npmjs.com/package/jsonblog-generator-mono) — that I publish to npm and deploy to Cloud Run via Apex's substrate.

## Open Source Infrastructure

### [CDNJS](https://cdnjs.com)
Co-founded one of the world's largest JavaScript CDNs. Now serving billions of requests monthly. Free, fast CDN support for open source JavaScript libraries.

### [JSON Resume](https://jsonresume.org)
Co-founded the JSON-based open standard for resumes. The ecosystem includes:
- A standardized schema for resume data
- Command-line tools for building and validating resumes
- A registry hosting thousands of public resumes ([mine](https://registry.jsonresume.org/thomasdavis))
- Dozens of community themes and exporters (PDF, HTML, themes per-vibe)

### [JSON Blog](https://github.com/jsonblog)
A minimalist blog generator that builds entire websites from a single JSON configuration file. Zero config, markdown support, themes as npm packages. Powers this site.

### [Dillinger](https://dillinger.io)
The longstanding browser-based markdown editor.

### [Mob Translate](https://mobtranslate.com)
An open source ecosystem for preserving and promoting Australian Indigenous languages through technology — documentation, community translation, education, cultural knowledge sharing.

## AI · LLMs · Agents

### [LLM Benchmark](https://github.com/thomasdavis/llm-benchmark)
A long-running benchmark suite for comparing LLM behavior on real-world coding and reasoning tasks.

### [json-render](https://json-render.dev)
AI → JSON → UI. A small renderer that turns an LLM's structured output into live UI without round-tripping through a frontend codegen pipeline.

### [Anarchy MCP](https://anarchymcpcom.vercel.app)
A directory / launcher for MCP servers in the wild — the opposite of an officially blessed registry.

### [Blocks](https://blocks-docs-steel.vercel.app)
A composable building-block system for agentic UIs.

### [Generous](https://github.com/thomasdavis/generous)
LLM tool that drafts and reviews pull-request-sized changes.

### [Fetch](https://github.com/thomasdavis/Fetch)
WhatsApp-controlled AI coding assistant. Your faithful code companion.

### [Executor](https://executor.sh)
Sandboxed code-execution endpoint for agents.

### [8gent Code](https://github.com/thomasdavis/8gent-code)
The Infinite Gentleman Agent — an autonomous coding agent powered by local LLMs.

### [Posers](https://github.com/thomasdavis/posers)
LLM toolset for adversarial prompt-engineering experiments.

### [Daimon](https://daimon-umber.vercel.app)
Personal-AI experimentation surface.

### [Symploke](https://symploke-web.vercel.app)
Narrative engine driven by an LLM, with a paraconsistent state model so contradictions in story don't break the world.

### [Styleguide Skill](https://github.com/thomasdavis/styleguide-skill)
A Claude skill that helps Claude build a styleguide following every principle Claude itself would suggest. Meta but useful.

### [Log CV](https://github.com/thomasdavis/log-cv)
Vision/log-analysis tool for CV inference traces.

### [Isolator](https://isolator-docs.vercel.app)
Isolation primitives for sandboxed agent runs.

### [Rerankers](https://github.com/thomasdavis/rerankers)
A lightweight, low-dependency, unified API to use all common reranking and cross-encoder models.

### [valjs](https://github.com/thomasdavis/valjs)
MCP server that wraps val.town.

### [Git MCP](https://gitmcp.io)
MCP server that exposes a git repository to an LLM agent.

## Civic Technology · Digital Rights

### [Taskforce](https://github.com/tfrce)
Core team member of a collective building tools for digital democracy and internet freedom.

#### The Day We Fight Back
Led technical development for the anti-surveillance campaign:
- 37 million banner views
- 100,000+ phone calls to Congress
- 500,000+ emails sent
- 250,000+ petition signatures

#### EFF Action Centre
Built the technical infrastructure for the Electronic Frontier Foundation's campaign platform.

## Indigenous Australia · Cultural Tech

### [Aboriginal Flag Computer Vision Model](https://github.com/australia/aboriginal-flag-cv-model)
A PyTorch computer vision model that identifies the Australian Aboriginal Flag in images. Intersection of AI and cultural recognition.

### [Davis Native Title Sources](https://github.com/thomasdavis/davis-native-title-sources)
Curated primary-source archive supporting native title research in Mount Isa / North-West Queensland.

### [Family Research](https://github.com/thomasdavis/family-research)
McConnachie-Tyrrell and Kelly-Williams family genealogical research. Mount Isa lineage, primary-source-only.

### [Autoresearch Genealogy](https://github.com/thomasdavis/autoresearch-genealogy)
Structured prompts, vault templates, and archive guides for AI-assisted genealogical research.

### [Genes](https://github.com/thomasdavis/genes)
Tooling for genealogical record reconciliation across archives.

### [Yalumba](https://github.com/thomasdavis/yalumba)
Personal/cultural project — wine-country history threading.

## Developer Tools

### [W3CJS](https://github.com/thomasdavis/w3cjs)
Npm package providing W3C HTML validation as a service. Used by developers to programmatically validate HTML in CI/CD pipelines.

### [SEO Server](https://github.com/thomasdavis/seoserver)
Server-side rendering proxy that let search engines index JavaScript SPAs — built before SSR was commonplace.

### [Backbone Boilerplate](https://github.com/thomasdavis/backboneboilerplate)
A modular Backbone.js environment with best-practice structure for scalable JavaScript apps. Helped a generation of devs get started.

### [Kalei Styleguide](http://kaleistyleguide.com)
Auto-generated living styleguide from your CSS. The most-starred thing I've ever shipped (★661).

### [Mini Photo Editor](https://github.com/thomasdavis/mini-photo-editor)
Online WebGL photo editor with effects, filters, and cropping.

### [jsonblog-cli](https://github.com/thomasdavis/jsonblog-cli)
The original JSON Blog CLI.

### [Resumed](https://npm.im/resumed)
Lightweight JSON Resume builder, no-frills alternative to resume-cli.

### [Screenshot API](https://s.vercel.app)
Serverless API to take screenshots of websites with Puppeteer.

### [pinjs](http://apiengine.io)
Node.js API client for the Pin Australian payment gateway.

## Games · Play

### [Pokemon Games](https://github.com/thomasdavis/pokemon-games)
Pokemon-themed games for kids, built with Next.js.

### [Jarli Pokemon](https://github.com/thomasdavis/jarli-pokemon)
A bilingual Pokemon-style game incorporating Jarli (Aboriginal language) — kids learning the language while collecting creatures.

### [Acrophylia](https://acrophylia.vercel.app)
A recreation of Acrophobia — the multiplayer acronym party game.

### [3D Chat](https://3dchat-gules.vercel.app)
Avatar chat in a Three.js world.

### [Dance](https://dance-iota.vercel.app)
A navigable Three.js world where each leaf is a spherical harmonic, coupled as Kuramoto oscillators. Look at the tree to gelate it.

## Content · Education

### [Backbone Tutorials](https://leanpub.com/backbonetutorials)
A comprehensive tutorial series on Backbone.js that became one of the most popular resources for learning the framework. Compiled into an ebook on Leanpub.

### Conference talks & writing
Scattered across [/videos](/videos) and [/devlog](/devlog) on this site. Recent weekly devlogs cover the work on Apex, Donto, Toiletpaper, Mob Translate, and AI tooling.

## Commercial · Past

### [Drone Hire](https://dronehire.org)
International directory connecting drone operators with clients needing aerial services. 200,000+ visitors in its first year — aerial photography, agricultural surveys, infrastructure inspections.

### Cryptocurrency & Blockchain
- **Tokenized** — contributed to a Bitcoin wallet Electron application
- **Blockbid** — senior full-stack on a cryptocurrency exchange platform

### [Fake Resume Generators](https://fake.jsonresume.org)
Multiple approaches to generating synthetic resume data — GPT-3 contextual generation, custom-trained text ML models, dataset creation for resume-parsing research.

### [Omega (legacy)](https://github.com/thomasdavis/omega-old)
Clubhouse + Google Deep Voice + GPT-3. From 2021, ★43.

## Impact

Through all of it: democratising technology, protecting digital rights, building tools that empower communities. From serving billions of CDN requests, to letting an Aboriginal kid play Pokemon in their own language, to verifying scientific claims claim-by-claim — these projects reflect a commitment to using technology for things worth doing.
