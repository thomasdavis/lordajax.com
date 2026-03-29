# A Week of Writing the Manifesto for AI Tool Infrastructure

*Four blog posts, one tweet URL regex, and the slow realization that the architecture needs more essays than code right now.*

There's a thing that happens when you've been building for long enough in one direction: you stop shipping features and start writing. Not documentation — manifestos. Vision pieces that are half-persuasion and half-self-clarification. That's what this week was. Four blog posts in tpmjs, all circling the same question from different angles: what does it actually mean for a tool registry to be the control plane for AI agents? I wrote about the master registry MCP server, collections-as-MCP-servers, a piece called "The Roomba With a Million Tools" that gets at the absurdity of agents that have access to everything without any sense of when to use what, and a straight vision post on why the registry is the thing that matters. lordajax.com got one fix: tweet URL slugs that were broken because the URL derivation didn't match the blog generator's slugification. Small week by commit count. Not a small week by thought.

## Why You Should Care

- **4 new blog posts landed on tpmjs** covering the master registry MCP server architecture, collections as first-class MCP server primitives, the "too many tools" problem in AI agents, and the registry-as-control-plane vision
- **The "Roomba With a Million Tools" post** (204 lines, ~2000 words) names a real problem that anyone building agentic systems has hit: an agent with unbounded tool access is worse than one with curated access
- **Collections-as-MCP-servers** is the architectural insight that lets you scope tool access per-agent or per-task without rebuilding your registry from scratch
- **lordajax.com's tweet URL generation fixed** — post titles now get slugified the same way the blog generator does it, so tweet links actually work instead of 404ing

---

## tpmjs — Four Posts, One Architecture

**Problem:** tpmjs has been shipping code — MCP servers, CLI tooling, registry infrastructure — but the conceptual model behind it hasn't been written down in a way that's useful to anyone who isn't me. The question "why would I use this instead of just putting tools directly in my agent config" is legitimate, and I kept not having a good answer I could link to. Four different angles of the same question, all needed simultaneously.

**Approach:** I wrote four posts and pushed them to `posts.ts` in the tpmjs web app. Here's what each one actually argues:

*Master Registry MCP Server (search + execute)* (`44da83f`, +176 lines): The first post covers the registry-as-MCP-server pattern — you point your MCP client at `tpmjs.com/mcp` and you get search + execute capabilities over the entire tool registry. The key insight here is that the MCP protocol is a thin transport, and the registry is where the actual index lives. You don't need to know what tools exist ahead of time; you search, you discover, you execute. This is the feature that makes tpmjs feel less like "a place to store tools" and more like an operating context for agents.

The post is honest about what this requires: the registry has to be authoritative. If the tool index is stale or incomplete, the MCP server degrades gracefully (you get fewer results), but you've lost the main value proposition. Garbage in, garbage out, but with more words around it.

*Collections-as-MCP-Servers* (`f72ef0e`, +215 lines): This is the one I'm most pleased with architecturally. The insight is that a "collection" — a curated subset of tools, e.g. "all the tools a backend engineer needs for database work" — can be served as its own MCP endpoint. Your agent connects to `tpmjs.com/collections/database-ops/mcp` and gets a scoped tool manifest. This solves the tool explosion problem without requiring the agent to do any filtering itself.

The interesting design decision here: should collections be static (defined at creation time) or dynamic (rebuilt on each request based on current registry state)? I argued for dynamic with a snapshotting option. Static collections go stale. Dynamic collections can be unpredictable. Snapshots give you reproducibility when you need it.

*The Roomba With a Million Tools* (`a313917`, +204 lines): This is the post that names the failure mode most clearly. A Roomba that has the motor capabilities of a fighter jet, the cleaning attachments of an industrial factory floor machine, the navigation system of a deep-sea submarine, and the tool drawer of a hardware store — and is trying to vacuum your living room — is not a better Roomba. It is a confused, paralyzed, probably dangerous system. This is what most agentic setups look like today. The agent has 200 tools loaded. It picks the ones it recognizes from training. It ignores the rest. You've got 197 tools doing nothing except confusing the context window and slowing down tool selection.

The argument in the post: tool access should be intentional. The registry is how you make it intentional without making it manual. Collections, permissions, and search replace the current status quo of "dump everything in the config and hope the LLM figures it out."

*The Registry Is the Control Plane* (`951c6d6`, +115 lines): The shortest of the four, and the most direct. This is the vision post. The claim: in a world where agents are orchestrating other agents, the tool registry is the thing that determines what any given agent can do. Not the system prompt. Not the model. The registry. If you control what tools are discoverable and executable, you control the agent's capabilities at runtime. This is the infrastructure play — the registry isn't a npm for tools in the "convenient package manager" sense. It's the thing that a distributed system of agents calls to understand what they're allowed to do and how to do it.

The challenge writing this one was not making it sound like marketing copy. "The registry is the control plane" could mean absolutely nothing or it could mean everything depending on how seriously you take the premises. I tried to ground it in concrete architecture: what does it actually look like to have an agent call the registry to get its tool manifest vs. having the tools baked into the agent's config? What changes when the registry is the source of truth?

**Results:** 710 lines added to `posts.ts` across four commits (tracked directly in the diff). Each post runs roughly 1500-2200 words. That's approximately 7000 words of architecture writing in one week — measured by the line counts and a rough words-per-line estimate. The posts are live on the tpmjs site; click rates and read time aren't instrumented yet, so "useful" is currently vibes-based.

**Pitfalls / What Broke:** Writing as a substitute for shipping is a trap I'm aware of. Four blog posts do not replace the actual work of making collections-as-MCP-servers work in the product — that still needs implementation. The posts are partly persuasion, partly forcing myself to have opinions concrete enough to implement. But there's a risk of ending up with a beautifully articulated architecture that I never actually build. The "Roomba" post in particular names a problem that tpmjs doesn't fully solve yet: the discovery UX for finding the right collection is still unclear.

Also: writing four posts in one week means at least one of them was rushed. My bet is the registry-as-control-plane post at 115 lines is the thin one. It makes the claim and gestures at the implications but doesn't go far enough into the mechanics of how you'd actually implement access control at the registry layer. Follow-up work needed.

**Next:**
- Implement collections-as-MCP-servers in the actual product, not just the blog post
- Add read-time metrics to the tpmjs blog so I know which posts are getting read vs. bounced
- Write the follow-up to the control plane post that goes deeper on the access control mechanics

---

## lordajax.com — Tweet URLs That Actually Work

**Problem:** The automated tweet-on-publish script was generating URLs that 404'd. The script was deriving the tweet URL from the post title, but the URL it generated didn't match the slug that the JSON Blog CLI actually produces for that post. Specifically, the slugification in the tweet script used one approach (likely a simple lowercase + hyphenate transform) while the blog generator used a slightly different one. The result: tweets linking to broken URLs, which is roughly the worst possible outcome for automated post promotion.

**Approach:** One commit (`fix: derive tweet URLs from post title to match blog generator slugs`, +9/-23). The fix was net negative on lines, which is the best kind of fix. The tweet script was simplified to use the same slugification logic as the blog generator — removing the old custom slug derivation and replacing it with whatever the generator actually produces.

The -23 lines is the interesting part here. That's not just replacing one function with another; it suggests there was some accumulated complexity in the URL generation path (possibly fallbacks, manual overrides, or edge-case handling) that turned out to be wrong. Simpler and correct beats complex and broken.

**Results:** Tweet links now point to URLs that exist. Measured by: the script generates a URL, you open it, the post loads. Low bar, but the previous behavior was failing it. The net -23 line count is the concrete artifact — the file is smaller and more correct than before.

**Pitfalls / What Broke:** The fix was reactive: the broken URLs had presumably been generating for some previous posts without anyone catching it. That means there are likely already-sent tweets with dead links in the wild. Not fixable retroactively, and probably not worth worrying about given the audience size, but worth noting. The test coverage here is zero — no automated test verifies that the slug derivation matches the blog generator output. If the generator changes its slugification logic in a future update, this breaks silently again.

**Next:**
- Add a quick sanity-check in CI that generates a slug from a test title and verifies the URL is reachable (or at least matches the expected format)
- Consider whether the tweet script should pull the actual generated URL from the build output rather than deriving it from the title at all

---

## What's Next

- **Implement collections-as-MCP-servers**: The blog post exists, the architecture is clear, now build the thing. This means the registry API needs a `/collections/:slug/mcp` endpoint that returns a filtered tool manifest.
- **Instrument tpmjs blog read time**: Four posts went out this week and I have no idea if anyone read them. Even basic analytics would tell me whether to keep writing or to stop and ship features instead.
- **Control plane access control deep-dive**: The vision post punts on the hard question — how do you enforce registry-based permissions when the agent is making tool calls through a third-party MCP client? Write or implement the answer.
- **Fix the tweet URL CI gap**: No test catches slug drift between the tweet script and the blog generator. One test, one check, would prevent the silent failure mode from recurring.
- **The Roomba post wants a demo**: The argument is compelling in prose but a side-by-side of an agent with 200 tools vs. one pointed at the right collection would make it empirically demonstrable. Build the benchmark.

---

## Links & Resources

### Projects
- [tpmjs](https://github.com/tpmjs/tpmjs) — Tool Package Manager for AI Agents
- [lordajax.com](https://github.com/thomasdavis/lordajax.com) — This blog, automated weekly devlog pipeline

### Tools & Services
- [JSON Blog CLI](https://github.com/jsonblog/json-blog-cli) — Static site generator used for this blog; the source of the slugification logic that the tweet script now matches
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — The protocol that makes tool registries addressable by AI agents

### Inspiration
- The "Roomba With a Million Tools" framing came from watching an agent spend 15 tokens deciding between `write_file` and `create_file` when both do the same thing — tool bloat has a real cognitive tax on the context window
- Anthropic's MCP documentation on dynamic tool discovery — the idea that tools should be discoverable at runtime rather than baked in at deploy time is the premise behind everything in the tpmjs vision posts
