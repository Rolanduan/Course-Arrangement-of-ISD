@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 重庆为明国际教务排课系统
echo 正在启动排课系统，请不要关闭此窗口……
start "排课系统服务" /min cmd /c "npm run dev"
timeout /t 4 /nobreak >nul
start "" "http://127.0.0.1:5173"
echo 系统已在浏览器中打开。
echo 若未自动打开，请访问 http://127.0.0.1:5173
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object {$_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown'} ^| Select-Object -First 1 -ExpandProperty IPAddress)"`) do set LAN_IP=%%i
if defined LAN_IP echo 局域网协作地址：http://%LAN_IP%:5173
echo 请只将协作地址发送给受信任的填写人员。
pause
