/**
 * ScreenSnap Background Service Worker
 * Handles screenshot capture logic
 */

const CAPTURE_DELAY = 600;
const MAX_RETRIES = 5;
const RETRY_DELAY = 1500;

// Full-page capture configuration
const FULL_PAGE_CONFIG = {
  MAX_SCROLLS: 80,
  MAX_TOTAL_HEIGHT: 50000,
  STABLE_HEIGHT_CHECK_COUNT: 3,
  SCROLL_WAIT_TIME: 500,
  // Overlap pixels between consecutive frames. Used to clip away
  // sticky/fixed headers (e.g. Google search bar ~60px).
  OVERLAP: 160
};

// Generate unique screenshot ID
function generateScreenshotId() {
  return 'ss_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

// ==================== History / Metadata ====================

const MAX_HISTORY = 50;
const THUMB_MAX_WIDTH = 200;

// Simple async mutex to prevent concurrent index writes
let _indexLock = Promise.resolve();
function withIndexLock(fn) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const prev = _indexLock;
  _indexLock = gate;
  return prev.then(fn).finally(release);
}

async function generateThumbnail(dataUrl) {
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(THUMB_MAX_WIDTH / img.width, 1);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
    return { thumbDataUrl: await blobToDataUrl(blob), width: img.width, height: img.height };
  } catch (e) {
    console.warn('Thumbnail generation failed:', e);
    return { thumbDataUrl: null, width: 0, height: 0 };
  }
}

function saveCaptureWithMetadata(id, dataUrl, type) {
  return withIndexLock(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    const { thumbDataUrl, width, height } = await generateThumbnail(dataUrl);

  const meta = {
    id,
    timestamp: Date.now(),
    url: tab?.url || '',
    title: tab?.title || '',
    type,
    width,
    height,
    thumbnailId: id + '_thumb'
  };

  // Save data + thumbnail + update index in one batch
  const store = { [id]: dataUrl };
  if (thumbDataUrl) store[id + '_thumb'] = thumbDataUrl;

  const result = await chrome.storage.local.get('ss_index');
  const index = result.ss_index || [];
  index.unshift(meta);

  // Cleanup old entries beyond MAX_HISTORY
  const removed = index.splice(MAX_HISTORY);
  store.ss_index = index;

  await chrome.storage.local.set(store);

  // Remove data for old entries
  if (removed.length > 0) {
    const keysToRemove = [];
    for (const item of removed) {
      keysToRemove.push(item.id, item.id + '_thumb', item.id + '_annotations');
    }
    await chrome.storage.local.remove(keysToRemove);
  }
  });
}

// Shared: capture and open preview
async function captureAndOpenPreview(type) {
  let result;
  if (type === 'capture-region') {
    await startRegionSelect();
    return;
  } else if (type === 'capture-gif') {
    await startGifSelect();
    return;
  } else if (type === 'capture-visible') {
    result = await captureVisibleTab();
  } else if (type === 'capture-fullpage') {
    result = await captureFullPage();
  }
  if (result && result.success) {
    const id = generateScreenshotId();
    const captureType = type.replace('capture-', '');
    await saveCaptureWithMetadata(id, result.dataUrl, captureType);
    chrome.tabs.create({ url: chrome.runtime.getURL('preview/preview.html') + '?id=' + id });
  }
}

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  await captureAndOpenPreview(command);
});

// Right-click context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'capture-region',
    title: chrome.i18n.getMessage('cmd_captureRegion'),
    contexts: ['page', 'image', 'selection']
  });
  chrome.contextMenus.create({
    id: 'capture-visible',
    title: chrome.i18n.getMessage('cmd_captureVisible'),
    contexts: ['page', 'image', 'selection']
  });
  chrome.contextMenus.create({
    id: 'capture-fullpage',
    title: chrome.i18n.getMessage('cmd_captureFullpage'),
    contexts: ['page', 'image', 'selection']
  });
  chrome.contextMenus.create({
    id: 'capture-gif',
    title: chrome.i18n.getMessage('cmd_captureGif'),
    contexts: ['page', 'image', 'selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  await captureAndOpenPreview(info.menuItemId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_VISIBLE') {
    captureVisibleTab().then(sendResponse);
    return true;
  }

  if (message.type === 'CAPTURE_FULL_PAGE') {
    captureFullPage().then(sendResponse);
    return true;
  }

  if (message.type === 'CAPTURE_REGION') {
    captureRegion(message.region).then(sendResponse);
    return true;
  }

  if (message.type === 'START_REGION_SELECT') {
    startRegionSelect().then(sendResponse);
    return true;
  }

  if (message.type === 'SAVE_AND_OPEN_PREVIEW') {
    (async () => {
      const id = generateScreenshotId();
      await saveCaptureWithMetadata(id, message.dataUrl, message.captureType || 'visible');
      chrome.tabs.create({
        url: chrome.runtime.getURL('preview/preview.html') + '?id=' + id
      });
      sendResponse({ success: true, id });
    })();
    return true;
  }

  if (message.type === 'START_GIF_SELECT') {
    startGifSelect().then(sendResponse);
    return true;
  }

  if (message.type === 'START_GIF_RECORDING') {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await startGifRecording(message.region, tab.id);
      }
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.type === 'STOP_GIF_RECORDING') {
    stopGifRecording();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SAVE_GIF') {
    (async () => {
      const id = message.id || generateScreenshotId();
      await saveCaptureWithMetadata(id, message.dataUrl, 'gif');
      sendResponse({ success: true, id });
    })();
    return true;
  }

  if (message.type === 'DELETE_SCREENSHOT') {
    const id = message.id;
    // Validate ID to prevent deletion of non-screenshot keys
    if (typeof id !== 'string' || !id.startsWith('ss_') || id === 'ss_index') {
      sendResponse({ success: false, error: 'Invalid screenshot ID' });
      return true;
    }
    withIndexLock(async () => {
      const result = await chrome.storage.local.get('ss_index');
      const index = (result.ss_index || []).filter(s => s.id !== id);
      await chrome.storage.local.set({ ss_index: index });
      await chrome.storage.local.remove([id, id + '_thumb', id + '_annotations']);
    }).then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function captureWithRetry(retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 100
      });
      return dataUrl;
    } catch (error) {
      const isRateLimitError = error.message?.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND');
      const isPermissionError = error.message?.includes('activeTab') || error.message?.includes('permission');

      if ((isRateLimitError || isPermissionError) && attempt < retries - 1) {
        const delay = isPermissionError ? RETRY_DELAY * 2 : RETRY_DELAY;
        console.warn(`Capture error (${isPermissionError ? 'permission' : 'rate limit'}), retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
}

// Keep service worker alive during long-running capture operations.
let keepAliveTimer = null;
function startKeepAlive() {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);
}
function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

async function captureVisibleTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return { success: false, error: chrome.i18n.getMessage('error_noTab') };
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { success: false, error: chrome.i18n.getMessage('error_internalPage') };
    }

    const dataUrl = await captureWithRetry();

    return { success: true, dataUrl };
  } catch (error) {
    console.error('Capture visible tab error:', error);
    return { success: false, error: error.message || chrome.i18n.getMessage('error_captureFailed') };
  }
}

// ==================== Full Page Capture ====================

async function captureFullPage() {
  let tab = null;

  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return { success: false, error: chrome.i18n.getMessage('error_noTab') };
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { success: false, error: chrome.i18n.getMessage('error_internalPage') };
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    });

    startKeepAlive();
    const result = await captureFullPageImpl(tab);
    return result;

  } catch (error) {
    console.error('Capture full page error:', error);
    return { success: false, error: error.message || chrome.i18n.getMessage('error_fullpageFailed') };
  } finally {
    stopKeepAlive();
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_CAPTURE' });
      } catch (e) {
        // Content script might not be available
      }
    }
  }
}

async function captureFullPageImpl(tab) {
  // Step 1: Get page info
  const pageInfo = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
  if (!pageInfo) {
    return { success: false, error: chrome.i18n.getMessage('error_noPageInfo') };
  }

  const { viewportHeight, viewportWidth, devicePixelRatio } = pageInfo;
  let knownScrollHeight = pageInfo.scrollHeight;

  // The step each scroll advances. We intentionally scroll LESS than a full
  // viewport so consecutive frames overlap by OVERLAP pixels. The merge step
  // clips the overlapping top portion of each subsequent frame — this is where
  // sticky/fixed headers (e.g. Google search bar) live, so they are
  // automatically excluded without needing to detect or hide them.
  const overlap = Math.min(FULL_PAGE_CONFIG.OVERLAP, Math.floor(viewportHeight / 2));
  const scrollStep = viewportHeight - overlap;

  // Step 2: Prepare (disable smooth scroll)
  await chrome.tabs.sendMessage(tab.id, { type: 'PREPARE_CAPTURE' });

  // Step 3: Scroll & capture loop
  const screenshots = [];
  let requestedScroll = 0;
  let scrollCount = 0;
  let stableAtBottomCount = 0;
  let isInfiniteScroll = false;

  chrome.runtime.sendMessage({
    type: 'CAPTURE_STATUS',
    status: 'scanning',
    message: chrome.i18n.getMessage('status_capturing')
  }).catch(() => {});

  while (scrollCount < FULL_PAGE_CONFIG.MAX_SCROLLS) {
    // Scroll to requested position
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SCROLL_TO',
      position: requestedScroll
    });

    // Wait for scroll and content to settle
    await new Promise(resolve => setTimeout(resolve, FULL_PAGE_CONFIG.SCROLL_WAIT_TIME));

    // Get ACTUAL scroll position (browser clamps to max)
    const scrollInfo = await chrome.tabs.sendMessage(tab.id, { type: 'GET_ACTUAL_SCROLL' });
    const actualScrollY = scrollInfo.scrollY;
    const currentScrollHeight = scrollInfo.scrollHeight;

    // Rate limit delay between captures
    if (scrollCount > 0) {
      await new Promise(resolve => setTimeout(resolve, CAPTURE_DELAY));
    }

    // Capture the viewport
    const dataUrl = await captureWithRetry();

    screenshots.push({
      dataUrl,
      actualScrollY
    });

    // After first capture, best-effort hide fixed/sticky elements.
    // Even if this fails, the overlap-clip approach handles it.
    if (scrollCount === 0) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'HIDE_FIXED' });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn('Failed to hide fixed elements:', e);
      }
    }

    scrollCount++;

    // Send progress
    const estimatedProgress = Math.min(
      ((actualScrollY + viewportHeight) / currentScrollHeight) * 100,
      99
    );
    chrome.runtime.sendMessage({
      type: 'CAPTURE_PROGRESS',
      progress: Math.round(estimatedProgress),
      info: {
        scrollCount,
        currentHeight: actualScrollY + viewportHeight,
        detectedHeight: currentScrollHeight
      }
    }).catch(() => {});

    // Check: have we reached the bottom of current known content?
    const atBottom = actualScrollY + viewportHeight >= currentScrollHeight - 1;

    if (atBottom) {
      if (currentScrollHeight > knownScrollHeight + 10) {
        // Page grew (infinite scroll detected) — keep going
        isInfiniteScroll = true;
        knownScrollHeight = currentScrollHeight;
        stableAtBottomCount = 0;
        requestedScroll = actualScrollY + scrollStep;
      } else if (isInfiniteScroll) {
        stableAtBottomCount++;
        if (stableAtBottomCount >= FULL_PAGE_CONFIG.STABLE_HEIGHT_CHECK_COUNT) {
          break;
        }
      } else {
        // Static page, reached true bottom — done
        break;
      }
    } else {
      stableAtBottomCount = 0;
      requestedScroll = actualScrollY + scrollStep;
      knownScrollHeight = Math.max(knownScrollHeight, currentScrollHeight);
    }

    // Safety: max height
    if (actualScrollY + viewportHeight >= FULL_PAGE_CONFIG.MAX_TOTAL_HEIGHT) {
      break;
    }
  }

  // Step 4: Determine final height and merge
  chrome.runtime.sendMessage({
    type: 'CAPTURE_STATUS',
    status: 'merging',
    message: chrome.i18n.getMessage('status_merging')
  }).catch(() => {});

  const finalInfo = await chrome.tabs.sendMessage(tab.id, { type: 'GET_ACTUAL_SCROLL' });
  const finalScrollHeight = finalInfo.scrollHeight;

  const mergedDataUrl = await mergeScreenshots(
    screenshots,
    viewportWidth,
    viewportHeight,
    finalScrollHeight,
    devicePixelRatio
  );

  return { success: true, dataUrl: mergedDataUrl };
}

/**
 * Merge screenshots into a single image.
 *
 * Each frame is captured at actualScrollY and covers viewportHeight pixels.
 * Because we scroll by (viewportHeight - OVERLAP), consecutive frames share
 * an overlapping strip of OVERLAP pixels at the top. We clip this overlap
 * from each subsequent frame so that sticky headers (which always render at
 * the top of each capture) are removed automatically.
 *
 * For the LAST frame (where the browser clamps scroll to scrollHeight - viewportHeight),
 * the overlap may be larger than OVERLAP — the same clipping logic handles it.
 */
async function mergeScreenshots(screenshots, viewportWidth, viewportHeight, totalHeight, dpr) {
  const canvasW = Math.round(viewportWidth * dpr);
  const canvasH = Math.round(totalHeight * dpr);
  const vpH = Math.round(viewportHeight * dpr);

  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < screenshots.length; i++) {
    const shot = screenshots[i];
    const img = await loadImage(shot.dataUrl);

    const destY = Math.round(shot.actualScrollY * dpr);

    if (i === 0) {
      // First screenshot: draw fully
      ctx.drawImage(img, 0, destY);
    } else {
      // Calculate how much this frame overlaps with the area already drawn.
      // "Already drawn" ends at prevBottom (the bottom edge of the previous frame).
      const prevShot = screenshots[i - 1];
      const prevBottom = Math.round((prevShot.actualScrollY + viewportHeight) * dpr);
      const overlapPx = Math.max(0, prevBottom - destY);

      if (overlapPx >= vpH) {
        // Entire frame is within previous frame's range — skip
        continue;
      }

      // Only draw the non-overlapping bottom portion of this capture.
      // Source: skip top overlapPx rows (sticky headers live here)
      // Dest:  start right after where previous frame ended
      const sourceY = overlapPx;
      const sourceH = vpH - overlapPx;
      const targetY = destY + overlapPx;

      ctx.drawImage(
        img,
        0, sourceY, canvasW, sourceH,
        0, targetY, canvasW, sourceH
      );
    }
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(blob);
}

async function loadImage(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ==================== GIF Recording ====================

let gifRecording = false;
let gifFrames = [];
let gifRegion = null;
let gifTabId = null;
let gifCaptureInterval = null;
const GIF_FPS = 8;
const GIF_MAX_FRAMES = 15 * GIF_FPS; // 15s max

async function startGifRecording(region, tabId) {
  gifRecording = true;
  gifFrames = [];
  gifRegion = region;
  gifTabId = tabId;
  startKeepAlive();

  const frameDelay = 1000 / GIF_FPS;

  gifCaptureInterval = setInterval(async () => {
    if (!gifRecording || gifFrames.length >= GIF_MAX_FRAMES) {
      stopGifRecording();
      return;
    }
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 100
      });
      // Crop to region
      const cropped = await cropImage(dataUrl, gifRegion);
      gifFrames.push(cropped);
    } catch (e) {
      // Skip frame on capture error (rate limit, etc.)
      console.warn('GIF frame capture skipped:', e.message);
    }
  }, frameDelay);
}

async function stopGifRecording() {
  gifRecording = false;
  if (gifCaptureInterval) {
    clearInterval(gifCaptureInterval);
    gifCaptureInterval = null;
  }
  stopKeepAlive();

  if (gifFrames.length < 2) {
    console.warn('GIF recording too short, discarded');
    gifFrames = [];
    return;
  }

  // Open GIF preview page with frame data at original resolution
  const id = generateScreenshotId();
  const gifData = {
    id,
    frames: gifFrames,
    width: gifRegion.width,
    height: gifRegion.height,
    fps: GIF_FPS,
    frameCount: gifFrames.length,
    duration: gifFrames.length / GIF_FPS
  };

  // Store frames temporarily for the preview page to pick up
  await chrome.storage.local.set({ _gif_pending: gifData });
  gifFrames = [];

  chrome.tabs.create({
    url: chrome.runtime.getURL('preview/preview.html') + '?gif=' + id
  });
}

// ==================== Region Capture ====================

async function startGifSelect() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return { success: false, error: chrome.i18n.getMessage('error_noTab') };
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { success: false, error: chrome.i18n.getMessage('error_internalPage') };
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/gif-selector.js']
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function startRegionSelect() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return { success: false, error: chrome.i18n.getMessage('error_noTab') };
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { success: false, error: chrome.i18n.getMessage('error_internalPage') };
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/selector.js']
    });

    return { success: true };
  } catch (error) {
    console.error('Start region select error:', error);
    return { success: false, error: error.message || chrome.i18n.getMessage('error_startRegionFailed') };
  }
}

async function captureRegion(region) {
  try {
    const dataUrl = await captureWithRetry();

    const croppedDataUrl = await cropImage(dataUrl, region);

    const id = generateScreenshotId();
    await saveCaptureWithMetadata(id, croppedDataUrl, 'region');

    chrome.tabs.create({
      url: chrome.runtime.getURL('preview/preview.html') + '?id=' + id
    });

    return { success: true };
  } catch (error) {
    console.error('Capture region error:', error);
    return { success: false, error: error.message || chrome.i18n.getMessage('error_regionFailed') };
  }
}

async function cropImage(dataUrl, region) {
  const img = await loadImage(dataUrl);

  const canvas = new OffscreenCanvas(region.width, region.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    img,
    region.x, region.y, region.width, region.height,
    0, 0, region.width, region.height
  );

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(blob);
}
