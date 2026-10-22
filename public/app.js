import { audioBufferToWav, audioBufferToMp3, audioBufferToMediaBlob } from './audio-encoder.js';

// DOM Elements
const urlInput = document.getElementById('urlInput');
const searchForm = document.getElementById('searchForm');
const pasteBtn = document.getElementById('pasteBtn');
const clearBtn = document.getElementById('clearBtn');
const submitBtn = document.getElementById('submitBtn');
const loadingBox = document.getElementById('loadingBox');
const errorBox = document.getElementById('errorBox');
const errorMessage = document.getElementById('errorMessage');
const videoCard = document.getElementById('videoCard');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const toastContainer = document.getElementById('toastContainer');

// Video Details Elements
const videoThumb = document.getElementById('videoThumb');
const videoDuration = document.getElementById('videoDuration');
const videoTitle = document.getElementById('videoTitle');
const videoAuthor = document.getElementById('videoAuthor');
const videoViews = document.getElementById('videoViews');
const videoDurationMeta = document.getElementById('videoDurationMeta');
const copyTitleBtn = document.getElementById('copyTitleBtn');
const previewToggleBtn = document.getElementById('previewToggleBtn');
const playerContainer = document.getElementById('playerContainer');
const previewVideo = document.getElementById('previewVideo');
const previewAudio = document.getElementById('previewAudio');

// Tabs & Grids
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const audioFormatsGrid = document.getElementById('audioFormatsGrid');
const videoFormatsGrid = document.getElementById('videoFormatsGrid');
const audioTabCount = document.getElementById('audioTabCount');
const videoTabCount = document.getElementById('videoTabCount');

// Trimmer Elements
const startSlider = document.getElementById('startSlider');
const endSlider = document.getElementById('endSlider');
const startTimeDisplay = document.getElementById('startTimeDisplay');
const endTimeDisplay = document.getElementById('endTimeDisplay');
const startTimeInput = document.getElementById('startTimeInput');
const endTimeInput = document.getElementById('endTimeInput');
const startSecBadge = document.getElementById('startSecBadge');
const endSecBadge = document.getElementById('endSecBadge');
const stepStartMinus = document.getElementById('stepStartMinus');
const stepStartPlus = document.getElementById('stepStartPlus');
const stepEndMinus = document.getElementById('stepEndMinus');
const stepEndPlus = document.getElementById('stepEndPlus');
const setStartToCurrentBtn = document.getElementById('setStartToCurrentBtn');
const setStartToZeroBtn = document.getElementById('setStartToZeroBtn');
const setEndToCurrentBtn = document.getElementById('setEndToCurrentBtn');
const setEndToEndBtn = document.getElementById('setEndToEndBtn');
const trimmerDurationDisplay = document.getElementById('trimmerDurationDisplay');
const trimmerSecDisplay = document.getElementById('trimmerSecDisplay');
const trimPlayBtn = document.getElementById('trimPlayBtn');
const trimPlayIcon = document.getElementById('trimPlayIcon');
const trimPlayText = document.getElementById('trimPlayText');
const trimPlayFromStartBtn = document.getElementById('trimPlayFromStartBtn');
const trimExportBtn = document.getElementById('trimExportBtn');
const trimExportText = document.getElementById('trimExportText');
const trimFormatSelect = document.getElementById('trimFormatSelect');
const selectedFormatBadge = document.getElementById('selectedFormatBadge');
const trimmerStatus = document.getElementById('trimmerStatus');

// Waveform & Timing Elements
const waveformCanvas = document.getElementById('waveformCanvas');
const waveformWrapper = document.getElementById('waveformWrapper');
const waveformDimLeft = document.getElementById('waveformDimLeft');
const waveformDimRight = document.getElementById('waveformDimRight');
const waveformStartMarker = document.getElementById('waveformStartMarker');
const waveformEndMarker = document.getElementById('waveformEndMarker');
const markerStartTag = document.getElementById('markerStartTag');
const markerEndTag = document.getElementById('markerEndTag');
const waveformPlayhead = document.getElementById('waveformPlayhead');
const playheadTimeBadge = document.getElementById('playheadTimeBadge');
const waveformHoverIndicator = document.getElementById('waveformHoverIndicator');
const waveformHoverBadge = document.getElementById('waveformHoverBadge');
const waveformLoader = document.getElementById('waveformLoader');
const waveformLoaderText = document.getElementById('waveformLoaderText');
const loadWaveformBtn = document.getElementById('loadWaveformBtn');
const waveformTimeRuler = document.getElementById('waveformTimeRuler');
const waveformLoadedBadge = document.getElementById('waveformLoadedBadge');
const waveformBadgeText = document.getElementById('waveformBadgeText');

// Audio Timing HUD
const trimCurrentPosition = document.getElementById('trimCurrentPosition');
const trimPlayStateIndicator = document.getElementById('trimPlayStateIndicator');
const timingStartSpan = document.getElementById('timingStartSpan');
const timingEndSpan = document.getElementById('timingEndSpan');
const timingSelectedDuration = document.getElementById('timingSelectedDuration');
const timingTotalDuration = document.getElementById('timingTotalDuration');

// Quick Jump Buttons
const seekToStartBtn = document.getElementById('seekToStartBtn');
const seekToMiddleBtn = document.getElementById('seekToMiddleBtn');
const seekToEndBtn = document.getElementById('seekToEndBtn');

// History
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// State
let currentVideoData = null;
let audioContext = null;
let currentDecodedBuffer = null;
let activeSourceNode = null;
let isAudioPlaying = false;
let isFetchingAudioBuffer = false;
let playbackStartedAt = 0;
let playbackOffset = 0;
let playbackAnimId = null;
let isDraggingPlayhead = false;

// Initialize
initTheme();
loadHistory();
setupEventListeners();

function setupEventListeners() {
  // Search submission
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (url) fetchVideo(url);
  });

  // Input changes
  urlInput.addEventListener('input', () => {
    clearBtn.style.display = urlInput.value ? 'flex' : 'none';
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.style.display = 'none';
    urlInput.focus();
  });

  // Paste from clipboard
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        clearBtn.style.display = 'flex';
        showToast('Pasted link from clipboard', 'info');
        fetchVideo(urlInput.value);
      }
    } catch {
      showToast('Clipboard access was blocked. Please paste manually.', 'error');
    }
  });

  // Sample Chips
  document.querySelectorAll('.sample-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.dataset.url;
      urlInput.value = url;
      clearBtn.style.display = 'flex';
      fetchVideo(url);
    });
  });

  // Copy Title
  copyTitleBtn.addEventListener('click', () => {
    if (currentVideoData?.title) {
      navigator.clipboard.writeText(currentVideoData.title);
      showToast('Title copied to clipboard', 'success');
    }
  });

  // Toggle Preview Player
  previewToggleBtn.addEventListener('click', togglePreviewPlayer);

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${tabId}Tab`).classList.add('active');

      if (tabId === 'trimmer') {
        if (currentVideoData && !currentDecodedBuffer && !isFetchingAudioBuffer) {
          loadAudioBufferInMemory(true).catch(() => {});
        } else if (currentDecodedBuffer) {
          requestAnimationFrame(() => {
            drawWaveform();
            updateWaveformMarkers();
          });
        }
      }
    });
  });

  // Trimmer Sliders
  startSlider.addEventListener('input', handleSliderChange);
  endSlider.addEventListener('input', handleSliderChange);

  // Large Steppers (+ / -)
  stepStartMinus.addEventListener('click', () => {
    setTrimTimes(parseFloat(startSlider.value) - 1, parseFloat(endSlider.value), 'stepper');
  });
  stepStartPlus.addEventListener('click', () => {
    setTrimTimes(parseFloat(startSlider.value) + 1, parseFloat(endSlider.value), 'stepper');
  });
  stepEndMinus.addEventListener('click', () => {
    setTrimTimes(parseFloat(startSlider.value), parseFloat(endSlider.value) - 1, 'stepper');
  });
  stepEndPlus.addEventListener('click', () => {
    setTrimTimes(parseFloat(startSlider.value), parseFloat(endSlider.value) + 1, 'stepper');
  });

  // Granular Step Chips (-5s, -1s, -100ms, -10ms, +10ms, +100ms, +1s, +5s)
  document.querySelectorAll('.step-chip[data-delta]').forEach(chip => {
    chip.addEventListener('click', () => {
      const target = chip.dataset.target;
      const delta = parseFloat(chip.dataset.delta) || 0;
      const curStart = parseFloat(startSlider.value);
      const curEnd = parseFloat(endSlider.value);
      if (target === 'start') {
        setTrimTimes(curStart + delta, curEnd, 'start');
      } else {
        setTrimTimes(curStart, curEnd + delta, 'end');
      }
    });
  });

  // Quick Action Jump Buttons
  if (setStartToCurrentBtn) {
    setStartToCurrentBtn.addEventListener('click', () => {
      const cur = getCurrentPlaybackTime() || previewVideo.currentTime || previewAudio.currentTime || 0;
      setTrimTimes(cur, parseFloat(endSlider.value), 'start');
      showToast(`Start time set to ${cur.toFixed(3)}s`, 'info');
    });
  }
  if (setStartToZeroBtn) {
    setStartToZeroBtn.addEventListener('click', () => {
      setTrimTimes(0, parseFloat(endSlider.value), 'start');
    });
  }
  if (setEndToCurrentBtn) {
    setEndToCurrentBtn.addEventListener('click', () => {
      const cur = getCurrentPlaybackTime() || previewVideo.currentTime || previewAudio.currentTime || 0;
      setTrimTimes(parseFloat(startSlider.value), cur, 'end');
      showToast(`End time set to ${cur.toFixed(3)}s`, 'info');
    });
  }
  if (setEndToEndBtn) {
    setEndToEndBtn.addEventListener('click', () => {
      const max = parseFloat(endSlider.max);
      setTrimTimes(parseFloat(startSlider.value), max, 'end');
    });
  }

  // Quick Seeks & Replay from Start
  if (seekToStartBtn) {
    seekToStartBtn.addEventListener('click', () => {
      const start = parseFloat(startSlider.value);
      seekTo(start, isAudioPlaying);
    });
  }
  if (seekToMiddleBtn) {
    seekToMiddleBtn.addEventListener('click', () => {
      const start = parseFloat(startSlider.value);
      const end = parseFloat(endSlider.value);
      seekTo((start + end) / 2, isAudioPlaying);
    });
  }
  if (seekToEndBtn) {
    seekToEndBtn.addEventListener('click', () => {
      const end = parseFloat(endSlider.value);
      seekTo(Math.max(parseFloat(startSlider.value), end - 3), isAudioPlaying);
    });
  }
  if (trimPlayFromStartBtn) {
    trimPlayFromStartBtn.addEventListener('click', () => {
      const start = parseFloat(startSlider.value);
      seekTo(start, false);
      startPlayback(start);
    });
  }
  if (loadWaveformBtn) {
    loadWaveformBtn.addEventListener('click', () => {
      loadAudioBufferInMemory();
    });
  }

  // Interactive Waveform Seeking & Scrubbing
  if (waveformWrapper) {
    waveformWrapper.addEventListener('pointerdown', (e) => {
      isDraggingPlayhead = true;
      try { waveformWrapper.setPointerCapture(e.pointerId); } catch {}
      handleWaveformPointer(e);
    });

    waveformWrapper.addEventListener('pointermove', (e) => {
      const rect = waveformWrapper.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const total = currentDecodedBuffer ? currentDecodedBuffer.duration : (parseFloat(endSlider.max) || 60);
      const hoverTime = (x / rect.width) * total;

      if (waveformHoverIndicator) {
        waveformHoverIndicator.style.display = 'block';
        waveformHoverIndicator.style.left = `${x}px`;
        if (waveformHoverBadge) {
          waveformHoverBadge.textContent = formatSecondsToTimestamp(hoverTime);
        }
      }

      if (isDraggingPlayhead) {
        handleWaveformPointer(e);
      }
    });

    waveformWrapper.addEventListener('pointerup', (e) => {
      if (isDraggingPlayhead) {
        isDraggingPlayhead = false;
        try { waveformWrapper.releasePointerCapture(e.pointerId); } catch {}
      }
    });

    waveformWrapper.addEventListener('pointerleave', () => {
      if (waveformHoverIndicator) {
        waveformHoverIndicator.style.display = 'none';
      }
    });
  }

  // Window Resize: Redraw Waveform & Adaptive Ruler
  window.addEventListener('resize', () => {
    const total = currentDecodedBuffer ? currentDecodedBuffer.duration : (parseFloat(endSlider.max) || 60);
    if (total > 0) {
      updateRuler(total);
    }
    if (currentDecodedBuffer) {
      drawWaveform();
      updateWaveformMarkers();
    }
  });

  // Attach Smart Time Input Handlers with cursor preservation & auto-colon formatting
  attachTimeInputListeners(startTimeInput, 'start');
  attachTimeInputListeners(endTimeInput, 'end');

  // Trimmer Actions (Runs 100% in browser memory)
  trimPlayBtn.addEventListener('click', handleTrimPlay);
  trimExportBtn.addEventListener('click', handleTrimExport);

  // Format selection change
  trimFormatSelect.addEventListener('change', () => {
    const val = trimFormatSelect.value;
    if (val === 'mp3-320') {
      selectedFormatBadge.textContent = 'MP3 320 kbps';
      selectedFormatBadge.className = 'tag tag-8k';
      trimExportText.textContent = 'Export Trimmed Audio (.mp3 320k)';
    } else if (val === 'mp3-256') {
      selectedFormatBadge.textContent = 'MP3 256 kbps';
      selectedFormatBadge.className = 'tag tag-hd';
      trimExportText.textContent = 'Export Trimmed Audio (.mp3 256k)';
    } else if (val === 'mp3-192') {
      selectedFormatBadge.textContent = 'MP3 192 kbps';
      selectedFormatBadge.className = 'tag tag-hd';
      trimExportText.textContent = 'Export Trimmed Audio (.mp3 192k)';
    } else if (val === 'mp3-128') {
      selectedFormatBadge.textContent = 'MP3 128 kbps';
      selectedFormatBadge.className = 'tag';
      trimExportText.textContent = 'Export Trimmed Audio (.mp3 128k)';
    } else if (val === 'wav') {
      selectedFormatBadge.textContent = 'WAV Lossless';
      selectedFormatBadge.className = 'tag tag-4k';
      trimExportText.textContent = 'Export Trimmed Audio (.wav)';
    } else if (val === 'webm') {
      selectedFormatBadge.textContent = 'WebM Opus';
      selectedFormatBadge.className = 'tag tag-opus';
      trimExportText.textContent = 'Export Trimmed Audio (.webm)';
    } else if (val === 'm4a') {
      selectedFormatBadge.textContent = 'M4A AAC';
      selectedFormatBadge.className = 'tag tag-audio';
      trimExportText.textContent = 'Export Trimmed Audio (.m4a)';
    }
  });

  // Clear History
  clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('streamflow_history');
    loadHistory();
    showToast('Recent history cleared', 'info');
  });

  // Theme Toggle
  themeToggleBtn.addEventListener('click', toggleTheme);
}

/**
 * Fetch video details from in-memory backend
 */
async function fetchVideo(url) {
  hideError();
  videoCard.style.display = 'none';
  playerContainer.style.display = 'none';
  stopMediaPlayback();
  stopAudioPlayback(true);
  loadingBox.style.display = 'block';
  submitBtn.disabled = true;

  try {
    const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || data.details || 'Failed to fetch video information');
    }

    currentVideoData = data;
    currentDecodedBuffer = null; // reset trimmer buffer
    isFetchingAudioBuffer = false;
    renderVideo(data);
    saveToHistory(data);
    showToast('Video formats loaded successfully!', 'success');
  } catch (err) {
    showError(err.message);
    showToast(err.message, 'error');
  } finally {
    loadingBox.style.display = 'none';
    submitBtn.disabled = false;
  }
}

/**
 * Render video info and formats
 */
function renderVideo(data) {
  videoThumb.src = data.thumbnail || '';
  videoDuration.textContent = data.duration || '0:00';
  videoTitle.textContent = data.title || 'YouTube Video';
  videoAuthor.textContent = data.author || 'Unknown Channel';
  videoViews.textContent = data.viewCount?.includes('view') || data.viewCount === 'N/A'
    ? data.viewCount
    : `${data.viewCount} views`;
  videoDurationMeta.textContent = data.duration || '0:00';

  // Render Audio Formats
  renderAudioFormats(data.audioFormats || []);

  // Render Video Formats (Progressive combined + Adaptive video)
  const combined = data.progressiveFormats || [];
  const adaptive = data.videoFormats || [];
  renderVideoFormats(combined, adaptive);

  // Setup Trimmer Range
  setupTrimmer(data.durationSeconds || 60);

  videoCard.style.display = 'block';
  videoCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Render Audio Formats Cards
 */
function renderAudioFormats(formats) {
  audioFormatsGrid.innerHTML = '';
  audioTabCount.textContent = formats.length;

  if (formats.length === 0) {
    audioFormatsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No audio formats available for this video.</div>`;
    return;
  }

  formats.forEach(f => {
    const card = document.createElement('div');
    card.className = 'format-card';

    const isUltra = f.bitrate >= 300;
    const isHQ = f.bitrate >= 135 && f.bitrate < 300;
    const isOpus = f.format === 'webm' || (f.codec && f.codec.toLowerCase().includes('opus'));
    const isAAC = f.format === 'm4a' || (f.codec && f.codec.toLowerCase().includes('aac'));

    const streamUrl = `/api/stream?videoId=${currentVideoData.videoId}&itag=${f.itag}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(currentVideoData.title)}`;

    card.innerHTML = `
      <div class="format-card-top">
        <div class="format-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <span>${f.qualityLabel || 'Audio Track'}</span>
        </div>
        <div class="format-tags">
          <span class="tag ${isOpus ? 'tag-opus' : 'tag-audio'}">${f.codec || (isOpus ? 'Opus' : 'AAC')}</span>
          <span class="tag">${(f.format || 'm4a').toUpperCase()}</span>
          ${isUltra ? '<span class="tag tag-8k">384k Studio</span>' : ''}
          ${isHQ ? '<span class="tag tag-hd">HQ</span>' : ''}
          ${f.channels > 2 ? '<span class="tag tag-4k">5.1 Surround</span>' : ''}
        </div>
      </div>

      <div class="format-details">
        <span>Bitrate: <strong>${f.bitrate} kbps</strong> • ${(f.sampleRate / 1000).toFixed(1)} kHz</span>
        <span>Size: <strong>${f.sizeFormatted}</strong></span>
      </div>

      <div class="format-actions">
        <a href="${downloadUrl}" class="btn-download" title="Stream Download to Browser">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download Audio</span>
        </a>
        <button class="btn-preview" title="Listen in Browser" data-stream-audio="${streamUrl}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
    `;

    // Listen preview button
    card.querySelector('[data-stream-audio]').addEventListener('click', () => {
      playAudioStream(streamUrl);
    });

    audioFormatsGrid.appendChild(card);
  });
}

/**
 * Render Video Formats Cards (Combined Audio+Video first, then Adaptive)
 */
function renderVideoFormats(combined, adaptive) {
  videoFormatsGrid.innerHTML = '';
  const totalCount = combined.length + adaptive.length;
  videoTabCount.textContent = totalCount;

  if (totalCount === 0) {
    videoFormatsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No video formats available for this video.</div>`;
    return;
  }

  // Combined formats (Progressive - Audio + Video multiplexed natively)
  combined.forEach(f => {
    const card = document.createElement('div');
    card.className = 'format-card';
    card.style.borderColor = 'rgba(245, 158, 11, 0.4)';

    const streamUrl = `/api/stream?videoId=${currentVideoData.videoId}&itag=${f.itag}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(currentVideoData.title)}`;

    card.innerHTML = `
      <div class="format-card-top">
        <div class="format-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <polygon points="10 8 16 12 10 16 10 8"></polygon>
          </svg>
          <span>${f.quality}</span>
        </div>
        <div class="format-tags">
          <span class="tag tag-combined">Audio + Video</span>
          <span class="tag">${f.format.toUpperCase()}</span>
          ${f.fps > 30 ? `<span class="tag tag-hd">${f.fps}fps</span>` : ''}
        </div>
      </div>

      <div class="format-details">
        <span>Combined Progressive Stream</span>
        <span>Size: <strong>${f.sizeFormatted}</strong></span>
      </div>

      <div class="format-actions">
        <a href="${downloadUrl}" class="btn-download" title="Stream Download to Browser">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download Video</span>
        </a>
        <button class="btn-preview" title="Watch in Browser" data-stream-video="${streamUrl}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
    `;

    card.querySelector('[data-stream-video]').addEventListener('click', () => {
      playVideoStream(streamUrl);
    });

    videoFormatsGrid.appendChild(card);
  });

  // Adaptive Video Formats (8K, 4K, 2K, 1080p, 720p, etc.)
  adaptive.forEach(f => {
    const card = document.createElement('div');
    card.className = 'format-card';

    const is8K = f.height >= 4000 || f.quality?.includes('4320');
    const is4K = !is8K && (f.height >= 2000 || f.quality?.includes('2160'));
    const is2K = !is8K && !is4K && (f.height >= 1400 || f.quality?.includes('1440'));
    const is1080 = !is8K && !is4K && !is2K && (f.height >= 1000 || f.quality?.includes('1080'));
    const is720 = !is8K && !is4K && !is2K && !is1080 && (f.height >= 700 || f.quality?.includes('720'));

    const streamUrl = `/api/stream?videoId=${currentVideoData.videoId}&itag=${f.itag}`;
    const downloadUrl = `${streamUrl}&download=1&filename=${encodeURIComponent(currentVideoData.title)}`;

    card.innerHTML = `
      <div class="format-card-top">
        <div class="format-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
            <polygon points="10 8 16 12 10 16 10 8"></polygon>
          </svg>
          <span>${f.quality}</span>
        </div>
        <div class="format-tags">
          ${is8K ? '<span class="tag tag-8k">8K Ultra HD</span>' : ''}
          ${is4K ? '<span class="tag tag-4k">4K UHD</span>' : ''}
          ${is2K ? '<span class="tag tag-hd">2K QHD</span>' : ''}
          ${is1080 ? '<span class="tag tag-hd">1080p FHD</span>' : ''}
          ${is720 ? '<span class="tag tag-hd">720p HD</span>' : ''}
          <span class="tag">${f.codec || f.format.toUpperCase()}</span>
          ${f.fps > 30 ? `<span class="tag ${f.fps >= 60 ? 'tag-hd' : ''}">${f.fps}fps</span>` : ''}
        </div>
      </div>

      <div class="format-details">
        <span>${f.resolutionTier || f.quality} • <strong>${f.bitrate} kbps</strong></span>
        <span>Size: <strong>${f.sizeFormatted}</strong></span>
      </div>

      <div class="format-actions">
        <a href="${downloadUrl}" class="btn-download" title="Stream Download to Browser">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Download Video</span>
        </a>
        <button class="btn-preview" title="Watch in Browser" data-stream-video="${streamUrl}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
    `;

    card.querySelector('[data-stream-video]').addEventListener('click', () => {
      playVideoStream(streamUrl);
    });

    videoFormatsGrid.appendChild(card);
  });
}

/**
 * Preview Media Streams
 */
function playVideoStream(streamUrl) {
  playerContainer.style.display = 'block';
  previewAudio.style.display = 'none';
  previewAudio.pause();

  previewVideo.style.display = 'block';
  previewVideo.src = streamUrl;
  previewVideo.play().catch(() => {});
  previewVideo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast('Playing video preview stream', 'info');
}

function playAudioStream(streamUrl) {
  playerContainer.style.display = 'block';
  previewVideo.style.display = 'none';
  previewVideo.pause();

  previewAudio.style.display = 'block';
  previewAudio.src = streamUrl;
  previewAudio.play().catch(() => {});
  previewAudio.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast('Playing audio preview stream', 'info');
}

function togglePreviewPlayer() {
  if (playerContainer.style.display === 'block') {
    playerContainer.style.display = 'none';
    stopMediaPlayback();
  } else {
    // Default to first progressive or first audio
    const prog = currentVideoData?.progressiveFormats?.[0];
    const aud = currentVideoData?.audioFormats?.[0];
    if (prog) {
      playVideoStream(`/api/stream?videoId=${currentVideoData.videoId}&itag=${prog.itag}`);
    } else if (aud) {
      playAudioStream(`/api/stream?videoId=${currentVideoData.videoId}&itag=${aud.itag}`);
    }
  }
}

function stopMediaPlayback() {
  previewVideo.pause();
  previewVideo.src = '';
  previewAudio.pause();
  previewAudio.src = '';
}

/**
 * Client-Side In-Memory Audio Trimmer (Web Audio API)
 * Slices AudioBuffer in browser memory, zero server disk usage!
 */
function pad2(n) {
  return String(Math.floor(n)).padStart(2, '0');
}

function pad3(n) {
  return String(Math.floor(n)).padStart(3, '0');
}

/**
 * Format seconds to MM:SS or HH:MM:SS (clean display without milliseconds)
 */
function formatSec(sec, forceHours = false) {
  if (isNaN(sec) || sec < 0) sec = 0;
  const totalSec = Math.floor(sec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0 || forceHours) {
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }
  return `${pad2(m)}:${pad2(s)}`;
}

/**
 * Format floating-point seconds to MM:SS:mmm or HH:MM:SS:mmm
 */
function formatSecondsToTimestamp(sec, forceHours = false) {
  if (isNaN(sec) || sec < 0) sec = 0;
  const totalSec = Math.floor(sec);
  const ms = Math.round((sec - totalSec) * 1000) % 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0 || forceHours) {
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}:${pad3(ms)}`;
  }
  return `${pad2(m)}:${pad2(s)}:${pad3(ms)}`;
}

/**
 * Auto-colon mask formatter for digits:
 * 2222 -> 22:22
 * 3022967 -> 30:22:967
 */
function formatDigitsToTime(digits) {
  if (!digits) return '';
  const len = digits.length;
  if (len <= 2) {
    return digits;
  } else if (len <= 4) {
    // 2222 -> 22:22
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  } else if (len <= 7) {
    // 3022967 -> 30:22:967
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
  } else if (len <= 9) {
    // 013022967 -> 01:30:22:967
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}:${digits.slice(6)}`;
  } else {
    // Microseconds up to 6 subsecond digits
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}:${digits.slice(6, 12)}`;
  }
}

/**
 * Parse any time representation back into decimal seconds:
 * Handles "22:22" (1342s), "30:22:967" (1822.967s), "01:30:22:967", raw digits, etc.
 */
function parseTimeToSeconds(input) {
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  if (!input) return 0;
  const str = String(input).trim();
  if (!str) return 0;

  // Handle pure digits (e.g. pasted "2222" or "3022967")
  if (!str.includes(':')) {
    if (/^\d{3,4}$/.test(str)) {
      // "2222" -> 22:22 = 1342s
      const m = parseInt(str.slice(0, 2), 10);
      const s = parseInt(str.slice(2), 10);
      return m * 60 + s;
    } else if (/^\d{5,7}$/.test(str)) {
      // "3022967" -> 30:22:967 = 1822.967s
      const m = parseInt(str.slice(0, 2), 10);
      const s = parseInt(str.slice(2, 4), 10);
      const msStr = str.slice(4);
      const ms = parseInt(msStr, 10) / Math.pow(10, msStr.length);
      return m * 60 + s + ms;
    } else {
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
  }

  const parts = str.split(':');
  if (parts.length === 2) {
    // MM:SS or MM:SS.mmm
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  } else if (parts.length === 3) {
    // MM:SS:mmm or HH:MM:SS
    const p0 = parseFloat(parts[0]) || 0;
    const p1 = parseFloat(parts[1]) || 0;
    const p2Str = parts[2];
    const p2 = parseFloat(p2Str) || 0;
    if (p2Str.length === 3 || p2 > 59) {
      // MM:SS:mmm (e.g. 30:22:967)
      const ms = p2 / Math.pow(10, p2Str.length);
      return p0 * 60 + p1 + ms;
    } else {
      // HH:MM:SS
      return p0 * 3600 + p1 * 60 + p2;
    }
  } else if (parts.length >= 4) {
    // HH:MM:SS:mmm
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    const msStr = parts[3];
    const ms = (parseFloat(msStr) || 0) / Math.pow(10, msStr.length);
    return h * 3600 + m * 60 + s + ms;
  }
  return 0;
}

/**
 * Handle Time Input Masking while strictly preserving the user's cursor
 * for natural editing between numbers
 */
function handleTimeInputMask(inputElem) {
  const rawVal = inputElem.value;
  const selStart = inputElem.selectionStart || 0;

  // Count how many numeric digits occurred before the cursor position
  let digitsBeforeCursor = 0;
  for (let i = 0; i < selStart; i++) {
    if (/\d/.test(rawVal[i])) {
      digitsBeforeCursor++;
    }
  }

  // Extract pure digits and format
  const digits = rawVal.replace(/\D/g, '');
  const formatted = formatDigitsToTime(digits);
  inputElem.value = formatted;

  // Reposition cursor right after the same number of digits
  let newCursorPos = 0;
  let seenDigits = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seenDigits++;
      if (seenDigits === digitsBeforeCursor) {
        newCursorPos = i + 1;
        break;
      }
    }
  }

  if (seenDigits < digitsBeforeCursor || digitsBeforeCursor === 0) {
    newCursorPos = digitsBeforeCursor === 0 ? 0 : formatted.length;
  }

  inputElem.setSelectionRange(newCursorPos, newCursorPos);
}

function attachTimeInputListeners(inputElem, target) {
  // Keydown: natural backspace when cursor is directly following a ':'
  inputElem.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && inputElem.selectionStart === inputElem.selectionEnd) {
      const pos = inputElem.selectionStart;
      if (pos > 0 && inputElem.value[pos - 1] === ':') {
        e.preventDefault();
        const val = inputElem.value;
        const newVal = val.slice(0, pos - 2) + val.slice(pos - 1);
        inputElem.value = newVal;
        inputElem.setSelectionRange(pos - 2, pos - 2);
        handleTimeInputMask(inputElem);
      }
    } else if (e.key === 'Enter') {
      inputElem.blur();
    }
  });

  // Input event: apply smart mask and sync state
  inputElem.addEventListener('input', () => {
    handleTimeInputMask(inputElem);
    const parsed = parseTimeToSeconds(inputElem.value);
    const curStart = parseFloat(startSlider.value);
    const curEnd = parseFloat(endSlider.value);
    if (target === 'start') {
      setTrimTimes(parsed, curEnd, 'startInput');
    } else {
      setTrimTimes(curStart, parsed, 'endInput');
    }
  });

  // Blur event: clean formatting and clamp
  inputElem.addEventListener('blur', () => {
    const parsed = parseTimeToSeconds(inputElem.value);
    const curStart = parseFloat(startSlider.value);
    const curEnd = parseFloat(endSlider.value);
    if (target === 'start') {
      setTrimTimes(parsed, curEnd, 'start');
      inputElem.value = formatSecondsToTimestamp(parseFloat(startSlider.value));
    } else {
      setTrimTimes(curStart, parsed, 'end');
      inputElem.value = formatSecondsToTimestamp(parseFloat(endSlider.value));
    }
  });
}

/**
 * Master Synchronizer for In-Memory Trimmer State
 */
function setTrimTimes(newStart, newEnd, source = 'unknown') {
  const max = parseFloat(endSlider.max) || (currentVideoData?.durationSeconds || 60);

  let start = Math.max(0, parseFloat(newStart) || 0);
  let end = Math.min(max, parseFloat(newEnd) || 0);

  // Maintain minimum 50ms interval
  const minGap = 0.05;
  if (start > end - minGap) {
    if (source === 'start' || source === 'startInput') {
      start = Math.max(0, end - minGap);
    } else {
      end = Math.min(max, start + minGap);
    }
  }

  // Round to nearest millisecond to avoid float precision drift
  start = Math.round(start * 1000) / 1000;
  end = Math.round(end * 1000) / 1000;

  startSlider.value = start;
  endSlider.value = end;

  if (source !== 'startInput' && document.activeElement !== startTimeInput && startTimeInput) {
    startTimeInput.value = formatSecondsToTimestamp(start);
  }
  if (source !== 'endInput' && document.activeElement !== endTimeInput && endTimeInput) {
    endTimeInput.value = formatSecondsToTimestamp(end);
  }

  if (startTimeDisplay) startTimeDisplay.textContent = formatSecondsToTimestamp(start);
  if (endTimeDisplay) endTimeDisplay.textContent = formatSecondsToTimestamp(end);
  if (startSecBadge) startSecBadge.textContent = `${start.toFixed(3)}s`;
  if (endSecBadge) endSecBadge.textContent = `${end.toFixed(3)}s`;

  const diff = Math.max(0, end - start);
  if (trimmerDurationDisplay) trimmerDurationDisplay.textContent = formatSecondsToTimestamp(diff);
  if (trimmerSecDisplay) trimmerSecDisplay.textContent = `(${diff.toFixed(3)}s)`;

  // Update Audio Timing HUD
  if (timingStartSpan) timingStartSpan.textContent = formatSecondsToTimestamp(start);
  if (timingEndSpan) timingEndSpan.textContent = formatSecondsToTimestamp(end);
  if (timingSelectedDuration) timingSelectedDuration.textContent = formatSecondsToTimestamp(diff);
  if (timingTotalDuration) timingTotalDuration.textContent = formatSecondsToTimestamp(max);

  // Update Bottom of Audio Wave Selection & Total Bar
  const waveBottomSelectionRange = document.getElementById('waveBottomSelectionRange');
  if (waveBottomSelectionRange) {
    waveBottomSelectionRange.textContent = `${formatSecondsToTimestamp(start)} ➔ ${formatSecondsToTimestamp(end)}`;
  }
  const waveBottomDuration = document.getElementById('waveBottomDuration');
  if (waveBottomDuration) {
    waveBottomDuration.textContent = formatSecondsToTimestamp(diff);
  }
  const waveBottomTotalTime = document.getElementById('waveBottomTotalTime');
  if (waveBottomTotalTime) {
    waveBottomTotalTime.textContent = formatSecondsToTimestamp(max);
  }

  // Synchronize Waveform Markers & Redraw Waveform
  updateWaveformMarkers();
  drawWaveform();

  // If stopped and playhead is out of the selection bounds, reposition
  if (!isAudioPlaying && !isDraggingPlayhead) {
    if (playbackOffset < start || playbackOffset > end) {
      playbackOffset = start;
      updatePlayheadUI(playbackOffset);
      updateTimingDisplay(playbackOffset);
      updatePlayButtonUI(false);
    }
  }
}

function setupTrimmer(durationSec) {
  const max = Math.max(1, parseFloat(durationSec) || 60);
  startSlider.max = max;
  startSlider.min = 0;
  startSlider.step = 0.001;
  startSlider.value = 0;

  endSlider.max = max;
  endSlider.min = 0;
  endSlider.step = 0.001;
  endSlider.value = Math.min(30, max);

  stopAudioPlayback(true);
  playbackOffset = 0;
  setTrimTimes(0, Math.min(30, max), 'setup');

  updatePlayheadUI(0);
  updateTimingDisplay(0);
  updateRuler(max);
  updatePlayButtonUI(false);
  updatePlayStateIndicator('ready');

  if (waveformLoadedBadge) {
    waveformLoadedBadge.className = 'waveform-badge-pill';
    if (waveformBadgeText) waveformBadgeText.textContent = 'Waveform Idle';
  }
  if (waveformLoader) {
    waveformLoader.classList.remove('hidden');
    if (waveformLoaderText) waveformLoaderText.textContent = 'Click "Load Waves" or "Play" to decode audio in RAM';
  }
}

function handleSliderChange(e) {
  const isStart = e && e.target === startSlider;
  const start = parseFloat(startSlider.value);
  const end = parseFloat(endSlider.value);
  setTrimTimes(start, end, isStart ? 'start' : 'end');
}

/**
 * Live Playback Time Calculator
 */
function getCurrentPlaybackTime() {
  if (!isAudioPlaying || !audioContext) {
    return playbackOffset;
  }
  const elapsed = audioContext.currentTime - playbackStartedAt;
  const current = playbackOffset + elapsed;
  const end = parseFloat(endSlider.value);
  const total = currentDecodedBuffer ? currentDecodedBuffer.duration : (parseFloat(endSlider.max) || 60);
  const limit = playbackOffset <= end ? end : total;
  return Math.min(current, limit);
}

/**
 * Precompute audio peaks for high-performance waveform rendering
 */
function computePeaks(buffer, numBars) {
  const channelData = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(channelData.length / numBars));
  const peaks = new Float32Array(numBars);
  let globalMax = 0;

  for (let i = 0; i < numBars; i++) {
    const startIdx = i * step;
    const endIdx = Math.min(startIdx + step, channelData.length);
    let max = 0;
    const sampleStep = Math.max(1, Math.floor((endIdx - startIdx) / 50));
    for (let j = startIdx; j < endIdx; j += sampleStep) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks[i] = max;
    if (max > globalMax) globalMax = max;
  }

  if (globalMax > 0) {
    for (let i = 0; i < numBars; i++) {
      peaks[i] = Math.max(0.06, peaks[i] / globalMax);
    }
  }
  return peaks;
}

/**
 * Render Audio Waveform onto HTML5 Canvas
 */
function drawWaveform() {
  if (!waveformCanvas || !currentDecodedBuffer) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = waveformCanvas.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height || 125);

  if (width <= 0) return;

  if (waveformCanvas.width !== width * dpr || waveformCanvas.height !== height * dpr) {
    waveformCanvas.width = width * dpr;
    waveformCanvas.height = height * dpr;
  }

  const ctx = waveformCanvas.getContext('2d');
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const barWidth = 3;
  const barGap = 1.5;
  const slot = barWidth + barGap;
  const numBars = Math.floor(width / slot);

  if (numBars <= 0) {
    ctx.restore();
    return;
  }

  if (!currentDecodedBuffer._peaks || currentDecodedBuffer._peaks.length !== numBars) {
    currentDecodedBuffer._peaks = computePeaks(currentDecodedBuffer, numBars);
  }
  const peaks = currentDecodedBuffer._peaks;

  const totalDuration = currentDecodedBuffer.duration;
  const start = parseFloat(startSlider.value);
  const end = parseFloat(endSlider.value);
  const curTime = getCurrentPlaybackTime();

  const centerY = height / 2;
  const maxBarHeight = height * 0.86;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const colorDim = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.18)';
  const colorUnplayed = '#ff0033';
  const colorPlayed = '#38bdf8';

  for (let i = 0; i < numBars; i++) {
    const x = i * slot;
    const barTime = (i / numBars) * totalDuration;
    const barHeight = Math.max(4, peaks[i] * maxBarHeight);
    const topY = centerY - barHeight / 2;

    if (barTime < start || barTime > end) {
      ctx.fillStyle = colorDim;
    } else if (barTime <= curTime) {
      ctx.fillStyle = colorPlayed;
    } else {
      ctx.fillStyle = colorUnplayed;
    }

    // Draw rounded bar
    const r = Math.min(barWidth / 2, barHeight / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, topY);
    ctx.arcTo(x + barWidth, topY, x + barWidth, topY + barHeight, r);
    ctx.arcTo(x + barWidth, topY + barHeight, x, topY + barHeight, r);
    ctx.arcTo(x, topY + barHeight, x, topY, r);
    ctx.arcTo(x, topY, x + barWidth, topY, r);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Synchronize Start/End markers and Dimming Overlays on Waveform
 */
function updateWaveformMarkers() {
  const totalDuration = currentDecodedBuffer ? currentDecodedBuffer.duration : (parseFloat(endSlider.max) || 60);
  if (totalDuration <= 0) return;

  const start = parseFloat(startSlider.value);
  const end = parseFloat(endSlider.value);

  const startPct = Math.max(0, Math.min(100, (start / totalDuration) * 100));
  const endPct = Math.max(0, Math.min(100, (end / totalDuration) * 100));

  if (waveformDimLeft) waveformDimLeft.style.width = `${startPct}%`;
  if (waveformDimRight) {
    waveformDimRight.style.left = `${endPct}%`;
    waveformDimRight.style.width = `${100 - endPct}%`;
  }

  if (waveformStartMarker) waveformStartMarker.style.left = `${startPct}%`;
  if (waveformEndMarker) waveformEndMarker.style.left = `${endPct}%`;

  if (markerStartTag) markerStartTag.textContent = formatSecondsToTimestamp(start);
  if (markerEndTag) markerEndTag.textContent = formatSecondsToTimestamp(end);
}

/**
 * Update Playhead Scrubber and Time Badges
 */
function updatePlayheadUI(time) {
  const totalDuration = currentDecodedBuffer ? currentDecodedBuffer.duration : (parseFloat(endSlider.max) || 60);
  if (totalDuration <= 0) return;

  const clampedTime = Math.max(0, Math.min(time, totalDuration));
  const pct = Math.max(0, Math.min(100, (clampedTime / totalDuration) * 100));

  if (waveformPlayhead) {
    waveformPlayhead.style.left = `${pct}%`;
  }
  const formatted = formatSecondsToTimestamp(clampedTime);
  if (playheadTimeBadge) {
    playheadTimeBadge.textContent = formatted;
  }
  const playheadBottomBadge = document.getElementById('playheadBottomBadge');
  if (playheadBottomBadge) {
    playheadBottomBadge.textContent = formatted;
  }
}

function updateTimingDisplay(time) {
  const formatted = formatSecondsToTimestamp(time);
  if (trimCurrentPosition) {
    trimCurrentPosition.textContent = formatted;
  }
  const waveBottomCurrentTime = document.getElementById('waveBottomCurrentTime');
  if (waveBottomCurrentTime) {
    waveBottomCurrentTime.textContent = formatted;
  }
}

function updatePlayButtonUI(isPlaying) {
  if (isPlaying) {
    if (trimPlayIcon) {
      trimPlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>';
    }
    trimPlayText.textContent = 'Pause / Stop';
    trimPlayBtn.classList.add('playing');
  } else {
    if (trimPlayIcon) {
      trimPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    }
    trimPlayBtn.classList.remove('playing');
    const start = parseFloat(startSlider.value);
    const end = parseFloat(endSlider.value);
    if (playbackOffset > start + 0.1 && playbackOffset < end - 0.1) {
      trimPlayText.textContent = `Play from ${formatSecondsToTimestamp(playbackOffset)}`;
    } else {
      trimPlayText.textContent = 'Play Trimmed Selection';
    }
  }
}

function updatePlayStateIndicator(state) {
  if (!trimPlayStateIndicator) return;
  const currentCol = document.querySelector('.current-time-col');
  const waveBottomStateBadge = document.getElementById('waveBottomStateBadge');
  const waveBottomLiveDot = document.getElementById('waveBottomLiveDot');

  if (state === 'playing') {
    trimPlayStateIndicator.textContent = 'PLAYING';
    trimPlayStateIndicator.className = 'timing-state-badge playing';
    if (waveBottomStateBadge) {
      waveBottomStateBadge.textContent = 'PLAYING';
      waveBottomStateBadge.className = 'timing-state-badge playing';
    }
    if (waveBottomLiveDot) {
      waveBottomLiveDot.className = 'playback-live-dot playing';
    }
    if (currentCol) currentCol.classList.add('is-playing');
  } else if (state === 'paused') {
    trimPlayStateIndicator.textContent = 'PAUSED';
    trimPlayStateIndicator.className = 'timing-state-badge paused';
    if (waveBottomStateBadge) {
      waveBottomStateBadge.textContent = 'PAUSED';
      waveBottomStateBadge.className = 'timing-state-badge paused';
    }
    if (waveBottomLiveDot) {
      waveBottomLiveDot.className = 'playback-live-dot paused';
    }
    if (currentCol) currentCol.classList.remove('is-playing');
  } else {
    trimPlayStateIndicator.textContent = 'READY';
    trimPlayStateIndicator.className = 'timing-state-badge';
    if (waveBottomStateBadge) {
      waveBottomStateBadge.textContent = 'READY';
      waveBottomStateBadge.className = 'timing-state-badge';
    }
    if (waveBottomLiveDot) {
      waveBottomLiveDot.className = 'playback-live-dot';
    }
    if (currentCol) currentCol.classList.remove('is-playing');
  }
}

/**
 * Generate Dynamic Timeline Ruler underneath Waveform
 * Keeps all time points strictly within the section with adaptive spacing and clean formatting.
 */
function updateRuler(totalDuration) {
  if (!waveformTimeRuler || totalDuration <= 0) return;
  waveformTimeRuler.innerHTML = '';

  const waveBottomTotalTime = document.getElementById('waveBottomTotalTime');
  if (waveBottomTotalTime) {
    waveBottomTotalTime.textContent = formatSecondsToTimestamp(totalDuration);
  }

  // Calculate container width to ensure time points never crowd or exceed the section
  const rulerWidth = waveformTimeRuler.clientWidth || (waveformWrapper ? waveformWrapper.clientWidth : 800) || 800;
  const minSpacingPx = 75; // Minimum space per time point label
  const maxTicks = Math.max(3, Math.floor(rulerWidth / minSpacingPx));

  const candidateSteps = [1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1800, 3600];
  let step = candidateSteps[candidateSteps.length - 1];
  for (const s of candidateSteps) {
    if (Math.ceil(totalDuration / s) <= maxTicks) {
      step = s;
      break;
    }
  }

  let lastTickPct = -100;
  for (let t = 0; t <= totalDuration; t += step) {
    const pct = Math.max(0, Math.min(100, (t / totalDuration) * 100));

    // Prevent collision with end if there's an end marker
    if (pct > 92 && totalDuration - t < step * 0.5) {
      continue;
    }

    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    // Use formatSec for clean, compact MM:SS labels (e.g. 01:15) without bloated milliseconds
    tick.textContent = formatSec(t);

    if (pct <= 2) {
      tick.style.left = '0%';
      tick.style.transform = 'translateX(0)';
      tick.classList.add('ruler-tick-start');
    } else if (pct >= 95) {
      tick.style.left = `${pct}%`;
      tick.style.transform = 'translateX(-100%)';
      tick.classList.add('ruler-tick-end');
    } else {
      tick.style.left = `${pct}%`;
      tick.style.transform = 'translateX(-50%)';
    }

    waveformTimeRuler.appendChild(tick);
    lastTickPct = pct;
  }

  // Add final duration tick if space allows (> 8% space after last tick)
  if (100 - lastTickPct > 8) {
    const endTick = document.createElement('div');
    endTick.className = 'ruler-tick ruler-tick-end';
    endTick.style.left = '100%';
    endTick.style.transform = 'translateX(-100%)';
    endTick.textContent = formatSec(totalDuration);
    waveformTimeRuler.appendChild(endTick);
  }
}

/**
 * Handle Pointer Click or Drag on Waveform to Seek and Play Anywhere
 */
function handleWaveformPointer(e) {
  if (!waveformWrapper) return;
  const rect = waveformWrapper.getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const total = currentDecodedBuffer ? currentDecodedBuffer.duration : (parseFloat(endSlider.max) || 60);
  const targetTime = (x / rect.width) * total;

  if (!currentDecodedBuffer && !isFetchingAudioBuffer) {
    loadAudioBufferInMemory().then(() => {
      seekTo(targetTime, isAudioPlaying);
    });
    return;
  }

  seekTo(targetTime, isAudioPlaying);
}

/**
 * Seek to Any Time Position in Audio Track
 */
async function seekTo(targetTime, keepPlaying = null) {
  const totalDuration = currentDecodedBuffer ? currentDecodedBuffer.duration : (parseFloat(endSlider.max) || 60);
  const clamped = Math.max(0, Math.min(targetTime, totalDuration));

  playbackOffset = clamped;
  updatePlayheadUI(clamped);
  updateTimingDisplay(clamped);
  drawWaveform();

  if (isAudioPlaying || keepPlaying === true) {
    await startPlayback(clamped);
  } else {
    updatePlayButtonUI(false);
  }
}

/**
 * Fetch and decode audio stream into browser AudioContext RAM
 * Tries candidates with fallback so trimming never fails
 */
async function loadAudioBufferInMemory(silent = false) {
  if (currentDecodedBuffer) return currentDecodedBuffer;
  if (!currentVideoData?.audioFormats?.length) {
    throw new Error('No audio format available for trimming');
  }

  isFetchingAudioBuffer = true;
  if (waveformLoadedBadge) {
    waveformLoadedBadge.className = 'waveform-badge-pill loading';
    if (waveformBadgeText) waveformBadgeText.textContent = 'Decoding in RAM...';
  }
  if (waveformLoader) {
    waveformLoader.classList.remove('hidden');
    if (waveformLoaderText) waveformLoaderText.textContent = '⚡ Streaming & decoding audio waveform in browser RAM...';
  }

  // Prioritize candidates: Opus first (most reliable decoder across all browsers), then AAC/M4A
  const opusCandidate = currentVideoData.audioFormats.find(f => f.format === 'webm' || (f.codec && f.codec.includes('Opus')));
  const aacCandidate = currentVideoData.audioFormats.find(f => f.format === 'm4a' || (f.codec && f.codec.includes('AAC')));
  
  const candidates = [opusCandidate, aacCandidate, ...currentVideoData.audioFormats].filter(Boolean);
  const uniqueCandidates = [...new Map(candidates.map(c => [c.itag, c])).values()];

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  let lastError = null;
  for (const audioFmt of uniqueCandidates) {
    try {
      trimmerStatus.textContent = `⏳ Fetching ${audioFmt.qualityLabel} into browser RAM...`;
      const streamUrl = `/api/stream?videoId=${currentVideoData.videoId}&itag=${audioFmt.itag}`;
      const response = await fetch(streamUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to stream audio`);
      }

      trimmerStatus.textContent = '⚡ Decoding audio waveform in browser memory...';
      const arrayBuffer = await response.arrayBuffer();

      currentDecodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
      isFetchingAudioBuffer = false;

      const totalDur = currentDecodedBuffer.duration;
      startSlider.max = totalDur;
      endSlider.max = totalDur;
      if (parseFloat(endSlider.value) > totalDur) {
        endSlider.value = totalDur;
      }

      if (waveformLoader) waveformLoader.classList.add('hidden');
      if (waveformLoadedBadge) {
        waveformLoadedBadge.className = 'waveform-badge-pill ready';
        if (waveformBadgeText) waveformBadgeText.textContent = `Ready (${totalDur.toFixed(1)}s)`;
      }

      updateRuler(totalDur);
      setTrimTimes(parseFloat(startSlider.value), parseFloat(endSlider.value), 'bufferLoaded');
      drawWaveform();

      trimmerStatus.textContent = `✅ Audio ready in memory (${totalDur.toFixed(1)}s). Ready to preview, trim and export!`;
      if (!silent) {
        showToast('Audio waveform loaded & ready in browser RAM!', 'success');
      }
      return currentDecodedBuffer;
    } catch (err) {
      console.warn(`[Trimmer] Audio candidate itag ${audioFmt.itag} failed:`, err.message);
      lastError = err;
    }
  }

  isFetchingAudioBuffer = false;
  if (waveformLoadedBadge) {
    waveformLoadedBadge.className = 'waveform-badge-pill';
    if (waveformBadgeText) waveformBadgeText.textContent = 'Error loading';
  }
  if (waveformLoader) {
    waveformLoader.classList.remove('hidden');
    if (waveformLoaderText) waveformLoaderText.textContent = 'Failed to load audio stream. Click to retry.';
  }
  throw new Error(lastError ? lastError.message : 'Could not fetch or decode audio stream in browser memory');
}

/**
 * Audio playback helpers
 */
function stopActiveSourceNode(resetOffset = true) {
  if (activeSourceNode) {
    try {
      activeSourceNode.onended = null;
      activeSourceNode.stop();
      activeSourceNode.disconnect();
    } catch {}
    activeSourceNode = null;
  }
  isAudioPlaying = false;
  if (resetOffset) {
    playbackOffset = parseFloat(startSlider.value);
  }
}

function stopAudioPlayback(resetToStart = false) {
  if (playbackAnimId) {
    cancelAnimationFrame(playbackAnimId);
    playbackAnimId = null;
  }

  const cur = getCurrentPlaybackTime();
  stopActiveSourceNode(false);

  const start = parseFloat(startSlider.value);
  if (resetToStart) {
    playbackOffset = start;
  } else {
    playbackOffset = cur;
  }

  updatePlayheadUI(playbackOffset);
  updateTimingDisplay(playbackOffset);
  drawWaveform();
  updatePlayButtonUI(false);
  updatePlayStateIndicator('paused');
}

function onPlaybackFinished() {
  if (playbackAnimId) {
    cancelAnimationFrame(playbackAnimId);
    playbackAnimId = null;
  }
  stopActiveSourceNode(false);
  const start = parseFloat(startSlider.value);
  playbackOffset = start;
  updatePlayheadUI(start);
  updateTimingDisplay(start);
  drawWaveform();
  updatePlayButtonUI(false);
  updatePlayStateIndicator('ready');
  showToast('Playback reached end of selection', 'info');
}

function startPlaybackLoop() {
  if (playbackAnimId) cancelAnimationFrame(playbackAnimId);

  function frame() {
    if (!isAudioPlaying) return;
    const curTime = getCurrentPlaybackTime();
    const end = parseFloat(endSlider.value);
    const total = currentDecodedBuffer ? currentDecodedBuffer.duration : (parseFloat(endSlider.max) || 60);
    const limit = playbackOffset <= end ? end : total;

    updatePlayheadUI(curTime);
    updateTimingDisplay(curTime);
    drawWaveform();

    if (curTime >= limit - 0.05) {
      onPlaybackFinished();
      return;
    }

    playbackAnimId = requestAnimationFrame(frame);
  }

  playbackAnimId = requestAnimationFrame(frame);
}

/**
 * In-Memory Trimmed Audio Playback with Precise Seeking from Anywhere
 */
async function startPlayback(fromTime = null) {
  try {
    trimPlayBtn.disabled = true;
    trimPlayText.textContent = 'Buffering in RAM...';

    const buffer = await loadAudioBufferInMemory();
    if (!buffer) return;

    const start = parseFloat(startSlider.value);
    const end = parseFloat(endSlider.value);

    let seekTime;
    if (fromTime !== null && !isNaN(fromTime)) {
      seekTime = Math.max(0, Math.min(fromTime, buffer.duration));
    } else if (playbackOffset >= start && playbackOffset < end - 0.15) {
      seekTime = playbackOffset;
    } else {
      seekTime = start;
    }

    if (seekTime >= end - 0.1) {
      seekTime = start;
    }

    const playDuration = seekTime <= end ? Math.max(0.05, end - seekTime) : Math.max(0.05, buffer.duration - seekTime);

    stopActiveSourceNode(false);

    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    activeSourceNode = audioContext.createBufferSource();
    activeSourceNode.buffer = buffer;
    activeSourceNode.connect(audioContext.destination);

    playbackOffset = seekTime;
    playbackStartedAt = audioContext.currentTime;
    isAudioPlaying = true;

    activeSourceNode.onended = () => {
      if (isAudioPlaying && audioContext) {
        const elapsed = audioContext.currentTime - playbackStartedAt;
        const cur = playbackOffset + elapsed;
        const limit = seekTime <= end ? end : buffer.duration;
        if (cur >= limit - 0.15) {
          onPlaybackFinished();
        }
      }
    };

    activeSourceNode.start(0, seekTime, playDuration);

    updatePlayButtonUI(true);
    updatePlayStateIndicator('playing');
    startPlaybackLoop();
  } catch (err) {
    showToast(`Trimmer preview error: ${err.message}`, 'error');
    updatePlayButtonUI(false);
    updatePlayStateIndicator('ready');
  } finally {
    trimPlayBtn.disabled = false;
  }
}

async function handleTrimPlay() {
  if (isAudioPlaying) {
    stopAudioPlayback(false);
    return;
  }
  await startPlayback(playbackOffset);
}

/**
 * In-Memory Trimmed Audio Export (MP3, WAV, WebM, M4A)
 * Runs 100% in client browser memory with zero disk writes!
 */
async function handleTrimExport() {
  const chosenFormat = trimFormatSelect ? trimFormatSelect.value : 'mp3-320';
  const originalBtnText = trimExportText.textContent;

  try {
    trimExportBtn.disabled = true;
    trimExportText.textContent = 'Processing in RAM...';

    const buffer = await loadAudioBufferInMemory();
    const start = parseFloat(startSlider.value);
    const end = parseFloat(endSlider.value);

    const sampleRate = buffer.sampleRate;
    const startSample = Math.max(0, Math.floor(start * sampleRate));
    const endSample = Math.min(buffer.length, Math.floor(end * sampleRate));
    const frameCount = endSample - startSample;

    if (frameCount <= 0) {
      throw new Error('Invalid trim range selected');
    }

    trimmerStatus.textContent = '✂️ Slicing audio buffer in browser RAM...';

    // Create sliced AudioBuffer in memory
    const trimmedBuffer = audioContext.createBuffer(
      buffer.numberOfChannels,
      frameCount,
      sampleRate
    );

    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const channelData = buffer.getChannelData(c).subarray(startSample, endSample);
      trimmedBuffer.copyToChannel(channelData, c);
    }

    let audioBlob;
    let ext = 'mp3';

    if (chosenFormat.startsWith('mp3')) {
      const kbps = parseInt(chosenFormat.split('-')[1] || '320', 10);
      trimmerStatus.textContent = `🎵 Encoding ${kbps} kbps MP3 directly in browser RAM (LAME Engine)...`;
      audioBlob = audioBufferToMp3(trimmedBuffer, kbps);
      ext = 'mp3';
    } else if (chosenFormat === 'wav') {
      trimmerStatus.textContent = '🎼 Encoding 16-bit Lossless WAV Blob in browser RAM...';
      audioBlob = audioBufferToWav(trimmedBuffer);
      ext = 'wav';
    } else if (chosenFormat === 'webm') {
      trimmerStatus.textContent = '🎧 Encoding Opus WebM in browser RAM...';
      audioBlob = await audioBufferToMediaBlob(audioContext, trimmedBuffer, 'audio/webm');
      ext = 'webm';
    } else if (chosenFormat === 'm4a') {
      trimmerStatus.textContent = '📱 Encoding AAC M4A in browser RAM...';
      audioBlob = await audioBufferToMediaBlob(audioContext, trimmedBuffer, 'audio/mp4');
      ext = 'm4a';
    } else {
      audioBlob = audioBufferToMp3(trimmedBuffer, 320);
      ext = 'mp3';
    }

    const blobUrl = URL.createObjectURL(audioBlob);

    // Trigger instant browser download
    const safeTitle = (currentVideoData?.title || 'audio').replace(/[^a-zA-Z0-9_-]/g, '_');
    const startStr = formatSecondsToTimestamp(start).replace(/:/g, '-');
    const endStr = formatSecondsToTimestamp(end).replace(/:/g, '-');
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `trimmed_${safeTitle}_${startStr}_to_${endStr}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    const sizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
    trimmerStatus.textContent = `🎉 Trimmed audio exported as .${ext.toUpperCase()} (${sizeMB} MB) completely in browser memory!`;
    showToast(`Trimmed ${ext.toUpperCase()} downloaded successfully (${sizeMB} MB)!`, 'success');
  } catch (err) {
    showToast(`Export failed: ${err.message}`, 'error');
    trimmerStatus.textContent = `Export error: ${err.message}`;
  } finally {
    trimExportBtn.disabled = false;
    trimExportText.textContent = originalBtnText;
  }
}

/**
 * History (localStorage)
 */
function saveToHistory(data) {
  try {
    let history = JSON.parse(localStorage.getItem('streamflow_history') || '[]');
    history = history.filter(item => item.videoId !== data.videoId);
    history.unshift({
      videoId: data.videoId,
      title: data.title,
      author: data.author,
      thumbnail: data.thumbnail,
      duration: data.duration,
      timestamp: Date.now()
    });
    history = history.slice(0, 6);
    localStorage.setItem('streamflow_history', JSON.stringify(history));
    loadHistory();
  } catch {}
}

function loadHistory() {
  try {
    const history = JSON.parse(localStorage.getItem('streamflow_history') || '[]');
    if (history.length === 0) {
      historySection.style.display = 'none';
      return;
    }

    historySection.style.display = 'block';
    historyList.innerHTML = '';

    history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <img class="history-thumb" src="${item.thumbnail}" alt="Thumbnail">
        <div class="history-info">
          <div class="history-title-text">${item.title}</div>
          <div class="history-sub-text">${item.author} • ${item.duration}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        urlInput.value = `https://www.youtube.com/watch?v=${item.videoId}`;
        clearBtn.style.display = 'flex';
        fetchVideo(urlInput.value);
      });
      historyList.appendChild(card);
    });
  } catch {}
}

/**
 * Error Box Helpers
 */
function showError(msg) {
  errorMessage.textContent = msg;
  errorBox.style.display = 'flex';
}

function hideError() {
  errorBox.style.display = 'none';
}

/**
 * Toast Notifications
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Theme Toggle
 */
function initTheme() {
  const saved = localStorage.getItem('streamflow_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('streamflow_theme', next);
  updateThemeIcon(next);
  if (currentDecodedBuffer) {
    drawWaveform();
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (theme === 'light') {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  } else {
    icon.innerHTML = `
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    `;
  }
}
