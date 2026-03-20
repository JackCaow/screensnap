/**
 * ScreenSnap Preview Page Script
 * Handles image preview, annotation tools, download, and clipboard operations
 */

class AnnotationTool {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.baseImage = null;
    this.annotations = [];
    this.redoStack = [];
    this.currentTool = 'select';
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentPath = [];
    this.color = '#ef4444';
    this.strokeWidth = 2;
    this.textPosition = null;
    this.numberCounter = 1;
  }

  setTool(tool) {
    this.currentTool = tool;
    this.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
  }

  setColor(color) {
    this.color = color;
  }

  setStrokeWidth(width) {
    this.strokeWidth = parseInt(width);
  }

  startDraw(x, y) {
    if (this.currentTool === 'select') return;

    this.isDrawing = true;
    this.startX = x;
    this.startY = y;

    if (this.currentTool === 'pen' || this.currentTool === 'highlighter') {
      this.currentPath = [{ x, y }];
    }
  }

  draw(x, y) {
    if (!this.isDrawing) return;

    this.redraw();

    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    switch (this.currentTool) {
      case 'rect':
        this.drawRect(this.startX, this.startY, x - this.startX, y - this.startY);
        break;
      case 'ellipse':
        this.drawEllipse(this.startX, this.startY, x, y);
        break;
      case 'arrow':
        this.drawArrow(this.startX, this.startY, x, y);
        break;
      case 'line':
        this.drawLine(this.startX, this.startY, x, y);
        break;
      case 'pen':
        this.currentPath.push({ x, y });
        this.drawPen(this.currentPath);
        break;
      case 'highlighter':
        this.currentPath.push({ x, y });
        this.drawHighlighter(this.currentPath, this.color, this.strokeWidth * 4);
        break;
      case 'mosaic':
      case 'blur':
        this.drawMosaicPreview(this.startX, this.startY, x, y);
        break;
    }
  }

  endDraw(x, y) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentTool === 'text') {
      this.textPosition = { x: this.startX, y: this.startY };
      return 'text';
    }

    if (this.currentTool === 'number') {
      this.addNumber(x, y);
      return null;
    }

    const annotation = {
      tool: this.currentTool,
      color: this.color,
      strokeWidth: this.strokeWidth,
      startX: this.startX,
      startY: this.startY,
      endX: x,
      endY: y,
      path: (this.currentTool === 'pen' || this.currentTool === 'highlighter') ? [...this.currentPath] : null
    };

    if (this.currentTool === 'mosaic' || this.currentTool === 'blur') {
      annotation.imageData = this.getMosaicData(this.startX, this.startY, x, y);
    }

    this.annotations.push(annotation);
    this.redoStack = [];
    this.redraw();

    return null;
  }

  addNumber(x, y) {
    this.annotations.push({
      tool: 'number',
      color: this.color,
      x: x,
      y: y,
      number: this.numberCounter++
    });
    this.redoStack = [];
    this.redraw();
  }

  addText(text) {
    if (!this.textPosition || !text.trim()) return;

    this.annotations.push({
      tool: 'text',
      color: this.color,
      strokeWidth: this.strokeWidth,
      x: this.textPosition.x,
      y: this.textPosition.y,
      text: text
    });

    this.redoStack = [];
    this.textPosition = null;
    this.redraw();
  }

  drawRect(x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.stroke();
  }

  drawEllipse(x1, y1, x2, y2) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;

    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  drawArrow(x1, y1, x2, y2) {
    const headLength = 12 + this.strokeWidth * 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x2, y2);
    this.ctx.lineTo(
      x2 - headLength * Math.cos(angle - Math.PI / 6),
      y2 - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      x2 - headLength * Math.cos(angle + Math.PI / 6),
      y2 - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fillStyle = this.color;
    this.ctx.fill();
  }

  drawLine(x1, y1, x2, y2) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  drawPen(path) {
    if (path.length < 2) return;

    this.ctx.beginPath();
    this.ctx.moveTo(path[0].x, path[0].y);

    for (let i = 1; i < path.length; i++) {
      this.ctx.lineTo(path[i].x, path[i].y);
    }
    this.ctx.stroke();
  }

  drawHighlighter(path, color, width) {
    if (path.length < 2) return;

    this.ctx.save();
    this.ctx.globalAlpha = 0.4;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(path[0].x, path[0].y);

    for (let i = 1; i < path.length; i++) {
      this.ctx.lineTo(path[i].x, path[i].y);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawText(x, y, text, color, fontSize) {
    this.ctx.font = `bold ${fontSize || 20}px -apple-system, BlinkMacSystemFont, sans-serif`;
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }

  drawNumber(x, y, number, color) {
    const radius = 14;

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = color;
    this.ctx.fill();

    this.ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(number.toString(), x, y);
    this.ctx.textAlign = 'start';
    this.ctx.textBaseline = 'alphabetic';
  }

  getMosaicData(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    if (width < 1 || height < 1) return null;

    return { left, top, width, height };
  }

  drawMosaicPreview(x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    this.ctx.strokeStyle = '#6366f1';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(left, top, width, height);
    this.ctx.setLineDash([]);
  }

  applyMosaic(data, isBlur = false) {
    if (!data) return;

    const { left, top, width, height } = data;
    const blockSize = isBlur ? 6 : 10;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.baseImage, 0, 0);

    const imageData = tempCtx.getImageData(left, top, width, height);
    const pixels = imageData.data;

    for (let by = 0; by < height; by += blockSize) {
      for (let bx = 0; bx < width; bx += blockSize) {
        let r = 0, g = 0, b = 0, count = 0;

        for (let py = by; py < by + blockSize && py < height; py++) {
          for (let px = bx; px < bx + blockSize && px < width; px++) {
            const i = (py * width + px) * 4;
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
            count++;
          }
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(
          left + bx,
          top + by,
          Math.min(blockSize, width - bx),
          Math.min(blockSize, height - by)
        );
      }
    }
  }

  renderAnnotation(annotation) {
    this.ctx.strokeStyle = annotation.color;
    this.ctx.lineWidth = annotation.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    switch (annotation.tool) {
      case 'rect':
        this.drawRect(
          annotation.startX,
          annotation.startY,
          annotation.endX - annotation.startX,
          annotation.endY - annotation.startY
        );
        break;
      case 'ellipse':
        this.drawEllipse(
          annotation.startX,
          annotation.startY,
          annotation.endX,
          annotation.endY
        );
        break;
      case 'arrow': {
        const savedColor = this.color;
        this.ctx.strokeStyle = annotation.color;
        this.color = annotation.color;
        this.drawArrow(
          annotation.startX,
          annotation.startY,
          annotation.endX,
          annotation.endY
        );
        this.color = savedColor;
        break;
      }
      case 'line':
        this.drawLine(
          annotation.startX,
          annotation.startY,
          annotation.endX,
          annotation.endY
        );
        break;
      case 'pen':
        this.drawPen(annotation.path);
        break;
      case 'highlighter':
        this.drawHighlighter(annotation.path, annotation.color, annotation.strokeWidth * 4);
        break;
      case 'text':
        this.drawText(
          annotation.x,
          annotation.y,
          annotation.text,
          annotation.color,
          annotation.strokeWidth * 6
        );
        break;
      case 'number':
        this.drawNumber(annotation.x, annotation.y, annotation.number, annotation.color);
        break;
      case 'mosaic':
        this.applyMosaic(annotation.imageData, false);
        break;
      case 'blur':
        this.applyMosaic(annotation.imageData, true);
        break;
    }
  }

  redraw() {
    if (!this.baseImage) return;

    this.ctx.drawImage(this.baseImage, 0, 0);

    for (const annotation of this.annotations) {
      this.renderAnnotation(annotation);
    }
  }

  undo() {
    if (this.annotations.length === 0) return false;
    const removed = this.annotations.pop();
    if (removed.tool === 'number') {
      this.numberCounter = Math.max(1, this.numberCounter - 1);
    }
    this.redoStack.push(removed);
    this.redraw();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const restored = this.redoStack.pop();
    if (restored.tool === 'number') {
      this.numberCounter = restored.number + 1;
    }
    this.annotations.push(restored);
    this.redraw();
    return true;
  }

  clear() {
    this.annotations = [];
    this.redoStack = [];
    this.numberCounter = 1;
    this.redraw();
  }
}

class ScreenSnapPreview {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvasContainer = document.getElementById('canvasContainer');
    this.canvasWrapper = document.getElementById('canvasWrapper');
    this.loadingEl = document.getElementById('loading');
    this.imageInfoEl = document.getElementById('imageInfo');
    this.downloadBtn = document.getElementById('downloadBtn');
    this.copyBtn = document.getElementById('copyBtn');
    this.toastEl = document.getElementById('toast');
    this.toastTextEl = document.getElementById('toastText');
    this.toolbar = document.getElementById('toolbar');
    this.colorPicker = document.getElementById('colorPicker');
    this.undoBtn = document.getElementById('undoBtn');
    this.redoBtn = document.getElementById('redoBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.textInputOverlay = document.getElementById('textInput');
    this.textArea = document.getElementById('textArea');
    this.textConfirmBtn = document.getElementById('textConfirm');
    this.textCancelBtn = document.getElementById('textCancel');
    this.zoomLevelEl = document.getElementById('zoomLevel');
    this.zoomInBtn = document.getElementById('zoomIn');
    this.zoomOutBtn = document.getElementById('zoomOut');
    this.zoomFitWidthBtn = document.getElementById('zoomFitWidth');
    this.zoomFitViewBtn = document.getElementById('zoomFitView');

    this.screenshotId = null;
    this.zoom = 1;           // 1 = actual pixel size
    this.fitWidthZoom = 1;   // calculated on load
    this.fitViewZoom = 1;    // calculated on load
    this.minZoom = 0.05;
    this.maxZoom = 5;
    this.annotationTool = new AnnotationTool(this.canvas, this.ctx);
    this.init();
  }

  async init() {
    this.setupToolbar();
    this.setupCanvas();
    this.setupZoom();
    this.setupKeyboard();
    this.setupButtons();
    await this.loadScreenshot();
  }

  setupToolbar() {
    // Tool buttons
    this.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.annotationTool.setTool(btn.dataset.tool);
      });
    });

    this.toolbar.querySelector('[data-tool="select"]').classList.add('active');

    // Color picker popup
    const colorBtn = document.getElementById('colorBtn');
    const colorPopup = document.getElementById('colorPopup');
    const colorIndicator = document.getElementById('colorIndicator');

    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPopup.classList.toggle('hidden');
      // Close stroke popup if open
      document.getElementById('strokePopup').classList.add('hidden');
    });

    // Color swatches
    this.toolbar.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        this.toolbar.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const color = btn.dataset.color;
        this.annotationTool.setColor(color);
        colorIndicator.style.background = color;
        this.colorPicker.value = color;
        colorPopup.classList.add('hidden');
      });
    });

    // Set first color as active
    this.toolbar.querySelector('.color-swatch').classList.add('active');

    // Custom color picker
    this.colorPicker.addEventListener('input', (e) => {
      this.toolbar.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
      this.annotationTool.setColor(e.target.value);
      colorIndicator.style.background = e.target.value;
    });

    // Stroke picker popup
    const strokeBtn = document.getElementById('strokeBtn');
    const strokePopup = document.getElementById('strokePopup');
    const strokeIndicator = document.getElementById('strokeIndicator');

    strokeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      strokePopup.classList.toggle('hidden');
      // Close color popup if open
      colorPopup.classList.add('hidden');
    });

    // Stroke options
    this.toolbar.querySelectorAll('.stroke-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.toolbar.querySelectorAll('.stroke-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const width = parseInt(btn.dataset.width);
        this.annotationTool.setStrokeWidth(width);
        strokeIndicator.style.height = width + 'px';
        strokePopup.classList.add('hidden');
      });
    });

    // Close popups when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.color-picker-wrapper')) {
        colorPopup.classList.add('hidden');
      }
      if (!e.target.closest('.stroke-picker-wrapper')) {
        strokePopup.classList.add('hidden');
      }
    });

    // Action buttons
    this.undoBtn.addEventListener('click', () => {
      this.annotationTool.undo();
      this.saveAnnotations();
    });
    this.redoBtn.addEventListener('click', () => {
      this.annotationTool.redo();
      this.saveAnnotations();
    });
    this.clearBtn.addEventListener('click', () => {
      if (confirm('确定要清除所有标注吗？')) {
        this.annotationTool.clear();
        this.saveAnnotations();
      }
    });
  }

  // Convert mouse event to canvas pixel coordinates
  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  setupCanvas() {
    this.canvas.addEventListener('mousedown', (e) => {
      const { x, y } = this.getCanvasCoords(e);

      if (this.annotationTool.currentTool === 'text') {
        this.annotationTool.textPosition = { x, y };
        this.showTextInput();
        return;
      }

      if (this.annotationTool.currentTool === 'number') {
        this.annotationTool.addNumber(x, y);
        this.saveAnnotations();
        return;
      }

      this.annotationTool.startDraw(x, y);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this.getCanvasCoords(e);
      this.annotationTool.draw(x, y);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      const { x, y } = this.getCanvasCoords(e);
      this.annotationTool.endDraw(x, y);
      this.saveAnnotations();
    });
  }

  // ==================== Zoom ====================

  setupZoom() {
    // Ctrl/Cmd + wheel to zoom (centered on cursor)
    this.canvasContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
        this.zoomAtPoint(this.zoom * factor, e.clientX, e.clientY);
      }
    }, { passive: false });

    // Zoom buttons
    this.zoomInBtn.addEventListener('click', () => this.setZoom(this.zoom * 1.2));
    this.zoomOutBtn.addEventListener('click', () => this.setZoom(this.zoom / 1.2));
    this.zoomLevelEl.addEventListener('click', () => this.setZoom(this.fitWidthZoom));
    this.zoomFitWidthBtn.addEventListener('click', () => this.setZoom(this.fitWidthZoom));
    this.zoomFitViewBtn.addEventListener('click', () => this.setZoom(this.fitViewZoom));
  }

  calcFitZooms() {
    const container = this.canvasContainer;
    // clientWidth/clientHeight exclude scrollbars, giving exact available space
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = this.canvas.width;
    const ih = this.canvas.height;

    if (iw === 0 || ih === 0) return;

    this.fitWidthZoom = Math.min(cw / iw, 1);
    this.fitViewZoom = Math.min(cw / iw, ch / ih, 1);
  }

  setZoom(level) {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, level));
    this.applyZoom();
  }

  // Zoom keeping a specific screen point anchored
  zoomAtPoint(newZoom, clientX, clientY) {
    newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    const oldZoom = this.zoom;
    if (newZoom === oldZoom) return;

    const container = this.canvasContainer;
    const rect = container.getBoundingClientRect();

    // Mouse position relative to container viewport
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // Current image pixel under cursor
    const imgX = (container.scrollLeft + mx) / oldZoom;
    const imgY = (container.scrollTop + my) / oldZoom;

    this.zoom = newZoom;
    this.applyZoom();

    // Scroll so the same image pixel stays under cursor
    container.scrollLeft = imgX * newZoom - mx;
    container.scrollTop = imgY * newZoom - my;
  }

  applyZoom() {
    const w = Math.round(this.canvas.width * this.zoom);
    const h = Math.round(this.canvas.height * this.zoom);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.zoomLevelEl.textContent = Math.round(this.zoom * 100) + '%';
  }

  // ==================== Keyboard ====================

  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'TEXTAREA') return;

      // Tool shortcuts
      const toolShortcuts = {
        'v': 'select', 'r': 'rect', 'o': 'ellipse', 'a': 'arrow',
        'l': 'line', 'p': 'pen', 'h': 'highlighter', 't': 'text',
        'n': 'number', 'm': 'mosaic', 'b': 'blur'
      };

      if (!e.ctrlKey && !e.metaKey && toolShortcuts[e.key.toLowerCase()]) {
        const tool = toolShortcuts[e.key.toLowerCase()];
        const btn = this.toolbar.querySelector(`[data-tool="${tool}"]`);
        if (btn) {
          this.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.annotationTool.setTool(tool);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.annotationTool.undo();
        this.saveAnnotations();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z') || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        this.annotationTool.redo();
        this.saveAnnotations();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.download();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        this.copyToClipboard();
      }
      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        this.setZoom(this.zoom * 1.2);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        this.setZoom(this.zoom / 1.2);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        this.setZoom(this.fitWidthZoom);
      }
    });
  }

  // ==================== Buttons ====================

  setupButtons() {
    this.downloadBtn.addEventListener('click', () => this.download());
    this.copyBtn.addEventListener('click', () => this.copyToClipboard());

    this.textConfirmBtn.addEventListener('click', () => {
      this.annotationTool.addText(this.textArea.value);
      this.saveAnnotations();
      this.hideTextInput();
    });

    this.textCancelBtn.addEventListener('click', () => {
      this.hideTextInput();
    });

    // Enter to confirm text
    this.textArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.annotationTool.addText(this.textArea.value);
        this.saveAnnotations();
        this.hideTextInput();
      }
      if (e.key === 'Escape') {
        this.hideTextInput();
      }
    });
  }

  showTextInput() {
    this.textInputOverlay.classList.remove('hidden');
    this.textArea.value = '';
    this.textArea.focus();
  }

  hideTextInput() {
    this.textInputOverlay.classList.add('hidden');
    this.textArea.value = '';
  }

  // ==================== Screenshot loading ====================

  async loadScreenshot() {
    try {
      // Get screenshot ID from URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      this.screenshotId = urlParams.get('id');

      if (!this.screenshotId) {
        this.showError('未找到截图数据');
        return;
      }

      const result = await chrome.storage.local.get([this.screenshotId, this.screenshotId + '_annotations']);
      const screenshotData = result[this.screenshotId];

      if (!screenshotData) {
        this.showError('截图数据已过期');
        return;
      }

      const img = new Image();
      img.onload = async () => {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);
        this.annotationTool.baseImage = img;

        // Restore annotations if exist
        const annotationsData = result[this.screenshotId + '_annotations'];
        if (annotationsData) {
          this.annotationTool.annotations = annotationsData.annotations || [];
          this.annotationTool.numberCounter = annotationsData.numberCounter || 1;
          this.annotationTool.redraw();
        }

        this.loadingEl.classList.add('hidden');
        this.canvas.classList.remove('hidden');
        this.updateImageInfo(img.width, img.height, screenshotData);

        // Calculate fit zooms and apply initial zoom
        this.calcFitZooms();
        this.setZoom(this.fitWidthZoom);
      };

      img.onerror = () => {
        this.showError('图片加载失败');
      };

      img.src = screenshotData;
    } catch (error) {
      console.error('Load screenshot error:', error);
      this.showError('加载截图失败');
    }
  }

  // Save annotations to storage
  async saveAnnotations() {
    if (!this.screenshotId) return;

    const data = {
      annotations: this.annotationTool.annotations,
      numberCounter: this.annotationTool.numberCounter
    };

    await chrome.storage.local.set({ [this.screenshotId + '_annotations']: data });
  }

  updateImageInfo(width, height, dataUrl) {
    const base64Length = dataUrl.split(',')[1]?.length || 0;
    const padding = (dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0);
    const sizeKB = Math.round((base64Length * 3 / 4 - padding) / 1024);

    this.imageInfoEl.textContent = `${width} × ${height} px · ${this.formatSize(sizeKB)}`;
  }

  formatSize(kb) {
    if (kb < 1024) {
      return `${kb} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  // ==================== Export ====================

  download() {
    const dataUrl = this.canvas.toDataURL('image/png');
    const timestamp = this.getTimestamp();
    const filename = `screenshot_${timestamp}.png`;

    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        this.showToast('保存失败: ' + chrome.runtime.lastError.message, false);
      } else {
        this.showToast('截图已保存');
      }
    });
  }

  async copyToClipboard() {
    try {
      const blob = await new Promise(resolve => {
        this.canvas.toBlob(resolve, 'image/png');
      });

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      this.showToast('已复制到剪贴板');
    } catch (error) {
      console.error('Copy to clipboard error:', error);
      this.showToast('复制失败', false);
    }
  }

  getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  // ==================== UI helpers ====================

  showToast(message, success = true) {
    this.toastEl.style.background = success ? 'var(--success)' : '#ef4444';
    this.toastTextEl.textContent = message;
    this.toastEl.classList.remove('hidden');

    setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, 2500);
  }

  showError(message) {
    this.loadingEl.innerHTML = '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.style.color = '#ef4444';

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '2');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 8v4M12 16h.01');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');

    svg.appendChild(circle);
    svg.appendChild(path);

    const span = document.createElement('span');
    span.style.color = '#ef4444';
    span.textContent = message;

    this.loadingEl.appendChild(svg);
    this.loadingEl.appendChild(span);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ScreenSnapPreview();
});
