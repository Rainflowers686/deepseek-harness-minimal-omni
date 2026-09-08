[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$DshRoot,
  [Parameter(Mandatory)] [string]$DshHome,
  [Parameter(Mandatory)] [string]$Workspace,
  [int]$Port = 3080
)
$ErrorActionPreference = 'Stop'
$dshRoot = (Resolve-Path $DshRoot).Path
$workspace = (Resolve-Path $Workspace).Path
$packageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node.exe -ErrorAction Stop).Source
$guardScript = Join-Path $packageRoot 'src\isolation-guard.mjs'
$resolvedDshHome = [IO.Path]::GetFullPath($DshHome)
$projectRoot = (Resolve-Path (Join-Path $packageRoot '..\..\..')).Path
$allowedRoot = [IO.Path]::GetFullPath((Split-Path -Parent $resolvedDshHome))
$guardArgs = @('--dsh-home', $resolvedDshHome, '--project-root', $projectRoot, '--default-home', (Join-Path $env:USERPROFILE '.dsh'), '--allowed-root', $allowedRoot, '--write-sentinel')
$guardJson = & $node $guardScript @guardArgs
if ($LASTEXITCODE -ne 0) { throw 'DSH_HOME_ISOLATION_VIOLATION: DSH_HOME failed isolation validation.' }
$guard = ($guardJson -join [Environment]::NewLine) | ConvertFrom-Json
$resolvedDshHome = [string]$guard.canonicalHome
if ((Resolve-Path $workspace).Path -eq (Resolve-Path $resolvedDshHome -ErrorAction SilentlyContinue).Path) { throw 'Workspace and DSH_HOME must be separate.' }
$env:DSH_HOME = $resolvedDshHome
$env:DSH_CWD = $workspace
$env:DSH_PERMISSION_MODE = 'workspace-write'
$env:DSH_ISOLATION_GUARD_REQUIRED = '1'
$env:DSH_ISOLATION_SENTINEL = [string]$guard.sentinelPath
$env:DSH_ISOLATION_NONCE = [string]$guard.nonce
$env:DSH_PWSH_COMMAND = (Get-Command pwsh.exe -ErrorAction Stop).Source
& (Get-Command pnpm.cmd -ErrorAction Stop).Source --dir $dshRoot dsh --profile minimal-omni --host 127.0.0.1 --port $Port --no-open
