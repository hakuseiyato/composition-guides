# Composition Guides — CEP 開発インストール
#
# 1) PlayerDebugMode を有効化（署名なし拡張の許可）
# 2) cep フォルダを CEP extensions へ実体コピー（同期は tools\sync.ps1）
#
# 注: CEP は extensions 配下の Junction/シンボリックリンクを辿らないため、
#     Junction ではなく実フォルダのコピーで運用する。編集後は sync.ps1 で再同期。
#
# 使い方: pwsh -File tools\dev-install.ps1
# 反映には Illustrator の再起動が必要。

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot     # リポジトリルート
$cepSrc = Join-Path $root "cep"
$bundleId = "com.yato.compositionguides"

if (-not (Test-Path $cepSrc)) { throw "cep フォルダが見つかりません: $cepSrc" }

# 先に engine.jsx をビルド（無ければ生成）
$engine = Join-Path $cepSrc "jsx\engine.jsx"
if (-not (Test-Path $engine)) {
    Write-Host "engine.jsx 未生成のため build を実行します"
    pwsh -File (Join-Path $root "build.ps1")
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
Write-Host "完了。Illustrator を再起動し、ウィンドウ > エクステンション > 構図ガイド から開いてください。"
Write-Host "以後コードを編集したら pwsh -File tools\sync.ps1 で再同期してください。"
