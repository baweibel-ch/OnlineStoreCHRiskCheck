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

# Create the xpi (zip) file
# Excluding: scripts, project files, backups, and hidden files
zip -r "$XPI_FILE" manifest.json src/ _locales/ \
    -x "*.git*" \
    -x "*.sh" \
    -x "*.crx" \
    -x "*.iml" \
    -x "chrome_webstore_listing/*" \
    -x "*.DS_Store*"

if [ -f "$XPI_FILE" ]; then
    echo "------------------------------------------------"
    echo "Successfully created $XPI_FILE"
    echo "You can now load this file in Firefox or upload it to AMO."
    echo "------------------------------------------------"
else
    echo "Failed to create .xpi file"
    exit 1
fi
