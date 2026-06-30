# Сборка и запуск production-стека Near (Docker Compose).
# Запуск: cd d:\Near   .\scripts\deploy-prod.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker не найден. Установите Docker Desktop."
}

$EnvFile = Join-Path $Root ".env.prod"
if (-not (Test-Path $EnvFile)) {
    Copy-Item (Join-Path $Root ".env.prod.example") $EnvFile
    Write-Warning "Создан .env.prod из примера. Отредактируйте секреты и запустите снова."
    exit 1
}

$jwt = Select-String -Path $EnvFile -Pattern '^JWT_SECRET=CHANGE_ME' -Quiet
$db = Select-String -Path $EnvFile -Pattern '^POSTGRES_PASSWORD=CHANGE_ME' -Quiet
if ($jwt -or $db) {
    Write-Warning "В .env.prod остались значения CHANGE_ME. Замените JWT_SECRET и POSTGRES_PASSWORD."
    exit 1
}

Write-Host "Сборка и запуск production-стека..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

Write-Host ""
Write-Host "Готово. Проверка: http://localhost (порт из HTTP_PORT в .env.prod)"
Write-Host "Документация: docs/DEPLOYMENT_RU.md"
