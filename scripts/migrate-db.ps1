# Перенос SQLite → PostgreSQL
# Запуск: cd d:\Near   .\scripts\migrate-db.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$SqlitePath = Join-Path $Backend "near.db"
$PgUrl = "postgresql+asyncpg://near:near@localhost:5432/near"

Set-Location $Root

if (-not (Test-Path $SqlitePath)) {
    Write-Error "Не найден $SqlitePath. Сначала работайте с SQLite (alembic upgrade head, регистрация пользователей)."
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Docker: проверяю PostgreSQL..."
    $running = docker ps --filter "name=near-postgres" --format "{{.Names}}" 2>$null
    if (-not $running) {
        Write-Host "Поднимаю postgres..."
        docker compose up -d postgres
        Start-Sleep -Seconds 3
    }
} else {
    Write-Warning "Docker не найден. PostgreSQL должен быть доступен по $PgUrl"
}

Set-Location $Backend

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    py -3 -m venv .venv
}

$Py = Join-Path $Backend ".venv\Scripts\python.exe"
& $Py -m pip install -q -r requirements.txt

Write-Host ""
Write-Host "=== Dry-run (подсчёт строк) ==="
& $Py -m scripts.migrate_sqlite_to_postgres --source $SqlitePath --target $PgUrl --dry-run

Write-Host ""
$confirm = Read-Host "Выполнить перенос в PostgreSQL? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Отменено."
    exit 0
}

& $Py -m scripts.migrate_sqlite_to_postgres --source $SqlitePath --target $PgUrl --truncate-target

Write-Host ""
Write-Host "Обновите backend/.env:"
Write-Host "  DATABASE_URL=$PgUrl"
