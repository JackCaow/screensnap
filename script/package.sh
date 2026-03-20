#!/bin/bash
# Build a clean ZIP for Chrome Web Store submission
# Usage: bash script/package.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/manifest.json').version")
OUT="$ROOT/screensnap-v${VERSION}.zip"

echo "Packaging ScreenSnap v${VERSION}..."

# Remove old package if exists
rm -f "$OUT"

cd "$ROOT"

zip -r "$OUT" \
  manifest.json \
  _locales/ \
  assets/icons/ \
  background/ \
  content/ \
  popup/ \
  preview/ \
  options/ \
  history/ \
  utils/ \
  -x "*.DS_Store" \
  -x "*/.DS_Store" \
  -x "*.map"

SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo "Done! $OUT ($SIZE)"
echo ""
echo "Next steps:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Upload $OUT"
echo "  3. Fill in store listing details"
echo "  4. Submit for review"
