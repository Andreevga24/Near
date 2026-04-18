# Запуск Near API (опционально Redis в Docker + uvicorn; БД — SQLite по умолчанию).
# Запускать из PowerShell:  cd d:\Near   .\scripts\start-backend.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Docker: поднимаю redis..."
    docker compose up -d
} else {
    Write-Warning "Команда docker не найдена. Redis не обязателен для API; при необходимости поднимите сами."
}

Set-Location (Join-Path $Root "backend")

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Создаю виртуальное окружение..."
    py -3.13 -m venv .venv
    if ($LASTEXITCODE -ne 0) { py -3.12 -m venv .venv }
    if ($LASTEXITCODE -ne 0) { py -3 -m venv .venv }
}

$Py = Join-Path (Get-Location) ".venv\Scripts\python.exe"
Write-Host "Устанавливаю зависимости (pip)..."
& $Py -m pip install -r requirements.txt --upgrade pip

Write-Host "Миграции Alembic..."
& $Py -m alembic upgrade head

Write-Host "Старт uvicorn на http://0.0.0.0:8000 ..."
& $Py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
