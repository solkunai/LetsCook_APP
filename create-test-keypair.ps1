$base64 = "/l4MyB0LuinMBtr+TgqEfYKtNyXLIg6UM4QZUZTp/uwShb9FqxmFIOZnE2uFUT3sXetd1QeD0dKb1TReW02AuQ=="
$bytes = [System.Convert]::FromBase64String($base64)
$json = "[" + ($bytes -join ",") + "]"
$json | Out-File "test_keypair.json" -Encoding UTF8
Write-Host "Created test keypair file"
Get-Content "test_keypair.json"