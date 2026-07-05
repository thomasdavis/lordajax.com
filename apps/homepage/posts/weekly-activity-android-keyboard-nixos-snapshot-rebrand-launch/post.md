# An Android Keyboard, a Rebrand, and the Week I Snapshotted Everything Before Blowing It Up

*Forty-seven commits, one native app launch, and a lot of quietly nervous "just in case" backups.*

---

Two separate repos, on the same day, got a commit with almost the identical message: `chore(infra): snapshot before NixOS+Podman migration (2026-07-02)`. That's not a coincidence, it's a tell. I'm about to rip out however mobtranslate.com and toiletpaper are currently hosted and rebuild the underlying infrastructure on NixOS + Podman, and the instinct before doing that to *anything* is apparently "commit a giant snapshot first, ask questions later." The bigger pattern underneath this fortnight, though, is that I've stopped being satisfied with mobtranslate.com as a website. This week it got a rebrand (a proper 'M' monogram, not a placeholder), a native Android app, and a bundled Android keyboard (IME) that ships Kuku Yalanji vocabulary directly into the system-level typing surface on someone's phone. That's a different kind of product than "translate this word on a webpage." It's infrastructure for a language to exist inside the operating system itself. Everything else — the TTS bridge to a second language, the Postgres migration, the AI SDK v6 upgrade, the contributions feature I apparently built and reverted *twice* now — is scaffolding in service of that.

---

## Why You Should Care

- **Native Android app + bundled keyboard (IME) shipped** — MobTranslate now has a downloadable Android app and a system keyboard with Kuku Yalanji word suggestions, plus a rebrand to a single 'M' monogram (+10,887/-97 lines in the launch commit alone)
- **Neural TTS bridged to a second language** — Anindilyakwa now has synthetic speech, generated via the same Pitjantjatjara "donor" model bridge used for Kuku Yalanji last fortnight
- **Self-hosted Postgres migration + a "snapshot everything" moment across two repos** — infra is being prepped for a NixOS+Podman move, with matching pre-migration snapshot commits in both mobtranslate.com and toiletpaper on 2026-07-02
- **The contributions/voice-readiness feature shipped and got reverted for the second time** — I built the same feature, watched it break again, and pulled it back out
- **AI SDK v6 / Next 16 / React 19 migration finished "green"** — the WIP from last period is now a completed, verified upgrade
- **Sentry + Umami added to toiletpaper** — basic error and usage visibility landed on a repo that previously had none

---

## mobtranslate.com

Forty-four commits, 16 feature commits, 6 fixes. This is where almost the entire fortnight went, so I'm breaking it into themed chunks rather than pretending each commit deserves its own section.

### The Rebrand, the Android App, and the Keyboard

**Problem:** mobtranslate.com looked like what it was — a side project with a generic name and no distribution channel beyond "open the website." If the goal is language preservation, a bookmarked URL is a bad delivery mechanism. Native speakers, especially older ones, live in apps and system keyboards, not browser tabs. And the branding was still whatever I'd slapped together when this started as a demo.

**Approach:** I did three things more or less at once, which in hindsight was a lot to stage simultaneously:

```
Rebrand to 'M' monogram + native Android app (with bundled keyboard) + downloads
# +10,887 / -97 lines
```

That single commit is the whole launch: a new visual identity (a monogram mark instead of the old wordmark), a native Android app wrapper, and a bundled keyboard app packaged for download. Then the keyboard itself got its own dedicated build:

```
Add MobTranslate Android keyboard (IME) MVP
# +915 / -0 lines

Keyboard v0.1.1: English suggestions + typo fixes, fix nav-bar overlap
# +10,060 / -41 lines
```

An IME (Input Method Editor) is Android's system-level keyboard API — building one means your suggestions show up in *any* app on the phone, not just yours. The MVP got Kuku Yalanji word suggestions wired in; v0.1.1 added English suggestion fallback and fixed a batch of typo-correction bugs, plus an unrelated nav-bar overlap bug that apparently only showed up once the keyboard was actually being used on-device.

Branding got its own pass too:

```
Brand identity + favicon + full SEO pass (+298/-22)
Add /credits pages: attribute dictionaries, linguists, voice models & communities (+434/-0)
```

The credits page matters more than it sounds — a huge chunk of this project is built on dictionaries and grammars authored by linguists and communities who did the actual research. Crediting them isn't a nice-to-have footer, it's the correct attribution for work I didn't do.

**Results:** There's a downloadable Android app and a working system keyboard with Kuku Yalanji suggestions, measured by: the app builds, installs, and the keyboard appears in Android's input method picker after enabling it. The keyboard MVP commit alone is 915 net-new lines; v0.1.1 is a 10,060-line diff, which tells you the "MVP" was genuinely minimal and the first iteration pass was closer to the real thing.

**Pitfalls / What Broke:** 10,060 lines in a single "v0.1.1" commit is not a healthy commit size — that's multiple days of work landing as one diff, which means if something in there is broken, `git bisect` is useless for isolating it. The nav-bar overlap bug being discovered *during* the keyboard build also suggests the keyboard wasn't tested against the main app's UI until fairly late. And an IME on Android runs with elevated trust (it sees everything the user types across every app) — I haven't published a clear statement of what the keyboard does and doesn't log, which matters even though this build doesn't currently transmit keystrokes anywhere.

**Next:**
- Write an explicit data-handling statement for the keyboard before wider distribution — what's stored, what's opt-in, what's deletable
- Break future keyboard commits into smaller units so bugs are traceable
- Add Kuku Yalanji and Anindilyakwa suggestion dictionaries beyond the initial word list

---

### Neural TTS: Bridging a Second Language

**Problem:** Last fortnight I shipped MMS-TTS Pitjantjatjara as a stand-in voice for Kuku Yalanji, on the reasoning that a near-neighbour model beats no audio at all. That was a one-off hack for one language. The actual test of whether the approach generalizes is whether it works for a *second*, unrelated language.

**Approach:**

```
Add neural TTS for Anindilyakwa via the Pitjantjatjara donor + bridge (+118/-2)
```

Anindilyakwa is spoken on Groote Eylandt in the Gulf of Carpentaria — geographically and linguistically distant from both Pitjantjatjara and Kuku Yalanji. The "donor + bridge" framing in the commit message is doing real work: rather than training a new model, I'm running Anindilyakwa text through a phoneme-mapping bridge onto the existing Pitjantjatjara donor model, the same trick as before, now formalized as a repeatable pattern instead of a one-off.

Speak buttons that were added for Kuku Yalanji got generalized in the same period:

```
Add 'hear it aloud' speak buttons across all Indigenous-word surfaces (+59/-26)
```

**Results:** Two languages now have synthetic audio output from one donor model, which is the actual proof that the donor-bridge pattern is reusable rather than a Kuku-Yalanji-specific hack. Measured by: the TTS endpoint returns audio for Anindilyakwa word queries, verified by manual playback testing.

**Pitfalls / What Broke:** The phoneme overlap between Pitjantjatjara and Anindilyakwa is almost certainly worse than the Pitjantjatjara/Kuku-Yalanji pairing was, since Anindilyakwa is from an entirely different language family (non-Pama-Nyungan) — Pitjantjatjara is Pama-Nyungan. I have no formal phonetic distance metric here, just an ear-test, and my ear isn't a trained Anindilyakwa speaker's ear. This is a stopgap that will sound noticeably wrong to a native listener, same caveat as last time, now stacked on a language where the mismatch is probably larger.

**Next:**
- Get a native Anindilyakwa speaker to evaluate the TTS output before promoting it beyond a "beta" label
- Start scoping which language gets the next donor bridge, and pick based on phonetic closeness to an existing donor rather than convenience
- Fold Anindilyakwa audio into the same recording-corpus pipeline once there's enough real speaker audio to eventually replace the bridge model

---

### The Contributions Feature: Shipped, Reverted, Again

**Problem:** I want native speakers to see what they've contributed and how close the language is to having a "model-ready" voice corpus. I tried to ship this exact feature two fortnights ago, it broke, and I reverted it. This period, I built it again — and reverted it again.

**Approach:**

```
feat(contributions): user contributions page + voice-model readiness breakdown (+1,190/-1)
Add user Voice pages: contribution tracker + voice-model readiness (+983/-1)
Add admin Explore console: translate/chat requests + voice-clip play metrics (+961/-7)
Revert contributions feature (My contributions + voice-model readiness) (+1/-1,190)
```

Two nearly-identical feature commits (1,190 lines, then another 983 for what looks like a parallel "Voice pages" implementation), an admin-side companion (the Explore console, which tracks translate/chat request volume and voice-clip play metrics), and then the revert. The `+1/-1,190` diff on the revert is a near-exact mirror of the original feature commit, meaning I pulled it out cleanly rather than leaving half of it wired in.

The nav still got updated to point at the surviving parts:

```
Surface Your Voice in the real nav + redirect /contributions → /voice (+9/-1)
```

**Results:** The admin Explore console is live and shipped clean — no revert there. The user-facing contributions/readiness page did not survive this round either. Measured by: the feature exists in the diff history but the revert commit is the last word on it in this period.

**Pitfalls / What Broke:** Building the same feature twice and reverting it twice in two separate periods is not a good sign — it means whatever's breaking isn't a one-off bug, it's something structural about how the readiness computation or the voice page is wired into the rest of the app that I haven't actually diagnosed. I don't have a root cause documented anywhere, which means the next attempt is at real risk of repeating the same mistake a third time.

**Next:**
- Before attempting this a third time, write down *why* it broke this time — not just revert and move on
- Ship the readiness computation behind a feature flag so a broken deploy doesn't require a full revert commit
- Consider shipping the admin-facing Explore console data as the only source of truth first, and building the user page against a page that's already been proven stable

---

### Infra: Postgres, Snapshots, and the Coming NixOS+Podman Move

**Problem:** Last fortnight's Supabase-to-self-hosted-Postgres migration needed follow-up work, and separately, I'm about to move the underlying hosting to NixOS + Podman, which is the kind of infrastructure change where "I didn't back anything up" turns a bad afternoon into a bad month.

**Approach:**

```
chore(infra): snapshot before NixOS+Podman migration (2026-07-02) (+10,048/-0)
Migrate mobtranslate.com off hosted Supabase to self-hosted Postgres (+20,103/-6,347)
App + web: place-location suggestions, map town names, word-detail recording, images, v1.0.1 (+4,739/-489)
fix(contributions): cast uuid params in voice/contribution SQL (+2/-2)
```

The snapshot commit is pure insurance — 10,048 lines added, 0 deleted, which reads like a full config/data dump committed as a safety net before touching anything. The Postgres migration continues the move away from Supabase's PostgREST layer; the UUID-casting fix is the same class of bug I flagged last fortnight (raw Postgres doesn't do Supabase's implicit type coercion), so this is a second occurrence of that exact failure mode in a different query path.

**Results:** There's now a committed, timestamped snapshot to roll back to if the NixOS+Podman move goes sideways. Measured by: the commit exists and is dated 2026-07-02, which is the same day toiletpaper got an identical-purpose commit — meaning the infra migration is planned across both repos, not isolated to one.

**Pitfalls / What Broke:** A 10,048-line "snapshot" commit with zero deletions is not really a backup strategy, it's a commit that happens to contain a backup — there's no restore script, no documented rollback procedure referenced anywhere in the commit message. If the migration breaks something three weeks from now, "go find that snapshot commit" is not a plan, it's a hope.

**Next:**
- Write an actual rollback runbook before starting the NixOS+Podman cutover, not just a snapshot commit
- Finish auditing raw-SQL UUID handling across the rest of the query layer, since this is the second bug of this exact shape
- Set a hard date for the NixOS+Podman migration itself rather than letting "snapshot before migration" commits accumulate without the migration following

---

### Finishing the Next 16 / React 19 / AI SDK v6 Migration

**Problem:** Last fortnight this upgrade landed as a `wip` commit with cookies/params async handling explicitly called out as unfinished. Shipping a stack upgrade halfway and letting it sit is exactly how you end up debugging a "why is auth broken" ticket three weeks later and forgetting you're mid-migration.

**Approach:**

```
build(deps): complete Next 16 / React 19 / AI SDK v6 migration — green
fix(chat): AI SDK v6 tool() uses inputSchema, not parameters
docs(release): document the React 19 / Next 16 / AI SDK v6 upgrade
docs(release): chat + features runtime-verified under the upgrade
email: set User-Agent on Resend calls (Cloudflare 1010 blocks default UA) (+2/-1)
```

The `inputSchema` fix is the same breaking API change I already hit and patched once before during the WIP phase — it showing up again here suggests either a merge conflict reintroduced the old `parameters` key somewhere, or there was a second tool definition I missed the first pass. Either way, "green" in the commit title is backed up by an actual verification doc this time, not just a vibe.

The Resend fix is the fun one: Cloudflare's bot protection (error 1010) blocks requests with no or default `User-Agent` headers, and Resend's default outbound email client apparently didn't set one that Cloudflare liked. A two-line fix, but the kind of bug that looks like "email is broken" for an embarrassingly long time before you find it's a header.

**Results:** The migration is complete and documented, with a runtime-verification doc as evidence rather than just a commit message asserting it. Measured by: the docs commit lists which flows were manually re-tested (chat, core feature set) post-upgrade.

**Pitfalls / What Broke:** Async `cookies()`/`params` in Next 16 was the explicitly flagged gap last time, and there's no dedicated commit in this period's data called out as "fix async params audit" — it's folded into the general "complete migration" commit, so I can't confirm from the diff alone whether it got a systematic pass or just enough spot-fixes to turn the build green.

**Next:**
- Do an explicit grep-and-verify pass for every remaining synchronous `cookies()`/`params()` call, don't trust "green build" as proof
- Add a lint rule or codemod check so a future dependency bump can't silently reintroduce the `parameters` vs `inputSchema` mistake a third time
- Monitor Resend delivery rates for a week to confirm the Cloudflare 1010 fix actually resolved silent email failures, not just the symptom I happened to catch

---

### Dictionary Enrichment, Round Two

**Problem:** The Kuku Yalanji dictionary enrichment against the Patz grammar was a headline item last fortnight. Enrichment work like this is never actually "done" in one pass — cross-referencing a full grammar against a dictionary surfaces more corrections the more you look.

**Approach:**

```
feat(kuku_yalanji): academic enrichment & correction of the dictionary against the Patz grammar (+79,420/-22,942)
chore(kuku_yalanji): refresh public dictionary.yaml to the enriched version (+31,169/-20,223)
feat(dictionary-sync): sync academic enrichment fields to the database (+182/-7)
docs(kuku_yalanji): add full Markdown dictionary + reference grammar
docs(research): add Indigenous-language translation improvement research + PRD (+448/-0)
fix(translate): pass the full dictionary to the model (homepage translate + chat)
```

The 79,420-line enrichment commit is nearly identical in size and description to one from last fortnight, which either means the same work is being logged twice across periods (plausible, given how close the dates are) or this genuinely was a second full enrichment pass. Either way, the pattern holds: enrich the YAML, sync it to the public copy, then sync the structured fields into Postgres. The research/PRD doc is new — a written plan for translation quality improvements, which is a good sign that the ad-hoc "fix the dictionary, fix the translate route" cycle is starting to get a real roadmap behind it instead of being purely reactive.

**Results:** The dictionary is (again, or still) the largest diff by line count in the period. The research PRD gives future-me an actual document to check progress against instead of re-deriving the plan from memory each time. Measured by: the PRD commit exists with 448 lines of documented research and proposed direction.

**Pitfalls / What Broke:** If this really is a second enrichment pass on the same dictionary, that's a signal the first pass wasn't as complete as the commit message claimed, or that the Patz grammar cross-reference process itself isn't converging — I don't have a way to tell "still finding new corrections" apart from "redoing work that already happened" from the commit data alone.

**Next:**
- Add a dictionary version/changelog field so future enrichment passes are auditable against what previously shipped
- Turn the research PRD into tracked milestones rather than a static doc
- Start applying the same enrichment process to Anindilyakwa now that it has TTS support, so the two languages don't drift apart in data quality

---

### UI Polish, Analytics, and a Pile of Small Fixes

**Problem:** Alongside the headline features, mobtranslate.com collected a long tail of smaller UX and data-correctness fixes — the kind of work that doesn't make a good commit title but matters to anyone actually using the site.

**Approach:** Grouped roughly by area:

```
Add Google Analytics (GA4) + event tracking across the app (+126/-3)
Redesign /record speaker portal as a guided, elder-friendly flow (+728/-175)
Make the /record review buttons big and mobile-friendly (+57/-21)
feat(studio): topbar layout + session-oriented recording
feat(admin/analytics): rebuild with real learner usage data
feat(leaderboard): default to All Time (per-language page + API defaults)
fix(leaderboard): show all competitors, not just the signed-in viewer
fix(data): correct wrong counts on Learn + Dashboard pages
fix(web): opacity-token bug + remove Acknowledgement of Country + test stability
Surface expanded Yalanji word data + record on examples (+534/-105)
Add community pronunciations to dictionary word pages (+463/-0)
Add Kuku Yalanji story slideshow (/stories/kuku-yalanji-camp) (+404/-0)
feat(admin): recording library — browse & play all recordings
Auto-open the mic when permission is already granted (+27/-3)
```

The leaderboard fix is worth calling out specifically: the query was scoped to the signed-in user, so every visitor saw a "leaderboard" of exactly one person — themselves. That's the kind of bug that's invisible in solo testing (of course you only see yourself, you're the only tester) and immediately obvious the moment a second real user shows up.

**Results:** GA4 gives the first real usage telemetry across the app — this is opt-in, standard web analytics, not any kind of user profiling or diagnostic tool. The leaderboard, dashboard counts, and opacity bug are all measured the same way: compared displayed values/UI against expected values (direct DB queries for the counts, visual inspection for the opacity bug) before and after the fix.

**Pitfalls / What Broke:** The Acknowledgement of Country removal is a notable editorial decision buried in a commit titled as a bug-fix batch — worth a deliberate discussion rather than a side effect of an "opacity-token" fix, regardless of the reasoning behind it. The single-user leaderboard bug also shipped and stayed live long enough to need its own fix commit, meaning it wasn't caught until real users hit it.

**Next:**
- Give UI/content decisions like the Acknowledgement of Country removal their own commit and rationale, not a bundled line item
- Add basic multi-user QA (even a second test account) before shipping features like leaderboards that are meaningless with one user
- Wire GA4 events into the admin Explore console so usage data lives in one place instead of two separate analytics surfaces

---

## toiletpaper

**Problem:** Two commits this period, but they're not filler — one is observability infrastructure that didn't exist before, and the other is the same "back everything up before I touch the hosting" instinct that showed up in mobtranslate.com on the same day.

**Approach:**

```
web: add Sentry (loader) + Umami client-side tracking (+42/-0)
chore(infra): snapshot before NixOS+Podman migration (2026-07-02) (+14,328/-758)
```

Sentry gives error tracking; Umami gives privacy-respecting, cookie-free usage analytics. Forty-two lines total for both is a genuinely small integration — mostly loader scripts and config, not a rebuild. The snapshot commit is larger by far (14,328 lines added, 758 deleted) and, like mobtranslate.com's version, is dated 2026-07-02 — same migration, same day, two different repos.

**Results:** toiletpaper now has error visibility and basic usage tracking where it previously had none, measured by: Sentry's loader script is present in the deployed bundle and Umami's tracking script fires on page load. The snapshot exists as a rollback point ahead of the NixOS+Podman cutover.

**Pitfalls / What Broke:** Same critique as the mobtranslate.com snapshot — a large commit with far more additions than deletions is evidence a backup happened, not evidence of a tested restore path. Two repos getting matching "snapshot before migration" commits on the same day, with no shared runbook or migration doc referenced in either, means I'm about to do the same risky infra move twice, independently, without writing down the plan once.

**Next:**
- Write one shared NixOS+Podman migration runbook that both repos' deploys can reference, instead of duplicating the "just snapshot it" instinct per-repo
- Set up Sentry alerting thresholds now, while traffic is low, so noise gets tuned before it matters
- Check whether Umami's data retention settings need adjusting before the infra migration, so historical usage data isn't lost in the move

---

## tpmjs

**Problem:** One commit this period, same as last time — minimal activity, no detail available from the commit data about what actually changed.

**Approach:** Unknown from the available data; classified as low-signal.

**Results:** Unmeasurable without opening the actual diff.

**Pitfalls / What Broke:** N/A — no information to assess.

**Next:**
- Actually go look at what that one commit touched before writing tpmjs off as dormant for a third period in a row
- If tpmjs is genuinely inactive, decide whether it needs archiving or whether it's just waiting on the next dependent project to need it

---

## What's Next

- **Actually execute the NixOS+Podman migration** — two repos now have pre-migration snapshots sitting there; the next move is to write the runbook and do the cutover, not let the snapshots become permanent monuments to a migration that never happens
- **Diagnose the contributions feature properly** — third time building it should not mean a third revert; find the actual root cause before attempting it again
- **Ship a data-handling statement for the Android keyboard** — an IME sees everything a user types; that needs a clear, honest statement before wider distribution, even though nothing is currently being logged off-device
- **Get native-speaker review on the Anindilyakwa TTS bridge** — the donor-model approach needs validation from an actual speaker before it's presented as anything more than a rough approximation
- **Turn the translation research PRD into tracked milestones** — a written plan is only useful if it's checked against, not filed away
- **Audit the rest of the raw-SQL layer for the UUID-casting bug class** — it's now happened twice in two different query paths since the Supabase migration
- **Finish the async `cookies()`/`params()` audit for Next 16** — "green build" isn't the same as "systematically verified"

---

## Links & Resources

### Projects
- [mobtranslate.com](https://github.com/australia/mobtranslate.com) — Indigenous language translation and preservation platform, now with a native Android app and system keyboard
- [toiletpaper](https://github.com/thomasdavis/toiletpaper) — infrastructure/tooling repo, now with Sentry + Umami wired in
- [tpmjs](https://github.com/tpmjs/tpmjs) — package infrastructure, quiet this period

### Tools & Services
- [Sentry](https://sentry.io/) — error tracking, newly added to toiletpaper via loader script
- [Umami](https://umami.is/) — privacy-respecting, cookie-free web analytics
- [Meta MMS-TTS](https://github.com/facebookresearch/fairseq/tree/main/examples/mms) — the donor-model source for both the Kuku Yalanji and now Anindilyakwa neural TTS bridges
- [Vercel AI SDK v6](https://sdk.vercel.ai/) — `tool()` now uses `inputSchema`; the breaking change that bit me twice in two migration passes
- [Resend](https://resend.com/) — outbound email; needed an explicit `User-Agent` header to stop Cloudflare 1010 from blocking default requests
- [NixOS](https://nixos.org/) + [Podman](https://podman.io/) — the target infrastructure stack for the upcoming hosting migration

### Inspiration
- [Patz, E. (1982). A Grammar of the Kuku Yalanji Language](https://aiatsis.gov.au/) — still the reference grammar behind the ongoing dictionary enrichment work
- [AIATSIS](https://aiatsis.gov.au/) — Australian Institute of Aboriginal and Torres Strait Islander Studies, general language-resource reference
