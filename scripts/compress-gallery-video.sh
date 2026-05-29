#!/usr/bin/env bash
# GitHub ~100MB dosya limiti — kaynak videoyu korur, web kopyası üretir.
# Kullanım:
#   ./scripts/compress-gallery-video.sh              # work/12 + work/14
#   ./scripts/compress-gallery-video.sh gallery/12/1.mp4
#   QUALITY=high ./scripts/compress-gallery-video.sh gallery/12/1.mp4
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

QUALITY="${QUALITY:-high}"
MAX_MB="${MAX_MB:-98}"

compress_one() {
  local rel="$1"
  local dir base src out tmp
  dir="$(dirname "$rel")"
  base="$(basename "$rel")"
  src="${dir}/${base%.mp4}-source.mp4"
  out="${dir}/${base}"
  tmp="${dir}/${base%.mp4}.web.tmp.mp4"

  if [[ -f "$src" ]]; then
    echo "Kaynak: $src"
  elif [[ -f "$out" ]]; then
    local size_mb
    size_mb=$(du -m "$out" | cut -f1)
    if [[ "$size_mb" -ge 95 ]]; then
      echo "Kaynak korunuyor (orijinal silinmez, kopya) → $src"
      cp -f "$out" "$src"
    fi
  else
    echo "Atlanıyor (video yok): $out"
    return 0
  fi

  if [[ ! -f "$src" ]]; then
    echo "Atlanıyor (kaynak yok): $src"
    return 0
  fi

  local dur size_mb
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")
  size_mb=$(du -m "$src" | cut -f1)
  echo "Sıkıştırılıyor (${size_mb}MB, ${dur}s, quality=$QUALITY): $src → $out"

  rm -f "$tmp"
  if [[ "$QUALITY" == "high" ]]; then
  ffmpeg -y -hide_banner -loglevel error -i "$src" \
    -c:v libx264 -crf 17 -preset slow \
    -vf "scale='min(1920,iw)':-2" \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    "$tmp"
  else
    local vb
    vb=$(awk -v t="$MAX_MB" -v d="$dur" 'BEGIN { printf "%d", (t*8*1024/d) - 128 }')
    if [[ "$vb" -lt 400 ]]; then vb=400; fi
    if [[ "$vb" -gt 2800 ]]; then vb=2800; fi
    ffmpeg -y -hide_banner -loglevel error -i "$src" \
      -c:v libx264 -b:v "${vb}k" -maxrate "$((vb + 400))k" -bufsize "$((vb * 2))k" \
      -vf "scale='min(1920,iw)':-2" -preset medium \
      -c:a aac -b:a 96k -movflags +faststart \
      "$tmp"
  fi

  local out_mb
  out_mb=$(du -m "$tmp" | cut -f1)
  if [[ "$out_mb" -gt "$MAX_MB" ]]; then
    echo "Hâlâ ${out_mb}MB — GitHub limiti için bitrate modu (${MAX_MB}MB)…"
    rm -f "$tmp"
    local vb
    vb=$(awk -v t="$MAX_MB" -v d="$dur" 'BEGIN { printf "%d", (t*8*1024/d) - 128 }')
    if [[ "$vb" -lt 400 ]]; then vb=400; fi
    if [[ "$vb" -gt 12000 ]]; then vb=12000; fi
    ffmpeg -y -hide_banner -loglevel error -i "$src" \
      -c:v libx264 -b:v "${vb}k" -maxrate "$((vb + 500))k" -bufsize "$((vb * 2))k" \
      -vf "scale='min(1920,iw)':-2" -preset medium \
      -c:a aac -b:a 128k -movflags +faststart \
      "$tmp"
    out_mb=$(du -m "$tmp" | cut -f1)
  fi
  if [[ "$out_mb" -gt "$MAX_MB" ]]; then
    echo "Hâlâ ${out_mb}MB — son tur (crf 24, 1280p)…"
    rm -f "$tmp"
    ffmpeg -y -hide_banner -loglevel error -i "$src" \
      -c:v libx264 -crf 24 -preset medium \
      -vf "scale='min(1280,iw)':-2" \
      -c:a aac -b:a 96k -movflags +faststart \
      "$tmp"
    out_mb=$(du -m "$tmp" | cut -f1)
  fi

  mv "$tmp" "$out"
  echo "Web: $(du -h "$out" | cut -f1) (kaynak: $(du -h "$src" | cut -f1))"
}

if [[ $# -gt 0 ]]; then
  for rel in "$@"; do
    compress_one "$rel"
  done
else
  echo "Belirli dosya ver: ./scripts/compress-gallery-video.sh gallery/12/1.mp4"
  echo "(Varsayılan olarak work/12 veya work/14 otomatik sıkıştırılmaz — 1.mp4 üzerine yazılmaz.)"
  exit 1
fi

node scripts/sync-gallery-from-root.mjs
echo "Bitti. Kaynak *-source.mp4 git'e eklenmez (.gitignore)."
