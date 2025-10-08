# CookLaunch Deployment Script
# Run this after setup.ps1

Write-Host "🚀 CookLaunch Deployment" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green

# Check if tools are installed
Write-Host "`n🔍 Checking Tools..." -ForegroundColor Yellow
try {
    $rustVersion = rustc --version
    $solanaVersion = solana --version
    $anchorVersion = anchor --version
    Write-Host "✅ All tools ready" -ForegroundColor Green
} catch {
    Write-Host "❌ Tools not found. Please run setup.ps1 first" -ForegroundColor Red
    exit 1
}

# Check Solana configuration
Write-Host "`n⚙️ Checking Solana Config..." -ForegroundColor Yellow
$config = solana config get
if ($config -match "devnet") {
    Write-Host "✅ Solana configured for devnet" -ForegroundColor Green
} else {
    Write-Host "❌ Solana not configured for devnet" -ForegroundColor Red
    exit 1
}

# Check balance
Write-Host "`n💰 Checking SOL Balance..." -ForegroundColor Yellow
$balance = solana balance
Write-Host "Current balance: $balance SOL" -ForegroundColor Cyan
if ([double]$balance -lt 1) {
    Write-Host "⚠️ Low balance, requesting more SOL..." -ForegroundColor Yellow
    solana airdrop 2
}

# Deploy Main Program
Write-Host "`n📦 Deploying Main Program..." -ForegroundColor Yellow
try {
    Set-Location "Backend\program"
    Write-Host "Building main program..." -ForegroundColor Yellow
    anchor build
    
    Write-Host "Deploying main program..." -ForegroundColor Yellow
    $deployOutput = anchor deploy --provider.cluster devnet 2>&1
    Write-Host $deployOutput -ForegroundColor Cyan
    
    # Extract program ID from output
    if ($deployOutput -match "Program Id: ([A-Za-z0-9]{32,44})") {
        $mainProgramId = $matches[1]
        Write-Host "✅ Main Program deployed: $mainProgramId" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Could not extract main program ID" -ForegroundColor Yellow
    }
    
    Set-Location "..\.."
} catch {
    Write-Host "❌ Failed to deploy main program: $($_.Exception.Message)" -ForegroundColor Red
    Set-Location "..\.."
}

# Deploy Citizens Program
Write-Host "`n📦 Deploying Citizens Program..." -ForegroundColor Yellow
try {
    Set-Location "Backend\citizens"
    Write-Host "Building citizens program..." -ForegroundColor Yellow
    anchor build
    
    Write-Host "Deploying citizens program..." -ForegroundColor Yellow
    $deployOutput = anchor deploy --provider.cluster devnet 2>&1
    Write-Host $deployOutput -ForegroundColor Cyan
    
    # Extract program ID from output
    if ($deployOutput -match "Program Id: ([A-Za-z0-9]{32,44})") {
        $citizensProgramId = $matches[1]
        Write-Host "✅ Citizens Program deployed: $citizensProgramId" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Could not extract citizens program ID" -ForegroundColor Yellow
    }
    
    Set-Location "..\.."
} catch {
    Write-Host "❌ Failed to deploy citizens program: $($_.Exception.Message)" -ForegroundColor Red
    Set-Location "..\.."
}

# Deploy Listings Program
Write-Host "`n📦 Deploying Listings Program..." -ForegroundColor Yellow
try {
    Set-Location "Backend\listings"
    Write-Host "Building listings program..." -ForegroundColor Yellow
    anchor build
    
    Write-Host "Deploying listings program..." -ForegroundColor Yellow
    $deployOutput = anchor deploy --provider.cluster devnet 2>&1
    Write-Host $deployOutput -ForegroundColor Cyan
    
    # Extract program ID from output
    if ($deployOutput -match "Program Id: ([A-Za-z0-9]{32,44})") {
        $listingsProgramId = $matches[1]
        Write-Host "✅ Listings Program deployed: $listingsProgramId" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Could not extract listings program ID" -ForegroundColor Yellow
    }
    
    Set-Location "..\.."
} catch {
    Write-Host "❌ Failed to deploy listings program: $($_.Exception.Message)" -ForegroundColor Red
    Set-Location "..\.."
}

# Deploy Transfer Hook Program
Write-Host "`n📦 Deploying Transfer Hook Program..." -ForegroundColor Yellow
try {
    Set-Location "Backend\transfer_hook\program"
    Write-Host "Building transfer hook program..." -ForegroundColor Yellow
    anchor build
    
    Write-Host "Deploying transfer hook program..." -ForegroundColor Yellow
    $deployOutput = anchor deploy --provider.cluster devnet 2>&1
    Write-Host $deployOutput -ForegroundColor Cyan
    
    # Extract program ID from output
    if ($deployOutput -match "Program Id: ([A-Za-z0-9]{32,44})") {
        $transferHookProgramId = $matches[1]
        Write-Host "✅ Transfer Hook Program deployed: $transferHookProgramId" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Could not extract transfer hook program ID" -ForegroundColor Yellow
    }
    
    Set-Location "..\..\..\.."
} catch {
    Write-Host "❌ Failed to deploy transfer hook program: $($_.Exception.Message)" -ForegroundColor Red
    Set-Location "..\..\..\.."
}

# Create program IDs file
Write-Host "`n📝 Creating Program IDs File..." -ForegroundColor Yellow
$programIdsContent = @"
# CookLaunch Deployed Program IDs
# Generated on $(Get-Date)

# Main Program (Core Launch System)
MAIN_PROGRAM_ID=$mainProgramId

# Citizens Program (Gamification)
CITIZENS_PROGRAM_ID=$citizensProgramId

# Listings Program (NFT Marketplace)
LISTINGS_PROGRAM_ID=$listingsProgramId

# Transfer Hook Program (Custom Transfer Logic)
TRANSFER_HOOK_PROGRAM_ID=$transferHookProgramId

# Update these in Frontend/client/src/lib/apiServices.ts
"@

$programIdsContent | Out-File -FilePath "program-ids.txt" -Encoding UTF8
Write-Host "✅ Program IDs saved to program-ids.txt" -ForegroundColor Green

# Display summary
Write-Host "`n🎉 Deployment Summary!" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green
Write-Host "Main Program ID: $mainProgramId" -ForegroundColor Cyan
Write-Host "Citizens Program ID: $citizensProgramId" -ForegroundColor Cyan
Write-Host "Listings Program ID: $listingsProgramId" -ForegroundColor Cyan
Write-Host "Transfer Hook Program ID: $transferHookProgramId" -ForegroundColor Cyan

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update program IDs in Frontend/client/src/lib/apiServices.ts" -ForegroundColor White
Write-Host "2. Test the frontend with real blockchain integration" -ForegroundColor White
Write-Host "3. Deploy frontend to production hosting" -ForegroundColor White

Write-Host "`n🚀 Your CookLaunch platform is now live on Solana devnet!" -ForegroundColor Green




