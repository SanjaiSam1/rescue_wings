$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $root 'resources\mongodb\win32-x64'
$tempDir = Join-Path $env:TEMP ('rw-mongodb-' + [Guid]::NewGuid().ToString('N'))
$archivePath = Join-Path $tempDir 'mongodb.zip'

$urls = @(
  'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.15.zip',
  'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-6.0.18.zip'
)

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$downloaded = $false
foreach ($url in $urls) {
  try {
    Write-Host "Downloading $url"
    Invoke-WebRequest -Uri $url -OutFile $archivePath
    $downloaded = $true
    break
  }
  catch {
    Write-Warning "Failed: $url"
  }
}

if (-not $downloaded) {
  throw 'Could not download MongoDB portable archive.'
}

Expand-Archive -Path $archivePath -DestinationPath $tempDir -Force

$mongod = Get-ChildItem -Path $tempDir -Filter 'mongod.exe' -Recurse | Select-Object -First 1
if (-not $mongod) {
  throw 'mongod.exe was not found inside the downloaded archive.'
}

Copy-Item -Force $mongod.FullName (Join-Path $targetDir 'mongod.exe')
Write-Host "Embedded mongod saved to $(Join-Path $targetDir 'mongod.exe')"

Remove-Item -Recurse -Force $tempDir
