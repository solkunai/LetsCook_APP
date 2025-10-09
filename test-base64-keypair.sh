#!/bin/bash

# Test script to verify Base64 keypair works like in GitHub Actions
echo "🧪 Testing Base64 keypair conversion (GitHub Actions style)"
echo "========================================================"

# Your Base64 secret
BASE64_SECRET="/l4MyB0LuinMBtr+TgqEfYKtNyXLIg6UM4QZUZTp/uwShb9FqxmFIOZnE2uFUT3sXetd1QeD0dKb1TReW02AuQ=="

# Create test directory
mkdir -p test_wallet
rm -f test_wallet/id.json

echo "🔑 Testing Base64 decoding..."
if echo "$BASE64_SECRET" | base64 -d > test_wallet/id.json 2>/dev/null; then
    echo "✅ Base64 decoding successful"
    
    # Check if file exists and has content
    if [ -f test_wallet/id.json ]; then
        echo "✅ Keypair file created"
        
        # Check if it's valid JSON with 64 bytes
        BYTE_COUNT=$(cat test_wallet/id.json | jq 'length' 2>/dev/null || echo "0")
        echo "📊 Byte count: $BYTE_COUNT"
        
        if [ "$BYTE_COUNT" = "64" ]; then
            echo "✅ Valid keypair format (64 bytes)"
            
            # Test if solana-keygen can read it
            if command -v solana-keygen &> /dev/null; then
                WALLET_ADDRESS=$(solana-keygen pubkey test_wallet/id.json 2>/dev/null)
                if [ $? -eq 0 ]; then
                    echo "✅ Solana keygen validation passed"
                    echo "📍 Wallet address: $WALLET_ADDRESS"
                else
                    echo "❌ Solana keygen validation failed"
                fi
            else
                echo "⚠️  Solana keygen not available for testing"
            fi
        else
            echo "❌ Invalid keypair format. Expected 64 bytes, got $BYTE_COUNT"
        fi
    else
        echo "❌ Failed to create keypair file"
    fi
else
    echo "❌ Base64 decoding failed"
fi

# Cleanup
rm -rf test_wallet

echo ""
echo "🎯 Summary: Your Base64 secret should work in GitHub Actions!"
echo "Secret: $BASE64_SECRET"