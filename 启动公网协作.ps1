$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
if (-not (Test-Path -LiteralPath $cloudflared)) {
    Write-Host '未找到 cloudflared，请先安装 Cloudflare Tunnel。' -ForegroundColor Red
    exit 1
}

if (-not (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath 'C:\Windows\System32\cmd.exe' -ArgumentList '/c','npm run dev' -WorkingDirectory $projectDir -WindowStyle Hidden
    Start-Sleep -Seconds 4
}

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
$outLog = Join-Path $projectDir 'data\cloudflared.out.log'
$errLog = Join-Path $projectDir 'data\cloudflared.err.log'
Remove-Item -LiteralPath $outLog,$errLog -Force -ErrorAction SilentlyContinue
Start-Process -FilePath $cloudflared -ArgumentList 'tunnel','--url','http://127.0.0.1:5173','--no-autoupdate' -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog

$publicUrl = $null
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    $logText = (Get-Content -LiteralPath $outLog,$errLog -Raw -ErrorAction SilentlyContinue) -join "`n"
    $match = [regex]::Match($logText, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($match.Success) { $publicUrl = $match.Value; break }
}

if (-not $publicUrl) {
    Write-Host '未能生成公网地址，请检查 data\cloudflared.err.log。' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '公网协作地址：' -ForegroundColor Cyan
Write-Host $publicUrl -ForegroundColor Green
Write-Host ''
Write-Host '当前未设置密码。任何获得链接的人都可以修改和删除数据。' -ForegroundColor Yellow
Write-Host '关闭电脑、排课服务或 cloudflared 进程后，地址会失效。' -ForegroundColor Yellow
Start-Process $publicUrl
