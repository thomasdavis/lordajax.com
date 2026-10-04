# Polling a GPU Fence Every 20 Microseconds Instead of 1 Millisecond

_The cheapest speedup of my week was changing a number. The expensive part was proving it was real._

This week was two projects: **alpha**, a from-scratch Haskell compiler and GPU runtime that trains a small language model I call Baguette, and **blah.dev**, a pile of web apps where the main thing that grew was a proofs site for Lean statements. alpha is where the interesting ideas were, so it gets most of the words.

## alpha: making a training loop faster, and not lying about it

The goal was simple. Baguette trains on a single RTX 3090, and I wanted more tokens per second and less energy per token. The more interesting goal was that every claimed improvement had to survive a check I couldn't talk myself out of.

### The 1 ms sleep

The host program submits GPU work, then waits on a **fence**: a flag the GPU sets when a batch of commands is finished. The CPU has to notice the flag. I was polling it once per millisecond, which sounds fast until you remember a training step is made of many small submissions. Each time the GPU finished early, it sat idle until the CPU's next look.

Polling every 20 microseconds instead gave about +7.4% tokens/s and about -3.1% joules per token in the measured runs. There is a cost: a tighter poll loop burns more CPU. The energy number is the argument that it's worth it, because GPU energy dominates. That's a result from one card and one workload, not a general law.

### Kernels, one idea at a time

The rest of the speedup came from kernel scheduling changes. Each was qualified separately, and the improvements stacked:

- **Saved-forward blocks computed in their own slots.** Backprop needs activations from the forward pass. Instead of recomputing or shuffling them, the forward pass writes into pre-assigned workspace slots that the backward pass reads directly.
- **Shared-memory attention.** Attention reads the same key and query tiles over and over. Staging a tile in on-chip shared memory once, then reusing it across the threads in a block, trades one slow global-memory read for many fast ones. I did this for the forward pass and for the query backward pass.
- **Heads-fastest, heavy-first block ordering.** The GPU launches thread blocks roughly in grid order. Causal attention is lopsided: a query late in the sequence attends over more keys than an early one. If the heavy blocks launch last, you get a tail where a few slow blocks run alone and most of the chip idles. Launching the heavy ones first fills the gaps with light ones, a classic longest-job-first schedule. Making the head index the fastest-varying grid axis keeps blocks that share keys adjacent.
- **Grouped normalization and compacted stalls.** Row normalization launches were derived from checked block geometry rather than hand-picked, so a change to block size can't silently leave rows uncovered or double-counted.

Each of these was measured against its own baseline, so I'm not going to add the percentages into a headline. I haven't re-measured everything end to end on one clean comparison.

### Why most of the work was checking

A faster kernel that's subtly wrong is worse than a slow one, so most of the week went into the evidence machinery:

- **Matched runs.** A candidate and a baseline train for the same number of updates from the same checkpoint on the same data window. Throughput only gets published when GPU state is validated as matching.
- **A CPU oracle.** For complete decoder gradients and complete updates, an independent CPU implementation computes what the numbers should be, and the CUDA result is compared against it. Several candidate kernels were recorded as rejected, with the evidence kept, rather than quietly dropped.
- **Late-read hazards.** One class of bug I spent real time on: a kernel reading an operand before the write that produces it has landed. The fix was to check instruction ordering explicitly, and to reject swapped grid axes in attention selection.
- **Energy as a measured quantity.** GPU power is sampled continuously during qualified windows, and the energy figure is bound to the verified output of the run it measured. If the output didn't verify, the energy number doesn't get to exist. Device timestamps are gated the same way.

The shared rule is that a number only ships with a receipt. If I can't point at the receipt, the dashboard doesn't show it.

### Training that survives restarts

Training runs on rented pods, which get interrupted. A lot of work went into making a restart a non-event:

- **Resumable windows.** The corpus is tokenized with the released tokenizer into windows tracked by a durable cursor, so a resumed run continues in distinct data rather than replaying what it already saw.
- **Checkpoint checks.** A checkpoint is only trusted if its counters line up with complete input boundaries and every value is finite. A fresh process loads it and continues deterministically through a hundred updates before I believe the continuation.
- **Storage across volumes.** Archives can route across several verified volumes, and old cache bodies are released only after the data needed for continuation is safely retained.
- **Milestone inference.** At milestones, a fixed prompt suite runs through the checkpoint and the results are shown beside the training curves, with prompt, response and commentary kept separate.

The dashboard also gained live training-time estimates against the Chinchilla rule of thumb (roughly 20 tokens of training data per parameter for compute-optimal training), per-metric charts, and a rebuilt website with one page width.

## blah.dev: a proofs site that has to be read by people

The other big slice was the proofs app: a place to publish Lean statements, link them to what they depend on, and see what's proven.

### Making Lean readable

Lean statements are dense, full of Mathlib notation. Two things helped:

- **Typesetting.** Statements render as mathematics, and a floating note explains each piece of notation. Long formulas break across lines, and cards break formulas to fit on a phone.
- **Whole-statement pages and a Yours/Everyone switch.** One switch controls whether you're looking at your work or the shared library, and pages say whose work they're showing.

### Linking statements to what they unlock

A link between two statements is a claim that one fits into the other. Checking that costs verifier time, so the frontier now sorts by what a proof would unlock, and each link check reports what it **leaves over**, a "residue". A link that leaves a variable unfilled pins down nothing, so it doesn't count. A residue never counts the statement it just linked.

### The verifier is the bottleneck

Lean verification is expensive, and a bulk import of thousands of theorems can starve everyone else. The verifier keeps Lean's compiled foundation resident in memory, runs five slots, caps bulk imports at four, and lets link checks wait. A module cache serves already-compiled modules; I haven't measured its hit rate yet.

### Smaller things

- **Bode**, the session viewer, got lighter: session tabs load a small overview, conversations open at the newest message, and long tool output is previewed and folded.
- The MCP connect page now lives at blah.dev/mcp, and every proofs API operation is exposed as an MCP tool.
- **Meet** got a low-power mode and some MSN Messenger-style call sounds, because I am who I am.

## The other repos

The activity data lists two more repos this week, donto-infra and ham. I have no detail on what changed in them, so I'm not going to guess.

_This devlog was written by AI from my GitHub activity._
