# Quick Environment Setup Script
# Run this to update your .env.local file with Vite naming convention

Write-Host "Updating .env.local for Vite compatibility..." -ForegroundColor Yellow

# Check if .env.local exists
if (Test-Path ".env.local") {
    Write-Host "Found existing .env.local file" -ForegroundColor Green
    
    # Read current content
    $content = Get-Content ".env.local"
    
    # Replace REACT_APP_ with VITE_
    $newContent = $content -replace "REACT_APP_", "VITE_"
    
    # Write updated content
    $newContent | Out-File ".env.local" -Encoding UTF8
    
    Write-Host "Updated .env.local with Vite naming convention" -ForegroundColor Green
    Write-Host "Please restart your development server" -ForegroundColor Yellow
} else {
    Write-Host "No .env.local file found. Please copy env.example to .env.local first" -ForegroundColor Red
}

Write-Host "`nEnvironment variables now use VITE_ prefix:" -ForegroundColor Cyan
Write-Host "VITE_HELIUS_API_KEY=your_helius_api_key_here" -ForegroundColor White
Write-Host "VITE_HELIUS_NETWORK=devnet" -ForegroundColor White
Write-Host "VITE_MAIN_PROGRAM_ID=11111111111111111111111111111112" -ForegroundColor White
