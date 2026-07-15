Unicode true
RequestExecutionLevel admin
Name "AmpDock"
OutFile "..\dist-release\AmpDock-1.0.0-x64-installer.exe"
InstallDir "$PROGRAMFILES64\AmpDock"
InstallDirRegKey HKLM "Software\AmpDock" "InstallDir"
ShowInstDetails show
ShowUninstDetails show
Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetShellVarContext all
  SetOutPath "$INSTDIR"
  File "..\dist-edge\AmpDock.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\AmpDock"
  CreateShortcut "$SMPROGRAMS\AmpDock\AmpDock.lnk" "$INSTDIR\AmpDock.exe"
  CreateShortcut "$SMPROGRAMS\AmpDock\Uninstall AmpDock.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\AmpDock.lnk" "$INSTDIR\AmpDock.exe"
  WriteRegStr HKLM "Software\AmpDock" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpDock" "DisplayName" "AmpDock"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpDock" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpDock" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpDock" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext all
  Delete "$DESKTOP\AmpDock.lnk"
  Delete "$SMPROGRAMS\AmpDock\AmpDock.lnk"
  Delete "$SMPROGRAMS\AmpDock\Uninstall AmpDock.lnk"
  RMDir "$SMPROGRAMS\AmpDock"
  Delete "$INSTDIR\AmpDock.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "Software\AmpDock"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AmpDock"
SectionEnd
