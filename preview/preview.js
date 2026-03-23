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
    // Selection state for move/resize
    this.selectedIndex = -1;
    this.dragMode = null; // 'move' | 'resize-XX'
    this.dragStart = null;
    this.dragOriginal = null;
    // Stamp state
    this.currentStamp = '✓';
    this.stampSize = 32;
    // Crop state
    this.cropRegion = null;
    this.isCropping = false;
  }

  setTool(tool) {
    this.currentTool = tool;
    this.selectedIndex = -1;
    this.cropRegion = null;
    this.isCropping = false;
    this.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    this.redraw();
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
      case 'dashedRect':
        this.drawDashedRect(this.startX, this.startY, x - this.startX, y - this.startY);
        break;
      case 'roundedRect':
        this.drawRoundedRect(this.startX, this.startY, x - this.startX, y - this.startY);
        break;
      case 'ellipse':
        this.drawEllipse(this.startX, this.startY, x, y);
        break;
      case 'arrow':
        this.drawArrow(this.startX, this.startY, x, y);
        break;
      case 'doubleArrow':
        this.drawDoubleArrow(this.startX, this.startY, x, y);
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
      case 'crop':
        this.drawCropPreview(this.startX, this.startY, x, y);
        break;
      case 'callout':
        // No drag preview — click to place
        break;
      case 'spotlight':
        this.drawSpotlightPreview(this.startX, this.startY, x, y);
        break;
      case 'magnify':
        this.drawMagnifyPreview(this.startX, this.startY, x, y);
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

    if (this.currentTool === 'stamp') {
      this.addStamp(x, y);
      return null;
    }

    if (this.currentTool === 'crop') {
      this.cropRegion = this._normalizeRect(this.startX, this.startY, x, y);
      this.isCropping = true;
      this.redraw();
      this._drawCropOverlay();
      return 'crop';
    }

    if (this.currentTool === 'callout') {
      // Click to place callout — box at click point, short tail below
      this.calloutAnchor = { x: this.startX, y: this.startY };
      return 'callout';
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

    if (this.currentTool === 'magnify') {
      const cx = (this.startX + x) / 2;
      const cy = (this.startY + y) / 2;
      const radius = Math.max(30, Math.sqrt((x - this.startX) ** 2 + (y - this.startY) ** 2) / 2);
      annotation.tool = 'magnify';
      annotation.cx = cx;
      annotation.cy = cy;
      annotation.radius = radius;
      annotation.zoomLevel = 2;
    }

    if (this.currentTool === 'spotlight') {
      annotation.tool = 'spotlight';
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

  addText(text, opts = {}) {
    if (!this.textPosition || !text.trim()) return;

    this.annotations.push({
      tool: 'text',
      color: opts.color || this.color,
      strokeWidth: this.strokeWidth,
      x: this.textPosition.x,
      y: this.textPosition.y,
      text: text,
      fontSize: opts.fontSize || 20,
      bold: opts.bold !== undefined ? opts.bold : true,
      italic: opts.italic || false
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

  drawDashedRect(x, y, w, h) {
    this.ctx.save();
    this.ctx.setLineDash([8, 4]);
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawRoundedRect(x, y, w, h) {
    const r = Math.min(8, Math.abs(w) / 4, Math.abs(h) / 4);
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
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

  drawDoubleArrow(x1, y1, x2, y2) {
    const headLength = 12 + this.strokeWidth * 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Line
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    // Arrowhead at end
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

    // Arrowhead at start (reverse direction)
    const reverseAngle = angle + Math.PI;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(
      x1 - headLength * Math.cos(reverseAngle - Math.PI / 6),
      y1 - headLength * Math.sin(reverseAngle - Math.PI / 6)
    );
    this.ctx.lineTo(
      x1 - headLength * Math.cos(reverseAngle + Math.PI / 6),
      y1 - headLength * Math.sin(reverseAngle + Math.PI / 6)
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

  drawText(x, y, text, color, fontSize, bold, italic) {
    const style = `${italic ? 'italic ' : ''}${bold !== false ? 'bold ' : ''}${fontSize || 20}px -apple-system, BlinkMacSystemFont, sans-serif`;
    this.ctx.font = style;
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

  // ==================== New Tools ====================

  _normalizeRect(x1, y1, x2, y2) {
    return {
      left: Math.min(x1, x2), top: Math.min(y1, y2),
      width: Math.abs(x2 - x1), height: Math.abs(y2 - y1)
    };
  }

  // -- Crop --
  _drawDimmedOverlay(left, top, width, height, dashed) {
    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    // Draw 4 rects around the crop region (not over it)
    ctx.fillRect(0, 0, cw, top);                          // top
    ctx.fillRect(0, top, left, height);                    // left
    ctx.fillRect(left + width, top, cw - left - width, height); // right
    ctx.fillRect(0, top + height, cw, ch - top - height);  // bottom
    // Border
    ctx.strokeStyle = '#8cb485';
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([6, 4]);
    ctx.strokeRect(left, top, width, height);
    if (dashed) ctx.setLineDash([]);
    ctx.restore();
  }

  drawCropPreview(x1, y1, x2, y2) {
    const { left, top, width, height } = this._normalizeRect(x1, y1, x2, y2);
    this._drawDimmedOverlay(left, top, width, height, true);
  }

  _drawCropOverlay() {
    if (!this.cropRegion) return;
    const { left, top, width, height } = this.cropRegion;
    this._drawDimmedOverlay(left, top, width, height, false);
  }

  applyCrop() {
    if (!this.cropRegion) return;
    const { left, top, width, height } = this.cropRegion;
    if (width < 10 || height < 10) return;

    // Save state for undo
    const prevImage = this.baseImage;
    const prevW = this.canvas.width;
    const prevH = this.canvas.height;
    const prevAnnotations = JSON.parse(JSON.stringify(this.annotations));

    // Create cropped image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Redraw base + annotations, then crop
    this.redraw();
    tempCtx.drawImage(this.canvas, left, top, width, height, 0, 0, width, height);

    // Update canvas
    this.canvas.width = width;
    this.canvas.height = height;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.baseImage = img;
        this.annotations = [];
        this.redoStack = [];
        this.ctx.drawImage(img, 0, 0);
        // Store crop undo info
        this.annotations.push({
          tool: '_cropUndo', prevImage, prevW, prevH, prevAnnotations
        });
        this.cropRegion = null;
        this.isCropping = false;
        resolve(true);
      };
      img.src = tempCanvas.toDataURL('image/png');
    });
  }

  cancelCrop() {
    this.cropRegion = null;
    this.isCropping = false;
    this.redraw();
  }

  // -- Stamp --
  addStamp(x, y) {
    this.annotations.push({
      tool: 'stamp', x, y,
      emoji: this.currentStamp,
      size: this.stampSize,
      color: this.color
    });
    this.redoStack = [];
    this.redraw();
  }

  drawStamp(x, y, emoji, size) {
    this.ctx.font = `${size}px -apple-system, BlinkMacSystemFont, "Segoe UI Emoji", sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(emoji, x, y);
    this.ctx.textAlign = 'start';
    this.ctx.textBaseline = 'alphabetic';
  }

  // -- Callout --
  addCallout(text, opts = {}) {
    if (!this.calloutAnchor || !text.trim()) return;
    const fontSize = opts.fontSize || 16;
    const bold = opts.bold !== undefined ? opts.bold : false;
    const italic = opts.italic || false;
    const color = opts.color || this.color;

    // Measure text to auto-size the box
    const ctx = this.ctx;
    const style = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.font = style;
    const padding = 12;
    const maxLineW = 240;
    // Word-wrap and measure
    const chars = text.split('');
    const lines = [];
    let line = '';
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxLineW && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    let textW = 0;
    for (const l of lines) textW = Math.max(textW, ctx.measureText(l).width);
    const boxW = Math.max(60, textW + padding * 2);
    const boxH = Math.max(36, lines.length * (fontSize + 4) + padding * 2);

    // Position box centered at anchor, tail extends below
    const ax = this.calloutAnchor.x;
    const ay = this.calloutAnchor.y;
    const boxX = ax - boxW / 2;
    const boxY = ay - boxH - 20;
    const tailX = ax;
    const tailY = ay;

    this.annotations.push({
      tool: 'callout', color, strokeWidth: this.strokeWidth,
      boxX, boxY, boxW, boxH, tailX, tailY,
      text, fontSize, bold, italic
    });
    this.calloutAnchor = null;
    this.redoStack = [];
    this.redraw();
  }

  drawCallout(ann) {
    const { boxX, boxY, boxW, boxH, tailX, tailY, color, strokeWidth } = ann;
    const ctx = this.ctx;
    ctx.save();

    // Determine which edge the tail connects to and the two anchor points
    const cx = boxX + boxW / 2;
    const cy = boxY + boxH / 2;
    const r = 8; // border radius (slightly larger for softer feel)
    const gap = 12; // half-width of tail base (wider = more natural)

    // Clamp tail anchor to the nearest edge
    let a1x, a1y, a2x, a2y;
    const dx = tailX - cx, dy = tailY - cy;
    if (Math.abs(dx) / boxW > Math.abs(dy) / boxH) {
      // Left or right edge
      if (dx < 0) { // left
        const ey = Math.max(boxY + r + gap, Math.min(cy, boxY + boxH - r - gap));
        a1x = boxX; a1y = ey - gap; a2x = boxX; a2y = ey + gap;
      } else { // right
        const ey = Math.max(boxY + r + gap, Math.min(cy, boxY + boxH - r - gap));
        a1x = boxX + boxW; a1y = ey + gap; a2x = boxX + boxW; a2y = ey - gap;
      }
    } else {
      // Top or bottom edge
      if (dy < 0) { // top
        const ex = Math.max(boxX + r + gap, Math.min(cx, boxX + boxW - r - gap));
        a1x = ex + gap; a1y = boxY; a2x = ex - gap; a2y = boxY;
      } else { // bottom
        const ex = Math.max(boxX + r + gap, Math.min(cx, boxX + boxW - r - gap));
        a1x = ex - gap; a1y = boxY + boxH; a2x = ex + gap; a2y = boxY + boxH;
      }
    }

    // Build a unified bubble path: rounded rect with a notch for the tail
    // The path goes clockwise around the box, inserting the tail at the right edge
    function bubblePath() {
      const x0 = boxX, y0 = boxY, x1 = boxX + boxW, y1 = boxY + boxH;
      ctx.beginPath();

      // Determine which edge the tail is on
      const _dx = tailX - cx, _dy = tailY - cy;
      const onBottom = !(Math.abs(_dx) / boxW > Math.abs(_dy) / boxH) && _dy >= 0;
      const onTop = !(Math.abs(_dx) / boxW > Math.abs(_dy) / boxH) && _dy < 0;
      const onRight = (Math.abs(_dx) / boxW > Math.abs(_dy) / boxH) && _dx >= 0;
      const onLeft = (Math.abs(_dx) / boxW > Math.abs(_dy) / boxH) && _dx < 0;

      // Start from top-left corner, go clockwise
      ctx.moveTo(x0 + r, y0);

      // Helper: draw tail with quadratic curves for smooth rounded shape
      function tailCurve(ax1, ay1, ax2, ay2) {
        // Control points: slight curve at base, meet at sharp (but rounded) tip
        const cpx1 = ax1 + (tailX - ax1) * 0.15;
        const cpy1 = ay1 + (tailY - ay1) * 0.15;
        const cpx2 = ax2 + (tailX - ax2) * 0.15;
        const cpy2 = ay2 + (tailY - ay2) * 0.15;

        ctx.lineTo(ax1, ay1);
        ctx.quadraticCurveTo(cpx1, cpy1, tailX, tailY);
        ctx.quadraticCurveTo(cpx2, cpy2, ax2, ay2);
      }

      // Top edge
      if (onTop) tailCurve(a2x, a2y, a1x, a1y);
      ctx.lineTo(x1 - r, y0);
      ctx.arcTo(x1, y0, x1, y0 + r, r); // top-right corner

      // Right edge
      if (onRight) tailCurve(a2x, a2y, a1x, a1y);
      ctx.lineTo(x1, y1 - r);
      ctx.arcTo(x1, y1, x1 - r, y1, r); // bottom-right corner

      // Bottom edge (path goes right-to-left: x1 → x0)
      if (onBottom) tailCurve(a2x, a2y, a1x, a1y);
      ctx.lineTo(x0 + r, y1);
      ctx.arcTo(x0, y1, x0, y1 - r, r); // bottom-left corner

      // Left edge
      if (onLeft) tailCurve(a2x, a2y, a1x, a1y);
      ctx.lineTo(x0, y0 + r);
      ctx.arcTo(x0, y0, x0 + r, y0, r); // top-left corner

      ctx.closePath();
    }

    // Subtle drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    // Fill bubble background
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    bubblePath();
    ctx.fill();

    // Reset shadow before stroke (avoid double shadow)
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;

    // Stroke bubble outline
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    bubblePath();
    ctx.stroke();

    // Draw text inside box
    const style = `${ann.italic ? 'italic ' : ''}${ann.bold ? 'bold ' : ''}${ann.fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.font = style;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    const words = ann.text.split('');
    let line = '';
    let lineY = boxY + 10;
    const maxWidth = boxW - 20;
    for (const char of words) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, boxX + 10, lineY);
        line = char;
        lineY += ann.fontSize + 4;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, boxX + 10, lineY);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // -- Magnify --
  drawMagnifyPreview(x1, y1, x2, y2) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const radius = Math.max(30, Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) / 2);
    this._renderMagnify(cx, cy, radius, 2);
  }

  _renderMagnify(cx, cy, radius, zoom) {
    const ctx = this.ctx;
    if (!this.baseImage) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Draw zoomed portion of base image
    const srcX = cx - radius / zoom;
    const srcY = cy - radius / zoom;
    const srcW = (radius * 2) / zoom;
    const srcH = (radius * 2) / zoom;
    ctx.drawImage(this.baseImage, srcX, srcY, srcW, srcH, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();

    // Draw border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#8cb485';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // -- Spotlight --
  drawSpotlightPreview(x1, y1, x2, y2) {
    const { left, top, width, height } = this._normalizeRect(x1, y1, x2, y2);
    this._renderSpotlight(left, top, width, height);
  }

  _renderSpotlight(left, top, width, height) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    // Draw 4 rectangles around the spotlight area
    ctx.fillRect(0, 0, this.canvas.width, top); // top
    ctx.fillRect(0, top, left, height); // left
    ctx.fillRect(left + width, top, this.canvas.width - left - width, height); // right
    ctx.fillRect(0, top + height, this.canvas.width, this.canvas.height - top - height); // bottom
    // Subtle border
    ctx.strokeStyle = 'rgba(140, 180, 133, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, width, height);
    ctx.restore();
  }

  // -- Hit Test for Select tool --
  hitTest(x, y) {
    for (let i = this.annotations.length - 1; i >= 0; i--) {
      const a = this.annotations[i];
      if (a.tool === '_cropUndo') continue;
      const bounds = this._getAnnotationBounds(a);
      if (!bounds) continue;
      if (x >= bounds.left - 5 && x <= bounds.left + bounds.width + 5 &&
          y >= bounds.top - 5 && y <= bounds.top + bounds.height + 5) {
        return i;
      }
    }
    return -1;
  }

  _getAnnotationBounds(a) {
    if (a.tool === 'text' || a.tool === 'number' || a.tool === 'stamp') {
      const size = a.fontSize || a.size || 28;
      return { left: a.x - size, top: a.y - size, width: size * 2, height: size * 2 };
    }
    if (a.tool === 'callout') {
      return { left: a.boxX, top: a.boxY, width: a.boxW, height: a.boxH };
    }
    if (a.tool === 'magnify') {
      return { left: a.cx - a.radius, top: a.cy - a.radius, width: a.radius * 2, height: a.radius * 2 };
    }
    if (a.startX !== undefined) {
      const left = Math.min(a.startX, a.endX);
      const top = Math.min(a.startY, a.endY);
      return { left, top, width: Math.abs(a.endX - a.startX), height: Math.abs(a.endY - a.startY) };
    }
    if (a.path && a.path.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of a.path) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
    }
    return null;
  }

  drawSelectionHandles(index) {
    const a = this.annotations[index];
    const bounds = this._getAnnotationBounds(a);
    if (!bounds) return;
    const { left, top, width, height } = bounds;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#8cb485';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(left, top, width, height);
    ctx.setLineDash([]);
    // Draw corner handles
    const hs = 6;
    ctx.fillStyle = '#8cb485';
    for (const [hx, hy] of [[left, top], [left + width, top], [left, top + height], [left + width, top + height]]) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
    ctx.restore();
  }

  moveAnnotation(index, dx, dy) {
    const a = this.annotations[index];
    if (a.startX !== undefined) {
      a.startX += dx; a.startY += dy; a.endX += dx; a.endY += dy;
    }
    if (a.x !== undefined) { a.x += dx; a.y += dy; }
    if (a.cx !== undefined) { a.cx += dx; a.cy += dy; }
    if (a.boxX !== undefined) { a.boxX += dx; a.boxY += dy; a.tailX += dx; a.tailY += dy; }
    if (a.path) {
      for (const p of a.path) { p.x += dx; p.y += dy; }
    }
    if (a.imageData) { a.imageData.left += dx; a.imageData.top += dy; }
    this.redraw();
  }

  deleteSelected() {
    if (this.selectedIndex < 0) return;
    const removed = this.annotations.splice(this.selectedIndex, 1)[0];
    if (removed.tool === 'number') {
      this.numberCounter = Math.max(1, this.numberCounter - 1);
    }
    this.redoStack.push(removed);
    this.selectedIndex = -1;
    this.redraw();
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
      case 'dashedRect':
        this.drawDashedRect(
          annotation.startX,
          annotation.startY,
          annotation.endX - annotation.startX,
          annotation.endY - annotation.startY
        );
        break;
      case 'roundedRect':
        this.drawRoundedRect(
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
      case 'doubleArrow': {
        const savedColor2 = this.color;
        this.ctx.strokeStyle = annotation.color;
        this.color = annotation.color;
        this.drawDoubleArrow(
          annotation.startX,
          annotation.startY,
          annotation.endX,
          annotation.endY
        );
        this.color = savedColor2;
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
          annotation.fontSize || annotation.strokeWidth * 6,
          annotation.bold !== undefined ? annotation.bold : true,
          annotation.italic || false
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
      case 'stamp':
        this.drawStamp(annotation.x, annotation.y, annotation.emoji, annotation.size);
        break;
      case 'callout':
        this.drawCallout(annotation);
        break;
      case 'magnify':
        this._renderMagnify(annotation.cx, annotation.cy, annotation.radius, annotation.zoomLevel);
        break;
      case 'spotlight':
        this._renderSpotlight(
          Math.min(annotation.startX, annotation.endX),
          Math.min(annotation.startY, annotation.endY),
          Math.abs(annotation.endX - annotation.startX),
          Math.abs(annotation.endY - annotation.startY)
        );
        break;
      case '_cropUndo':
        // Not rendered — only used for undo state
        break;
    }
  }

  redraw() {
    if (!this.baseImage) return;

    this.ctx.drawImage(this.baseImage, 0, 0);

    for (const annotation of this.annotations) {
      this.renderAnnotation(annotation);
    }

    // Draw selection handles if an annotation is selected
    if (this.selectedIndex >= 0 && this.selectedIndex < this.annotations.length) {
      this.drawSelectionHandles(this.selectedIndex);
    }
  }

  undo() {
    if (this.annotations.length === 0) return false;
    const removed = this.annotations.pop();
    if (removed.tool === 'number') {
      this.numberCounter = Math.max(1, this.numberCounter - 1);
    }
    if (removed.tool === '_cropUndo') {
      // Restore pre-crop state
      this.baseImage = removed.prevImage;
      this.canvas.width = removed.prevW;
      this.canvas.height = removed.prevH;
      this.annotations = removed.prevAnnotations;
      this.redraw();
      return true;
    }
    this.selectedIndex = -1;
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
    this.isGifMode = false;
    this.gifDataUrl = null;
    this.zoom = 1;           // 1 = actual pixel size
    this.fitWidthZoom = 1;   // calculated on load
    this.fitViewZoom = 1;    // calculated on load
    this.minZoom = 0.05;
    this.maxZoom = 5;
    this.annotationTool = new AnnotationTool(this.canvas, this.ctx);
    this.init();
  }

  async init() {
    // Load user settings for default color/stroke
    try {
      const settings = await loadSettings();
      this.annotationTool.color = settings.defaultColor;
      this.annotationTool.strokeWidth = settings.defaultStrokeWidth;
      // Update UI to reflect loaded defaults
      const indicator = document.getElementById('colorIndicator');
      if (indicator) indicator.style.background = settings.defaultColor;
      const picker = document.getElementById('colorPicker');
      if (picker) picker.value = settings.defaultColor;
    } catch (e) { /* use built-in defaults */ }

    this.setupToolbar();
    this.setupCanvas();
    this.setupZoom();
    this.setupKeyboard();
    this.setupButtons();
    await this.loadScreenshot();
  }

  setupToolbar() {
    // Initialize tool groups — each group shows only one "representative" button
    this.toolbar.querySelectorAll('.tool-group').forEach(group => {
      const buttons = group.querySelectorAll('.tool-btn[data-tool]');
      if (buttons.length === 0) return;

      // Mark first button as the group representative
      buttons[0].classList.add('group-active');

      // Create dropdown panel
      const dropdown = document.createElement('div');
      dropdown.className = 'tool-group-dropdown';

      // Clone buttons into dropdown
      buttons.forEach(btn => {
        const clone = btn.cloneNode(true);
        clone.classList.remove('group-active');
        dropdown.appendChild(clone);
      });
      group.appendChild(dropdown);

      // Click on group-active button → toggle dropdown
      group.addEventListener('click', (e) => {
        const activeBtn = group.querySelector('.group-active');
        const clickedBtn = e.target.closest('.tool-btn[data-tool]');

        if (!clickedBtn) return;

        // If clicking the representative button itself, toggle dropdown
        if (clickedBtn === activeBtn) {
          e.stopPropagation();
          // Close other dropdowns
          this.toolbar.querySelectorAll('.tool-group-dropdown.visible').forEach(d => {
            if (d !== dropdown) d.classList.remove('visible');
          });
          dropdown.classList.toggle('visible');
          return;
        }

        // If clicking a button inside the dropdown
        if (clickedBtn.closest('.tool-group-dropdown')) {
          e.stopPropagation();
          const tool = clickedBtn.dataset.tool;

          // Update group representative
          const originalBtn = group.querySelector(`.tool-btn[data-tool="${tool}"]:not(.tool-group-dropdown .tool-btn)`);
          if (originalBtn) {
            buttons.forEach(b => b.classList.remove('group-active'));
            originalBtn.classList.add('group-active');
          }

          // Close dropdown
          dropdown.classList.remove('visible');

          // Activate the tool
          this.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
          if (originalBtn) originalBtn.classList.add('active');
          this.annotationTool.setTool(tool);
          return;
        }
      });
    });

    // Tool buttons (non-grouped ones like select, crop)
    this.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      if (btn.closest('.tool-group-dropdown')) return; // skip dropdown clones
      btn.addEventListener('click', () => {
        // Close any open dropdowns
        this.toolbar.querySelectorAll('.tool-group-dropdown.visible').forEach(d => d.classList.remove('visible'));
        // Don't re-handle group buttons (they're handled above)
        if (btn.closest('.tool-group') && btn.classList.contains('group-active')) return;

        this.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.annotationTool.setTool(btn.dataset.tool);
      });
    });

    // Close dropdowns when clicking elsewhere
    document.addEventListener('click', () => {
      this.toolbar.querySelectorAll('.tool-group-dropdown.visible').forEach(d => d.classList.remove('visible'));
    });

    this.toolbar.querySelector('[data-tool="select"]').classList.add('active');

    // Stamp picker popup
    const stampBtn = this.toolbar.querySelector('[data-tool="stamp"]');
    if (stampBtn) {
      const stampWrapper = document.createElement('div');
      stampWrapper.style.position = 'relative';
      stampWrapper.style.display = 'inline-flex';
      stampBtn.parentNode.insertBefore(stampWrapper, stampBtn);
      stampWrapper.appendChild(stampBtn);

      const stampPicker = document.createElement('div');
      stampPicker.className = 'stamp-picker hidden';
      stampPicker.id = 'stampPicker';
      const stamps = ['✓', '✗', '❤', '⭐', '❗', '❓', '👍', '👎', '🔥', '💡', '⚠️', '🎯'];
      stamps.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'stamp-item' + (emoji === '✓' ? ' active' : '');
        btn.textContent = emoji;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          stampPicker.querySelectorAll('.stamp-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.annotationTool.currentStamp = emoji;
          stampPicker.classList.add('hidden');
        });
        stampPicker.appendChild(btn);
      });
      stampWrapper.appendChild(stampPicker);

      stampBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stampPicker.classList.toggle('hidden');
      });
    }

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
      const sp = document.getElementById('stampPicker');
      if (sp && !e.target.closest('[data-tool="stamp"]') && !e.target.closest('.stamp-picker')) {
        sp.classList.add('hidden');
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
      if (confirm(i18n('confirm_clearAll'))) {
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
      const tool = this.annotationTool;

      // Select tool: hit test for move/resize
      if (tool.currentTool === 'select') {
        const hit = tool.hitTest(x, y);
        if (hit >= 0) {
          tool.selectedIndex = hit;
          tool.dragMode = 'move';
          tool.dragStart = { x, y };
          tool.dragOriginal = { x, y };
          tool.redraw();
        } else {
          tool.selectedIndex = -1;
          tool.redraw();
        }
        return;
      }

      if (tool.currentTool === 'text') {
        tool.textPosition = { x, y };
        this.showTextInput();
        return;
      }

      if (tool.currentTool === 'number') {
        tool.addNumber(x, y);
        this.saveAnnotations();
        return;
      }

      if (tool.currentTool === 'stamp') {
        tool.addStamp(x, y);
        this.saveAnnotations();
        return;
      }

      tool.startDraw(x, y);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this.getCanvasCoords(e);
      const tool = this.annotationTool;

      // Select tool: drag to move
      if (tool.currentTool === 'select' && tool.dragMode === 'move' && tool.selectedIndex >= 0) {
        const dx = x - tool.dragStart.x;
        const dy = y - tool.dragStart.y;
        tool.dragStart = { x, y };
        tool.moveAnnotation(tool.selectedIndex, dx, dy);
        return;
      }

      tool.draw(x, y);
    });

    this.canvas.addEventListener('mouseup', (e) => {
      const { x, y } = this.getCanvasCoords(e);
      const tool = this.annotationTool;

      // Select tool: end drag
      if (tool.currentTool === 'select') {
        if (tool.dragMode) {
          tool.dragMode = null;
          this.saveAnnotations();
        }
        return;
      }

      const result = tool.endDraw(x, y);

      if (result === 'crop') {
        this._showCropActions();
        return;
      }

      if (result === 'callout') {
        this.showCalloutInput();
        return;
      }

      this.saveAnnotations();
    });
  }

  _showCropActions() {
    // Show floating crop confirm/cancel buttons
    const existing = document.getElementById('cropActions');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'cropActions';
    div.className = 'crop-actions';
    div.innerHTML = `
      <button class="btn btn-secondary crop-cancel-btn">${i18n('preview_cancel')}</button>
      <button class="btn btn-primary crop-confirm-btn">${i18n('tool_crop')}</button>
    `;
    this.canvasContainer.appendChild(div);

    div.querySelector('.crop-confirm-btn').addEventListener('click', async () => {
      await this.annotationTool.applyCrop();
      div.remove();
      this.calcFitZooms();
      this.setZoom(this.fitWidthZoom);
      this.saveAnnotations();
    });
    div.querySelector('.crop-cancel-btn').addEventListener('click', () => {
      this.annotationTool.cancelCrop();
      div.remove();
    });
  }

  showCalloutInput() {
    this.textInputOverlay.classList.remove('hidden');
    this.textArea.value = '';
    document.getElementById('textColorPicker').value = this.annotationTool.color;
    document.getElementById('textFontSize').value = '16';
    document.getElementById('textBold').classList.remove('active');
    document.getElementById('textItalic').classList.remove('active');
    this.textArea.focus();
    this._isCalloutMode = true;
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
      // Delete key removes selected annotation
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.annotationTool.selectedIndex >= 0) {
        e.preventDefault();
        this.annotationTool.deleteSelected();
        this.saveAnnotations();
        return;
      }

      const toolShortcuts = {
        'v': 'select', 'r': 'rect', 'd': 'dashedRect', 'u': 'roundedRect',
        'o': 'ellipse', 'a': 'arrow', 'w': 'doubleArrow',
        'l': 'line', 'p': 'pen', 'h': 'highlighter', 't': 'text',
        'n': 'number', 'm': 'mosaic', 'b': 'blur',
        'c': 'crop', 'k': 'callout', 'e': 'stamp', 'g': 'magnify', 'j': 'spotlight'
      };

      if (!e.ctrlKey && !e.metaKey && toolShortcuts[e.key.toLowerCase()]) {
        const tool = toolShortcuts[e.key.toLowerCase()];
        // Find the non-dropdown button for this tool
        const btn = this.toolbar.querySelector(`.tool-btn[data-tool="${tool}"]:not(.tool-group-dropdown .tool-btn)`);
        if (btn) {
          this.toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.annotationTool.setTool(tool);

          // Update group representative if tool is in a group
          const group = btn.closest('.tool-group');
          if (group) {
            group.querySelectorAll(':scope > .tool-btn').forEach(b => b.classList.remove('group-active'));
            btn.classList.add('group-active');
          }
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

    // Text toolbar controls
    const textBoldBtn = document.getElementById('textBold');
    const textItalicBtn = document.getElementById('textItalic');

    textBoldBtn.addEventListener('click', () => textBoldBtn.classList.toggle('active'));
    textItalicBtn.addEventListener('click', () => textItalicBtn.classList.toggle('active'));

    this.textConfirmBtn.addEventListener('click', () => this._confirmText());
    this.textCancelBtn.addEventListener('click', () => this.hideTextInput());

    // Enter to confirm text
    this.textArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._confirmText();
      }
      if (e.key === 'Escape') {
        this.hideTextInput();
      }
    });
  }

  _confirmText() {
    const fontSize = parseInt(document.getElementById('textFontSize').value);
    const bold = document.getElementById('textBold').classList.contains('active');
    const italic = document.getElementById('textItalic').classList.contains('active');
    const color = document.getElementById('textColorPicker').value;

    if (this._isCalloutMode) {
      this.annotationTool.addCallout(this.textArea.value, { fontSize, bold, italic, color });
      this._isCalloutMode = false;
    } else {
      this.annotationTool.addText(this.textArea.value, { fontSize, bold, italic, color });
    }
    this.saveAnnotations();
    this.hideTextInput();
  }

  showTextInput() {
    this.textInputOverlay.classList.remove('hidden');
    this.textArea.value = '';

    // Pre-fill controls with current settings
    document.getElementById('textColorPicker').value = this.annotationTool.color;
    document.getElementById('textFontSize').value = '20';
    document.getElementById('textBold').classList.add('active');
    document.getElementById('textItalic').classList.remove('active');

    this.textArea.focus();
  }

  hideTextInput() {
    this._isCalloutMode = false;
    this.textInputOverlay.classList.add('hidden');
    this.textArea.value = '';
  }

  // ==================== Screenshot loading ====================

  async loadScreenshot() {
    try {
      const urlParams = new URLSearchParams(window.location.search);

      // Check if this is a GIF encoding request
      const gifId = urlParams.get('gif');
      if (gifId) {
        await this.loadGifFrames(gifId);
        return;
      }

      // Get screenshot ID from URL parameter
      this.screenshotId = urlParams.get('id');

      if (!this.screenshotId) {
        this.showError(i18n('error_noScreenshot'));
        return;
      }

      // Check if this is a saved GIF (type in index)
      const indexResult = await chrome.storage.local.get('ss_index');
      const index = indexResult.ss_index || [];
      const meta = index.find(s => s.id === this.screenshotId);
      if (meta && meta.type === 'gif') {
        await this.loadSavedGif(this.screenshotId);
        return;
      }
      const result = await chrome.storage.local.get([this.screenshotId, this.screenshotId + '_annotations']);
      const screenshotData = result[this.screenshotId];

      if (!screenshotData) {
        this.showError(i18n('error_screenshotExpired'));
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
        this.showError(i18n('error_imageLoadFailed'));
      };

      img.src = screenshotData;
    } catch (error) {
      console.error('Load screenshot error:', error);
      this.showError(i18n('error_loadFailed'));
    }
  }

  // ==================== GIF Handling ====================

  async loadGifFrames(gifId) {
    this.isGifMode = true;
    this.loadingEl.querySelector('span').textContent = i18n('gif_encoding') || 'Encoding GIF...';

    try {
      const result = await chrome.storage.local.get('_gif_pending');
      const gifData = result._gif_pending;

      if (!gifData || gifData.id !== gifId) {
        // Pending frames already consumed — try loading the saved GIF
        await this.loadSavedGif(gifId);
        return;
      }

      const { frames, width, height, fps } = gifData;

      // Use first frame's natural size for pixel-perfect encoding
      const firstImg = await this._loadImageAsync(frames[0]);
      const targetW = firstImg.width;
      const targetH = firstImg.height;

      // Encode GIF using GIFEncoder at actual frame resolution
      const encoder = new GIFEncoder(targetW, targetH);
      encoder.setDelay(Math.round(1000 / fps));
      encoder.setRepeat(0); // Loop forever

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetW;
      tempCanvas.height = targetH;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      tempCtx.imageSmoothingEnabled = false; // Pixel-perfect, no blur

      for (let i = 0; i < frames.length; i++) {
        const pct = Math.round(((i + 1) / frames.length) * 100);
        this.loadingEl.querySelector('span').textContent =
          (i18n('gif_encodingProgress') || 'Encoding GIF... $1%').replace('$1', pct).replace('$PERCENT$', pct);

        const img = (i === 0) ? firstImg : await this._loadImageAsync(frames[i]);
        tempCtx.clearRect(0, 0, targetW, targetH);
        // Draw at native resolution — no scaling
        tempCtx.drawImage(img, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, targetW, targetH);
        encoder.addFrame(imageData);

        // Yield to UI thread
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
      }

      const gifBlob = encoder.encode();
      const gifDataUrl = await this._blobToDataUrl(gifBlob);

      // Save GIF to storage
      const id = gifData.id;
      await chrome.runtime.sendMessage({
        type: 'SAVE_GIF',
        id,
        dataUrl: gifDataUrl
      });

      // Clean up pending data
      await chrome.storage.local.remove('_gif_pending');

      // Display the GIF
      this.screenshotId = id;
      this.gifDataUrl = gifDataUrl;
      this._displayGif(gifDataUrl, targetW, targetH, frames.length, fps);

    } catch (error) {
      console.error('GIF encoding error:', error);
      this.showError(i18n('gif_encodingFailed') || 'GIF encoding failed');
    }
  }

  async loadSavedGif(id) {
    this.isGifMode = true;
    try {
      const result = await chrome.storage.local.get(id);
      const gifDataUrl = result[id];
      if (!gifDataUrl) {
        this.showError(i18n('error_screenshotExpired'));
        return;
      }

      this.gifDataUrl = gifDataUrl;
      const img = await this._loadImageAsync(gifDataUrl);
      this._displayGif(gifDataUrl, img.width, img.height);
    } catch (error) {
      this.showError(i18n('error_loadFailed'));
    }
  }

  _displayGif(dataUrl, width, height, frameCount, fps) {
    // Hide canvas, show GIF as <img> element
    this.canvas.classList.add('hidden');
    this.loadingEl.classList.add('hidden');

    // Disable annotation toolbar for GIF
    this.toolbar.style.opacity = '0.3';
    this.toolbar.style.pointerEvents = 'none';

    const gifContainer = document.createElement('div');
    gifContainer.className = 'gif-preview-container';
    gifContainer.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:12px;';

    const gifImg = document.createElement('img');
    gifImg.src = dataUrl;
    gifImg.style.cssText = `max-width:100%; border-radius:8px; box-shadow: 0 8px 24px rgba(44,53,42,0.08);`;
    gifContainer.appendChild(gifImg);

    if (frameCount && fps) {
      const info = document.createElement('div');
      info.style.cssText = 'font-size:13px; color:var(--on-surface-variant); opacity:0.7;';
      info.textContent = `GIF · ${width}×${height} · ${frameCount} frames · ${(frameCount / fps).toFixed(1)}s`;
      gifContainer.appendChild(info);
    }

    this.canvasWrapper.appendChild(gifContainer);

    // Update image info
    const base64Len = dataUrl.split(',')[1]?.length || 0;
    const sizeKB = Math.round((base64Len * 3 / 4) / 1024);
    this.imageInfoEl.textContent = `GIF · ${width} × ${height} px · ${this.formatSize(sizeKB)}`;
  }

  _loadImageAsync(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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

  async download() {
    const timestamp = this.getTimestamp();

    // GIF mode: download the GIF directly
    if (this.isGifMode && this.gifDataUrl) {
      const filename = `screensnap_${timestamp}.gif`;
      chrome.downloads.download({
        url: this.gifDataUrl,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          this.showToast(i18n('toast_saveFailed', chrome.runtime.lastError.message), false);
        } else {
          this.showToast(i18n('toast_saved'));
        }
      });
      return;
    }

    const settings = await loadSettings();
    const format = settings.saveFormat || 'png';
    const mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`;
    const quality = format === 'png' ? undefined : settings.imageQuality;
    const dataUrl = this.canvas.toDataURL(mimeType, quality);
    const filename = `screenshot_${timestamp}.${format}`;

    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        this.showToast(i18n('toast_saveFailed', chrome.runtime.lastError.message), false);
      } else {
        this.showToast(i18n('toast_saved'));
      }
    });
  }

  async copyToClipboard() {
    try {
      // GIF mode: copy first frame as PNG (GIF not supported in clipboard)
      if (this.isGifMode && this.gifDataUrl) {
        const img = await this._loadImageAsync(this.gifDataUrl);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        this.showToast(i18n('toast_copied'));
        return;
      }

      const blob = await new Promise(resolve => {
        this.canvas.toBlob(resolve, 'image/png');
      });

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      this.showToast(i18n('toast_copied'));
    } catch (error) {
      console.error('Copy to clipboard error:', error);
      this.showToast(i18n('toast_copyFailed'), false);
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

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  applyI18n();
  new ScreenSnapPreview();
});
