# Composition Guides — CEP 開発インストール
#
# 1) PlayerDebugMode を有効化（署名なし拡張の許可）
# 2) cep フォルダを CEP extensions へ実体コピー（同期は tools\sync.ps1）
#
# 注: CEP は extensions 配下の Junction/シンボリックリンクを辿らないため、
#     Junction ではなく実フォルダのコピーで運用する。編集後は sync.ps1 で再同期。
#
# 使い方: pwsh -File tools\dev-install.ps1              （Illustrator 版）
#         pwsh -File tools\dev-install.ps1 -Target ppro  （Premiere Pro 版）
# 反映には Illustrator / Premiere Pro の再起動が必要。

param([ValidateSet("il", "ppro")][string]$Target = "il")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot     # リポジトリルート
$psExe = (Get-Process -Id $PID).Path         # いま動いている PowerShell（5.1 / 7 のどちらでも）
if ($Target -eq "ppro") {
    $cepSrc = Join-Path $root "cep_ppro"
    $bundleId = "com.yato.compositionguides.ppro"
    $appName = "Premiere Pro"
    $engine = Join-Path $cepSrc "js\engine.js"
} else {
    $cepSrc = Join-Path $root "cep"
    $bundleId = "com.yato.compositionguides"
    $appName = "Illustrator"
    $engine = Join-Path $cepSrc "jsx\engine.jsx"
}

if (-not (Test-Path $cepSrc)) { throw "$Target 用の CEP フォルダが見つかりません: $cepSrc" }

# 先にエンジンをビルド（無ければ生成。ppro は他の生成物も同時にできる）
if (-not (Test-Path $engine)) {
    Write-Host "$(Split-Path -Leaf $engine) 未生成のため build を実行します"
    & $psExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "build.ps1")
    if ($LASTEXITCODE -ne 0) { throw "build 失敗 (exit $LASTEXITCODE)" }
}

# 1) PlayerDebugMode
foreach ($v in @("CSXS.12", "CSXS.11")) {
    $key = "HKCU:\Software\Adobe\$v"
    if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
    Set-ItemProperty -Path $key -Name "PlayerDebugMode" -Value "1" -Type String
    Write-Host "PlayerDebugMode=1 設定: $key"
}

# 2) 実体コピー（robocopy ミラー）
$extRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
if (-not (Test-Path $extRoot)) { New-Item -ItemType Directory -Path $extRoot -Force | Out-Null }
$dest = Join-Path $extRoot $bundleId

# 既存が Junction なら（旧版の名残）リンクのみ安全に除去
if (Test-Path $dest) {
    $item = Get-Item $dest -Force
    if ($item.LinkType -eq "Junction") {
        [System.IO.Directory]::Delete($dest, $false)
        Write-Host "旧 Junction を除去しました"
    }
}
if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
robocopy $cepSrc $dest /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 失敗 (exit $LASTEXITCODE)" }
Write-Host "コピー作成: $dest"
Write-Host ""
Write-Host "完了。$appName を再起動し、ウィンドウ > エクステンション > 構図ガイド から開いてください。"
# 再同期の案内は開発環境（sync.ps1 がある clone）でだけ出す。配布 ZIP には sync.ps1 が無い
if (Test-Path (Join-Path $PSScriptRoot "sync.ps1")) {
    if ($Target -eq "ppro") {
        Write-Host "以後コードを編集したら pwsh -File tools\sync.ps1 -Target ppro で再同期してください。"
    } else {
        Write-Host "以後コードを編集したら pwsh -File tools\sync.ps1 で再同期してください。"
    }
}
