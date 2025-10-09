#!/bin/bash

# Generate Solana Wallet Secret for GitHub Actions
# This script creates a new Solana keypair and outputs the Base64 encoded secret

set -e

echo "🔑 Generating Solana Wallet Secret for GitHub Actions"
echo "=================================================="

# Check if solana-keygen is available
if ! command -v solana-keygen &> /dev/null; then
    echo "❌ solana-keygen not found. Please install Solana CLI first."
    echo "   Visit: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
KEYPAIR_FILE="$TEMP_DIR/id.json"

echo "📁 Creating temporary keypair in: $TEMP_DIR"

# Generate new keypair
echo "🔧 Generating new Solana keypair..."
solana-keygen new --no-bip39-passphrase --silent --outfile "$KEYPAIR_FILE"

# Verify the keypair was created successfully
if [ ! -f "$KEYPAIR_FILE" ]; then
    echo "❌ Failed to create keypair file"
    exit 1
fi

# Get the wallet address
WALLET_ADDRESS=$(solana-keygen pubkey "$KEYPAIR_FILE")
echo "✅ Generated keypair for address: $WALLET_ADDRESS"

# Encode the keypair as Base64
echo "🔐 Encoding keypair as Base64..."
BASE64_SECRET=$(base64 -w 0 "$KEYPAIR_FILE")

# Display the results
echo ""
echo "🎉 SUCCESS! Here's your GitHub secret:"
echo "=========================================="
echo "Secret Name: SOLANA_WALLET_KEY"
echo "Secret Value: $BASE64_SECRET"
echo "=========================================="
echo ""
echo "📋 Instructions:"
echo "1. Copy the Secret Value above"
echo "2. Go to your GitHub repository"
echo "3. Navigate to Settings → Secrets and variables → Actions"
echo "4. Click 'New repository secret'"
echo "5. Name: SOLANA_WALLET_KEY"
echo "6. Value: [paste the Base64 secret]"
echo "7. Click 'Add secret'"
echo ""
echo "💰 Don't forget to fund this wallet on devnet:"
echo "   solana airdrop 2 $WALLET_ADDRESS --url devnet"
echo ""
echo "🔍 Wallet Details:"
echo "   Address: $WALLET_ADDRESS"
echo "   Network: Devnet"
echo "   File: $KEYPAIR_FILE"
echo ""

# Clean up
echo "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_DIR"
echo "✅ Done!"