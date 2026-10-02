# Composition Guides for Illustrator — ビルド
#
# src の #include を実ファイル内容でインライン展開し、配布物を生成する。
#   1) dist/CompositionGuides.jsx     … IL ScriptUI ダイアログ版（単体実行）
#   2) cep/jsx/engine.jsx             … IL CEP パネルが読み込むエンジン（UI なし）
#   3) dist/CompositionGuides_AE.jsx  … AE ドック可能 ScriptUI パネル版（単体ファイル）
#   4) cep_ppro/js/engine.js       … Premiere CEP パネルのブラウザ側エンジン（canvas 描画）
#   5) cep_ppro/jsx/host.jsx       … Premiere ExtendScript（PNG の読込・配置）
#
# 使い方: pwsh -File build.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$srcDir = Join-Path $root "src"

function Build-Inline {
    param([string]$EntryRel, [string]$OutPath)

    $entry = Join-Path $srcDir $EntryRel
    $lines = Get-Content -Path $entry -Encoding UTF8
    $result = New-Object System.Collections.Generic.List[string]

    foreach ($line in $lines) {
        $m = [regex]::Match($line, '^\s*#include\s+"([^"]+)"\s*$')
        if ($m.Success) {
            $incRel = $m.Groups[1].Value
            $incPath = Join-Path $srcDir $incRel
            if (-not (Test-Path $incPath)) { throw "include 対象が見つかりません: $incPath" }
            $result.Add("// ===== begin $incRel =====")
            foreach ($l in (Get-Content -Path $incPath -Encoding UTF8)) { $result.Add($l) }
            $result.Add("// ===== end $incRel =====")
        } else {
            $result.Add($line)
        }
    }

    $outDir = Split-Path -Parent $OutPath
    if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
    # BOM なし UTF-8 で書く。Set-Content -Encoding UTF8 は 5.1 だと BOM を付け、7 と生成物が変わるため
    [System.IO.File]::WriteAllLines($OutPath, $result, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "ビルド完了: $OutPath"
}

Build-Inline "CompositionGuides.jsx"    (Join-Path $root "dist\CompositionGuides.jsx")
Build-Inline "cep_engine.jsx"           (Join-Path $root "cep\jsx\engine.jsx")
Build-Inline "CompositionGuides_AE.jsx" (Join-Path $root "dist\CompositionGuides_AE.jsx")
Build-Inline "ppro_engine.jsx"          (Join-Path $root "cep_ppro\js\engine.js")
Build-Inline "ppro\host.jsx"            (Join-Path $root "cep_ppro\jsx\host.jsx")

# CEP 拡張フォルダは自己完結が必要なため共通 UI をコピー
foreach ($pair in @(@("cep\js\ui.js", "cep_ppro\js\ui.js"), @("cep\css\style.css", "cep_ppro\css\style.css"))) {
    $from = Join-Path $root $pair[0]
    $to = Join-Path $root $pair[1]
    $toDir = Split-Path -Parent $to
    if (-not (Test-Path $toDir)) { New-Item -ItemType Directory -Path $toDir | Out-Null }
    Copy-Item -Path $from -Destination $to -Force
    Write-Host "コピー完了: $to"
}
