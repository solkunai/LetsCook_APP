# Frontend Program ID Update Script (PowerShell)
# This script helps you update your frontend with the deployed Program ID

Write-Host "Frontend Program ID Update Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Check if .env.local exists
if (-not (Test-Path "Frontend/client/.env.local")) {
    Write-Host "Creating .env.local from env.example..." -ForegroundColor Yellow
    Copy-Item "Frontend/client/env.example" "Frontend/client/.env.local"
    Write-Host "Created Frontend/client/.env.local" -ForegroundColor Green
} else {
    Write-Host "Found existing Frontend/client/.env.local" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Get your Program ID from GitHub Actions:" -ForegroundColor White
Write-Host "   - Go to: https://github.com/investorVOU/LetsLAUNCH/actions" -ForegroundColor White
Write-Host "   - Click on the latest workflow run" -ForegroundColor White
Write-Host "   - Look for 'Display Program ID' step" -ForegroundColor White
Write-Host "   - Copy the Program ID" -ForegroundColor White
Write-Host ""
Write-Host "2. Update your .env.local file:" -ForegroundColor White
Write-Host "   - Open: Frontend/client/.env.local" -ForegroundColor White
Write-Host "   - Replace VITE_MAIN_PROGRAM_ID with your actual Program ID" -ForegroundColor White
Write-Host "   - Example: VITE_MAIN_PROGRAM_ID=YourActualProgramIDHere" -ForegroundColor White
Write-Host ""
Write-Host "3. Restart your frontend development server:" -ForegroundColor White
Write-Host "   cd Frontend/client" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Your frontend will now connect to your deployed Solana program!" -ForegroundColor Green