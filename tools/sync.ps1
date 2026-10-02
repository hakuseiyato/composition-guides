# Composition Guides — CEP 同期
#
# build を実行し、cep/ を CEP extensions の実フォルダへコピー同期する。
# （CEP は Junction を辿らないため、Junction ではなく実体コピーで運用する）
#
# 使い方: pwsh -File tools\sync.ps1              （Illustrator 版）
#         pwsh -File tools\sync.ps1 -Target ppro  （Premiere Pro 版。cep_ppro/ を同期）
# 反映には Illustrator / Premiere Pro の再起動（または拡張の再読込）が必要。

param([ValidateSet("il", "ppro")][string]$Target = "il")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$psExe = (Get-Process -Id $PID).Path         # いま動いている PowerShell（5.1 / 7 のどちらでも）
if ($Target -eq "ppro") {
    $src = Join-Path $root "cep_ppro"
    $bundleId = "com.yato.compositionguides.ppro"
    $appName = "Premiere Pro"
} else {
    $src = Join-Path $root "cep"
    $bundleId = "com.yato.compositionguides"
    $appName = "Illustrator"
}
$ext = Join-Path $env:APPDATA "Adobe\CEP\extensions\$bundleId"

# エンジンを最新化
& $psExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "build.ps1")
if ($LASTEXITCODE -ne 0) { throw "build 失敗 (exit $LASTEXITCODE)" }

if (-not (Test-Path $ext)) { New-Item -ItemType Directory -Path $ext -Force | Out-Null }

# robocopy でミラー（/MIR）。除外なし。終了コード 0-7 は正常
robocopy $src $ext /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 失敗 (exit $LASTEXITCODE)" }
Write-Host "同期完了: $src -> $ext"
Write-Host "$appName を再起動して反映してください。"
