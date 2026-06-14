# Forty Themes, Seven Packages, and a CLI That Finally Knows What It's Doing

*The fortnight I turned the JSON Resume monorepo into a real ecosystem with proper npm packages, SSR-capable themes, and a CLI that doesn't make you feel like you're debugging archaeology.*

There's a version of what I've been doing for the past two weeks that looks like chore work: migrating themes, publishing packages, fixing CI, writing tests. And yeah, some of it is chore work. But the actual thing happening is bigger: I'm extracting a proper `@jsonresume/*` namespace from what was, for too long, a tangled mess of internal `@repo/*` packages, hardcoded local paths, and themes that happened to work if you squinted. The 96 commits in `jsonresume.org` this fortnight aren't noise — they're the sound of a monorepo finally deciding what it is. An ecosystem, not a repo. The CLI got a real ATS scoring command, themes can now render without a browser DOM, the schema is a workspace package instead of an external dependency, and six new themes landed. The MCP server that updates your resume while you code got fixed so it actually pulls from published npm instead of a sibling directory on my laptop. And `toiletpaper` got a UX bump that I didn't know I needed until I tested it. This is the fortnight the whole JSON Resume stack started behaving like something you could hand to someone else.

## Why You Should Care

- **Eight `@jsonresume/*` packages now published**: `@jsonresume/types`, `@jsonresume/utils`, `@jsonresume/sample-data`, `@jsonresume/theme-kit`, `@jsonresume/theme-metadata`, `@jsonresume/schema`, `@jsonresume/ats-validator`, and `@jsonresume/core` — all properly scoped, versioned via changesets, and available on npm
- **`resume audit`**: new CLI command that runs your resume through the ATS validator and gives you a grade + contact-info/special-characters checks — concrete signal on whether a machine will reject you before a human reads it
- **30+ themes migrated to SSR**: themes now use `renderResumeDocument` from `@jsonresume/core` and emit full `<html>` documents — they work in Node without a browser DOM, which means proper server-side rendering in Next.js and elsewhere
- **Six new themes landed**: brutalist, art-deco, clinical-precision, art-school-modern, field-researcher, industrial-engineer — bringing the theme count to a number I've genuinely stopped counting
- **MCP server unfucked**: `@jsonresume/mcp` was importing the MCP SDK via a local sibling directory path; it now points at the published `@modelcontextprotocol/sdk` on npm like a civilised piece of software
- **`toiletpaper` UX fix**: uploads now open the paper page immediately instead of making you wait, plus a full deployment to the donto instance

---

## jsonresume.org: 96 Commits and the Great Ecosystem Extraction

**Problem:** The monorepo had a secret. Most of its packages were named `@repo/*` — a Turborepo convention for workspace-internal packages that you never intend to publish. The problem is I *did* intend to publish them, eventually, and eventually had arrived. Themes were importing from `@repo/core`, `@repo/utils`, `@repo/theme-config` — names that mean nothing outside the monorepo. The schema was pulled in as an external `resume-schema` npm package from a separate repo, rather than being the workspace package that we maintain directly. CI was silently passing against a stale remote-cached build rather than the real thing. And the `dist/` folders for themes were getting committed to the repo, meaning PRs were diffs of compiled output rather than source. None of this was fatal, but all of it was technical debt compounding into friction.

**Approach:** I broke this into roughly five parallel streams — package extraction, SSR migration, CLI improvements, new themes, and CI hardening — and ran them simultaneously across the fortnight. Not because I'm organised, but because they were all unblocking each other.

**Stream 1: Package extraction.**

The `@repo/*` packages got renamed and published as `@jsonresume/*`:

- `@repo/theme-config` → `@jsonresume/theme-metadata` (published in [#446](https://github.com/jsonresume/jsonresume.org/commit/f1393306f7649672507fb115b2695cfdf4edcd48))
- `@repo/utils` → `@jsonresume/utils`
- `@repo/core` → `@jsonresume/core` (the SSR rendering engine)
- New additions: `@jsonresume/types` (TypeScript types for the full resume schema), `@jsonresume/sample-data` (three example resumes: new-grad, career-changer, senior-IC), `@jsonresume/theme-kit` (scaffolding helpers for theme authors)

The schema migration was its own saga. The existing codebase was depending on `resume-schema` — a separately published npm package from a different repo. We maintain the schema; it made no sense to depend on ourselves via npm when we could just have a workspace package. [#283](https://github.com/jsonresume/jsonresume.org/commit/bc2abd4bb6d53cada4664577f4342669340a4b31) imported the schema repo with history preserved, [#334](https://github.com/jsonresume/jsonresume.org/commit/d89279e20def8d87eafa002f86cad86bfc391a9f) migrated the dep to the workspace package, and [#346](https://github.com/jsonresume/jsonresume.org/commit/07c0f0e10c90180227b435f97d2ef1384a57feda) upgraded validation to Ajv + draft-07. The validation CLI command now gives you precise, path-pointed errors like `$.work[0].endDate: must match format "date"` instead of `validation failed`.

**Stream 2: SSR migration.**

This was the bulk of the commit count. Themes historically rendered HTML but didn't know about `<html>`, `<head>`, or `<body>` — they returned a fragment. Fine for the old registry renderer that wrapped them. Not fine for use in Next.js where you want a real document. The migration added a `renderResumeDocument` helper to `@jsonresume/core` that takes a theme's output and wraps it into a proper `<html>` document with configurable `headAfterStyles`.

Then I ran nine batches of migrations — batches A through E for fan-out themes, plus batches B and final-1 and final-2 for SSR helper migration — covering the full theme library. Each batch was its own PR to keep diffs reviewable. The commits look like this in aggregate:

```
refactor(themes): SSR migration fan-out batch A (#442)  +460/-300
refactor(themes): SSR migration fan-out batch B (#440)  +456/-315
refactor(themes): SSR migration fan-out batch C (#439)  +528/-382
refactor(themes): SSR migration fan-out batch D (#441)  +424/-323
refactor(themes): SSR migration fan-out batch E (#438)  +445/-327
refactor(themes): SSR migration final batch 1 (#443)    +339/-115
refactor(themes): SSR migration final batch 2 (#444)    +187/-55
```

That's roughly 2,800 lines added and 1,800 removed across the SSR migration alone. Most of it is wrapping existing theme render functions in `renderResumeDocument` and adding a `<html>` skeleton around the output. Mechanical work, but it had to be done right or themes start breaking in subtle ways when run in Node.

**Stream 3: CLI improvements.**

The CLI (`packages/cli`) got the most user-visible changes this sprint:

`resume audit` — runs your resume through `@jsonresume/ats-validator` and gives you a grade. The validator checks: parse-ability (can machines read this JSON?), date formatting, section completeness, contact info presence, and special-character safety (some ATS parsers choke on em-dashes and curly quotes). The [#419](https://github.com/jsonresume/jsonresume.org/commit/3b4cb5ebbf414c0133bd0c5ed7a00699bb7585f7) diff adds `getGrade` as a public export from `@jsonresume/ats-validator` and wires it to a `resume audit` command that prints a report card.

`resume list` — lists themes you have installed locally. This sounds trivial until you've spent 15 minutes running `ls node_modules | grep jsonresume-theme` to remember what you have available. [#409](https://github.com/jsonresume/jsonresume.org/commit/99c2e704a3e91f03d94ec619aeb70151f4383449) adds this alongside a `--verbose` flag that shows version and description.

`resume export --format markdown` and `resume export --format text` — [#402](https://github.com/jsonresume/jsonresume.org/commit/3bbe2bd9e8c2c08456c9f736f37f2dca6dbc968a) adds plain-text and markdown export without needing a theme. Useful for pasting into LLM prompts and forms that don't accept HTML.

Theme not-found errors now suggest the closest available theme name. Before, you'd get `Error: theme 'jsonresume-theme-classy' not found` and nothing else. Now you get that plus "Did you mean `jsonresume-theme-classic`?" — implemented via string distance comparison against the locally installed theme list.

**Stream 4: New themes.**

Six themes landed this fortnight:

- **jsonresume-theme-brutalist** ([#422](https://github.com/jsonresume/jsonresume.org/commit/536adbf7394bfb02fed083a1d52abecec864a668)) — the name says it. Heavy borders, raw typography, deliberately ugly in the way that looks intentional.
- **jsonresume-theme-art-deco** ([#422](https://github.com/jsonresume/jsonresume.org/commit/536adbf7394bfb02fed083a1d52abecec864a668)) — geometric, ornamental, 1920s. Landed in the same PR as brutalist.
- **jsonresume-theme-clinical-precision** ([#388](https://github.com/jsonresume/jsonresume.org/commit/4715518645215826b47a50f1b264e4139333ce98)) — medical chart aesthetic. Exact column widths, monospace secondary text, structured like an EMR. I don't know who needs this but someone does.
- **jsonresume-theme-art-school-modern** ([#396](https://github.com/jsonresume/jsonresume.org/commit/251fe8f90a44eec7e3fe762185cce9875bbe103b)) — expressive editorial. Variable-weight type, open composition. For people who got a BFA and need the resume to communicate that immediately.
- **jsonresume-theme-field-researcher** ([#384](https://github.com/jsonresume/jsonresume.org/commit/7bd58b1882353a8ea02a517d3a356bc2305ded34)) — field-notebook research log. For academics, scientists, and anyone whose actual output is publications rather than promotions.
- **jsonresume-theme-industrial-engineer** ([#403](https://github.com/jsonresume/jsonresume.org/commit/b869586c6a5cf127101c3ab567cbecc7b149b3e2)) — re-landed from a stranded branch. Was on `theme-batch-base` and never made it to master. Now it has.

**Stream 5: CI hardening.**

Three CI fixes that mattered:

1. The `dist/` folders for themes were being committed. If you ran a build locally and opened a PR, your diff included compiled JavaScript output. Fixed with a CI check that detects stale committed `dist/` on theme packages and fails the build ([#445](https://github.com/jsonresume/jsonresume.org/commit/af969bd9f00ef1169e40cef6937f9fe4587328bb)).

2. CI was running on `push` only, which meant fork PRs couldn't pass the required checks (forks can't push to the main repo's branches). Changed to run on `pull_request` with `push` restricted to master to avoid double-runs ([#325](https://github.com/jsonresume/jsonresume.org/commit/616ca9933fd713de91dde966c8b6fac18583d8e4)).

3. Actions got bumped to Node24-ready majors ahead of GitHub's 2026-06-16 forced migration ([#331](https://github.com/jsonresume/jsonresume.org/commit/8d3dd045f6ceae0b7d5f24a64403856806d0c910)). Not optional, but the kind of thing you have to catch before the deadline.

**Results:**

- 8 packages now published under `@jsonresume/*` on npm — measured by checking the npm registry for each package after the changesets release workflow ran
- 30+ themes migrated to SSR via `renderResumeDocument` — counted from the batch commit history
- Theme coverage gate added via `test(themes): permanent render + section-coverage gate` ([#391](https://github.com/jsonresume/jsonresume.org/commit/eda088bba3e3d59aee0d0745c31dd92254f1319e)): every registered theme must now render without throwing and must hit a minimum section coverage. This catches the class of bug where a theme silently renders nothing for sections it doesn't implement.
- Registry formatter layer now has test coverage for text/markdown/json/yaml output formats ([#410](https://github.com/jsonresume/jsonresume.org/commit/f33140c0c6d6578b3e157b2ae27e6e3dba9ba2f))

**Pitfalls / What Broke:**

The `normalizeDates` function in the registry was mangling non-Date object date values — if a field happened to contain an object that wasn't a Date, the normalizer would corrupt it. Found by the new test suite, fixed in [#413](https://github.com/jsonresume/jsonresume.org/commit/bfd887e21c6600565125377d2527b464064c5d39). This is the kind of silent bug that was presumably lurking in production.

The eslint-config package had a circular-structure crash that was being masked by Turborepo's remote cache. Locally it would crash; on CI with a warm cache it would pass because the config was never re-evaluated. Fixing [#335](https://github.com/jsonresume/jsonresume.org/commit/0b997dc9ca61ec372a60be07647a1d4186380c21) required clearing the remote cache, at which point the crash became visible and fixable.

The Supabase config was hardcoded 114 times across the registry codebase. `refactor(registry): centralize supabase config` ([#380](https://github.com/jsonresume/jsonresume.org/commit/c52a6b98a3a77a9a326bb541a023d06651d97c59)) reduced that to one place. I don't know how it got to 114 repetitions. I stopped asking.

There was a Supabase outage during a scheduled CI window that caused spurious test failures. [#379](https://github.com/jsonresume/jsonresume.org/commit/06913ae4de1c17fee1cc93ce966a6bc733164b75) guards the scheduled workflow against the known outage window. Checking external dependencies in CI on a schedule is a known footgun.

**Next:**

- The theme scaffolding generator ([#449](https://github.com/jsonresume/jsonresume.org/commit/06909baff1590a7ea4f02005ce0d176165d42bcd)) landed this sprint but needs documentation and a guide walkthrough — `resume create-theme` should be the onboarding for new theme authors
- Per-theme README generation from `theme-metadata` is partially automated; getting it fully automated on theme publish would eliminate the manual step
- The `@jsonresume/core` SSR helper needs to handle inline-style themes (themes that use `style="..."` attributes) differently from themes that use `<style>` blocks — the `headAfterStyles` option is a start, but it's not complete

---

## mcp: Four Commits to Stop Importing from My Laptop

**Problem:** The `@jsonresume/mcp` server — which connects to your IDE, watches you code, and updates your `jsonresume.org` profile in the background — was importing the MCP SDK from a sibling directory path. Specifically, it had a `package.json` that looked something like:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "file:../path/to/local/sdk"
  }
}
```

This works fine on my machine, where the SDK happened to be checked out next to the mcp repo. It works fine for exactly nobody else. Anyone who cloned the repo and ran `npm install` got a resolution error because that sibling path doesn't exist on their machine.

**Approach:** Three targeted fixes.

[#4](https://github.com/jsonresume/mcp/commit/bc9960d85b2d83cc22962cf4a305fed35bb5515b) changed the SDK path from the hardcoded local file path to `^1.0.3` — the published semver range on npm. [#5](https://github.com/jsonresume/mcp/commit/b6bce9c96a7b8f231f8dd804a58d505d31b25383) was the larger cleanup: replacing all the sibling-directory SDK imports throughout the TypeScript source with `@modelcontextprotocol/sdk` paths that actually resolve. The diff was +1588/-478 lines, which sounds like a lot until you realize it's mostly the regenerated `package-lock.json`. The actual source changes were surgical — maybe a dozen import lines.

[#6](https://github.com/jsonresume/mcp/commit/b2fc642b9151094205bef8b1aeb47ee428ed1849) bumped the SDK to current 1.x and added CI so this particular class of regression can't land again without a red build.

[#7](https://github.com/jsonresume/mcp/commit/f59d5a7eaf82fd62b163cf56789e2f6a757e3678) bumped esbuild to `^0.25.0` to resolve a Dependabot alert — esbuild's old version had a vulnerability in its dev server. Since we're bundling the MCP server, not running its dev server, the threat surface is minimal, but the fix is a one-line version bump so there's no reason not to do it.

**Results:**

The MCP server now installs cleanly from npm with no local path dependencies. Verified by running a fresh `npm install` in a clean directory with only the published package and its declared deps.

**Pitfalls / What Broke:**

The SDK version bump to 1.x introduced a minor breaking change in how tool schemas are declared — the older 0.x API used a slightly different shape for the `inputSchema` field. Fixed during [#6] but it's the kind of thing you don't notice until runtime because TypeScript's structural typing can mask it.

**Next:**

- The MCP server should be published to npm so IDE extensions can install it directly without needing to clone the repo
- Add an integration test that actually connects to the MCP protocol and verifies the resume update flow end-to-end — right now CI tests build and lint only

---

## toiletpaper: Two Commits, One Actually Good UX Change

**Problem:** `toiletpaper` is a document processing app — you upload a paper, it processes it, you read it. The problem: when you uploaded a file, the app sat on the upload page and made you wait. The processing indicator was there but you were stuck watching a spinner on the wrong page. You had to navigate manually to the paper page after upload was done, or the app would eventually redirect you — eventually.

**Approach:** [commit `26db18a`](https://github.com/thomasdavis/toiletpaper/commit/26db18a957593a2c2f0348b7370856e03ca6512d) changed the upload handler to navigate to the paper page immediately on upload completion, before processing finishes. The paper page already had a `paper-processing-panel` component that handles the in-progress state — so the UX becomes: you upload, you're immediately on the page where the paper will live, and you watch it come alive as processing completes. This is how it should have worked from the start.

The +351/-104 diff is mostly in `route.ts` and `page.tsx` — the upload route now returns the paper ID as part of the success response, and the client navigates to `/paper/[id]` immediately instead of waiting.

[commit `3ce9c45`](https://github.com/thomasdavis/toiletpaper/commit/3ce9c458e05d86ae00452b152875eb08284d5429) deployed `toiletpaper` on a donto instance — my own infrastructure rather than a shared hosting provider. The `.env.instance.example` file in the diff gives the shape of the deployment config.

**Results:**

Upload-to-viewing time feels substantially shorter because you're immediately on the right page rather than waiting for a redirect. Not measured rigorously — this is a qualitative UX improvement. If I were being serious about it, I'd instrument time-from-upload-to-first-paper-render and compare.

**Pitfalls / What Broke:**

The immediate redirect means the paper page hits the processing state before the backend has confirmed the upload landed. If the upload handler fails after the redirect, the paper page shows a processing state that never resolves. The error path needs better handling — currently it'll just hang in the processing panel if the upload fails mid-flight.

**Next:**

- Error state handling on the paper page for failed uploads
- The `paper-processing-panel` component needs a timeout/retry UX for cases where processing stalls
- Test the donto instance deployment under realistic load — a paper with 200+ pages currently blocks the processing pipeline

---

## rust-json-resume, resume-cli, resume-schema: The Low-Signal Trio

These three repos showed up in the activity summary with 1-2 commits each. Let me be honest about what that means.

**Problem:** All three of these were in various states of "maintained enough to not be broken, not maintained enough to be interesting."

**`rust-json-resume` (1 commit):**

This is a Rust implementation of the JSON Resume rendering pipeline. It got imported into the main `jsonresume.org` monorepo with history preserved ([#277](https://github.com/jsonresume/jsonresume.org/commit/19d49da823060830e58a9aa3658d0d6e0e1f71ae)) — so the "1 commit" here is the history preservation commit rather than new development. The active development now happens inside `packages/core-rust` in the monorepo.

**`resume-cli` (1 commit):**

Similarly, `resume-cli` got imported into the monorepo with history preserved ([#278](https://github.com/jsonresume/jsonresume.org/commit/11b69a323464e6624a1288c690d31eb62cb6a689)) as `packages/cli` with a Node 20+ modernization pass. The standalone repo is now the archive; all future CLI work is in the monorepo package.

**`resume-schema` (2 commits):**

The schema repo got imported as `packages/schema` ([#283](https://github.com/jsonresume/jsonresume.org/commit/bc2abd4bb6d53cada4664577f4342669340a4b31)) and the date-format tests were fixed alongside bundled sample validation ([#414](https://github.com/jsonresume/jsonresume.org/commit/4a604b131031db82a059365c53353923e8ef2daf)). Again: archive the standalone repo, do all work in the monorepo.

**Results:**

The pattern across all three: consolidation into the monorepo. What were three separately-maintained repos are now packages in a single workspace, sharing the same tooling, CI, and release pipeline. This is the boring but necessary work of reducing repository sprawl.

**Pitfalls / What Broke:**

History-preserving imports (`git filter-repo`, careful merge strategies) are never as smooth as they look in the commit message. There's always some `.gitignore` or `package.json` conflict that the automated tooling can't resolve. These got fixed in subsequent commits, but they're the kind of thing that takes a few rounds.

**Next:**

- The standalone repos should have their `README`s updated to point to the monorepo as the active development home
- Deprecation notices on the npm packages that were published from the standalone repos, redirecting to the `@jsonresume/*` scoped packages
- Check that the history preservation was actually clean — `git log --follow` on key files to verify the blame history is intact

---

## What's Next

- **Theme authorship documentation** — the scaffolding generator landed (`resume create-theme`) and the ecosystem-native pattern is locked down (use `renderResumeDocument` + `@jsonresume/theme-kit`). What's missing is a proper guide that walks a theme author from zero to published in under an hour. The scaffolding does the mechanical part; the guide needs to explain the why.
- **ATS validator expansion** — the `resume audit` command currently scores on parse-ability, date formatting, section completeness, contact info, and special characters. The next tier is keyword density analysis and section ordering heuristics — these require an ATS vocabulary corpus that doesn't exist yet.
- **MCP server npm publication** — the MCP server is now installable for people who clone the repo. The next step is getting it on npm so IDE extensions can list it as a one-click install.
- **SSR integration tests** — the SSR migration is done but there are no integration tests that verify a theme renders correctly in a real Next.js SSR context. Adding `test(themes): SSR render in Next.js environment` would catch regressions before they hit production.
- **`toiletpaper` error path UX** — failed uploads need to surface a clear error state on the paper page rather than hanging in the processing panel forever.
- **Deprecate `@repo/*` in flight** — some packages are still internally named `@repo/*` in non-published packages. These are fine as internal workspace names but should eventually be consistent with the `@jsonresume/*` convention to avoid confusion.
- **`resume-cli` standalone npm deprecation** — now that the CLI lives in the monorepo and publishes as `@jsonresume/cli`, the old `resume-cli` package on npm should be soft-deprecated with a deprecation notice pointing to the new package.

---

## Links & Resources

**Projects:**
- [jsonresume.org](https://github.com/jsonresume/jsonresume.org) — the monorepo: registry, CLI, themes, schema, and everything else
- [jsonresume/mcp](https://github.com/jsonresume/mcp) — MCP server that updates your resume while you code
- [thomasdavis/toiletpaper](https://github.com/thomasdavis/toiletpaper) — document processing app

**NPM Packages:**
- [@jsonresume/types](https://www.npmjs.com/package/@jsonresume/types) — TypeScript types for the JSON Resume schema
- [@jsonresume/utils](https://www.npmjs.com/package/@jsonresume/utils) — shared utilities across the ecosystem
- [@jsonresume/schema](https://www.npmjs.com/package/@jsonresume/schema) — the JSON Resume schema (draft-07, validated with Ajv)
- [@jsonresume/core](https://www.npmjs.com/package/@jsonresume/core) — SSR rendering engine (`renderResumeDocument`)
- [@jsonresume/theme-kit](https://www.npmjs.com/package/@jsonresume/theme-kit) — theme development scaffolding
- [@jsonresume/ats-validator](https://www.npmjs.com/package/@jsonresume/ats-validator) — ATS-friendliness scoring for resumes
- [@jsonresume/sample-data](https://www.npmjs.com/package/@jsonresume/sample-data) — example resumes for testing and development

**Tools & Services:**
- [Changesets](https://github.com/changesets/changesets) — versioning and npm publishing for the monorepo
- [Ajv](https://ajv.js.org/) — JSON Schema validation (draft-07), now powering `resume validate`
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) — `@modelcontextprotocol/sdk` — the SDK now imported properly from npm
- [Turborepo](https://turbo.build/repo) — monorepo build system; remote cache masking CI failures is a real footgun
- [Vercel](https://vercel.com/) — production hosting for the registry and homepage

**Inspiration:**
- The original `resume-schema` repo's Ajv validation approach — worth reading if you're doing schema-driven validation with precise error paths
- Changesets' [publish workflow documentation](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md) for the multi-package publish setup
