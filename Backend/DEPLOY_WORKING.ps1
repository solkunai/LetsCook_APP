Write-Host "Deploying Working Let's Cook Program to Devnet" -ForegroundColor Green

# Set environment variables
$env:HOME = $env:USERPROFILE
$env:PATH += ";$env:USERPROFILE\.cargo\bin"

# Set Solana to devnet
Write-Host "Setting Solana to devnet..." -ForegroundColor Yellow
solana config set --url devnet

# Check Solana config
Write-Host "Current Solana config:" -ForegroundColor Yellow
solana config get

# Check wallet balance
Write-Host "Checking wallet balance..." -ForegroundColor Yellow
solana balance

# Build the working program
Write-Host "Building working program..." -ForegroundColor Yellow
Set-Location "program"
cargo build-sbf --manifest-path=Cargo_working.toml --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Build successful!" -ForegroundColor Green

# Deploy the program
Write-Host "Deploying program to devnet..." -ForegroundColor Yellow
solana program deploy target/deploy/lets_cook_program.so

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host "Program ID: Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU" -ForegroundColor Cyan
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
}

Set-Location ".."