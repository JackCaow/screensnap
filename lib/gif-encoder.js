/**
 * Minimal GIF89a encoder for ScreenSnap
 * Supports animated GIF creation from canvas frames
 * Based on LZW compression with NeuQuant color quantization
 */

class GIFEncoder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.frames = [];
    this.delay = 100; // ms between frames (default 10fps)
    this.repeat = 0; // 0 = loop forever, -1 = no repeat
  }

  setDelay(ms) {
    this.delay = ms;
  }

  setRepeat(count) {
    this.repeat = count;
  }

  /**
   * Add a frame from ImageData
   * @param {ImageData} imageData - RGBA pixel data
   */
  addFrame(imageData) {
    // Quantize colors to 256 using median-cut
    const { palette, indexedPixels } = this._quantize(imageData);
    this.frames.push({ palette, indexedPixels });
  }

  /**
   * Encode all frames into a GIF blob
   * Uses per-frame local color tables for maximum quality
   * @returns {Blob}
   */
  encode() {
    const parts = [];
    const colorTableBits = 8; // 256 colors = 2^8

    // Header
    parts.push(this._str('GIF89a'));

    // Logical Screen Descriptor — NO global color table (each frame has its own)
    parts.push(this._lsd());

    // Netscape extension for looping
    if (this.repeat >= 0) {
      parts.push(this._netscapeExt());
    }

    // Frames — each with its own Local Color Table
    for (const frame of this.frames) {
      // Graphic Control Extension (dispose=restoreToBackground for clean animation)
      parts.push(this._gce());

      // Image Descriptor WITH local color table flag
      parts.push(this._imageDescLocal(colorTableBits));

      // Local Color Table (256 * 3 = 768 bytes)
      parts.push(new Uint8Array(frame.palette));

      // LZW compressed pixel data
      const minCodeSize = Math.max(2, colorTableBits);
      parts.push(new Uint8Array([minCodeSize]));
      parts.push(this._lzwEncode(frame.indexedPixels, minCodeSize));

      // Block terminator
      parts.push(new Uint8Array([0]));
    }

    // Trailer
    parts.push(new Uint8Array([0x3B]));

    return new Blob(parts, { type: 'image/gif' });
  }

  _str(s) {
    return new Uint8Array([...s].map(c => c.charCodeAt(0)));
  }

  _lsd() {
    const buf = new Uint8Array(7);
    buf[0] = this.width & 0xFF;
    buf[1] = (this.width >> 8) & 0xFF;
    buf[2] = this.height & 0xFF;
    buf[3] = (this.height >> 8) & 0xFF;
    // packed: NO global color table (GCT flag=0), color resolution=7 (8-bit)
    buf[4] = 0x70; // 0b01110000 — no GCT, 8-bit color depth hint
    buf[5] = 0; // background color index
    buf[6] = 0; // pixel aspect ratio
    return buf;
  }

  _netscapeExt() {
    return new Uint8Array([
      0x21, 0xFF, // Application Extension
      0x0B, // Block size
      0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, // "NETSCAPE"
      0x32, 0x2E, 0x30, // "2.0"
      0x03, // Sub-block size
      0x01, // Sub-block ID
      this.repeat & 0xFF, (this.repeat >> 8) & 0xFF,
      0x00 // Block terminator
    ]);
  }

  _gce() {
    const d = Math.round(this.delay / 10); // GIF delay is in centiseconds
    return new Uint8Array([
      0x21, 0xF9, // Graphic Control Extension
      0x04, // Block size
      0x00, // Packed: no transparency, dispose=none
      d & 0xFF, (d >> 8) & 0xFF, // Delay
      0x00, // Transparent color index
      0x00 // Block terminator
    ]);
  }

  _imageDesc() {
    const buf = new Uint8Array(10);
    buf[0] = 0x2C; // Image separator
    buf[1] = buf[2] = buf[3] = buf[4] = 0; // Left, Top = 0,0
    buf[5] = this.width & 0xFF;
    buf[6] = (this.width >> 8) & 0xFF;
    buf[7] = this.height & 0xFF;
    buf[8] = (this.height >> 8) & 0xFF;
    buf[9] = 0; // Packed: no local color table, not interlaced
    return buf;
  }

  _imageDescLocal(colorTableBits) {
    const buf = new Uint8Array(10);
    buf[0] = 0x2C; // Image separator
    buf[1] = buf[2] = buf[3] = buf[4] = 0; // Left, Top = 0,0
    buf[5] = this.width & 0xFF;
    buf[6] = (this.width >> 8) & 0xFF;
    buf[7] = this.height & 0xFF;
    buf[8] = (this.height >> 8) & 0xFF;
    // Packed: local color table flag=1 (bit 7), not interlaced, not sorted, LCT size
    buf[9] = 0x80 | ((colorTableBits - 1) & 0x07);
    return buf;
  }

  /**
   * Quantize RGBA ImageData to 256 colors using median-cut + Floyd-Steinberg dithering
   * Dithering spreads quantization error to neighbors, simulating smooth gradients
   */
  _quantize(imageData) {
    const pixels = imageData.data;
    const w = this.width;
    const h = this.height;
    const numPixels = w * h;

    // Sample pixels for palette generation (use all pixels for best quality)
    const maxSamples = 150000;
    const step = Math.max(1, Math.floor(numPixels / maxSamples));
    const samples = [];
    for (let i = 0; i < numPixels; i += step) {
      const ri = i * 4;
      samples.push([pixels[ri], pixels[ri + 1], pixels[ri + 2]]);
    }

    // Median-cut: recursively split into 256 color buckets
    const palette = this._medianCut(samples, 256);
    while (palette.length < 256) palette.push([0, 0, 0]);

    // Build flat palette
    const paletteFlat = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      paletteFlat[i * 3] = palette[i][0];
      paletteFlat[i * 3 + 1] = palette[i][1];
      paletteFlat[i * 3 + 2] = palette[i][2];
    }
    const paletteCount = Math.min(palette.length, 256);

    // Floyd-Steinberg dithering: work on a mutable copy of pixel data
    // Store as signed int16 to allow error accumulation beyond 0-255
    const buf = new Int16Array(numPixels * 3);
    for (let i = 0; i < numPixels; i++) {
      buf[i * 3] = pixels[i * 4];
      buf[i * 3 + 1] = pixels[i * 4 + 1];
      buf[i * 3 + 2] = pixels[i * 4 + 2];
    }

    const indexedPixels = new Uint8Array(numPixels);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const bi = i * 3;

        // Clamp current pixel
        const r = Math.max(0, Math.min(255, buf[bi]));
        const g = Math.max(0, Math.min(255, buf[bi + 1]));
        const b = Math.max(0, Math.min(255, buf[bi + 2]));

        // Find nearest palette color
        const idx = this._findNearest(r, g, b, paletteFlat, paletteCount);
        indexedPixels[i] = idx;

        // Compute quantization error
        const pr = paletteFlat[idx * 3];
        const pg = paletteFlat[idx * 3 + 1];
        const pb = paletteFlat[idx * 3 + 2];
        const er = r - pr;
        const eg = g - pg;
        const eb = b - pb;

        // Distribute error to neighbors (Floyd-Steinberg coefficients)
        // Right: 7/16, Bottom-left: 3/16, Bottom: 5/16, Bottom-right: 1/16
        if (x + 1 < w) {
          const ni = bi + 3;
          buf[ni] += (er * 7) >> 4;
          buf[ni + 1] += (eg * 7) >> 4;
          buf[ni + 2] += (eb * 7) >> 4;
        }
        if (y + 1 < h) {
          if (x > 0) {
            const ni = (i + w - 1) * 3;
            buf[ni] += (er * 3) >> 4;
            buf[ni + 1] += (eg * 3) >> 4;
            buf[ni + 2] += (eb * 3) >> 4;
          }
          {
            const ni = (i + w) * 3;
            buf[ni] += (er * 5) >> 4;
            buf[ni + 1] += (eg * 5) >> 4;
            buf[ni + 2] += (eb * 5) >> 4;
          }
          if (x + 1 < w) {
            const ni = (i + w + 1) * 3;
            buf[ni] += (er * 1) >> 4;
            buf[ni + 1] += (eg * 1) >> 4;
            buf[ni + 2] += (eb * 1) >> 4;
          }
        }
      }
    }

    return { palette: paletteFlat, indexedPixels };
  }

  /**
   * Median-cut color quantization
   */
  _medianCut(colors, targetCount) {
    if (colors.length === 0) return [[0, 0, 0]];

    const boxes = [colors];
    while (boxes.length < targetCount) {
      // Find box with largest range to split
      let bestBox = -1;
      let bestRange = -1;
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].length < 2) continue;
        const range = this._boxRange(boxes[i]);
        if (range.maxRange > bestRange) {
          bestRange = range.maxRange;
          bestBox = i;
        }
      }
      if (bestBox === -1) break;

      const box = boxes[bestBox];
      const range = this._boxRange(box);
      // Sort by the channel with the largest range
      box.sort((a, b) => a[range.channel] - b[range.channel]);
      const mid = Math.floor(box.length / 2);
      boxes[bestBox] = box.slice(0, mid);
      boxes.push(box.slice(mid));
    }

    // Compute average color for each box
    return boxes.map(box => {
      let rSum = 0, gSum = 0, bSum = 0;
      for (const c of box) { rSum += c[0]; gSum += c[1]; bSum += c[2]; }
      const n = box.length;
      return [Math.round(rSum / n), Math.round(gSum / n), Math.round(bSum / n)];
    });
  }

  _boxRange(colors) {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const c of colors) {
      if (c[0] < rMin) rMin = c[0]; if (c[0] > rMax) rMax = c[0];
      if (c[1] < gMin) gMin = c[1]; if (c[1] > gMax) gMax = c[1];
      if (c[2] < bMin) bMin = c[2]; if (c[2] > bMax) bMax = c[2];
    }
    const rRange = rMax - rMin, gRange = gMax - gMin, bRange = bMax - bMin;
    const maxRange = Math.max(rRange, gRange, bRange);
    const channel = maxRange === rRange ? 0 : maxRange === gRange ? 1 : 2;
    return { maxRange, channel };
  }

  _findNearest(r, g, b, palette, count) {
    let bestDist = Infinity;
    let bestIdx = 0;
    for (let i = 0; i < count; i++) {
      const dr = r - palette[i * 3];
      const dg = g - palette[i * 3 + 1];
      const db = b - palette[i * 3 + 2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
    return bestIdx;
  }

  /**
   * LZW encode indexed pixels
   */
  _lzwEncode(pixels, minCodeSize) {
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;
    const maxCode = 4096;

    // Initialize code table
    let table = new Map();
    for (let i = 0; i < clearCode; i++) {
      table.set(String(i), i);
    }

    const output = [];
    let bitBuffer = 0;
    let bitCount = 0;
    const subBlocks = [];
    let subBlock = [];

    function writeBits(code, size) {
      bitBuffer |= (code << bitCount);
      bitCount += size;
      while (bitCount >= 8) {
        subBlock.push(bitBuffer & 0xFF);
        bitBuffer >>= 8;
        bitCount -= 8;
        if (subBlock.length === 255) {
          subBlocks.push(subBlock.length, ...subBlock);
          subBlock = [];
        }
      }
    }

    // Write clear code
    writeBits(clearCode, codeSize);

    if (pixels.length === 0) {
      writeBits(eoiCode, codeSize);
      if (bitCount > 0) {
        subBlock.push(bitBuffer & 0xFF);
      }
      if (subBlock.length > 0) {
        subBlocks.push(subBlock.length, ...subBlock);
      }
      return new Uint8Array(subBlocks);
    }

    let current = String(pixels[0]);

    for (let i = 1; i < pixels.length; i++) {
      const next = current + ',' + pixels[i];
      if (table.has(next)) {
        current = next;
      } else {
        writeBits(table.get(current), codeSize);
        if (nextCode < maxCode) {
          table.set(next, nextCode++);
          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          // Table full — emit clear code and reset
          writeBits(clearCode, codeSize);
          table = new Map();
          for (let j = 0; j < clearCode; j++) {
            table.set(String(j), j);
          }
          codeSize = minCodeSize + 1;
          nextCode = eoiCode + 1;
        }
        current = String(pixels[i]);
      }
    }

    // Write remaining
    writeBits(table.get(current), codeSize);
    writeBits(eoiCode, codeSize);

    // Flush remaining bits
    if (bitCount > 0) {
      subBlock.push(bitBuffer & 0xFF);
    }
    if (subBlock.length > 0) {
      subBlocks.push(subBlock.length, ...subBlock);
    }

    return new Uint8Array(subBlocks);
  }
}

// Export for use in preview page
if (typeof window !== 'undefined') {
  window.GIFEncoder = GIFEncoder;
}
