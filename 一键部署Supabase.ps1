# 排课系统 - Supabase Edge Function 一键部署脚本
# 使用方法：双击运行此脚本

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  排课系统 - Supabase Edge Function 部署" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# 设置项目目录
$projectDir = "D:\BaiduSyncdisk\为明相关\2. 国际部\【排课系统】\【可用版本】"
Set-Location $projectDir

Write-Host "[1/3] 检查 Supabase CLI..." -ForegroundColor Yellow
$supabaseVersion = supabase --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Supabase CLI 未安装！" -ForegroundColor Red
    Write-Host "请先安装 Supabase CLI：https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    pause
    exit 1
}
Write-Host "✓ Supabase CLI 版本: $supabaseVersion" -ForegroundColor Green
Write-Host ""

Write-Host "[2/3] 检查登录状态..." -ForegroundColor Yellow
$loginCheck = supabase status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "需要登录 Supabase..." -ForegroundColor Yellow
    Write-Host "即将打开浏览器进行授权..." -ForegroundColor Yellow
    Write-Host ""
    supabase login

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 登录失败！" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "✓ 登录成功！" -ForegroundColor Green
}
Write-Host ""

Write-Host "[3/3] 部署 Edge Function..." -ForegroundColor Yellow
Write-Host "正在部署 api function..." -ForegroundColor Cyan
supabase functions deploy api --project-ref vxsetefeaquvxbwarmis --no-verify-jwt

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "====================================" -ForegroundColor Green
    Write-Host "✓ 部署成功！" -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Edge Function URL:" -ForegroundColor Cyan
    Write-Host "https://vxsetefeaquvxbwarmis.supabase.co/functions/v1/api" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ 部署失败，请检查错误信息" -ForegroundColor Red
}

Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
