# CookLaunch Simple Setup Script
# Uses winget (no admin required)

Write-Host "CookLaunch Simple Setup" -ForegroundColor Green
Write-Host "=======================" -ForegroundColor Green

# Step 1: Install Rust via winget
Write-Host "`nInstalling Rust..." -ForegroundColor Yellow
try {
    if (Get-Command rustc -ErrorAction SilentlyContinue) {
        Write-Host "Rust already installed" -ForegroundColor Green
    } else {
        Write-Host "Installing Rust via winget..." -ForegroundColor Yellow
        winget install Rustlang.Rust.MSVC
        Write-Host "Rust installation started. Please restart terminal after completion." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Failed to install Rust: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 2: Install Node.js (if not already installed)
Write-Host "`nChecking Node.js..." -ForegroundColor Yellow
try {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = node --version
        Write-Host "Node.js already installed: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "Installing Node.js via winget..." -ForegroundColor Yellow
        winget install OpenJS.NodeJS
        Write-Host "Node.js installation started. Please restart terminal after completion." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Failed to install Node.js: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Install Solana CLI manually
Write-Host "`nInstalling Solana CLI..." -ForegroundColor Yellow
try {
    if (Get-Command solana -ErrorAction SilentlyContinue) {
        Write-Host "Solana CLI already installed" -ForegroundColor Green
    } else {
        Write-Host "Downloading Solana CLI..." -ForegroundColor Yellow
        $solanaInstaller = "solana-install-init-x86_64-pc-windows-msvc.exe"
        Invoke-WebRequest -Uri "https://github.com/solana-labs/solana/releases/download/v1.18.4/$solanaInstaller" -OutFile $solanaInstaller
        
        Write-Host "Installing Solana CLI..." -ForegroundColor Yellow
        .\solana-install-init-x86_64-pc-windows-msvc.exe
        Remove-Item $solanaInstaller
        
        Write-Host "Solana CLI installed. Please restart terminal." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Failed to install Solana CLI: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nSetup Instructions:" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan
Write-Host "1. Restart your terminal" -ForegroundColor White
Write-Host "2. Run: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force" -ForegroundColor White
Write-Host "3. Run: avm install latest && avm use latest" -ForegroundColor White
Write-Host "4. Run: solana config set --url devnet" -ForegroundColor White
Write-Host "5. Run: solana-keygen new --outfile ~/.config/solana/id.json" -ForegroundColor White
Write-Host "6. Run: solana airdrop 2" -ForegroundColor White
Write-Host "7. Run: .\deploy.ps1" -ForegroundColor White

Write-Host "`nAlternative: Manual Installation" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow
Write-Host "1. Download Rust: https://rustup.rs/" -ForegroundColor White
Write-Host "2. Download Solana: https://docs.solana.com/cli/install-solana-cli-tools" -ForegroundColor White
Write-Host "3. Install Anchor: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force" -ForegroundColor White

Write-Host "`nReady to continue with manual setup!" -ForegroundColor Green




