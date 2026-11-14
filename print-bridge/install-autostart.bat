@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Tao lối tắt trong thư mục Startup của Windows: cầu nối tự chạy mỗi khi máy tính bật
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Cau noi in bill.lnk'); $s.TargetPath='%~dp0start-bridge.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
if errorlevel 1 (
  echo Khong tao duoc loi tat.
) else (
  echo Xong! Cau noi se tu chay moi khi bat may tinh.
)
echo.
echo Nho: cai may tinh khong tu ngu (Settings - System - Power - Sleep = Never).
pause
