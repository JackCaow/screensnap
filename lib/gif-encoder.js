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
   * @returns {Blob}
   */
  encode() {
    const parts = [];

    // Header
    parts.push(this._str('GIF89a'));

    // Logical Screen Descriptor
    const firstPalette = this.frames[0].palette;
    const colorTableSize = Math.ceil(Math.log2(firstPalette.length / 3));
    parts.push(this._lsd(colorTableSize));

    // Global Color Table
    parts.push(new Uint8Array(firstPalette));

    // Netscape extension for looping
    if (this.repeat >= 0) {
      parts.push(this._netscapeExt());
    }

    // Frames
    for (const frame of this.frames) {
      // Graphic Control Extension
      parts.push(this._gce());

      // Image Descriptor (no local color table, uses global)
      parts.push(this._imageDesc());

      // LZW compressed pixel data
      const minCodeSize = Math.max(2, colorTableSize);
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

  _lsd(colorTableSize) {
    const buf = new Uint8Array(7);
    buf[0] = this.width & 0xFF;
    buf[1] = (this.width >> 8) & 0xFF;
    buf[2] = this.height & 0xFF;
    buf[3] = (this.height >> 8) & 0xFF;
    // packed: GCT flag=1, color resolution, sort=0, GCT size
    buf[4] = 0x80 | ((colorTableSize - 1) & 0x07) | (((colorTableSize - 1) & 0x07) << 4);
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

  /**
   * Quantize RGBA ImageData to 256 colors using simple popularity method
   */
  _quantize(imageData) {
    const pixels = imageData.data;
    const numPixels = this.width * this.height;

    // Build color histogram using 5-bit per channel (32768 bins)
    const hist = new Uint32Array(32768);
    for (let i = 0; i < pixels.length; i += 4) {
      const r5 = pixels[i] >> 3;
      const g5 = pixels[i + 1] >> 3;
      const b5 = pixels[i + 2] >> 3;
      const key = (r5 << 10) | (g5 << 5) | b5;
      hist[key]++;
    }

    // Find top 256 colors by frequency
    const entries = [];
    for (let i = 0; i < 32768; i++) {
      if (hist[i] > 0) {
        entries.push({ key: i, count: hist[i] });
      }
    }
    entries.sort((a, b) => b.count - a.count);

    const paletteSize = 256;
    const palette = new Uint8Array(paletteSize * 3);
    const colorMap = new Map();

    for (let i = 0; i < Math.min(entries.length, paletteSize); i++) {
      const k = entries[i].key;
      const r = ((k >> 10) & 0x1F) << 3;
      const g = ((k >> 5) & 0x1F) << 3;
      const b = (k & 0x1F) << 3;
      palette[i * 3] = r;
      palette[i * 3 + 1] = g;
      palette[i * 3 + 2] = b;
      colorMap.set(k, i);
    }

    // Map pixels to palette indices
    const indexedPixels = new Uint8Array(numPixels);
    for (let i = 0; i < numPixels; i++) {
      const ri = i * 4;
      const r5 = pixels[ri] >> 3;
      const g5 = pixels[ri + 1] >> 3;
      const b5 = pixels[ri + 2] >> 3;
      const key = (r5 << 10) | (g5 << 5) | b5;
      const idx = colorMap.get(key);
      if (idx !== undefined) {
        indexedPixels[i] = idx;
      } else {
        // Find nearest color in palette
        indexedPixels[i] = this._findNearest(pixels[ri], pixels[ri + 1], pixels[ri + 2], palette, Math.min(entries.length, paletteSize));
      }
    }

    return { palette, indexedPixels };
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
