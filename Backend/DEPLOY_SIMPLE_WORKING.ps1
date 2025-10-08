Write-Host "Deploying Simple Working Program to Devnet" -ForegroundColor Green

# Set environment variables
$env:HOME = $env:USERPROFILE
$env:PATH += ";$env:USERPROFILE\.cargo\bin;$env:USERPROFILE\.local\share\solana\install\active_release\bin"

# Set Solana to devnet
Write-Host "Setting Solana to devnet..." -ForegroundColor Yellow
solana config set --url devnet

# Check Solana config
Write-Host "Current Solana config:" -ForegroundColor Yellow
solana config get

# Check wallet balance
Write-Host "Checking wallet balance..." -ForegroundColor Yellow
solana balance

# Create deploy directory
Write-Host "Creating deploy directory..." -ForegroundColor Yellow
mkdir -Force target\deploy

# Copy the DLL to deploy directory as .so (Solana expects .so files)
Write-Host "Preparing program for deployment..." -ForegroundColor Yellow
copy target\release\lets_cook_program.dll target\deploy\lets_cook_program.so

Write-Host "Program prepared for deployment!" -ForegroundColor Green

# Deploy the program
Write-Host "Deploying program to devnet..." -ForegroundColor Yellow
solana program deploy target\deploy\lets_cook_program.so

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host "Program ID: Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU" -ForegroundColor Cyan
    Write-Host "You can now test the program with the frontend!" -ForegroundColor Green
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    Write-Host "This might be because the program format is not compatible." -ForegroundColor Yellow
    Write-Host "Let's try a different approach..." -ForegroundColor Yellow
}