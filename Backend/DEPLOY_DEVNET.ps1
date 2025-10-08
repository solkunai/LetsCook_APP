# Let's Cook Devnet Deployment Script
# Run this script to deploy to Solana devnet for testing

Write-Host "Starting Let's Cook Devnet Deployment..." -ForegroundColor Green

# Set environment variables
$env:HOME = $env:USERPROFILE
$env:PATH += ";C:\Users\Admin\.local\share\solana\install\active_release\bin"

# Check if Solana CLI is available
try {
    $solanaVersion = solana --version
    Write-Host "Solana CLI found: $solanaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Solana CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

# Set Solana to devnet
Write-Host "🌐 Setting Solana to devnet..." -ForegroundColor Yellow
solana config set --url https://api.devnet.solana.com

# Check wallet
Write-Host "💰 Checking wallet..." -ForegroundColor Yellow
$walletInfo = solana address
if ($walletInfo) {
    Write-Host "✅ Wallet found: $walletInfo" -ForegroundColor Green
} else {
    Write-Host "❌ No wallet found. Creating new wallet..." -ForegroundColor Yellow
    solana-keygen new --outfile ~/.config/solana/id.json --no-bip39-passphrase
    Write-Host "✅ New wallet created!" -ForegroundColor Green
}

# Check wallet balance
$balance = solana balance
Write-Host "💰 Wallet balance: $balance SOL" -ForegroundColor Cyan

# Request airdrop if balance is low
if ([decimal]$balance -lt 1) {
    Write-Host "💸 Requesting devnet airdrop..." -ForegroundColor Yellow
    solana airdrop 2
    $newBalance = solana balance
    Write-Host "💰 New balance: $newBalance SOL" -ForegroundColor Green
}

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
Write-Host "🚀 Deploying to devnet..." -ForegroundColor Yellow
try {
    $deployResult = solana program deploy target/deploy/letscook.so
    Write-Host "✅ Program deployed successfully!" -ForegroundColor Green
    Write-Host "Program ID: $deployResult" -ForegroundColor Cyan
    
    # Save program ID to file
    $deployResult | Out-File -FilePath "devnet_program_id.txt" -Encoding UTF8
    Write-Host "Program ID saved to devnet_program_id.txt" -ForegroundColor Green
} catch {
    Write-Host "❌ Deployment failed. Please check the errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Devnet Deployment Complete!" -ForegroundColor Green
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update your frontend devnet environment variables" -ForegroundColor White
Write-Host "2. Test all functionality on devnet" -ForegroundColor White
Write-Host "3. When ready, run DEPLOY_MAINNET.ps1 for mainnet" -ForegroundColor White
Write-Host ""
Write-Host "Program ID: $deployResult" -ForegroundColor Cyan
Write-Host "Devnet Explorer: https://explorer.solana.com/?cluster=devnet" -ForegroundColor Blue