const fs = require('fs');
const path = require('path');
const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');
const { TwitterApi } = require('twitter-api-v2');
const slugify = require('slugify');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Site configuration
const SITE_URL = 'https://ajaxdavis.dev';
// The account is X Premium, so tweets are long-form. This is only a sanity ceiling
// well under the 25k Premium limit — we do NOT truncate to 280.
const TWEET_MAX = 8000;
// Openly disclosed — the devlog is AI-written and so is this tweet.
const DISCLOSURE = '(AI-written: blog + tweet)';
// MUST match the site generator's slug exactly (@jsonblog/helpers `slug`), or the
// tweet links to a 404. slugify maps &→"and" and transliterates accents
// (Pokémon→pokemon). NOTE: the tweet URL prefers the post's explicit `slug` field
// (getPostUrl) so a pinned page URL and the tweet never disagree.
const SLUGIFY_OPTS = { lower: true, strict: true, remove: /[*+~.()'"!:@]/g };

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Read blog.json and get the newest post by date
function getNewestPost() {
  const blogPath = path.join(__dirname, '../blog.json');
  const blog = JSON.parse(fs.readFileSync(blogPath, 'utf8'));
  const sorted = [...blog.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sorted[0];
}

// Read the markdown content of a post
function getPostContent(post) {
  if (post.source.startsWith('http')) {
    // Remote posts - we'll just use the title for now
    return null;
  }

  const postPath = path.join(__dirname, '..', post.source);
  if (fs.existsSync(postPath)) {
    return fs.readFileSync(postPath, 'utf8');
  }
  return null;
}

// Generate post URL. Prefer the post's explicit `slug` (the site generator honours
// it too), else derive it exactly the way the generator does. This is what keeps
// the tweet link and the real page URL in lock-step — no 404s.
function getPostUrl(post) {
  const slug = post.slug || slugify(post.title, SLUGIFY_OPTS);
  return `${SITE_URL}/${slug}/`;
}

// Trim to a line boundary — only ever hit if the model wildly overshoots the
// Premium-safe ceiling; normal tweets pass through untouched.
function trimToLineBoundary(text, maxChars) {
  if (text.length <= maxChars) return text;
  let cut = text.slice(0, maxChars);
  const lastBreak = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. '));
  if (lastBreak > maxChars * 0.5) cut = cut.slice(0, lastBreak);
  return cut.trim();
}

// Generate a long-form (X Premium) tweet: a per-project technical rundown of the
// week. Not capped at 280 — the account is Premium.
async function generateTweet(post, content) {
  const postUrl = getPostUrl(post);
  const bodyCeiling = TWEET_MAX - (2 + postUrl.length + 2 + DISCLOSURE.length);

  const prompt = `You're a software engineer posting a technical rundown of what you shipped this week, linking your weekly devlog (which is AI-written). The account is X Premium, so this is a LONG-FORM tweet — length is fine; substance matters.

Write the BODY of the tweet (the URL and an AI-disclosure line are appended for you — do not write them):
- Start with one dry, specific line summarizing the week (no "excited to", no "check out", no hype).
- Then ONE line per project you actually worked on this week — cover EVERY project, don't drop any. Name each project in ALL CAPS, then a concrete TECHNICAL detail that conveys the complexity of what was done (the actual mechanism, algorithm, bug, or design decision — not "improved X"). Examples of the right altitude: "JSONRESUME: hybrid retrieval — dense embeddings fused with a Postgres tsvector arm — plus Rocchio negative-feedback to bend ranking away from rejected jobs", "TPMJS: fixed a React hydration mismatch from reading devicePixelRatio during SSR; gated canvas work behind an isHydrated flag".
- Dry, precise, engineer-to-engineer. No marketing, no emoji, no hashtags, no calls to action.

Ground every detail in the post below — pull the real specifics, invent nothing. If you're unsure of a project's technical detail, keep it factual and modest rather than embellishing.

Blog post title: ${post.title}
${content ? `\nBlog post content:\n${content.slice(0, 12000)}` : ''}

Output ONLY the tweet body (no preamble, no surrounding quotes, no URL, no disclosure line). Stay under ${bodyCeiling} characters.`;

  let body = '';
  try {
    const { text } = await generateText({ model: openai('gpt-4o'), prompt, maxTokens: 1200 });
    body = (text || '').trim();
  } catch (e) {
    console.error('⚠️  Tweet generation failed, falling back to title:', e.message);
    body = post.title;
  }

  // Strip model artifacts + anything it appended that we add ourselves.
  body = body
    .replace(/^\s*(here'?s|sure|okay|ok)[^\n:]*:\s*/i, '')
    .replace(/^["'“”`]+|["'“”`]+$/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\(?\s*(this\s+)?(tweet|post|blog)[^)\n]*ai[- ]?(generated|written)[^)\n]*\)?/gi, '')
    .replace(/\(?\s*ai[- ](generated|written)[^)\n]*\)?/gi, '')
    .trim();
  body = trimToLineBoundary(body, bodyCeiling);
  if (!body) body = post.title;

  const fullTweet = `${body}\n\n${postUrl}\n\n${DISCLOSURE}`;
  console.log(`   tweet length: ${fullTweet.length} chars (body ${body.length}), url ${postUrl}`);
  return fullTweet;
}

// Post tweet to Twitter
async function postTweet(tweetText) {
  try {
    const rwClient = twitterClient.readWrite;
    const { data } = await rwClient.v2.tweet(tweetText);
    console.log('✅ Tweet posted successfully!');
    console.log(`Tweet ID: ${data.id}`);
    console.log(`Tweet: ${tweetText}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to post tweet:', error.message);
    if (error.data) {
      console.error('Twitter API error:', JSON.stringify(error.data, null, 2));
    }
    throw error;
  }
}

// Main function
async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🐦 Tweet Blog Post Script\n');
  if (dryRun) {
    console.log('🧪 DRY RUN MODE - will not post to Twitter\n');
  }

  // Check for required environment variables
  const required = dryRun
    ? ['OPENAI_API_KEY']
    : [
        'OPENAI_API_KEY',
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_TOKEN_SECRET',
      ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Get the newest post
  const post = getNewestPost();
  console.log(`📝 Newest post: "${post.title}"`);
  console.log(`📅 Created: ${post.createdAt}\n`);

  // Only auto-tweet the AI devlog. Human essays are not machine-announced (and
  // must never carry the AI-generated disclosure). This also guards against a
  // human push that edits an old essay re-triggering the tweet workflow.
  if (post.type !== 'ai') {
    console.log('ℹ️  Newest post is a human essay (type !== "ai") — skipping tweet.');
    return;
  }

  // Get post content
  const content = getPostContent(post);
  if (content) {
    console.log(`📄 Post content loaded (${content.length} characters)\n`);
  } else {
    console.log(`⚠️ Could not load post content, using title only\n`);
  }

  // Generate tweet
  console.log('🤖 Generating tweet with AI...\n');
  const tweet = await generateTweet(post, content);
  console.log('Generated tweet:');
  console.log('---');
  console.log(tweet);
  console.log('---\n');

  // Post to Twitter
  if (dryRun) {
    console.log('🧪 DRY RUN - Skipping Twitter post\n');
  } else {
    console.log('📤 Posting to Twitter...\n');
    await postTweet(tweet);
  }

  console.log('✅ Done!');
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
