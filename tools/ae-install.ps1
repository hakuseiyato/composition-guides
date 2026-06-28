# Composition Guides — After Effects インストール
#
# build.ps1 で生成した dist/CompositionGuides_AE.jsx を AE の
#   <AE>/Support Files/Scripts/ScriptUI Panels/
# へコピーする。AE 再起動後「ウィンドウ」メニューにパネルが出る。
#
# 使い方: pwsh -File tools\ae-install.ps1
#   インストール先は Program Files 配下のため、管理者権限に自動昇格する。
#   特定バージョンを指定する場合: pwsh -File tools\ae-install.ps1 -AeRoot "C:\Program Files\Adobe\Adobe After Effects 2026"

param(
    [string]$AeRoot = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot     # リポジトリルート

# 0) 管理者権限へ自己昇格（ScriptUI Panels は Program Files 配下のため）
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "管理者権限に昇格します..."
    $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath)
    if ($AeRoot -ne "") { $argList += @("-AeRoot", $AeRoot) }
    Start-Process -FilePath "pwsh" -Verb RunAs -ArgumentList $argList
    exit
}

# 1) ビルド（常に最新化）
pwsh -File (Join-Path $root "build.ps1")
$src = Join-Path $root "dist\CompositionGuides_AE.jsx"
if (-not (Test-Path $src)) { throw "ビルド成果物が見つかりません: $src" }

# 2) AE インストール先を特定
function Find-AeRoots {
    $bases = @("$env:ProgramFiles\Adobe", "${env:ProgramFiles(x86)}\Adobe")
    $found = @()
    foreach ($b in $bases) {
        if (Test-Path $b) {
            Get-ChildItem -Path $b -Directory -Filter "Adobe After Effects*" |
                ForEach-Object { $found += $_.FullName }
        }
    }
    return $found
}

if ($AeRoot -ne "") {
    $roots = @($AeRoot)
} else {
    $roots = Find-AeRoots
}
if ($roots.Count -eq 0) {
    throw "After Effects のインストールが見つかりません。-AeRoot で明示指定してください。"
}

# 3) ScriptUI Panels フォルダへコピー（複数バージョンあれば全てへ）
$copied = @()
foreach ($r in $roots) {
    $panelsDir = Join-Path $r "Support Files\Scripts\ScriptUI Panels"
    if (-not (Test-Path $panelsDir)) {
        # 一部構成では Support Files が無いケースに備えフォールバック
        $alt = Join-Path $r "Scripts\ScriptUI Panels"
        if (Test-Path (Split-Path $alt -Parent)) { $panelsDir = $alt }
    }
    if (-not (Test-Path $panelsDir)) {
        New-Item -ItemType Directory -Path $panelsDir -Force | Out-Null
    }
    Copy-Item -Path $src -Destination (Join-Path $panelsDir "CompositionGuides_AE.jsx") -Force
    $copied += $panelsDir
    Write-Host "コピー: $panelsDir"
}

Write-Host ""
Write-Host "完了。After Effects を再起動し、ウィンドウ メニュー >"
Write-Host "  CompositionGuides_AE.jsx からパネルを開いてください（ドック可能）。"
