#!/usr/bin/env node
/**
 * Generate Chrome Web Store promotional images.
 *
 * Requirements:
 *   npm install canvas
 *
 * Generates:
 *   store/promo-small.png   (440 x 280)  — Small promo tile
 *   store/promo-marquee.png (1280 x 800) — Marquee / large promo
 *
 * Usage:
 *   node script/generate-store-assets.js
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'store');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Brand colors
const PRIMARY = '#6366f1';
const PRIMARY_DARK = '#4f46e5';
const BG_GRADIENT_START = '#eef2ff';
const BG_GRADIENT_END = '#e0e7ff';
const TEXT_COLOR = '#1e293b';
const TEXT_SECONDARY = '#64748b';

function drawIcon(ctx, x, y, size) {
  const r = size * 0.18;
  const s = size;

  // Rounded square background
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, r);
  ctx.fillStyle = PRIMARY;
  ctx.fill();

  // Camera viewfinder corners
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.06;
  ctx.lineCap = 'round';

  const m = size * 0.25; // margin
  const c = size * 0.2;  // corner length

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x + m, y + m + c);
  ctx.lineTo(x + m, y + m);
  ctx.lineTo(x + m + c, y + m);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + s - m - c, y + m);
  ctx.lineTo(x + s - m, y + m);
  ctx.lineTo(x + s - m, y + m + c);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x + m, y + s - m - c);
  ctx.lineTo(x + m, y + s - m);
  ctx.lineTo(x + m + c, y + s - m);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + s - m - c, y + s - m);
  ctx.lineTo(x + s - m, y + s - m);
  ctx.lineTo(x + s - m, y + s - m - c);
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s / 2, size * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawBackground(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, BG_GRADIENT_START);
  grad.addColorStop(1, BG_GRADIENT_END);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle dot grid pattern
  ctx.fillStyle = 'rgba(99, 102, 241, 0.06)';
  for (let x = 20; x < w; x += 30) {
    for (let y = 20; y < h; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ==================== Small Promo (440 x 280) ====================
function generateSmallPromo() {
  const W = 440, H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, W, H);

  // Icon
  const iconSize = 72;
  drawIcon(ctx, W / 2 - iconSize / 2, 50, iconSize);

  // Title
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ScreenSnap', W / 2, 165);

  // Subtitle
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Screenshot & Annotation Tool', W / 2, 195);

  // Feature pills
  const pills = ['Region', 'Full Page', 'Annotate', 'History'];
  const pillW = 80, pillH = 26, pillGap = 8;
  const totalPillW = pills.length * pillW + (pills.length - 1) * pillGap;
  let px = (W - totalPillW) / 2;
  const py = 220;

  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';

  for (const pill of pills) {
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, 13);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = PRIMARY;
    ctx.fillText(pill, px + pillW / 2, py + 17);
    px += pillW + pillGap;
  }

  return canvas;
}

// ==================== Marquee (1280 x 800) ====================
function generateMarquee() {
  const W = 1280, H = 800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, W, H);

  // Left side: branding
  const leftX = 120;

  // Icon
  const iconSize = 80;
  drawIcon(ctx, leftX, 200, iconSize);

  // Title
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ScreenSnap', leftX, 340);

  // Subtitle
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Professional Screenshot & Annotation Tool', leftX, 380);

  // Feature list
  const features = [
    'Region, visible area, and full-page capture',
    '14+ annotation tools with undo/redo',
    'Screenshot history with search & filter',
    'PNG, JPG, WebP export with quality control',
    '100% local — zero data collection'
  ];

  ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
  features.forEach((feat, i) => {
    const fy = 430 + i * 34;

    // Checkmark circle
    ctx.beginPath();
    ctx.arc(leftX + 10, fy - 5, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✓', leftX + 10, fy - 1);

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(feat, leftX + 32, fy);
  });

  // Right side: mockup card
  const cardX = 680, cardY = 120, cardW = 480, cardH = 560;
  ctx.save();

  // Card shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;

  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.restore();

  // Card header bar
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, 44, [16, 16, 0, 0]);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();

  // Dots
  [cardX + 20, cardX + 38, cardX + 56].forEach((dx, i) => {
    ctx.beginPath();
    ctx.arc(dx, cardY + 22, 5, 0, Math.PI * 2);
    ctx.fillStyle = ['#ef4444', '#eab308', '#22c55e'][i];
    ctx.fill();
  });

  // Toolbar mockup
  const tbY = cardY + 54;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(cardX + 16, tbY, cardW - 32, 36);

  // Tool icons (rectangles as placeholders)
  const tools = 8;
  for (let i = 0; i < tools; i++) {
    ctx.beginPath();
    ctx.roundRect(cardX + 24 + i * 44, tbY + 6, 24, 24, 4);
    ctx.fillStyle = i === 0 ? PRIMARY : '#cbd5e1';
    ctx.fill();
  }

  // Canvas area mockup
  const canvasY = tbY + 48;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(cardX + 16, canvasY, cardW - 32, cardH - (canvasY - cardY) - 16);

  // Mock annotations
  // Rectangle
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.strokeRect(cardX + 60, canvasY + 40, 160, 100);

  // Arrow
  ctx.beginPath();
  ctx.moveTo(cardX + 280, canvasY + 80);
  ctx.lineTo(cardX + 380, canvasY + 140);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(cardX + 380, canvasY + 140);
  ctx.lineTo(cardX + 368, canvasY + 128);
  ctx.lineTo(cardX + 372, canvasY + 142);
  ctx.closePath();
  ctx.fillStyle = '#3b82f6';
  ctx.fill();

  // Number marker
  ctx.beginPath();
  ctx.arc(cardX + 120, canvasY + 200, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', cardX + 120, canvasY + 200);
  ctx.textBaseline = 'alphabetic';

  // Text annotation
  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Bug here!', cardX + 260, canvasY + 220);

  // Mosaic block
  for (let bx = 0; bx < 6; bx++) {
    for (let by = 0; by < 3; by++) {
      ctx.fillStyle = `hsl(220, 10%, ${65 + Math.random() * 20}%)`;
      ctx.fillRect(cardX + 80 + bx * 16, canvasY + 280 + by * 16, 15, 15);
    }
  }

  return canvas;
}

// ==================== Generate & Save ====================

const small = generateSmallPromo();
fs.writeFileSync(path.join(OUT_DIR, 'promo-small.png'), small.toBuffer('image/png'));
console.log('Created store/promo-small.png (440x280)');

const marquee = generateMarquee();
fs.writeFileSync(path.join(OUT_DIR, 'promo-marquee.png'), marquee.toBuffer('image/png'));
console.log('Created store/promo-marquee.png (1280x800)');

console.log('\nDone! Also prepare:');
console.log('  - 1-5 screenshots (1280x800 or 640x400)');
console.log('  - Upload at https://chrome.google.com/webstore/devconsole');
