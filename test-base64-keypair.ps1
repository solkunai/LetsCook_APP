# Test script to verify Base64 keypair works like in GitHub Actions
Write-Host "Testing Base64 keypair conversion (GitHub Actions style)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Your Base64 secret
$base64Secret = "/l4MyB0LuinMBtr+TgqEfYKtNyXLIg6UM4QZUZTp/uwShb9FqxmFIOZnE2uFUT3sXetd1QeD0dKb1TReW02AuQ=="

# Create test directory
$testDir = "test_wallet"
if (Test-Path $testDir) { Remove-Item -Recurse -Force $testDir }
New-Item -ItemType Directory -Path $testDir | Out-Null

Write-Host "Testing Base64 decoding..." -ForegroundColor Yellow

try {
    # Decode Base64 to bytes
    $keypairBytes = [System.Convert]::FromBase64String($base64Secret)
    $keypairJson = "[$($keypairBytes -join ',')]"
    
    # Write to file
    $keypairFile = Join-Path $testDir "id.json"
    $keypairJson | Out-File -FilePath $keypairFile -Encoding UTF8
    
    Write-Host "Base64 decoding successful" -ForegroundColor Green
    Write-Host "Keypair file created" -ForegroundColor Green
    
    # Check byte count
    $byteCount = $keypairBytes.Count
    Write-Host "Byte count: $byteCount" -ForegroundColor White
    
    if ($byteCount -eq 64) {
        Write-Host "Valid keypair format (64 bytes)" -ForegroundColor Green
        
        # Test if solana-keygen can read it
        if (Get-Command solana-keygen -ErrorAction SilentlyContinue) {
            $walletAddress = & solana-keygen pubkey $keypairFile 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Solana keygen validation passed" -ForegroundColor Green
                Write-Host "Wallet address: $walletAddress" -ForegroundColor White
            } else {
                Write-Host "Solana keygen validation failed" -ForegroundColor Red
            }
        } else {
            Write-Host "Solana keygen not available for testing" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Invalid keypair format. Expected 64 bytes, got $byteCount" -ForegroundColor Red
    }
} catch {
    Write-Host "Base64 decoding failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Cleanup
Remove-Item -Recurse -Force $testDir

Write-Host ""
Write-Host "Summary: Your Base64 secret should work in GitHub Actions!" -ForegroundColor Green
Write-Host "Secret: $base64Secret" -ForegroundColor White