# Composition Guides — 配布 ZIP の作成
#
# 1) build.ps1 を実行する
# 2) node があれば tools/ppro-smoke.js を実行する（失敗したら中断）
# 3) CHANGELOG の最新見出し ## [x.y.z] と、cep / cep_ppro の manifest のバージョンが一致するか確かめる
# 4) release/composition-guides-v<ver>/ に配布物を集める（.debug と src/ は入れない）
# 5) release/composition-guides-v<ver>.zip を作る
#
# 使い方: pwsh -NoProfile -File tools\package.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot     # リポジトリルート
$psExe = (Get-Process -Id $PID).Path         # いま動いている PowerShell（5.1 / 7 のどちらでも）

# CHANGELOG と manifest のバージョンが一致すれば、そのバージョンを返す。一致しなければ中断する
function Get-ReleaseVersion([string]$repoRoot) {
    $changelog = Join-Path $repoRoot "CHANGELOG.md"
    $heading = Select-String -Path $changelog -Pattern '^## \[(\d+\.\d+\.\d+)\]' -Encoding UTF8 | Select-Object -First 1
    if (-not $heading) { throw "CHANGELOG.md に ## [x.y.z] 形式の見出しがありません" }
    $version = $heading.Matches[0].Groups[1].Value

    $mismatches = @()
    foreach ($dir in @("cep", "cep_ppro")) {
        $manifestPath = Join-Path $repoRoot "$dir\CSXS\manifest.xml"
        [xml]$manifest = Get-Content -Path $manifestPath -Raw -Encoding UTF8
        $bundleVersion = $manifest.ExtensionManifest.ExtensionBundleVersion
        if ($bundleVersion -ne $version) { $mismatches += "$dir ExtensionBundleVersion=$bundleVersion" }
        foreach ($ext in @($manifest.ExtensionManifest.ExtensionList.Extension)) {
            if ($ext.Version -ne $version) { $mismatches += "$dir Extension($($ext.Id)) Version=$($ext.Version)" }
        }
    }
    if ($mismatches.Count -gt 0) {
        throw "バージョンが一致しません（CHANGELOG の最新は $version）: $($mismatches -join ' / ')"
    }
    return $version
}

# 1) ビルド
& $psExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "build.ps1")
if ($LASTEXITCODE -ne 0) { throw "build 失敗 (exit $LASTEXITCODE)" }

# 2) スモークテスト（node があるときだけ）
if (Get-Command node -ErrorAction SilentlyContinue) {
    node (Join-Path $root "tools\ppro-smoke.js")
    if ($LASTEXITCODE -ne 0) { throw "ppro-smoke.js が失敗しました (exit $LASTEXITCODE)" }
} else {
    Write-Warning "node が見つからないため、ppro-smoke.js を飛ばします"
}

# 3) バージョンの一致を確認
$version = Get-ReleaseVersion $root
Write-Host "バージョン: $version"

# 4) 配布物を集める
$releaseDir = Join-Path $root "release"
$name = "composition-guides-v$version"
$stage = Join-Path $releaseDir $name
$zip = Join-Path $releaseDir "$name.zip"
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$files = @(
    "install.cmd", "install.ps1",
    "tools\dev-install.ps1", "tools\ae-install.ps1", "tools\PlayerDebugMode.reg",
    "README.md", "INSTALL.md", "CHANGELOG.md"
)
foreach ($f in $files) {
    $from = Join-Path $root $f
    if (-not (Test-Path $from)) { throw "配布物が見つかりません: $from" }
    $to = Join-Path $stage $f
    $toDir = Split-Path -Parent $to
    if (-not (Test-Path $toDir)) { New-Item -ItemType Directory -Path $toDir -Force | Out-Null }
    Copy-Item -LiteralPath $from -Destination $to -Force
}
# フォルダごと集める。.debug はリモートデバッグ用で配布には不要なので除く
foreach ($d in @("cep", "cep_ppro", "dist", "unity")) {
    $from = Join-Path $root $d
    if (-not (Test-Path $from)) { throw "配布物が見つかりません: $from" }
    robocopy $from (Join-Path $stage $d) /E /XF .debug /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy 失敗 (exit $LASTEXITCODE): $d" }
}

# 5) ZIP にする（展開するとフォルダ composition-guides-v<ver> ができる）
Compress-Archive -Path $stage -DestinationPath $zip
Write-Host "作成: $zip"
