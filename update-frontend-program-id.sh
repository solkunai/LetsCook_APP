#!/bin/bash

# Frontend Program ID Update Script
# This script helps you update your frontend with the deployed Program ID

echo "🔧 Frontend Program ID Update Script"
echo "===================================="

# Check if .env.local exists
if [ ! -f "Frontend/client/.env.local" ]; then
    echo "📝 Creating .env.local from env.example..."
    cp Frontend/client/env.example Frontend/client/.env.local
    echo "✅ Created Frontend/client/.env.local"
else
    echo "✅ Found existing Frontend/client/.env.local"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Get your Program ID from GitHub Actions:"
echo "   - Go to: https://github.com/investorVOU/LetsLAUNCH/actions"
echo "   - Click on the latest workflow run"
echo "   - Look for 'Display Program ID' step"
echo "   - Copy the Program ID"
echo ""
echo "2. Update your .env.local file:"
echo "   - Open: Frontend/client/.env.local"
echo "   - Replace VITE_MAIN_PROGRAM_ID with your actual Program ID"
echo "   - Example: VITE_MAIN_PROGRAM_ID=YourActualProgramIDHere"
echo ""
echo "3. Restart your frontend development server:"
echo "   cd Frontend/client"
echo "   npm run dev"
echo ""
echo "🎯 Your frontend will now connect to your deployed Solana program!"