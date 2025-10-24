# Add Metaplex Metadata to Existing Token
# 
# This PowerShell script adds metadata to an existing token using Metaplex CLI
# 
# Usage:
#   .\add-metadata.ps1 <token_mint_address> <token_name> <token_symbol> <metadata_uri>
# 
# Example:
#   .\add-metadata.ps1 DFWjWGiaFRW53AG8rUnRkcucpkeRZP1aexaUyrZ4oDsz "Devin Token" "DEVIN" "https://gateway.pinata.cloud/ipfs/bafkreig7qoceupufcyc6bnruyuywe6csk6bq6mlum7hrwyfivomi5isdve"

param(
    [Parameter(Mandatory=$true)]
    [string]$TokenMint,
    
    [Parameter(Mandatory=$true)]
    [string]$TokenName,
    
    [Parameter(Mandatory=$true)]
    [string]$TokenSymbol,
    
    [Parameter(Mandatory=$true)]
    [string]$MetadataUri
)

Write-Host "🏷️ Adding Metaplex metadata to token..." -ForegroundColor Green
Write-Host ""

Write-Host "📋 Token Details:" -ForegroundColor Cyan
Write-Host "   Token Mint: $TokenMint" -ForegroundColor White
Write-Host "   Name: $TokenName" -ForegroundColor White
Write-Host "   Symbol: $TokenSymbol" -ForegroundColor White
Write-Host "   Metadata URI: $MetadataUri" -ForegroundColor White
Write-Host ""

try {
    # Check if Metaplex CLI is installed
    try {
        $metaplexVersion = metaplex --version
        Write-Host "✅ Metaplex CLI found: $metaplexVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Metaplex CLI not found. Installing..." -ForegroundColor Red
        Write-Host "   Run: npm install -g @metaplex-foundation/metaplex" -ForegroundColor Yellow
        Write-Host "   Or: yarn global add @metaplex-foundation/metaplex" -ForegroundColor Yellow
        exit 1
    }
    
    # Create metadata JSON file
    $metadataJson = @{
        name = $TokenName
        symbol = $TokenSymbol
        description = "$TokenName - A token created on Let's Cook platform"
        image = $MetadataUri
        attributes = @(
            @{
                trait_type = "Platform"
                value = "Let's Cook"
            },
            @{
                trait_type = "Type"
                value = "Instant Launch"
            }
        )
        properties = @{
            files = @(
                @{
                    uri = $MetadataUri
                    type = "image/jpeg"
                }
            )
            category = "image"
            creators = @(
                @{
                    address = "EXxrr4binqy7W9zUCuPKCGtz1DkmuMm1jQRnkX2UPqV" # Admin wallet
                    share = 100
                }
            )
        }
    }
    
    $metadataFile = "metadata-$TokenMint.json"
    $metadataJson | ConvertTo-Json -Depth 10 | Set-Content -Path $metadataFile
    Write-Host "📄 Created metadata file: $metadataFile" -ForegroundColor Green
    
    # Upload metadata to IPFS (if needed)
    Write-Host "📤 Uploading metadata to IPFS..." -ForegroundColor Cyan
    $uploadCommand = "metaplex upload $metadataFile --env devnet"
    Write-Host "Running: $uploadCommand" -ForegroundColor Yellow
    
    try {
        $uploadResult = Invoke-Expression $uploadCommand
        Write-Host "✅ Metadata uploaded to IPFS" -ForegroundColor Green
        Write-Host "Upload result: $uploadResult" -ForegroundColor White
        
        # Extract the IPFS URI from the result
        $ipfsMatch = $uploadResult | Select-String -Pattern "https://[^\s]+"
        $ipfsUri = if ($ipfsMatch) { $ipfsMatch.Matches[0].Value } else { $MetadataUri }
        
        Write-Host "🔗 IPFS URI: $ipfsUri" -ForegroundColor Cyan
        
        # Create metadata account
        Write-Host "📝 Creating metadata account..." -ForegroundColor Cyan
        $createCommand = "metaplex create_metadata_accounts --env devnet --keypair admin-keypair.json --mint $TokenMint --uri `"$ipfsUri`""
        Write-Host "Running: $createCommand" -ForegroundColor Yellow
        
        try {
            $createResult = Invoke-Expression $createCommand
            Write-Host "✅ Metadata account created successfully!" -ForegroundColor Green
            Write-Host "Create result: $createResult" -ForegroundColor White
            
            Write-Host ""
            Write-Host "🎉 Metadata added successfully!" -ForegroundColor Green
            Write-Host "🎯 Your token will now show up in wallets with proper metadata!" -ForegroundColor Green
            
        } catch {
            Write-Host "❌ Failed to create metadata account: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "💡 You may need to create the admin keypair file first" -ForegroundColor Yellow
            Write-Host "   Run: solana-keygen new --outfile admin-keypair.json" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "❌ Failed to upload metadata: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "💡 Using provided metadata URI instead" -ForegroundColor Yellow
        
        # Try to create metadata account with provided URI
        Write-Host "📝 Creating metadata account with provided URI..." -ForegroundColor Cyan
        $createCommand = "metaplex create_metadata_accounts --env devnet --keypair admin-keypair.json --mint $TokenMint --uri `"$MetadataUri`""
        
        try {
            $createResult = Invoke-Expression $createCommand
            Write-Host "✅ Metadata account created successfully!" -ForegroundColor Green
            Write-Host "Create result: $createResult" -ForegroundColor White
            
            Write-Host ""
            Write-Host "🎉 Metadata added successfully!" -ForegroundColor Green
            Write-Host "🎯 Your token will now show up in wallets with proper metadata!" -ForegroundColor Green
            
        } catch {
            Write-Host "❌ Failed to create metadata account: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "💡 You may need to create the admin keypair file first" -ForegroundColor Yellow
            Write-Host "   Run: solana-keygen new --outfile admin-keypair.json" -ForegroundColor Yellow
        }
    }
    
    # Clean up metadata file
    if (Test-Path $metadataFile) {
        Remove-Item $metadataFile -Force
        Write-Host "🧹 Cleaned up metadata file" -ForegroundColor Green
    }
    
} catch {
    Write-Host "❌ Error adding metadata: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Make sure Metaplex CLI is installed and configured" -ForegroundColor Yellow
}