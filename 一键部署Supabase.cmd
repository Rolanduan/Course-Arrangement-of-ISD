@echo off
echo ====================================
echo   排课系统 - Supabase Edge Function 部署
echo ====================================
echo.
echo 正在启动部署脚本...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0一键部署Supabase.ps1"

pause
