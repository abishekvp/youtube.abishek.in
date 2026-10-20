import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { Innertube, ClientType } from 'youtubei.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory cache for video metadata (15 minutes TTL)
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

// In-memory multi-client instances
let ytVision = null;
let ytVr = null;

async function getVisionClient() {
  if (!ytVision) {
    ytVision = await Innertube.create({ client_type: ClientType.VISIONOS });
  }
  return ytVision;
}

async function getVrClient() {
  if (!ytVr) {
    ytVr = await Innertube.create({ client_type: ClientType.ANDROID_VR });
  }
  return ytVr;
}

/**
 * Extract YouTube 11-char Video ID from any URL format
 */
function extractVideoId(input) {
  if (!input) return null;
  const str = input.trim();
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/)|(?:\?|&)v=)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const regex of patterns) {
    const match = str.match(regex);
    if (match) return match[1];
  }
  return null;
}

/**
 * Format duration seconds into hh:mm:ss or mm:ss
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const sec = Math.floor(seconds);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remainingSecs = sec % 60;
  const padSec = remainingSecs < 10 ? '0' + remainingSecs : remainingSecs;
  if (hrs > 0) {
    const padMin = mins < 10 ? '0' + mins : mins;
    return `${hrs}:${padMin}:${padSec}`;
  }
  return `${mins}:${padSec}`;
}

/**
 * Sanitize filename for safe Content-Disposition headers
 */
function sanitizeFilename(filename, extension = '') {
  let clean = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (!clean) clean = 'youtube_download';
  if (extension && !clean.toLowerCase().endsWith('.' + extension.toLowerCase())) {
    clean += '.' + extension;
  }
  return clean;
}

/**
 * Fetch video info merging VISIONOS and ANDROID_VR to capture ALL formats
 */
async function fetchVideoInfo(videoId) {
  const cached = getCached(videoId);
  if (cached) return cached;

  const [visionClient, vrClient] = await Promise.all([
    getVisionClient(),
    getVrClient()
  ]);

  const [visionRes, vrRes] = await Promise.allSettled([
    visionClient.getBasicInfo(videoId),
    vrClient.getBasicInfo(videoId)
  ]);

  const basicInfoVision = visionRes.status === 'fulfilled' ? visionRes.value : null;
  const basicInfoVr = vrRes.status === 'fulfilled' ? vrRes.value : null;

  if (!basicInfoVision && !basicInfoVr) {
    const err = visionRes.reason || vrRes.reason || new Error('Video unavailable');
    throw err;
  }

  const primaryInfo = basicInfoVision || basicInfoVr;
  const b = primaryInfo.basic_info || {};
  const durationSec = b.duration || 0;

  // Merge formats from both clients to capture all qualities (8K, 4K, 1080p, 720p, Opus, AAC, 384k)
  const formatsMap = new Map();

  if (basicInfoVr) {
    const vrAll = [
      ...(basicInfoVr.streaming_data?.formats || []),
      ...(basicInfoVr.streaming_data?.adaptive_formats || [])
    ];
    for (const f of vrAll) {
      if (f.itag && !formatsMap.has(f.itag)) formatsMap.set(f.itag, f);
    }
  }

  if (basicInfoVision) {
    const visionAll = [
      ...(basicInfoVision.streaming_data?.formats || []),
      ...(basicInfoVision.streaming_data?.adaptive_formats || [])
    ];
    for (const f of visionAll) {
      if (f.itag) formatsMap.set(f.itag, f);
    }
  }

  const allMergedFormats = [...formatsMap.values()];

  // 1. Process Audio formats (provide all available bitrates and codecs)
  const rawAudio = allMergedFormats.filter(f => f.has_audio && !f.has_video);
  const audioFormats = rawAudio.map(f => {
    const isM4A = f.mime_type?.includes('mp4') || f.mime_type?.includes('m4a');
    const isOpus = f.mime_type?.includes('opus');
    const ext = isM4A ? 'm4a' : 'webm';
    const bitrateKbps = Math.round((f.bitrate || 0) / 1000);
    const sizeBytes = f.content_length ? parseInt(f.content_length, 10) : (f.bitrate && durationSec ? Math.round((f.bitrate * durationSec) / 8) : 0);
    const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;

    let qualityLabel = 'Standard Audio';
    if (bitrateKbps >= 300) qualityLabel = `Ultra High Fidelity (${bitrateKbps}k Studio)`;
    else if (bitrateKbps >= 180) qualityLabel = `Studio Master (${bitrateKbps}k)`;
    else if (bitrateKbps >= 120) qualityLabel = `High Fidelity (${bitrateKbps}k)`;
    else if (bitrateKbps >= 70) qualityLabel = `Standard Audio (${bitrateKbps}k)`;
    else qualityLabel = `Data Saver (${bitrateKbps}k)`;

    let codecName = isM4A ? 'AAC LC' : (isOpus ? 'Opus' : 'Audio');
    if (f.mime_type?.includes('mp4a.40.5')) codecName = 'AAC HE';
    if (f.mime_type?.includes('ac-3')) codecName = 'AC-3 Surround';
    if (f.mime_type?.includes('ec-3')) codecName = 'E-AC-3 Dolby';

    return {
      itag: f.itag,
      format: ext,
      mimeType: f.mime_type,
      codec: codecName,
      bitrate: bitrateKbps,
      sampleRate: f.audio_sample_rate || 44100,
      channels: f.audio_channels || 2,
      qualityLabel,
      sizeBytes,
      sizeFormatted: sizeMB ? `${sizeMB} MB` : 'Dynamic stream',
      hasAudio: true,
      hasVideo: false,
      isProgressive: false
    };
  }).sort((a, b) => b.bitrate - a.bitrate);

  // 2. Process Progressive video formats (video + audio combined natively)
  const combinedList = allMergedFormats.filter(f => f.has_video && f.has_audio).map(f => {
    const sizeBytes = f.content_length ? parseInt(f.content_length, 10) : (f.bitrate && durationSec ? Math.round((f.bitrate * durationSec) / 8) : 0);
    const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;
    const isMp4 = f.mime_type?.includes('mp4');

    return {
      itag: f.itag,
      format: isMp4 ? 'mp4' : 'webm',
      quality: f.quality_label || f.quality || '360p',
      fps: f.fps || 30,
      bitrate: Math.round((f.bitrate || 0) / 1000),
      mimeType: f.mime_type,
      sizeBytes,
      sizeFormatted: sizeMB ? `${sizeMB} MB` : 'Dynamic stream',
      hasAudio: true,
      hasVideo: true,
      isProgressive: true
    };
  });

  // 3. Process Adaptive video formats (8K, 4K, 2K, 1080p, 720p, etc.)
  const rawVideo = allMergedFormats.filter(f => f.has_video);
  const videoFormats = rawVideo.map(f => {
    const isMp4 = f.mime_type?.includes('mp4');
    const ext = isMp4 ? 'mp4' : 'webm';
    const sizeBytes = f.content_length ? parseInt(f.content_length, 10) : (f.bitrate && durationSec ? Math.round((f.bitrate * durationSec) / 8) : 0);
    const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;
    const height = f.height || 0;
    const rawLabel = f.quality_label || f.quality || `${height}p`;

    // Categorized label
    let resolutionTier = `${height || 720}p`;
    if (height >= 4300 || rawLabel.includes('4320')) resolutionTier = '8K Ultra HD';
    else if (height >= 2100 || rawLabel.includes('2160')) resolutionTier = '4K Ultra HD';
    else if (height >= 1400 || rawLabel.includes('1440')) resolutionTier = '2K Quad HD';
    else if (height >= 1000 || rawLabel.includes('1080')) resolutionTier = '1080p Full HD';
    else if (height >= 700 || rawLabel.includes('720')) resolutionTier = '720p HD';
    else if (height >= 450 || rawLabel.includes('480')) resolutionTier = '480p';
    else if (height >= 350 || rawLabel.includes('360')) resolutionTier = '360p';
    else if (height >= 230 || rawLabel.includes('240')) resolutionTier = '240p';
    else if (height > 0) resolutionTier = '144p';

    let codecName = 'H.264 / AVC';
    if (f.mime_type?.includes('av01')) codecName = 'AV1';
    else if (f.mime_type?.includes('vp9')) codecName = 'VP9';

    return {
      itag: f.itag,
      format: ext,
      quality: rawLabel,
      resolutionTier,
      codec: codecName,
      height,
      width: f.width || 0,
      fps: f.fps || 30,
      bitrate: Math.round((f.bitrate || 0) / 1000),
      mimeType: f.mime_type,
      sizeBytes,
      sizeFormatted: sizeMB ? `${sizeMB} MB` : 'Dynamic stream',
      hasAudio: !!f.has_audio,
      hasVideo: true,
      isProgressive: !!(f.has_video && f.has_audio)
    };
  }).sort((a, b) => (b.height || 0) - (a.height || 0) || (b.fps || 0) - (a.fps || 0) || b.bitrate - a.bitrate);

  // Highest quality thumbnail
  const thumbnails = b.thumbnail || [];
  const bestThumb = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const payload = {
    videoId,
    title: b.title || 'YouTube Video',
    author: b.author || 'Unknown Creator',
    channelUrl: b.channel_url || '',
    duration: formatDuration(durationSec),
    durationSeconds: durationSec,
    viewCount: b.view_count ? Number(b.view_count).toLocaleString() : 'N/A',
    thumbnail: bestThumb,
    description: b.short_description || '',
    audioFormats,
    progressiveFormats: combinedList,
    videoFormats,
    totalFormats: audioFormats.length + combinedList.length + videoFormats.length
  };

  setCache(videoId, payload);
  return payload;
}

// ---------------- API ROUTES ----------------

/**
 * API Root
 */
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'YouTube Video & Audio Downloader API is running',
    endpoints: ['/api/health', '/api/info', '/api/stream']
  });
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    inMemoryOnly: true,
    localFileSystemUsage: 'strictly_zero',
    cacheSize: cache.size
  });
});

/**
 * Video Information Endpoint
 */
app.get('/api/info', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'Please provide a YouTube URL or Video ID' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL or ID format. Please check the link.' });
    }

    const info = await fetchVideoInfo(videoId);
    res.json(info);
  } catch (err) {
    console.error('[API /api/info Error]:', err);
    const cleanMsg = err.info?.reason || err.message || 'Failed to fetch YouTube video details';
    res.status(500).json({
      error: cleanMsg,
      details: cleanMsg
    });
  }
});

/**
 * Direct In-Memory Media Streaming Endpoint
 * Pipes media chunks directly from YouTube CDN to client HTTP response stream.
 * ZERO local file system usage. ZERO local process execution.
 */
app.get('/api/stream', async (req, res) => {
  let isClosed = false;
  req.on('close', () => {
    isClosed = true;
  });

  try {
    const { videoId, itag, download, filename } = req.query;
    if (!videoId || !itag) {
      return res.status(400).send('Missing videoId or itag parameter');
    }

    const cleanVideoId = extractVideoId(videoId);
    if (!cleanVideoId) {
      return res.status(400).send('Invalid videoId');
    }

    const itagNum = parseInt(itag, 10);
    const [visionClient, vrClient] = await Promise.all([
      getVisionClient(),
      getVrClient()
    ]);

    let basicInfo;
    let clientToUse = visionClient;
    try {
      basicInfo = await visionClient.getBasicInfo(cleanVideoId);
      // Check if format is in vision client
      const hasItag = [...(basicInfo.streaming_data?.formats || []), ...(basicInfo.streaming_data?.adaptive_formats || [])].some(f => f.itag === itagNum);
      if (!hasItag) {
        clientToUse = vrClient;
        basicInfo = await vrClient.getBasicInfo(cleanVideoId);
      }
    } catch {
      clientToUse = vrClient;
      basicInfo = await vrClient.getBasicInfo(cleanVideoId);
    }

    const allFormats = [
      ...(basicInfo.streaming_data?.formats || []),
      ...(basicInfo.streaming_data?.adaptive_formats || [])
    ];
    const match = allFormats.find(f => f.itag === itagNum) || basicInfo.chooseFormat({ itag: itagNum });

    const contentType = match?.mime_type?.split(';')[0] || (match?.has_audio && !match?.has_video ? 'audio/mp4' : 'video/mp4');
    const totalSize = match?.content_length ? parseInt(match.content_length, 10) : 0;
    const streamUrl = match?.url;
    const userAgent = 'com.google.android.youtube/19.29.35 (Linux; U; Android 14) gzip';

    const downloadOpts = { itag: itagNum };
    const rangeHeader = req.headers.range;

    // Set download header if requested
    if (download === '1' || download === 'true') {
      const isAudio = match?.has_audio && !match?.has_video;
      const isMp4 = contentType.includes('mp4');
      const defaultExt = isAudio ? (isMp4 ? 'm4a' : 'webm') : (isMp4 ? 'mp4' : 'webm');
      const safeName = sanitizeFilename(filename || `video_${cleanVideoId}`, defaultExt);
      const encodedName = encodeURIComponent(safeName);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName.replace(/"/g, '')}"; filename*=UTF-8''${encodedName}`);
    }

    // 1. Range Request (for seekable player and download managers)
    if (rangeHeader && streamUrl) {
      const upstream = await fetch(streamUrl, {
        headers: {
          'Range': rangeHeader,
          'User-Agent': userAgent
        }
      });

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      const cr = upstream.headers.get('content-range');
      if (cr) res.setHeader('Content-Range', cr);
      const cl = upstream.headers.get('content-length');
      if (cl) res.setHeader('Content-Length', cl);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const nodeStream = Readable.fromWeb(upstream.body);
      nodeStream.pipe(res);
      return;
    }

    // 2. Full stream request (Trimmer in-memory buffer fetch / Browser Download)
    // Stream in sequential 1MB burst chunks to bypass YouTube playback throttling
    if (streamUrl && totalSize > 0) {
      res.status(200);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', totalSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const CHUNK_SIZE = 1024 * 1024; // 1MB burst chunks
      for (let offset = 0; offset < totalSize; offset += CHUNK_SIZE) {
        if (isClosed) break;
        const end = Math.min(offset + CHUNK_SIZE - 1, totalSize - 1);
        const chunkRes = await fetch(streamUrl, {
          headers: {
            'Range': `bytes=${offset}-${end}`,
            'User-Agent': userAgent
          }
        });

        if (!chunkRes.ok && chunkRes.status !== 206) {
          throw new Error(`Chunk download failed at offset ${offset}`);
        }

        const chunkBuf = await chunkRes.arrayBuffer();
        if (isClosed) break;
        res.write(Buffer.from(chunkBuf));
      }

      if (!isClosed) res.end();
      return;
    }

    // 3. Fallback to Innertube download
    res.status(200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    let webStream;
    try {
      webStream = await basicInfo.download(downloadOpts);
    } catch {
      const altClient = clientToUse === visionClient ? vrClient : visionClient;
      const altInfo = await altClient.getBasicInfo(cleanVideoId);
      webStream = await altInfo.download(downloadOpts);
    }

    const nodeStream = Readable.fromWeb(webStream);
    nodeStream.on('error', (err) => {
      if (err.name !== 'AbortError' && !isClosed) {
        console.warn('[Stream Error]:', err.message);
      }
    });

    nodeStream.pipe(res);
  } catch (err) {
    if (!isClosed) {
      console.error('[API /api/stream Error]:', err.message);
      if (!res.headersSent) {
        res.status(500).send(`Streaming failed: ${err.message}`);
      }
    }
  }
});

// Start Express Server (only when run directly in standalone mode, not on Vercel serverless)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 YouTube In-Memory Video & Audio Downloader Running`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🛡️ Architecture: 100% In-Memory Streaming (Zero Disk Files)`);
    console.log(`======================================================\n`);
  });
}

export default app;
