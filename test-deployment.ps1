# Test Script for GitHub Actions Workflow (PowerShell)
# This script simulates the GitHub Actions workflow locally

Write-Host "🧪 Testing GitHub Actions Workflow Locally" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "Backend/Anchor.toml")) {
    Write-Host "❌ Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found Backend/Anchor.toml" -ForegroundColor Green

# Check if solana CLI is installed
try {
    $solanaVersion = solana --version
    Write-Host "✅ Solana CLI: $solanaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Solana CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   sh -c `"`$(curl -sSfL https://release.solana.com/v1.18.11/install)`"" -ForegroundColor Yellow
    exit 1
}

# Check if anchor CLI is installed
try {
    $anchorVersion = anchor --version
    Write-Host "✅ Anchor CLI: $anchorVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Anchor CLI not found. Installing..." -ForegroundColor Yellow
    cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --force
}

# Configure Solana CLI for Devnet
Write-Host "🔧 Configuring Solana CLI for Devnet..." -ForegroundColor Yellow
solana config set --url https://api.devnet.solana.com
solana config set --commitment confirmed

# Check wallet
$walletAddress = solana address
Write-Host "📍 Wallet Address: $walletAddress" -ForegroundColor Green

# Check balance
$balance = solana balance
Write-Host "💰 Current Balance: $balance SOL" -ForegroundColor Green

if ([decimal]$balance -lt 1.0) {
    Write-Host "⚠️  Low balance. Requesting airdrop..." -ForegroundColor Yellow
    solana airdrop 2
    Start-Sleep -Seconds 5
    $newBalance = solana balance
    Write-Host "💰 New Balance: $newBalance SOL" -ForegroundColor Green
}

# Navigate to backend and build
Write-Host "🔨 Building program..." -ForegroundColor Yellow
Set-Location Backend

try {
    anchor build
    Write-Host "✅ Build successful!" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

# Deploy
Write-Host "🚀 Deploying program..." -ForegroundColor Yellow
try {
    anchor deploy
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    
    # Extract Program ID
    $programId = solana address -k target/deploy/lets_cook-keypair.json
    Write-Host "🎉 Program ID: $programId" -ForegroundColor Green
    
    # Save Program ID
    $programId | Out-File -FilePath "program_id.txt" -Encoding UTF8
    Write-Host "📄 Program ID saved to program_id.txt" -ForegroundColor Green
    
    # Display summary
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "🎉 LOCAL TEST SUCCESSFUL! 🎉" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Program ID: $programId" -ForegroundColor White
    Write-Host "Wallet Address: $walletAddress" -ForegroundColor White
    Write-Host "Network: Devnet" -ForegroundColor White
    Write-Host "==========================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

Write-Host ""
Write-Host "✅ Local test completed successfully!" -ForegroundColor Green
Write-Host "📋 Your GitHub Actions workflow should work the same way." -ForegroundColor Cyan
Write-Host "🔗 Push to main branch to trigger automatic deployment." -ForegroundColor Cyan