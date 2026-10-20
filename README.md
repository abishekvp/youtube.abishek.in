# 🚀 StreamFlow - In-Memory YouTube Video & Audio Downloader

> **Strictly Zero Local Process & Zero File System Architecture**  
> Everything runs strictly in server runtime memory and client-side browser memory. No disk file writes, no temporary folders, no disk-based audio trimming, and no local conversion processes.

---

## 🌟 Key Architecture & Compliance Highlights

- **🛡️ Strictly Zero Local Disk Usage**: Neither the backend nor the frontend writes media files to disk. No `fs.writeFile`, no `/tmp` caching, no disk bloat.
- **⚡ Direct In-Memory Stream Piping**: Video and audio streams are piped chunk-by-chunk directly from YouTube's CDN buffers to the client's HTTP response stream via Node.js backpressure pipes (`Readable.fromWeb(stream).pipe(res)`).
- **✂️ Multi-Format In-Memory Audio Trimmer**: Audio trimming runs completely in client browser RAM using Web Audio API and LAME MP3 client engine:
  - **MP3**: Ultra High Quality (320 kbps), Studio Master (256 kbps), High Quality (192 kbps), Standard (128 kbps)
  - **WAV**: 16-bit Lossless PCM (Uncompressed Studio Master)
  - **WebM**: High-Fidelity Opus Stream
  - **M4A**: AAC Audio for Apple & Mobile devices
- **🎧 High-Fidelity Audio Streams**: Unlocks all available audio bitrates (up to 384 kbps Ultra Studio, 160 kbps Opus, 130 kbps AAC, 75 kbps, 50 kbps).
- **🎬 Full HD, 4K & 8K Video Streams**: Unlocks 8K Ultra HD (4320p 60fps), 4K UHD (2160p 60fps), 2K QHD (1440p 60fps), 1080p Full HD (60fps), 720p HD (60fps), down to 144p.
- **⏯️ Seekable HTTP 206 Partial Content**: Supports `Range` headers for instant scrubbing in browser players and resumable downloads.
- **🎨 Modern Professional UI & Simple UX**: Clean glassmorphism styling, Dark/Light mode toggle, one-click clipboard paste, interactive stream preview player, and localStorage query history.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Server Framework**: Express.js, CORS
- **YouTube Engine**: `youtubei.js` (Multi-client Innertube combining `VISIONOS` & `ANDROID_VR`)
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
   git commit -m "Configure Vercel deployment"
   git push origin main
   ```
2. Go to the [Vercel Dashboard](https://vercel.com/new).
3. Import your `youtube-video-downloader` repository.
4. Keep the default settings (Framework: *Other*, Root Directory: `./`).
5. Click **Deploy**.

### Option B: Deploy via Vercel CLI
```bash
vercel
```
To deploy directly to production:
```bash
vercel --prod
```

### Vercel Architecture Setup
- **`vercel.json`**: Configures rewrites routing `/api/*` to the serverless function and sets `maxDuration: 60s`.
- **`api/index.js`**: Seamless serverless bridge exporting the Express application.
- **`public/`**: Static UI files (`index.html`, `style.css`, `app.js`, etc.) served directly at the root by Vercel's global CDN Edge network.
- **`.vercelignore`**: Prevents unnecessary files and dependencies from being uploaded.

---

## 📖 User Flow & Walkthrough

1. **Paste Link**: Paste any YouTube URL (`youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`, `embed`, or plain video ID) or click the **Paste** button.
2. **Fetch Formats**: The server extracts metadata in under 200ms and returns all available stream qualities.
3. **Choose Format**:
   - **Audio Formats Tab**: Download M4A, AAC, or Opus audio files directly or preview them.
   - **Video Formats Tab**: Download Combined (Audio+Video) or High-Definition video streams up to 8K 60fps.
   - **Client-Side Trimmer Tab**: Adjust start and end sliders to trim audio in browser RAM and export as **MP3 (320k/256k/192k/128k)**, **WAV**, **WebM Opus**, or **M4A**.
4. **Instant Stream Download**: The browser download manager receives the file stream directly into the user's Downloads directory.

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
  "timestamp": "2026-10-20T13:24:00.323Z",
  "inMemoryOnly": true,
  "localFileSystemUsage": "strictly_zero",
  "cacheSize": 2
}
```

### 2. Video Metadata
```http
GET /api/info?url=<YOUTUBE_URL_OR_ID>
```
**Response Fields:**
- `videoId`: 11-character YouTube video ID
- `title`: Video title
- `author`: Channel name
- `duration`: Formatted duration (`mm:ss` or `hh:mm:ss`)
- `durationSeconds`: Total duration in seconds
- `viewCount`: Formatted view count
- `thumbnail`: High-resolution thumbnail URL
- `audioFormats`: List of available audio formats with bitrate, codec, size estimate, and itag
- `progressiveFormats`: Combined audio + video formats
- `videoFormats`: Adaptive video streams up to 8K 60FPS

### 3. In-Memory Media Stream
```http
GET /api/stream?videoId=<VIDEO_ID>&itag=<ITAG>&download=1&filename=<OPTIONAL_FILENAME>
```
**Parameters:**
- `videoId` (required): YouTube video ID
- `itag` (required): Format itag number
- `download` (optional): `1` to attach `Content-Disposition: attachment`
- `filename` (optional): Custom file name (sanitized automatically)

**Headers Supported:**
- `Range: bytes=start-end` -> Returns `206 Partial Content` with `Content-Range` for smooth media seeking and resumed downloads.

---

## 🛡️ Zero-Disk Compliance Verification

| Requirement | Implementation Detail | Status |
| :--- | :--- | :---: |
| **No Local File System Usage** | No `fs.writeFile`, no disk-based caching, pure stream proxying. | Verified ✅ |
| **No Local Process Execution** | No ffmpeg subprocesses, no CLI child processes. | Verified ✅ |
| **In-Memory Streaming** | `Readable.fromWeb(webStream).pipe(res)` direct memory transfer. | Verified ✅ |
| **Client-Side Multi-Format Trimming** | Web Audio API + In-Memory LAME MP3 / WAV / WebM / M4A Blobs in browser RAM. | Verified ✅ |
| **UX & Professional UI** | Dark/Light mode, responsive glassmorphic cards, preview players, history. | Verified ✅ |
