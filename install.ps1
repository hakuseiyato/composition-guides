# Composition Guides — 導入の入口（Illustrator / After Effects / Premiere Pro / Unity）
#
# clone したリポジトリでも、配布 ZIP を展開したフォルダでも同じように使う。
# 実際の導入は tools\dev-install.ps1（Illustrator / Premiere Pro）と tools\ae-install.ps1（After Effects）
# に任せ、最後に INSTALL.md の「判定」と同じ確認を行って結果を表で出す。
#
# 使い方（PowerShell 5.1 / 7 のどちらでも動く）:
#   install.cmd をダブルクリック … 対話モード（インストール済みのソフトを表示し、番号で選ぶ）
#   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target il,ppro
#   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target ae [-AeRoot "C:\Program Files\Adobe\Adobe After Effects 2026"]
#   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target unity -UnityProject "D:\MyUnityProject"
#   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Uninstall -Target il,ae,ppro,unity -UnityProject "D:\MyUnityProject"
#
# -Target: il（Illustrator）/ ae（After Effects）/ ppro（Premiere Pro）/ unity。カンマ区切りで複数指定できる。
# 引数があるときは完全に非対話で動く。
# 終了コード: すべての判定が OK なら 0、1 つでも NG があれば 1。

param(
    [string[]]$Target = @(),
    [string]$UnityProject = "",
    [string]$AeRoot = "",
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$psExe = (Get-Process -Id $PID).Path         # いま動いている PowerShell（5.1 / 7 のどちらでも）
$allTargets = @("il", "ae", "ppro", "unity")
$appNames = @{ il = "Illustrator"; ae = "After Effects"; ppro = "Premiere Pro"; unity = "Unity" }
$cepBundles = @{ il = "com.yato.compositionguides"; ppro = "com.yato.compositionguides.ppro" }
# INSTALL.md の「判定」で確かめるファイル（CEP 拡張フォルダからの相対パス）
$cepChecks = @{
    il   = @("CSXS\manifest.xml", "jsx\engine.jsx", "js\ui.js")
    ppro = @("CSXS\manifest.xml", "js\engine.js", "jsx\host.jsx")
}
$aeFileName = "CompositionGuides_AE.jsx"
# 末尾の \ は子プロセスへ渡す引数の引用符をエスケープしてしまうので落とす（ドライブ直下は除く）
if ($AeRoot -match '[^:]\\$') { $AeRoot = $AeRoot.TrimEnd('\') }

# ---- 対話モード（引数なしのときだけ） ----
if ($PSBoundParameters.Count -eq 0) {
    $installed = @()
    $adobeDir = Join-Path $env:ProgramFiles "Adobe"
    if (Test-Path $adobeDir) {
        $installed = @(Get-ChildItem -Path $adobeDir -Directory | ForEach-Object { $_.Name })
    }
    $patterns = @{ il = "Illustrator"; ae = "After Effects"; ppro = "Premiere Pro" }
    Write-Host "構図ガイド Composition Guides の導入"
    Write-Host ""
    for ($i = 0; $i -lt $allTargets.Count; $i++) {
        $t = $allTargets[$i]
        if ($t -eq "unity") {
            $state = "導入先の Unity プロジェクトを指定する"
        } else {
            $hits = @($installed | Where-Object { $_ -match $patterns[$t] })
            if ($hits.Count -gt 0) { $state = "検出: " + ($hits -join ", ") } else { $state = "未検出" }
        }
        Write-Host ("  {0}. {1,-14} {2}" -f ($i + 1), $appNames[$t], $state)
    }
    Write-Host ""
    $answer = Read-Host "導入する番号をカンマ区切りで入力してください（例: 1,3）"
    foreach ($n in ($answer -split '[,\s]+')) {
        if ($n -eq "") { continue }
        if ($n -notmatch '^[1-4]$') { throw "番号が正しくありません: $n（1〜4 で指定してください）" }
        $Target += $allTargets[[int]$n - 1]
    }
    if ($Target -contains "unity") {
        $UnityProject = Read-Host "Unity プロジェクトのフォルダ（ProjectSettings フォルダがある場所）"
        $UnityProject = $UnityProject.Trim().Trim('"')
    }
}

# ---- 対象の正規化（powershell -File ではカンマ区切りが 1 つの文字列で届くため自前で分割する） ----
$requested = @()
foreach ($t in $Target) {
    foreach ($p in ($t -split '[,\s]+')) {
        if ($p -ne "") { $requested += $p.ToLower() }
    }
}
$unknown = @($requested | Where-Object { $allTargets -notcontains $_ })
if ($unknown.Count -gt 0) { throw "不明な対象です: $($unknown -join ', ')（il, ae, ppro, unity から指定してください）" }
if ($requested.Count -eq 0) { throw "-Target で対象を指定してください（il, ae, ppro, unity。複数はカンマ区切り）" }
$targets = @($allTargets | Where-Object { $requested -contains $_ })   # 重複を除き、順序をそろえる

# ---- 共通の関数 ----

# 子スクリプトを同じ PowerShell で実行し、終了コードを返す（出力は画面に流す）
function Invoke-ChildScript([string]$relPath, [string[]]$childArgs) {
    $path = Join-Path $root $relPath
    & $psExe -NoProfile -ExecutionPolicy Bypass -File $path @childArgs | Out-Host
    return $LASTEXITCODE
}

function Get-CepDest([string]$t) {
    return Join-Path $env:APPDATA ("Adobe\CEP\extensions\" + $cepBundles[$t])
}

function Get-AeRoots {
    if ($AeRoot -ne "") { return @($AeRoot) }
    $found = @()
    foreach ($b in @("$env:ProgramFiles\Adobe", "${env:ProgramFiles(x86)}\Adobe")) {
        if (Test-Path $b) {
            $found += @(Get-ChildItem -Path $b -Directory -Filter "Adobe After Effects*" | ForEach-Object { $_.FullName })
        }
    }
    return $found
}

# Unity プロジェクトか確かめて、導入先のフォルダを返す（ProjectVersion.txt が無ければ拒否）
function Get-UnityDest {
    if ($UnityProject -eq "") { throw "-UnityProject で Unity プロジェクトのフォルダを指定してください" }
    $versionFile = Join-Path $UnityProject "ProjectSettings\ProjectVersion.txt"
    if (-not (Test-Path -LiteralPath $versionFile)) {
        throw "Unity プロジェクトではありません（ProjectSettings\ProjectVersion.txt がありません）: $UnityProject"
    }
    return Join-Path $UnityProject "Assets\Yato\CompositionGuides"
}

# フォルダを消す。Junction / シンボリックリンクならリンクだけを外す（リンク先の実体は消さない）
function Remove-FolderSafely([string]$dir) {
    if (-not (Test-Path -LiteralPath $dir)) {
        Write-Host "未導入: $dir"
        return
    }
    $item = Get-Item -LiteralPath $dir -Force
    if ($item.LinkType) {
        [System.IO.Directory]::Delete($dir, $false)
    } else {
        Remove-Item -LiteralPath $dir -Recurse -Force
    }
    Write-Host "削除: $dir"
}

# ---- 導入 / アンインストールの実行 ----
$failures = @{}
foreach ($t in $targets) {
    Write-Host ""
    if ($Uninstall) { Write-Host "=== $($appNames[$t]) をアンインストール ===" } else { Write-Host "=== $($appNames[$t]) を導入 ===" }
    try {
        if ($t -eq "il" -or $t -eq "ppro") {
            if ($Uninstall) {
                Remove-FolderSafely (Get-CepDest $t)
            } else {
                $code = Invoke-ChildScript "tools\dev-install.ps1" @("-Target", $t)
                if ($code -ne 0) { throw "tools\dev-install.ps1 が失敗しました (exit $code)" }
            }
        } elseif ($t -eq "ae") {
            $childArgs = @()
            if ($AeRoot -ne "") { $childArgs += @("-AeRoot", $AeRoot) }
            if ($Uninstall) { $childArgs += "-Uninstall" }
            $code = Invoke-ChildScript "tools\ae-install.ps1" $childArgs
            if ($code -ne 0) { throw "tools\ae-install.ps1 が失敗しました (exit $code)" }
        } elseif ($t -eq "unity") {
            $dst = Get-UnityDest
            if ($Uninstall) {
                Remove-FolderSafely $dst
            } else {
                if (-not (Test-Path -LiteralPath $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }
                Copy-Item -Path (Join-Path $root "unity\*.cs") -Destination $dst -Force
                Write-Host "コピー: $dst"
            }
        }
    } catch {
        $failures[$t] = $_.Exception.Message
        Write-Host "失敗: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ---- 判定（INSTALL.md の「判定」と同じ Test-Path。アンインストールでは「無いこと」を確かめる） ----
$rows = @()
function Add-Row([string]$t, [string]$item, [bool]$exists) {
    if ($Uninstall) { $ok = -not $exists } else { $ok = $exists }
    $result = "NG"
    if ($ok) { $result = "OK" }
    $script:rows += [pscustomobject]@{ "対象" = $appNames[$t]; "結果" = $result; "確認項目" = $item }
}
function Add-NgRow([string]$t, [string]$item) {
    $script:rows += [pscustomobject]@{ "対象" = $appNames[$t]; "結果" = "NG"; "確認項目" = $item }
}

foreach ($t in $targets) {
    if ($failures.ContainsKey($t)) { Add-NgRow $t ("処理の失敗: " + $failures[$t]) }
    if ($t -eq "il" -or $t -eq "ppro") {
        $dest = Get-CepDest $t
        if ($Uninstall) {
            Add-Row $t $dest (Test-Path -LiteralPath $dest)
        } else {
            foreach ($rel in $cepChecks[$t]) {
                $p = Join-Path $dest $rel
                Add-Row $t $p (Test-Path -LiteralPath $p)
            }
        }
    } elseif ($t -eq "ae") {
        $aeRoots = @(Get-AeRoots)
        if ($aeRoots.Count -eq 0) { Add-NgRow $t "After Effects のインストールが見つかりません（-AeRoot で指定できます）" }
        foreach ($r in $aeRoots) {
            # ae-install.ps1 と同じく、Support Files が無い構成のフォールバック先も見る
            $p = Join-Path $r "Support Files\Scripts\ScriptUI Panels\$aeFileName"
            $alt = Join-Path $r "Scripts\ScriptUI Panels\$aeFileName"
            Add-Row $t $p ((Test-Path -LiteralPath $p) -or (Test-Path -LiteralPath $alt))
        }
    } elseif ($t -eq "unity") {
        try {
            $dst = Get-UnityDest
            if ($Uninstall) {
                Add-Row $t $dst (Test-Path -LiteralPath $dst)
            } else {
                $p = Join-Path $dst "CompositionGuides.cs"
                Add-Row $t $p (Test-Path -LiteralPath $p)
            }
        } catch {
            if (-not $failures.ContainsKey($t)) { Add-NgRow $t $_.Exception.Message }
        }
    }
}

Write-Host ""
if ($Uninstall) { Write-Host "判定（アンインストール: 導入先が無ければ OK）" } else { Write-Host "判定" }
Write-Host ($rows | Format-Table -AutoSize | Out-String -Width 4096).TrimEnd()
Write-Host ""

$ngRows = @($rows | Where-Object { $_."結果" -ne "OK" })
$ngApps = @($ngRows | ForEach-Object { $_."対象" })
if (-not $Uninstall) {
    # ユーザーが行う操作は、判定がすべて OK だった対象だけ案内する
    if ($targets -contains "il" -and $ngApps -notcontains $appNames.il) { Write-Host "Illustrator: 再起動し、ウィンドウ > エクステンション > 構図ガイド Composition Guides を開いてください。" }
    if ($targets -contains "ae" -and $ngApps -notcontains $appNames.ae) { Write-Host "After Effects: 再起動し、ウィンドウ メニュー下部の CompositionGuides_AE.jsx を開いてください。" }
    if ($targets -contains "ppro") {
        if ($ngApps -notcontains $appNames.ppro) { Write-Host "Premiere Pro: 再起動し、ウィンドウ > エクステンション > 構図ガイド Composition Guides を開いてください。" }
        Write-Host "  注意: ガイドは通常のクリップとして置かれるため、そのままだと書き出しに焼き込まれます。" -ForegroundColor Yellow
        Write-Host "  書き出す前に、パネルの「表示切替」で無効化するか、「全消去」で外してください。" -ForegroundColor Yellow
    }
    if ($targets -contains "unity" -and $ngApps -notcontains $appNames.unity) { Write-Host "Unity: エディタに切り替えてコンパイルを待ち、カメラに Add Component > Yato > Composition Guides を追加してください。" }
}

$ngCount = $ngRows.Count
if ($ngCount -gt 0) {
    Write-Host ""
    Write-Host "NG が $ngCount 件あります。INSTALL.md の「失敗時」を参照してください。" -ForegroundColor Red
    exit 1
}
exit 0
