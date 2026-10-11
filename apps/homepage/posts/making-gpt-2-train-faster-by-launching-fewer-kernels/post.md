# Making GPT-2 train faster by launching fewer kernels

_Plus: bode learns to see images, check its own work, and forget on request._

Most of my week went into two private repos: Alpha, a from-scratch Haskell compiler and GPU runtime that trains models, and bode, a multi-user agent system with plugins, memory and a CLI. Alpha was a long grind on one question: how do you make a GPT-2 training step cheaper when the math is already fixed? bode was about letting agents handle images, prove they finished a task, and delete what they remember. Two other repos got a single small change each, so I'll skip them.

## Alpha: the same math, fewer trips to the GPU

**The goal.** Alpha compiles its own GPU code. This week it trained GPT-2 small (124M parameters) on an H100 and on an RTX 3070. I wanted that run to go faster and stay bit-identical to the previous version, because if a speedup changes the numbers, I can't tell an optimization from a bug.

**The cost of a kernel launch.** A GPU kernel is a function run across thousands of threads. Every launch has overhead, and every kernel writes its results to global memory so the next one can read them back. In a transformer, many small operations sit between the big matrix multiplies: LayerNorm, bias sums, activation gradients, gradient clipping. Run each as its own kernel and you spend much of your time on launches and memory round trips instead of arithmetic.

Most of the week's work was **fusion**, in three flavours:

- **Epilogue fusion.** A matrix multiply produces a tile of output in registers. If the next step is pointwise (add a bias, apply GELU), do it before that tile is written out. The activation then comes for free in the multiply's epilogue, and the intermediate tensor never exists in memory. I did this for the feed-forward activation, for writing query and key heads straight from the projection, and for storing the value gradient directly into the projection gradient.
- **Batching across windows.** An update processes four windows of tokens. Instead of launching the same kernel four times, I made one launch handle all four: the forward pass, the row-wise pullbacks (the backward step), the weight gradients, and the bias and LayerNorm-parameter sums. Several of those became one grid, which is the whole set of thread blocks in a launch.
- **Folding reductions together.** A reduction like "sum this column" can be finished in the same kernel that already visited every element. The LayerNorm pullback now also forms its gain and shift partials, and the activation pullback does the bias sums for the expansion layer. The loss pair and the gradient norm's tail went from several launches to one.

The best single trick was applying the gradient clip factor inside AdamW. Gradient clipping normally scales every gradient by `min(1, max_norm / norm)`, which is a full pass over all gradients. But AdamW reads each gradient anyway to update its moments, so it can multiply by the clip factor on the way in. That removes a whole pass.

**Overlap and cache tricks.** Some work moved onto "side warps". A warp is 32 threads that execute together. Giving the next block's AdamW update its own warps lets it run beside the forward products instead of after them. I also split the big vocabulary product into L2 bands, so the part of the weight matrix a group of blocks reads fits in the GPU's L2 cache. This is memory locality, not less math.

**Results.** I measured one step going from 58.9 ms to 51.3 ms per update on the RTX 3070, bit-identical. Later fusions pushed that card to 24.2k tokens per second with four windows per update. I didn't re-measure the full H100 run end to end, so I won't give a number for it. I did add a like-for-like comparison against llm.c and PyTorch on one H100. I'm not going to summarise its results from memory, because I'd likely get them wrong.

**Making it checkable.** Optimizing against "bit-identical" needs reference points, so I extended a PyTorch oracle script. It now rounds attention probabilities to half precision as the device does, and it can round product cotangents to bfloat16. Probes compare the pullback's cotangents and the forward's values against it. Without that, I'd be guessing which fusion changed a number.

**Training and serving.** The recipe now follows llm.c's 124M setup on FineWeb: a scheduled learner and 128-pass updates. A controller runs HellaSwag every few checkpoints. HellaSwag scores multiple-choice sentence endings by the model's likelihood of each, so I made the GPU score every position and compute the metric the way llm.c does. I also fine-tuned a persona variant, and a chat page serves it next to the earlier models. The chat server now speaks OpenAI's chat-completions shape too, never returns NaN in a reply, and handles empty continuations.

**Compiler fixes.** Compiler work was mostly SM86 (the RTX 3070's architecture) register allocation, plus a refusal to emit global-access offsets that the card would read as negative. That one is a quiet-corruption bug turned into a compile error, which I prefer. CI also got sharded across parallel jobs, and I removed gates for a retired model.

## bode: images, verdicts, and forgetting

bode is the agent system. This week's themes: let models see, don't trust "I'm done", and let people delete memory.

**Images and files.** Messages can now carry attachments, from the web composer or the CLI (`--attach`, `/attach`, and `bode artifact get` to download). Not every model can see, so the router sends images to models that can and a text stand-in to the others. The answer says what the model couldn't see. When an image is too large for a model, the worker makes a resized rendition once, using sharp, records it as derived from the original, and tells every client a smaller copy was sent. Downloads are checked against the digest bode names, so a corrupted artifact fails loudly.

**Don't believe the agent.** An agent's claim that a task is complete is now checked before it counts. A "verified" loop has a verifier judge each answer before the run ends, and verdicts show up in the conversation, on tasks and in diagnostics. Execution loops, routing and verifiers are now plugin kinds, with default implementations that behave as before. A judgement waits for the run's allowances (budgets) the same way a model step does, so a verifier can't quietly overspend.

**Running other people's loops.** Uploaded loops and verifiers run in a child process, and the host performs their capabilities over IPC. Only uploads from people the operator names run on bode's servers. The CLI can scaffold and test them (`bode plugin new`, `plugin test` against fixtures). This is process isolation plus an allowlist of uploaders. It is not a hardened sandbox, and a hostile uploader isn't what it's built for.

**Memory and deletion.** HAM and other memory servers can hold a session's memory, each scope kept to its own label. Deleting a session records a request to forget on each external memory server. The worker retries with backoff, and people can see those requests on the memory connections page. The hard part is that "delete" now spans systems I don't control, so the honest design is a durable request that retries until it's confirmed, not a delete call that hopes.

**Observability.** The API, worker and web app now send traces, metrics and scrubbed errors, and a run keeps its trace across the job queue and out to its device. Content is scrubbed out. A run also no longer waits forever for a device.

## The rest

The proofs service, a separate corner of the blah.dev repo, got immutable daily leaderboards, rank history, compressed large artifacts and rate-limited importers. SSH mail got public boards and expiring identity sessions. I'm not going to claim more about those than that.

_This devlog was written by AI from my GitHub activity._
