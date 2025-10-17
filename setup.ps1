# CookLaunch Deployment Setup Script for Windows
# Run this script as Administrator

Write-Host "🚀 CookLaunch Deployment Setup" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ This script requires Administrator privileges. Please run as Administrator." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green

# Step 1: Install Rust
Write-Host "`n📦 Installing Rust..." -ForegroundColor Yellow
try {
    if (Get-Command rustc -ErrorAction SilentlyContinue) {
        Write-Host "✅ Rust already installed" -ForegroundColor Green
    } else {
        Write-Host "Downloading Rust installer..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "rustup-init.exe"
        Write-Host "Installing Rust..." -ForegroundColor Yellow
        .\rustup-init.exe -y
        Remove-Item "rustup-init.exe"
        
        # Add Rust to PATH
        $env:PATH += ";$env:USERPROFILE\.cargo\bin"
        [Environment]::SetEnvironmentVariable("PATH", $env:PATH, [EnvironmentVariableTarget]::User)
        
        Write-Host "✅ Rust installed successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to install Rust: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Install Solana CLI
Write-Host "`n📦 Installing Solana CLI..." -ForegroundColor Yellow
try {
    if (Get-Command solana -ErrorAction SilentlyContinue) {
        Write-Host "✅ Solana CLI already installed" -ForegroundColor Green
    } else {
        Write-Host "Downloading Solana CLI..." -ForegroundColor Yellow
        $solanaInstaller = "solana-install-init-x86_64-pc-windows-msvc.exe"
        Invoke-WebRequest -Uri "https://github.com/solana-labs/solana/releases/download/v1.18.4/$solanaInstaller" -OutFile $solanaInstaller
        
        Write-Host "Installing Solana CLI..." -ForegroundColor Yellow
        .\solana-install-init-x86_64-pc-windows-msvc.exe
        Remove-Item $solanaInstaller
        
        # Add Solana to PATH
        $solanaPath = "$env:USERPROFILE\.local\share\solana\install\active_release\bin"
        $env:PATH += ";$solanaPath"
        [Environment]::SetEnvironmentVariable("PATH", $env:PATH, [EnvironmentVariableTarget]::User)
        
        Write-Host "✅ Solana CLI installed successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to install Solana CLI: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Install Anchor
Write-Host "`n📦 Installing Anchor..." -ForegroundColor Yellow
try {
    if (Get-Command anchor -ErrorAction SilentlyContinue) {
        Write-Host "✅ Anchor already installed" -ForegroundColor Green
    } else {
        Write-Host "Installing Anchor via Cargo..." -ForegroundColor Yellow
        cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
        
        # Install latest Anchor version
        avm install latest
        avm use latest
        
        Write-Host "✅ Anchor installed successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to install Anchor: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Verify Installation
Write-Host "`n🔍 Verifying Installation..." -ForegroundColor Yellow
try {
    $rustVersion = rustc --version
    $solanaVersion = solana --version
    $anchorVersion = anchor --version
    
    Write-Host "✅ Rust: $rustVersion" -ForegroundColor Green
    Write-Host "✅ Solana: $solanaVersion" -ForegroundColor Green
    Write-Host "✅ Anchor: $anchorVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Verification failed. Please restart your terminal and try again." -ForegroundColor Red
    exit 1
}

# Step 5: Configure Solana
Write-Host "`n⚙️ Configuring Solana..." -ForegroundColor Yellow
try {
    solana config set --url devnet
    Write-Host "✅ Solana configured for devnet" -ForegroundColor Green
    
    # Check if keypair exists
    $keypairPath = "$env:USERPROFILE\.config\solana\id.json"
    if (-not (Test-Path $keypairPath)) {
        Write-Host "Creating new keypair..." -ForegroundColor Yellow
        solana-keygen new --outfile $keypairPath --no-bip39-passphrase
        Write-Host "✅ New keypair created" -ForegroundColor Green
    } else {
        Write-Host "✅ Keypair already exists" -ForegroundColor Green
    }
    
    # Get devnet SOL
    Write-Host "Requesting devnet SOL..." -ForegroundColor Yellow
    solana airdrop 2
    Write-Host "✅ Devnet SOL received" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed to configure Solana: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Setup Complete!" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host "✅ Rust installed" -ForegroundColor Green
Write-Host "✅ Solana CLI installed" -ForegroundColor Green
Write-Host "✅ Anchor installed" -ForegroundColor Green
Write-Host "✅ Solana configured for devnet" -ForegroundColor Green
Write-Host "✅ Keypair created" -ForegroundColor Green
Write-Host "✅ Devnet SOL received" -ForegroundColor Green

Write-Host "`n🚀 Ready to Deploy!" -ForegroundColor Green
Write-Host "Run the deployment script next: .\deploy.ps1" -ForegroundColor Yellow

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Restart your terminal" -ForegroundColor White
Write-Host "2. Run: .\deploy.ps1" -ForegroundColor White
Write-Host "3. Update program IDs in Frontend" -ForegroundColor White
Write-Host "4. Deploy frontend to production" -ForegroundColor White













