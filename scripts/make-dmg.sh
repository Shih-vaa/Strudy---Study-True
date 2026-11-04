#!/bin/bash
# Wraps each built app in release/ into a disk image: release/Strudy-<version>-<arch>.dmg, with the
# app and an Applications shortcut to drag it onto. Uses only macOS's own tools (ditto, hdiutil),
# so it needs no network. An architecture whose app was not built is skipped.
set -euo pipefail
cd "$(dirname "$0")/.."

version="$(node -p "require('./package.json').version")"
made=0

make_dmg() {
  local arch="$1" folder="$2"
  local app="release/$folder/Strudy.app"
  if [ ! -d "$app" ]; then
    echo "skipping $arch: $app was not built"
    return
  fi

  local stage
  stage="$(mktemp -d)"
  # ditto keeps the code signature and extended attributes intact (cp -R can drop them).
  ditto "$app" "$stage/Strudy.app"
  ln -s /Applications "$stage/Applications"

  local out="release/Strudy-${version}-${arch}.dmg"
  rm -f "$out"
  hdiutil create -volname "Strudy ${version}" -srcfolder "$stage" -ov -format UDZO -fs HFS+ "$out" >/dev/null
  rm -rf "$stage"
  echo "wrote $out ($(du -h "$out" | cut -f1))"
  made=$((made + 1))
}

make_dmg arm64 mac-arm64
make_dmg x64 mac

if [ "$made" -eq 0 ]; then
  echo "no app found in release/: run 'npm run pack' first" >&2
  exit 1
fi
