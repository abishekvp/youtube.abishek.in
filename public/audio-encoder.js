import { Mp3Encoder } from './lame.js';

/**
 * In-Memory Client-Side AudioBuffer to WAV Blob Converter
 * 100% Client-side browser runtime memory.
 * Strictly ZERO filesystem interaction or external processes.
 */
export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM (uncompressed)
  const bitDepth = 16;

  let result;
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }

  return encodeWAV(result, format, sampleRate, numChannels, bitDepth);
}

/**
 * In-Memory Client-Side AudioBuffer to MP3 Blob Converter
 * Uses LAME MP3 Engine running in browser JavaScript RAM.
 * Supports 128, 192, 256, 320 kbps.
 */
export function audioBufferToMp3(buffer, kbps = 320) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const mp3encoder = new Mp3Encoder(numChannels, sampleRate, kbps);

  // Convert float32 [-1.0, 1.0] to int16 [-32768, 32767]
  const left = floatTo16Bit(buffer.getChannelData(0));
  const right = numChannels > 1 ? floatTo16Bit(buffer.getChannelData(1)) : undefined;

  const mp3Data = [];
  const chunkSize = 1152; // standard LAME frame size

  for (let i = 0; i < left.length; i += chunkSize) {
    const leftChunk = left.subarray(i, i + chunkSize);
    const rightChunk = right ? right.subarray(i, i + chunkSize) : undefined;
    const mp3buf = numChannels > 1
      ? mp3encoder.encodeBuffer(leftChunk, rightChunk)
      : mp3encoder.encodeBuffer(leftChunk);

    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(endBuf);
  }

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

/**
 * In-Memory Client-Side AudioBuffer to WebM/Opus or M4A/AAC Blob using MediaRecorder
 */
export async function audioBufferToMediaBlob(audioContext, buffer, preferredMime = 'audio/webm') {
  // Test supported types
  let mimeType = preferredMime;
  if (preferredMime.includes('mp4') || preferredMime.includes('m4a')) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/aac')) {
      mimeType = 'audio/aac';
    } else {
      // Fallback to high quality MP3
      return audioBufferToMp3(buffer, 320);
    }
  } else if (preferredMime.includes('webm') || preferredMime.includes('opus')) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else {
      return audioBufferToMp3(buffer, 320);
    }
  }

  const dest = audioContext.createMediaStreamDestination();
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(dest);

  const chunks = [];
  const recorder = new MediaRecorder(dest.stream, { mimeType });

  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = (err) => reject(err);

    recorder.start();
    source.start();
    source.onended = () => {
      setTimeout(() => recorder.stop(), 50);
    };
  });
}

function floatTo16Bit(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

function encodeWAV(samples, format, sampleRate, numChannels, bitDepth) {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * bytesPerSample, true);

  // Write PCM samples (16-bit clamped)
  floatTo16BitPCM(view, 44, samples);

  return new Blob([buffer], { type: 'audio/wav' });
}

function interleave(inputL, inputR) {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);

  let index = 0;
  let inputIndex = 0;

  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
