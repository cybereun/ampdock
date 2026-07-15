$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Split-Path -Parent $root
$release = Join-Path $project "dist-release"
$makensis = "C:\Users\user\AppData\Local\electron-builder\Cache\nsis\nsis-3.0.4.1\makensis.exe"
if (-not (Test-Path -LiteralPath $makensis)) { throw "NSIS compiler not found" }

& (Join-Path $root "build_edge.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
New-Item -ItemType Directory -Force -Path $release | Out-Null
Copy-Item -LiteralPath (Join-Path $project "dist-edge\AmpDock.exe") -Destination (Join-Path $release "AmpDock-1.0.0-x64-portable.exe") -Force
& $makensis /V2 (Join-Path $root "AmpDock.nsi")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Get-ChildItem -LiteralPath $release -Filter "AmpDock-1.0.0-x64-*.exe" | Select-Object Name, Length
