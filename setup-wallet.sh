#!/bin/bash

# Solana Wallet Setup Script for GitHub Actions
# This script helps you generate a wallet and get the private key for GitHub Secrets

echo "🔑 Solana Wallet Setup for GitHub Actions"
echo "=========================================="

# Check if solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Please install it first:"
    echo "   sh -c \"\$(curl -sSfL https://release.solana.com/v1.18.11/install)\""
    exit 1
fi

echo "✅ Solana CLI found: $(solana --version)"

# Create a temporary keypair
TEMP_KEYPAIR="/tmp/github_wallet.json"
echo "📝 Generating new wallet keypair..."

solana-keygen new --outfile "$TEMP_KEYPAIR" --no-bip39-passphrase --silent

# Get the public key (wallet address)
PUBLIC_KEY=$(solana-keygen pubkey "$TEMP_KEYPAIR")
echo "📍 Wallet Address: $PUBLIC_KEY"

# Get the private key in base58 format
echo "🔐 Private Key (for GitHub Secret):"
echo "=================================="
cat "$TEMP_KEYPAIR" | base64 -w 0
echo ""
echo "=================================="

echo ""
echo "📋 Next Steps:"
echo "1. Copy the private key above (the base64 string)"
echo "2. Go to your GitHub repository"
echo "3. Settings → Secrets and variables → Actions"
echo "4. Click 'New repository secret'"
echo "5. Name: SOLANA_WALLET_KEY"
echo "6. Value: [paste the private key]"
echo "7. Click 'Add secret'"
echo ""
echo "💰 Don't forget to fund your wallet on Devnet:"
echo "   solana config set --url https://api.devnet.solana.com"
echo "   solana airdrop 2 $PUBLIC_KEY"
echo ""
echo "🧹 Cleaning up temporary files..."
rm -f "$TEMP_KEYPAIR"
echo "✅ Done!"