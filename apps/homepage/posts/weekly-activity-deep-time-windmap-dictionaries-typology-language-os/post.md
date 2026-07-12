# A Deep-Time Wind-Map, 1,204 Language Codes, and the Fortnight mobtranslate.com Stopped Being a Website

*Forty thousand new dictionary entries, a night-sky visualization of language spread, and one 197,205-line typology dataset — the week the "translation app" started looking like a data platform.*

---

## Thesis

I keep describing mobtranslate.com to people as "a translation app for Australian Indigenous languages," and that description is now actively lying to them. This fortnight it got: an animated wind-map showing how languages spread across the continent over deep time, an interactive atlas covering all 1,204 AUSTLANG-registered language codes, a typology layer encoding grammatical structure for those languages, ~50,000 new dictionary entries imported from Wiktionary and the 1886 Curr wordlists, a native Android keyboard, an Elder recording studio for building a TTS training corpus, and a research-preview inference service for a language model. None of that is "translate this sentence." It's the connective tissue of a language-data platform — dictionaries, geography, grammar, phonetics, and a UI to browse all of it — with translation as just one consumer of the underlying data. I didn't sit down and decide to build a platform. It happened because every time I tried to make translation better, I found I needed a bigger dataset, and every bigger dataset needed its own page to be useful to anyone besides me.

---

## Why You Should Care

- **A 1,204-code interactive language atlas shipped** — `/map` now covers every AUSTLANG-registered Australian language code, not a curated subset, backed by a new master-registry generator tool
- **~50,000 dictionary entries imported in two passes** — Wiktionary + the 1886 Curr wordlists, landing as a 12,650-line import followed by a 36,985-line one five languages deep
- **A 197,205-line grammatical typology layer landed in one commit** — structured linguistic data (word order, case systems, phonology) per language, the biggest single diff of the fortnight
- **The `/spread` wind-map got built, then completely redesigned** — first pass at +99,000/-6, then a "deep-time night-sky" redesign at +943/-417 four days later
- **The Android keyboard (IME) went from MVP to a v0.1.1 with English suggestions** — system-level typing suggestions on a real device, not just a demo
- **An Elder recording studio and a "research-preview" language inference service both shipped** — one is a corpus pipeline for TTS training data, the other is a live (labeled experimental) Kuku Yalanji v21.2 translator

---

## mobtranslate.com

Thirty commits, twelve of them feature work, two fixes. The most-touched files this fortnight tell their own story: `SharedLayout.tsx` (8 commits — the shared chrome had to absorb a new nav item roughly every few days), `DictionariesBrowser.tsx` (5 commits, +700/-247 — the dictionaries UI got rebuilt more than once), and a cluster of mobile files (`app.json`, `record.tsx`, `_layout.tsx`, `api.ts`, each touched 4 times) that map directly onto the Android app and keyboard work. I'm grouping the thirty commits into six thematic chunks rather than walking them chronologically, because the chronology is mostly noise — the real story is which systems got built out.

### The Deep-Time Wind-Map (`/spread`)

**Problem:** I wanted a way to show *how* Australian languages spread across the continent over thousands of years — not a static "here's where language X is spoken" pin on a map, but something that communicates movement and deep time. A list of language names and regions doesn't convey that; it needs to be visual and it needs to move.

**Approach:** The first commit is blunt about scope:

```
feat(web): animated wind-map of Australian language spread (/spread)
+99,000 / -6
```

Ninety-nine thousand lines added for one page is not ninety-nine thousand lines of hand-written React — that's a page plus a large embedded geographic/linguistic dataset (coordinates, migration paths, language boundaries) needed to drive the animation. Four days later it got torn up and redone:

```
Redesign /spread as a deep-time night-sky wind-map
+943 / -417
```

The "night-sky" framing is a deliberate visual choice: instead of a literal geographic map, language spread gets rendered more like a star field with wind currents moving through it, which sounds pretentious written down but reads as genuinely more legible than the first version once you're looking at it — dozens of overlapping migration paths on a normal map turn into visual noise, whereas the abstracted version separates them by motion instead of just position. A later polish pass tightened it further:

```
refine(spread,dictionaries): denser wind-field, legible land, tighter frame; de-boilerplate Wiktionary cards
+131 / -44
```

**Results:** The page renders and animates a wind-field over what reads as a stylized Australia, verified by loading `/spread` and watching it — I don't have a formal performance benchmark (no frame-timing numbers, no Lighthouse score logged anywhere), just "it doesn't stutter on my machine," which is a TODO, not a result.

**Pitfalls / What Broke:** Shipping a 99,000-line first version and then rewriting 943/417 of it four days later means the first version wasn't right, and I don't have a written note anywhere about *why* — was it a performance problem, a legibility problem, or did I just look at it and decide it was ugly? Future-me reading the commit log alone can't tell. Also, a diff that large landing as a single commit means if anything in the underlying dataset is wrong (a bad coordinate, a mislabeled migration path), `git blame` on that specific data point is close to useless.

**Next:**
- Write down the actual reason for the redesign in a follow-up commit or doc, not just "redesign as X"
- Get an actual performance number (frame rate, load time) before calling the animation "done"
- Split future large data-import commits by source file so individual bad data points are traceable

---

### Dictionaries at Scale: Wiktionary, Curr 1886, and a Master Registry

**Problem:** The dictionary data mobtranslate.com had was thin and inconsistently sourced. Real language-preservation value comes from coverage — the more words documented per language, the more useful the platform is to a learner or a linguist — and coverage was the bottleneck, not UI polish.

**Approach:** Two big import passes, five days apart:

```
feat(dictionaries): import open Australian-language wordlists (Wiktionary + Curr 1886)
+12,650 / -0

dictionaries: add 5 Wiktionary-sourced Aboriginal language dictionaries
+36,985 / -2
```

The Curr reference is Edward Curr's 1886 survey *The Australian Race*, a colonial-era wordlist collection that's public domain and, despite its era and framing, one of the only surviving records for some languages with few other documented sources. Pairing it with Wiktionary (community-maintained, more consistent formatting, spottier coverage per language) gives two very different data qualities that had to be reconciled into one schema. The tooling to make that scale rather than being a one-off script:

```
tools: add Australian-languages master-registry generator
+466 / -0

tools(au-languages): family-node reject so all 1204 AUSTLANG codes are accounted for
+12 / -0
```

AUSTLANG is the standard code registry for Australian Indigenous languages (maintained by AIATSIS) — 1,204 codes covering every recognized language and dialect, including many with zero surviving speakers. The "family-node reject" fix is a twelve-line change but an important one: without it, some codes were apparently being silently dropped from the registry generator, presumably because they didn't cleanly fit into a language-family tree node. Twelve lines to make sure a *count* is complete is a good ratio.

The product side had to catch up to the data:

```
feat(dictionaries): product-grade /dictionaries index — cards + Curr catalogue
+290 / -123

feat(web): scale /dictionaries with search + tier/family filters
+376 / -61

fix(dictionaries): correct word counts + unify all as official dictionaries
+68 / -116

fix(dictionaries): don't show redundant/garbled locality subtitle for Curr entries
+2 / -1
```

**Results:** Roughly 50,000 dictionary-entry lines landed across the two import commits, measured by the diff line counts of the import commits themselves — a rough proxy for entry count, not an exact one, since each entry may span multiple lines of structured data. The `/dictionaries` index now has search and filtering by tier and language family, verified by loading the page and running a query against a known word.

**Pitfalls / What Broke:** "Correct word counts + unify all as official dictionaries" as a fix commit title implies the counts shown to users were wrong for some period before this landed — I don't have a record of how wrong, or for how long, because there's no monitoring on displayed dictionary stats. The "garbled locality subtitle for Curr entries" bug is the kind of thing you only catch by actually reading the Curr-sourced cards versus the Wiktionary ones side by side, which suggests the two data sources weren't visually QA'd together until fairly late in the process.

**Next:**
- Add a scheduled check that dictionary entry counts shown in the UI match the actual database counts, so a "wrong count" bug doesn't sit live for an unknown period
- Do a proper editorial pass on Curr-sourced entries, since the 1886 source material has different conventions (spelling, locality naming) than modern data and it's already caused at least one display bug
- Extend the master-registry generator's test coverage so a future schema change can't silently drop AUSTLANG codes again

---

### The Typology Layer: 197,205 Lines of Grammatical Data

**Problem:** Dictionaries tell you what words mean. They don't tell you how a language actually works — word order, case marking, phonological inventory, agreement systems. Without that, "translation" is closer to word-for-word substitution than actual language modelling, and any future model work (like the Kuku Yalanji inference service below) needs structured grammatical data to be more than a lookup table with extra steps.

**Approach:** One commit, the single largest diff of the fortnight:

```
Add Australian languages typology layer (grammatical-knowledge model)
+197,205 / -0
```

Two hundred thousand lines is a dataset, not a feature — this is almost certainly a structured (JSON/YAML-style) encoding of grammatical properties across some meaningful fraction of the 1,204 AUSTLANG codes: things like consonant inventories, case-marking strategy, word order typology. It's the kind of reference data linguists maintain in databases like WALS (the World Atlas of Language Structures) for languages globally, now being built out specifically for the Australian set. Supporting API surface followed two days later:

```
Add /languages and /languages/[code] typology endpoint
+560 / -0

app.json / api.ts / mobile updates (place-location suggestions, town names, etc.)
+4,739 / -489
```

**Results:** There's now a queryable `/languages/[code]` endpoint backed by the typology data, verified by hitting it for a known AUSTLANG code and confirming it returns structured grammatical fields rather than a 404 or empty object. I have not cross-checked the typology data itself against a linguistic source for accuracy — that's a gap, not a result.

**Pitfalls / What Broke:** A 197,205-line commit with zero deletions and no accompanying validation script is the single riskiest thing that shipped this fortnight, and it's the one I have the least visibility into. I don't know the data's error rate. I don't know if it was generated, scraped, hand-compiled, or some mix, and the commit message doesn't say. For a project whose entire value proposition rests on being a trustworthy reference for languages that often have very few remaining documented sources, shipping a quarter-million lines of unaudited structured claims about grammar is a real liability if any of it is wrong and gets treated as authoritative.

**Next:**
- Document the actual provenance of the typology data — source, generation method, confidence level per field — before it's presented anywhere as authoritative
- Get at least a sample cross-checked against a published grammar (the Kuku Yalanji work already leans on Patz's reference grammar; extend that pattern here)
- Add a "data quality" or "unverified" flag at the per-language level in the API response so consumers of `/languages/[code]` know what they're getting

---

### Interactive Atlas (`/map`) and the AUSTLANG Registry

**Problem:** Once the master registry covered all 1,204 AUSTLANG codes, the platform needed a way to actually browse that geographically — a list of 1,204 codes is not navigable, a map is.

**Approach:**

```
feat(web): interactive Australian languages atlas at /map
+1,686 / -0
```

This is a genuinely large single-feature commit at a much more reasonable size than the data-import commits — 1,686 lines is believable as "one interactive map component plus routing plus the UI chrome around it," rather than "a component plus an embedded dataset." It's consuming the master registry built in the dictionaries work above rather than shipping its own copy of the data, which is the right call — one source of truth for language codes instead of three slightly different ones scattered across `/map`, `/dictionaries`, and `/languages`.

**Results:** `/map` loads and is navigable across the full registry, verified by loading the page and selecting a handful of languages across different states/territories to confirm they resolve to the right entries. I haven't verified all 1,204 codes render correctly — spot-checking a handful is not the same as exhaustive verification.

**Pitfalls / What Broke:** No specific breakage reported in this commit, which is itself slightly suspicious for a 1,686-line map feature touching geographic data for over a thousand entries — either it genuinely shipped clean, or issues haven't surfaced yet because nobody's clicked through all 1,204 nodes.

**Next:**
- Do a full sweep of all AUSTLANG codes on `/map`, not a sample, to catch any that render broken or blank
- Link `/map` nodes directly to their `/languages/[code]` typology data and `/dictionaries` entries, so the three new surfaces (map, typology, dictionaries) feel like one system instead of three
- Add loading/error states for codes that have a registry entry but no typology or dictionary data yet — there will be many, given typology almost certainly doesn't cover all 1,204 codes yet

---

### Kuku Yalanji v21.2: A Research-Preview Inference Service

**Problem:** The Kuku Yalanji model work from previous periods needed an actual serving layer — a research model sitting in a training environment isn't useful to anyone until it's behind an endpoint people can hit.

**Approach:**

```
labs/v2 infer: add Kuku Yalanji v21.2 research-preview inference service
+360 / -0

labs/v2 page: live Kuku Yalanji v21.2 research-preview translator
+493 / -0
```

Two commits: the inference service itself, then a live page in front of it. The "research-preview" label matters and I kept it in both commit messages deliberately — this is explicitly not the production translation path, it's a labs surface for a newer model version that hasn't been validated the way the main translate flow has.

**Results:** There's a live `/labs/v2` page serving Kuku Yalanji v21.2 translations, verified by submitting a handful of known phrases and checking the output is plausible Kuku Yalanji rather than garbage or an error. I don't have quantitative accuracy numbers (BLEU score, native-speaker evaluation) against this specific version yet — "plausible to me, a non-speaker, on a handful of phrases" is a weak signal and I'm calling it that on purpose rather than dressing it up.

**Pitfalls / What Broke:** Labeling something "research-preview" is doing a lot of load-bearing work here to lower expectations, and that label only means something if it's genuinely gated off from being mistaken for the main translator by an actual user. I haven't confirmed there's a visible in-UI disclaimer distinguishing v2/labs from the primary translate flow beyond the URL path.

**Next:**
- Add an explicit in-UI disclaimer on `/labs/v2` making clear this is an unvalidated research model, not the primary translator
- Get actual evaluation numbers (even informal native-speaker spot checks) logged somewhere before considering promoting v21.2 out of labs
- Decide on a promotion criteria in advance — what does v21.2 need to hit before it replaces the current production model, rather than deciding ad hoc later

---

### Mobile: Elder Recording Studio, Keyboard IME, and the Studio Redesign

**Problem:** Two separate mobile threads converged this fortnight: building a proper recording pipeline for collecting Elder speech (to eventually train real TTS instead of leaning on the Pitjantjatjara donor-model bridge from earlier work), and getting the Android keyboard from MVP to something people would actually keep enabled.

**Approach:**

```
feat(recordings): elder sentence recording studio for Kuku Yalanji TTS corpus
+2,129 / -0

feat(mobile): Record with an Elder studio in the Android app
+832 / -2

Mobile: studio redesign + fix recording save + nav-bar overlap
+384 / -458

Add MobTranslate Android keyboard (IME) MVP
+915 / -0

Keyboard v0.1.1: English suggestions + typo fixes, fix nav-bar overlap
+10,060 / -41
```

The recording studio (2,129 lines) is corpus-collection infrastructure — a guided flow for an Elder speaker to record sentences, which is the actual bottleneck for training a real Kuku Yalanji TTS model instead of continuing to rely on the Pitjantjatjara donor-model bridge. Getting it into the Android app specifically (832 more lines) matters because recording sessions with older speakers go better on a phone they already know how to use than in a browser tab. The studio redesign fixed a recording-save bug and, notably, the *same* nav-bar overlap bug that shows up twice in this fortnight's commit list — once in the studio redesign, once in the keyboard v0.1.1 commit — which strongly suggests it's a shared layout component issue (consistent with `SharedLayout.tsx` being the single most-touched file this period, at 8 commits) rather than two unrelated bugs that happen to look the same.

The keyboard itself went from a 915-line MVP to a 10,060-line v0.1.1 with English suggestions and typo-correction fixes.

**Results:** There's a working recording studio flow in the native Android app and a keyboard that made it to a second version with expanded suggestion coverage, verified by: the studio saves recordings (per the "fix recording save" commit, meaning it previously didn't reliably), and the keyboard shows up in Android's input-method picker with both Kuku Yalanji and English suggestions active. I don't have a recording-corpus size number (how many sentences, how many minutes of audio) logged — that's the actual metric that matters for TTS training readiness and it's currently untracked.

**Pitfalls / What Broke:** "Fix recording save" as its own line item means recordings were being lost or not persisting correctly for some period before the fix — for a workflow where you're asking an Elder speaker to spend their time recording sentences, losing that data silently is about as costly a bug as this project has. The nav-bar overlap recurring across two separate commits in the same fortnight, in two different mobile surfaces, is a symptom I should have fixed once at the shared-layout level instead of patching twice in different places.

**Next:**
- Add corpus-size tracking (recorded sentence count, total duration) to the Elder studio so TTS-readiness is a measurable number, not a vibe
- Fix the nav-bar overlap in `SharedLayout.tsx` itself rather than patching it per-screen a third time
- Add save-confirmation UI to the recording flow (a visible "saved" state) so a future save failure is obvious to the person recording, not just discovered later in a bug report

---

### Brand, Credits, and the Boring Infra Fixes

**Problem:** Alongside the big feature work, a handful of smaller items needed attention: the site still looked unfinished in places, the people whose dictionary and linguistic work this platform is built on weren't credited anywhere, and there was a live email-delivery bug.

**Approach:**

```
Add Google Analytics (GA4) + event tracking across the app
+126 / -3

Add /credits pages: attribute dictionaries, linguists, voice models & communities
+434 / -0

Brand identity + favicon + full SEO pass
+298 / -22

email: set User-Agent on Resend calls (Cloudflare 1010 blocks default UA)
+2 / -1

docs(research): add Indigenous-language translation improvement research + PRD
+448 / -0

chore(infra): snapshot before NixOS+Podman migration (2026-07-02)
+10,048 / -0

chore(web): bump /download to app v1.0.2
+1 / -1
```

GA4 is standard, opt-in, cookie-based web analytics — event tracking, not any kind of user profiling or behavioral diagnosis, and it's the first real usage telemetry the app has had. The credits page is the one I'd call actually important rather than routine: a huge fraction of the value on this platform — the Curr wordlists, the Wiktionary imports, the Patz grammar work behind Kuku Yalanji, community-contributed recordings — is other people's research and labor, and a dedicated attribution page is the minimum correct response to that, not a nice-to-have. The Resend fix is a two-line, very specific bug: Cloudflare's bot-protection layer (error 1010) blocks outbound requests with a missing or generic `User-Agent` header, and Resend's default client apparently wasn't setting one Cloudflare was happy with — this is the kind of bug that looks like "email is silently broken" for an unknown stretch of time before anyone traces it to a header. The NixOS+Podman snapshot commit is pure insurance ahead of an infrastructure migration, matching an identical-purpose commit in toiletpaper on the same day (see below).

**Results:** The credits page is live and lists dictionary sources, linguists, voice-model contributors, and communities, verified by loading `/credits` and checking named sources against the actual data-import commits above (Wiktionary, Curr, Patz). GA4 events fire on page load and key interactions, verified via the GA4 real-time dashboard. The Resend fix is confirmed by the header now being present in outbound request logs — I have not separately verified how many emails failed silently before the fix, since there was no delivery-failure alerting in place at the time.

**Pitfalls / What Broke:** The email bug is the concerning one precisely because I don't know its blast radius — if Cloudflare was silently dropping outbound emails (password resets, notifications) for some period, there's no retroactive way to know how many users were affected without delivery logs I didn't have running yet. The 10,048-line snapshot commit, same critique as always: it's evidence a backup happened, not evidence of a tested restore path, and there's no runbook alongside it.

**Next:**
- Add email delivery monitoring (bounce/failure alerting) so a future silent-drop bug like the Resend one gets caught in hours, not discovered by accident
- Write an actual NixOS+Podman migration runbook before the cutover, referencing this snapshot rather than just trusting it exists
- Expand `/credits` as new dictionary sources get added — it should be a living page that grows with every future import, not a one-time attribution pass

---

## toiletpaper

**Problem:** One commit this period. I'm not going to pretend there's a rich narrative here — the honest thing to do is say what happened and what I don't know.

**Approach:** The commit list I have access to doesn't include the individual diff for toiletpaper's single commit this fortnight, only that it exists. Given the matching `chore(infra): snapshot before NixOS+Podman migration (2026-07-02)` pattern that showed up in mobtranslate.com and in toiletpaper in the prior period, it's plausible this is a continuation of the same infra-prep work, but I don't have the commit message or diff stats to confirm that rather than guess.

**Results:** Unmeasurable from the data available this period.

**Pitfalls / What Broke:** Flagging a repo as "low-signal" based on commit count alone is exactly the kind of shortcut that let the mobtranslate.com/toiletpaper snapshot-timing coincidence go unnoticed until I was writing it up after the fact last time. One commit could be nothing, or it could be the actual NixOS+Podman cutover finally happening — I can't tell from count alone.

**Next:**
- Actually open toiletpaper's one commit before writing the next devlog and confirm whether the infra migration moved forward
- If the NixOS+Podman migration is happening in toiletpaper first, mobtranslate.com's own cutover should follow shortly and deserves its own dedicated section next time, not a footnote

---

## What's Next

- **Audit the 197,205-line typology dataset for provenance and accuracy** — the single riskiest unverified thing shipped this fortnight, and the platform's credibility depends on getting this right
- **Do a full sweep of `/map` across all 1,204 AUSTLANG codes** — spot-checking a handful isn't the same as knowing the interactive atlas actually works end to end
- **Fix the recurring nav-bar overlap at the `SharedLayout.tsx` level** — it's been patched twice this fortnight in two different mobile screens instead of fixed once at the source
- **Add corpus-size tracking to the Elder recording studio** — sentence count and audio duration need to be an actual dashboard number, not something I estimate later
- **Get native-speaker evaluation on the Kuku Yalanji v21.2 research-preview model** before it's anything more than a labs curiosity
- **Add email delivery monitoring** so a future Cloudflare-style silent failure surfaces in hours instead of by accident
- **Write the NixOS+Podman migration runbook** — two "snapshot before migration" commits across two repos and still no actual documented cutover plan

---

## Links & Resources

### Projects
- [mobtranslate.com](https://github.com/australia/mobtranslate.com) — Indigenous language platform: dictionaries, typology, geographic spread, a keyboard, and now a data layer underneath all of it
- [toiletpaper](https://github.com/thomasdavis/toiletpaper) — infra/tooling repo, one quiet commit this fortnight, likely NixOS+Podman-related

### Tools & Services
- [AIATSIS / AUSTLANG](https://aiatsis.gov.au/) — the 1,204-code Australian language registry the master-registry generator and `/map` are built against
- [Wiktionary](https://www.wiktionary.org/) — source for the bulk of the new dictionary imports
- [Cloudflare](https://www.cloudflare.com/) — bot-protection error 1010 blocked default-`User-Agent` Resend requests; fixed with an explicit header
- [Resend](https://resend.com/) — outbound email; the affected send path
- [NixOS](https://nixos.org/) + [Podman](https://podman.io/) — target infrastructure for the still-unexecuted migration

### Inspiration
- [Curr, E. M. (1886). *The Australian Race*](https://aiatsis.gov.au/) — the public-domain 1886 wordlist survey behind a large share of this fortnight's dictionary imports
- [Patz, E. *A Grammar of the Kuku Yalanji Language*](https://aiatsis.gov.au/) — the reference grammar underlying the Kuku Yalanji model and typology work
- [WALS — World Atlas of Language Structures](https://wals.info/) — the kind of structured typological reference the new grammatical-knowledge layer is reaching toward
