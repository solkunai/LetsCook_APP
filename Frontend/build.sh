#!/bin/bash
set -e

echo "Installing dependencies (including devDependencies)..."
# Unset NODE_ENV to ensure devDependencies are installed
unset NODE_ENV
npm install

echo "Building application..."
npm run build

echo "Build complete!"

