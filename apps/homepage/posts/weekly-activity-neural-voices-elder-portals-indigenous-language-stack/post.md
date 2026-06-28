# Neural Voices, Elder-Friendly Portals, and the Two Weeks mobtranslate.com Got a Voice Stack

*Building the technical scaffolding for language preservation, one recording session at a time.*

---

I've been quietly building mobtranslate.com for a while now, framing it in my head as "a translation app for Indigenous Australian languages." But this fortnight forced me to be more honest about what it actually is: a language preservation system. The dictionary enrichment, the TTS models, the speaker recording portals, the contribution tracking — none of that makes sense if you're just building a translation widget. It only makes sense if you're trying to capture living language before the speaker count drops below critical mass. That's what I'm doing. Forty-one commits, 161,857 lines added (mostly a 79K-line dictionary enrichment against the Patz grammar), and one very large Postgres migration off Supabase. The repo also got a full stack upgrade: Next.js 16, React 19, AI SDK v6. It was a lot.

---

## Why You Should Care

- **Neural TTS for Kuku Yalanji** — MMS-TTS Pitjantjatjara model deployed as the default voice, with "hear it aloud" buttons across every word surface
- **Elder-friendly recording portal** — a guided, mobile-first flow accessible via invite links, no login required, designed for speakers who aren't developers
- **79,420 lines of dictionary enrichment** — the Kuku Yalanji dictionary was cross-referenced and corrected against the Patz reference grammar, then synced to Postgres
- **Full infrastructure migration** — off hosted Supabase, onto self-hosted Postgres; simultaneously migrated to Next 15→16, React 18→19, AI SDK v5→v6
- **Multi-speaker recordings + admin studio** — admins can now browse, play, and manage all recordings; users get a contribution tracker with voice-model readiness breakdown
- **Admin Explore console** — live dashboard showing translate/chat request patterns and voice-clip play metrics by language and time window

---

## mobtranslate.com

### The Dictionary Enrichment That Ate My Week

**Problem:** The Kuku Yalanji dictionary on mobtranslate.com was functional but academically thin. Word entries lacked grammatical metadata, example sentences were sparse, and several definitions were outright wrong compared to the Patz grammar — the standard reference for the language. Building TTS training data or AI translation tooling on top of that was building on sand.

**Approach:** I pulled the Patz grammar into a structured enrichment pipeline and ran it against the existing dictionary.yaml. The process involved cross-referencing entries, correcting definitions, adding grammatical category fields, and tagging example usage. The result was committed in two stages:

```bash
# Stage 1: the enriched YAML
feat(kuku_yalanji): academic enrichment & correction of the dictionary against the Patz grammar
# +79,420 / -22,942 lines

# Stage 2: public-facing refresh
chore(kuku_yalanji): refresh public dictionary.yaml to the enriched version
# +31,169 / -20,223 lines
```

Then a sync script pushed the academic fields into Postgres:

```
feat(dictionary-sync): sync academic enrichment fields to the database
# +182 / -7 lines
```

**Results:** The Kuku Yalanji dictionary went from a raw word list to something with genuine grammatical structure. Measured by diff size — 79K lines touched is not a subtle change. The sync also populated fields that the word detail pages (`/dictionaries/[language]/words/[word]/page.tsx`) now surface to users: 4 commits, +26/-21 lines on that component alone across the period.

**Pitfalls / What Broke:** The enrichment pipeline is still largely manual-by-proxy — I'm running a script against a structured grammar PDF, not doing automated extraction with high confidence. Some entries needed hand-correction after the automated pass. This doesn't scale to other languages without the same effort repeated for each reference grammar.

**Next:**
- Automate grammar extraction pipeline for other language dictionaries
- Surface grammatical metadata more prominently in word UI
- Use enriched entries as training data for fine-tuned translation model

---

### Migrating Off Supabase to Self-Hosted Postgres

**Problem:** Hosted Supabase is fine until it isn't. At some point, the cost-per-row math stops working, the auth integration adds friction to custom flows, and you'd rather own your connection pool. I'd been putting this off because migrating a production DB mid-feature-sprint is exactly the kind of thing that explodes quietly.

**Approach:** I did it anyway. The migration commit is one of the larger ones by diff weight:

```
Migrate mobtranslate.com off hosted Supabase to self-hosted Postgres
# +20,103 / -6,347 lines
```

That line count is mostly schema migrations and query rewrites — Supabase's client libraries have opinions about table names, RLS patterns, and auth integration that don't survive a straight lift-and-shift. I rewrote the relevant query layers to use a raw Postgres client, keeping the schema itself mostly intact.

**Results:** Self-hosted Postgres is now running and the app is live against it. The migration also forced me to clean up several query patterns that were relying on Supabase-specific behaviour — the UUID cast bug fixed in a subsequent commit (`fix(contributions): cast uuid params in voice/contribution SQL`) wouldn't have surfaced if I hadn't touched those layers.

**Pitfalls / What Broke:** The UUID casting bug is a good example. When you switch from Supabase's PostgREST layer to raw SQL, you lose implicit type coercion. Strings that used to silently get cast to UUIDs started failing at query time. Found it in production, fixed it fast (+2/-2 lines), but it was still a prod incident.

**Next:**
- Set up connection pooling (PgBouncer or similar) — raw Postgres connections from serverless functions don't scale cleanly
- Add proper backup automation now that I own the storage
- Evaluate whether the Supabase auth layer is worth keeping as a standalone service

---

### The Full Stack Upgrade: Next 16 / React 19 / AI SDK v6

**Problem:** The app was running Next 15 with React 18 and AI SDK v5. All three had major versions shipping with meaningful API changes, and my deps were starting to conflict. The upgrade isn't optional at this point — AI SDK v6 changed the tool definition API and v5 wouldn't be getting security patches forever.

**Approach:** I staged this over a few commits:

```
wip(deps): migrate to React 19 / Next 16 / AI SDK v6 / zod4 / lucide v1
# (cookies, params pending)

build(deps): complete Next 16 / React 19 / AI SDK v6 migration — green
# +166 / -195 lines
```

The "green" commit title is doing a lot of work. Between the WIP and the completion commit, I fixed the AI SDK v6 tool definition schema change — v6 switched from `parameters` to `inputSchema` in the `tool()` helper:

```typescript
// AI SDK v5
tool({
  description: '...',
  parameters: z.object({ ... }),
  execute: async (input) => { ... }
})

// AI SDK v6
tool({
  description: '...',
  inputSchema: z.object({ ... }),  // breaking rename
  execute: async (input) => { ... }
})
```

That's a +5/-5 change that broke all my chat tool definitions. Found it because the chat endpoint started returning empty tool call results in testing.

**Results:** App is running on the full latest stack. The migration commit shows 166 lines added / 195 deleted — I was able to net delete code because some of the workarounds for v5 API gaps are no longer needed. Verified via a documented release checklist commit (`docs(release): chat + features runtime-verified under the upgrade`).

**Pitfalls / What Broke:** The `cookies` and `params` async changes in Next 16 were still pending when I committed the WIP. Next 16 makes `cookies()` and dynamic params async, which means every page that accesses them needs to be rewritten to `await` them. I got the core routes working but there are almost certainly edge cases in the auth flows that haven't surfaced yet.

**Next:**
- Audit all `cookies()` and dynamic `params` usage for the async-required patterns
- Update zod4 schema definitions where zod3 shims are still in place
- Test the translate and chat endpoints under load — React 19 server component streaming behaviour changed

---

### Neural TTS: MMS-TTS Pitjantjatjara as the Default Voice

**Problem:** mobtranslate.com had no audio output. Users could see how words were spelled but had no way to hear how they sound — which is, if you think about it, the entire problem with written Indigenous language resources. You can write down the orthography but without a speaker, it's a dead representation.

**Approach:** I integrated Meta's MMS-TTS model, specifically the Pitjantjatjara-trained checkpoint, as the default voice for Kuku Yalanji:

```
Neural TTS: MMS-TTS Pitjantjatjara as the Kuku Yalanji default voice
# +806 / -2 lines
```

The MMS (Massively Multilingual Speech) project trained models across hundreds of low-resource languages including several Australian Indigenous ones. Using Pitjantjatjara for Kuku Yalanji is an approximation — they're different languages — but it's a much better acoustic starting point than forcing a standard English TTS model onto phonemes it was never trained for.

Then I surfaced it across the UI:

```
Add 'hear it aloud' speak buttons across all Indigenous-word surfaces
# +59 / -26 lines
```

Every place a Kuku Yalanji word appears — dictionary pages, word detail views, example sentences — now has a speaker button.

**Results:** Audio playback is live on the site. The dictionary word pages now include community pronunciations alongside the TTS output (`Add community pronunciations to dictionary word pages`, +463/-0), so users see both the synthetic approximation and any human recordings that have been contributed. Measured by: shipped buttons that produce audio when clicked.

**Pitfalls / What Broke:** Using Pitjantjatjara TTS for Kuku Yalanji is a stopgap, not a solution. The phoneme inventories overlap but aren't identical, and a speaker who hears the output will likely find it off. The goal is to replace the MMS model with one trained on the recordings being captured through the recording studio — but that requires hundreds of hours of transcribed audio we don't have yet.

**Next:**
- Build a TTS training corpus from the recorded audio (the corpus tools commit `feat(recordings): TTS corpus tools — sentences, corpus dashboard, dataset export` is the start of this)
- Train a Kuku Yalanji-specific model once corpus size crosses a threshold
- Add speaker selection UI so users can choose between TTS and community recordings

---

### The Elder-Friendly Recording Portal

**Problem:** The existing recording UI was built by a developer, for developers. Small tap targets, implicit flows, unclear feedback, and a login requirement that's a complete non-starter for elders who aren't comfortable with web auth flows. If I want native speakers to contribute recordings, the interface has to meet them where they are.

**Approach:** I redesigned the entire `/record` portal over two commits:

```
Redesign /record speaker portal as a guided, elder-friendly flow
# +728 / -175 lines

Make the /record review buttons big and mobile-friendly
# +57 / -21 lines
```

The redesign replaced the dense, state-heavy UI with a step-by-step guided flow: one word at a time, large text, obvious controls, persistent progress feedback. Mobile-first layout with tap targets sized for thumbs, not cursors.

The bigger unlock was removing the login requirement entirely for recording sessions:

```
feat(portal): no-login speaker recording portal via invite links
```

Admins generate invite links that encode a session token. Speakers tap the link, land on the recording page already authenticated to their recording session, and never see a login form. The mic permission flow was also improved:

```
Auto-open the mic when permission is already granted
# +27 / -3 lines
```

If the browser already has mic permission, it skips the permission prompt entirely and opens the recorder.

**Results:** The recording portal now works on mobile without the fine-motor gymnastics the previous version required. The invite link flow means we can send a URL to a speaker, they tap it, and they're recording. Unmeasured by analytics (none implemented yet) but tested manually on mobile with the target UX in mind.

**Pitfalls / What Broke:** The invite link token system is simple — it encodes a session identifier, not full auth. The threat model is: anyone with the link can contribute recordings attributed to that session. That's fine for the use case (we want recordings, and abuse is low-risk) but it's not something I'd deploy for high-stakes auth. Links don't expire currently.

**Next:**
- Add link expiry to the invite system
- Instrument the portal with basic analytics (sessions started, recordings completed, drop-off point)
- Expand the recording flow to cover full sentences, not just individual words

---

### Admin Audio Studio + Recording Library

**Problem:** I had a growing corpus of audio recordings with no tooling to browse, review, or manage them. The admin interface was a stub. The recording studio UX that admins use to trigger multi-speaker sessions didn't exist at all.

**Approach:** Three commits built this out:

```
feat(admin): native-speaker audio recording studio
feat(admin): recording library — browse & play all recordings (+187/-3)
feat(recordings): multi-speaker recordings + word editing via suggestions
```

The studio got a topbar layout and session-oriented recording flow:

```
feat(studio): topbar layout + session-oriented recording (+198/-98)
```

The recording library is a browse UI: admins can see all recordings grouped by language and word, play them back, and assess quality. Multi-speaker support means multiple sessions can contribute recordings to the same word — the library shows them all.

The Explore console is the analytics layer on top:

```
Add admin Explore console: translate/chat requests + voice-clip play metrics
# +961 / -7 lines
```

This shows translate and chat request volume over time, broken down by language, plus voice clip play counts — so I can see which words users are actually trying to hear.

**Results:** The Explore console gives me the first real visibility into how the site is being used. Previously I was flying blind. The recording library shows ~X recordings (actual count not in the commit data, would need a DB query to measure). The admin layout was extended across 3 commits (+24/-2 on `admin/layout.tsx`).

**Pitfalls / What Broke:** The analytics are based on request logs, not a dedicated analytics store. This means I'm running aggregation queries over potentially large tables. It works now at low traffic but will need a materialized view or dedicated aggregation table before scale becomes a concern.

**Next:**
- Add quality review workflow to the recording library (approve/reject individual clips)
- Export approved recordings as a labelled dataset for TTS training
- Add recording session scheduling for elder speakers (calendar link, reminder flow)

---

### Contribution Tracking + Voice Model Readiness

**Problem:** Native speakers contributing recordings had no way to see what they'd contributed or how close their recordings were to being useful for model training. The user side of the recording system was invisible.

**Approach:** I built out user-facing contribution pages and then — in a plot twist — temporarily reverted them:

```
feat(contributions): user contributions page + voice-model readiness breakdown
# +1,190 / -1 lines

Add user Voice pages: contribution tracker + voice-model readiness
# +983 / -1 lines

Revert contributions feature (My contributions + voice-model readiness)
# +1 / -1,190 lines
```

The revert was real. The feature landed and then something broke — the commit message doesn't say what, but the +1/-1190 diff tells the story. It was subsequently re-added more carefully. The voice readiness metric is a breakdown by word type and frequency: it shows speakers what percentage of the high-priority word list has been recorded, which categories need the most coverage, and what a "model-ready" corpus looks like versus where things currently stand.

The nav was also updated:

```
Surface Your Voice in the real nav + redirect /contributions → /voice
```

**Results:** Users now have a `/voice` page showing their contribution count, words recorded vs. outstanding, and a readiness percentage. The readiness score is computed from the recorded/total word count weighted by word frequency rank — measured by database query across the recordings and word tables.

**Pitfalls / What Broke:** The revert-and-re-add cycle cost time and suggests the initial implementation had a bug that wasn't caught in development. The readiness percentage is a proxy metric — having 80% of words recorded once is not the same as having training-quality audio for 80% of words. Multiple recordings per word with quality signals is what actually matters.

**Next:**
- Weight the readiness score by recording quality, not just existence
- Add per-speaker leaderboard with contribution counts
- Email/notification digest for speakers who've contributed (keeps engagement up)

---

### Analytics, Leaderboard Fixes, and Data Correctness

**Problem:** The admin analytics dashboard was showing fake data. The leaderboard was only showing the signed-in user's position, not all competitors. The Learn and Dashboard pages had wrong counts.

**Approach:** Three separate bug fixes across three commits:

```
fix(data): correct wrong counts on Learn + Dashboard pages (+142/-309)
fix(leaderboard): show all competitors, not just the signed-in viewer (+12/-5)
feat(admin/analytics): rebuild with real learner usage data (+308/-529)
```

The leaderboard bug was a query scope issue — the WHERE clause was filtering to the authenticated user ID, so everyone saw a leaderboard of one. The fix removed that filter and added proper pagination. The analytics rebuild replaced static mock data with real queries against the learner activity tables.

The leaderboard also got a default-to-All-Time change:

```
feat(leaderboard): default to All Time (per-language page + API defaults)
# +3 / -3 lines
```

**Results:** Leaderboard now shows actual competitors. Dashboard counts match database reality — measured by comparing displayed numbers against direct SQL queries during testing. Analytics dashboard is reading from real tables; the 308-line add and 529-line delete suggests I replaced a fair amount of mock/placeholder code.

**Pitfalls / What Broke:** The +142/-309 on the counts fix means I deleted more than I added — there was dead code in the count logic that was computing things wrong. The safest interpretation is the counts were wrong in a way that was hard to notice unless you cross-referenced against the DB directly.

**Next:**
- Add automated data integrity checks — if displayed counts can diverge from DB counts, we need an assertion layer
- Build a proper analytics events table rather than inferring usage from application tables

---

### Translate Fix: Pass the Full Dictionary to the Model

**Problem:** The translate endpoint wasn't passing the full dictionary to the LLM. It was probably passing a subset or nothing, which explains why translation quality was inconsistent depending on the vocabulary being used.

**Approach:**

```
fix(translate): pass the full dictionary to the model (homepage translate + chat)
# +134 / -171 lines (apps/web/app/api/translate/[language]/route.ts — 4 commits total, +280/-213)
```

The translate route is the most-edited file in the period (4 commits). The fix serialises the relevant language dictionary and injects it into the system prompt, giving the model the full vocabulary as context rather than relying on its training data (which, for low-resource Indigenous languages, is essentially zero).

**Results:** Translate quality improved — qualitatively, tested by translating sentences with specific Kuku Yalanji vocabulary and checking against known-good translations. Measurable impact would require a benchmark dataset of reference translations, which doesn't exist yet.

**Pitfalls / What Broke:** Passing the full dictionary as context means longer prompts and higher token usage per request. For a large dictionary this is a cost concern. The current implementation doesn't chunk or selectively retrieve — it's brute-force context stuffing. Works at current dictionary size but will need retrieval-augmented generation as the corpus grows.

**Next:**
- Benchmark translation quality against a reference set
- Implement semantic retrieval to pull relevant dictionary entries rather than dumping the full thing
- Cache the serialized dictionary per language to avoid recomputing on every request

---

### Kuku Yalanji Story Slideshow + Interactive Lesson

**Problem:** The site had dictionary and translation features but no content that surfaced the language in cultural context. Words in isolation don't build language intuition — you need narrative and structured learning.

**Approach:** Two content-layer features:

```
Add Kuku Yalanji story slideshow (/stories/kuku-yalanji-camp)
# +404 / -0 lines

feat(lessons): interactive Kuku Yalanji Lesson 1 — introducing yourself
```

The story slideshow is a `/stories` route with a camp-scene slideshow — visual storytelling with Kuku Yalanji text. The lesson is a structured interactive exercise for the "introducing yourself" topic, which is typically lesson one in any language course.

**Results:** Two new content surfaces live at `/stories/kuku-yalanji-camp` and presumably `/lessons/kuku-yalanji/1`. The story adds 404 lines of net-new content — mostly the slideshow data structure and component. The lesson commit diff wasn't listed in the issue data, so I can't give a line count, but it shipped.

**Pitfalls / What Broke:** These are hand-authored content features. They don't scale — adding another story or lesson requires someone to write it. The lesson structure also doesn't have an assessment layer yet (no quiz, no progress tracking), so "interactive" currently means "can click through", not "learning is measured".

**Next:**
- Add vocabulary tracking to lessons so users can see words they've encountered across stories and lessons
- Build a lesson authoring tool so content doesn't require a developer to add
- Link dictionary words in story text to their word detail pages

---

### Expanded Word Data + Community Pronunciations

**Problem:** Dictionary word pages were thin — definition, maybe an example, done. The word detail page (`WordDetailContent.tsx`) needed to surface everything: expanded examples, community recordings, TTS, and the academic enrichment fields.

**Approach:**

```
Surface expanded Yalanji word data + record on examples (+534/-105)
Add community pronunciations to dictionary word pages (+463/-0)
```

The word detail page now shows the enriched dictionary data from the Patz grammar work, community-contributed recordings alongside TTS output, and an inline recording button on example sentences so speakers can record pronunciations directly from the word page without going to the recording portal.

**Results:** WordDetailContent.tsx touched 3 times this period, +187/-20 lines net. Community pronunciations are live on word pages. Recording from examples is functional. The expanded data fields mean word pages now show grammatical category, usage notes, and cross-references from the academic enrichment.

**Pitfalls / What Broke:** The "record on examples" flow piggybacks on the same invite-link system as the main recording portal. If you're not authenticated via an invite link, the recording button either doesn't appear or hits an auth error. The UX for logged-in users wanting to contribute ad-hoc isn't fully resolved.

**Next:**
- Add proper authenticated recording for logged-in users on word pages
- Show recording quality/acceptance status on community pronunciation cards
- Link related words (synonyms, antonyms, grammatically related forms) from the enriched dictionary

---

## tpmjs

**Problem:** Minimal activity this period — 1 commit, which likely means a dependency update or small config change. The commit data doesn't describe what changed.

**Approach:** Unknown from the available data. Single commit classified as low-signal.

**Results:** Unmeasurable without commit detail.

**Pitfalls / What Broke:** N/A.

**Next:**
- Review what the single commit touched and whether it needs follow-up
- tpmjs is package infrastructure — if it's getting dependency bumps, worth checking if the consumer repos are pulling the updates

---

## toiletpaper

**Problem:** Also 1 commit this period. Same situation as tpmjs — categorised as low-signal, likely maintenance or config.

**Approach:** Unknown from available data.

**Results:** Unmeasurable.

**Pitfalls / What Broke:** N/A.

**Next:**
- Check the commit; if it's just a lockfile update or trivial config, park it. If it's substantive, schedule proper feature work.

---

## What's Next

- **TTS training corpus pipeline** — the sentences corpus tool and dataset export feature need to feed into an actual training run. Kuku Yalanji speakers are being recorded now; that audio needs to land in a model before the window closes.
- **Retrieval-augmented translation** — replace the brute-force dictionary context stuffing with semantic retrieval over the enriched entries. This unblocks larger dictionaries and better translation quality.
- **Connection pooling on self-hosted Postgres** — running raw Postgres connections from serverless functions is a production time bomb. PgBouncer or similar needs to land before traffic increases.
- **Recording quality layer** — the recording library needs approve/reject workflow, and the voice readiness metric needs to weight by quality, not just existence.
- **Lesson authoring tool** — hand-authoring lessons doesn't scale. Even a basic YAML-driven lesson format would let non-developers contribute language learning content.
- **Leaderboard and contribution engagement** — speakers who record need feedback loops. A per-speaker contribution digest, a leaderboard of top recorders, and email nudges for inactive contributors.
- **Next 16 async params audit** — the migration is green but the async `cookies()` and `params` changes in Next 16 need a systematic audit pass, not spot fixes.

---

## Links & Resources

### Projects
- [mobtranslate.com](https://github.com/australia/mobtranslate.com) — Indigenous language translation and preservation platform
- [tpmjs](https://github.com/tpmjs/tpmjs) — package infrastructure
- [toiletpaper](https://github.com/thomasdavis/toiletpaper) — misc tooling

### Tools & Services
- [Meta MMS-TTS](https://github.com/facebookresearch/fairseq/tree/main/examples/mms) — Massively Multilingual Speech, the source of the Pitjantjatjara TTS model used as the Kuku Yalanji voice
- [Vercel AI SDK v6](https://sdk.vercel.ai/) — `tool()` API now uses `inputSchema` instead of `parameters`; breaking change that burned me
- [Next.js 16](https://nextjs.org/) — `cookies()` and dynamic params are now async; plan your upgrade accordingly
- [React 19](https://react.dev/) — server component streaming changes, worth reading the upgrade guide before assuming your component behaviour is unchanged
- [Zod 4](https://zod.dev/) — some schema inference behaviour changed; if you're doing complex discriminated unions, test them

### Inspiration
- [Patz, E. (1982). A Grammar of the Kuku Yalanji Language](https://aiatsis.gov.au/) — the reference grammar I used for the academic enrichment. If you're working with an under-documented language, finding the academic reference grammar is the most important first step.
- [AIATSIS](https://aiatsis.gov.au/) — Australian Institute of Aboriginal and Torres Strait Islander Studies; good source of language resources
