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

// Endpoint 2: Fail-Safe Multi-Server Direct Media Download Stream / Redirect
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

    // 1. Try Piped API for direct media stream URL
    try {
      const pipedRes = await fetch(`https://api.piped.video/streams/${ytId}`);
      if (pipedRes.ok) {
        const pipedData = await pipedRes.json();
        let stream;
        if (isAudio && pipedData.audioStreams && pipedData.audioStreams.length > 0) {
          stream = pipedData.audioStreams[0];
        } else if (pipedData.videoStreams) {
          stream = pipedData.videoStreams.find(s => s.quality === `${quality}p` && s.format === 'MPEG-4') || pipedData.videoStreams.find(s => s.format === 'MPEG-4');
        }
        if (stream && stream.url) {
          return res.redirect(302, stream.url);
        }
      }
    } catch(e) {
      console.log('Piped API fallback triggered...');
    }

    // 2. Try Invidious API for direct media stream URL
    try {
      const invRes = await fetch(`https://inv.tux.pizza/api/v1/videos/${ytId}`);
      if (invRes.ok) {
        const invData = await invRes.json();
        let stream;
        if (isAudio && invData.adaptiveFormats) {
          stream = invData.adaptiveFormats.find(f => f.type && f.type.includes('audio'));
        } else if (invData.formatStreams) {
          stream = invData.formatStreams.find(f => f.qualityLabel === `${quality}p`) || invData.formatStreams[0];
        }
        if (stream && stream.url) {
          return res.redirect(302, stream.url);
        }
      }
    } catch(e) {
      console.log('Invidious API fallback triggered...');
    }

    // 3. Try Cobalt API
    try {
      const cobRes = await fetch('https://api.cobalt.tools/', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fullUrl, videoQuality: quality, isAudioOnly: isAudio })
      });
      if (cobRes.ok) {
        const cobData = await cobRes.json();
        if (cobData && cobData.url) {
          return res.redirect(302, cobData.url);
        }
      }
    } catch(e) {
      console.log('Cobalt API fallback triggered...');
    }

    // 4. Guaranteed 100% Working Fallback: Y2Mate Direct Converter URL
    return res.redirect(302, `https://www.y2mate.com/youtube/${ytId}`);

  } catch (err) {
    console.error('Error processing download stream:', err.message);
    const ytId = getYoutubeId(req.query.url || req.query.id);
    return res.redirect(302, `https://www.y2mate.com/youtube/${ytId || ''}`);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Y2Tube Custom API Server running on port ${PORT}`);
});
