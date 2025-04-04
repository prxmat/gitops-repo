#!/bin/bash

# Install smee-client if not already installed
if ! command -v smee &> /dev/null; then
  echo "Installing smee-client..."
  npm install -g smee-client
fi

# Read the URL from .env file
WEBHOOK_PROXY_URL=$(grep WEBHOOK_PROXY_URL .env | cut -d '=' -f2)

# Check if we have a valid URL
if [[ "$WEBHOOK_PROXY_URL" == "https://smee.io/new" ]]; then
  echo "Please visit https://smee.io/ to generate a new channel"
  echo "Then update the WEBHOOK_PROXY_URL in .env file"
  exit 1
fi

# Start the smee client
echo "Starting smee client with URL: $WEBHOOK_PROXY_URL"
smee --url "$WEBHOOK_PROXY_URL" --target http://localhost:3000/api/github/webhooks 