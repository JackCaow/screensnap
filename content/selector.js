/**
 * ScreenSnap Region Selector
 * Allows users to select a specific region of the page to capture
 * Supports dragging to move and resize the selection
 *
 * Design: Living Canvas — organic green tones, soft radii, no harsh edges
 */

(() => {
  if (window.__screenSnapSelectorActive) return;
  window.__screenSnapSelectorActive = true;

  const overlay = document.createElement('div');
  overlay.id = 'screensnap-overlay';
  overlay.innerHTML = `
    <style>
      #screensnap-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: transparent;
        z-index: 2147483647;
        cursor: crosshair;
        user-select: none;
      }
      #screensnap-selection {
        position: absolute;
        border: 2px solid #8cb485;
        background: transparent;
        box-shadow: 0 0 0 9999px rgba(26, 33, 24, 0.55);
        cursor: move;
        border-radius: 4px;
      }
      #screensnap-selection.resizing {
        cursor: crosshair;
      }
      .resize-handle {
        position: absolute;
        width: 10px;
        height: 10px;
        background: #8cb485;
        border: 2px solid #e4ece1;
        border-radius: 3px;
      }
      .resize-handle.nw { top: -5px; left: -5px; cursor: nw-resize; }
      .resize-handle.ne { top: -5px; right: -5px; cursor: ne-resize; }
      .resize-handle.sw { bottom: -5px; left: -5px; cursor: sw-resize; }
      .resize-handle.se { bottom: -5px; right: -5px; cursor: se-resize; }
      .resize-handle.n { top: -5px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
      .resize-handle.s { bottom: -5px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
      .resize-handle.w { top: 50%; left: -5px; transform: translateY(-50%); cursor: w-resize; }
      .resize-handle.e { top: 50%; right: -5px; transform: translateY(-50%); cursor: e-resize; }
      #screensnap-size {
        position: absolute;
        background: rgba(42, 53, 40, 0.9);
        color: #e4ece1;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-family: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif;
        white-space: nowrap;
        pointer-events: none;
        backdrop-filter: blur(8px);
      }
      #screensnap-toolbar {
        position: absolute;
        display: flex;
        gap: 8px;
        background: rgba(42, 53, 40, 0.92);
        padding: 8px 12px;
        border-radius: 14px;
        box-shadow: 0 8px 24px rgba(10, 14, 9, 0.25);
        backdrop-filter: blur(12px);
      }
      #screensnap-toolbar button {
        padding: 8px 18px;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all cubic-bezier(0.4, 0, 0.2, 1) 200ms;
        font-family: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      #screensnap-toolbar .confirm {
        background: linear-gradient(145deg, #4d6547, #3d5339);
        color: #ffffff;
      }
      #screensnap-toolbar .confirm:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
      }
      #screensnap-toolbar .cancel {
        background: rgba(155, 170, 150, 0.15);
        color: #e4ece1;
      }
      #screensnap-toolbar .cancel:hover {
        background: rgba(155, 170, 150, 0.25);
      }
      #screensnap-hint {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(42, 53, 40, 0.92);
        color: #e4ece1;
        padding: 12px 24px;
        border-radius: 14px;
        font-size: 14px;
        font-family: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 8px 24px rgba(10, 14, 9, 0.25);
        backdrop-filter: blur(12px);
      }
    </style>
    <div id="screensnap-hint">${chrome.i18n.getMessage('selector_hint')}</div>
  `;

  document.body.appendChild(overlay);

  let mode = 'idle'; // idle, selecting, moving, resizing
  let startX = 0, startY = 0;
  let dragOffsetX = 0, dragOffsetY = 0;
  let resizeDirection = '';
  let selection = null;
  let sizeLabel = null;
  let toolbar = null;
  let selectionRect = { x: 0, y: 0, width: 0, height: 0 };
  let originalRect = { x: 0, y: 0, width: 0, height: 0 };

  function createSelection() {
    selection = document.createElement('div');
    selection.id = 'screensnap-selection';

    // Add resize handles
    const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
    handles.forEach(dir => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${dir}`;
      handle.dataset.direction = dir;
      selection.appendChild(handle);
    });

    overlay.appendChild(selection);

    sizeLabel = document.createElement('div');
    sizeLabel.id = 'screensnap-size';
    overlay.appendChild(sizeLabel);
  }

  function updateSelection(x, y, width, height) {
    if (!selection) return;

    // Normalize negative dimensions
    let left = width < 0 ? x + width : x;
    let top = height < 0 ? y + height : y;
    let w = Math.abs(width);
    let h = Math.abs(height);

    // Constrain to viewport
    left = Math.max(0, Math.min(left, window.innerWidth - w));
    top = Math.max(0, Math.min(top, window.innerHeight - h));

    selection.style.left = left + 'px';
    selection.style.top = top + 'px';
    selection.style.width = w + 'px';
    selection.style.height = h + 'px';

    selectionRect = { x: left, y: top, width: w, height: h };

    sizeLabel.textContent = `${Math.round(w)} \u00D7 ${Math.round(h)}`;
    sizeLabel.style.left = left + 'px';
    sizeLabel.style.top = (top - 30) + 'px';

    if (top < 35) {
      sizeLabel.style.top = (top + h + 8) + 'px';
    }
  }

  function updateToolbarPosition() {
    if (!toolbar) return;

    const toolbarTop = selectionRect.y + selectionRect.height + 12;
    const toolbarLeft = selectionRect.x + selectionRect.width / 2;

    toolbar.style.left = toolbarLeft + 'px';
    toolbar.style.top = toolbarTop + 'px';

    if (toolbarTop + 50 > window.innerHeight) {
      toolbar.style.top = (selectionRect.y - 50) + 'px';
    }
  }

  function showToolbar() {
    if (toolbar) return;

    const hint = document.getElementById('screensnap-hint');
    if (hint) hint.remove();

    toolbar = document.createElement('div');
    toolbar.id = 'screensnap-toolbar';
    toolbar.innerHTML = `
      <button class="cancel">${chrome.i18n.getMessage('selector_cancel')}</button>
      <button class="confirm">${chrome.i18n.getMessage('selector_confirm')}</button>
    `;

    updateToolbarPosition();
    toolbar.style.transform = 'translateX(-50%)';

    overlay.appendChild(toolbar);

    toolbar.querySelector('.confirm').addEventListener('click', confirmSelection);
    toolbar.querySelector('.cancel').addEventListener('click', cleanup);
  }

  function hideToolbar() {
    if (toolbar) {
      toolbar.remove();
      toolbar = null;
    }
  }

  function confirmSelection() {
    const rect = selectionRect;
    const dpr = window.devicePixelRatio || 1;

    overlay.remove();
    window.__screenSnapSelectorActive = false;

    requestAnimationFrame(() => {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'CAPTURE_REGION',
          region: {
            x: Math.round(rect.x * dpr),
            y: Math.round(rect.y * dpr),
            width: Math.round(rect.width * dpr),
            height: Math.round(rect.height * dpr)
          }
        });
      }, 100);
    });
  }

  function cleanup() {
    overlay.remove();
    window.__screenSnapSelectorActive = false;
  }

  function isInsideSelection(x, y) {
    return x >= selectionRect.x &&
           x <= selectionRect.x + selectionRect.width &&
           y >= selectionRect.y &&
           y <= selectionRect.y + selectionRect.height;
  }

  function getResizeDirection(e) {
    const handle = e.target.closest('.resize-handle');
    return handle ? handle.dataset.direction : '';
  }

  overlay.addEventListener('mousedown', (e) => {
    if (e.target.closest('#screensnap-toolbar')) return;

    const x = e.clientX;
    const y = e.clientY;

    // Check if clicking on resize handle
    const resizeDir = getResizeDirection(e);
    if (resizeDir && selection) {
      mode = 'resizing';
      resizeDirection = resizeDir;
      originalRect = { ...selectionRect };
      startX = x;
      startY = y;
      hideToolbar();
      return;
    }

    // Check if clicking inside existing selection (to move)
    if (selection && isInsideSelection(x, y)) {
      mode = 'moving';
      dragOffsetX = x - selectionRect.x;
      dragOffsetY = y - selectionRect.y;
      hideToolbar();
      return;
    }

    // Start new selection
    hideToolbar();
    if (selection) {
      selection.remove();
      selection = null;
    }
    if (sizeLabel) {
      sizeLabel.remove();
      sizeLabel = null;
    }

    mode = 'selecting';
    startX = x;
    startY = y;
    createSelection();
  });

  overlay.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;

    if (mode === 'selecting') {
      const width = x - startX;
      const height = y - startY;
      updateSelection(startX, startY, width, height);
    }
    else if (mode === 'moving') {
      const newX = x - dragOffsetX;
      const newY = y - dragOffsetY;
      updateSelection(newX, newY, selectionRect.width, selectionRect.height);
    }
    else if (mode === 'resizing') {
      const dx = x - startX;
      const dy = y - startY;

      let newX = originalRect.x;
      let newY = originalRect.y;
      let newW = originalRect.width;
      let newH = originalRect.height;

      if (resizeDirection.includes('w')) {
        newX = originalRect.x + dx;
        newW = originalRect.width - dx;
      }
      if (resizeDirection.includes('e')) {
        newW = originalRect.width + dx;
      }
      if (resizeDirection.includes('n')) {
        newY = originalRect.y + dy;
        newH = originalRect.height - dy;
      }
      if (resizeDirection.includes('s')) {
        newH = originalRect.height + dy;
      }

      // Ensure minimum size
      if (newW < 20) {
        if (resizeDirection.includes('w')) {
          newX = originalRect.x + originalRect.width - 20;
        }
        newW = 20;
      }
      if (newH < 20) {
        if (resizeDirection.includes('n')) {
          newY = originalRect.y + originalRect.height - 20;
        }
        newH = 20;
      }

      updateSelection(newX, newY, newW, newH);
    }
    else if (selection) {
      // Update cursor based on position
      if (isInsideSelection(x, y)) {
        overlay.style.cursor = 'move';
      } else {
        overlay.style.cursor = 'crosshair';
      }
    }
  });

  overlay.addEventListener('mouseup', (e) => {
    if (mode === 'selecting' || mode === 'moving' || mode === 'resizing') {
      if (selectionRect.width > 10 && selectionRect.height > 10) {
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
    // Arrow keys to fine-tune position
    if (selection && mode === 'idle') {
      const step = e.shiftKey ? 10 : 1;
      let moved = false;

      if (e.key === 'ArrowLeft') {
        selectionRect.x -= step;
        moved = true;
      } else if (e.key === 'ArrowRight') {
        selectionRect.x += step;
        moved = true;
      } else if (e.key === 'ArrowUp') {
        selectionRect.y -= step;
        moved = true;
      } else if (e.key === 'ArrowDown') {
        selectionRect.y += step;
        moved = true;
      }

      if (moved) {
        e.preventDefault();
        updateSelection(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
        updateToolbarPosition();
      }
    }
    // Enter to confirm
    if (e.key === 'Enter' && selection && selectionRect.width > 10 && selectionRect.height > 10) {
      confirmSelection();
    }
  });
})();
