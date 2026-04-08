#!/usr/bin/env bash
set -euo pipefail

out_dir="embedded_folder_prev"
target_kb=2000
start_quality=94
min_quality=88
quality_step=2
max_px=0

start_index="${1:-0}"
if ! [[ "$start_index" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 [start_index]"
  exit 1
fi

mkdir -p "$out_dir"

size_bytes() { stat -f%z "$1"; }

to_kb() {
  python3 - "$1" <<'PY'
import sys
print(int(int(sys.argv[1]) / 1024))
PY
}

extract_best_exiftool() {
  local src="$1"
  local dst="$2"

  local best_tmp=""
  local best_size=0

  local tags=(
    JpgFromRaw
    PreviewImage
    OtherImage
    ThumbnailImage
  )

  for tag in "${tags[@]}"; do
    local tmp="${dst}.${tag}.tmp"
    rm -f "$tmp" 2>/dev/null || true

    if exiftool -q -q -b "-${tag}" "$src" > "$tmp" 2>/dev/null; then
      local s
      s="$(stat -f%z "$tmp" 2>/dev/null || echo 0)"
      if [[ "$s" -gt "$best_size" ]]; then
        best_size="$s"
        best_tmp="$tmp"
      else
        rm -f "$tmp" 2>/dev/null || true
      fi
    else
      rm -f "$tmp" 2>/dev/null || true
    fi
  done

  if [[ -z "$best_tmp" || "$best_size" -eq 0 ]]; then
    return 1
  fi

  mv -f "$best_tmp" "$dst"
  rm -f "${dst}."*.tmp 2>/dev/null || true
  return 0
}

compress_if_needed() {
  local jpg="$1"

  local kb
  kb="$(to_kb "$(size_bytes "$jpg")")"
  [[ "$kb" -le "$target_kb" ]] && return 0

  local q="$start_quality"
  while [[ "$q" -gt "$min_quality" ]]; do
    sips -s format jpeg -s formatOptions "$q" "$jpg" >/dev/null
    kb="$(to_kb "$(size_bytes "$jpg")")"
    [[ "$kb" -le "$target_kb" ]] && return 0
    q=$((q - quality_step))
  done

  if [[ "$max_px" -gt 0 ]]; then
    sips -Z "$max_px" "$jpg" >/dev/null
  fi
}

files="$(python3 - <<'PY'
import glob
files = glob.glob("*.RW2") + glob.glob("*.rw2")
files = sorted(files, key=lambda x: x.lower())
print("\n".join(files))
PY
)"

i="$start_index"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue

  out="$(printf "%s/%04d.jpg" "$out_dir" "$i")"
  tmp="${out}.tmp"

  if ! extract_best_exiftool "$f" "$tmp"; then
    echo "FAILED: $f"
    i=$((i+1))
    continue
  fi

  mv -f "$tmp" "$out"
  compress_if_needed "$out"

  final_kb="$(to_kb "$(size_bytes "$out")")"
  echo "OK: $f -> $(basename "$out") (${final_kb} KB)"

  i=$((i+1))
done <<< "$files"
echo "Done. Exported $((i - start_index)) images to '$out_dir'."