# Script to update program ID across all frontend files
param(
    [Parameter(Mandatory=$true)]
    [string]$NewProgramId
)

Write-Host "🔄 Updating program ID to: $NewProgramId" -ForegroundColor Green

# Update Frontend environment files
$envFiles = @(
    "Frontend/devnet.env",
    "Frontend/.env"
)

foreach ($file in $envFiles) {
    if (Test-Path $file) {
        Write-Host "📝 Updating $file" -ForegroundColor Yellow
        (Get-Content $file) -replace "VITE_MAIN_PROGRAM_ID=.*", "VITE_MAIN_PROGRAM_ID=$NewProgramId" | Set-Content $file
        (Get-Content $file) -replace "VITE_CITIZENS_PROGRAM_ID=.*", "VITE_CITIZENS_PROGRAM_ID=$NewProgramId" | Set-Content $file
        (Get-Content $file) -replace "VITE_LISTINGS_PROGRAM_ID=.*", "VITE_LISTINGS_PROGRAM_ID=$NewProgramId" | Set-Content $file
        (Get-Content $file) -replace "VITE_TRANSFER_HOOK_PROGRAM_ID=.*", "VITE_TRANSFER_HOOK_PROGRAM_ID=$NewProgramId" | Set-Content $file
    }
}

# Update hardcoded program IDs in TypeScript files
$tsFiles = @(
    "Frontend/client/src/lib/solanaProgram.ts",
    "Frontend/client/src/lib/solana.ts",
    "Frontend/client/src/lib/apiServices.ts"
)

foreach ($file in $tsFiles) {
    if (Test-Path $file) {
        Write-Host "📝 Updating $file" -ForegroundColor Yellow
        (Get-Content $file) -replace "Cook7kyoaKaiG57VBDUjE2KuPXrWdLEu7d3FdDgsijHU", $NewProgramId | Set-Content $file
    }
}

Write-Host "✅ Program ID updated successfully!" -ForegroundColor Green
Write-Host "🚀 You can now test your frontend with the new program ID" -ForegroundColor Cyan