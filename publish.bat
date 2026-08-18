@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "D:\node\node.exe" (
  "D:\node\node.exe" publish.js
) else (
  node publish.js
)
echo.
pause
