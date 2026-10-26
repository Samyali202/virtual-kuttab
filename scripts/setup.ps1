# Setup Virtual Kuttab (PowerShell)
$Root = Split-Path -Parent $PSScriptRoot
Write-Host "Root: $Root"
python -m pip install -r "$Root\services\asr\requirements.txt"
Set-Location "$Root\apps\web"
if (-not (Test-Path node_modules)) { npm install }
Write-Host "Done. Start ASR: cd services\asr; uvicorn main:app --port 8088"
Write-Host "Start web: cd apps\web; npm run dev"
