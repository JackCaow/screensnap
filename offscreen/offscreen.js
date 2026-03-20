/**
 * ScreenSnap Offscreen Document
 * Handles video recording via MediaRecorder using tab capture stream.
 * Runs in an offscreen document because service workers cannot access getUserMedia.
 */

let mediaRecorder = null;
let recordedChunks = [];
let sourceStream = null;
let cropStream = null;
let cropAnimFrame = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OFFSCREEN_START_RECORDING') {
    startRecording(msg.streamId, msg.region, msg.tabWidth, msg.tabHeight)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (msg.type === 'OFFSCREEN_STOP_RECORDING') {
    stopRecording()
      .then(dataUrl => sendResponse({ success: true, dataUrl }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function startRecording(streamId, region, tabWidth, tabHeight) {
  // Get the tab's media stream
  sourceStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  });

  let streamToRecord = sourceStream;

  // If a region is specified, crop via canvas
  if (region) {
    const video = document.getElementById('sourceVideo');
    video.srcObject = sourceStream;
    await video.play();

    const canvas = document.getElementById('cropCanvas');
    canvas.width = region.width;
    canvas.height = region.height;
    const ctx = canvas.getContext('2d');

    // Draw cropped region at ~30fps
    function drawFrame() {
      if (!sourceStream || !sourceStream.active) return;
      ctx.drawImage(
        video,
        region.x, region.y, region.width, region.height,
        0, 0, region.width, region.height
      );
      cropAnimFrame = requestAnimationFrame(drawFrame);
    }
    drawFrame();

    cropStream = canvas.captureStream(30);
    streamToRecord = cropStream;
  }

  recordedChunks = [];

  // Prefer VP9 for better quality, fall back to VP8
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm;codecs=vp8';

  mediaRecorder = new MediaRecorder(streamToRecord, {
    mimeType,
    videoBitsPerSecond: 5_000_000 // 5 Mbps for high quality
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.start(1000); // Collect data every 1s
}

function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      cleanup();
      reject(new Error('No active recording'));
      return;
    }

    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
        const dataUrl = await blobToDataUrl(blob);
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    mediaRecorder.stop();
  });
}

function cleanup() {
  if (cropAnimFrame) {
    cancelAnimationFrame(cropAnimFrame);
    cropAnimFrame = null;
  }
  if (sourceStream) {
    sourceStream.getTracks().forEach(t => t.stop());
    sourceStream = null;
  }
  if (cropStream) {
    cropStream.getTracks().forEach(t => t.stop());
    cropStream = null;
  }
  const video = document.getElementById('sourceVideo');
  if (video) {
    video.srcObject = null;
    video.pause();
  }
  mediaRecorder = null;
  recordedChunks = [];
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
