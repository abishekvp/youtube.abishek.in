import { formatDuration } from './youtube.js';

const DIRECT_VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.ts'];
const DIRECT_AUDIO_EXTS = ['.mp3', '.m4a', '.wav', '.ogg', '.opus', '.aac', '.flac'];

export function isDirectMediaUrl(input) {
  if (!input) return false;
  try {
    const parsed = new URL(input);
    const pathname = parsed.pathname.toLowerCase();
    return (
      DIRECT_VIDEO_EXTS.some(ext => pathname.endsWith(ext)) ||
      DIRECT_AUDIO_EXTS.some(ext => pathname.endsWith(ext))
    );
  } catch {
    return false;
  }
}

/**
 * Extract filename from URL or Content-Disposition
 */
function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    const last = parts[parts.length - 1];
    if (last && last.includes('.')) {
      return decodeURIComponent(last.split('.')[0]).replace(/[-_]/g, ' ');
    }
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'Media File';
  }
}

/**
 * Handle direct media link or generic web page with HTML5/OpenGraph video
 */
export async function fetchDirectMediaInfo(url) {
  const cleanUrl = url.trim();

  // 1. Try HEAD request first
  let headRes;
  try {
    headRes = await fetch(cleanUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
  } catch {
    // Some servers reject HEAD, fallback to GET with Range 0-0
    headRes = await fetch(cleanUrl, {
      headers: {
        'Range': 'bytes=0-0',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
  }

  const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
  const contentLength = parseInt(headRes.headers.get('content-length') || '0', 10);
  const sizeMB = contentLength > 0 ? (contentLength / (1024 * 1024)).toFixed(1) : null;

  // Case A: Direct Video / Audio response
  if (contentType.startsWith('video/') || contentType.startsWith('audio/') || isDirectMediaUrl(cleanUrl)) {
    const isAudio = contentType.startsWith('audio/') || DIRECT_AUDIO_EXTS.some(ext => cleanUrl.toLowerCase().includes(ext));
    const title = filenameFromUrl(cleanUrl);
    const ext = isAudio ? 'mp3' : 'mp4';

    const audioFormats = [];
    const progressiveFormats = [];
    const videoFormats = [];

    const streamUrl = `/api/stream?platform=direct&url=${encodeURIComponent(cleanUrl)}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title)}`;

    if (isAudio) {
      audioFormats.push({
        itag: 'direct_audio',
        format: ext,
        mimeType: contentType || 'audio/mpeg',
        codec: ext.toUpperCase(),
        bitrate: 320,
        sampleRate: 44100,
        channels: 2,
        qualityLabel: `Direct Audio Stream (${sizeMB ? sizeMB + ' MB' : 'Full File'})`,
        sizeBytes: contentLength,
        sizeFormatted: sizeMB ? `${sizeMB} MB` : 'Dynamic stream',
        streamUrl,
        downloadUrl,
        hasAudio: true,
        hasVideo: false,
        isProgressive: false
      });
    } else {
      const vidObj = {
        itag: 'direct_video',
        format: ext,
        quality: 'Original Video Stream',
        resolutionTier: 'HD Source',
        fps: 30,
        bitrate: 2500,
        codec: 'H.264 / AVC',
        mimeType: contentType || 'video/mp4',
        sizeBytes: contentLength,
        sizeFormatted: sizeMB ? `${sizeMB} MB` : 'Direct Stream',
        streamUrl,
        downloadUrl,
        hasAudio: true,
        hasVideo: true,
        isProgressive: true
      };

      progressiveFormats.push(vidObj);
      videoFormats.push(vidObj);

      // Also expose as audio source for browser trimming
      audioFormats.push({
        itag: 'direct_audio_from_vid',
        format: 'm4a',
        mimeType: 'audio/mp4',
        codec: 'Audio Track',
        bitrate: 192,
        sampleRate: 44100,
        channels: 2,
        qualityLabel: 'Extract Audio Track',
        sizeBytes: 0,
        sizeFormatted: 'Audio Stream',
        streamUrl,
        downloadUrl: `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' (Audio)')}`,
        hasAudio: true,
        hasVideo: false,
        isProgressive: false
      });
    }

    return {
      platform: 'direct',
      platformName: isAudio ? 'Direct Audio Stream' : 'Direct Video Stream',
      platformBadgeColor: '#10b981',
      videoId: 'direct_' + Math.abs(cleanUrl.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
      title,
      author: new URL(cleanUrl).hostname,
      channelUrl: cleanUrl,
      duration: 'Direct Stream',
      durationSeconds: 60,
      viewCount: 'Direct Link',
      thumbnail: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%2310b981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>',
      description: cleanUrl,
      audioFormats,
      progressiveFormats,
      videoFormats,
      totalFormats: audioFormats.length + progressiveFormats.length + videoFormats.length
    };
  }

  // Case B: HTML Webpage with OpenGraph or HTML5 Video
  if (contentType.includes('text/html')) {
    const pageRes = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const html = await pageRes.text();

    // Check OpenGraph video or twitter player
    const ogVideoMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)["']\s+content=["']([^"']+)["']/i) ||
                        html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)["']/i);

    const videoSrcMatch = html.match(/<video[^>]*src=["']([^"']+)["']/i) ||
                          html.match(/<source[^>]*src=["']([^"']+)["'][^>]*type=["']video\/mp4["']/i);

    const foundMediaUrl = ogVideoMatch ? ogVideoMatch[1] : (videoSrcMatch ? videoSrcMatch[1] : null);

    if (foundMediaUrl) {
      // Resolve relative URL if needed
      const absoluteMediaUrl = new URL(foundMediaUrl, cleanUrl).href;

      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      const title = (ogTitleMatch ? ogTitleMatch[1] : (titleMatch ? titleMatch[1] : filenameFromUrl(cleanUrl))).trim();

      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      const thumbnail = ogImageMatch ? new URL(ogImageMatch[1], cleanUrl).href : '';

      const streamUrl = `/api/stream?platform=direct&url=${encodeURIComponent(absoluteMediaUrl)}`;
      const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title)}`;

      const vidObj = {
        itag: 'web_video_1',
        format: 'mp4',
        quality: 'Embedded Web Video',
        resolutionTier: 'HD Web',
        fps: 30,
        bitrate: 2000,
        codec: 'H.264 / MP4',
        mimeType: 'video/mp4',
        sizeBytes: 0,
        sizeFormatted: 'Web Stream',
        streamUrl,
        downloadUrl,
        hasAudio: true,
        hasVideo: true,
        isProgressive: true
      };

      const audioObj = {
        itag: 'web_audio_1',
        format: 'm4a',
        mimeType: 'audio/mp4',
        codec: 'AAC Audio',
        bitrate: 160,
        sampleRate: 44100,
        channels: 2,
        qualityLabel: 'Web Audio Track',
        sizeBytes: 0,
        sizeFormatted: 'Audio Stream',
        streamUrl,
        downloadUrl: `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' (Audio)')}`,
        hasAudio: true,
        hasVideo: false,
        isProgressive: false
      };

      return {
        platform: 'generic',
        platformName: 'Web Video',
        platformBadgeColor: '#6366f1',
        videoId: 'web_' + Math.abs(cleanUrl.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)),
        title,
        author: new URL(cleanUrl).hostname,
        channelUrl: cleanUrl,
        duration: 'Online Media',
        durationSeconds: 60,
        viewCount: 'Web Embed',
        thumbnail,
        description: `Extracted from ${cleanUrl}`,
        audioFormats: [audioObj],
        progressiveFormats: [vidObj],
        videoFormats: [vidObj],
        totalFormats: 2
      };
    }
  }

  throw new Error('No playable video or audio stream found at this link.');
}
