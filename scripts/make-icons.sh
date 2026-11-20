#!/usr/bin/env bash
# Renders the Ruvox app icon (a Cyrillic "Р" on the accent color) to every size we ship.
# Needs rsvg-convert. Run from the repo root; outputs are committed.
set -euo pipefail
svg=frontend/public/icons/icon.svg
for size in 192 512; do
  rsvg-convert -w "$size" -h "$size" "$svg" -o "frontend/public/icons/icon-$size.png"
done
rsvg-convert -w 512 -h 512 frontend/public/icons/maskable.svg -o frontend/public/icons/icon-maskable-512.png
rsvg-convert -w 180 -h 180 "$svg" -o frontend/public/icons/apple-touch-icon.png
for size in 32 128 256 512; do
  rsvg-convert -w "$size" -h "$size" "$svg" -o "src-tauri/icons/${size}x${size}.png"
done
cp src-tauri/icons/256x256.png "src-tauri/icons/128x128@2x.png"
cp src-tauri/icons/512x512.png src-tauri/icons/icon.png
