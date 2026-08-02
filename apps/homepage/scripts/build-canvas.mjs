// Build ajaxdavis.dev with the @jsonblog/generator-canvas theme.
// (Imports the monorepo build until the scoped package is published.)
import { generate } from '/mnt/donto-data/workspace/jsonblog/jsonblog/packages/generator-canvas/dist/index.js';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HP = dirname(dirname(fileURLToPath(import.meta.url)));
// Output dir is overridable (CANVAS_OUT) so the box deploy can build to a temp
// dir and atomically swap — a mid-build failure never empties the live build/.
const OUT = process.env.CANVAS_OUT ? join(HP, process.env.CANVAS_OUT) : join(HP, 'build');
const blog = JSON.parse(readFileSync(join(HP, 'blog.json'), 'utf8'));

const files = await generate(blog, HP);
rmSync(OUT, { recursive: true, force: true });
for (const f of files) {
  const p = join(OUT, f.name);
  mkdirSync(dirname(p), { recursive: true });
  if (f.copyFrom) copyFileSync(f.copyFrom, p);
  else writeFileSync(p, f.content ?? '');
}
// Static assets (og images, per-post scripts) ride along verbatim. The
// generator only emits pages it knows about, so anything hand-authored under
// assets/ has to be copied or it never reaches the site.
const ASSETS = join(HP, 'assets');
if (existsSync(ASSETS)) cpSync(ASSETS, join(OUT, 'assets'), { recursive: true });

console.log(`Canvas build complete — ${files.length} files + assets → ${OUT}`);
