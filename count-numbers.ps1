$content = Get-Content './proper_wallet.json' -Raw
$numbers = $content -replace '[\[\]]', '' -split ','
Write-Host "Number count: $($numbers.Count)"
Write-Host "Content: $content"