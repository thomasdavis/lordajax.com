# Auth Holes, a Finished Atlas, and the Week Everyone Paid Down Debt They'd Been Ignoring

*Two weeks, four active repos, one duplicated report window, and a security audit nobody scheduled but everybody apparently needed.*

---

## Thesis

Nothing in this period started from zero. Every repo I touched was either finishing something that had been open for weeks (mobtranslate.com's Atlas, which went from a data pipeline in P0 to a finished directory in P6) or quietly admitting it had been putting off unglamorous work (tpmjs's auth endpoints, jsonresume.org's dependency backlog, tellus's design system finally getting wired into the actual product instead of living in a styleguide). There's no shiny new feature that appeared out of nowhere this fortnight — there's a lot of "oh, that thing has been broken/unlocked/unaudited since the last time I looked, let's fix it now." That's a less exciting thesis than usual, but it's the honest one, and it's also the more useful kind of week: security fail-open bugs closed, a managed database migrated off, a quarter-million-line dataset shipped and (finally) organized into a real information architecture instead of a pile of routes.

---

## Why You Should Care

- **tpmjs closed a fail-open auth gap** across every cron/sync endpoint and executor, and migrated its production database off managed Neon onto self-hosted Postgres 17
- **mobtranslate.com's Atlas project shipped its finale** — seven phases (P0 through P6), from a reproducible data pipeline to a directory page with redirects from retired routes, capped by a single 326,511-line commit for per-language profiles
- **jsonresume.org cleared its entire dependabot backlog** (critical/high and moderate/low alerts) in two commits — then immediately turned dependabot off
- **tellus went from zero design system to four "waves" of components** (~10,000 lines) and wired a command palette and toolbelt into the live HUD, replacing native browser dialogs along the way
- **jsonresume.org enforced a 200-line file-size policy** by splitting its four worst offenders, one of which came out as a 3,830/-2,464 refactor
- **86 commits, ~634,823 lines added** across 5 repos — though a meaningful chunk of that "added" number is one dataset commit in mobtranslate.com, not 634K lines of code anyone actually wrote by hand

---

## tpmjs

Twenty commits, one explicitly a fix, but reading the log this was fundamentally a security-and-infrastructure fortnight for the tool registry, not a features fortnight.

**Problem:** tpmjs runs cron jobs, sync endpoints, and executors that other services call into — and until this period, the auth on those paths wasn't fail-closed. That's the scary phrase in a commit message: it means the default behavior on an auth check failure, timeout, or misconfiguration was (in some cases) to let the request through rather than reject it. Layer on top of that a `better-auth` dependency that was 22 minor/patch versions behind, a health-check system that was misclassifying transient timeouts as permanently broken (which pages people, or at least clutters a dashboard, for no reason), and a managed Neon Postgres instance that was presumably a cost and control tradeoff the team had been meaning to revisit.

**Approach:** The core fix:

```
security: fail-closed, timing-safe auth on all cron/sync endpoints and executors
+99 / -123
```

"Fail-closed" means every one of those endpoints now defaults to rejecting a request when auth can't be positively confirmed, instead of the reverse. "Timing-safe" means the token/credential comparison uses a constant-time comparison function rather than a naive `===` or string-equality check — the difference matters because naive comparisons short-circuit on the first mismatched byte, and an attacker who can measure response-time deltas can use that to guess a secret one byte at a time. Whether tpmjs's endpoints were ever *exploitably* timing-vulnerable in practice — remote timing attacks over a real network are noisy and hard to pull off — I can't say, and neither commit message claims it was exploited. This reads as a hardening pass, not an incident writeup. Companion pieces:

```
executor: enforce auth, fix false-broken health classification, npm: fallback
+178 / -31

health: transient executor timeouts become UNKNOWN, not BROKEN
+52 / -9

health: thread errorStage through the report-health telemetry path too
+21 / -7
```

The health-classification fix is a good one to sit with: before this, a transient timeout on an executor was apparently being recorded as "BROKEN" rather than "UNKNOWN" — which means historical health data for the fleet likely has false-positive outage entries mixed in with real ones, and there's no way to retroactively separate them now that the fix has landed. Then the database move:

```
migrate off Neon to self-hosted Postgres 17 (tpmjs-pg on the tpmjs.com box)
+100 / -453
```

That's a big tradeoff dressed up as a small diff. Neon gives you managed backups, point-in-time recovery, connection pooling, and someone else's on-call rotation. Self-hosting on "the tpmjs.com box" means all of that — backups, patching, disk monitoring, failover — is now tpmjs's own responsibility. The commit is only 100/-453 lines because moving a database doesn't require much application code to change; the actual risk lives in operational surface area that a line-count diff can't show. Rounding out the fortnight: a `better-auth` bump (1.4.10 → 1.6.23, +427/-286, meaningful given the auth work happening in parallel), a CI resurrection (`ci: re-enable the CI workflow; delete per-token-era automation workflows`, -338 lines of dead automation), a fix for real 404s and metrics that were zeroing out data on rate limits, and registry maintenance work bounded for "billion-tool scale" at +4,019/-1,222.

**Results:** Every cron/sync endpoint and executor now requires a positive, timing-safe auth check to proceed, verified by reading the diff description rather than by an independent penetration test — I don't have a red-team report confirming there's no remaining fail-open path, and for an auth-hardening pass that's the honest gap to name. The Postgres migration is live on `tpmjs-pg`; verified in the sense that the commit shipped and CI is green again per the `ci: re-enable` commit, not verified in the sense of having a documented failover drill.

**Pitfalls / What Broke:** The uncomfortable read of "fail-closed, timing-safe auth on **all** cron/sync endpoints and executors" landing in a single 99/-123 commit is that before this, some of those endpoints were *not* fail-closed — for an unknown period, on a registry that other services presumably trust. There's no postmortem attached, no note on whether this was caught by internal review or something closer to an incident. I'd rather over-flag this than under-flag it. Separately, self-hosting Postgres is a real ops bet: there's no mention of a backup-restore drill having been run against `tpmjs-pg` yet, and "we moved the database" without a tested restore path is the same category of risk as the "snapshot before migration, no runbook" pattern that's shown up in other repos before.

**Next:**
- Get an actual backup/restore drill logged for `tpmjs-pg`, not just an assumption that self-hosted Postgres backups work because they're configured
- Have someone other than the author confirm there's no remaining fail-open path on the executor/cron surface — a second set of eyes on an auth diff, minimum
- Write down what the false-BROKEN health misclassification cost in practice (how many false alerts, over how long) so the fix's value is measurable, not just asserted

---

## tellus

Nine commits, six of them explicitly features, one fix — and by line count this is easily the highest feature-density repo of the fortnight.

**Problem:** The HUD (heads-up display, presumably the primary interactive surface of whatever tellus's "live world" is) had a toolbelt, dialogs, and inputs that were built ad hoc rather than against a shared design system, meaning every new HUD feature meant reinventing button/panel/badge styling from scratch. And somewhere in the existing HUD, native browser `window.confirm`/`window.prompt` dialogs were still in use — which look and feel completely disconnected from a styled "world" interface.

**Approach:** The design system got built in what the commit messages literally call "waves":

```
Add Tellus HUD design system + living styleguide
+2,081 / -0

Expand the design system: foundations + 12 core components
+2,797 / -0

feat(design-system): Wave 3 — the world layer + Field Kit navigation
+3,024 / -2

feat(design-system): Wave 4 — command palette, remaining inputs & world instruments
+2,384 / -0
```

That's four commits, roughly 10,286 lines, building out a component library from a living styleguide through foundations, twelve core components, a navigation layer, and finally a command palette plus the remaining input primitives. "Living styleguide" implies it's a page that renders the actual components live (not static screenshots or Storybook-style isolated frames) — the kind of thing you can point a designer at and say "this is genuinely what's in production," assuming nobody lets it drift. With the system in place, the HUD itself got migrated onto it:

```
feat(hud): migrate the toolbelt onto the design-system Dock
+40 / -104

feat(hud): wire a ⌘K command palette into the live world
+37 / -1

Replace native window.confirm/prompt in the HUD with styled dialogs
+237 / -14

Add first-run onboarding coach
+342 / -0
```

The toolbelt migration is a net *negative* diff (-104 vs +40) — a good sign, meaning adopting the shared `Dock` component removed more bespoke toolbelt code than it added. The `window.confirm`/`window.prompt` replacement is the unglamorous-but-correct move: native dialogs block the JS thread, can't be styled, and look jarringly out of place in a custom-rendered "world" UI. And a bug fix landed almost as an afterthought:

```
Fix Panel/Badge/PresenceDot to merge a caller-supplied className
+16 / -2
```

**Results:** The design system covers foundations, 12+ core components, a command palette (bound to ⌘K), navigation, and world-specific instruments, verified by the styleguide existing as a "living" page per the first commit's own description — I have not independently confirmed every component listed renders correctly outside that styleguide context. The `window.confirm`/`window.prompt` replacement is verifiable by grepping the HUD source for `window.confirm` and `window.prompt` post-merge; I didn't run that grep myself, so "replaced" here is based on the commit title, not an independent check.

**Pitfalls / What Broke:** The className-merge fix is the tell here — if `Panel`, `Badge`, and `PresenceDot` weren't merging a caller-supplied `className` before this fix, then every consumer of those three components across the four design-system waves that shipped *before* this fix was silently unable to override their styling from the outside. That's a standard component-library footgun (forgetting `cn(baseClasses, props.className)` on the root element), but it means some unknown number of the ~10,000 lines of Wave 1–4 work shipped with a real usability bug in three of its more commonly used primitives, and it only got caught after the fact.

**Next:**
- Audit every other component built across Waves 1–4 for the same missing-className-merge pattern — if it happened on three components, it's worth checking all twelve-plus
- Add a lint rule or component-template check that fails a PR if a new component doesn't forward `className` to its root, so this class of bug can't recur silently
- Write actual usage docs alongside the living styleguide — a component library that only designers can read the source of isn't fully "shared" yet

---

## jsonresume.org

Twenty-six commits, one feature, eleven fixes — heavily weighted toward maintenance, and the most interesting story here is a security-debt cleanup immediately followed by turning off the tool that would catch the next round of debt.

**Problem:** Two separate threads: a genuine security backlog (dependabot alerts, some critical/high) sitting unaddressed, and a code-health backlog (files that had grown well past whatever the project's 200-line policy allows, and various rendering/parsing bugs scattered across the theme-rendering pipeline).

**Approach:** The security cleanup happened in two passes:

```
chore(deps): clear critical/high dependabot alerts (vitest, vite, tar, undici et al) (#489)
+2,943 / -8,467

chore(deps): clear remaining moderate/low dependabot alerts (#499)
+661 / -651
```

Clearing critical/high alerts touching `vitest`, `vite`, `tar`, and `undici` is a real cleanup — `tar` and `undici` vulnerabilities in particular have historically been the kind that show up in supply-chain advisories with actual CVEs attached, not just version-bump noise. The net -5,524 lines on the first commit suggests some of this was as much a lockfile/dependency-tree simplification as a version bump. Then, four days after the moderate/low pass:

```
chore(ci): remove dependabot config — turn off version-update PRs (#486)
+0 / -58
```

That's the twist worth calling out explicitly: the project just spent two commits paying down its entire dependabot backlog, and the very next dependency-related commit is disabling dependabot's version-update PRs. I don't have the reasoning documented anywhere in the commit message — maybe the PR noise was unmanageable, maybe there's a different update mechanism planned, maybe it's a deliberate "we'll do manual sweeps" decision. Whatever the reason, the practical effect is that the alert-clearing work from two commits earlier now has no automated system watching for the next round of vulnerable dependencies to creep back in.

Separately, the code-health thread:

```
refactor(registry): split 4 worst file-size offenders under 200-line policy (#503)
+3,830 / -2,464

chore(knip): remove verified dead files/deps, tighten knip config (#507)
+36 / -746
```

3,830 lines added to split up 4 files under a 200-line cap means the average pre-refactor offender was pulling serious weight, and splitting them added roughly 1,366 net lines — mostly module boilerplate (imports, exports, file headers) that comes with turning one big file into several smaller ones. The `knip` pass (a dead-code/dead-dependency detector) removed 746 lines of verified-dead code, which is a nice complement — one commit was actively fighting file bloat, the other was cleaning up code that had already stopped being used. On the bug-fix side, a long tail of specific, concrete fixes: UTF-8 charset in rendered theme HTML (`fix(registry): ensure utf-8 charset in rendered theme HTML`), a salary parser with range bugs and leftover `console.log` spam, an open-ended date-range and negative-salary edge case, contact info rendering fixed across five separate themes via a shared `ContactInfo` basics prop, and a schema.json migration to be draft-07 JSON Schema compliant. And infrastructure: docs moved from a separate `docs.jsonresume.org` subdomain to `jsonresume.org/docs`, and `@supabase/auth-helpers-nextjs` got migrated to the newer `@supabase/ssr` package.

**Results:** Both dependabot severity tiers show zero open alerts as of the two cleanup commits, measured by the commit descriptions naming the specific packages cleared (`vitest`, `vite`, `tar`, `undici`) — I haven't independently re-run a dependency audit against the current lockfile to confirm zero alerts remain today, only that the commits claim to have cleared what existed at the time. The theme contact-info fix touches five themes by the commit's own count; verified by that count, not by rendering all five and eyeballing them.

**Pitfalls / What Broke:** Turning off dependabot right after using it to clear a real security backlog is the single most quotable "what broke" of this fortnight, even though nothing has technically broken yet — it's a ticking-clock kind of risk rather than an active bug. The five-theme `ContactInfo` bug (`render contact info via ContactInfo basics prop (5 themes)`) implies contact info was rendering incorrectly across a fifth of a presumably ~25-theme catalogue for some unknown period before anyone caught it, which is the kind of bug that's easy to miss because it requires actually looking at rendered output per-theme rather than just running tests.

**Next:**
- Decide on and document an explicit replacement cadence for dependency updates now that dependabot's automated PRs are off — even a monthly manual `npm audit` sweep beats "nothing," and right now there's nothing written down
- Add a rendered-output snapshot test across all themes for contact info specifically, since it's now been wrong in five themes at once and a single shared component bug can clearly hit that many at once
- Keep enforcing the 200-line policy in CI (a lint rule, not just tribal knowledge) so "4 worst offenders" doesn't quietly become "4 more offenders" in a few months

---

## mobtranslate.com

Thirty commits, nine features, two fixes on paper — but a fair number of these commit hashes are identical to ones I already wrote up in last period's devlog, which is worth naming honestly before diving in: this report's date window (2026-07-05 to 2026-07-19) overlaps with the prior one (2026-06-28 to 07-12), so roughly half of this list — the dictionary imports, the original `/spread` wind-map, the Elder recording studio, the 197,205-line typology layer — is carryover, not new work. I'm not re-narrating those; they're covered in the prior post. What's actually new is the **Atlas**, and it's a real finale.

**Problem:** Previous work had built a `/map` page, a `/spread` animation, and a typology dataset as separate surfaces with separate URLs and no shared information architecture. The Atlas project's job was to unify all of that — languages, geography, grammar, sourcing — under one coherent `/atlas` namespace, built in phases.

**Approach:** Seven phases, P0 through P6, landed across the fortnight:

```
atlas(P0): reproducible data-foundation pipeline + versioned artifacts
+115,052 / -0

Atlas P1: unified /atlas hub — map of all located languages + global search
+1,943 / -0

Atlas P2: first-class /atlas/[lang] profiles for all ~980 languoids
+326,511 / -1,030

Atlas P3: /atlas/spread — deep-time animation + "Why did the languages move?"
+1,882 / -6

Atlas P4: /atlas/grammar — the typology lens (colour-by-feature + compare)
+2,196 / -16

Atlas P5: /atlas/methods — sources, rigor & downloadable open data
+56,056 / -67

Atlas P6: /atlas/directory + spacing fixes (finale, pt 1)
+879 / -20

Atlas P6: redirects from retired routes + env-gated build worker cap (finale, pt 2)
+17 / -0
```

P0 is the foundation: a "reproducible" pipeline producing "versioned artifacts" — meaning the underlying language dataset is now built by a repeatable process with version tags, rather than being hand-assembled or living only as whatever happened to be committed last. That's the right instinct for a project whose credibility depends on its data being traceable. P2 is the single largest commit of the entire fortnight across every repo — 326,511 lines for `/atlas/[lang]` profile pages covering roughly 980 languoids, which works out to a genuinely large amount of structured per-language content, not just a page template. P4 turns the earlier typology dataset into an actual usable lens — "colour-by-feature + compare" implies you can pick a grammatical feature (say, case-marking strategy) and see it visualized across languages by color, then compare two languages side by side, which is a real interaction pattern, not a data dump. P5's `/atlas/methods` page is the one I'd flag as the most important non-flashy addition: a page dedicated to sources, methodological rigor, and downloadable open data is exactly the kind of transparency a project sitting on unaudited linguistic claims (as flagged as a risk in the prior devlog around the typology layer) actually needs. P6 closes the loop with a directory page and — critically — redirects from whatever the old retired routes were, so old links (`/map`, `/spread` as standalone pages) don't just 404 once Atlas supersedes them.

Alongside the Atlas work, a few genuinely new side items: Google Play policy surfaces got prepared (`Prepare Google Play policy surfaces`, +398/-61 — store-listing compliance work ahead of an Android release), and a dictionaries gating commit (`Dictionaries: show only the 3 curated community dictionaries (temp gate)`) that explicitly narrows what's shown publicly — a deliberate, labeled-temporary quality gate rather than shipping every imported dictionary (including the less-reviewed Curr/Wiktionary bulk imports) straight to users.

**Results:** `/atlas` now has a hub, per-language profiles for ~980 languoids, a spread animation, a grammar/typology comparison view, a methods/sourcing page, and a directory, with redirects in place from retired routes — verified by the phases landing in sequence with the P6 commits explicitly calling themselves "finale, pt 1" and "finale, pt 2," which is as close to a self-reported "done" signal as a commit log gives you. I have not personally clicked through all ~980 language profiles to confirm none of them render broken; at that scale, the honest verification story is "the build succeeded and the P6 finale shipped," not "every profile was checked."

**Pitfalls / What Broke:** The overlapping report window is itself the pitfall worth naming for future-me: roughly half of this fortnight's mobtranslate.com commit list is a rerun of the prior devlog's material, and if I hadn't cross-checked hashes against the last post, I'd have double-counted "~50,000 dictionary entries" and a 197,205-line typology commit as if they happened twice. That's not a code bug, it's a reporting-pipeline bug, and it's worth flagging to whoever owns the weekly-activity generator so future reports use non-overlapping windows. On the actual code side: the temp-gate commit restricting dictionaries down to "3 curated community dictionaries" is a quiet admission that the ~50,000 imported entries from Wiktionary and Curr aren't considered ready for unrestricted public display yet, which lines up with the unaudited-data risk flagged in the typology section of the prior post — the team is clearly aware of the quality gap, hence the gate, but the gate is explicitly labeled "temp" with no stated criteria for when it lifts.

**Next:**
- Fix the weekly-activity report generator's date-window overlap so future devlogs don't need a manual hash cross-check to avoid double-reporting the same commits
- Define actual promotion criteria for the "temp gate" on dictionaries — what does a Wiktionary/Curr-sourced dictionary need (review pass? native-speaker spot check?) before it's shown alongside the 3 curated ones
- Do a sampling pass across the ~980 `/atlas/[lang]` profiles now that P6 has shipped, the same way the prior devlog flagged for the 1,204-code `/map` — a 326,511-line commit deserves at least a spot check before calling it fully verified

---

## toiletpaper

**Problem:** One commit this period, same as the prior fortnight. I still don't have the diff or message for it — the activity data only reports a commit count for low-signal repos.

**Approach:** Given the recurring `chore(infra): snapshot before NixOS+Podman migration` pattern that's shown up across both toiletpaper and mobtranslate.com in the past, it's plausible this is another link in that same migration chain, but I said that last time too and still haven't gone and checked.

**Results:** Unmeasurable from the data available this period — same honest non-answer as last time.

**Pitfalls / What Broke:** I flagged this exact gap in the prior devlog ("actually open toiletpaper's one commit before writing the next devlog") and didn't do it. That's not a code failure, that's a personal-process failure, and it's worth naming as one rather than quietly repeating the same TODO a third time next period without comment.

**Next:**
- Actually open toiletpaper's commit this time — no more deferring it to "next devlog"
- If it is the NixOS+Podman cutover, give it its own full section instead of a one-paragraph placeholder
- If toiletpaper stays this quiet for another full period, consider whether it still belongs in the weekly report at all, or whether a monthly check-in is more honest than pretending there's a weekly narrative here

---

## What's Next

- **Get a second set of eyes on tpmjs's auth hardening** — a fail-closed, timing-safe auth diff that fixes a fail-open gap deserves independent review, not just a green CI run
- **Run an actual backup/restore drill against `tpmjs-pg`** now that it's self-hosted and Neon isn't handling that anymore
- **Decide jsonresume.org's post-dependabot update strategy** — the backlog got cleared, then the tool that would catch the next backlog got turned off, and there's no written replacement plan
- **Audit tellus's design-system components for the same className-merge bug** that hit `Panel`/`Badge`/`PresenceDot`, across all twelve-plus components from Waves 1–4
- **Sample the ~980 `/atlas/[lang]` profiles** on mobtranslate.com now that the Atlas finale has shipped, the same spot-check discipline the prior devlog called for on `/map`
- **Fix the weekly-activity report's overlapping date windows** so future devlogs don't require a manual hash diff against the last post to avoid double-counting
- **Actually read toiletpaper's commit** — second time naming this as a TODO, no more excuses

---

## Links & Resources

### Projects
- [tpmjs](https://github.com/tpmjs/tpmjs) — Tool Package Manager for AI Agents; this period was auth hardening and a Neon-to-self-hosted-Postgres migration
- [tellus](https://github.com/DavinciDreams/tellus) — HUD design system built in four waves, now wired into the live toolbelt and command palette
- [jsonresume.org](https://github.com/jsonresume/jsonresume.org) — the resume-schema monorepo; cleared its dependabot backlog, then disabled dependabot
- [mobtranslate.com](https://github.com/australia/mobtranslate.com) — Indigenous language platform; the Atlas project (P0–P6) shipped its finale this fortnight
- [toiletpaper](https://github.com/thomasdavis/toiletpaper) — infra/tooling repo, one still-unopened commit two periods running

### Tools & Services
- [Neon](https://neon.tech/) — the managed Postgres tpmjs migrated off of, in favor of self-hosting on its own box
- [better-auth](https://www.better-auth.com/) — the auth library bumped from 1.4.10 to 1.6.23 in tpmjs, alongside the fail-closed endpoint work
- [Dependabot](https://docs.github.com/en/code-security/dependabot) — cleared entirely on jsonresume.org, then disabled for version-update PRs
- [knip](https://knip.dev/) — the dead-code/dead-dependency detector used to remove 746 lines of verified-dead files from jsonresume.org
- [AIATSIS / AUSTLANG](https://aiatsis.gov.au/) — the ~980-languoid registry the new `/atlas/[lang]` profiles are built against

### Inspiration
- [WALS — World Atlas of Language Structures](https://wals.info/) — the reference-grade typological atlas mobtranslate.com's `/atlas/grammar` lens is clearly reaching toward
- [OWASP — Timing Attacks](https://owasp.org/www-community/attacks/Timing_attack) — the class of vulnerability tpmjs's timing-safe auth comparison is defending against
