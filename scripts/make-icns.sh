#!/bin/bash
# Rebuilds build/icon.icns from scripts/make-icon.swift. macOS only (uses sips and iconutil).
set -euo pipefail
cd "$(dirname "$0")/.."

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

swift scripts/make-icon.swift "$work/icon-1024.png"

set="$work/icon.iconset"
mkdir "$set"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$work/icon-1024.png" --out "$set/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size * 2))" "$((size * 2))" "$work/icon-1024.png" --out "$set/icon_${size}x${size}@2x.png" >/dev/null
done

mkdir -p build
iconutil -c icns "$set" -o build/icon.icns
echo "wrote build/icon.icns"
