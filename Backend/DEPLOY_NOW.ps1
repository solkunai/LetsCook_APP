# Let's Cook Mainnet Deployment Script
# Run this script to deploy to Solana mainnet

Write-Host "🚀 Starting Let's Cook Mainnet Deployment..." -ForegroundColor Green

# Set environment variables
$env:HOME = $env:USERPROFILE
$env:PATH += ";C:\Users\Admin\.local\share\solana\install\active_release\bin"

# Check if Solana CLI is available
try {
    $solanaVersion = solana --version
    Write-Host "✅ Solana CLI found: $solanaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Solana CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

# Set Solana to mainnet
Write-Host "🌐 Setting Solana to mainnet..." -ForegroundColor Yellow
solana config set --url https://api.mainnet-beta.solana.com

# Check wallet
Write-Host "💰 Checking wallet..." -ForegroundColor Yellow
$walletInfo = solana address
if ($walletInfo) {
    Write-Host "✅ Wallet found: $walletInfo" -ForegroundColor Green
} else {
    Write-Host "❌ No wallet found. Please create one first:" -ForegroundColor Red
    Write-Host "   solana-keygen new --outfile ~/.config/solana/id.json" -ForegroundColor Yellow
    exit 1
}

# Check wallet balance
$balance = solana balance
Write-Host "💰 Wallet balance: $balance SOL" -ForegroundColor Cyan

# Build the program
Write-Host "🔨 Building program..." -ForegroundColor Yellow
try {
    cargo build-bpf --manifest-path=Cargo.toml
    Write-Host "✅ Program built successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed. Please check the errors above." -ForegroundColor Red
    exit 1
}

# Deploy the program
Write-Host "🚀 Deploying to mainnet..." -ForegroundColor Yellow
try {
    $deployResult = solana program deploy target/deploy/letscook.so
    Write-Host "✅ Program deployed successfully!" -ForegroundColor Green
    Write-Host "Program ID: $deployResult" -ForegroundColor Cyan
    
    # Save program ID to file
    $deployResult | Out-File -FilePath "program_id.txt" -Encoding UTF8
    Write-Host "💾 Program ID saved to program_id.txt" -ForegroundColor Green
} catch {
    Write-Host "❌ Deployment failed. Please check the errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update your frontend environment variables with the new Program ID" -ForegroundColor White
Write-Host "2. Deploy your frontend to your hosting provider" -ForegroundColor White
Write-Host "3. Test all functionality on mainnet" -ForegroundColor White
Write-Host ""
Write-Host "Program ID: $deployResult" -ForegroundColor Cyan