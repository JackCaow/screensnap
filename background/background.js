/**
 * ScreenSnap Background Service Worker
 * Handles screenshot capture logic
 */

const CAPTURE_DELAY = 600;
const MAX_RETRIES = 5;
const RETRY_DELAY = 1500;

// 长截屏限制配置
const FULL_PAGE_CONFIG = {
  MAX_SCROLLS: 80,
  MAX_TOTAL_HEIGHT: 50000,
  STABLE_HEIGHT_CHECK_COUNT: 3,
  SCROLL_WAIT_TIME: 500,
  // 每帧与上一帧重叠的像素数，用于裁掉 sticky/fixed 头部。
  // 只要大于页面上最高的 sticky 元素即可（Google 搜索栏约 60px）。
  OVERLAP: 160
};

// Generate unique screenshot ID
function generateScreenshotId() {
  return 'ss_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return;

  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }

  switch (command) {
    case 'capture-region':
      await startRegionSelect();
      break;
    case 'capture-visible': {
      const visibleResult = await captureVisibleTab();
      if (visibleResult.success) {
        const id = generateScreenshotId();
        await chrome.storage.local.set({ [id]: visibleResult.dataUrl });
        chrome.tabs.create({ url: chrome.runtime.getURL('preview/preview.html') + '?id=' + id });
      }
      break;
    }
    case 'capture-fullpage': {
      const fullResult = await captureFullPage();
      if (fullResult.success) {
        const id = generateScreenshotId();
        await chrome.storage.local.set({ [id]: fullResult.dataUrl });
        chrome.tabs.create({ url: chrome.runtime.getURL('preview/preview.html') + '?id=' + id });
      }
      break;
    }
  }
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
      return { success: false, error: '无法获取当前标签页' };
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { success: false, error: '无法截取浏览器内部页面' };
    }

    const dataUrl = await captureWithRetry();

    return { success: true, dataUrl };
  } catch (error) {
    console.error('Capture visible tab error:', error);
    return { success: false, error: error.message || '截图失败' };
  }
}

// ==================== Full Page Capture ====================

async function captureFullPage() {
  let tab = null;

  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return { success: false, error: '无法获取当前标签页' };
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { success: false, error: '无法截取浏览器内部页面' };
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
    return { success: false, error: error.message || '长截屏失败' };
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
    return { success: false, error: '无法获取页面信息' };
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

  // Best-effort: try to hide fixed/sticky elements (may fail on some sites)
  // The overlap-and-clip approach is the primary defense against duplicates.
  try {
    // We'll hide after first frame capture (see below)
  } catch (e) {}

  // Step 3: Scroll & capture loop
  const screenshots = [];
  let requestedScroll = 0;
  let scrollCount = 0;
  let stableAtBottomCount = 0;
  let isInfiniteScroll = false;

  chrome.runtime.sendMessage({
    type: 'CAPTURE_STATUS',
    status: 'scanning',
    message: '正在截取页面...'
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
    message: '正在合并截图...'
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

// ==================== Region Capture ====================

async function startRegionSelect() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return { success: false, error: '无法获取当前标签页' };
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { success: false, error: '无法截取浏览器内部页面' };
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/selector.js']
    });

    return { success: true };
  } catch (error) {
    console.error('Start region select error:', error);
    return { success: false, error: error.message || '启动区域选择失败' };
  }
}

async function captureRegion(region) {
  try {
    const dataUrl = await captureWithRetry();

    const croppedDataUrl = await cropImage(dataUrl, region);

    const id = generateScreenshotId();
    await chrome.storage.local.set({ [id]: croppedDataUrl });

    chrome.tabs.create({
      url: chrome.runtime.getURL('preview/preview.html') + '?id=' + id
    });

    return { success: true };
  } catch (error) {
    console.error('Capture region error:', error);
    return { success: false, error: error.message || '区域截图失败' };
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
