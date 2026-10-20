import { formatDuration } from './youtube.js';

export function isTikTokUrl(input) {
  if (!input) return false;
  return /tiktok\.com/i.test(input);
}

/**
 * Fetch TikTok Video & Audio metadata via TikWM
 */
export async function fetchTikTokInfo(url) {
  const cleanUrl = url.trim();

  const res = await fetch('https://www.tikwm.com/api/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    body: new URLSearchParams({
      url: cleanUrl,
      hd: '1'
    })
  });

  if (!res.ok) {
    throw new Error(`TikTok service responded with status ${res.status}`);
  }

  const json = await res.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || 'Unable to extract TikTok video. Please verify the URL.');
  }

  const d = json.data;
  const durationSec = d.duration || 0;
  const title = d.title || 'TikTok Video';
  const authorName = d.author?.nickname || d.author?.unique_id || 'TikTok Creator';
  const videoId = d.id || 'tiktok_' + Date.now();

  const audioFormats = [];
  const progressiveFormats = [];
  const videoFormats = [];

  // Audio track (Original Sound)
  if (d.music || d.music_info?.play) {
    const musicUrl = d.music || d.music_info?.play;
    const streamUrl = `/api/stream?platform=tiktok&url=${encodeURIComponent(musicUrl)}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' (Audio)')}`;

    audioFormats.push({
      itag: 'tt_audio_1',
      format: 'mp3',
      mimeType: 'audio/mpeg',
      codec: 'MP3',
      bitrate: 192,
      sampleRate: 44100,
      channels: 2,
      qualityLabel: 'Original Audio Track (192k)',
      sizeBytes: 0,
      sizeFormatted: 'Audio Stream',
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: false,
      isProgressive: false
    });
  }

  // HD Video without Watermark
  if (d.hdplay) {
    const streamUrl = `/api/stream?platform=tiktok&url=${encodeURIComponent(d.hdplay)}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' [HD No Watermark]')}`;

    progressiveFormats.push({
      itag: 'tt_hd',
      format: 'mp4',
      quality: '1080p HD (No Watermark)',
      fps: 30,
      bitrate: 2500,
      mimeType: 'video/mp4',
      sizeBytes: d.hd_size || 0,
      sizeFormatted: d.hd_size ? `${(d.hd_size / (1024 * 1024)).toFixed(1)} MB` : 'HD Stream',
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: true,
      isProgressive: true
    });

    videoFormats.push({
      itag: 'tt_hd',
      format: 'mp4',
      quality: '1080p HD (No Watermark)',
      resolutionTier: '1080p Full HD',
      codec: 'H.264 / MP4',
      height: 1080,
      width: 1920,
      fps: 30,
      bitrate: 2500,
      mimeType: 'video/mp4',
      sizeBytes: d.hd_size || 0,
      sizeFormatted: d.hd_size ? `${(d.hd_size / (1024 * 1024)).toFixed(1)} MB` : 'HD Stream',
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: true,
      isProgressive: true
    });
  }

  // Standard Video without Watermark
  if (d.play) {
    const streamUrl = `/api/stream?platform=tiktok&url=${encodeURIComponent(d.play)}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' [No Watermark]')}`;

    progressiveFormats.push({
      itag: 'tt_sd',
      format: 'mp4',
      quality: '720p (No Watermark)',
      fps: 30,
      bitrate: 1500,
      mimeType: 'video/mp4',
      sizeBytes: d.size || 0,
      sizeFormatted: d.size ? `${(d.size / (1024 * 1024)).toFixed(1)} MB` : 'Standard Stream',
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: true,
      isProgressive: true
    });

    videoFormats.push({
      itag: 'tt_sd',
      format: 'mp4',
      quality: '720p (No Watermark)',
      resolutionTier: '720p HD',
      codec: 'H.264 / MP4',
      height: 720,
      width: 1280,
      fps: 30,
      bitrate: 1500,
      mimeType: 'video/mp4',
      sizeBytes: d.size || 0,
      sizeFormatted: d.size ? `${(d.size / (1024 * 1024)).toFixed(1)} MB` : 'Standard Stream',
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: true,
      isProgressive: true
    });
  }

  // Watermarked fallback if needed
  if (d.wmplay && progressiveFormats.length === 0) {
    const streamUrl = `/api/stream?platform=tiktok&url=${encodeURIComponent(d.wmplay)}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' [Watermark]')}`;

    progressiveFormats.push({
      itag: 'tt_wm',
      format: 'mp4',
      quality: 'Original Video',
      fps: 30,
      bitrate: 1200,
      mimeType: 'video/mp4',
      sizeBytes: d.wm_size || 0,
      sizeFormatted: d.wm_size ? `${(d.wm_size / (1024 * 1024)).toFixed(1)} MB` : 'Standard Stream',
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: true,
      isProgressive: true
    });
  }

  return {
    platform: 'tiktok',
    platformName: 'TikTok',
    platformBadgeColor: '#fe2c55',
    videoId,
    title,
    author: `@${authorName}`,
    channelUrl: d.author?.unique_id ? `https://www.tiktok.com/@${d.author.unique_id}` : '',
    duration: formatDuration(durationSec),
    durationSeconds: durationSec,
    viewCount: d.play_count ? Number(d.play_count).toLocaleString() : 'N/A',
    thumbnail: d.cover || d.origin_cover || '',
    description: d.title || '',
    audioFormats,
    progressiveFormats,
    videoFormats,
    totalFormats: audioFormats.length + progressiveFormats.length + videoFormats.length
  };
}
