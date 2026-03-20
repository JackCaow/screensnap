const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Generate modern, stylized icons for ScreenSnap
 * Design: Camera viewfinder with gradient effect
 */

// Create SVG icon
function createSVG(size) {
  const padding = size * 0.1;
  const innerSize = size - padding * 2;
  const cornerRadius = size * 0.15;
  const strokeWidth = Math.max(2, size * 0.06);
  const centerX = size / 2;
  const centerY = size / 2;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#818cf8;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="grad2" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background rounded square -->
  <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" rx="${cornerRadius}" fill="url(#grad1)"/>

  <!-- Viewfinder corners -->
  <g stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none">
    <!-- Top-left corner -->
    <path d="M${size * 0.25} ${size * 0.35} L${size * 0.25} ${size * 0.25} L${size * 0.35} ${size * 0.25}"/>

    <!-- Top-right corner -->
    <path d="M${size * 0.65} ${size * 0.25} L${size * 0.75} ${size * 0.25} L${size * 0.75} ${size * 0.35}"/>

    <!-- Bottom-left corner -->
    <path d="M${size * 0.25} ${size * 0.65} L${size * 0.25} ${size * 0.75} L${size * 0.35} ${size * 0.75}"/>

    <!-- Bottom-right corner -->
    <path d="M${size * 0.65} ${size * 0.75} L${size * 0.75} ${size * 0.75} L${size * 0.75} ${size * 0.65}"/>
  </g>

  <!-- Center circle (lens) -->
  <circle cx="${centerX}" cy="${centerY}" r="${size * 0.12}" fill="white" opacity="0.9"/>
  <circle cx="${centerX}" cy="${centerY}" r="${size * 0.06}" fill="url(#grad2)"/>
</svg>`;
}

// Convert SVG to PNG using canvas simulation
function createPNG(size) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData.writeUInt8(8, 8);   // bit depth
  ihdrData.writeUInt8(6, 9);   // color type (RGBA)
  ihdrData.writeUInt8(0, 10);  // compression
  ihdrData.writeUInt8(0, 11);  // filter
  ihdrData.writeUInt8(0, 12);  // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Create image data
  const rawData = [];
  const padding = size * 0.1;
  const innerSize = size - padding * 2;
  const cornerRadius = size * 0.15;
  const strokeWidth = Math.max(2, size * 0.06);
  const centerX = size / 2;
  const centerY = size / 2;

  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      const pixel = getPixelColor(x, y, size, padding, innerSize, cornerRadius, strokeWidth, centerX, centerY);
      rawData.push(...pixel);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function getPixelColor(x, y, size, padding, innerSize, cornerRadius, strokeWidth, centerX, centerY) {
  const transparent = [0, 0, 0, 0];

  // Gradient colors
  const gradientStart = [129, 140, 248]; // #818cf8
  const gradientEnd = [99, 102, 241];    // #6366f1
  const white = [255, 255, 255];
  const darkPurple = [79, 70, 229];      // #4f46e5

  // Check if inside rounded rectangle
  const rx = x - padding;
  const ry = y - padding;

  if (!isInRoundedRect(rx, ry, innerSize, innerSize, cornerRadius)) {
    return transparent;
  }

  // Calculate gradient factor
  const gradientFactor = ((x - padding) + (y - padding)) / (innerSize * 2);
  const bgColor = lerpColor(gradientStart, gradientEnd, gradientFactor);

  // Check center circles
  const dx = x - centerX;
  const dy = y - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Inner circle (dark purple)
  if (dist <= size * 0.06) {
    return [...darkPurple, 255];
  }

  // Outer circle (white)
  if (dist <= size * 0.12) {
    return [...white, 230];
  }

  // Check viewfinder corners (white strokes)
  if (isOnViewfinderCorner(x, y, size, strokeWidth)) {
    return [...white, 255];
  }

  return [...bgColor.map(Math.round), 255];
}

function isInRoundedRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;

  // Check corners
  if (x < r && y < r) {
    return (x - r) * (x - r) + (y - r) * (y - r) <= r * r;
  }
  if (x >= w - r && y < r) {
    return (x - (w - r)) * (x - (w - r)) + (y - r) * (y - r) <= r * r;
  }
  if (x < r && y >= h - r) {
    return (x - r) * (x - r) + (y - (h - r)) * (y - (h - r)) <= r * r;
  }
  if (x >= w - r && y >= h - r) {
    return (x - (w - r)) * (x - (w - r)) + (y - (h - r)) * (y - (h - r)) <= r * r;
  }

  return true;
}

function isOnViewfinderCorner(x, y, size, strokeWidth) {
  const half = strokeWidth / 2;
  const corners = [
    // Top-left
    { x1: size * 0.25, y1: size * 0.25, x2: size * 0.25, y2: size * 0.35 },
    { x1: size * 0.25, y1: size * 0.25, x2: size * 0.35, y2: size * 0.25 },
    // Top-right
    { x1: size * 0.75, y1: size * 0.25, x2: size * 0.75, y2: size * 0.35 },
    { x1: size * 0.65, y1: size * 0.25, x2: size * 0.75, y2: size * 0.25 },
    // Bottom-left
    { x1: size * 0.25, y1: size * 0.65, x2: size * 0.25, y2: size * 0.75 },
    { x1: size * 0.25, y1: size * 0.75, x2: size * 0.35, y2: size * 0.75 },
    // Bottom-right
    { x1: size * 0.75, y1: size * 0.65, x2: size * 0.75, y2: size * 0.75 },
    { x1: size * 0.65, y1: size * 0.75, x2: size * 0.75, y2: size * 0.75 },
  ];

  for (const line of corners) {
    if (isOnLine(x, y, line.x1, line.y1, line.x2, line.y2, half)) {
      return true;
    }
  }
  return false;
}

function isOnLine(px, py, x1, y1, x2, y2, thickness) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return false;

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;
  const dist = Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);

  return dist <= thickness;
}

function lerpColor(c1, c2, t) {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t,
  ];
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = getCRC32Table();

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  return crc ^ 0xFFFFFFFF;
}

let crcTable = null;
function getCRC32Table() {
  if (crcTable) return crcTable;

  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  return crcTable;
}

// Generate files
const iconsDir = path.join(__dirname, '..', 'assets', 'icons');

// Generate PNG icons
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const png = createPNG(size);
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
});

// Generate SVG icons
sizes.forEach(size => {
  const svg = createSVG(size);
  const filename = path.join(iconsDir, `icon${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Created ${filename}`);
});

// Generate a large SVG for reference
const largeSvg = createSVG(512);
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), largeSvg);
console.log('Created icon.svg (512x512)');

console.log('\nAll icons generated successfully!');
