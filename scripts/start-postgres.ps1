# Поднять PostgreSQL в Docker и применить миграции Alembic.
# Запуск: cd d:\Near   .\scripts\start-postgres.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker не найден. Установите Docker Desktop или используйте SQLite."
}

Write-Host "Docker: поднимаю PostgreSQL..."
docker compose up -d postgres

Write-Host "Ожидание готовности PostgreSQL..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $status = docker inspect -f "{{.State.Health.Status}}" near-postgres 2>$null
    if ($status -eq "healthy") {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Write-Warning "Healthcheck не ответил вовремя; пробуем миграции всё равно..."
}

$DbUrl = "postgresql+asyncpg://near:near@localhost:5432/near"
Set-Location (Join-Path $Root "backend")

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Создаю виртуальное окружение..."
    py -3 -m venv .venv
}

$Py = Join-Path (Get-Location) ".venv\Scripts\python.exe"
Write-Host "Устанавливаю зависимости..."
& $Py -m pip install -q -r requirements.txt

$env:DATABASE_URL = $DbUrl
Write-Host "Миграции: $DbUrl"
& $Py -m alembic upgrade head

Write-Host ""
Write-Host "PostgreSQL готов."
Write-Host "Добавьте в backend/.env:"
Write-Host "  DATABASE_URL=$DbUrl"
