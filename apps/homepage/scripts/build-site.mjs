#!/usr/bin/env node

/**
 * Custom build script that separates AI-generated devlog posts from
 * human-written posts. Runs the generator twice and merges the output:
 * - Homepage: human posts only
 * - /devlog: AI posts only
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOMEPAGE_DIR = join(__dirname, '..');
const BUILD_DIR = join(HOMEPAGE_DIR, 'build');

// Import the generator
const { generateBlog } = await import('@jsonblog/generator-tailwind');

// Load blog config
const blogJson = JSON.parse(readFileSync(join(HOMEPAGE_DIR, 'blog.json'), 'utf-8'));

// Split posts into human and AI
const humanPosts = blogJson.posts.filter(p => p.type !== 'ai');
const aiPosts = blogJson.posts.filter(p => p.type === 'ai');

console.log(`Human posts: ${humanPosts.length}, AI posts: ${aiPosts.length}`);

// Build 1: Main site with human posts only
console.log('Building main site (human posts)...');
const mainBlog = { ...blogJson, posts: humanPosts };
const mainFiles = await generateBlog(mainBlog, HOMEPAGE_DIR);
console.log(`  Generated ${mainFiles.length} files`);

// Build 2: Devlog with AI posts only (high postsPerPage to avoid pagination)
console.log('Building devlog (AI posts)...');
const devlogBlog = {
  ...blogJson,
  posts: aiPosts,
  settings: { ...(blogJson.settings || {}), postsPerPage: 999 },
};
const devlogFiles = await generateBlog(devlogBlog, HOMEPAGE_DIR);
console.log(`  Generated ${devlogFiles.length} files`);

// Collect output files
const outputFiles = new Map();

// Add all main build files
for (const file of mainFiles) {
  outputFiles.set(file.name, file.content);
}

// From devlog build, take only the index (as devlog/index.html) and AI post pages.
// AI post pages are identified as files that exist in devlog build but NOT in main build.
const mainFileNames = new Set(mainFiles.map(f => f.name));
const aiPostSlugs = new Set();

for (const file of devlogFiles) {
  if (file.name === 'index.html') {
    outputFiles.set('devlog/index.html', file.content);
  } else if (!mainFileNames.has(file.name)) {
    // Only in devlog build → must be an AI post page
    outputFiles.set(file.name, file.content);
    const match = file.name.match(/^([^/]+)\/index\.html$/);
    if (match) aiPostSlugs.add(match[1]);
  }
}

console.log(`AI post slugs (${aiPostSlugs.size}): ${[...aiPostSlugs].join(', ')}`);

// Merge sitemaps: add /devlog/ page + AI post URLs to main sitemap
const devlogSitemap = devlogFiles.find(f => f.name === 'sitemap.xml');
if (outputFiles.has('sitemap.xml') && devlogSitemap) {
  let sitemap = outputFiles.get('sitemap.xml');

  // Extract AI post <url> entries from devlog sitemap
  const urlEntries = devlogSitemap.content.match(/<url>[\s\S]*?<\/url>/g) || [];
  const aiUrlEntries = urlEntries.filter(entry => {
    for (const slug of aiPostSlugs) {
      if (entry.includes(`/${slug}/`)) return true;
    }
    return false;
  });

  // Build new entries: devlog page + AI post pages
  const devlogPageEntry = `  <url>
    <loc>https://example.com/devlog/</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

  const newEntries = [devlogPageEntry, ...aiUrlEntries.map(e => `  ${e}`)].join('\n');
  sitemap = sitemap.replace('</urlset>', `${newEntries}\n</urlset>`);
  outputFiles.set('sitemap.xml', sitemap);
}

// Post-process all HTML files
const BACK_LINK_OLD = '<a href="/" class="font-mono text-sm text-accent-blue hover:text-accent-cyan uppercase tracking-wider">\u2190 Back to posts</a>';
const BACK_LINK_NEW = '<a href="/devlog" class="font-mono text-sm text-accent-blue hover:text-accent-cyan uppercase tracking-wider">\u2190 Back to devlog</a>';

for (const [name, content] of outputFiles) {
  if (!name.endsWith('.html')) continue;

  let html = content;

  // Inject Devlog nav link before </nav>
  html = html.replace(
    '</nav>',
    '          <a href="/devlog">Devlog</a>\n      </nav>',
  );

  // Fix devlog index page title
  if (name === 'devlog/index.html') {
    html = html.replace(/<title>[^<]*<\/title>/, '<title>Devlog - Lord Ajax</title>');
  }

  // Fix AI post pages: "Back to posts" → "Back to devlog" linking to /devlog
  const slugMatch = name.match(/^([^/]+)\/index\.html$/);
  if (slugMatch && aiPostSlugs.has(slugMatch[1])) {
    html = html.replace(BACK_LINK_OLD, BACK_LINK_NEW);
  }

  outputFiles.set(name, html);
}

// Clean build directory and write all files
rmSync(BUILD_DIR, { recursive: true, force: true });

for (const [name, content] of outputFiles) {
  const filePath = join(BUILD_DIR, name);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

console.log(`\nBuild complete! ${outputFiles.size} files written to build/`);
console.log(`  Homepage: ${humanPosts.length} human posts`);
console.log(`  Devlog: ${aiPosts.length} AI posts at /devlog`);
