import { spawn } from 'node:child_process';
import { formatDuration } from './youtube.js';

let isYtDlpAvailable = null;

export async function checkYtDlpAvailable() {
  if (isYtDlpAvailable !== null) return isYtDlpAvailable;
  return new Promise(resolve => {
    try {
      const proc = spawn('python', ['-m', 'yt_dlp', '--version']);
      proc.on('close', code => {
        isYtDlpAvailable = code === 0;
        resolve(isYtDlpAvailable);
      });
      proc.on('error', () => {
        isYtDlpAvailable = false;
        resolve(false);
      });
    } catch {
      isYtDlpAvailable = false;
      resolve(false);
    }
  });
}

/**
 * Extract formats using yt-dlp JSON dump
 */
export async function fetchWithYtDlp(url) {
  const available = await checkYtDlpAvailable();
  if (!available) {
    throw new Error('yt-dlp is not available in this runtime environment.');
  }

  return new Promise((resolve, reject) => {
    const proc = spawn('python', [
      '-m', 'yt_dlp',
      '--dump-single-json',
      '--no-warnings',
      '--no-check-certificates',
      '--no-playlist',
      url
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => { stdout += chunk; });
    proc.stderr.on('data', chunk => { stderr += chunk; });

    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(stderr.split('\n')[0] || `yt-dlp extraction failed with code ${code}`));
      }

      try {
        const d = JSON.parse(stdout);
        const durationSec = Math.round(d.duration || 0);
        const title = d.title || 'Video Stream';
        const author = d.uploader || d.channel || d.creator || 'Media Creator';
        const thumbnail = d.thumbnail || '';
        const extractor = (d.extractor || 'media').toLowerCase();

        const audioFormats = [];
        const progressiveFormats = [];
        const videoFormats = [];

        const allFormats = (d.formats || []).filter(f => f.url);

        // Filter progressive formats (audio + video combined)
        const prog = allFormats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none');
        // Filter video-only
        const vidOnly = allFormats.filter(f => f.vcodec !== 'none' && f.acodec === 'none');
        // Filter audio-only
        const audOnly = allFormats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');

        // Map audio formats
        audOnly.forEach((f, idx) => {
          const bitrateKbps = Math.round((f.tbr || f.abr || 128));
          const sizeBytes = f.filesize || (bitrateKbps && durationSec ? Math.round((bitrateKbps * 1000 * durationSec) / 8) : 0);
          const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;
          const ext = f.ext || 'm4a';

          const streamUrl = `/api/stream?platform=${extractor}&url=${encodeURIComponent(f.url)}`;
          const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' (Audio)')}`;

          audioFormats.push({
            itag: `ytdlp_a_${idx}`,
            format: ext,
            mimeType: ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
            codec: f.acodec || 'Audio',
            bitrate: bitrateKbps,
            sampleRate: f.asr || 44100,
            channels: f.audio_channels || 2,
            qualityLabel: `Audio Stream (${bitrateKbps}k)`,
            sizeBytes,
            sizeFormatted: sizeMB ? `${sizeMB} MB` : 'Dynamic stream',
            streamUrl,
            downloadUrl,
            hasAudio: true,
            hasVideo: false,
            isProgressive: false
          });
        });

        // Map progressive formats
        prog.forEach((f, idx) => {
          const height = f.height || 720;
          const quality = f.format_note || `${height}p`;
          const bitrateKbps = Math.round(f.tbr || f.vbr || 1500);
          const sizeBytes = f.filesize || (bitrateKbps && durationSec ? Math.round((bitrateKbps * 1000 * durationSec) / 8) : 0);
          const sizeMB = sizeBytes ? (sizeBytes / (1024 * 1024)).toFixed(1) : null;
          const ext = f.ext || 'mp4';

          const streamUrl = `/api/stream?platform=${extractor}&url=${encodeURIComponent(f.url)}`;
          const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ` [${quality}]`)}`;

          const formatObj = {
            itag: `ytdlp_p_${idx}`,
            format: ext,
            quality,
            resolutionTier: `${height}p`,
            fps: f.fps || 30,
            bitrate: bitrateKbps,
            codec: f.vcodec || 'H.264',
            mimeType: `video/${ext}`,
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

        // If no separate audio, expose first progressive format as audio
        if (audioFormats.length === 0 && prog.length > 0) {
          const best = prog[0];
          const streamUrl = `/api/stream?platform=${extractor}&url=${encodeURIComponent(best.url)}`;
          const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(title + ' (Audio)')}`;

          audioFormats.push({
            itag: 'ytdlp_a_fallback',
            format: 'm4a',
            mimeType: 'audio/mp4',
            codec: 'Audio Track',
            bitrate: 192,
            sampleRate: 44100,
            channels: 2,
            qualityLabel: 'Audio Track',
            sizeBytes: 0,
            sizeFormatted: 'Audio Stream',
            streamUrl,
            downloadUrl,
            hasAudio: true,
            hasVideo: false,
            isProgressive: false
          });
        }

        resolve({
          platform: extractor,
          platformName: d.extractor_key || extractor.toUpperCase(),
          platformBadgeColor: '#8b5cf6',
          videoId: d.id || 'media_' + Date.now(),
          title,
          author,
          channelUrl: d.webpage_url || url,
          duration: formatDuration(durationSec),
          durationSeconds: durationSec,
          viewCount: d.view_count ? Number(d.view_count).toLocaleString() : 'N/A',
          thumbnail,
          description: d.description || '',
          audioFormats,
          progressiveFormats,
          videoFormats,
          totalFormats: audioFormats.length + progressiveFormats.length + videoFormats.length
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}
