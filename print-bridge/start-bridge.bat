@echo off
chcp 65001 >nul
title Cau noi in bill - DUNG TAT cua so nay
cd /d "%~dp0"

rem ===== SUA 2 DONG DUOI DAY (mo file bang Notepad) =====
set STAFF_PIN=DAT_MA_PIN_MAY_IN_O_DAY
set PRINTER_NAME=Uniwell
rem ======================================================

set SUPABASE_URL=https://hgkqcswzggsbpusrhpue.supabase.co
set SUPABASE_KEY=sb_publishable_qm7OXVxaPuwAhAB2zjOXow_7zBFNnON

if "%STAFF_PIN%"=="DAT_MA_PIN_MAY_IN_O_DAY" (
  echo Chua dat ma PIN. Mo file start-bridge.bat bang Notepad va sua dong set STAFF_PIN=
  pause
  exit /b 2
)

:loop
echo [%date% %time%] Dang chay cau noi in...
node bridge.mjs
rem Ma 2 = thieu cau hinh hoac PIN sai: dung lai, khong thu lai (thu nhieu lan se bi khoa PIN)
if errorlevel 2 (
  echo.
  echo Dung lai vi PIN sai hoac thieu cau hinh. Sua PIN trong start-bridge.bat roi chay lai.
  pause
  exit /b 2
)
echo Cau noi bi dung, tu chay lai sau 10 giay...
timeout /t 10 /nobreak >nul
goto loop
