# Oreheart Blender Worker installer (no admin rights needed).
# Copies the worker into %LOCALAPPDATA%\OreheartBlenderWorker, saves the GitHub key in Windows Credential Manager
# (typed by you, never shown or stored in a file) and checks that Blender, Claude Code and GitHub all work.
# The worker runs on the Python inside Blender, so nothing new is installed.
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$app = Join-Path $env:LOCALAPPDATA 'OreheartBlenderWorker'
$code = Join-Path $app 'app'
function Fail($msg) { Write-Host $msg -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
Write-Host ''
Write-Host '=== Oreheart Blender Worker setup ===' -ForegroundColor Cyan

# 1. Find a Blender that can run scripts in the background (classic install, Steam, or Microsoft Store).
$candidates = @()
$candidates += Get-ChildItem -Path "$env:ProgramFiles\Blender Foundation\*\blender.exe" -ErrorAction SilentlyContinue | Sort-Object { $_.VersionInfo.FileVersion } -Descending | ForEach-Object { $_.FullName }
$candidates += "${env:ProgramFiles(x86)}\Steam\steamapps\common\Blender\blender.exe"
$candidates += Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\blender.exe'
$pkg = Get-AppxPackage -Name 'BlenderFoundation.Blender*' -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1
if ($pkg) { $candidates += Join-Path $pkg.InstallLocation 'blender.exe' }
$blender = $null
foreach ($c in $candidates) {
  if (-not $c -or -not (Test-Path -LiteralPath $c)) { continue }
  Write-Host "Trying Blender: $c"
  try {
    $out = & $c --background --factory-startup --python-expr "import sys; print('OREHEART_OK', sys.version.split()[0])" 2>&1 | Out-String
  } catch { $out = "$_" }
  if ($out -match 'OREHEART_OK') { $blender = $c; Write-Host '  works.' -ForegroundColor Green; break }
  Write-Host '  could not run scripts from here, trying the next one.'
}
if (-not $blender) { Fail 'No Blender that can run in the background was found. Tell Claude what this window says.' }

# 2. Copy the worker code (your settings and work folders are kept).
New-Item -ItemType Directory -Force -Path $code | Out-Null
foreach ($item in 'worker.py', 'blender_ops', 'prompts', 'schema', 'README.md') {
  $p = Join-Path $src $item
  if (Test-Path $p) { Copy-Item -Path $p -Destination $code -Recurse -Force }
}
Set-Content -Path (Join-Path $app 'blender-path.txt') -Value $blender -Encoding ASCII
foreach ($f in 'Start-Blender-Worker.cmd', 'Stop-Blender-Worker.cmd', 'Pause-Blender-Worker.cmd', 'Resume-Blender-Worker.cmd', 'Cancel-Current-Job.cmd', 'Check-Blender-Worker.cmd') {
  $p = Join-Path $src $f
  if (Test-Path $p) { Copy-Item $p $app -Force }
}

# 3. GitHub key -> Windows Credential Manager (typed here, hidden, never written to a file).
Add-Type -Namespace Oreheart -Name Cred -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct CREDENTIAL { public int Flags; public int Type; public string TargetName; public string Comment;
  public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob;
  public int Persist; public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName; }
[DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
public static extern bool CredWrite(ref CREDENTIAL c, int flags);
public static bool Save(string target, string secret) {
  byte[] b = System.Text.Encoding.Unicode.GetBytes(secret);
  CREDENTIAL c = new CREDENTIAL(); c.Type = 1; c.TargetName = target; c.UserName = "github"; c.Persist = 2;
  c.CredentialBlobSize = b.Length; c.CredentialBlob = Marshal.AllocHGlobal(b.Length);
  try { Marshal.Copy(b, 0, c.CredentialBlob, b.Length); return CredWrite(ref c, 0); } finally { Marshal.FreeHGlobal(c.CredentialBlob); }
}
'@
Write-Host ''
Write-Host 'Paste your GitHub key for the worker (the Oreheart Blender Worker token).' -ForegroundColor Yellow
Write-Host 'Nothing shows while you paste. Right-click pastes in this window. Then press Enter.'
$sec = Read-Host -AsSecureString 'Key'
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
if (-not $plain.Trim()) { Fail 'No key was entered.' }
if (-not [Oreheart.Cred]::Save('OreheartBlenderWorker:github', $plain.Trim())) { Fail 'Could not save the key in Windows Credential Manager.' }
$plain = $null
Write-Host 'Key saved in Windows Credential Manager.' -ForegroundColor Green

# 4. Check everything (Blender, Claude Code, Blender MCP port, GitHub).
Write-Host ''
Write-Host 'Checking Blender, Claude Code and GitHub (this takes up to a minute)...'
$checkFile = Join-Path $app 'last-check.json'
if (Test-Path $checkFile) { Remove-Item $checkFile }
& $blender --background --factory-startup --python-exit-code 1 --python (Join-Path $code 'worker.py') -- --check 2>&1 | Out-Null
if (Test-Path $checkFile) {
  $chk = Get-Content $checkFile -Raw | ConvertFrom-Json
  Write-Host ("  Blender:        " + $chk.blender_version)
  Write-Host ("  Claude Code:    " + $chk.claude_version + "  (headless test: " + $chk.claude_headless + ")")
  Write-Host ("  Blender MCP:    " + $chk.blender_mcp_port_9876)
  Write-Host ("  GitHub:         " + $chk.github)
  if ($chk.github -ne 'ok') { Fail 'GitHub did not accept the key. Check the key has Contents: Read and write for Lummex/Starter, then run this again.' }
} else { Fail ('The check did not finish. The log is in ' + (Join-Path $app 'worker.log')) }

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
  Write-Host 'Autostart is on.'
} elseif (Test-Path $startup) { Remove-Item $startup; Write-Host 'Autostart is off.' }

# 6. Start it now.
Start-Process -FilePath (Join-Path $app 'Start-Blender-Worker.cmd') -WorkingDirectory $app -WindowStyle Minimized
Write-Host ''
Write-Host 'Done. The worker is running in a minimized window named "Oreheart Blender Worker".' -ForegroundColor Green
Write-Host "Its controls are in: $app"
Read-Host 'Press Enter to close'
