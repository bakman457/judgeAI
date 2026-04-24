$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$dbBin = Join-Path $root "mariadb-10.11.10-winx64\bin\mariadbd.exe"
$dbData = Join-Path $root "mariadb-data"
$appUrl = "http://localhost:3000/"
$logDir = Join-Path $root "logs"
$launcherLog = Join-Path $logDir "launcher.log"

function Write-LauncherLog([string] $message) {
  try {
    if (-not (Test-Path -LiteralPath $logDir -PathType Container)) {
      New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $launcherLog -Value "[$timestamp] $message"
  } catch {
    # Do not let logging problems block the launcher itself.
  }
}

trap {
  $message = $_.Exception.Message
  Write-LauncherLog "ERROR: $message"
  Write-Host ""
  Write-Host "ERROR: $message"
  Write-Host "Details were written to $launcherLog"
  exit 1
}

function Test-Port([int] $port) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync("127.0.0.1", $port)
    return $task.Wait(500) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Wait-Port([int] $port, [int] $seconds, [string] $name) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port $port) {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw "$name did not open port $port within $seconds seconds."
}

function Wait-Web([string] $url, [int] $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 750
    }
  }
  throw "Judge AI did not respond at $url within $seconds seconds."
}

Write-Host "Starting Judge AI..."
Write-Host "Project: $root"
Write-LauncherLog "=== Launcher started ==="
Write-LauncherLog "Project: $root"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found on PATH."
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm was not found on PATH."
}

if (-not (Test-Path -LiteralPath $dbBin -PathType Leaf)) {
  throw "MariaDB server was not found: $dbBin"
}

if (-not (Test-Path -LiteralPath $dbData -PathType Container)) {
  throw "MariaDB data directory was not found: $dbData"
}

if (Test-Port 3306) {
  Write-Host "MariaDB is already listening on port 3306."
  Write-LauncherLog "MariaDB already listening on port 3306."
} else {
  Write-Host "Starting local MariaDB..."
  Write-LauncherLog "Starting local MariaDB from $dbBin"
  $dbArgs = """--datadir=$dbData"" --port=3306 --bind-address=127.0.0.1 --console"
  Start-Process -FilePath $dbBin -ArgumentList $dbArgs -WorkingDirectory $root -WindowStyle Normal
  Wait-Port -port 3306 -seconds 45 -name "MariaDB"
  Write-LauncherLog "MariaDB is listening on port 3306."
}

if (Test-Port 3000) {
  Write-Host "Judge AI web server is already listening on port 3000."
  Write-LauncherLog "Judge AI web server already listening on port 3000."
} else {
  Write-Host "Starting Judge AI web server..."
  Write-LauncherLog "Starting Judge AI web server with pnpm start."
  $serverCommand = "cd /d ""$root"" && pnpm start"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $serverCommand -WorkingDirectory $root -WindowStyle Normal
  Wait-Web -url $appUrl -seconds 45
  Write-LauncherLog "Judge AI web server responded at $appUrl"
}

Write-Host "Opening $appUrl"
Start-Process $appUrl

Write-Host ""
Write-Host "Judge AI is running."
Write-Host "Keep the MariaDB and Web Server windows open while using the app."
Write-LauncherLog "Launcher completed successfully."
