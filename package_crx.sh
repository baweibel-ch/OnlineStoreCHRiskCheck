#!/bin/bash
# Script to package the extension into a .crx file using Brave Browser
# Usage: ./package_crx.sh [path_to_private_key.pem]

PROJECT_DIR=$(pwd)
EXTENSION_DIR="$PROJECT_DIR"
CRX_FILE="$PROJECT_DIR/OnlineStoreCHRiskCheck.crx"
PEM_FILE=$1

# Clean up existing .crx
if [ -f "$CRX_FILE" ]; then
    rm "$CRX_FILE"
fi

# Look for .pem in parent directory if not provided
if [ -z "$PEM_FILE" ] && [ -f "$PROJECT_DIR/../warnlistenPlugin.pem" ]; then
    PEM_FILE="$PROJECT_DIR/../warnlistenPlugin.pem"
fi

# Use absolute path for extension directory to avoid confusion
EXTENSION_DIR=$(realpath "$EXTENSION_DIR")
if [ ! -z "$PEM_FILE" ]; then
    PEM_FILE=$(realpath "$PEM_FILE")
fi

# Update CRX_FILE to absolute path as well
CRX_FILE=$(realpath -m "$CRX_FILE")

echo "Packaging extension from $EXTENSION_DIR..."

if [ -z "$PEM_FILE" ]; then
    echo "No private key provided. A new one will be generated if it's the first time."
    brave-browser --headless --pack-extension="$EXTENSION_DIR" --no-sandbox
else
    echo "Using private key: $PEM_FILE"
    brave-browser --headless --pack-extension="$EXTENSION_DIR" --pack-extension-key="$PEM_FILE" --no-sandbox
fi

if [ -f "$CRX_FILE" ]; then
    echo "Successfully created $CRX_FILE"
elif [ -f "$PROJECT_DIR/../warnlistenPlugin.crx" ]; then
    mv "$PROJECT_DIR/../warnlistenPlugin.crx" "$CRX_FILE"
    echo "Successfully created and moved $CRX_FILE"
else
    echo "Failed to create .crx file"
    exit 1
fi

echo "creating zip"
zip -r OnlineStoreCHRiskCheck.zip manifest.json _locales src icons
echo "Successfully created OnlineStoreCHRiskCheck.zip"