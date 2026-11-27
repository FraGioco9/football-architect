@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Football Architect - Rebase DEV
set "PIN=7e4c647aa0ab84bbb721143f763fa56590f05a20"
set "REPO=%USERPROFILE%\Desktop\football-architect"
set "WORK=%USERPROFILE%\Desktop\football-architect-preflight"
echo Riallineamento dei 150 giocatori sul solo D1 DEV.
echo Chiudi la finestra del normale server DEV prima di continuare.
echo Tieni i due file JSON nella stessa cartella di questo avviatore.
pause
for %%P in (git.exe node.exe npm.cmd pwsh.exe) do (
  where /q %%P
  if errorlevel 1 (
    echo Manca %%P. Servono Git, Node con npm e PowerShell 7.
    goto :failed
  )
)
set "EVIDENCE="
for %%F in ("%~dp0retained-before-reset-*.json") do if exist "%%~fF" (
  if defined EVIDENCE goto :files
  set "EVIDENCE=%%~fF"
)
set "RECEIPT="
for %%F in ("%~dp0sporting-reset-receipt-*.json") do if exist "%%~fF" (
  if defined RECEIPT goto :files
  set "RECEIPT=%%~fF"
)
if not defined EVIDENCE goto :files
if not defined RECEIPT goto :files
if exist "%WORK%\.git" goto :checkout
if not exist "%REPO%\.git" (
  echo Repository non trovato sul Desktop.
  goto :failed
)
git -C "%REPO%" fetch origin main || goto :failed
git -C "%REPO%" worktree add --detach "%WORK%" "%PIN%" || goto :failed
:checkout
cd /d "%WORK%" || goto :failed
pwsh -NoProfile -Command "$head=git rev-parse HEAD; if($LASTEXITCODE -ne 0 -or $head -cne $env:PIN){throw 'Commit del worktree diverso da quello approvato.'}; $dirty=git status --porcelain --untracked-files=normal; if($LASTEXITCODE -ne 0 -or $dirty){throw 'Il worktree deve essere pulito.'}"
if errorlevel 1 goto :failed
pwsh -NoProfile -Command "$ports=[Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port; if(2000 -in $ports -or 8787 -in $ports){throw 'Porta 2000 o 8787 occupata. Chiudi il server DEV e riapri questo file.'}"
if errorlevel 1 goto :failed
if not exist "backend\node_modules\.bin\wrangler.cmd" (
  call npm.cmd ci --prefix backend
  if errorlevel 1 goto :failed
)
start "Football Architect - Worker DEV" pwsh.exe -NoProfile -File ".\tools\dev-operator.ps1" -Action start -ApprovedCommit "%PIN%"
if errorlevel 1 goto :failed
echo Attendo che l'operatore richieda l'autenticazione...
pwsh -NoProfile -Command "$until=(Get-Date).AddMinutes(3); do {try {$r=Invoke-WebRequest -NoProxy -SkipHttpErrorCheck -MaximumRedirection 0 -TimeoutSec 3 -Uri 'http://app.localhost:2000/api/admin/dev-operator'; if($r.StatusCode -in 401,403){exit 0}} catch {}; Start-Sleep -Seconds 2} while((Get-Date) -lt $until); throw 'Operatore non pronto. Controlla la finestra Worker DEV.'"
if errorlevel 1 goto :failed
pwsh.exe -NoProfile -File ".\tools\dev-operator.ps1" -Action rebase -ApprovedCommit "%PIN%" -EvidencePath "%EVIDENCE%" -ResetReceiptPath "%RECEIPT%"
if errorlevel 1 goto :failed
echo Controlla il risultato appena mostrato. Puoi chiudere la finestra Worker DEV.
pause
exit /b 0
:files
echo Metti questo file con una sola evidenza retained-before-reset e una sola sporting-reset-receipt, entrambe JSON.
:failed
echo Esecuzione interrotta. Conserva il messaggio mostrato prima di riprovare.
pause
exit /b 1
