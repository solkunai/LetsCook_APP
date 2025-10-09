$keypairBytes = @(254,94,12,200,29,11,186,41,204,6,218,254,78,10,132,125,130,173,55,37,203,34,14,148,51,132,25,81,148,233,254,236,18,133,191,69,171,25,133,32,230,103,19,107,133,81,61,236,93,235,93,213,7,131,209,210,155,213,52,94,91,77,128,185)
$base64Secret = [System.Convert]::ToBase64String($keypairBytes)

Write-Host "Your existing Solana keypair converted to Base64:"
Write-Host "=========================================="
Write-Host "Secret Name: SOLANA_WALLET_KEY"
Write-Host "Secret Value: $base64Secret"
Write-Host "=========================================="