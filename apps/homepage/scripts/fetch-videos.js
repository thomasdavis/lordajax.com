const fs = require('fs');
const path = require('path');
const https = require('https');
const { parseString } = require('xml2js');

// YouTube channel ID for @ajax_davis
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCDukH7ZhQX67eNenPrWyhcw';

// Fetch YouTube RSS feed
async function fetchYouTubeRSS(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        parseString(data, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    }).on('error', reject);
  });
}

// Transform RSS data to simplified video objects
function transformVideoData(rssData) {
  if (!rssData.feed || !rssData.feed.entry) {
    console.warn('⚠ No videos found in RSS feed');
    return [];
  }

  const entries = rssData.feed.entry || [];

  return entries.map(entry => {
    // Extract video ID
    const videoId = entry['yt:videoId'] ? entry['yt:videoId'][0] : '';

    // Extract thumbnail - YouTube provides different sizes
    const mediaGroup = entry['media:group'] ? entry['media:group'][0] : {};
    const thumbnail = mediaGroup['media:thumbnail'] && mediaGroup['media:thumbnail'][0]
      ? mediaGroup['media:thumbnail'][0].$.url
      : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Extract description
    const description = mediaGroup['media:description']
      ? mediaGroup['media:description'][0]
      : '';

    // Extract title
    const title = entry.title && entry.title[0] ? entry.title[0] : 'Untitled Video';

    // Extract URL
    const url = entry.link && entry.link[0] && entry.link[0].$
      ? entry.link[0].$.href
      : `https://www.youtube.com/watch?v=${videoId}`;

    // Extract publish date
    const publishedAt = entry.published ? entry.published[0] : new Date().toISOString();

    return {
      id: videoId,
      title: title,
      description: description,
      thumbnail: thumbnail,
      publishedAt: publishedAt,
      url: url,
    };
  });
}

// Escape HTML special characters
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Format date to readable string
function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Generate markdown with magazine-style layout
function generateVideosMarkdown(videos) {
  if (videos.length === 0) {
    return `# Videos\n\nNo videos available at the moment. Check back soon!\n`;
  }

  const [featured, ...rest] = videos;

  let markdown = `# Videos\n\n`;
  markdown += `Check out my [YouTube channel](https://www.youtube.com/@ajax_davis) for more content!\n\n`;
  markdown += `<div class="videos-container mt-8">\n`;

  // Featured video section (no indentation to avoid code blocks)
  markdown += `<div class="featured-video mb-12 border-b-2 border-gray-200 pb-8">\n`;
  markdown += `<a href="${featured.url}" target="_blank" rel="noopener noreferrer" class="block group hover:opacity-90 transition-all duration-300">\n`;
  markdown += `<div class="relative overflow-hidden rounded-lg mb-4 shadow-lg">\n`;
  markdown += `<img src="${featured.thumbnail}" alt="${escapeHtml(featured.title)}" class="w-full h-auto group-hover:scale-105 transition-transform duration-300" />\n`;
  markdown += `<div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300"></div>\n`;
  markdown += `</div>\n`;
  markdown += `<h2 class="text-2xl md:text-3xl font-semibold mb-3 text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">${escapeHtml(featured.title)}</h2>\n`;
  markdown += `</a>\n`;

  const featuredDesc = featured.description.slice(0, 250);
  if (featuredDesc) {
    markdown += `<p class="text-gray-600 text-base leading-relaxed mb-3">${escapeHtml(featuredDesc)}${featured.description.length > 250 ? '...' : ''}</p>\n`;
  }
  markdown += `<div class="text-sm text-gray-500">\n`;
  markdown += `<time datetime="${featured.publishedAt}">${formatDate(featured.publishedAt)}</time>\n`;
  markdown += `</div>\n`;
  markdown += `</div>\n\n`;

  // Video grid
  if (rest.length > 0) {
    markdown += `<div class="video-grid grid grid-cols-1 md:grid-cols-2 gap-8">\n`;

    rest.forEach(video => {
      markdown += `<article class="video-item group">\n`;
      markdown += `<a href="${video.url}" target="_blank" rel="noopener noreferrer" class="block hover:opacity-90 transition-all duration-300">\n`;
      markdown += `<div class="relative overflow-hidden rounded-lg mb-3 shadow-md">\n`;
      markdown += `<img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" class="w-full h-auto group-hover:scale-105 transition-transform duration-300" />\n`;
      markdown += `<div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300"></div>\n`;
      markdown += `</div>\n`;
      markdown += `<h3 class="text-lg md:text-xl font-medium mb-2 text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">${escapeHtml(video.title)}</h3>\n`;
      markdown += `</a>\n`;

      const videoDesc = video.description.slice(0, 150);
      if (videoDesc) {
        markdown += `<p class="text-gray-600 text-sm leading-relaxed mb-2 line-clamp-2">${escapeHtml(videoDesc)}${video.description.length > 150 ? '...' : ''}</p>\n`;
      }
      markdown += `<div class="text-xs text-gray-500">\n`;
      markdown += `<time datetime="${video.publishedAt}">${formatDate(video.publishedAt)}</time>\n`;
      markdown += `</div>\n`;
      markdown += `</article>\n`;
    });

    markdown += `</div>\n`;
  }

  markdown += `</div>\n\n`;

  // Add custom CSS for line clamping
  markdown += `<style>\n`;
  markdown += `.line-clamp-2 {\n`;
  markdown += `  display: -webkit-box;\n`;
  markdown += `  -webkit-line-clamp: 2;\n`;
  markdown += `  -webkit-box-orient: vertical;\n`;
  markdown += `  overflow: hidden;\n`;
  markdown += `}\n`;
  markdown += `</style>\n`;

  return markdown;
}

// Main function
async function main() {
  try {
    console.log('🎬 Fetching YouTube videos...');

    if (YOUTUBE_CHANNEL_ID === 'YOUR_CHANNEL_ID_HERE') {
      console.error('❌ Error: YouTube channel ID not set!');
      console.error('Please set YOUTUBE_CHANNEL_ID environment variable or update the script.');
      console.error('Get your channel ID from: https://commentpicker.com/youtube-channel-id.php');
      process.exit(1);
    }

    const rssData = await fetchYouTubeRSS(YOUTUBE_CHANNEL_ID);
    const videos = transformVideoData(rssData);

    if (videos.length === 0) {
      console.warn('⚠ No videos found in RSS feed');
      // Try loading from cache
      const cachedPath = path.join(__dirname, '..', 'data', 'videos.json');
      if (fs.existsSync(cachedPath)) {
        console.log('📦 Using cached video data');
        const cachedVideos = JSON.parse(fs.readFileSync(cachedPath, 'utf8'));
        const markdown = generateVideosMarkdown(cachedVideos);
        const pagesDir = path.join(__dirname, '..', 'pages');
        const markdownPath = path.join(pagesDir, 'videos.md');
        fs.writeFileSync(markdownPath, markdown);
        console.log(`✅ Generated ${markdownPath} from cache`);
        return;
      }
    }

    console.log(`✓ Fetched ${videos.length} videos`);

    // Save raw data to JSON file
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dataPath = path.join(dataDir, 'videos.json');
    fs.writeFileSync(dataPath, JSON.stringify(videos, null, 2));
    console.log(`✓ Saved data to ${dataPath}`);

    // Generate videos page markdown
    const markdown = generateVideosMarkdown(videos);
    const pagesDir = path.join(__dirname, '..', 'pages');
    const markdownPath = path.join(pagesDir, 'videos.md');
    fs.writeFileSync(markdownPath, markdown);

    console.log(`✓ Generated ${markdownPath}`);
    console.log('✅ Videos page ready!');
  } catch (error) {
    console.error('❌ Error fetching videos:', error.message);

    // Try loading from cache
    const cachedPath = path.join(__dirname, '..', 'data', 'videos.json');
    if (fs.existsSync(cachedPath)) {
      console.log('📦 Using cached video data');
      const videos = JSON.parse(fs.readFileSync(cachedPath, 'utf8'));
      const markdown = generateVideosMarkdown(videos);
      const pagesDir = path.join(__dirname, '..', 'pages');
      const markdownPath = path.join(pagesDir, 'videos.md');
      fs.writeFileSync(markdownPath, markdown);
      console.log(`✅ Generated ${markdownPath} from cache`);
    } else {
      console.error('❌ No cached data available');
      process.exit(1);
    }
  }
}

// Run the script
main();
