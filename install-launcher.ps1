# solo.plus — встановлення ярлика на робочий стіл
# Запустіть один раз: правою кнопкою → "Запустити з PowerShell"

$ErrorActionPreference = "Stop"

$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Exe = Join-Path $Dir "soloplus-win_x64.exe"

if (-not (Test-Path $Exe)) {
    Write-Host "Помилка: файл не знайдено — $Exe" -ForegroundColor Red
    Write-Host "Запустіть install-launcher.ps1 з папки, куди розпакований архів." -ForegroundColor Yellow
    pause
    exit 1
}

$Desktop  = [Environment]::GetFolderPath("Desktop")
$LinkPath = Join-Path $Desktop "solo.plus.lnk"

$Shell    = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($LinkPath)
$Shortcut.TargetPath       = $Exe
$Shortcut.WorkingDirectory = $Dir
$Shortcut.Description      = "solo.plus — проєктування електрощитків (ЕРЩ)"

$IconPath = Join-Path $Dir "icon.ico"
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = $IconPath
}

$Shortcut.Save()

Write-Host "Готово! Ярлик 'solo.plus' створено на робочому столі." -ForegroundColor Green
Write-Host "Запустіть програму: $Exe" -ForegroundColor Cyan
pause
