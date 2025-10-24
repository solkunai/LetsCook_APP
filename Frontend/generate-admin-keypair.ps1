# Generate Admin Keypair for Metaplex Metadata Creation
# 
# This PowerShell script generates a new Solana keypair that can be used as an admin wallet
# for creating Metaplex metadata for tokens created through the platform.
# 
# Usage:
#   .\generate-admin-keypair.ps1
# 
# The script will:
# 1. Generate a new keypair
# 2. Display the public key and private key
# 3. Provide instructions on how to add it to your .env file
# 4. Show how to fund the wallet

Write-Host "🔑 Generating Admin Keypair for Metaplex Metadata Creation..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if Solana CLI is available
try {
    $solanaVersion = solana --version
    Write-Host "✅ Solana CLI found: $solanaVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Solana CLI not found. You'll need to install it to fund the wallet." -ForegroundColor Yellow
    Write-Host "   Install with: sh -c `"`$(curl -sSfL https://release.solana.com/v1.18.4/install)`"" -ForegroundColor Yellow
}

Write-Host ""

# Generate keypair using Solana CLI
$keypairPath = "admin-keypair.json"
try {
    solana-keygen new --outfile $keypairPath --no-bip39-passphrase --silent
    Write-Host "✅ Keypair generated successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to generate keypair with Solana CLI" -ForegroundColor Red
    Write-Host "   Falling back to Node.js generation..." -ForegroundColor Yellow
    
    # Fallback to Node.js generation
    $nodeScript = @"
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');

const keypair = Keypair.generate();
const privateKeyBase58 = Buffer.from(keypair.secretKey).toString('base64');

console.log('Public Key:', keypair.publicKey.toBase58());
console.log('Private Key (Base64):', privateKeyBase58);

// Save to file
fs.writeFileSync('admin-keypair.json', JSON.stringify({
    publicKey: keypair.publicKey.toBase58(),
    privateKey: privateKeyBase58
}));
"@
    
    $nodeScript | node
    Write-Host "✅ Keypair generated with Node.js!" -ForegroundColor Green
}

# Read the generated keypair
if (Test-Path $keypairPath) {
    $keypairData = Get-Content $keypairPath | ConvertFrom-Json
    $publicKey = $keypairData.publicKey
    $privateKey = $keypairData.privateKey
    
    Write-Host ""
    Write-Host "📋 Keypair Details:" -ForegroundColor Cyan
    Write-Host "   Public Key: $publicKey" -ForegroundColor White
    Write-Host "   Private Key (Base64): $privateKey" -ForegroundColor White
    Write-Host ""
    
    Write-Host "📝 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Add the following line to your .env file:" -ForegroundColor Yellow
    Write-Host "   VITE_ADMIN_PRIVATE_KEY=$privateKey" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Fund the admin wallet with SOL for transaction fees:" -ForegroundColor Yellow
    Write-Host "   solana transfer $publicKey 0.01 --from <your-main-wallet> --url devnet" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Restart your development server to load the new environment variable" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "⚠️  Security Notes:" -ForegroundColor Red
    Write-Host "   - Keep the private key secure and never commit it to version control" -ForegroundColor Yellow
    Write-Host "   - This keypair will be used to create metadata for all tokens" -ForegroundColor Yellow
    Write-Host "   - Only fund it with the minimum SOL needed for transaction fees" -ForegroundColor Yellow
    Write-Host ""
    
    # Try to update the .env file automatically
    $envPath = ".env"
    if (Test-Path $envPath) {
        Write-Host "📄 Found existing .env file, appending admin keypair..." -ForegroundColor Cyan
        Add-Content -Path $envPath -Value "`n# Admin Keypair for Metaplex Metadata Creation`nVITE_ADMIN_PRIVATE_KEY=$privateKey`n"
        Write-Host "✅ Admin keypair added to .env file" -ForegroundColor Green
    } else {
        Write-Host "📄 Creating new .env file with admin keypair..." -ForegroundColor Cyan
        $envContent = @"
# Admin Keypair for Metaplex Metadata Creation
VITE_ADMIN_PRIVATE_KEY=$privateKey

# Add this line to your existing .env file
"@
        Set-Content -Path $envPath -Value $envContent
        Write-Host "✅ New .env file created with admin keypair" -ForegroundColor Green
    }
    
    # Clean up the temporary keypair file
    Remove-Item $keypairPath -Force
    Write-Host "🧹 Cleaned up temporary keypair file" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🎉 Setup Complete! Your tokens will now show up in wallets with proper metadata." -ForegroundColor Green
} else {
    Write-Host "❌ Failed to read generated keypair file" -ForegroundColor Red
    exit 1
}