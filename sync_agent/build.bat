@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   Compiling SM Flow Sync Agent (Native Windows Program)
echo ========================================================

set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
set "OUT_EXE=SMFlowSyncAgent.exe"

if not exist "%CSC%" (
    echo [x] Error: .NET Framework C# Compiler not found at:
    echo     %CSC%
    pause
    exit /b 1
)

echo [*] Compiling Program.cs with .NET Framework 4.8...
"%CSC%" /nologo /target:winexe /optimize+ /platform:anycpu /r:System.dll,System.Core.dll,System.Drawing.dll,System.Windows.Forms.dll,System.Web.Extensions.dll /out:"%OUT_EXE%" Program.cs

if errorlevel 1 (
    echo.
    echo [x] Compilation FAILED.
    exit /b 1
)

echo.
echo ========================================================
echo   Compilation SUCCESSFUL! 
echo   Generated: %CD%\%OUT_EXE%
echo ========================================================
dir "%OUT_EXE%" | findstr "%OUT_EXE%"
echo.
exit /b 0
