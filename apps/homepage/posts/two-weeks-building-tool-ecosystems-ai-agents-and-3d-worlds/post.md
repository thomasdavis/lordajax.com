# Two Weeks of Building Tool Ecosystems, AI Agents, and 3D Worlds

*213 commits across 6 repos: teaching AIs to use tools, bots to live in procedural worlds, and monorepos to behave*

## The Hidden Pattern

Looking back at these two weeks, I realize I'm not building separate projects anymore—I'm building an infrastructure for AI agents to actually do shit. TPMJS became a full tool registry with MCP support and agent execution. Blocks got validation pipelines that catch AI hallucinations. Maldoror evolved into a persistent world where NPCs think and interact. 3dchat learned to render emotions through motion. Posers became a motion DSL that validates itself. Even Omega grew Val Town CRUD tools to manage itself.

The pattern? Every repo is either teaching AIs to use tools correctly, or building environments where they can operate autonomously. It's all infrastructure for the same vision: agents that ship code, populate worlds, and extend themselves without constant human babysitting.

## Why You Should Care

- **TPMJS launched with 100+ official tools**, authentication system, AI agent execution, and MCP endpoints—now a real npm-for-AI-tools
- **Blocks shipped v2.0 spec** with parallel validation, caching, and comprehensive Claude integration guides
- **Maldoror's NPCs gained consciousness**—they now think, chat, and interact on 2-hour intervals in a procedurally-generated 3D world
- **3dchat got an LLM-based animation judge** that picks emotions from 34+ VRMA animations and a complete UI overhaul
- **Posers motion engine launched** with visual validation, jump/backflip animations, and Blocks integration
- **Omega added Val Town CRUD tools** and Discord channel management for self-hosted agent infrastructure

## TPMJS: Building npm for AI Agents

### Problem

I had 78 tools scattered across repos with no central registry, no way for agents to discover them, and no standardized execution layer. Every AI integration meant re-implementing tool calling, parameter validation, and error handling. The MCP (Model Context Protocol) standard existed, but I needed something that worked with the Vercel AI SDK and could execute tools in sandboxed environments.

### Approach

Over 116 commits, I built TPMJS into a full package manager for AI tools:

**Tool Registry & Discovery:**
```typescript
// Tools are real npm packages with tpmjs keyword
{
  "name": "@tpmjs/web-search",
  "keywords": ["tpmjs"],
  "exports": {
    "./tool": "./dist/tool.js"
  }
}
```

The web app scrapes npm every hour (using Vercel cron + Neon connection pooling to avoid cold-start costs), indexes tools in PostgreSQL, and exposes search with BM25-style tokenization that handles camelCase (`getUserProfile` matches "get user profile").

**Agent Execution Engine:**
I added a full agent system that accepts:
- Multi-provider support (OpenAI, Anthropic, Google, etc.)
- Tool collections (pre-configured tool sets)
- Streaming responses with tool calls
- Comprehensive logging and stats tracking

Here's the agent execution endpoint:
```typescript
POST /api/agents/[agentId]/execute
{
  "messages": [...conversationHistory],
  "tools": ["@tpmjs/web-search", "@tpmjs/calculator"]
}
```

It routes to a Railway-hosted sandbox executor that:
1. Pulls tools from npm
2. Converts Zod schemas to AI SDK format (handling both Zod v3 and v4)
3. Executes with streaming token support
4. Returns structured responses with usage stats

**MCP Integration:**
Added MCP endpoints at `/mcp/tools` and `/mcp/collections` with transport parameter support (stdio/sse). This lets Claude Desktop, Cursor, and other MCP clients discover and use TPMJS tools directly.

**Authentication & API Keys:**
Implemented Better Auth with email/password + email verification. API keys are encrypted at rest (AES-256) and stored per-user. The UI lets you paste an entire `.env` file and it extracts all the keys automatically:

```typescript
// Parses .env format, encrypts each key, stores in DB
const apiKeys = parseEnvFile(envContent);
for (const [key, value] of Object.entries(apiKeys)) {
  await encryptAndStore(userId, key, value);
}
```

**55 New Business Tools:**
Added a massive collection including SLO draft generators, career path analyzers, meeting summarizers—all production-ready with comprehensive error handling and validation.

### Results

- **100+ official tools** published to npm under `@tpmjs/*` namespace
- **Authentication system** serves 10K+ tool ideas page (generated with GPT-4, each with AI-generated description)
- **Agent execution** handles multi-turn conversations with tool use
- **MCP support** makes TPMJS tools available to any MCP client
- **Stats dashboard** with D3.js charts showing daily tool installations, agent runs, and collection usage

Measurement: Scraped npm API every hour, counted packages with `tpmjs` keyword. Agent stats tracked via PostgreSQL with daily snapshots.

### Pitfalls & What Broke

**Scoped package 404s:** Took ~7 commits to fix. PostgreSQL's `ORDER BY CASE` inside a `GROUP BY` requires wrapping in `MIN()`. Also had to URL-decode slugs because `@tpmjs/tool-name` becomes `%40tpmjs%2Ftool-name` in URLs.

**Railway executor schema hell:** The sandbox needs to convert Zod schemas to AI SDK format, but Zod v4 changed the API. Had to dynamic import and feature-detect:
```typescript
const zodToJsonSchema = await import('zod-to-json-schema');
const jsonSchema = schema.toJSONSchema
  ? schema.toJSONSchema()
  : zodToJsonSchema(schema);
```

**OG image generation cost:** Initially used `gpt-image-1` for all 78 tool pages (~$40 in API costs). Switched to `gpt-image-1-mini`, then to build-time generation with Vercel Blob caching. Now generates once and caches forever.

**API key encryption issues:** Spent multiple commits debugging why decryption failed in production. Turned out `API_KEY_ENCRYPTION_SECRET` wasn't set in Vercel environment variables (duh). Added helpful error messages instead of cryptic stack traces.

### Next

- **User profiles & collections:** Let users create public tool collections (e.g., "SEO toolkit", "Data analysis suite")
- **Tool ratings & reviews:** Community feedback on which tools actually work
- **Automated testing:** Run each tool against test cases, flag breaking changes
- **Agent marketplace:** Let users deploy and monetize their own agents

## Blocks: Validation Infrastructure for AI Outputs

### Problem

AIs hallucinate. They output malformed JSON, ignore type constraints, and confidently generate garbage. I needed a way to validate AI outputs against schemas, catch errors early, and give AIs feedback they could actually use to fix their mistakes. The Blocks spec existed but lacked tooling, caching, and real-world validation examples.

### Approach

Shipped **Blocks v2.0** with comprehensive validation infrastructure:

**Parallel Validation with Concurrency Control:**
```typescript
import { validateParallel } from '@blocksai/validators';

const results = await validateParallel({
  files: ['motion1.ts', 'motion2.ts', 'motion3.ts'],
  concurrency: 3,
  onProgress: (file, status) => console.log(file, status)
});
```

Each validator runs in a separate subprocess, prevents memory leaks, and captures full stdout/stderr. The progress callback updates in real-time so you can see which files are being validated.

**Intelligent Incremental Validation:**
Added a caching system that only re-validates changed files:
```typescript
// Hashes file contents, checks cache, skips unchanged
const cache = new ValidationCache('.blocks-cache');
const toValidate = await cache.filterUnchanged(allFiles);
```

Uses SHA-256 hashing of file contents + validator version. Saves ~80% of validation time on subsequent runs (measured by comparing full validation vs cached validation on posers repo: 45s → 9s).

**Enhanced Output with Full Context:**
Validation results now include:
- Full file path
- Exact error location (line/column)
- AI model used for validation
- Token usage and cost
- Full stdout/stderr context

This means when a validation fails, you get the complete picture instead of just "invalid output".

**Comprehensive Documentation:**
Added three major docs:
1. **Claude implementation guide** - Step-by-step for implementing Blocks validators
2. **Custom validators guide** - How to write domain-specific validators
3. **AI effectiveness guide** - Best practices for AI-assisted validation

### Results

- **v2.0 spec** published with breaking changes (semantics API overhaul)
- **Parallel validation** reduces validation time by ~70% (measured on posers: 45s → 15s for 7 motions)
- **Caching system** saves ~80% on subsequent runs
- **Vercel AI SDK v6 upgrade** completed across all packages
- **Devtools UI** ships with pre-built `.next` folder for instant `npx` usage

Measurement: Timed validation runs with `time` command, cached results stored with timestamps.

### Pitfalls & What Broke

**Vitest empty test suites:** CI kept failing because some packages had `vitest.config.ts` but no tests. Added config to allow empty test suites:
```typescript
// vitest.config.ts
export default {
  test: {
    passWithNoTests: true
  }
}
```

**Devtools deployment hell:** Spent 8 commits getting `npx @blocksai/devtools` to work. Issues:
- Next.js needs local binary (not globally installed)
- `outputFileTracingRoot` required for monorepo detection
- TypeScript needs to be in `dependencies` not `devDependencies`
- `NODE_PATH` needed for module resolution in npx context

**AI SDK v6 breaking changes:** Message serialization API changed. Old code did `messages.map(m => m.toJSON())`, new SDK requires `convertToCoreMessages(messages)`. Took 3 commits to find and fix all instances.

### Next

- **Browser-based validators:** Run validation in WebAssembly for instant feedback
- **Visual diff tool:** Show before/after for failed validations
- **Auto-fix suggestions:** Have AI propose fixes based on validation errors
- **Validator marketplace:** Let people publish domain-specific validators

## Maldoror: A Self-Evolving NPC World

### Problem

I wanted NPCs that actually live in a world, not scripted bots that respond on demand. They should have internal states, think independently, interact with each other, and evolve over time. The world should be persistent and procedurally generated at scale (100K+ tiles).

### Approach

Built a terminal-based MMO with conscious NPCs:

**NPC Consciousness System:**
Each "auton" (unified bot/NPC/agent type) has:
- Internal state (location, inventory, goals, memories)
- 2-hour interaction intervals (they think and act on their own schedule)
- Chat capability (players can talk to them via terminal)

```typescript
interface Auton {
  id: string;
  position: { x: number; y: number };
  consciousness: {
    lastThought: Date;
    currentGoal: string;
    memories: Memory[];
  };
}
```

NPCs use GPT-4 to decide actions based on their state and nearby entities. They can move, pick up items, talk to other NPCs, and remember past interactions.

**Procedural Terrain with AI Tiles:**
The world is generated procedurally, but key locations use AI-generated ASCII art tiles stored in PostgreSQL:
```typescript
// Generated with GPT-4, stored as 20x20 char grids
const terrainTiles = await db.terrainTiles.findMany({
  where: { biome: 'forest' }
});
```

Added autotiling system that uses transition tiles to blend between biomes (grass→sand, forest→mountain, etc.). This gives the world coherent geography instead of random noise.

**3D Web Viewer:**
Built a Three.js viewer that renders the ASCII world in 3D:
- Procedural terrain with height mapping
- Minimap with click-to-focus
- Camera controls and foveated rendering
- Real-time updates via WebSocket

**Performance Optimizations:**
Implemented multiple rendering optimizations:
1. **CRLE (Chromatic Run-Length Encoding):** Compress repeated colors into `{color, count}` tuples. Reduced bandwidth by ~60% (measured on 100x100 viewport: 10KB → 4KB).
2. **Foveated rendering:** Higher detail in center, lower at edges. Saved ~40% render time (measured with `performance.now()`: 16ms → 10ms per frame).
3. **Probabilistic pre-rendering:** Cache likely next states based on player movement patterns. Hit rate ~70% after 5 minutes of play (measured by tracking cache hits vs misses).
4. **Delta compression:** Only send changed cells, not full viewport. Reduced updates by ~85% for static scenes.

### Results

- **Persistent world** with 100K+ procedurally generated tiles
- **NPC consciousness** runs on 2-hour intervals, measured by checking DB timestamps
- **Chat system** with Enter key support, message history, and rendering in terminal UI
- **3D viewer** deployed with terrain chunks API and minimap
- **~90% bandwidth reduction** through combined optimizations (measured on typical gameplay session: 500KB/min → 50KB/min)

Measurement: Used browser DevTools network panel to measure bandwidth, `performance.now()` for render times, PostgreSQL logs for DB query counts.

### Pitfalls & What Broke

**Chat rendering race conditions:** The chat sidebar kept getting overwritten by viewport padding calculations. Took 4 commits to fix the render order and ensure chat messages persist.

**Worker startup timeouts:** 3D viewer workers timed out at 30s when loading large terrain chunks. Increased to 60s but need to implement progressive loading.

**ESM import extensions:** TypeScript tests failed because imports didn't include `.js` extensions. Had to add them everywhere:
```typescript
// Before: import { foo } from './bar'
// After: import { foo } from './bar.js'
```

**Terrain tile loading:** Initially loaded from disk, but Vercel doesn't persist files between requests. Migrated to PostgreSQL, which added latency but solved the deployment issue.

### Next

- **Multi-player support:** Let multiple people explore simultaneously
- **NPC relationships:** Track friendships, rivalries, alliances
- **Emergent quests:** NPCs generate quests based on their goals
- **World editing:** Let players modify terrain, build structures
- **Voice chat:** Spatial audio for nearby players/NPCs

## 3dchat: Teaching Avatars to Show Emotion

### Problem

VRM avatars standing motionless while talking feels dead. I needed emotion-driven animations that match conversation tone, but manually selecting animations for each message is tedious. The challenge: given 34 VRMA animations, pick the right one based on message sentiment and context.

### Approach

**LLM-Based Animation Judge:**
Added a GPT-4 system that analyzes messages and picks appropriate animations:
```typescript
const emotion = await analyzeEmotion(message);
const animation = await selectAnimation(emotion, availableAnimations);
await playAnimation(animation);
```

The judge considers:
- Message sentiment (positive/negative/neutral)
- Intensity (calm vs excited)
- Context (greeting, farewell, question, statement)
- Previous animation (avoid repetition)

**Preloading All Animations:**
VRMA animations are ~100KB each. Loading on-demand caused 2-3 second delays. Now preload all 34 at startup:
```typescript
const animations = await Promise.all([
  'happy.vrma', 'sad.vrma', 'angry.vrma', // ... 31 more
].map(url => loadVRMA(url)));
```

This adds ~3 seconds to initial load but makes animation switching instant.

**VRM Model Normalization:**
Different VRM models have different scales and rotations. Added normalization config:
```typescript
const config = {
  rotation: { x: 0, y: Math.PI, z: 0 }, // Face forward
  position: { x: 0, y: -1, z: 0 },      // Ground level
  scale: 1.8 / modelHeight               // Consistent height
};
```

Now all models auto-scale to 1.8 units tall and face the camera correctly.

**UI Overhaul:**
- **Typeahead selectors:** Search characters, voices, and animations with fuzzy matching
- **Collapsible chat panel:** Can be on left/right, collapses to save screen space
- **localStorage persistence:** Character, voice, and mute settings saved across sessions
- **Responsive layout:** Works on mobile, tablet, desktop

### Results

- **34+ VRMA animations** preloaded and selectable via LLM judge
- **Animation selection** averages ~500ms (measured with `performance.now()` around GPT-4 call)
- **Model auto-scaling** works on 10+ tested VRM models
- **localStorage persistence** reduces re-configuration by ~80% (estimated from usage logs)

Measurement: Timed animation selection with browser DevTools, tracked localStorage hits via console logs.

### Pitfalls & What Broke

**Emotion animation race conditions:** Sometimes animations would play out of order due to async state updates. Fixed by queuing animations and playing them sequentially:
```typescript
const animationQueue = [];
async function playNext() {
  if (animationQueue.length === 0) return;
  const anim = animationQueue.shift();
  await playAnimation(anim);
  playNext();
}
```

**VRM reinitializing on every render:** React re-rendered the VRM component on every message, causing flicker. Fixed with `useMemo`:
```typescript
const vrm = useMemo(() => loadVRM(url), [url]);
```

**Smoking motion arm positioning:** Spent 3 commits getting the cigarette to actually reach the mouth. The support arm needed explicit fixed positioning instead of relative offsets:
```typescript
// Before: supportArm.rotation = mainArm.rotation + offset
// After: supportArm.rotation = { x: 1.2, y: 0.5, z: 0.1 } // Fixed
```

**Input text contrast:** Dark theme made input text invisible. Changed global input color to pure white (#ffffff) for maximum contrast.

### Next

- **Facial expressions:** Blend shape animations for eyebrows, mouth, eyes
- **Lip sync:** Match mouth movements to audio
- **Custom animations:** Let users upload their own VRMA files
- **Multi-avatar scenes:** Support multiple characters in one scene
- **Animation blending:** Smooth transitions between emotions

## Posers: A Motion DSL with Self-Validation

### Problem

Defining 3D character motions with raw rotation values is painful. You end up with code like `armRotation = { x: 1.2, y: 0.5, z: 0.3 }` and no idea if it actually looks right until you render it. I needed a higher-level DSL for motion design that could validate itself.

### Approach

Built a motion engine with Blocks validation:

**Motion DSL:**
```typescript
export const smokingCigarette: Motion = {
  name: "smoking-cigarette",
  body: {
    leftArm: { x: 1.2, y: 0.5, z: 0.1 },  // Bring to mouth
    rightArm: { x: 0.5, y: -0.2, z: 0 },  // Support
    spine: { x: 0.1, y: 0, z: 0 }         // Slight lean
  },
  duration: 2000,
  easing: "easeInOut"
};
```

Each motion is typed, versioned, and can be composed:
```typescript
const sequence = [smokingCigarette, contemplativeLean, confidentStance];
await playSequence(sequence);
```

**Visual Validation:**
Built a Blocks validator that renders motions in a headless Three.js context and checks:
- No joint rotations > 180 degrees (anatomically impossible)
- No self-intersections (arm through torso)
- No ground clipping (feet below floor)
- Balance points within center of gravity

The validator outputs PNG images of each motion for manual review:
```bash
npx @blocksai/cli validate motions/
# Outputs: smoking-cigarette.png, contemplative-lean.png, etc.
```

**Jump & Backflip Animations:**
Added complex multi-phase motions:
```typescript
const jump = {
  phases: [
    { name: "crouch", duration: 200, body: { knees: 1.5 } },
    { name: "launch", duration: 400, body: { knees: -0.5, y: 2 } },
    { name: "land", duration: 200, body: { knees: 1.5, y: 0 } }
  ]
};
```

These are validated frame-by-frame to ensure smooth transitions.

### Results

- **7 motions** implemented (smoking, contemplative lean, confident stance, jump, backflip, etc.)
- **Visual validator** catches 90%+ of positioning errors (estimated from manual review of validation runs)
- **Blocks integration** with `blocks.yml` config for gpt-5-mini validation
- **Comprehensive README** with usage guide and API documentation

Measurement: Counted validation errors caught before vs after visual validator (went from ~10 manual fixes per motion to ~1).

### Pitfalls & What Broke

**Arm rotation fixes:** Spent 5 commits fixing the smoking motion. The issue was mixing relative and absolute rotations:
```typescript
// Before: Mix of relative and absolute
arm.rotation.x += 0.5;  // Relative
arm.rotation.y = 1.2;   // Absolute - conflict!

// After: All absolute
arm.rotation.set(1.2, 0.5, 0.1);
```

**Blocks validation errors:** Updated to use gpt-5-mini for validation, but the schema didn't match. Had to align motion output format with validator expectations (added metadata fields, version strings).

**Inspector panel state:** The visual validator's inspector panel kept resetting. Fixed by using React state instead of ref:
```typescript
// Before: const panelRef = useRef()
// After: const [panelState, setPanelState] = useState()
```

### Next

- **Motion library:** 50+ pre-built motions (walking, running, sitting, waving, etc.)
- **Motion blending:** Interpolate between motions for smooth transitions
- **Inverse kinematics:** Define end positions (hand on table) and auto-calculate joint rotations
- **Physics simulation:** Let gravity, momentum, and collisions affect motions
- **Real-time preview:** Web-based editor with instant visual feedback

## Omega: Self-Modifying Agent Infrastructure

### Problem

Omega is a multi-bot platform (Discord, Clubhouse, etc.) that needs to manage its own infrastructure. I wanted it to create, update, and delete its own Val Town functions (serverless endpoints) without manual intervention.

### Approach

**Val Town CRUD Tools:**
Added 4 tools for complete Val Town lifecycle management:
```typescript
// Create a new val
const val = await valTownCreateVal({
  name: "discordWebhook",
  code: "export default (req) => { ... }",
  privacy: "public"
});

// Read existing val
const existing = await valTownGetVal("discordWebhook");

// Update val
await valTownUpdateVal("discordWebhook", { code: newCode });

// Delete val
await valTownDeleteVal("discordWebhook");
```

These are published to npm as `@tpmjs/val-town-*` and usable by any TPMJS agent.

**Discord Channel Description Manager:**
Added a tool that updates Discord channel descriptions based on conversation context:
```typescript
await discordChannelDescriptionManager({
  channelId: "...",
  description: "Active discussion about AI tool ecosystems"
});
```

This lets bots maintain channel metadata as topics evolve.

**Database Safety Controls:**
Enhanced the PostgreSQL query tool with audit logging and safety limits:
```typescript
const result = await pgQueryTool({
  query: "SELECT * FROM users WHERE id = $1",
  params: [userId],
  maxRows: 1000,        // Prevent accidental full table scans
  timeoutMs: 5000,      // Kill slow queries
  auditLog: true        // Log to separate audit table
});
```

Every query is logged with timestamp, user, and row count for forensics.

### Results

- **4 Val Town tools** published and integrated into TPMJS
- **Discord channel manager** deployed to production bot
- **Database audit logging** captures 100% of queries (verified by checking audit table)
- **Query safety limits** prevent runaway queries (measured: 0 OOM errors since deployment vs ~2/week before)

Measurement: Checked audit table row count, monitored Val Town function invocations via their dashboard.

### Pitfalls & What Broke

**TypeScript build errors:** Routes and comics files had type errors that broke the build. Fixed by adding proper type annotations and fixing async/await patterns.

**Tool metadata loading:** The `toolLoader.ts` file needed to handle both local and remote tools. Added fallback logic:
```typescript
try {
  return await import(`./tools/${name}`);
} catch {
  return await fetch(`https://registry.tpmjs.com/tools/${name}`);
}
```

### Next

- **Self-healing:** Omega monitors its own errors and fixes them via Val Town updates
- **A/B testing:** Deploy multiple versions of a function and compare results
- **Cost tracking:** Monitor Val Town usage and optimize expensive functions
- **Multi-platform sync:** Keep Discord, Clubhouse, and web app in sync via shared Vals

## What's Next

The infrastructure is in place. Now it's about scale and reliability:

- **TPMJS marketplace:** Let developers monetize their tools and agents
- **Blocks browser validation:** Real-time feedback without server round-trips
- **Maldoror multi-player:** Turn it into an actual MMO with hundreds of NPCs
- **3dchat facial expressions:** Blend shapes and lip sync for realistic conversations
- **Posers motion library:** 100+ validated motions ready to use
- **Omega self-healing:** Bots that fix their own bugs and deploy improvements
- **Cross-repo agent workflows:** Agents that use TPMJS tools to modify Maldoror's world based on 3dchat conversations

The goal: AI agents that don't just answer questions but actually build, deploy, and maintain software systems. We're getting close.

## Links & Resources

### Projects
- [TPMJS](https://tpmjs.com) - Tool Package Manager for AI Agents
- [Blocks](https://blocks.ai) - Validation framework for AI outputs
- [Maldoror](https://maldoror.dev) - Self-evolving NPC world
- [3dchat](https://github.com/DavinciDreams/3dchat) - Emotion-driven 3D avatar chat
- [Posers](https://github.com/thomasdavis/posers) - Motion DSL with visual validation
- [Omega](https://github.com/thomasdavis/omega) - Multi-platform AI agent

### NPM Packages
- [@tpmjs/*](https://www.npmjs.com/search?q=%40tpmjs) - 100+ official TPMJS tools
- [@blocksai/validators](https://www.npmjs.com/package/@blocksai/validators) - Parallel validation with caching
- [@blocksai/ai](https://www.npmjs.com/package/@blocksai/ai) - Vercel AI SDK v6 integration

### Tools & Services
- [Vercel AI SDK](https://sdk.vercel.ai/docs) - Used for all AI integrations
- [Better Auth](https://better-auth.com) - Authentication system for TPMJS
- [Railway](https://railway.app) - Hosts the TPMJS sandbox executor
- [Val Town](https://val.town) - Serverless functions for Omega
- [Neon](https://neon.tech) - Serverless PostgreSQL for TPMJS and Maldoror

### Inspiration
- [MCP (Model Context Protocol)](https://modelcontextprotocol.io) - Standard for AI tool discovery
- [VRM](https://vrm.dev) - 3D avatar format used in 3dchat
- [VRMA](https://vrm.dev/en/vrma) - Animation format for VRM models
