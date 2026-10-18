# A compiler that checks its own mutants

*Alpha's test gates learned to break the code on purpose, without breaking my checkout.*

Most of this week went into Alpha, my all-Haskell model-training compiler and GPU runtime. The rest was small: a mail client's read state, a room music library, and a language-translation site. Here is what each was trying to do and how it went.

## Alpha: proving the tests can fail

Alpha has "gates": checks that must pass before something merges. A gate is only worth anything if it fails when the code is wrong. So several of them use **mutation testing**. You deliberately break the source in a small way (a mutant), run the check, and confirm the check goes red. If a broken program still passes, the gate is decoration.

The problem was where the mutants lived. The old approach wrote the broken code into the tracked file, ran the check, then restored it. If a run crashed halfway, my working tree was left corrupted. It also meant only one mutant could run at a time, because they all fought over the same file.

The fix had three parts:

- **Workspace copies.** Each mutant gets its own copy of the workspace and is written as a new file, never into a tracked one. A crash can only leave a stray directory behind.
- **Hard links.** Copying a big tree four times is slow. A hard link is a second directory entry pointing at the same bytes on disk, so the copy is nearly free. The catch is that writing *in place* through one link changes every link. So the gates also check for in-place writes, and restore mutated sources by replacement (write a new file, swap it in) rather than editing the old one.
- **Same filesystem.** Hard links can't cross filesystems, so the copies have to live on the workspace's own one.

With that, the proof mutants run four at a time. Whether CI got faster overall, I haven't measured.

I also scoped CI. It now runs on pull requests only, gates are scoped to GPT-2 on the RTX 3070's architecture (SM86), and every other gate runs on demand. The Hugging Face publish job is gone, so CI publishes nothing.

## Alpha: a faster evaluator

Alpha is a dependently-typed language, so its compiler spends time *reducing terms*, meaning evaluating programs at compile time. A lot of the week went into making that cheaper:

- A **compiled weak-head evaluator** using call by need. Instead of re-walking the syntax tree for every step, it translates terms once into a form that is cheap to run, and evaluates each argument at most once, only when needed.
- **Sparse environments** in place of finger trees. A finger tree is a good general sequence structure, but most environments here are small and mostly read, so a plainer layout wins.
- **Strict fields and state** on hot paths. Haskell is lazy by default, and a lazy accumulator builds a chain of unevaluated thunks that costs memory. Making the hot fields strict stops that.
- **Content-keyed caches.** Module interfaces are cached by hash of their content, so workspaces share one cache. Digests are trusted by file stamps (size and modified time), the same rule git's index uses to skip rehashing unchanged files. Caches also evict down to seven eighths of their bound once they pass it, so one insert doesn't trigger a purge on every subsequent insert.
- **Node counting only on request.** Counting unique nodes in a closure was a cost everyone paid for a number few wanted. It's now behind a flag.

I don't have before/after timings in front of me, so treat these as intent rather than results.

## Alpha: the Witton system

A fun side branch: I encoded a hep-th paper's sign errors as *checked claims*. The criticisms of the paper became data, a ledger program tracks them, and mechanisms decide the decidable ones, including the Chern-Simons scaling of one equation. The idea is that "this equation has a sign error" shouldn't be an opinion in a PDF margin; it should be something the machine can confirm or refute.

## Alpha: training real models on a 3070

Two model efforts moved:

- **Diakosmos**, a byte-level model with a harmonic-flavored architecture, now trains on the RTX 3070 in Alpha itself. The discipline was: write a reference model from the equations, then make the GPU forward, gradient and optimizer update each match the reference before trusting them. A causality check confirms position *t* can't see the future. The run finished at 1.4194 bits per byte after 24.5 GPU hours. It also got a chat fine-tune, a CPU stand-in that the page labels honestly when it answers instead of Alpha, and a watchdog that restarts the driver and chat server after the pod restarts.
- **GPT-2 vs nanochat.** I wrote a plan to compete with nanochat's GPT-2 speedrun on 8×H100, recorded baselines of nanochat's record config on H100s, and built a speedrun model with its components. The baseline work was a measuring stick, and the model landed "honestly", which in practice means I recorded what it does, not what I hoped. Host reliability work (native hashing, picking the driver's branch at run time, naming the card) came with it, as did an architecture package for sm_90 replacing a byte-rewrite hack.

Also in flight: unified telemetry integrated onto main, and still marked not ready, with its unresolved parts written down in a handoff note.

## blah.dev

Three things. People and agents can now leave corrections on ideas in the proofs area. The room music library is back in the meet feature. And proofs exports are packed into a shared table that is rebuilt byte for byte on read, which saves disk at the cost of CPU on reads. A daily timer does the packing and pauses when the host is short on memory, and the table cache defaults to 256 MiB (64 MiB for our own site). A contributor also landed a watch-together feature.

## sshmail

This is Roland's project, and my activity there was around read state: tracking it per reader rather than globally, counting public board posts as unread, and making only the plain inbox mark messages read. Opening a conversation in the TUI marks it read, and send keeps your message as typed. The point of per-reader state is that two people reading the same board shouldn't clear each other's unread count.

## mobtranslate.com

A big merge restored Kuku translation, the free-form translator went back on the homepage, and the translation checker got a bigger output budget so it stops cutting off mid-answer. The spear and woomera page grew into a wood-by-wood workshop, with period terms in the Roth quotations neutralised. Atlas, Map, Spread and Models moved from the top bar to the footer.

## ham and donto-infra

ham is a fork of a shared PostgreSQL memory server for agents. I merged upstream and made agent activations queue without needing pgcrypto. donto-infra had one change, and it isn't worth narrating.

_This devlog was written by AI from my GitHub activity._
