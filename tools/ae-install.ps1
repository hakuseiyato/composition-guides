# Composition Guides — After Effects インストール
#
# dist/CompositionGuides_AE.jsx を AE の
#   <AE>/Support Files/Scripts/ScriptUI Panels/
# へコピーする。AE 再起動後「ウィンドウ」メニューにパネルが出る。
#
# 使い方: pwsh -File tools\ae-install.ps1
#   build.ps1 がある（clone した開発環境の）ときだけ、先にビルドする。配布 ZIP では同梱の dist を使う。
#   導入先に書き込めない（Program Files 配下など）ときだけ、管理者権限に自動昇格する。
#   特定バージョンを指定する場合: pwsh -File tools\ae-install.ps1 -AeRoot "C:\Program Files\Adobe\Adobe After Effects 2026"
#   アンインストール: pwsh -File tools\ae-install.ps1 -Uninstall [-AeRoot ...]

param(
    [string]$AeRoot = "",
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot     # リポジトリルート
$psExe = (Get-Process -Id $PID).Path         # いま動いている PowerShell（5.1 / 7 のどちらでも）
$fileName = "CompositionGuides_AE.jsx"
# 末尾の \ は引数の引用符をエスケープしてしまうので落とす（ドライブ直下は除く）
if ($AeRoot -match '[^:]\\$') { $AeRoot = $AeRoot.TrimEnd('\') }

# 1) AE インストール先を特定
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

function Get-PanelsDir([string]$aeDir) {
    $dir = Join-Path $aeDir "Support Files\Scripts\ScriptUI Panels"
    if (-not (Test-Path $dir)) {
        # 一部構成では Support Files が無いケースに備えフォールバック
        $alt = Join-Path $aeDir "Scripts\ScriptUI Panels"
        if (Test-Path (Split-Path $alt -Parent)) { $dir = $alt }
    }
    return $dir
}

# 存在する最も近い祖先フォルダに一時ファイルを書いて、書き込めるかを確かめる（フォルダは作らない）
function Test-Writable([string]$dir) {
    $d = $dir
    while ($d -and -not (Test-Path -LiteralPath $d)) { $d = Split-Path -Parent $d }
    if (-not $d) { return $false }
    $probe = Join-Path $d ("cg_write_test_" + [guid]::NewGuid().ToString("N") + ".tmp")
    try {
        [System.IO.File]::WriteAllText($probe, "")
        [System.IO.File]::Delete($probe)
        return $true
    } catch {
        return $false
    }
}

if ($AeRoot -ne "") {
    $roots = @($AeRoot)
} else {
    $roots = @(Find-AeRoots)
}
if ($roots.Count -eq 0) {
    throw "After Effects のインストールが見つかりません。-AeRoot で明示指定してください。"
}
$panelsDirs = @()
foreach ($r in $roots) { $panelsDirs += Get-PanelsDir $r }

# 2) 導入先に書き込めないときだけ管理者権限へ自己昇格（Program Files 配下など）
$needAdmin = $false
foreach ($d in $panelsDirs) {
    # アンインストールは、ファイルが実際にあるフォルダだけ確かめる
    if ($Uninstall -and -not (Test-Path -LiteralPath (Join-Path $d $fileName))) { continue }
    if (-not (Test-Writable $d)) { $needAdmin = $true }
}
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($needAdmin -and -not $isAdmin) {
    Write-Host "導入先に書き込めないため、管理者権限に昇格します..."
    # Start-Process は引数を空白で連結するだけなので、パスは引用符で囲む
    $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"")
    if ($AeRoot -ne "") { $argList += @("-AeRoot", "`"$AeRoot`"") }
    if ($Uninstall) { $argList += "-Uninstall" }
    # 昇格先の終了を待ち、その終了コードを返す（呼び出し側が成否と判定を確かめられるように）
    $proc = Start-Process -FilePath $psExe -Verb RunAs -ArgumentList $argList -Wait -PassThru
    exit $proc.ExitCode
}

# 3) アンインストール
if ($Uninstall) {
    foreach ($d in $panelsDirs) {
        $dst = Join-Path $d $fileName
        if (Test-Path -LiteralPath $dst) {
            Remove-Item -LiteralPath $dst -Force
            Write-Host "削除: $dst"
        } else {
            Write-Host "未導入: $d"
        }
    }
    Write-Host ""
    Write-Host "完了。After Effects を起動中なら再起動してください。"
    exit 0
}

# 4) ビルド（build.ps1 がある開発環境のときだけ。配布 ZIP には src が無いので同梱の dist を使う）
$buildScript = Join-Path $root "build.ps1"
if (Test-Path $buildScript) {
    & $psExe -NoProfile -ExecutionPolicy Bypass -File $buildScript
    if ($LASTEXITCODE -ne 0) { throw "build 失敗 (exit $LASTEXITCODE)" }
}
$src = Join-Path $root "dist\$fileName"
if (-not (Test-Path $src)) { throw "ビルド成果物が見つかりません: $src" }

# 5) ScriptUI Panels フォルダへコピー（複数バージョンあれば全てへ）
foreach ($panelsDir in $panelsDirs) {
    if (-not (Test-Path $panelsDir)) {
        New-Item -ItemType Directory -Path $panelsDir -Force | Out-Null
    }
    Copy-Item -Path $src -Destination (Join-Path $panelsDir $fileName) -Force
    Write-Host "コピー: $panelsDir"
}

Write-Host ""
Write-Host "完了。After Effects を再起動し、ウィンドウ メニュー >"
Write-Host "  CompositionGuides_AE.jsx からパネルを開いてください（ドック可能）。"
