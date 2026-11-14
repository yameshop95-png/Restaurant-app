@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Dat IP moi cho may in qua cong USB (lenh 1F 1B 1F 91 00 49 50 + 4 so IP). Dat IP: 192.168.0.250 = C0 A8 00 FA
set PRINTER=Uniwell
echo Se doi IP may in thanh 192.168.0.250 (may in "%PRINTER%", qua USB)...
powershell -NoProfile -Command "[IO.File]::WriteAllBytes('%TEMP%\setip.bin',[byte[]](0x1F,0x1B,0x1F,0x91,0x00,0x49,0x50,0xC0,0xA8,0x00,0xFA))"
powershell -NoProfile -ExecutionPolicy Bypass -File raw-print.ps1 -Printer "%PRINTER%" -File "%TEMP%\setip.bin"
echo.
echo Da gui lenh. Tat may in, bat lai, roi in tu kiem tra (giu nut FEED luc bat may) de xem IP.
pause
