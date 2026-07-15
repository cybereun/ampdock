$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$release = Join-Path $root "release-final"
$makensis = "C:\Users\user\AppData\Local\electron-builder\Cache\nsis\nsis-3.0.4.1\makensis.exe"
if (-not (Test-Path -LiteralPath $makensis)) { throw "NSIS compiler is required" }
& (Join-Path $root "build.ps1")
New-Item -ItemType Directory -Force -Path $release | Out-Null
Copy-Item -LiteralPath (Join-Path $root "publish\AmpDock.exe") -Destination (Join-Path $release "AmpDock-1.0.1-x64-portable.exe") -Force
& $makensis (Join-Path $root "AmpDock.nsi")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Copy-Item -LiteralPath "C:\Users\user\AppData\Local\Temp\AmpDock-1.0.1-x64-installer.exe" -Destination (Join-Path $release "AmpDock-1.0.1-x64-installer.exe") -Force
Get-ChildItem -LiteralPath $release -Filter "AmpDock-1.0.1-x64-*.exe" | Select-Object Name,Length
