# Supabase Auto Deploy - 双击运行即可
# Created by Claude

$ErrorActionPreference = "Stop"
$projectDir = "D:\BaiduSyncdisk\为明相关\2. 国际部\【排课系统】\【可用版本】"
Set-Location $projectDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Supabase Edge Function 自动部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check login
Write-Host "[1/2] 检查登录状态..." -ForegroundColor Yellow
$loginStatus = supabase status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "需要登录 Supabase，正在打开浏览器..." -ForegroundColor Yellow
    Write-Host "请在浏览器中点击授权按钮..." -ForegroundColor Yellow
    Start-Process "supabase" -ArgumentList "login"
    Write-Host "等待授权完成..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10

    # Check again
    $loginStatus = supabase status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "登录失败或未完成，请重试" -ForegroundColor Red
        pause
        exit 1
    }
}
Write-Host "OK: 已登录" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy
Write-Host "[2/2] 正在部署 api function..." -ForegroundColor Yellow
supabase functions deploy api --project-ref vxsetefeaquvxbwarmis --no-verify-jwt

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "部署成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Function URL:" -ForegroundColor Cyan
    Write-Host "https://vxsetefeaquvxbwarmis.supabase.co/functions/v1/api" -ForegroundColor White
} else {
    Write-Host "部署失败" -ForegroundColor Red
}

Write-Host ""
Write-Host "按任意键关闭..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
