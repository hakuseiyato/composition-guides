# Composition Guides — CEP 同期
#
# build を実行し、cep/ を CEP extensions の実フォルダへコピー同期する。
# （CEP は Junction を辿らないため、Junction ではなく実体コピーで運用する）
#
# 使い方: pwsh -File tools\sync.ps1
# 反映には Illustrator の再起動（または拡張の再読込）が必要。

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "cep"
$bundleId = "com.yato.compositionguides"
$ext = Join-Path $env:APPDATA "Adobe\CEP\extensions\$bundleId"

# engine.jsx を最新化
pwsh -File (Join-Path $root "build.ps1")

if (-not (Test-Path $ext)) { New-Item -ItemType Directory -Path $ext -Force | Out-Null }

# robocopy でミラー（/MIR）。除外なし。終了コード 0-7 は正常
robocopy $src $ext /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 失敗 (exit $LASTEXITCODE)" }
Write-Host "同期完了: $src -> $ext"
Write-Host "Illustrator を再起動して反映してください。"
