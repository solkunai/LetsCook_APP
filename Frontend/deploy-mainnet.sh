#!/bin/bash

# Let's Cook Mainnet Deployment Script
# This script builds and deploys the application to Solana mainnet

echo "🚀 Starting Let's Cook Mainnet Deployment..."

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo "❌ Error: .env.production file not found!"
    echo "Please create .env.production with your mainnet configuration:"
    echo ""
    echo "SOLANA_NETWORK=mainnet-beta"
    echo "SOLANA_RPC_URL=https://mainnet.helius-rpc.com"
    echo "HELIUS_API_KEY=your_helius_api_key_here"
    echo "MAIN_PROGRAM_ID=Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU"
    echo "# ... other configuration"
    echo ""
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Type check
echo "🔍 Running type check..."
npm run check

# Build for production
echo "🏗️ Building for production..."
npm run build:mainnet

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🎉 Ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Deploy backend programs to mainnet:"
    echo "   cd Backend/program && anchor deploy --provider.cluster mainnet-beta"
    echo ""
    echo "2. Update program IDs in .env.production"
    echo ""
    echo "3. Deploy frontend to your hosting provider:"
    echo "   - Vercel: vercel --prod"
    echo "   - Netlify: netlify deploy --prod --dir=dist/public"
    echo "   - Or upload dist/public to your server"
    echo ""
    echo "4. Configure domain and SSL"
    echo ""
    echo "5. Test all functionality on mainnet"
    echo ""
    echo "🚀 Let's Cook is ready for mainnet!"
else
    echo "❌ Build failed! Please fix errors and try again."
    exit 1
fi