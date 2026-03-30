param(
    [string]$Version
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Add-PathToArchive {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.Compression.ZipArchive]$Archive,
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    $item = Get-Item -LiteralPath $SourcePath

    if ($item.PSIsContainer) {
        $files = Get-ChildItem -LiteralPath $item.FullName -Recurse -File
        foreach ($file in $files) {
            Add-PathToArchive -Archive $Archive -SourcePath $file.FullName -ProjectRoot $ProjectRoot
        }
        return
    }

    $rootPath = [System.IO.Path]::GetFullPath($ProjectRoot)
    if (-not $rootPath.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $rootPath += [System.IO.Path]::DirectorySeparatorChar
    }

    $rootUri = New-Object System.Uri($rootPath)
    $fileUri = New-Object System.Uri($item.FullName)
    $relativePath = $rootUri.MakeRelativeUri($fileUri).ToString()
    $entryName = [System.Uri]::UnescapeDataString($relativePath)
    $entry = $Archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)

    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($item.FullName)

    try {
        $fileStream.CopyTo($entryStream)
    }
    finally {
        $fileStream.Dispose()
        $entryStream.Dispose()
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot "manifest.json"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "manifest.json not found."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if (-not $Version) {
    $Version = $manifest.version
}

$distDir = Join-Path $projectRoot "dist"
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

$packageName = "volumemaster-firefox-$Version.xpi"
$packagePath = Join-Path $distDir $packageName
$zipPath = Join-Path $distDir "volumemaster-firefox-$Version.zip"

if (Test-Path -LiteralPath $packagePath) {
    Remove-Item -LiteralPath $packagePath -Force
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

$packageEntries = @(
    "manifest.json",
    "background.js",
    "content-script.js",
    "popup.html",
    "popup.css",
    "popup.js",
    "icons"
)

$zipArchive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

try {
    foreach ($entryPath in $packageEntries) {
        $fullPath = Join-Path $projectRoot $entryPath
        Add-PathToArchive -Archive $zipArchive -SourcePath $fullPath -ProjectRoot $projectRoot
    }
}
finally {
    $zipArchive.Dispose()
}

Move-Item -LiteralPath $zipPath -Destination $packagePath

Write-Host "Created package: $packagePath"
