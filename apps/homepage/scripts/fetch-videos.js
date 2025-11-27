const fs = require('fs');
const path = require('path');
const https = require('https');
const { parseString } = require('xml2js');

// YouTube channel ID for @ajax_davis
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCS4PhD6QK_m0C0C2M8xAWNA';

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

// Transform RSS data to grid-compatible format
function transformVideoData(rssData) {
  if (!rssData.feed || !rssData.feed.entry) {
    console.warn('⚠ No videos found in RSS feed');
    return [];
  }

  const entries = rssData.feed.entry || [];

  return entries.map((entry, index) => {
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
      title: title,
      description: description,
      url: url,
      image: thumbnail,
      date: publishedAt.split('T')[0], // Format as YYYY-MM-DD
      featured: index === 0, // First video is featured
    };
  });
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

    console.log(`✓ Fetched ${videos.length} videos`);

    // Save to videos.json (used by blog.json via itemsSource)
    const videosPath = path.join(__dirname, '..', 'videos.json');
    fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
    console.log(`✓ Saved to ${videosPath}`);
    console.log('✅ Videos data ready!');
  } catch (error) {
    console.error('❌ Error fetching videos:', error.message);

    // Check if we have cached data
    const videosPath = path.join(__dirname, '..', 'videos.json');
    if (fs.existsSync(videosPath)) {
      console.log('📦 Using existing videos.json (fetch failed)');
    } else {
      console.error('❌ No existing videos.json and fetch failed');
      process.exit(1);
    }
  }
}

// Run the script
main();
