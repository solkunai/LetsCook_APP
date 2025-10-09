# Convert wallet array to proper format for GitHub Secrets

# Your wallet array (comma-separated numbers)
$WALLET_ARRAY = "215,159,206,0,188,230,231,71,252,241,245,16,249,8,201,110,122,47,55,1,34,32,101,128,201,40,61,177,60,167,235,222,173,87,200,72,215,53,132,52,131,227,231,45,17,154,79,172,92,92,144,121,83,103,182,111,52,117,101,42,245,222,238"

Write-Host "Converting wallet array to different formats..."
Write-Host ""

# Method 1: Convert to JSON array format and base64 encode
$jsonArray = "[$WALLET_ARRAY]"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonArray)
$base64 = [System.Convert]::ToBase64String($bytes)

Write-Host "Method 1: Base64 Encoded JSON Array (for GitHub Secret)"
Write-Host $base64
Write-Host ""

# Method 2: Direct array format (what you currently have)
Write-Host "Method 2: Direct Array Format (current)"
Write-Host $WALLET_ARRAY
Write-Host ""

Write-Host "For GitHub Secrets, use Method 1 (base64 encoded JSON array)"
Write-Host "Copy the base64 string above and use it as your SOLANA_WALLET_KEY secret"