import { Innertube, ClientType } from 'youtubei.js';

// In-memory multi-client instances
let ytVision = null;
let ytVr = null;

export async function getVisionClient() {
  if (!ytVision) {
    ytVision = await Innertube.create({ client_type: ClientType.VISIONOS });
  }
  return ytVision;
}

export async function getVrClient() {
  if (!ytVr) {
    ytVr = await Innertube.create({ client_type: ClientType.ANDROID_VR });
  }
  return ytVr;
}

/**
 * Extract YouTube 11-char Video ID from any URL format
 */
export function extractYoutubeId(input) {
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
export function formatDuration(seconds) {
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
 * Fetch YouTube video info merging VISIONOS and ANDROID_VR to capture ALL formats
 */
export async function fetchYoutubeInfo(videoId) {
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
    const err = visionRes.reason || vrRes.reason || new Error('YouTube video unavailable');
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

  // 1. Process Audio formats
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

    const streamUrl = `/api/stream?platform=youtube&videoId=${videoId}&itag=${f.itag}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(b.title || 'audio')}`;

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
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: false,
      isProgressive: false
    };
  }).sort((a, b) => b.bitrate - a.bitrate);

  // 2. Process Progressive video formats
  const combinedList = allMergedFormats.filter(f => f.has_video && f.has_audio).map(f => {
    const sizeBytes = f.content_length ? parseInt(f.content_length, 10) : (f.bitrate && durationSec ? Math.round((f.bitrate * durationSec) / 8) : 0);
    const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;
    const isMp4 = f.mime_type?.includes('mp4');

    const streamUrl = `/api/stream?platform=youtube&videoId=${videoId}&itag=${f.itag}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(b.title || 'video')}`;

    return {
      itag: f.itag,
      format: isMp4 ? 'mp4' : 'webm',
      quality: f.quality_label || f.quality || '360p',
      fps: f.fps || 30,
      bitrate: Math.round((f.bitrate || 0) / 1000),
      mimeType: f.mime_type,
      sizeBytes,
      sizeFormatted: sizeMB ? `${sizeMB} MB` : 'Dynamic stream',
      streamUrl,
      downloadUrl,
      hasAudio: true,
      hasVideo: true,
      isProgressive: true
    };
  });

  // 3. Process Adaptive video formats
  const rawVideo = allMergedFormats.filter(f => f.has_video);
  const videoFormats = rawVideo.map(f => {
    const isMp4 = f.mime_type?.includes('mp4');
    const ext = isMp4 ? 'mp4' : 'webm';
    const sizeBytes = f.content_length ? parseInt(f.content_length, 10) : (f.bitrate && durationSec ? Math.round((f.bitrate * durationSec) / 8) : 0);
    const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;
    const height = f.height || 0;
    const rawLabel = f.quality_label || f.quality || `${height}p`;

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

    const streamUrl = `/api/stream?platform=youtube&videoId=${videoId}&itag=${f.itag}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(b.title || 'video')}`;

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
      streamUrl,
      downloadUrl,
      hasAudio: !!f.has_audio,
      hasVideo: true,
      isProgressive: !!(f.has_video && f.has_audio)
    };
  }).sort((a, b) => (b.height || 0) - (a.height || 0) || (b.fps || 0) - (a.fps || 0) || b.bitrate - a.bitrate);

  // Highest quality thumbnail
  const thumbnails = b.thumbnail || [];
  const bestThumb = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return {
    platform: 'youtube',
    platformName: 'YouTube',
    platformBadgeColor: '#ff0033',
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
}
