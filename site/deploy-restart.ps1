# SwitchNest — PowerShell Deploy (Plesk Windows)
# Plesk deployment action me ye command daalo:
#   powershell -ExecutionPolicy Bypass -File deploy-restart.ps1

$ErrorActionPreference = "SilentlyContinue"
$AppDir = "C:\Inetpub\vhosts\bhartitechnical.com\onlineswitch.bhartitechnical.com"

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Deploy triggered"

Set-Location $AppDir

# 1. Git pull
Write-Host "Pulling latest code..."
git pull origin main

# 2. Install deps
Write-Host "Installing dependencies..."
if (Test-Path "package-lock.json") {
    npm ci --production 2>$null
} else {
    npm install --production 2>$null
}

# 3. Prisma generate
Write-Host "Generating Prisma client..."
Set-Location "$AppDir\site\apps\api"
npx prisma generate --schema=prisma\schema.prisma 2>$null
Set-Location $AppDir

# 4. Kill old node processes
Write-Host "Stopping old processes..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force 2>$null
Start-Sleep -Seconds 2

# 5. Start API server
Write-Host "Starting API server..."
Set-Location "$AppDir\site\apps\api"
Start-Process -FilePath "npx" -ArgumentList "tsx src/index.ts" -WindowStyle Hidden -WorkingDirectory "$AppDir\site\apps\api"
Set-Location $AppDir

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Deploy complete"
