$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Split-Path -Parent $root
$dist = Join-Path $project "dist-edge"
$source = Join-Path $root "AmpDockEdge.cs"
$out = Join-Path $dist "AmpDock.exe"
$csc = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"
if (-not (Test-Path -LiteralPath $csc)) { $csc = "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe" }
if (-not (Test-Path -LiteralPath $csc)) { throw "C# compiler not found" }
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$resources = @(
  "/resource:$(Join-Path $project 'src\\index.html'),src.index.html",
  "/resource:$(Join-Path $project 'src\\styles.css'),src.styles.css",
  "/resource:$(Join-Path $project 'src\\renderer.js'),src.renderer.js",
  "/resource:$(Join-Path $root 'edge-bridge.js'),native.edge-bridge.js",
  "/resource:$(Join-Path $root 'vendor\\lucide.js'),native.vendor.lucide.js"
)
& $csc /nologo /target:winexe /platform:x64 /optimize+ "/out:$out" "/win32icon:$(Join-Path $project 'assets\\icon.ico')" /reference:System.dll /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll $resources $source
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$check = Start-Process -FilePath $out -ArgumentList "--check-only" -Wait -PassThru -WindowStyle Hidden
if ($check.ExitCode -ne 0) { throw "Native launcher smoke check failed with exit code $($check.ExitCode)" }
Write-Output "Built $out"
