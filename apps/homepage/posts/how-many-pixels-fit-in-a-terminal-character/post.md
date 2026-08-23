# How Many Pixels Fit in a Terminal Character? Eight, Apparently

*Also: teaching bots to fight, and finally locking down a tool registry's environment variables*

Most of this week went into a real-time fighting game you play entirely over SSH. That sentence alone should tell you something about the constraints I was working under: no canvas, no WebGL, no frame buffer in the normal sense. Just a grid of monospace character cells and whatever escape codes the terminal on the other end is willing to honor. Everything about making that feel like an actual fight game came out of fighting that constraint, so that's most of this post. There's also a chunk of work on a tool registry for AI agents that's less flashy but matters more to anyone actually depending on it, so I'll close with that.

## Terminals don't have pixels, so I made some

A terminal is a grid of character cells. Each cell can be one glyph, one foreground color, one background color. That's the entire canvas. If you want something that looks like a fighter sprite instead of ASCII art, you need to cheat, and there are exactly two ways to cheat that are actually in wide use.

The first is real inline images: some terminals (Kitty, and a few others that speak its protocol) let an application send raw pixel data down the wire and have the terminal composite it as an actual image, positioned over the character grid. This is the "correct" answer, but it only works if the terminal on the other end understands the protocol, and even when it does, pushing image frames at a playable frame rate over an SSH session adds real bandwidth and latency cost. I got this working, but made it opt-in and trimmed it down, because forcing every connection to eat that cost by default was a bad trade for anyone on a slow link.

The second way is the trick every terminal supports, because it's just text: Unicode has block-drawing characters, and a background/foreground color pair on a single cell can already show two colors. The classic version of this splits each cell into an upper half and lower half — two "pixels" per character. I pushed it further using octant block characters, which subdivide a single cell into an eight-part grid (roughly a 2×4 arrangement) and let each piece independently be foreground or background color. That's eight addressable "pixels" out of one monospace character, using nothing but text a 1970s terminal could theoretically render.

The catch is that this only looks crisp at specific zoom levels. If your terminal cell is too small on screen, those eight sub-pixels blur into noise instead of reading as a shape — worse than just falling back to one solid block per cell. So the client actually measures its own effective cell size (`cellPx`) and picks a rendering strategy based on it: full octant detail when there's room, a simpler quadrant or solid-block mode when there isn't, and a plain "your terminal's too small, zoom in" notice at the extreme end rather than rendering mush and pretending it's fine. I went back and forth on where the cutoffs should sit more than once — an earlier version switched to pixel mode too eagerly and produced blurry sprites at very reasonable window sizes.

To keep both rendering paths — Kitty's real bitmap output and the octant-block fallback — from turning into two divergent codebases, everything draws through a single abstraction (internally called the Surface) that doesn't know which backend it's talking to. Every screen, from the character-select grid to the in-fight HUD, draws to a Surface, and the Surface decides at connection time whether that becomes actual pixels or block characters. That's the only way this stays maintainable: game logic that has to know "am I drawing pixels or cells right now" everywhere is a maintenance trap waiting to happen.

## Making a fight feel real-time when it's relayed through SSH sessions

Rendering is only half the problem. A fighting game lives and dies on input latency, and SSH adds a hop (client → relay → game server) that a browser game doesn't have to deal with. A few things went into clawing that latency back:

- **Client-side prediction.** Rather than waiting for the server to confirm your own inputs before showing their effect, the client applies your own moves immediately and reconciles later if the server disagrees. Your own character responds the instant you press a key; only your opponent's actions (which you can't predict) wait on the network round trip.
- **A worker-thread pool for rendering**, so one slow frame render doesn't stall every other match being simulated on the same process.
- **A multi-process cluster** (configurable worker count), so a single machine can run many simultaneous fights across cores instead of serializing everything through one event loop.
- **The PROXY protocol** between the edge relay and the origin server, so the game server sees players' real source IPs instead of the relay's IP for everyone — which matters both for abuse mitigation and for any future region-aware matchmaking.

Put together, the round trip for a cluster-hosted fight dropped by roughly an order of magnitude over the course of the week's changes, per the project's own load-test numbers — I don't have independent verification beyond that, so take it as a self-reported before/after rather than a benchmark I'd stake a claim on.

Not everything was additive. Cross-worker matchmaking (a global queue so players on different worker processes can still be paired) shipped with a bug where two different sessions belonging to the same player could get matched against each other, doubling up on internal messages and producing a fight against yourself. That's the unglamorous part of distributed systems: the queue worked fine as long as you assumed every entry in it was a distinct player, and that assumption was wrong exactly once in a while.

## Teaching a fighting game to be played by robots

A chunk of this week's work wasn't for human players at all. The game now exposes a structured "bot observation protocol" — essentially a machine-readable snapshot of game state (positions, health, active moves, timers) that a script can read over its SSH session instead of having to parse rendered terminal output. That turns the game into something closer to a reinforcement-learning environment (think OpenAI Gym, but the "gym" is an SSH connection) where a bot author can write a policy against structured state rather than screen-scraping.

Two things that make that useful rather than just possible:

**Replay forensics.** Every match can be logged and replayed deterministically, and there's now a dedicated tool for combing through those replay logs after the fact — useful for catching desyncs, verifying a bot's behavior matched its intended policy, or just understanding why a particular fight went the way it did. Determinism matters here specifically because a fighting game engine that produces slightly different outcomes from the same inputs is useless for training or debugging bots against.

**A deterministic policy search lab** for tuning one of the fighters (XENON) against a fixed opponent pool, and archived "validated offline training trajectories" — recorded match data other bot authors can train against without having to generate their own. This is small-scale compared to actual RL infrastructure, but the shape is the same one you'd recognize from any policy-search setup: fix the environment, fix the evaluation opponents, vary the policy, keep what wins.

One more piece worth a mention because the idea behind it is genuinely useful outside games: match evidence in the ranking system got reworked to weight by velocity — meaning a run of quick, decisive results counts differently than the same win/loss record spread out slowly. The underlying idea (Weight of Evidence) comes from credit scoring, where it's used to measure how much a given signal shifts the odds toward one outcome versus another, on a log-odds scale that composes cleanly across signals. Applying that lens to match results — instead of just tallying wins and losses — is a reasonable way to make a ranking system react faster to a player or bot that just went on a run, without overreacting to noise from a long, quiet history.

## The other side of trusting the terminal

One more note from this project because it's a good example of a class of bug: SSH terminal apps generally trust whatever "capability" responses the connecting terminal sends back during negotiation (things like "yes, I support truecolor" or "yes, I support the Kitty graphics protocol"). Nothing stops a misbehaving or malicious client from sending back a much larger response than any real terminal would ever produce. Left unbounded, that's a denial-of-service vector — the server naively buffers whatever comes back. The fix was simple once spotted: cap how much of that response the server will read, full stop. It's the same category of bug as an unbounded request body — the fix is boring, but skipping it isn't optional.

## tpmjs: locking down what a tool execution can see

The other project this week is a package registry specifically for AI-agent tools — think of it as a way for an agent to `import` a capability (send an email, post to Discord, generate an image, search the web) as a versioned package rather than everyone hand-rolling their own integration. New tool packages landed for things like managing a YouTube channel and reading/writing shared "agent memory" against an external memory service.

The more interesting work was on the execution side, where three separate fixes tightened up what a running tool can actually access:

- Injected environment variables (API keys, tokens, whatever a tool needs to do its job) are now scoped to the single execution they were injected for, and executions are serialized rather than sharing a process concurrently. Before this, if two tool executions ran on the same worker process at overlapping times, there was a window where one execution's environment could leak into another's — not because anything was reading it maliciously, but because "current process environment" is a single shared piece of global state, and two logically separate tool calls sharing a process is exactly the setup that turns shared mutable state into a bug.
- Nothing gets logged from the environment values themselves anymore — a policy fix as much as a code fix, since the easiest way to leak a secret is to have accidentally put it in a log line during debugging and never taken it back out.
- The module cache key for a package now includes its version. Node module caches are normally keyed by resolved file path; if a tool package publishes a new version but the executor's cache doesn't know that "version" is part of a package's identity, a stale copy of the old code can keep running under the new version's name. That's a subtle one, because everything looks correct from the outside — the registry says version 2 is live — while the executor is quietly still running version 1's code.

None of these are exciting on their own, but they're the kind of fix that matters more than most feature work once other people are actually trusting a shared executor with their credentials. A monitoring dashboard also went in — health-check backoff and role management for admins — which is the unglamorous but necessary companion to "we run other people's code."

Two different projects, two different kinds of eight-hour days: one where the interesting problem was making pixels lie convincingly, and one where the interesting problem was making sure a shared execution environment couldn't lie to itself.

_This devlog was written by AI from my public GitHub activity._
