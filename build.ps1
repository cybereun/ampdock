$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root "publish"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$refs = @(
  "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\PresentationFramework\v4.0_4.0.0.0__31bf3856ad364e35\PresentationFramework.dll",
  "C:\Windows\Microsoft.NET\assembly\GAC_64\PresentationCore\v4.0_4.0.0.0__31bf3856ad364e35\PresentationCore.dll",
  "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\WindowsBase\v4.0_4.0.0.0__31bf3856ad364e35\WindowsBase.dll",
  "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\System.Xaml\v4.0_4.0.0.0__b77a5c561934e089\System.Xaml.dll",
  "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\netstandard\v4.0_2.0.0.0__cc7b13ffcd2ddd51\netstandard.dll",
  (Join-Path $root "vendor\lib\NAudio.Core.dll"),
  (Join-Path $root "vendor\lib\NAudio.WinMM.dll"),
  (Join-Path $root "vendor\lib\NAudio.dll"),
  "System.Windows.Forms.dll"
)
New-Item -ItemType Directory -Force -Path $out | Out-Null
& $csc /nologo /target:winexe /platform:x64 /optimize+ "/out:$(Join-Path $out 'AmpDock.exe')" $refs.ForEach({ "/reference:$_" }) "/resource:$(Join-Path $root 'vendor\lib\NAudio.Core.dll'),AmpDock.lib.NAudio.Core.dll" "/resource:$(Join-Path $root 'vendor\lib\NAudio.WinMM.dll'),AmpDock.lib.NAudio.WinMM.dll" "/resource:$(Join-Path $root 'vendor\lib\NAudio.dll'),AmpDock.lib.NAudio.dll" "/resource:$(Join-Path $root 'vendor\lib\NAudio.Asio.dll'),AmpDock.lib.NAudio.Asio.dll" "/resource:$(Join-Path $root 'vendor\lib\NAudio.Midi.dll'),AmpDock.lib.NAudio.Midi.dll" "/resource:$(Join-Path $root 'vendor\lib\NAudio.Wasapi.dll'),AmpDock.lib.NAudio.Wasapi.dll" "/resource:$(Join-Path $root 'vendor\lib\NAudio.WinForms.dll'),AmpDock.lib.NAudio.WinForms.dll" (Join-Path $root "src\AmpDock.cs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& (Join-Path $out "AmpDock.exe") --check-only
Write-Output "Built $(Join-Path $out 'AmpDock.exe')"
