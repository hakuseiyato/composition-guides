# Composition Guides for Illustrator — ビルド
#
# src の #include を実ファイル内容でインライン展開し、配布物を生成する。
#   1) dist/CompositionGuides.jsx     … IL ScriptUI ダイアログ版（単体実行）
#   2) cep/jsx/engine.jsx             … IL CEP パネルが読み込むエンジン（UI なし）
#   3) dist/CompositionGuides_AE.jsx  … AE ドック可能 ScriptUI パネル版（単体ファイル）
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
    Set-Content -Path $OutPath -Value $result -Encoding UTF8
    Write-Host "ビルド完了: $OutPath"
}

Build-Inline "CompositionGuides.jsx"    (Join-Path $root "dist\CompositionGuides.jsx")
Build-Inline "cep_engine.jsx"           (Join-Path $root "cep\jsx\engine.jsx")
Build-Inline "CompositionGuides_AE.jsx" (Join-Path $root "dist\CompositionGuides_AE.jsx")
