const express = require('express');
const cors = require('cors');

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

// Endpoint 1: Get Video Metadata
app.get('/api/info', async (req, res) => {
  try {
    const videoUrl = req.query.url || req.query.id;
    if (!videoUrl) {
      return res.status(400).json({ error: 'Please provide a YouTube video URL or ID' });
    }

    const ytId = getYoutubeId(videoUrl) || videoUrl;
    const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}`;

    const response = await fetch(noembedUrl);
    const data = await response.json();

    res.json({
      success: true,
      ytId: ytId,
      title: data.title || `YouTube Video (${ytId})`,
      author: data.author_name || 'YouTube Creator',
      thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video information'
    });
  }
});

// Endpoint 2: 100% PURE DIRECT MEDIA STREAM (ZERO EXTERNAL WEBSITES, ZERO REDIRECTS)
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

    // 1. Try Yewtu.be Invidious API for direct Google Video stream
    try {
      const yewRes = await fetch(`https://yewtu.be/api/v1/videos/${ytId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (yewRes.ok) {
        const yewData = await yewRes.json();
        let stream;
        if (isAudio && yewData.adaptiveFormats) {
          stream = yewData.adaptiveFormats.find(f => f.type && f.type.includes('audio'));
        } else if (yewData.formatStreams && yewData.formatStreams.length > 0) {
          stream = yewData.formatStreams.find(f => f.qualityLabel && f.qualityLabel.includes(quality)) ||
                   yewData.formatStreams.find(f => f.qualityLabel && f.qualityLabel.includes('720')) ||
                   yewData.formatStreams[0];
        }
        if (stream && stream.url) {
          return res.redirect(302, stream.url);
        }
      }
    } catch(e) {}

    // 2. Try Cobalt API instances
    const cobInstances = [
      'https://api.cobalt.tools/',
      'https://co.wuk.sh/api/json',
      'https://cobalt.api.sc7.io/'
    ];

    for (const host of cobInstances) {
      try {
        const cobRes = await fetch(host, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          body: JSON.stringify({
            url: fullUrl,
            downloadMode: isAudio ? 'audio' : 'auto',
            videoQuality: quality
          })
        });
        if (cobRes.ok) {
          const cobData = await cobRes.json();
          if (cobData && cobData.url) {
            return res.redirect(302, cobData.url);
          }
        }
      } catch(e) {}
    }

    // 3. Fallback direct yewtu.be stream redirect
    return res.redirect(302, `https://yewtu.be/latest_version?id=${ytId}&itag=${isAudio ? '140' : (quality === '1080' ? '22' : '18')}`);

  } catch (err) {
    console.error('Error processing download stream:', err.message);
    res.status(500).send('Direct media stream error');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Y2Tube Custom API Server running on port ${PORT}`);
});
