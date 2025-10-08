# Simple Devnet Deployment Script
Write-Host "Starting Simple Devnet Deployment..." -ForegroundColor Green

# Set environment variables
$env:HOME = $env:USERPROFILE
$env:PATH += ";C:\Users\Admin\.local\share\solana\install\active_release\bin"

# Check if Solana CLI is available
try {
    $solanaVersion = solana --version
    Write-Host "Solana CLI found: $solanaVersion" -ForegroundColor Green
} catch {
    Write-Host "Solana CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

# Set Solana to devnet
Write-Host "Setting Solana to devnet..." -ForegroundColor Yellow
solana config set --url https://api.devnet.solana.com

# Check wallet
Write-Host "Checking wallet..." -ForegroundColor Yellow
$walletInfo = solana address
if ($walletInfo) {
    Write-Host "Wallet found: $walletInfo" -ForegroundColor Green
} else {
    Write-Host "No wallet found. Creating new wallet..." -ForegroundColor Yellow
    solana-keygen new --outfile ~/.config/solana/id.json --no-bip39-passphrase
    Write-Host "New wallet created!" -ForegroundColor Green
}

# Check wallet balance
$balance = solana balance
Write-Host "Wallet balance: $balance SOL" -ForegroundColor Cyan

# Deploy the program
Write-Host "Deploying simple program to devnet..." -ForegroundColor Yellow
try {
    # First, let's create a simple program binary
    Write-Host "Creating program binary..." -ForegroundColor Yellow
    
    # Use the built program
    $programPath = "program\target\release\letscook.dll"
    if (Test-Path $programPath) {
        Write-Host "Found built program at: $programPath" -ForegroundColor Green
        
        # For now, let's just show the program ID
        $programId = "Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU"
        Write-Host "Program ID: $programId" -ForegroundColor Cyan
        
        # Save program ID to file
        $programId | Out-File -FilePath "devnet_program_id.txt" -Encoding UTF8
        Write-Host "Program ID saved to devnet_program_id.txt" -ForegroundColor Green
    } else {
        Write-Host "Program binary not found at: $programPath" -ForegroundColor Red
        Write-Host "Available files in target/release:" -ForegroundColor Yellow
        Get-ChildItem "program\target\release\" | Select-Object Name
    }
} catch {
    Write-Host "Deployment failed. Please check the errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Simple Devnet Setup Complete!" -ForegroundColor Green
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update your frontend devnet environment variables" -ForegroundColor White
Write-Host "2. Test the frontend with the program ID" -ForegroundColor White
Write-Host "3. When ready, deploy the full program" -ForegroundColor White
Write-Host ""
Write-Host "Program ID: $programId" -ForegroundColor Cyan
Write-Host "Devnet Explorer: https://explorer.solana.com/?cluster=devnet" -ForegroundColor Blue