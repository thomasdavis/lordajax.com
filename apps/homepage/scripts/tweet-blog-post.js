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
// Twitter counts every link as this many characters (t.co wrapping), regardless
// of the real URL length.
const TCO_LEN = 23;
const TWEET_MAX = 280;
// Openly disclosed — the devlog is AI-written and so is this tweet.
const DISCLOSURE = '(AI-written: blog + tweet)';
// MUST match the site generator's slug exactly (@jsonblog/helpers `slug`), or the
// tweet links to a 404. slugify maps &→"and" and transliterates accents
// (Pokémon→pokemon) — a hand-rolled regex silently dropped those and broke links.
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

// Generate post URL — MUST match the site generator's slug (see SLUGIFY_OPTS).
// Trailing slash matches the page's canonical URL (avoids a redirect hop).
function getPostUrl(post) {
  return `${SITE_URL}/${slugify(post.title, SLUGIFY_OPTS)}/`;
}

// Twitter's weighted length: the URL always costs TCO_LEN, everything else 1/char.
function weightedLength(body, url) {
  return body.length + 2 /* \n\n */ + TCO_LEN + 2 /* \n\n */ + DISCLOSURE.length;
}

// Trim to a whole-sentence/word boundary so the tweet never mid-cuts a word.
function trimToBudget(text, maxChars) {
  if (text.length <= maxChars) return text;
  let cut = text.slice(0, maxChars);
  const lastBreak = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
  if (lastBreak > maxChars * 0.5) cut = cut.slice(0, lastBreak);
  return cut.replace(/[\s\-—→,.]+$/, '').trim();
}

// Generate a tweet, then GUARANTEE it fits in 280 weighted chars.
async function generateTweet(post, content) {
  const postUrl = getPostUrl(post);
  // Body budget = 280 − (blank line) − t.co URL − (blank line) − disclosure.
  const bodyBudget = TWEET_MAX - (2 + TCO_LEN + 2 + DISCLOSURE.length);

  const prompt = `You're a software engineer quietly noting what you shipped, like a text to a friend — not selling anything. The blog post you're linking is an AI-written weekly devlog.

Write the body of a tweet (no URL, no sign-off — those are appended for you):
- Open with one dry, specific line about the week's actual work (no "excited to share", no "check out", no hype).
- Then 2–4 short lines, one per project you touched, each naming the project in ALL CAPS and what changed. Pick the most interesting ones; don't list everything.
- Sound like a person who happens to code, not a LinkedIn post.

Blog post title: ${post.title}
${content ? `\nBlog post content (for grounding — pull real specifics, invent nothing):\n${content.slice(0, 6000)}` : ''}

HARD RULES:
- Output ONLY the tweet body. No preamble, no quotes around it.
- The body MUST be at most ${bodyBudget} characters. Count them. Shorter is fine.
- Plain text only (Twitter has no markdown). Use "→" or "-" for bullets.
- No hashtags, no emojis, no calls to action, no exclamation marks.
- Do NOT write the URL and do NOT write any AI-disclosure line — both are added automatically.`;

  let body = '';
  try {
    // NB: the AI SDK option is `maxTokens` — `maxCompletionTokens` is silently ignored.
    const { text } = await generateText({ model: openai('gpt-4o'), prompt, maxTokens: 160 });
    body = (text || '').trim();
  } catch (e) {
    console.error('⚠️  Tweet generation failed, falling back to title:', e.message);
    body = post.title;
  }

  // Belt-and-suspenders: strip model artifacts (preamble, wrapping quotes), any
  // URL/disclosure it added anyway, then hard-trim so the final tweet is ALWAYS
  // ≤ 280 weighted chars.
  body = body
    .replace(/^\s*(here'?s|sure|okay|ok)[^\n:]*:\s*/i, '') // "Here's your tweet:" preamble
    .replace(/^["'“”`]+|["'“”`]+$/g, '') // wrapping quotes
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\(?\s*(this\s+)?(tweet|post|blog)[^)\n]*ai[- ]?(generated|written)[^)\n]*\)?/gi, '')
    .replace(/\(?\s*ai[- ](generated|written)[^)\n]*\)?/gi, '')
    .trim();
  body = trimToBudget(body, bodyBudget);
  if (!body) body = trimToBudget(post.title, bodyBudget);

  const fullTweet = `${body}\n\n${postUrl}\n\n${DISCLOSURE}`;
  const weighted = weightedLength(body, postUrl);
  console.log(`   tweet weighted length: ${weighted}/${TWEET_MAX} (body ${body.length}/${bodyBudget})`);
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
