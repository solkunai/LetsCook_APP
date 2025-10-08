#!/bin/bash

# Solana Program Size Optimization Script
# This script optimizes the program size to reduce rent costs

echo "🔧 Optimizing Solana program size..."

# Navigate to program directory
cd program

# Backup original Cargo.toml
cp Cargo.toml Cargo.toml.backup

# Use optimized Cargo.toml
cp Cargo.production.toml Cargo.toml

echo "📦 Building with size optimizations..."

# Clean previous builds
cargo clean

# Build with size optimizations
cargo build-bpf --manifest-path=Cargo.toml

# Check program size
echo "📊 Program size analysis:"
ls -la target/deploy/*.so

# Get the actual size in bytes
PROGRAM_SIZE=$(stat -c%s target/deploy/*.so 2>/dev/null || stat -f%z target/deploy/*.so 2>/dev/null)
if [ ! -z "$PROGRAM_SIZE" ]; then
    echo "Program size: $PROGRAM_SIZE bytes"
    
    # Calculate rent cost (approximate)
    # Solana rent is ~0.00000348 SOL per byte per year
    RENT_COST=$(echo "scale=6; $PROGRAM_SIZE * 0.00000348" | bc)
    echo "Estimated annual rent cost: $RENT_COST SOL"
    
    # Check if size is under limits
    if [ $PROGRAM_SIZE -lt 1232896 ]; then
        echo "✅ Program size is under the 1.2MB limit"
    else
        echo "⚠️  Program size exceeds 1.2MB limit - consider further optimization"
    fi
fi

echo ""
echo "🎯 Size optimization complete!"
echo ""
echo "Next steps:"
echo "1. Deploy to mainnet: anchor deploy --provider.cluster mainnet-beta"
echo "2. Update program IDs in environment variables"
echo "3. Deploy frontend with new program IDs"

# Restore original Cargo.toml for development
cp Cargo.toml.backup Cargo.toml