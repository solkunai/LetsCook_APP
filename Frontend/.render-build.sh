#!/bin/bash
# This script is optional - Render will use the buildCommand from render.yaml
# But you can use this for local testing or if you need custom build logic

set -e

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Build complete!"

