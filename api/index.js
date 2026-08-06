const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper function to extract YouTube ID
function getYoutubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Y2Tube Custom YouTube Downloader API',
    version: '1.0.0'
  });
});

// Endpoint 1: Get Video Metadata & Available Formats
app.get('/api/info', async (req, res) => {
  try {
    const videoUrl = req.query.url || req.query.id;
    if (!videoUrl) {
      return res.status(400).json({ error: 'Please provide a YouTube video URL or ID' });
    }

    const ytId = getYoutubeId(videoUrl) || videoUrl;
    const fullUrl = `https://www.youtube.com/watch?v=${ytId}`;

    const info = await ytdl.getInfo(fullUrl);
    const details = info.videoDetails;

    res.json({
      success: true,
      ytId: ytId,
      title: details.title,
      author: details.author ? details.author.name : 'YouTube Creator',
      thumbnail: details.thumbnails && details.thumbnails.length > 0 ? details.thumbnails[details.thumbnails.length - 1].url : `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      duration: `${Math.floor(details.lengthSeconds / 60)}:${(details.lengthSeconds % 60).toString().padStart(2, '0')}`
    });
  } catch (err) {
    console.error('Error fetching video info:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video information. Please verify the YouTube URL.'
    });
  }
});

// Endpoint 2: Direct File Download Stream / Redirect (MP4 / MP3)
app.get('/api/download', async (req, res) => {
  try {
    const videoUrl = req.query.url || req.query.id;
    const quality = req.query.quality || '720';
    const isAudio = req.query.format === 'mp3' || req.query.type === 'audio';

    if (!videoUrl) {
      return res.status(400).send('Missing video URL or ID');
    }

    const ytId = getYoutubeId(videoUrl) || videoUrl;
    const fullUrl = `https://www.youtube.com/watch?v=${ytId}`;

    // 1. Try ytdl-core direct format extraction
    try {
      const info = await ytdl.getInfo(fullUrl);
      let targetFormat;

      if (isAudio) {
        targetFormat = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
      } else {
        targetFormat = ytdl.chooseFormat(info.formats, {
          filter: (f) => f.container === 'mp4' && f.hasVideo && f.hasAudio
        });
      }

      if (targetFormat && targetFormat.url) {
        return res.redirect(302, targetFormat.url);
      }
    } catch (e) {
      console.log('ytdl.getInfo fallback triggered...');
    }

    // 2. High-speed direct fallback stream URL
    const fallbackUrl = `https://inv.tux.pizza/latest_version?id=${ytId}&itag=${isAudio ? '140' : (quality === '1080' ? '22' : '18')}&local=true`;
    return res.redirect(302, fallbackUrl);

  } catch (err) {
    console.error('Error processing download:', err.message);
    res.status(500).send('Failed to process download stream');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Y2Tube Custom API Server running on port ${PORT}`);
});
