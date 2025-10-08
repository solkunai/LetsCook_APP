# Solana Wallet Setup Script for GitHub Actions (PowerShell)
# This script helps you generate a wallet and get the private key for GitHub Secrets

Write-Host "🔑 Solana Wallet Setup for GitHub Actions" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check if solana CLI is installed
try {
    $solanaVersion = solana --version
    Write-Host "✅ Solana CLI found: $solanaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Solana CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   sh -c `"`$(curl -sSfL https://release.solana.com/v1.18.11/install)`"" -ForegroundColor Yellow
    exit 1
}

# Create a temporary keypair
$tempKeypair = "$env:TEMP\github_wallet.json"
Write-Host "📝 Generating new wallet keypair..." -ForegroundColor Yellow

# Generate new keypair
solana-keygen new --outfile $tempKeypair --no-bip39-passphrase --silent

# Get the public key (wallet address)
$publicKey = solana-keygen pubkey $tempKeypair
Write-Host "📍 Wallet Address: $publicKey" -ForegroundColor Green

# Read the private key and convert to base64
$privateKeyBytes = Get-Content $tempKeypair -Raw -Encoding UTF8
$privateKeyBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($privateKeyBytes))

Write-Host "🔐 Private Key (for GitHub Secret):" -ForegroundColor Yellow
Write-Host "==================================" -ForegroundColor Yellow
Write-Host $privateKeyBase64 -ForegroundColor White
Write-Host "==================================" -ForegroundColor Yellow

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Copy the private key above (the base64 string)" -ForegroundColor White
Write-Host "2. Go to your GitHub repository" -ForegroundColor White
Write-Host "3. Settings → Secrets and variables → Actions" -ForegroundColor White
Write-Host "4. Click 'New repository secret'" -ForegroundColor White
Write-Host "5. Name: SOLANA_WALLET_KEY" -ForegroundColor White
Write-Host "6. Value: [paste the private key]" -ForegroundColor White
Write-Host "7. Click 'Add secret'" -ForegroundColor White
Write-Host ""
Write-Host "💰 Don't forget to fund your wallet on Devnet:" -ForegroundColor Yellow
Write-Host "   solana config set --url https://api.devnet.solana.com" -ForegroundColor White
Write-Host "   solana airdrop 2 $publicKey" -ForegroundColor White
Write-Host ""
Write-Host "🧹 Cleaning up temporary files..." -ForegroundColor Yellow
Remove-Item $tempKeypair -Force
Write-Host "✅ Done!" -ForegroundColor Green