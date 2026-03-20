/**
 * ScreenSnap Video Region Selector & Recording Controller
 * Allows users to select a region (or full tab) and record WebM video
 */

(() => {
  if (window.__screenSnapVideoActive) return;
  window.__screenSnapVideoActive = true;

  const MAX_DURATION = 60; // seconds
  let recording = false;
  let countdown = 0;
  let countdownTimer = null;
  let selectionRect = null; // null = full tab

  const overlay = document.createElement('div');
  overlay.id = 'screensnap-video-overlay';
  overlay.innerHTML = `
    <style>
      #screensnap-video-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2147483647;
        cursor: crosshair;
        user-select: none;
      }
      #screensnap-video-selection {
        position: absolute;
        border: 2px solid #6366f1;
        background: transparent;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
        cursor: move;
      }
      #screensnap-video-selection.recording {
        border-color: #ef4444;
        animation: video-pulse 1s ease-in-out infinite;
      }
      @keyframes video-pulse {
        0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5); }
        50% { border-color: #ff6b6b; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.3); }
      }
      .video-resize-handle {
        position: absolute;
        width: 10px; height: 10px;
        background: #6366f1;
        border: 2px solid white;
        border-radius: 2px;
      }
      .video-resize-handle.nw { top: -5px; left: -5px; cursor: nw-resize; }
      .video-resize-handle.ne { top: -5px; right: -5px; cursor: ne-resize; }
      .video-resize-handle.sw { bottom: -5px; left: -5px; cursor: sw-resize; }
      .video-resize-handle.se { bottom: -5px; right: -5px; cursor: se-resize; }
      #screensnap-video-size {
        position: absolute;
        background: #6366f1;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        white-space: nowrap;
        pointer-events: none;
      }
      #screensnap-video-toolbar {
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
      #screensnap-video-toolbar button {
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
      #screensnap-video-toolbar .record-btn {
        background: #6366f1;
        color: white;
      }
      #screensnap-video-toolbar .record-btn:hover { background: #4f46e5; }
      #screensnap-video-toolbar .record-btn.recording {
        background: #ef4444;
        animation: rec-blink 1s ease-in-out infinite;
      }
      @keyframes rec-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      #screensnap-video-toolbar .cancel-btn {
        background: #475569;
        color: white;
      }
      #screensnap-video-toolbar .cancel-btn:hover { background: #64748b; }
      #screensnap-video-toolbar .fulltab-btn {
        background: #334155;
        color: white;
      }
      #screensnap-video-toolbar .fulltab-btn:hover { background: #475569; }
      .video-timer {
        color: white;
        font-family: 'SF Mono', monospace;
        font-size: 14px;
        min-width: 36px;
        text-align: center;
      }
      .video-rec-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #6366f1;
        display: inline-block;
      }
      .video-rec-dot.active { background: #ef4444; }
      #screensnap-video-hint {
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
      #screensnap-video-float-toolbar {
        position: fixed;
        bottom: 20px; left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        align-items: center;
        background: #1e293b;
        padding: 8px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 2147483647;
      }
    </style>
    <div id="screensnap-video-hint">${chrome.i18n.getMessage('video_selectHint') || 'Drag to select area, or click Record to capture full tab'}</div>
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

  // Show initial toolbar with "Record Full Tab" option
  showInitialToolbar();

  function showInitialToolbar() {
    const hint = document.getElementById('screensnap-video-hint');

    const initToolbar = document.createElement('div');
    initToolbar.id = 'screensnap-video-init-toolbar';
    initToolbar.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 8px; align-items: center;
      background: #1e293b; padding: 10px 16px; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 2147483647;
    `;

    const fulltabBtn = document.createElement('button');
    fulltabBtn.style.cssText = `
      padding: 8px 16px; border: none; border-radius: 6px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      background: #6366f1; color: white; display: flex; align-items: center; gap: 6px;
    `;
    fulltabBtn.innerHTML = `<span class="video-rec-dot"></span> ${chrome.i18n.getMessage('video_recordFullTab') || 'Record Full Tab'}`;
    fulltabBtn.addEventListener('click', () => {
      initToolbar.remove();
      if (hint) hint.remove();
      startFullTabRecording();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = `
      padding: 8px 16px; border: none; border-radius: 6px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      background: #475569; color: white;
    `;
    cancelBtn.textContent = chrome.i18n.getMessage('selector_cancel') || 'Cancel';
    cancelBtn.addEventListener('click', cleanup);

    initToolbar.appendChild(cancelBtn);
    initToolbar.appendChild(fulltabBtn);
    overlay.appendChild(initToolbar);
  }

  function startFullTabRecording() {
    selectionRect = null; // null means full tab
    overlay.style.background = 'transparent';
    overlay.style.pointerEvents = 'none';

    // Create floating recording toolbar
    showRecordingToolbar();
    beginRecording();
  }

  function createSelection() {
    selection = document.createElement('div');
    selection.id = 'screensnap-video-selection';
    ['nw', 'ne', 'sw', 'se'].forEach(dir => {
      const handle = document.createElement('div');
      handle.className = `video-resize-handle ${dir}`;
      handle.dataset.direction = dir;
      selection.appendChild(handle);
    });
    overlay.appendChild(selection);
    sizeLabel = document.createElement('div');
    sizeLabel.id = 'screensnap-video-size';
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
    sizeLabel.textContent = `${Math.round(w)} \u00D7 ${Math.round(h)}`;
    sizeLabel.style.left = left + 'px';
    sizeLabel.style.top = (top < 35 ? top + h + 8 : top - 30) + 'px';
  }

  function showToolbar() {
    if (toolbar) return;
    const hint = document.getElementById('screensnap-video-hint');
    if (hint) hint.remove();
    const initToolbar = document.getElementById('screensnap-video-init-toolbar');
    if (initToolbar) initToolbar.remove();

    toolbar = document.createElement('div');
    toolbar.id = 'screensnap-video-toolbar';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.textContent = chrome.i18n.getMessage('selector_cancel') || 'Cancel';
    cancelBtn.addEventListener('click', cleanup);

    const recordBtn = document.createElement('button');
    recordBtn.className = 'record-btn';
    recordBtn.innerHTML = `<span class="video-rec-dot"></span> ${chrome.i18n.getMessage('video_record') || 'Record'}`;
    recordBtn.addEventListener('click', toggleRecording);

    const timer = document.createElement('span');
    timer.className = 'video-timer';
    timer.id = 'video-timer';
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

  function showRecordingToolbar() {
    // Floating toolbar at bottom center
    const floatToolbar = document.createElement('div');
    floatToolbar.id = 'screensnap-video-float-toolbar';
    floatToolbar.style.pointerEvents = 'auto';

    const stopBtn = document.createElement('button');
    stopBtn.style.cssText = `
      padding: 8px 16px; border: none; border-radius: 6px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      background: #ef4444; color: white; display: flex; align-items: center; gap: 6px;
      animation: rec-blink 1s ease-in-out infinite;
    `;
    stopBtn.innerHTML = `<span class="video-rec-dot active"></span> ${chrome.i18n.getMessage('video_stop') || 'Stop'}`;
    stopBtn.addEventListener('click', stopRecording);

    const timer = document.createElement('span');
    timer.style.cssText = `
      color: white; font-family: 'SF Mono', monospace;
      font-size: 14px; min-width: 36px; text-align: center;
    `;
    timer.id = 'video-timer';
    timer.textContent = '0s';

    floatToolbar.appendChild(stopBtn);
    floatToolbar.appendChild(timer);
    document.body.appendChild(floatToolbar);
    toolbar = floatToolbar;
  }

  function hideToolbar() {
    if (toolbar) { toolbar.remove(); toolbar = null; }
  }

  function toggleRecording() {
    if (recording) {
      stopRecording();
    } else {
      beginRecording();
    }
  }

  function beginRecording() {
    recording = true;
    countdown = 0;

    if (selection) {
      selection.classList.add('recording');
      selection.querySelectorAll('.video-resize-handle').forEach(h => h.style.display = 'none');
    }

    // Make overlay click-through except toolbar
    overlay.style.pointerEvents = 'none';
    if (toolbar) toolbar.style.pointerEvents = 'auto';

    const recordBtn = toolbar?.querySelector('.record-btn');
    if (recordBtn) {
      recordBtn.classList.add('recording');
      recordBtn.innerHTML = `<span class="video-rec-dot active"></span> ${chrome.i18n.getMessage('video_stop') || 'Stop'}`;
    }

    const dpr = window.devicePixelRatio || 1;
    const region = selectionRect ? {
      x: Math.round(selectionRect.x * dpr),
      y: Math.round(selectionRect.y * dpr),
      width: Math.round(selectionRect.width * dpr),
      height: Math.round(selectionRect.height * dpr)
    } : null;

    chrome.runtime.sendMessage({
      type: 'START_VIDEO_RECORDING',
      region
    });

    countdownTimer = setInterval(() => {
      countdown++;
      const timerEl = document.getElementById('video-timer');
      if (timerEl) {
        const m = Math.floor(countdown / 60);
        const s = countdown % 60;
        timerEl.textContent = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
      }
      if (countdown >= MAX_DURATION) {
        stopRecording();
      }
    }, 1000);
  }

  function stopRecording() {
    recording = false;
    clearInterval(countdownTimer);
    chrome.runtime.sendMessage({ type: 'STOP_VIDEO_RECORDING' });
    cleanup();
  }

  function cleanup() {
    if (recording) {
      chrome.runtime.sendMessage({ type: 'STOP_VIDEO_RECORDING' });
    }
    clearInterval(countdownTimer);
    overlay.remove();
    // Also remove floating toolbar if it was attached to body
    const floatBar = document.getElementById('screensnap-video-float-toolbar');
    if (floatBar) floatBar.remove();
    window.__screenSnapVideoActive = false;
  }

  function isInsideSelection(x, y) {
    if (!selectionRect) return false;
    return x >= selectionRect.x && x <= selectionRect.x + selectionRect.width &&
           y >= selectionRect.y && y <= selectionRect.y + selectionRect.height;
  }

  function getResizeDirection(e) {
    const handle = e.target.closest('.video-resize-handle');
    return handle ? handle.dataset.direction : '';
  }

  overlay.addEventListener('mousedown', (e) => {
    if (recording) return;
    if (e.target.closest('#screensnap-video-toolbar, #screensnap-video-init-toolbar, #screensnap-video-float-toolbar')) return;

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
    // Remove init toolbar when user starts dragging a region
    const initToolbar = document.getElementById('screensnap-video-init-toolbar');
    if (initToolbar) initToolbar.remove();

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
      if (selectionRect && selectionRect.width > 30 && selectionRect.height > 30) {
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
