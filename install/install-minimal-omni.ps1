[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$DshRoot,
  [Parameter(Mandatory)] [string]$DshHome
)
$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dshRoot = (Resolve-Path $DshRoot).Path
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
if (-not (Test-Path (Join-Path $dshRoot 'package.json'))) { throw 'DshRoot must be an installed official checkout.' }
New-Item -ItemType Directory -Force -Path (Join-Path $resolvedDshHome 'profiles\minimal-omni') | Out-Null
Copy-Item (Join-Path $packageRoot 'profile\*') (Join-Path $resolvedDshHome 'profiles\minimal-omni') -Recurse -Force
$pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
$env:DSH_HOME = $resolvedDshHome
$env:DSH_ISOLATION_GUARD_REQUIRED = '1'
$env:DSH_ISOLATION_SENTINEL = [string]$guard.sentinelPath
$env:DSH_ISOLATION_NONCE = [string]$guard.nonce
foreach ($packageName in @('capability-broker', 'provider-request-governor')) {
  & $pnpm --dir $dshRoot dsh plugin --profile minimal-omni add --save-exact (Join-Path $packageRoot "plugins\$packageName")
  if ($LASTEXITCODE -ne 0) { throw "Minimal Omni plugin installation failed ($packageName): $LASTEXITCODE" }
}
Write-Host "Minimal Omni installed into the explicit isolated DSH_HOME: $resolvedDshHome"
