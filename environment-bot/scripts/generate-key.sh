#!/bin/bash

# Generate private key
openssl genrsa -out private-key.pem 2048

# Convert to base64
base64 -i private-key.pem -o private-key.base64

echo "Private key generated and converted to base64"
echo "Please copy the contents of private-key.base64 and paste it in your GitHub App settings" 