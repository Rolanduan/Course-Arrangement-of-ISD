@echo off
chcp 65001 >nul
echo ====================================
echo   Deploy Supabase Edge Function
echo ====================================
echo.
cd /d "%~dp0"
echo Checking Supabase CLI...
supabase --version
if errorlevel 1 (
    echo ERROR: Supabase CLI not installed
    echo Please install from: https://supabase.com/docs/guides/cli
    pause
    exit /b 1
)
echo OK: Supabase CLI found
echo.
echo Checking login status...
supabase status >nul 2>&1
if errorlevel 1 (
    echo Please login to Supabase...
    echo Browser will open for authorization
    supabase login
    if errorlevel 1 (
        echo ERROR: Login failed
        pause
        exit /b 1
    )
)
echo OK: Logged in
echo.
echo Deploying Edge Function...
supabase functions deploy api --project-ref vxsetefeaquvxbwarmis --no-verify-jwt
if errorlevel 1 (
    echo.
    echo ERROR: Deployment failed
    pause
    exit /b 1
)
echo.
echo ====================================
echo   Deployment Successful!
echo ====================================
echo.
echo Edge Function URL:
echo https://vxsetefeaquvxbwarmis.supabase.co/functions/v1/api
echo.
pause
