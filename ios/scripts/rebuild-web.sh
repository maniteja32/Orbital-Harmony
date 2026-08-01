#!/usr/bin/env bash
# Rebuilds the Orbital Harmony web app and refreshes the bundled copy used
# by the iOS app (ios/OrbitalHarmony/Resources/www), then regenerates the
# Xcode project. Run this whenever orbital-harmony-app's source changes.
#
# Usage: ./ios/scripts/rebuild-web.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$IOS_DIR")"
WEB_DIR="$ROOT_DIR/orbital-harmony-app"
WWW_DIR="$IOS_DIR/OrbitalHarmony/Resources/www"

echo "==> Installing web app dependencies (if needed)"
(cd "$WEB_DIR" && npm install)

echo "==> Building production web bundle"
(cd "$WEB_DIR" && npm run build)

echo "==> Refreshing bundled www/ used by the iOS app"
rm -rf "$WWW_DIR"
mkdir -p "$WWW_DIR"
cp -R "$WEB_DIR/dist/." "$WWW_DIR/"

echo "==> Regenerating OrbitalHarmony.xcodeproj (requires xcodegen: brew install xcodegen)"
(cd "$IOS_DIR" && xcodegen generate --spec project.yml)

echo "==> Done. Open ios/OrbitalHarmony.xcodeproj in Xcode and Run."
