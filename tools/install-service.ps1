param(
  [string]$ExePath = "$PSScriptRoot\\..\\dist\\Qubit QMS Kiosk.exe",
  [string]$TaskName = "QubitKiosk",
  [string]$User = "$env:USERNAME"
)

Write-Host "Installing scheduled task to run kiosk EXE: $ExePath"

if (-not (Test-Path $ExePath)) {
  Write-Error "Executable not found at $ExePath"
  exit 1
}

$Action = "`"$ExePath`""

schtasks /Create /SC ONLOGON /RL HIGHEST /TN $TaskName /TR $Action /F | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to create scheduled task"
  exit 2
}

Write-Host "Task '$TaskName' created. It will run at user logon. To start now:" 
Write-Host "  schtasks /Run /TN $TaskName"
