@echo off
cd /d "D:\BaiduSyncdisk\为明相关\2. 国际部\【排课系统】\【可用版本】"
echo Building...
call npm run build
echo.
echo Deploying to Netlify...
npx netlify deploy --prod --dir=dist --functions=netlify/functions --message="Manual deploy"
echo.
echo Done!
pause
