Unicode true
RequestExecutionLevel user
Name "AmpDock"
OutFile "C:\Users\user\AppData\Local\Temp\AmpDock-1.0.1-x64-installer.exe"
InstallDir "$LOCALAPPDATA\Programs\AmpDock"
ShowInstDetails show
Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File "publish\AmpDock.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\AmpDock"
  CreateShortcut "$SMPROGRAMS\AmpDock\AmpDock.lnk" "$INSTDIR\AmpDock.exe"
  CreateShortcut "$DESKTOP\AmpDock.lnk" "$INSTDIR\AmpDock.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpDock" "DisplayName" "AmpDock"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpDock" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  SetOutPath "$TEMP"
  Delete "$DESKTOP\AmpDock.lnk"
  Delete "$SMPROGRAMS\AmpDock\AmpDock.lnk"
  RMDir "$SMPROGRAMS\AmpDock"
  Delete "$INSTDIR\AmpDock.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpDock"
SectionEnd
