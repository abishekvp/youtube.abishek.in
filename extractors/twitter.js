import { formatDuration } from './youtube.js';

export function isTwitterUrl(input) {
  if (!input) return false;
  return /(?:twitter\.com|x\.com)\/.*(?:status|statuses)\/(\d+)/i.test(input) || /^(\d{15,22})$/.test(input.trim());
}

export function extractTweetId(input) {
  if (!input) return null;
  const match = input.match(/(?:twitter\.com|x\.com)\/.*(?:status|statuses)\/(\d+)/i);
  if (match) return match[1];
  if (/^\d{15,22}$/.test(input.trim())) return input.trim();
  return null;
}

/**
 * Fetch Twitter / X video metadata via FxTwitter API
 */
export async function fetchTwitterInfo(url) {
  const tweetId = extractTweetId(url);
  if (!tweetId) {
    throw new Error('Invalid Twitter / X post link or Tweet ID.');
  }

  const res = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`Twitter / X service responded with status ${res.status}`);
  }

  const json = await res.json();
  if (json.code !== 200 || !json.tweet) {
    throw new Error(json.message || 'Tweet not found or does not contain public media.');
  }

  const t = json.tweet;
  const videos = t.media?.videos || [];

  if (videos.length === 0) {
    throw new Error('This Tweet does not contain any video or audio stream.');
  }

  const primaryVideo = videos[0];
  const durationSec = primaryVideo.duration || 0;
  const rawTitle = t.text ? t.text.split('\n')[0].slice(0, 90) : `X Video by ${t.author?.name || 'User'}`;
  const title = rawTitle.trim() || 'Twitter Video';
  const authorName = t.author?.name ? `${t.author.name} (@${t.author.screen_name})` : `@${t.author?.screen_name || 'X User'}`;
  const bestThumb = primaryVideo.thumbnail_url || t.author?.avatar_url || '';

  const audioFormats = [];
  const progressiveFormats = [];
  const videoFormats = [];

  // Extract MP4 variants
  const variants = (primaryVideo.variants || primaryVideo.formats || []).filter(v => {
    const isMp4 = v.content_type === 'video/mp4' || v.container === 'mp4' || v.url?.includes('.mp4');
    return isMp4 && v.url;
  });

  // Sort by bitrate descending
  variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  variants.forEach((v, idx) => {
    const bitrateKbps = Math.round((v.bitrate || 0) / 1000);
    const sizeBytes = bitrateKbps && durationSec ? Math.round((bitrateKbps * 1000 * durationSec) / 8) : 0;
    const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;

    let qualityLabel = 'Standard Quality';
    let resolutionTier = 'HD Video';

    // Infer resolution from dimensions or URL or bitrate
    const urlStr = v.url || '';
    if (urlStr.includes('1280x720') || bitrateKbps >= 1800) {
      qualityLabel = '720p HD';
      resolutionTier = '720p HD';
    } else if (urlStr.includes('1920x1080') || bitrateKbps >= 3000) {
      qualityLabel = '1080p Full HD';
      resolutionTier = '1080p Full HD';
    } else if (urlStr.includes('640x360') || bitrateKbps >= 700) {
      qualityLabel = '360p SD';
      resolutionTier = '360p';
    } else if (urlStr.includes('480x270') || bitrateKbps < 700) {
      qualityLabel = '270p Mobile';
      resolutionTier = '270p';
    }

    const itag = `tw_${idx + 1}`;
    const streamUrl = `/api/stream?platform=twitter&url=${encodeURIComponent(v.url)}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ` [${qualityLabel}]`)}`;

    const formatObj = {
      itag,
      format: 'mp4',
      quality: qualityLabel,
      resolutionTier,
      fps: 30,
      bitrate: bitrateKbps,
      codec: 'H.264 / AVC',
      mimeType: 'video/mp4',
      sizeBytes,
      sizeFormatted: sizeMB ? `${sizeMB} MB` : 'Dynamic stream',
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: true,
      isProgressive: true
    };

    progressiveFormats.push(formatObj);
    videoFormats.push(formatObj);
  });

  // Also expose best video stream as Audio source for browser audio trimming / listening
  if (variants.length > 0) {
    const bestStream = variants[0].url;
    const streamUrl = `/api/stream?platform=twitter&url=${encodeURIComponent(bestStream)}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' (Audio Track)')}`;

    audioFormats.push({
      itag: 'tw_audio_1',
      format: 'm4a',
      mimeType: 'audio/mp4',
      codec: 'AAC Audio',
      bitrate: 128,
      sampleRate: 44100,
      channels: 2,
      qualityLabel: 'Original Audio Stream (AAC)',
      sizeBytes: 0,
      sizeFormatted: 'Audio Stream',
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: false,
      isProgressive: false
    });
  }

  return {
    platform: 'twitter',
    platformName: 'Twitter / X',
    platformBadgeColor: '#1da1f2',
    videoId: tweetId,
    title,
    author: authorName,
    channelUrl: t.author?.screen_name ? `https://x.com/${t.author.screen_name}` : '',
    duration: formatDuration(durationSec),
    durationSeconds: durationSec,
    viewCount: t.views ? Number(t.views).toLocaleString() : (t.likes ? `${Number(t.likes).toLocaleString()} likes` : 'N/A'),
    thumbnail: bestThumb,
    description: t.text || '',
    audioFormats,
    progressiveFormats,
    videoFormats,
    totalFormats: audioFormats.length + progressiveFormats.length + videoFormats.length
  };
}
