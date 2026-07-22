// Build ajaxdavis.dev with the @jsonblog/generator-canvas theme.
// (Imports the monorepo build until the scoped package is published.)
import { generate } from '/mnt/donto-data/workspace/jsonblog/jsonblog/packages/generator-canvas/dist/index.js';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HP = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(HP, 'build');
const blog = JSON.parse(readFileSync(join(HP, 'blog.json'), 'utf8'));

const files = await generate(blog, HP);
rmSync(OUT, { recursive: true, force: true });
for (const f of files) {
  const p = join(OUT, f.name);
  mkdirSync(dirname(p), { recursive: true });
  if (f.copyFrom) copyFileSync(f.copyFrom, p);
  else writeFileSync(p, f.content ?? '');
}
console.log(`Canvas build complete — ${files.length} files → build/`);
