# Oreheart Blender Worker installer (no admin rights needed).
# Copies the worker into %LOCALAPPDATA%\OreheartBlenderWorker, saves the GitHub key in Windows Credential Manager
# (typed by you, never shown or stored in a file) and checks that Blender, Claude Code and GitHub all work.
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$app = Join-Path $env:LOCALAPPDATA 'OreheartBlenderWorker'
$code = Join-Path $app 'app'
Write-Host ''
Write-Host '=== Oreheart Blender Worker setup ===' -ForegroundColor Cyan

# 1. Find Blender and the Python inside it (we use Blender's own Python; nothing new is installed).
$blender = Get-ChildItem -Path "$env:ProgramFiles\Blender Foundation\*\blender.exe", "${env:ProgramFiles(x86)}\Steam\steamapps\common\Blender\blender.exe" -ErrorAction SilentlyContinue |
  Sort-Object { $_.VersionInfo.FileVersion } | Select-Object -Last 1
if (-not $blender) { Write-Host 'Blender was not found in Program Files. Install Blender first.' -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
$py = Get-ChildItem -Path (Join-Path $blender.DirectoryName '*\python\bin\python.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $py) { Write-Host "Could not find Blender's Python next to $($blender.FullName)." -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
Write-Host "Blender: $($blender.FullName)"
Write-Host "Python:  $($py.FullName)"

# 2. Copy the worker code (your settings and work folders are kept).
New-Item -ItemType Directory -Force -Path $code | Out-Null
foreach ($item in 'worker.py', 'blender_ops', 'prompts', 'schema', 'README.md') {
  $p = Join-Path $src $item
  if (Test-Path $p) { Copy-Item -Path $p -Destination $code -Recurse -Force }
}
Set-Content -Path (Join-Path $app 'python-path.txt') -Value $py.FullName -Encoding ASCII
$cfg = Join-Path $app 'config.json'
if (-not (Test-Path $cfg)) { "{`"blender_exe`": `"$($blender.FullName.Replace('\','\\'))`"}" | Set-Content -Path $cfg -Encoding ASCII }

# 3. Launchers.
foreach ($f in 'Start-Blender-Worker.cmd', 'Stop-Blender-Worker.cmd', 'Pause-Blender-Worker.cmd', 'Resume-Blender-Worker.cmd', 'Cancel-Current-Job.cmd', 'Check-Blender-Worker.cmd') {
  $p = Join-Path $src $f
  if (Test-Path $p) { Copy-Item $p $app -Force }
}

# 4. GitHub key -> Windows Credential Manager (typed here, hidden).
Write-Host ''
Write-Host 'Now paste your GitHub key for the worker (fine-grained token for Lummex/Starter).' -ForegroundColor Yellow
Write-Host 'It will not be shown while you paste. Right-click pastes in this window. Then press Enter.'
& $py.FullName (Join-Path $code 'worker.py') --setup
if ($LASTEXITCODE -ne 0) { Write-Host 'Setup did not finish. See the message above.' -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }

# 5. Start with Windows?
Write-Host ''
$ans = Read-Host 'Start the Blender worker automatically when you log in to Windows? (y/n)'
$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'Oreheart Blender Worker.lnk'
if ($ans -match '^[yY]') {
  $sh = New-Object -ComObject WScript.Shell
  $lnk = $sh.CreateShortcut($startup)
  $lnk.TargetPath = Join-Path $app 'Start-Blender-Worker.cmd'
  $lnk.WorkingDirectory = $app
  $lnk.WindowStyle = 7
  $lnk.Save()
  Write-Host 'Autostart is on. (Delete the shortcut in your Startup folder to turn it off.)'
} elseif (Test-Path $startup) { Remove-Item $startup; Write-Host 'Autostart is off.' }

# 6. Start it now.
Start-Process -FilePath (Join-Path $app 'Start-Blender-Worker.cmd') -WorkingDirectory $app -WindowStyle Minimized
Write-Host ''
Write-Host 'Done. The worker is running in a small minimized window named "Oreheart Blender Worker".' -ForegroundColor Green
Write-Host "Its controls are in: $app"
Read-Host 'Press Enter to close'
