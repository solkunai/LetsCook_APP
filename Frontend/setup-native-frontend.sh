#!/bin/bash

# Native Solana Program Frontend Integration Script
echo "🚀 Setting up LetsCook Native Program Frontend Integration"
echo "=========================================================="

# Check if we're in the right directory
if [ ! -f "Frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Navigate to frontend directory
cd Frontend

echo "📦 Installing dependencies..."
npm install

echo "🔧 Building the frontend..."
npm run build:client

echo "✅ Frontend build complete!"
echo ""
echo "🌐 To test your native Solana program:"
echo "1. Start the development server: npm run dev"
echo "2. Open your browser to the development URL"
echo "3. Navigate to /native-test to test your program"
echo ""
echo "📋 Program Details:"
echo "   Program ID: ygnLL5qWn11qkxtjLXBrP61oapijCrygpmpq3k2LkEJ"
echo "   Network: Devnet"
echo "   Test Page: /native-test"
echo ""
echo "🎯 Available Test Functions:"
echo "   - Initialize Program"
echo "   - Set User Name"
echo "   - Submit Hype Vote"
echo "   - Check Tickets"
echo ""
echo "💡 Make sure to:"
echo "   - Connect your Solana wallet"
echo "   - Switch to Devnet"
echo "   - Have some SOL for transaction fees"
echo ""
echo "🔗 View transactions on Solana Explorer:"
echo "   https://explorer.solana.com/?cluster=devnet"