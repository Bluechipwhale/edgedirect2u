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
Compress-Archive -LiteralPath $sourcePaths -DestinationPath $releasePath -CompressionLevel Optimal -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$releaseArchive = [System.IO.Compression.ZipFile]::Open($releasePath, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $envEntry = $releaseArchive.CreateEntry('.env.production')
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
