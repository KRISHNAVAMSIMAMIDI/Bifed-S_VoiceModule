# BiFed-S Voice Authentication Demonstration Starter Script
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  BiFed-S Voice Biometric Authentication Demonstration System    " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$baseDir = $PSScriptRoot
$backendDir = Join-Path $baseDir "backend"
$frontendDir = Join-Path $baseDir "frontend"
$toolsDir = Join-Path $baseDir ".tools\node-v20.18.0-win-x64"

# Add portable node to PATH for this session
$env:PATH = "$toolsDir;$env:PATH"

Write-Host "[1/2] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "$backendDir\venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory $backendDir -PassThru

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting React Frontend on http://localhost:5173..." -ForegroundColor Green
$frontendProcess = Start-Process -FilePath "$toolsDir\node.exe" -ArgumentList "$toolsDir\node_modules\npm\bin\npm-cli.js run dev" -WorkingDirectory $frontendDir -PassThru

Write-Host ""
Write-Host "Demonstration services are active!" -ForegroundColor Green
Write-Host "  - Frontend Dashboard: http://localhost:5173" -ForegroundColor White
Write-Host "  - Backend API & Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C or close this window to terminate services." -ForegroundColor Gray

try {
    Wait-Process -Id $backendProcess.Id, $frontendProcess.Id
} finally {
    Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue
}
