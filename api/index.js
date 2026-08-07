const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

function getYoutubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Y2Tube Custom YouTube Downloader API',
    version: '1.0.0'
  });
});

app.get('/api/info', async (req, res) => {
  try {
    const videoUrl = req.query.url || req.query.id;
    if (!videoUrl) return res.status(400).json({ error: 'Please provide YouTube URL' });

    const ytId = getYoutubeId(videoUrl) || videoUrl;
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}`);
    const data = await response.json();

    res.json({
      success: true,
      ytId: ytId,
      title: data.title || `YouTube Video (${ytId})`,
      author: data.author_name || 'YouTube Creator',
      thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed' });
  }
});

// DIRECT GOOGLEVIDEO.COM STREAM ONLY
app.get('/api/download', async (req, res) => {
  try {
    const videoUrl = req.query.url || req.query.id;
    const quality = req.query.quality || '720';
    const isAudio = req.query.format === 'mp3' || req.query.type === 'audio';

    if (!videoUrl) return res.status(400).send('Missing video URL');

    const ytId = getYoutubeId(videoUrl) || videoUrl;

    try {
      const pipedRes = await fetch(`https://api.piped.private.coffee/streams/${ytId}`);
      if (pipedRes.ok) {
        const pipedData = await pipedRes.json();
        const streams = isAudio ? pipedData.audioStreams : pipedData.videoStreams;
        if (streams && streams.length > 0) {
          const directItem = streams.find(s => s.url && s.url.includes('googlevideo.com') && s.quality && s.quality.includes(quality)) ||
                             streams.find(s => s.url && s.url.includes('googlevideo.com'));
          if (directItem && directItem.url) {
            return res.redirect(302, directItem.url);
          }
        }
      }
    } catch(e) {}

    try {
      const yewRes = await fetch(`https://yewtu.be/api/v1/videos/${ytId}`);
      if (yewRes.ok) {
        const yewData = await yewRes.json();
        const formats = isAudio ? yewData.adaptiveFormats : yewData.formatStreams;
        if (formats && formats.length > 0) {
          const directItem = formats.find(f => f.url && f.url.includes('googlevideo.com') && f.qualityLabel && f.qualityLabel.includes(quality)) ||
                             formats.find(f => f.url && f.url.includes('googlevideo.com'));
          if (directItem && directItem.url) {
            return res.redirect(302, directItem.url);
          }
        }
      }
    } catch(e) {}

    try {
      const drgnsRes = await fetch(`https://invidious.drgns.space/api/v1/videos/${ytId}`);
      if (drgnsRes.ok) {
        const drgnsData = await drgnsRes.json();
        const formats = isAudio ? drgnsData.adaptiveFormats : drgnsData.formatStreams;
        if (formats && formats.length > 0) {
          const directItem = formats.find(f => f.url && f.url.includes('googlevideo.com') && f.qualityLabel && f.qualityLabel.includes(quality)) ||
                             formats.find(f => f.url && f.url.includes('googlevideo.com'));
          if (directItem && directItem.url) {
            return res.redirect(302, directItem.url);
          }
        }
      }
    } catch(e) {}

    res.status(503).send('Direct Google Video stream URL processing. Please try again.');

  } catch (err) {
    res.status(500).send('Download error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
