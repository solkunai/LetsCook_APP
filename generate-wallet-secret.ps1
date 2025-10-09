# Generate Solana Wallet Secret for GitHub Actions
# This script creates a new Solana keypair and outputs the Base64 encoded secret

Write-Host "🔑 Generating Solana Wallet Secret for GitHub Actions" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Check if solana-keygen is available
try {
    $null = Get-Command solana-keygen -ErrorAction Stop
} catch {
    Write-Host "❌ solana-keygen not found. Please install Solana CLI first." -ForegroundColor Red
    Write-Host "   Visit: https://docs.solana.com/cli/install-solana-cli-tools" -ForegroundColor Yellow
    exit 1
}

# Create temporary directory
$TempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
$KeypairFile = Join-Path $TempDir "id.json"

Write-Host "📁 Creating temporary keypair in: $TempDir" -ForegroundColor Cyan

# Generate new keypair
Write-Host "🔧 Generating new Solana keypair..." -ForegroundColor Yellow
& solana-keygen new --no-bip39-passphrase --silent --outfile $KeypairFile

# Verify the keypair was created successfully
if (-not (Test-Path $KeypairFile)) {
    Write-Host "❌ Failed to create keypair file" -ForegroundColor Red
    exit 1
}

# Get the wallet address
$WalletAddress = & solana-keygen pubkey $KeypairFile
Write-Host "✅ Generated keypair for address: $WalletAddress" -ForegroundColor Green

# Encode the keypair as Base64
Write-Host "🔐 Encoding keypair as Base64..." -ForegroundColor Yellow
$KeypairBytes = [System.IO.File]::ReadAllBytes($KeypairFile)
$Base64Secret = [System.Convert]::ToBase64String($KeypairBytes)

# Display the results
Write-Host ""
Write-Host "🎉 SUCCESS! Here's your GitHub secret:" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Secret Name: SOLANA_WALLET_KEY" -ForegroundColor White
Write-Host "Secret Value: $Base64Secret" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Instructions:" -ForegroundColor Cyan
Write-Host "1. Copy the Secret Value above" -ForegroundColor White
Write-Host "2. Go to your GitHub repository" -ForegroundColor White
Write-Host "3. Navigate to Settings → Secrets and variables → Actions" -ForegroundColor White
Write-Host "4. Click 'New repository secret'" -ForegroundColor White
Write-Host "5. Name: SOLANA_WALLET_KEY" -ForegroundColor White
Write-Host "6. Value: [paste the Base64 secret]" -ForegroundColor White
Write-Host "7. Click 'Add secret'" -ForegroundColor White
Write-Host ""
Write-Host "💰 Don't forget to fund this wallet on devnet:" -ForegroundColor Yellow
Write-Host "   solana airdrop 2 $WalletAddress --url devnet" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Wallet Details:" -ForegroundColor Cyan
Write-Host "   Address: $WalletAddress" -ForegroundColor White
Write-Host "   Network: Devnet" -ForegroundColor White
Write-Host "   File: $KeypairFile" -ForegroundColor White
Write-Host ""

# Clean up
Write-Host "🧹 Cleaning up temporary files..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $TempDir
Write-Host "✅ Done!" -ForegroundColor Green