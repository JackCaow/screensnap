/**
 * ScreenSnap GIF Region Selector & Recording Controller
 * Allows users to select a region and record it as an animated GIF
 */

(() => {
  if (window.__screenSnapGifActive) return;
  window.__screenSnapGifActive = true;

  const MAX_DURATION = 15; // seconds
  let recording = false;
  let countdown = 0;
  let countdownTimer = null;
  let selectionRect = { x: 0, y: 0, width: 0, height: 0 };

  const overlay = document.createElement('div');
  overlay.id = 'screensnap-gif-overlay';
  overlay.innerHTML = `
    <style>
      #screensnap-gif-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2147483647;
        cursor: crosshair;
        user-select: none;
      }
      #screensnap-gif-selection {
        position: absolute;
        border: 2px solid #ef4444;
        background: transparent;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
        cursor: move;
      }
      #screensnap-gif-selection.recording {
        border-color: #ef4444;
        animation: gif-pulse 1s ease-in-out infinite;
      }
      @keyframes gif-pulse {
        0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5); }
        50% { border-color: #ff6b6b; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.3); }
      }
      .gif-resize-handle {
        position: absolute;
        width: 10px; height: 10px;
        background: #ef4444;
        border: 2px solid white;
        border-radius: 2px;
      }
      .gif-resize-handle.nw { top: -5px; left: -5px; cursor: nw-resize; }
      .gif-resize-handle.ne { top: -5px; right: -5px; cursor: ne-resize; }
      .gif-resize-handle.sw { bottom: -5px; left: -5px; cursor: sw-resize; }
      .gif-resize-handle.se { bottom: -5px; right: -5px; cursor: se-resize; }
      #screensnap-gif-size {
        position: absolute;
        background: #ef4444;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }
      #screensnap-gif-toolbar {
        position: absolute;
        display: flex;
        gap: 8px;
        align-items: center;
        background: #1e293b;
        padding: 8px 12px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transform: translateX(-50%);
      }
      #screensnap-gif-toolbar button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #screensnap-gif-toolbar .record-btn {
        background: #ef4444;
        color: white;
      }
      #screensnap-gif-toolbar .record-btn:hover { background: #dc2626; }
      #screensnap-gif-toolbar .record-btn.recording {
        background: #dc2626;
        animation: rec-blink 1s ease-in-out infinite;
      }
      @keyframes rec-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      #screensnap-gif-toolbar .cancel-btn {
        background: #475569;
        color: white;
      }
      #screensnap-gif-toolbar .cancel-btn:hover { background: #64748b; }
      .gif-timer {
        color: white;
        font-family: 'SF Mono', monospace;
        font-size: 14px;
        min-width: 36px;
        text-align: center;
      }
      .gif-rec-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #ef4444;
        display: inline-block;
      }
      #screensnap-gif-hint {
        position: fixed;
        top: 20px; left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
    </style>
    <div id="screensnap-gif-hint">${chrome.i18n.getMessage('gif_selectHint') || 'Drag to select recording area'}</div>
  `;

  document.body.appendChild(overlay);

  let mode = 'idle';
  let startX = 0, startY = 0;
  let dragOffsetX = 0, dragOffsetY = 0;
  let resizeDirection = '';
  let selection = null;
  let sizeLabel = null;
  let toolbar = null;
  let originalRect = { x: 0, y: 0, width: 0, height: 0 };

  function createSelection() {
    selection = document.createElement('div');
    selection.id = 'screensnap-gif-selection';
    ['nw', 'ne', 'sw', 'se'].forEach(dir => {
      const handle = document.createElement('div');
      handle.className = `gif-resize-handle ${dir}`;
      handle.dataset.direction = dir;
      selection.appendChild(handle);
    });
    overlay.appendChild(selection);
    sizeLabel = document.createElement('div');
    sizeLabel.id = 'screensnap-gif-size';
    overlay.appendChild(sizeLabel);
  }

  function updateSelection(x, y, w, h) {
    if (!selection) return;
    let left = w < 0 ? x + w : x;
    let top = h < 0 ? y + h : y;
    w = Math.abs(w);
    h = Math.abs(h);
    left = Math.max(0, Math.min(left, window.innerWidth - w));
    top = Math.max(0, Math.min(top, window.innerHeight - h));
    selection.style.left = left + 'px';
    selection.style.top = top + 'px';
    selection.style.width = w + 'px';
    selection.style.height = h + 'px';
    selectionRect = { x: left, y: top, width: w, height: h };
    sizeLabel.textContent = `${Math.round(w)} × ${Math.round(h)}`;
    sizeLabel.style.left = left + 'px';
    sizeLabel.style.top = (top < 35 ? top + h + 8 : top - 30) + 'px';
  }

  function showToolbar() {
    if (toolbar) return;
    const hint = document.getElementById('screensnap-gif-hint');
    if (hint) hint.remove();

    toolbar = document.createElement('div');
    toolbar.id = 'screensnap-gif-toolbar';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = chrome.i18n.getMessage('selector_cancel') || 'Cancel';
    cancelBtn.addEventListener('click', cleanup);

    const recordBtn = document.createElement('button');
    recordBtn.className = 'record-btn';
    recordBtn.innerHTML = `<span class="gif-rec-dot"></span> ${chrome.i18n.getMessage('gif_record') || 'Record'}`;
    recordBtn.addEventListener('click', toggleRecording);

    const timer = document.createElement('span');
    timer.className = 'gif-timer';
    timer.id = 'gif-timer';
    timer.textContent = '0s';

    toolbar.appendChild(cancelBtn);
    toolbar.appendChild(recordBtn);
    toolbar.appendChild(timer);

    const toolbarLeft = selectionRect.x + selectionRect.width / 2;
    let toolbarTop = selectionRect.y + selectionRect.height + 12;
    if (toolbarTop + 50 > window.innerHeight) {
      toolbarTop = selectionRect.y - 50;
    }
    toolbar.style.left = toolbarLeft + 'px';
    toolbar.style.top = toolbarTop + 'px';
    overlay.appendChild(toolbar);
  }

  function hideToolbar() {
    if (toolbar) { toolbar.remove(); toolbar = null; }
  }

  function toggleRecording() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function startRecording() {
    recording = true;
    countdown = 0;
    if (selection) selection.classList.add('recording');

    // Hide resize handles during recording
    selection.querySelectorAll('.gif-resize-handle').forEach(h => h.style.display = 'none');

    // Make overlay click-through except toolbar
    overlay.style.pointerEvents = 'none';
    if (toolbar) toolbar.style.pointerEvents = 'auto';

    const recordBtn = toolbar.querySelector('.record-btn');
    recordBtn.classList.add('recording');
    recordBtn.innerHTML = `<span class="gif-rec-dot"></span> ${chrome.i18n.getMessage('gif_stop') || 'Stop'}`;

    const dpr = window.devicePixelRatio || 1;
    chrome.runtime.sendMessage({
      type: 'START_GIF_RECORDING',
      region: {
        x: Math.round(selectionRect.x * dpr),
        y: Math.round(selectionRect.y * dpr),
        width: Math.round(selectionRect.width * dpr),
        height: Math.round(selectionRect.height * dpr)
      },
      maxDuration: MAX_DURATION
    });

    countdownTimer = setInterval(() => {
      countdown++;
      const timerEl = document.getElementById('gif-timer');
      if (timerEl) timerEl.textContent = countdown + 's';
      if (countdown >= MAX_DURATION) {
        stopRecording();
      }
    }, 1000);
  }

  function stopRecording() {
    recording = false;
    clearInterval(countdownTimer);
    chrome.runtime.sendMessage({ type: 'STOP_GIF_RECORDING' });
    cleanup();
  }

  function cleanup() {
    if (recording) {
      chrome.runtime.sendMessage({ type: 'STOP_GIF_RECORDING' });
    }
    clearInterval(countdownTimer);
    overlay.remove();
    window.__screenSnapGifActive = false;
  }

  function isInsideSelection(x, y) {
    return x >= selectionRect.x && x <= selectionRect.x + selectionRect.width &&
           y >= selectionRect.y && y <= selectionRect.y + selectionRect.height;
  }

  function getResizeDirection(e) {
    const handle = e.target.closest('.gif-resize-handle');
    return handle ? handle.dataset.direction : '';
  }

  overlay.addEventListener('mousedown', (e) => {
    if (recording) return;
    if (e.target.closest('#screensnap-gif-toolbar')) return;

    const x = e.clientX, y = e.clientY;
    const resizeDir = getResizeDirection(e);
    if (resizeDir && selection) {
      mode = 'resizing';
      resizeDirection = resizeDir;
      originalRect = { ...selectionRect };
      startX = x; startY = y;
      hideToolbar();
      return;
    }
    if (selection && isInsideSelection(x, y)) {
      mode = 'moving';
      dragOffsetX = x - selectionRect.x;
      dragOffsetY = y - selectionRect.y;
      hideToolbar();
      return;
    }
    hideToolbar();
    if (selection) { selection.remove(); selection = null; }
    if (sizeLabel) { sizeLabel.remove(); sizeLabel = null; }
    mode = 'selecting';
    startX = x; startY = y;
    createSelection();
  });

  overlay.addEventListener('mousemove', (e) => {
    if (recording) return;
    const x = e.clientX, y = e.clientY;
    if (mode === 'selecting') {
      updateSelection(startX, startY, x - startX, y - startY);
    } else if (mode === 'moving') {
      updateSelection(x - dragOffsetX, y - dragOffsetY, selectionRect.width, selectionRect.height);
    } else if (mode === 'resizing') {
      const dx = x - startX, dy = y - startY;
      let nx = originalRect.x, ny = originalRect.y, nw = originalRect.width, nh = originalRect.height;
      if (resizeDirection.includes('w')) { nx += dx; nw -= dx; }
      if (resizeDirection.includes('e')) { nw += dx; }
      if (resizeDirection.includes('n')) { ny += dy; nh -= dy; }
      if (resizeDirection.includes('s')) { nh += dy; }
      if (nw < 40) { if (resizeDirection.includes('w')) nx = originalRect.x + originalRect.width - 40; nw = 40; }
      if (nh < 40) { if (resizeDirection.includes('n')) ny = originalRect.y + originalRect.height - 40; nh = 40; }
      updateSelection(nx, ny, nw, nh);
    } else if (selection) {
      overlay.style.cursor = isInsideSelection(x, y) ? 'move' : 'crosshair';
    }
  });

  overlay.addEventListener('mouseup', () => {
    if (recording) return;
    if (mode === 'selecting' || mode === 'moving' || mode === 'resizing') {
      if (selectionRect.width > 30 && selectionRect.height > 30) {
        showToolbar();
      }
    }
    mode = 'idle';
    overlay.style.cursor = 'crosshair';
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
    if (e.key === 'Enter' && recording) {
      stopRecording();
    }
  });
})();
