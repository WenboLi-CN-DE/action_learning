param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [string]$BackendHost = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$ApiTarget = "http://${BackendHost}:${BackendPort}"

function Test-Command($Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "未找到命令：$Name。请先安装后再运行本脚本。"
    }
}

Test-Command "uv"
Test-Command "npm"

Write-Host "同步后端依赖..."
Push-Location $BackendDir
uv sync
Pop-Location

Write-Host "安装前端依赖..."
Push-Location $FrontendDir
if (Test-Path "package-lock.json") {
    npm install
} else {
    npm install
}
Pop-Location

Write-Host "启动后端: $ApiTarget"
$BackendJob = Start-Job -Name "action-learning-backend" -ScriptBlock {
    param($BackendDir, $BackendHost, $BackendPort)
    Set-Location $BackendDir
    uv run uvicorn app.main:app --reload --host $BackendHost --port $BackendPort
} -ArgumentList $BackendDir, $BackendHost, $BackendPort

Write-Host "启动前端: http://127.0.0.1:$FrontendPort"
$FrontendJob = Start-Job -Name "action-learning-frontend" -ScriptBlock {
    param($FrontendDir, $FrontendPort, $ApiTarget)
    Set-Location $FrontendDir
    $env:VITE_API_TARGET = $ApiTarget
    npm run dev -- --host 127.0.0.1 --port $FrontendPort
} -ArgumentList $FrontendDir, $FrontendPort, $ApiTarget

Write-Host ""
Write-Host "AI工坊平台开发环境已启动"
Write-Host "前端: http://127.0.0.1:$FrontendPort"
Write-Host "后端: $ApiTarget/docs"
Write-Host ""
Write-Host "按 Ctrl+C 停止；如需查看日志，运行：Receive-Job -Name action-learning-backend -Keep"

try {
    while ($true) {
        Receive-Job -Job $BackendJob, $FrontendJob
        Start-Sleep -Seconds 2
    }
}
finally {
    Write-Host "停止开发服务..."
    Stop-Job -Job $BackendJob, $FrontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $BackendJob, $FrontendJob -Force -ErrorAction SilentlyContinue
}
