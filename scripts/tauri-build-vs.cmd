@echo off
setlocal

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "VSDEVCMD="

if exist "%VSWHERE%" (
  for /f "usebackq tokens=*" %%I in (`"%VSWHERE%" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
    set "VSDEVCMD=%%I\Common7\Tools\VsDevCmd.bat"
    goto :found_vs
  )
)

:found_vs
if not defined VSDEVCMD (
  set "VSDEVCMD=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
)

if not exist "%VSDEVCMD%" (
  echo Could not find VsDevCmd.bat with Microsoft C++ Build Tools installed.
  exit /b 1
)

call "%VSDEVCMD%" -arch=x64 || exit /b %ERRORLEVEL%
npm run tauri:build -- %*
