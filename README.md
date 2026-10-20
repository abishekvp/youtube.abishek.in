# 🚀 StreamFlow - Multi-Resource In-Memory Video & Audio Downloader

> **Strictly Zero Local Process & Zero File System Architecture**  
> Everything runs strictly in server runtime memory and client-side browser memory. No disk file writes, no temporary folders, no disk-based audio trimming, and no local conversion processes.

---

## 🌟 Key Architecture & Compliance Highlights

- **🌐 Multi-Resource Platform Support**: Download video and audio from:
  - **YouTube**: 8K, 4K, 1440p, 1080p, 720p, 480p, 360p, 240p, 144p, and all audio formats (AAC/M4A up to 384k, WebM/Opus).
  - **TikTok**: HD 1080p watermark-free video, standard watermark-free MP4, and original background audio MP3 tracks.
  - **Twitter / X**: High-Definition MP4 clips (1080p, 720p, 480p, 360p), full tweet metadata, and extracted audio tracks.
  - **Vimeo**: Progressive full HD streams (1080p, 720p, 540p, 360p), staff picks, and audio streams.
  - **Direct Media Links**: Direct `.mp4`, `.webm`, `.mov`, `.mkv`, `.mp3`, `.m4a`, and `.wav` links across the web.
  - **HTML5 & OpenGraph Web Scraper**: Automatic stream discovery for web articles and portals embedding `<meta property="og:video">` or `<video src="...">`.
  - **Universal yt-dlp Extractor**: Automatic fallback engine for 1000+ sites (Instagram, Facebook, Twitch, etc.) when running in an environment with yt-dlp installed.
- **🛡️ Strictly Zero Local Disk Usage**: Neither the backend nor the frontend writes media files to disk. No `fs.writeFile`, no `/tmp` caching, no disk bloat.
- **⚡ Direct In-Memory Stream Piping**: Video and audio streams are piped chunk-by-chunk directly from source CDN buffers to the client's HTTP response stream via Node.js backpressure pipes (`Readable.fromWeb(stream).pipe(res)`).
- **✂️ Universal In-Memory Audio Trimmer**: Works on ANY audio or video from ANY platform! Trimming runs completely in client browser RAM using Web Audio API and LAME MP3 client engine:
  - **MP3**: Ultra High Quality (320 kbps), Studio Master (256 kbps), High Quality (192 kbps), Standard (128 kbps)
  - **WAV**: 16-bit Lossless PCM (Uncompressed Studio Master)
  - **WebM**: High-Fidelity Opus Stream
  - **M4A**: AAC Audio for Apple & Mobile devices
- **⏯️ Seekable HTTP 206 Partial Content**: Supports `Range` headers for instant scrubbing in browser players and resumable downloads.
- **🎨 Modern Professional UI & Simple UX**: Clean glassmorphism styling, platform source selector pills, Dark/Light mode toggle, one-click clipboard paste, interactive stream preview player, and localStorage query history with platform badges.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (ES Modules, Node 18+)
- **Server Framework**: Express.js, CORS
- **Extraction Engines**:
  - `youtubei.js` (Multi-client Innertube combining `VISIONOS` & `ANDROID_VR`)
  - TikWM Engine for TikTok (HD Watermark-Free MP4 + MP3 Audio)
  - FxTwitter / VxTwitter Engine for Twitter/X
  - Vimeo Player Config & oEmbed Engine
  - Direct Media & OpenGraph Stream Inspector
  - Optional `yt-dlp` universal fallback extractor
- **Streaming Pipeline**: `node:stream` (`Readable.fromWeb`)
- **Client Engine**: Vanilla JavaScript (ES6 Modules), Web Audio API, `@breezystack/lamejs` in-memory MP3 encoder
- **Styling**: Modern CSS3 (CSS Variables, Glassmorphism, Flexbox, Responsive Grid)

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v8.0.0 or higher

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```
The server will start on: **`http://localhost:3000`**

### 4. Development Mode (Auto-restart)
```bash
npm run dev
```

---

## ☁️ Deploying to Vercel

The application is pre-configured for seamless 1-click deployment on [Vercel](https://vercel.com):

### Option A: Deploy via GitHub (Recommended)
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Add multi-resource video downloader support"
   git push origin main
   ```
2. Go to the [Vercel Dashboard](https://vercel.com/new).
3. Import your `youtube-video-downloader` repository.
4. Keep the default settings (Framework: *Other*, Root Directory: `./`).
5. Click **Deploy**.

### Option B: Deploy via Vercel CLI
```bash
vercel --prod
```

### Vercel Serverless Architecture
- **`vercel.json`**: Configures rewrites routing `/api/*` to the serverless function and sets `maxDuration: 60s`.
- **`api/index.js`**: Seamless serverless bridge exporting the Express application.
- **`public/`**: Static UI files served directly at the root by Vercel's global CDN Edge network.
- **Pure Node.js Extractors**: YouTube, TikTok, Twitter/X, Vimeo, and Direct extractors run seamlessly on Vercel serverless without requiring binary dependencies.

---

## 📖 User Flow & Walkthrough

1. **Paste Link**: Paste any supported link:
   - YouTube: `youtube.com/watch?v=...`, `youtu.be/...`, `shorts/...`
   - TikTok: `tiktok.com/@user/video/...`, `vt.tiktok.com/...`
   - Twitter / X: `x.com/user/status/...`, `twitter.com/...`
   - Vimeo: `vimeo.com/...`
   - Direct Link: Any `.mp4`, `.webm`, or direct audio file
2. **Fetch Formats**: The server extracts metadata and returns all available stream qualities.
3. **Choose Format**:
   - **Audio Formats Tab**: Download MP3, M4A, AAC, or Opus audio files directly or preview them.
   - **Video Formats Tab**: Download watermark-free, Full HD, or 4K/8K video streams.
   - **Client-Side Trimmer Tab**: Adjust start and end sliders to trim audio in browser RAM and export as **MP3 (320k/256k/192k/128k)**, **WAV**, **WebM Opus**, or **M4A**.
4. **Instant Stream Download**: The browser download manager receives the file stream directly into your Downloads directory.

---

## 📡 API Reference

### 1. Health Check
```http
GET /api/health
```
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-10-20T16:15:32.954Z",
  "inMemoryOnly": true,
  "localFileSystemUsage": "strictly_zero",
  "cacheSize": 3,
  "ytDlpAvailable": true
}
```

### 2. Universal Media Metadata
```http
GET /api/info?url=<ANY_SUPPORTED_VIDEO_OR_AUDIO_URL>
```
**Response Fields:**
- `platform`: Detected platform (`youtube`, `tiktok`, `twitter`, `vimeo`, `direct`, etc.)
- `platformName`: Human-readable name (`YouTube`, `TikTok`, `Twitter / X`, `Vimeo`)
- `platformBadgeColor`: UI brand color
- `videoId`: Resource ID
- `title`: Video / audio title
- `author`: Channel / creator name
- `duration`: Formatted duration (`mm:ss` or `hh:mm:ss`)
- `durationSeconds`: Total duration in seconds
- `viewCount`: Formatted view / like count
- `thumbnail`: High-resolution thumbnail URL
- `audioFormats`: List of available audio formats with bitrate, codec, size estimate, and stream URL
- `progressiveFormats`: Combined audio + video formats
- `videoFormats`: Available video streams

### 3. In-Memory Media Streaming & Proxy
```http
GET /api/stream?platform=<PLATFORM>&url=<ENCODED_URL>&download=1&filename=<FILENAME>
```
*(Or for YouTube videos: `/api/stream?videoId=<VIDEO_ID>&itag=<ITAG>&download=1`)*

**Parameters:**
- `platform` (optional): Source platform (`youtube`, `tiktok`, `twitter`, `vimeo`, `direct`)
- `url` (optional): Target CDN media stream URL
- `videoId` & `itag` (for YouTube): Video ID and format itag
- `download` (optional): `1` to attach `Content-Disposition: attachment`
- `filename` (optional): Custom file name (sanitized automatically)

**Headers Supported:**
- `Range: bytes=start-end` -> Returns `206 Partial Content` with `Content-Range` for smooth media seeking and resumed downloads.

---

## 🛡️ Zero-Disk Compliance Verification

| Requirement | Implementation Detail | Status |
| :--- | :--- | :---: |
| **No Local File System Usage** | No `fs.writeFile`, no disk-based caching, pure stream proxying. | Verified ✅ |
| **No Local Conversion Processes** | Zero ffmpeg child processes for conversions; all audio encoding runs in client Web Audio API. | Verified ✅ |
| **Multi-Resource Support** | YouTube, TikTok, Twitter/X, Vimeo, Direct Media, and OpenGraph supported. | Verified ✅ |
| **In-Memory Streaming** | `Readable.fromWeb(upstream.body).pipe(res)` direct memory transfer. | Verified ✅ |
| **Client-Side Multi-Format Trimming** | Web Audio API + In-Memory LAME MP3 / WAV / WebM / M4A Blobs in browser RAM. | Verified ✅ |
| **UX & Professional UI** | Source selector pills, Dark/Light mode, responsive glassmorphic cards, preview players, history. | Verified ✅ |
