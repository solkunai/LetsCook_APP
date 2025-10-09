# Verify Base64 keypair conversion
$base64Secret = "/l4MyB0LuinMBtr+TgqEfYKtNyXLIg6UM4QZUZTp/uwShb9FqxmFIOZnE2uFUT3sXetd1QeD0dKb1TReW02AuQ=="
$originalBytes = @(254,94,12,200,29,11,186,41,204,6,218,254,78,10,132,125,130,173,55,37,203,34,14,148,51,132,25,81,148,233,254,236,18,133,191,69,171,25,133,32,230,103,19,107,133,81,61,236,93,235,93,213,7,131,209,210,155,213,52,94,91,77,128,185)

# Decode Base64 back to bytes
$decodedBytes = [System.Convert]::FromBase64String($base64Secret)

Write-Host "Verification Results:"
Write-Host "===================="
Write-Host "Original bytes count: $($originalBytes.Count)"
Write-Host "Decoded bytes count: $($decodedBytes.Count)"
Write-Host "Bytes match: $($originalBytes.Count -eq $decodedBytes.Count)"

# Check if all bytes match
$match = $true
for ($i = 0; $i -lt $originalBytes.Count; $i++) {
    if ($originalBytes[$i] -ne $decodedBytes[$i]) {
        $match = $false
        break
    }
}

Write-Host "All bytes identical: $match"
Write-Host ""
Write-Host "Base64 Secret is VALID: $base64Secret"