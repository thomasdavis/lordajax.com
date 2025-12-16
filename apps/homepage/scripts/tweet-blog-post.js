const fs = require('fs');
const path = require('path');
const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');
const { TwitterApi } = require('twitter-api-v2');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Site configuration
const SITE_URL = 'https://ajaxdavis.dev';

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

// Generate post URL from source path
function getPostUrl(post) {
  // Extract slug from source path
  // e.g., "./posts/week-of-monorepo-migrations.md" -> "week-of-monorepo-migrations"
  // or "./posts/my-post/post.md" -> "my-post"
  const source = post.source;
  let slug;

  if (source.includes('/post.md')) {
    // Directory format: ./posts/slug/post.md
    const match = source.match(/\.\/posts\/([^/]+)\/post\.md/);
    slug = match ? match[1] : null;
  } else {
    // Simple format: ./posts/slug.md
    const match = source.match(/\.\/posts\/([^.]+)\.md/);
    slug = match ? match[1] : null;
  }

  if (slug) {
    return `${SITE_URL}/${slug}`;
  }

  // Fallback to main site
  return SITE_URL;
}

// Generate a witty tweet using AI
async function generateTweet(post, content) {
  const postUrl = getPostUrl(post);

  const prompt = `You are Lord Ajax, a software developer who writes about their coding adventures with a casual, witty tone. You're posting to Twitter/X about your latest blog post.

Write a tweet structured like this:

1. Short witty intro (1-2 sentences max)

2. Then for EACH project, a section like:

PROJECT NAME (brief description)
→ what you shipped
→ another thing

NEXT PROJECT (brief description)
→ what you shipped
→ etc

3. Short closing line

Blog post title: ${post.title}

${content ? `Blog post content:\n${content}` : ''}

IMPORTANT:
- Output ONLY the tweet text, nothing else
- Do NOT include the URL in your response (it will be added automatically)
- Twitter does NOT support markdown - use PLAIN TEXT only
- Use ALL CAPS for project names (not **bold** or any markdown)
- Use → or - for bullet points, NOT •
- Keep bullets short and punchy - concrete deliverables only
- NEVER mention commit counts or stats
- No hashtags
- Be genuine, not corporate`;

  const { text } = await generateText({
    model: openai('gpt-5.2'),
    prompt,
    maxCompletionTokens: 400,
  });

  // Clean up and append URL
  const tweetText = text.trim();
  const fullTweet = `${tweetText}\n\n${postUrl}`;

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
