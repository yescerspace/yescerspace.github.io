#!/usr/bin/env bash
# GitHub tek dosya limiti ~100MB — galeri videolarını web için sıkıştırır.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

compress_one() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "Atlanıyor (yok): $f"
    return 0
  fi
  local size_mb
  size_mb=$(du -m "$f" | cut -f1)
  if [[ "$size_mb" -lt 95 ]]; then
    echo "OK (${size_mb}MB): $f"
    return 0
  fi
  echo "Sıkıştırılıyor (${size_mb}MB): $f"
  local dur
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  local target_mb=48
  local vb
  vb=$(awk -v t="$target_mb" -v d="$dur" 'BEGIN { printf "%d", (t*8*1024/d) - 96 }')
  if [[ "$vb" -lt 400 ]]; then vb=400; fi
  if [[ "$vb" -gt 2800 ]]; then vb=2800; fi
  local tmp="${f%.mp4}.web.mp4"
  ffmpeg -y -hide_banner -loglevel error -i "$f" \
    -c:v libx264 -b:v "${vb}k" -maxrate "$((vb + 300))k" -bufsize "$((vb * 2))k" \
    -vf "scale='min(1280,iw)':-2" -preset fast \
    -c:a aac -b:a 96k -movflags +faststart \
    "$tmp"
  mv "$tmp" "$f"
  du -h "$f"
}

for rel in gallery/12/1.mp4 gallery/14/1.mp4; do
  compress_one "$rel"
done

node scripts/sync-gallery-from-root.mjs
echo "Bitti."
