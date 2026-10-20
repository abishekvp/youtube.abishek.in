import { extractYoutubeId, fetchYoutubeInfo, getVisionClient, getVrClient } from './youtube.js';
import { isTikTokUrl, fetchTikTokInfo } from './tiktok.js';
import { isTwitterUrl, fetchTwitterInfo } from './twitter.js';
import { isVimeoUrl, fetchVimeoInfo } from './vimeo.js';
import { isDirectMediaUrl, fetchDirectMediaInfo } from './direct.js';
import { checkYtDlpAvailable, fetchWithYtDlp } from './ytdlp.js';

export { extractYoutubeId, fetchYoutubeInfo, getVisionClient, getVrClient };
export { isTikTokUrl, fetchTikTokInfo };
export { isTwitterUrl, fetchTwitterInfo };
export { isVimeoUrl, fetchVimeoInfo };
export { isDirectMediaUrl, fetchDirectMediaInfo };
export { checkYtDlpAvailable, fetchWithYtDlp };

/**
 * Detect the platform / resource type from a URL
 */
export function detectPlatform(input) {
  if (!input) return 'unknown';
  const str = input.trim();

  if (extractYoutubeId(str)) return 'youtube';
  if (isTikTokUrl(str)) return 'tiktok';
  if (isTwitterUrl(str)) return 'twitter';
  if (isVimeoUrl(str)) return 'vimeo';
  if (isDirectMediaUrl(str)) return 'direct';
  if (/instagram\.com/i.test(str)) return 'instagram';
  if (/reddit\.com|redd\.it/i.test(str)) return 'reddit';
  if (/facebook\.com|fb\.watch/i.test(str)) return 'facebook';
  if (/pinterest\.com|pin\.it/i.test(str)) return 'pinterest';

  return 'generic';
}

/**
 * Main dispatcher: extract media metadata and formats from any supported resource
 */
export async function resolveMediaInfo(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Please provide a valid URL.');
  }

  const cleanUrl = url.trim();
  const platform = detectPlatform(cleanUrl);

  // 1. YouTube
  const youtubeId = extractYoutubeId(cleanUrl);
  if (youtubeId) {
    return await fetchYoutubeInfo(youtubeId);
  }

  // 2. TikTok
  if (platform === 'tiktok') {
    return await fetchTikTokInfo(cleanUrl);
  }

  // 3. Twitter / X
  if (platform === 'twitter') {
    return await fetchTwitterInfo(cleanUrl);
  }

  // 4. Vimeo
  if (platform === 'vimeo') {
    return await fetchVimeoInfo(cleanUrl);
  }

  // 5. Direct Media Link
  if (platform === 'direct') {
    return await fetchDirectMediaInfo(cleanUrl);
  }

  // 6. Try yt-dlp first for other social platforms (Instagram, Facebook, Reddit, etc.)
  const ytDlpReady = await checkYtDlpAvailable();
  if (ytDlpReady) {
    try {
      return await fetchWithYtDlp(cleanUrl);
    } catch (ytdlpErr) {
      console.warn('[yt-dlp fallback failed]:', ytdlpErr.message);
    }
  }

  // 7. Generic webpage scraper fallback (OpenGraph, HTML5 video)
  try {
    return await fetchDirectMediaInfo(cleanUrl);
  } catch (genericErr) {
    throw new Error(
      `Could not retrieve video from this resource. Supported sources: YouTube, TikTok, Twitter/X, Vimeo, Direct MP4/Audio, and HTML5 Web Video.`
    );
  }
}
