$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releasePath = Join-Path $projectRoot 'artifacts/hostinger-source.zip'
$sourceNames = @('.env.example', '.gitignore', '.gitattributes', 'AGENTS.md', 'README.md', 'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'eslint.config.mjs', 'playwright.config.ts', 'vitest.config.ts', '.github', 'config', 'src', 'public', 'supabase', 'scripts', 'docs', 'tests')
$publicConfig = Get-Content -LiteralPath (Join-Path $projectRoot 'config/hostinger-public.json') -Raw | ConvertFrom-Json
$allowedNames = @('NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'LOCAL_DEMO')
if (@($publicConfig.PSObject.Properties).Count -ne $allowedNames.Count) { throw 'Release configuration must contain exactly the four public deployment settings' }
foreach ($property in $publicConfig.PSObject.Properties) {
    if ($property.Name -notin $allowedNames -or [string]$property.Value -match '[\r\n$"''#]') { throw 'Unexpected or invalid public deployment setting' }
}
if ($publicConfig.NEXT_PUBLIC_SITE_URL -ne 'https://edgedirect2u.com' -or $publicConfig.NEXT_PUBLIC_SUPABASE_URL -ne 'https://itdpkfnuyxzqswctlsar.supabase.co' -or $publicConfig.LOCAL_DEMO -ne 'false' -or $publicConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY -notmatch '^sb_publishable_[A-Za-z0-9_-]+$') { throw 'Release must use the approved domain, connected project and publishable key, with demo disabled' }
$publicEnvText = ($allowedNames | ForEach-Object { "$_=$($publicConfig.$_)" }) -join "`n"
$publicEnvText += "`n"
$sourcePaths = $sourceNames | ForEach-Object { Join-Path $projectRoot $_ }
New-Item -ItemType Directory -Path (Split-Path -Parent $releasePath) -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $releasePath) { Remove-Item -LiteralPath $releasePath }
$releaseArchive = [System.IO.Compression.ZipFile]::Open($releasePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($sourcePath in $sourcePaths) {
        $sourceItem = Get-Item -LiteralPath $sourcePath -Force
        $items = @($sourceItem)
        if ($sourceItem.PSIsContainer) { $items += @(Get-ChildItem -LiteralPath $sourcePath -Recurse -Force) }
        foreach ($item in $items) {
            $entryName = $item.FullName.Substring($projectRoot.Length).TrimStart('\', '/').Replace('\', '/')
            if ($item.PSIsContainer) {
                $entry = $releaseArchive.CreateEntry("$entryName/")
                $entry.ExternalAttributes = [Convert]::ToInt32('41ed0010', 16) # directory, 0755
            } else {
                $entry = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($releaseArchive, $item.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal)
                $entry.ExternalAttributes = [Convert]::ToInt32('81a40000', 16) # regular file, 0644
            }
        }
    }
    $envEntry = $releaseArchive.CreateEntry('.env.production')
    $envEntry.ExternalAttributes = [Convert]::ToInt32('81a40000', 16)
    $envWriter = [System.IO.StreamWriter]::new($envEntry.Open(), [System.Text.UTF8Encoding]::new($false))
    try { $envWriter.Write($publicEnvText) } finally { $envWriter.Dispose() }
} finally { $releaseArchive.Dispose() }
$privateValues = @()
$localEnvPath = Join-Path $projectRoot '.env.local'
if (Test-Path -LiteralPath $localEnvPath) {
    foreach ($line in Get-Content -LiteralPath $localEnvPath) {
        if ($line -match '^(DATABASE_URL|CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY|PAYSTACK_SECRET_KEY)=(.+)$') {
            $privateValue = $Matches[2].Trim('"').Trim("'")
            if ($privateValue.Length -ge 12) { $privateValues += $privateValue }
            if ($Matches[1] -eq 'DATABASE_URL') {
                $privateUserInfo = ([uri]$privateValue).UserInfo
                if ($privateUserInfo.Contains(':')) { $privateValues += [uri]::UnescapeDataString($privateUserInfo.Split(':', 2)[1]) }
            }
        }
    }
}
$archive = [System.IO.Compression.ZipFile]::OpenRead($releasePath)
try {
    foreach ($entry in $archive.Entries) {
        if ($entry.FullName.Contains('\')) { throw 'Archive paths must use portable forward slashes' }
        $expectedAttributes = if ($entry.FullName.EndsWith('/')) { [Convert]::ToInt32('41ed0010', 16) } else { [Convert]::ToInt32('81a40000', 16) }
        if ($entry.ExternalAttributes -ne $expectedAttributes) { throw "Unsafe archive permissions: $($entry.FullName)" }
        $entryPath = $entry.FullName.Replace('\', '/')
        if ($entryPath -match '(^|/)(node_modules|\.data|\.git|\.next|\.next-e2e|artifacts|test-results)/' -or ($entryPath -match '(^|/)\.env' -and $entryPath -notin @('.env.example', '.env.production'))) {
            throw "Unexpected private or generated file in release: $entryPath"
        }
        $reader = [System.IO.StreamReader]::new($entry.Open())
        try { $entryText = $reader.ReadToEnd() } finally { $reader.Dispose() }
        if ($entryPath -eq '.env.production' -and $entryText -cne $publicEnvText) { throw 'Production environment must contain only the validated public settings' }
        foreach ($privateValue in $privateValues) {
            if ($entryText.Contains($privateValue)) { throw "Private value found in release file: $entryPath" }
        }
    }
    if (-not ($archive.Entries | Where-Object { $_.FullName -eq 'package.json' })) { throw 'Package metadata missing from archive root' }
    Write-Output "Verified source release: $($archive.Entries.Count) files. Supabase public settings are included; server secrets and generated output are excluded."
} finally { $archive.Dispose() }
$releaseHash = (Get-FileHash -LiteralPath $releasePath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $projectRoot 'artifacts/hostinger-source.sha256') -Value "$releaseHash  hostinger-source.zip"
Write-Output $releasePath
