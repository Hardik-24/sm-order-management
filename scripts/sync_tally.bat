@echo off
title Tally Prime Read-Only Sync Agent
cd /d "%~dp0\.."
echo ====================================================
echo   Syncing Tally Prime Receivables to App Database...
echo ====================================================
node scripts/sync_tally_receivables.cjs
echo.
pause
