#!/bin/bash

# Test Script for GitHub Actions Workflow
# This script simulates the GitHub Actions workflow locally

echo "🧪 Testing GitHub Actions Workflow Locally"
echo "========================================="

# Check if we're in the right directory
if [ ! -f "Backend/Anchor.toml" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "✅ Found Backend/Anchor.toml"

# Check if solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Installing..."
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.11/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

echo "✅ Solana CLI: $(solana --version)"

# Check if anchor CLI is installed
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found. Installing..."
    cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force
fi

echo "✅ Anchor CLI: $(anchor --version)"

# Configure Solana CLI for Devnet
echo "🔧 Configuring Solana CLI for Devnet..."
solana config set --url https://api.devnet.solana.com
solana config set --commitment confirmed

# Check wallet
WALLET_ADDRESS=$(solana address)
echo "📍 Wallet Address: $WALLET_ADDRESS"

# Check balance
BALANCE=$(solana balance)
echo "💰 Current Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 1.0" | bc -l) )); then
    echo "⚠️  Low balance. Requesting airdrop..."
    solana airdrop 2
    sleep 5
    NEW_BALANCE=$(solana balance)
    echo "💰 New Balance: $NEW_BALANCE SOL"
fi

# Navigate to backend and build
echo "🔨 Building program..."
cd Backend

if anchor build; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

# Deploy
echo "🚀 Deploying program..."
if anchor deploy; then
    echo "✅ Deployment successful!"
    
    # Extract Program ID
    PROGRAM_ID=$(solana address -k target/deploy/lets_cook-keypair.json)
    echo "🎉 Program ID: $PROGRAM_ID"
    
    # Save Program ID
    echo "$PROGRAM_ID" > program_id.txt
    echo "📄 Program ID saved to program_id.txt"
    
    # Display summary
    echo ""
    echo "=========================================="
    echo "🎉 LOCAL TEST SUCCESSFUL! 🎉"
    echo "=========================================="
    echo "Program ID: $PROGRAM_ID"
    echo "Wallet Address: $WALLET_ADDRESS"
    echo "Network: Devnet"
    echo "=========================================="
    
else
    echo "❌ Deployment failed!"
    exit 1
fi

echo ""
echo "✅ Local test completed successfully!"
echo "📋 Your GitHub Actions workflow should work the same way."
echo "🔗 Push to main branch to trigger automatic deployment."