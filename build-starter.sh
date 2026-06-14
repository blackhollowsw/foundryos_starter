#!/bin/bash
# FILE: build-starter.sh
# Purpose: Build the foundryos-starter.zip release artifact.
# Run this from the directory CONTAINING foundryos-starter/ (not from inside it).
#
# Usage:
#   chmod +x build-starter.sh
#   ./build-starter.sh
#
# This script exists because shell brace expansion in mkdir/zip commands
# produces literal brace strings as directory names in the zip archive,
# which confuses any developer who unzips it. Always use this script
# to build the zip — never zip manually.

set -e

FOLDER="foundryos-starter"
OUTPUT="foundryos-starter.zip"

# Verify we're in the right place
if [ ! -d "$FOLDER" ]; then
  echo "Error: '$FOLDER' directory not found."
  echo "Run this script from the directory that CONTAINS foundryos-starter/"
  exit 1
fi

# Remove old zip if it exists
rm -f "$OUTPUT"

# Build the zip
# -r  recursive
# -x  exclude patterns (node_modules, .next, .env.local, DS_Store)
zip -r "$OUTPUT" "$FOLDER" \
  -x "*/node_modules/*" \
  -x "*/.next/*" \
  -x "*/.env.local" \
  -x "*/.DS_Store" \
  -x "*/Thumbs.db" \
  -x "*/.idea/*" \
  -x "*/.vscode/*"

echo ""
echo "✓ Built: $OUTPUT"
echo ""

# Verify — list contents
echo "Contents:"
unzip -l "$OUTPUT" | grep -v "^Archive" | grep -v "^\-\-\-" | grep -v "files$"
