import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import {
  resolveMediaInfo,
  extractYoutubeId,
  getVisionClient,
  getVrClient,
  checkYtDlpAvailable
} from './extractors/index.js';

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
  if (!key) return null;
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  if (!key) return;
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

/**
 * Sanitize filename for safe Content-Disposition headers
 */
export function sanitizeFilename(filename, extension = '') {
  let clean = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (!clean) clean = 'streamflow_download';
  if (extension && !clean.toLowerCase().endsWith('.' + extension.toLowerCase())) {
    clean += '.' + extension;
  }
  return clean;
}

// ---------------- API ROUTES ----------------

/**
 * API Root
 */
app.get('/api', async (req, res) => {
  const ytdlp = await checkYtDlpAvailable();
  res.json({
    status: 'ok',
    message: 'StreamFlow Multi-Resource Video & Audio Downloader API is running',
    supportedPlatforms: [
      'YouTube (8K, 4K, 1080p, Audio up to 384k)',
      'TikTok (Watermark-Free HD MP4, MP3 Audio)',
      'Twitter / X (1080p, 720p, 480p MP4)',
      'Vimeo (Full HD Progressive Streams)',
      'Direct Media Links (.mp4, .webm, .mkv, .mov, .mp3, .m4a)',
      'HTML5 Web Video & OpenGraph Scraper',
      ytdlp ? 'Universal yt-dlp Extractor Active' : 'Native High-Speed Extractor Active'
    ],
    endpoints: ['/api/health', '/api/info', '/api/stream']
  });
});

/**
 * Health check
 */
app.get('/api/health', async (req, res) => {
  const ytdlp = await checkYtDlpAvailable();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    inMemoryOnly: true,
    localFileSystemUsage: 'strictly_zero',
    cacheSize: cache.size,
    ytDlpAvailable: ytdlp
  });
});

/**
 * Universal Media Information Endpoint
 * Supports YouTube, TikTok, Twitter/X, Vimeo, Direct Media, and Web Video
 */
app.get('/api/info', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'Please provide a video URL or ID' });
    }

    const cleanUrl = url.trim();
    const cached = getCached(cleanUrl);
    if (cached) return res.json(cached);

    const info = await resolveMediaInfo(cleanUrl);

    setCache(cleanUrl, info);
    if (info.videoId) setCache(info.videoId, info);

    res.json(info);
  } catch (err) {
    console.error('[API /api/info Error]:', err.message);
    const cleanMsg = err.message || 'Failed to fetch video details';
    res.status(500).json({
      error: cleanMsg,
      details: cleanMsg
    });
  }
});

/**
 * Direct In-Memory Media Streaming & Proxy Endpoint
 * Pipes media chunks directly from upstream CDN to client HTTP response stream.
 * ZERO local file system usage. ZERO local process execution.
 */
app.get('/api/stream', async (req, res) => {
  let isClosed = false;
  req.on('close', () => {
    isClosed = true;
  });

  try {
    const { videoId, itag, url, platform, download, filename } = req.query;

    // PATH A: External Platform Stream (TikTok, Twitter, Vimeo, Direct, etc.)
    if (url) {
      const targetUrl = decodeURIComponent(url);
      const upstreamHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      };

      if (platform === 'tiktok') {
        upstreamHeaders['Referer'] = 'https://www.tiktok.com/';
      } else if (platform === 'twitter') {
        upstreamHeaders['Referer'] = 'https://x.com/';
      } else if (platform === 'vimeo') {
        upstreamHeaders['Referer'] = 'https://vimeo.com/';
      }

      if (req.headers.range) {
        upstreamHeaders['Range'] = req.headers.range;
      }

      const upstream = await fetch(targetUrl, {
        headers: upstreamHeaders
      });

      if (!upstream.ok && upstream.status !== 206) {
        throw new Error(`Upstream media source returned status ${upstream.status}`);
      }

      const contentType = upstream.headers.get('content-type') ||
        (targetUrl.includes('.mp3') ? 'audio/mpeg' : (targetUrl.includes('.m4a') ? 'audio/mp4' : 'video/mp4'));
      const contentLength = upstream.headers.get('content-length');
      const contentRange = upstream.headers.get('content-range');

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) res.setHeader('Content-Range', contentRange);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      if (download === '1' || download === 'true') {
        const isAudio = contentType.includes('audio') || targetUrl.includes('.mp3') || targetUrl.includes('.m4a');
        const defaultExt = isAudio ? 'mp3' : 'mp4';
        const safeName = sanitizeFilename(filename || `media_${Date.now()}`, defaultExt);
        const encodedName = encodeURIComponent(safeName);
        res.setHeader('Content-Disposition', `attachment; filename="${safeName.replace(/"/g, '')}"; filename*=UTF-8''${encodedName}`);
      }

      const nodeStream = Readable.fromWeb(upstream.body);
      nodeStream.on('error', (err) => {
        if (err.name !== 'AbortError' && !isClosed) {
          console.warn('[External Stream Error]:', err.message);
        }
      });

      nodeStream.pipe(res);
      return;
    }

    // PATH B: YouTube Innertube In-Memory Stream
    if (!videoId || !itag) {
      return res.status(400).send('Missing videoId/itag or url parameter');
    }

    const cleanVideoId = extractYoutubeId(videoId);
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

    // 2. Full stream request
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
    console.log(`🚀 StreamFlow Multi-Resource Video & Audio Downloader Running`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🛡️ Architecture: 100% In-Memory Streaming (Zero Disk Files)`);
    console.log(`📺 Supported: YouTube, TikTok, Twitter/X, Vimeo, Direct Media & More`);
    console.log(`======================================================\n`);
  });
}

export default app;
