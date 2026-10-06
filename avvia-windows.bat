@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Node.js non trovato. Installa Node.js 18 o superiore prima di avviare il gioco.
 pause
 exit /b 1
)
echo.
echo   FOOTBALL ARCHITECT
echo   Apri http://localhost:2000 nel browser.
echo   Per arrestare il gioco premi Ctrl+C.
echo.
node server.mjs
pause
