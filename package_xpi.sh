#!/bin/bash
# Script to package the extension into an .xpi file for Firefox
# Usage: ./package_xpi.sh

PROJECT_DIR=$(pwd)
XPI_FILE="$PROJECT_DIR/OnlineStoreCHRiskCheck.xpi"

# Clean up existing .xpi
if [ -f "$XPI_FILE" ]; then
    echo "Removing existing $XPI_FILE..."
    rm "$XPI_FILE"
fi

echo "Packaging extension into $XPI_FILE..."

# Check if zip is installed
if ! command -v zip &> /dev/null; then
    echo "Error: 'zip' command not found. Please install it (e.g., sudo apt install zip)."
    exit 1
fi

# Create a temporary manifest for Firefox MV3
# Firefox requires 'scripts' instead of 'service_worker' in MV3 background
cp manifest.json manifest.json.tmp
sed -i 's/"service_worker": "src\/background\/background.js"/"scripts": ["src\/background\/background.js"]/' manifest.json.tmp
# Remove "type": "module" if it's there as it's redundant/invalid for 'scripts' key in some cases
# Actually, Firefox needs "type": "module" for ES imports in background scripts
# sed -i '/"type": "module"/d' manifest.json.tmp
# Clean up trailing comma if "type": "module" was last
# sed -i 'N;s/,\n  }/\n  }/;P;D' manifest.json.tmp

# Store original manifest and put the temporary one in place
mv manifest.json manifest.json.bak
mv manifest.json.tmp manifest.json

# Create the xpi (zip) file
# Excluding: scripts, project files, backups, and hidden files
zip -r "$XPI_FILE" manifest.json src/ _locales/ \
    -x "*.git*" \
    -x "*.sh" \
    -x "*.crx" \
    -x "*.iml" \
    -x "chrome_webstore_listing/*" \
    -x "*.DS_Store*"

# Restore original manifest
mv manifest.json.bak manifest.json

if [ -f "$XPI_FILE" ]; then
    echo "------------------------------------------------"
    echo "Successfully created $XPI_FILE"
    echo "You can now load this file in Firefox or upload it to AMO."
    echo "------------------------------------------------"
else
    echo "Failed to create .xpi file"
    exit 1
fi
