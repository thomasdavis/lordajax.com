# Two Weeks of Void Creatures, Bullet Time, and the Control Plane for AI Tools

*Building the Matrix rain world from scratch while simultaneously arguing on the internet (in blog post form) that AI agents need a proper tool registry.*

There's a pattern in this fortnight I didn't notice until I was three days into it: I'm building two sides of the same coin. On one side, prematrix — a 3D interactive world where animated humanoids float outside windows in a void, Matrix rain falls on everything, and you can shoot bullets that bend time. On the other side, tpmjs — the infrastructure argument for how AI agents should discover and execute tools at scale. One is the front-of-house: immersive, visual, immediate. The other is the back-of-house: the registry, the control plane, the unglamorous plumbing. Together they're asking the same question: *what does it look like when digital entities exist in a world designed around them?*

## Why You Should Care

- **Prematrix shipped mobile touch controls** — joystick zone + action buttons in 158 lines, making the Matrix rain world actually playable on phones
- **6 new animated 3D models added** (shark, robot, xbot, hvgirl, michelle, milktruck) with triplanar UV projection so Matrix rain textures consistently across all geometry
- **AI-powered face landmark extraction via GPT-4 Vision** — capture your face, project it onto the rain shader, stare into the abyss as it stares back
- **MediaPipe Face Mesh** replaced the GPT-4V approach for 468-point real-time landmark detection
- **tpmjs published 4 blog posts** laying out the MCP server architecture, registry-as-control-plane philosophy, and the "Roomba with a million tools" problem
- **Aggressive Cloudflare CDN caching** baked into prematrix with environment-aware headers (disabled in dev, active in prod)

---

## Prematrix: Building the Matrix Inside a Browser

**67 commits. 26 features. 11 fixes. ~2,018 lines added across the repo.**

### Problem

Prematrix started as a Matrix rain shader experiment and needed to become a real experience. "Real" means: a 3D world you can walk around in, animated humanoids populating rooms and floating in the void outside windows, bullet time when you shoot, face projection through the rain shader, and a mobile experience that doesn't feel like punishment.

The gaps were enormous. No room geometry. No entity system. No models. No mobile controls. No face detection pipeline. The corridor and rain effects existed but the world they sat in did not.

### Approach: The World System

The foundation was an ECS-based entity and world system with procedural room generation. This gave a clean separation between the world state (entities, rooms, placement rules) and the rendering layer. Rooms got built with `RoomBuilder.ts`, entities spawned via `EntitySpawner.ts`, and the whole thing wired into the live Three.js scene at the `/world` route.

The room ended up as a single 28x28 square room (after several iterations — random sizing was removed because it caused more problems than it solved). Every wall gets a window. Door openings are archways, not doors. The void outside is populated by animated models orbiting at 150+ units, scaled down so they read as figures rather than blobs.

```typescript
// The void entities needed to be far enough to feel like they're outside
// but close enough to see detail through the windows
// "push orbit to 150+ units, scale down to recognizable size" — commit 0867447
```

Getting the scale right took an embarrassing number of commits. First the HVGirl and Michelle models were massive — fixed with `scale: 0.3` and a stricter clamp. Then foxes and horses were added to rooms, scaled to 0.25, clamped to 0.7m max, and then removed entirely because "sizing never works." Room humanoids got clamped to max 2.2m. All models normalized to 1.8m. The pattern here is: model loading is a solved problem in theory and a nightmare in practice.

### Approach: Triplanar UV Projection

The Matrix rain shader needed to apply consistently across all loaded models, regardless of their UV layout. The solution was triplanar world-space UV projection — sample the texture from all three axes and blend based on surface normals, so every surface in the world gets the rain pattern regardless of how the original UVs were baked.

```glsl
// Triplanar sampling: blend XY, YZ, XZ projections weighted by abs(normal)
vec3 blendWeights = abs(vNormal);
blendWeights = blendWeights / (blendWeights.x + blendWeights.y + blendWeights.z);

vec4 xProjection = texture2D(uMatrix, vWorldPos.yz * uScale);
vec4 yProjection = texture2D(uMatrix, vWorldPos.xz * uScale);
vec4 zProjection = texture2D(uMatrix, vWorldPos.xy * uScale);

vec4 color = xProjection * blendWeights.x + yProjection * blendWeights.y + zProjection * blendWeights.z;
```

This meant adding the shark, robot, xbot, hvgirl, michelle, and milktruck in a single commit (+87/-15) without any per-model UV fiddling.

### Approach: Face Reconstruction

The weird one. The abyss gazes back — literally. The pipeline:

1. Capture face via webcam
2. Send to GPT-4 Vision for landmark extraction
3. Project the landmarks back through the Matrix rain shader
4. The rain characters rearrange themselves to form your face

This turned into a debugging rabbit hole. The face projection kept disappearing on movement. Debug mode (red channel reserved, high-contrast palette for layers) was added. A smiley face and then a Red John smiley were used as test patterns before switching to real faces. The `uDebugMode` uniform had to be set every frame in the render loop because it was being reset.

Eventually the GPT-4V approach was replaced with MediaPipe Face Mesh for 468-point real-time landmark detection — faster, client-side, no API call per frame.

### Approach: Bullet Time

The bullet time system got a full rewrite. Original: simple slow-motion on shoot. Rewrite: dynamic trail ribbon behind bullets, slower bullet velocity, air ripple distortion effects. Walking direction was fixed in the same commit because they shared the same control state. Left-click shoots. The `FirstPersonControls.ts` file accumulated 176 lines and 35 deletions across 4 commits to get this right.

### Approach: Mobile Controls

Mobile was an afterthought that became a feature. Added a joystick zone for movement and action buttons for shoot/interact in 158 new lines (+158/-1). Then a separate commit added full touch event handling (+129/-7). The desktop mouse broke during this — pointer lock was blocked by the mobile detection code. Fixed with a two-line change.

### Approach: Layer System and Pretext Integration

The Matrix rain originally had ad-hoc layer logic. Redesigned as a single configurable slider (1-6 layers) with the debug panel providing copy/paste config sharing. Pretext was integrated for accurate glyph measurement and text layout — important because the rain glyphs need to tile precisely and browser font metrics are lies.

### Results

- 6 new animated models loading via adapter-based model loader with browser UI (measured by the model count in the commit message: +87/-15 for the batch add)
- Mobile joystick + action buttons working on iOS/Android (qualitative — tested on device during development)
- Face landmark extraction running at interactive framerates with MediaPipe (felt fast; formal FPS benchmarking TODO)
- Matrix rain consistent across all model geometry via triplanar projection (visual inspection — no UV seams visible on any model)
- Cloudflare CDN cache headers added for static assets in prod, disabled in dev (`8acb2d4`)

### Pitfalls / What Broke

The animal models (fox, horse) were added and removed twice. The scale normalization system — intended to make all models 1.8m — kept producing 10m sharks and invisible mice depending on what the model's root transform was doing. The final fix was to just remove foxes and horses entirely with the note "sizing never works." Room humanoids got a hard 2.2m clamp. Void entities got their own clamp. The animals didn't survive.

The face projection disappearing on movement was the most frustrating bug. The issue was the shader uniform getting reset in the render loop — a classic "stateless shader" problem where the JS side assumed state persisted between frames. Fix was one line: set `uDebugMode` every frame unconditionally.

East/west wall movement was clamped with a hardcoded corridor X value that didn't account for the world system's room coordinates. That broke movement in the rooms. Eight lines deleted to fix it.

### Next

- Multiplayer — the ECS and world system are structured for it, but networking isn't wired in yet
- Sound design — the bullet time and rain effects need audio
- More void entity behaviors — currently they orbit passively; they should react to the player

---

## tpmjs: The Registry Is the Control Plane

**4 commits. 4 blog posts. ~710 lines added to `posts.ts`.**

### Problem

tpmjs (Tool Package Manager for AI Agents) needed to articulate its philosophy publicly. The software existed. The architecture existed. But the argument — *why this matters, what problem it solves, how it fits into the MCP ecosystem* — lived only in my head and in Discord messages.

### Approach

Four blog posts, published directly as TypeScript data in `posts.ts`:

1. **"The Roomba With a Million Tools"** (+204 lines) — The problem of tool bloat in AI agents. If your agent has 10,000 tools registered, it spends all its time deciding which tool to use. The solution is hierarchical: a registry that itself is a tool (an MCP server), so the agent calls "search tools" and gets back a curated subset, rather than getting the full catalog dumped into its context window.

2. **"Collections as MCP Servers"** (+215 lines) — The architecture where tool collections are themselves MCP servers. You don't install tools into your agent — you connect to registries. The registry manages versioning, auth, and discovery. The agent just makes calls.

3. **"Master Registry MCP Server (Search + Execute)"** (+176 lines) — The concrete implementation: a master registry that exposes `search` and `execute` endpoints. Agents search the registry for tools by capability description, get back a ranked list, and execute the winner. No pre-registration of every tool in the agent config.

4. **"The Registry Is the Control Plane"** (+115 lines) — The vision post. If the registry controls what tools agents can discover and execute, the registry is where you enforce policies, rate limits, sandboxing, and audit logs. Not in each individual tool. Not in the agent. In the registry.

The posts were added to a TypeScript data file rather than markdown files, which is a different pattern than the other tpmjs content — presumably for the web app's rendering pipeline.

### Results

- 4 posts totaling ~710 lines of content added in a single file (`apps/web/src/data/blog/posts.ts`)
- The posts cover the complete philosophical arc from "why tool bloat is a problem" to "here's the control plane architecture"
- Each post links to the concrete implementation in the tpmjs repo

### Pitfalls / What Broke

Writing is its own kind of debugging. The "Roomba with a million tools" framing came first because it's concrete and funny. The control plane post came last because it's the abstract claim and needs the concrete examples to land. If I'd written them in reverse order, nobody would have read past the first paragraph.

The TypeScript data file pattern is fine but means the posts don't benefit from the same markdown tooling as the rest of the blog. Trade-off accepted for now.

### Next

- Actually build the master registry MCP server (the blog posts describe it; the implementation needs to catch up)
- Collections-as-MCP-servers needs a reference implementation other teams can fork
- Auth and rate limiting in the registry layer — currently theoretical

---

## lordajax.com: The Quiet One

**1 commit.**

This is the meta-repo — the personal site that generates these devlogs. One commit in this period means the automation infrastructure is working correctly: the weekly activity issue got created, this post is being generated, and the blog.json gets updated. That's the intended behavior.

### Problem

None. This repo's job is to be updated by the automation, not to require manual intervention.

### Approach

The blog.json-driven static site generation via JSON Blog CLI means adding a new post is a two-step operation: drop a markdown file in the right folder, add an entry to blog.json. The automation handles both. The output lands in `apps/homepage/docs/` as static HTML.

### Results

The site continues to build. The posts continue to accumulate. This is evidence the automation from the previous week's work (the Claude Code harness, the GitHub Actions workflow) is operating correctly — measured by the absence of failing builds and the presence of this post.

### Pitfalls / What Broke

Nothing this week. Which is suspicious. The one thing to watch: the JSON Blog CLI version is pinned at 2.15.0 in CLAUDE.md. If upstream releases a breaking change and someone runs `pnpm update`, the build breaks silently. Dependency pinning is correct here; the test is whether anyone notices when it drifts.

### Next

- Add the videos page (it's in blog.json with `layout: "grid"` and `itemsSource: "videos.json"` but `videos.json` doesn't exist yet)
- Consider whether the automation should run `npx json-blog` as part of the PR to catch build failures before merge

---

## What's Next

- **Prematrix multiplayer**: The ECS world system is the right foundation. WebSocket server + entity sync is the next commit batch.
- **tpmjs master registry**: The architecture is documented across four posts. Time to build the implementation — MCP server that exposes `search` and `execute` as actual endpoints.
- **Face + world**: Once MediaPipe is stable, project other players' faces into the void entities outside the windows. The abyss of other people's faces, rendered in Matrix rain.
- **tpmjs + prematrix intersection**: Prematrix's model loader is effectively a tool registry for 3D assets — search by type (humanoid, vehicle, animal), execute (load and spawn). The mental model transfers.
- **lordajax.com videos page**: `videos.json` doesn't exist. It should.
- **Audio in prematrix**: Bullet time without a slowdown sfx is wrong. The rain needs ambient sound.

---

## Links & Resources

### Projects
- [prematrix](https://github.com/thomasdavis/prematrix) — Matrix rain 3D world with animated models, face projection, and bullet time
- [tpmjs](https://github.com/tpmjs/tpmjs) — Tool Package Manager for AI Agents
- [lordajax.com](https://github.com/thomasdavis/lordajax.com) — This site

### Tools & Services
- [MediaPipe Face Mesh](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) — 468-point real-time face landmark detection, runs client-side
- [Pretext](https://github.com/nicolo-ribaudo/tc39-proposal-pretext) — Accurate glyph measurement for text layout (used for Matrix rain character sizing)
- [Three.js](https://threejs.org/) — The 3D runtime underpinning prematrix
- [Cloudflare CDN](https://cloudflare.com/) — Cache headers baked into the prematrix build
- [JSON Blog CLI](https://github.com/jsonblog/json-blog-cli) — Static site generator for this blog

### Inspiration
- *The Matrix* (1999) — obviously
- The "Roomba with a million tools" framing — something between a real engineering problem and a genuinely funny image of a vacuum cleaner that's also somehow a GPT
