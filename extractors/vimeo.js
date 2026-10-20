import { formatDuration } from './youtube.js';

export function isVimeoUrl(input) {
  if (!input) return false;
  return /vimeo\.com/i.test(input);
}

export function extractVimeoId(input) {
  if (!input) return null;
  const match = input.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+)/i);
  if (match) return match[1];
  return null;
}

/**
 * Fetch Vimeo video metadata
 */
export async function fetchVimeoInfo(url) {
  const vimeoId = extractVimeoId(url);
  if (!vimeoId) {
    throw new Error('Invalid Vimeo link. Please provide a valid Vimeo URL.');
  }

  // 1. Fetch player config (contains progressive MP4 streams)
  const configRes = await fetch(`https://player.vimeo.com/video/${vimeoId}/config`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!configRes.ok) {
    throw new Error(`Vimeo returned status ${configRes.status}. Video may be private or deleted.`);
  }

  const config = await configRes.json();
  const v = config.video || {};
  const durationSec = v.duration || 0;
  const title = v.title || 'Vimeo Video';
  const authorName = v.owner?.name || 'Vimeo Creator';
  const authorUrl = v.owner?.url || '';
  const bestThumb = v.thumbs?.['1280'] || v.thumbs?.['960'] || v.thumbs?.['640'] || v.thumbs?.base || '';

  const audioFormats = [];
  const progressiveFormats = [];
  const videoFormats = [];

  const progFiles = config.request?.files?.progressive || [];

  if (progFiles.length > 0) {
    progFiles.sort((a, b) => (b.height || 0) - (a.height || 0) || (b.bitrate || 0) - (a.bitrate || 0));

    progFiles.forEach((f, idx) => {
      const height = f.height || 720;
      const rawLabel = f.quality || `${height}p`;
      const bitrateKbps = Math.round((f.bitrate || 0) / 1000);
      const sizeBytes = bitrateKbps && durationSec ? Math.round((bitrateKbps * 1000 * durationSec) / 8) : 0;
      const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;

      let resolutionTier = `${height}p`;
      if (height >= 1000) resolutionTier = '1080p Full HD';
      else if (height >= 700) resolutionTier = '720p HD';
      else if (height >= 500) resolutionTier = '540p';
      else if (height >= 350) resolutionTier = '360p';

      const itag = `vimeo_${idx + 1}`;
      const streamUrl = `/api/stream?platform=vimeo&url=${encodeURIComponent(f.url)}`;
      const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ` [${rawLabel}]`)}`;

      const formatObj = {
        itag,
        format: 'mp4',
        quality: rawLabel,
        resolutionTier,
        fps: f.fps || 30,
        bitrate: bitrateKbps,
        codec: 'H.264 / MP4',
        mimeType: f.mime || 'video/mp4',
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

    // Provide best stream as audio track
    const bestStream = progFiles[0].url;
    const streamUrl = `/api/stream?platform=vimeo&url=${encodeURIComponent(bestStream)}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' (Audio Track)')}`;

    audioFormats.push({
      itag: 'vimeo_audio_1',
      format: 'm4a',
      mimeType: 'audio/mp4',
      codec: 'AAC Audio',
      bitrate: 192,
      sampleRate: 48000,
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
  } else {
    // If progressive files are disabled on Vimeo, check HLS
    const hlsUrl = config.request?.files?.hls?.cdns?.akfire_interconnect_quic?.url ||
                   config.request?.files?.hls?.cdns?.fastly_skyfire?.url ||
                   config.request?.files?.hls?.default_cdn;

    if (hlsUrl) {
      const streamUrl = `/api/stream?platform=vimeo&url=${encodeURIComponent(hlsUrl)}`;
      const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' [HLS Stream]')}`;

      const hlsFormat = {
        itag: 'vimeo_hls',
        format: 'm3u8',
        quality: 'Adaptive HLS Stream',
        resolutionTier: 'HD Adaptive',
        fps: 30,
        bitrate: 2000,
        mimeType: 'application/x-mpegURL',
        sizeBytes: 0,
        sizeFormatted: 'Adaptive Stream',
        streamUrl,
        downloadUrl,
        hasAudio: true,
        hasVideo: true,
        isProgressive: true
      };

      progressiveFormats.push(hlsFormat);
      videoFormats.push(hlsFormat);
    }
  }

  return {
    platform: 'vimeo',
    platformName: 'Vimeo',
    platformBadgeColor: '#1ab7ea',
    videoId: vimeoId,
    title,
    author: authorName,
    channelUrl: authorUrl,
    duration: formatDuration(durationSec),
    durationSeconds: durationSec,
    viewCount: 'Vimeo Video',
    thumbnail: bestThumb,
    description: '',
    audioFormats,
    progressiveFormats,
    videoFormats,
    totalFormats: audioFormats.length + progressiveFormats.length + videoFormats.length
  };
}
