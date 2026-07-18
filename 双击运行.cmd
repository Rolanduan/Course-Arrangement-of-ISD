@echo off
title Supabase Auto Deploy
cd /d "D:\BaiduSyncdisk\为明相关\2. 国际部\【排课系统】\【可用版本】"
powershell -ExecutionPolicy Bypass -File auto-deploy.ps1
if errorlevel 1 pause
