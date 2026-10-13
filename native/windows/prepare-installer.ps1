$ErrorActionPreference = 'Stop'
$publishRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'publish')).Path
$files = @(Get-ChildItem -LiteralPath $publishRoot -File -Recurse | Sort-Object FullName)
if ($files.Count -eq 0) { throw 'No published application files found' }
$install = [System.Collections.Generic.List[string]]::new()
$uninstall = [System.Collections.Generic.List[string]]::new()
$directories = [System.Collections.Generic.HashSet[string]]::new()
foreach ($file in $files) {
    $relative = [System.IO.Path]::GetRelativePath($publishRoot, $file.FullName)
    if ($relative.StartsWith('..') -or $relative.Contains('$') -or $relative.Contains('"')) { throw 'Invalid installer file path' }
    $directory = [System.IO.Path]::GetDirectoryName($relative)
    $install.Add('SetOutPath "$INSTDIR' + $(if ($directory) { '\' + $directory } else { '' }) + '"')
    $install.Add('File "publish\' + $relative + '"')
    $uninstall.Add('Delete "$INSTDIR\' + $relative + '"')
    while ($directory) {
        [void]$directories.Add($directory)
        $directory = [System.IO.Path]::GetDirectoryName($directory)
    }
}
foreach ($directory in ($directories | Sort-Object Length -Descending)) { $uninstall.Add('RMDir "$INSTDIR\' + $directory + '"') }
[System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot 'install-files.nsh'), $install)
[System.IO.File]::WriteAllLines((Join-Path $PSScriptRoot 'uninstall-files.nsh'), $uninstall)
