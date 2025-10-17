# CookLaunch Frontend Deployment Script

Write-Host "🌐 CookLaunch Frontend Deployment" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "Frontend")) {
    Write-Host "❌ Frontend directory not found. Please run from project root." -ForegroundColor Red
    exit 1
}

# Navigate to Frontend
Set-Location "Frontend"

# Install dependencies
Write-Host "`n📦 Installing Frontend Dependencies..." -ForegroundColor Yellow
try {
    npm install
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install dependencies: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Build frontend
Write-Host "`n🔨 Building Frontend..." -ForegroundColor Yellow
try {
    npm run build
    Write-Host "✅ Frontend built successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check if build output exists
if (Test-Path "dist") {
    Write-Host "✅ Build output created in dist/ folder" -ForegroundColor Green
} else {
    Write-Host "❌ Build output not found" -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Frontend Ready for Deployment!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

Write-Host "`n📋 Deployment Options:" -ForegroundColor Yellow
Write-Host "1. Vercel (Recommended):" -ForegroundColor Cyan
Write-Host "   npm install -g vercel" -ForegroundColor White
Write-Host "   vercel --prod" -ForegroundColor White

Write-Host "`n2. Netlify:" -ForegroundColor Cyan
Write-Host "   Upload dist/ folder to Netlify" -ForegroundColor White

Write-Host "`n3. Local Development:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor White

Write-Host "`n4. Static Hosting:" -ForegroundColor Cyan
Write-Host "   Upload dist/ folder to any static hosting service" -ForegroundColor White

Write-Host "`n💡 Your CookLaunch frontend is ready!" -ForegroundColor Green
Write-Host "The dist/ folder contains your production-ready website." -ForegroundColor White













