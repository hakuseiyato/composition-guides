# 導入ガイド（Illustrator / After Effects / Premiere Pro / Unity）

構図ガイドツールは 4 つのソフトに対応している。ソフトごとに導入方法がまったく違う。

| ソフト | 導入方法 |
|---|---|
| Illustrator | CEP 拡張 |
| After Effects | ScriptUI パネル |
| Premiere Pro | CEP 拡張 |
| Unity | C# スクリプト |

この文書は、ソフトごとに次の 6 項目を同じ順で並べている。人が読んでも、Claude に読ませても、そのまま導入できる。

1. 前提の確認
2. 導入コマンド
3. 成功の判定
4. ユーザーが行う操作
5. 更新
6. アンインストール

> [!NOTE]
> **Claude への指示**: ユーザーに「導入して」と頼まれたら、この文書の手順だけで作業すること。
> 1. どのソフトに入れるかを確認する（複数可）。指定が無ければ、インストール済みのソフトを [0. 共通の前提](#0-共通の前提) の方法で調べて提示する。
> 2. 該当ソフトの節を上から順に実行する。各手順の「判定」を満たさなければ、先へ進まずに「失敗時」の対処を行う。導入は `install.ps1` に**引数を付けて**呼ぶ（引数なしだと対話モードになり、入力待ちで止まる）。
> 3. 「⚠ ユーザー確認」と書かれた手順は、実行前に内容を説明して許可を得る。UAC 昇格やレジストリ変更を伴うため。
> 4. 最後に、ソフトごとに「導入した場所」「判定の結果」「ユーザーが行う操作（再起動など）」を報告する。

---

## 0. 共通の前提

| 項目 | 確認コマンド | 判定 |
|---|---|---|
| OS | `[System.Environment]::OSVersion.VersionString` | Windows であること。**macOS は非対応**（導入スクリプトが Windows のパスと PowerShell 前提のため） |
| PowerShell | `$PSVersionTable.PSVersion` | 5.1 以上。Windows 標準の PowerShell 5.1 で動くので、PowerShell 7 は不要 |
| git（clone 時のみ） | `git --version` | バージョンが表示されること |
| PowerShell 7（clone して開発する場合のみ） | `pwsh -v` | `PowerShell 7.x`。無ければ `winget install Microsoft.PowerShell` |
| Node.js（任意） | `node -v` | スモークテストを動かす場合のみ必要 |

### 0-1. 入手

入手の経路は 2 つある。どちらでも、導入には同じ `install.ps1` を使う。

**ZIP（利用者向け・推奨）**

1. GitHub の [Releases](https://github.com/hakuseiyato/composition-guides/releases) から `composition-guides-v<バージョン>.zip` をダウンロードする。
2. 展開する。展開したフォルダ（`install.cmd` があるフォルダ）で以降の作業を行う。
3. 人が導入する場合は、`install.cmd` をダブルクリックして番号で選べば終わる（[0-5](#0-5-導入の入口-installps1)）。

ZIP にはビルド済みの生成物が入っているので、git・ビルド・Node.js は要らない。

**clone（開発者向け）**

```bash
git clone https://github.com/hakuseiyato/composition-guides.git
```

以降のコマンドは、**すべて展開したフォルダ（clone ならリポジトリのルート）で実行する**。

### 0-2. ビルド（clone の場合のみ）

ZIP には生成物が入っているので不要。

```bash
pwsh -NoProfile -File build.ps1
```

- **判定**: 終了コードが 0 で、次のファイルがすべて存在すること。
  - `dist/CompositionGuides.jsx`
  - `dist/CompositionGuides_AE.jsx`
  - `cep/jsx/engine.jsx`
  - `cep_ppro/js/engine.js`
  - `cep_ppro/jsx/host.jsx`
- 各導入スクリプトは必要に応じて自分でビルドを呼ぶので、この手順は確認のためのもの。

### 0-3. インストール済みソフトの確認

```powershell
Get-ChildItem "$env:ProgramFiles\Adobe" -Directory | Where-Object Name -match "Illustrator|After Effects|Premiere Pro" | Select-Object -ExpandProperty Name
```

Unity は Unity Hub が管理しているので、導入先の **Unity プロジェクトのフォルダをユーザーに確認する**。

### 0-4. PlayerDebugMode（Illustrator / Premiere Pro の CEP 拡張のみ）

この 2 つは署名のない CEP 拡張として入れる。そのため、レジストリの
`HKCU\Software\Adobe\CSXS.11` と `CSXS.12` に `PlayerDebugMode = "1"` が必要になる。
導入スクリプトがこれを自動で設定する。

現在の値は次で確認できる（読み取りのみ）。

```powershell
foreach ($v in "CSXS.11","CSXS.12") { "$v : " + (Get-ItemProperty "HKCU:\Software\Adobe\$v" -Name PlayerDebugMode -ErrorAction SilentlyContinue).PlayerDebugMode }
```

- 両方とも `1` なら、導入スクリプトを実行しても値は変わらない。
- **⚠ ユーザー確認**: 空欄がある場合は、導入スクリプトがレジストリを書き換える。「署名のない拡張の読み込みを許可する、ユーザー単位の Adobe 設定」であることを説明し、許可を得てから進める。

### 0-5. 導入の入口 `install.ps1`

すべてのソフトの導入・アンインストールは `install.ps1` 1 本で行う（ZIP でも clone でも同じ）。

| 使い方 | 内容 |
|---|---|
| `install.cmd` をダブルクリック | 対話モード。インストール済みの Adobe ソフトを表示し、番号で選ぶ。最後に `pause` で止まる |
| `powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target <x>` | 非対話。**Claude はこの形で呼ぶ** |

- `-Target` は `il`（Illustrator）/ `ae`（After Effects）/ `ppro`（Premiere Pro）/ `unity`。`-Target il,ppro` のようにカンマ区切りで複数指定できる。
- ほかの引数は `-UnityProject <path>`（Unity のとき必須）、`-AeRoot <path>`（AE のバージョンを絞るとき）、`-Uninstall`。
- 最後に、ソフトごとの判定（各節の「判定」と同じ確認）を表で出す。**終了コードは、すべて OK なら 0、1 つでも NG があれば 1**。
- `-ExecutionPolicy Bypass` は、ZIP から展開したファイルに付く「インターネットから取得した」印（Mark-of-the-Web）で実行が止まるのを避けるため。

---

## 1. Illustrator

| 方式 | 内容 | 推奨 |
|---|---|---|
| CEP パネル | 整列・線パネルのようにドックできる常駐パネル | ◎ |
| ScriptUI ダイアログ | インストール不要。実行のたびに開くモーダル | 試用向け |

### 1-A. CEP パネル（推奨）

**前提**

- Illustrator 2026（v30 / CEP 12）で確認済み。manifest 上は全バージョンを許可している。
- PlayerDebugMode が設定済みであること（[0-4](#0-4-playerdebugmodeillustrator--premiere-pro-の-cep-拡張のみ)）。

**導入**

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target il
```

内部では `tools\dev-install.ps1` が PlayerDebugMode の設定と拡張フォルダへのコピーを行う。

**判定**: 次が `True` になること（`install.ps1` が最後に出す表と同じ）。

```powershell
Test-Path "$env:APPDATA\Adobe\CEP\extensions\com.yato.compositionguides\CSXS\manifest.xml"
Test-Path "$env:APPDATA\Adobe\CEP\extensions\com.yato.compositionguides\jsx\engine.jsx"
Test-Path "$env:APPDATA\Adobe\CEP\extensions\com.yato.compositionguides\js\ui.js"
```

**ユーザーが行う操作**

1. Illustrator を再起動する。
2. `ウィンドウ > エクステンション > 構図ガイド Composition Guides` を開く。

**更新**

- ZIP: 新しい ZIP を展開し、導入コマンドを再実行する（上書きされる）。
- clone（コードを変更した後）:

  ```bash
  pwsh -NoProfile -File tools\sync.ps1
  ```

**アンインストール**

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Uninstall -Target il
```

手動で消す場合は次のとおり。

```powershell
Remove-Item "$env:APPDATA\Adobe\CEP\extensions\com.yato.compositionguides" -Recurse -Force
```

**失敗時**

| 症状 | 原因と対処 |
|---|---|
| メニューに出ない | PlayerDebugMode が未設定、または Illustrator を再起動していない。[0-4](#0-4-playerdebugmodeillustrator--premiere-pro-の-cep-拡張のみ) を確認し、再起動する |
| メニューに出ない（設定は正しい） | `extensions` 配下を Junction やシンボリックリンクにしていないか確認する。CEP はリンクを辿らないので、実体のコピーが必要（スクリプトはコピーしている） |
| パネルが真っ白 | `js\ui.js` が無い。`tools\sync.ps1` で同期し直す |

### 1-B. ScriptUI ダイアログ（インストール不要）

1. Illustrator でドキュメントを開く。
2. `ファイル > スクリプト > その他のスクリプト...` から `dist\CompositionGuides.jsx` を選ぶ。

ファイルを 1 本選ぶだけなので、Claude が行う作業は無い。展開したフォルダ（clone ならリポジトリ）内の `dist\CompositionGuides.jsx` のフルパスをユーザーに伝える。

---

## 2. After Effects

**前提**

- After Effects CC 2018（15.0）以降。パース VP のライブ調整が `createPath()` を使うため。
- **⚠ ユーザー確認**: 導入先が `Program Files` 配下で書き込めないので、スクリプトが**管理者権限に自動で昇格する**（導入先に書き込めるときは昇格しない）。UAC ダイアログが出るので、ユーザーに「はい」を押してもらう必要がある。実行前にそのことを伝える。

**導入**

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target ae
```

- 内部では `tools\ae-install.ps1` がコピーを行う。clone の場合は先にビルドもする（ZIP では同梱の `dist` を使う）。
- インストール済みの After Effects がすべて対象になる。バージョンを絞る場合は次のようにする。

  ```bash
  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target ae -AeRoot "C:\Program Files\Adobe\Adobe After Effects 2026"
  ```

- 昇格したプロセスは**別ウィンドウ**で動く。元のコマンドはその終了を待ち、最後に判定の表を出す。UAC を拒否した場合は NG になる。

**判定**: 次で、各バージョンに `True` が出ること。

```powershell
Get-ChildItem "$env:ProgramFiles\Adobe" -Directory -Filter "Adobe After Effects*" | ForEach-Object { "{0} : {1}" -f $_.Name, (Test-Path (Join-Path $_.FullName "Support Files\Scripts\ScriptUI Panels\CompositionGuides_AE.jsx")) }
```

**ユーザーが行う操作**

1. After Effects を再起動する。
2. `ウィンドウ` メニューの下部にある `CompositionGuides_AE.jsx` を開く（ドックできる）。

**更新**: 導入コマンドを再実行する（上書きされる）。

**アンインストール**（⚠ 管理者権限が必要。書き込めないときだけ自動で昇格する）

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Uninstall -Target ae
```

手動で消す場合は次のとおり（管理者の PowerShell で実行する）。

```powershell
Remove-Item "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Scripts\ScriptUI Panels\CompositionGuides_AE.jsx"
```

**失敗時**

| 症状 | 原因と対処 |
|---|---|
| `After Effects のインストールが見つかりません` | 標準以外の場所にインストールされている。`-AeRoot` でフォルダを指定する |
| 判定が `False` | UAC が拒否されたか、昇格先でエラーが出た。もう一度実行し、昇格したウィンドウの出力をユーザーに見てもらう |

**インストールせずに試す場合**: `ファイル > スクリプト > スクリプトファイルを実行...` から `dist\CompositionGuides_AE.jsx` を選ぶ（フローティングパレットになる）。

---

## 3. Premiere Pro

**前提**

- Premiere Pro 2024（24.0）以降。manifest で `PPRO [24.0,99.9]` を指定している。
- PlayerDebugMode が設定済みであること（[0-4](#0-4-playerdebugmodeillustrator--premiere-pro-の-cep-拡張のみ)）。
- CEP 方式で作っている。Adobe は Premiere Pro の CEP を 2028-12 に既定で無効化する予定なので、それ以降は UXP への移行が必要になる。

**導入**

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target ppro
```

内部では `tools\dev-install.ps1 -Target ppro` が PlayerDebugMode の設定と拡張フォルダへのコピーを行う。

**判定**: 次が `True` になること（`install.ps1` が最後に出す表と同じ）。

```powershell
Test-Path "$env:APPDATA\Adobe\CEP\extensions\com.yato.compositionguides.ppro\CSXS\manifest.xml"
Test-Path "$env:APPDATA\Adobe\CEP\extensions\com.yato.compositionguides.ppro\js\engine.js"
Test-Path "$env:APPDATA\Adobe\CEP\extensions\com.yato.compositionguides.ppro\jsx\host.jsx"
```

clone の場合は、任意でエンジン単体の動作も確認できる（Node.js が必要。`OK` と出れば正常。ZIP には入っていない）。

```bash
node tools\ppro-smoke.js
```

**ユーザーが行う操作**

1. Premiere Pro を再起動する。
2. `ウィンドウ > エクステンション > 構図ガイド Composition Guides` を開く。
3. **シーケンスの最上段のビデオトラックを空けておく**（ガイドの PNG をそこに置くため）。

> [!WARNING]
> ガイドは通常のクリップとして置かれるため、**そのままだと書き出しに焼き込まれる**。
> 書き出す前に、パネルの「表示切替」で無効化するか、「全消去」で外すこと。導入完了の報告にも必ずこの注意を入れる。

**更新**

- ZIP: 新しい ZIP を展開し、導入コマンドを再実行する（上書きされる）。
- clone（コードを変更した後）:

  ```bash
  pwsh -NoProfile -File tools\sync.ps1 -Target ppro
  ```

**アンインストール**

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Uninstall -Target ppro
```

手動で消す場合は次のとおり。

```powershell
Remove-Item "$env:APPDATA\Adobe\CEP\extensions\com.yato.compositionguides.ppro" -Recurse -Force
```

プロジェクトに残った `Composition Guides` ビンと、`<プロジェクトと同じ階層>\Composition Guides\` の PNG は手動で消す。

**失敗時**

| 症状 | 原因と対処 |
|---|---|
| メニューに出ない | PlayerDebugMode が未設定、または Premiere Pro を再起動していない |
| 「最上段のビデオトラックが空いていません」 | 空のビデオトラックを最上段に追加してから、もう一度「生成 / 更新」を押す |
| 「失敗: ERR:...」 | ステータスバーの文言をそのまま控えて報告する（Premiere の API 側の問題の可能性がある） |

---

## 4. Unity

Unity にはパッケージではなく、**C# スクリプトを Unity プロジェクトの `Assets` 配下にコピーして**入れる。

| ファイル | 内容 |
|---|---|
| `unity/CompositionGuides.cs` | 構図ガイドを Game ビューに直接描く（`Yato > Composition Guides`） |
| `unity/LedChart.cs` | LED 回線チャート（`Yato > LED Chart`）。必要な場合のみ |

**前提**

- **⚠ ユーザー確認**: 導入先の Unity プロジェクトのフォルダと Unity のバージョンを確認する。フォルダは `ProjectSettings\ProjectVersion.txt` があるフォルダで、バージョンはそのファイルの `m_EditorVersion` に書かれている。
- 動作確認したバージョンは**確認が必要**（スクリプトにバージョン依存の記述は無い）。
- ビルトイン / URP / HDRP のどれでも動く。描画の仕組みは自動で切り替わる。

**導入**（`<UnityProject>` はユーザーに確認したパス）

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Target unity -UnityProject "<UnityProject>"
```

- `unity\*.cs` を `<UnityProject>\Assets\Yato\CompositionGuides\` にコピーする（以下 `$dst`）。
- `ProjectSettings\ProjectVersion.txt` が無いフォルダは Unity プロジェクトではないとして拒否し、NG になる。

**判定**: `Test-Path "$dst\CompositionGuides.cs"` が `True` になること（`install.ps1` が最後に出す表と同じ）。コンパイルが通るかは Unity エディタでしか確かめられないので、ユーザーに確認してもらう。

**ユーザーが行う操作**

1. Unity エディタに切り替える（自動でコンパイルされる）。Console にエラーが出ていないことを確認する。
2. カメラを選び、`Add Component > Yato > Composition Guides` を追加する。
3. Game ビューにガイドとトグルパネルが出れば完了。

**更新**: 導入コマンドを再実行する（上書きされる）。

**アンインストール**

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Uninstall -Target unity -UnityProject "<UnityProject>"
```

手動で消す場合は次のとおり。

```powershell
Remove-Item "<UnityProject>\Assets\Yato\CompositionGuides" -Recurse -Force
```

`.meta` ファイルも一緒に消える。シーンにコンポーネントが付いたままだと Missing Script になるので、先にコンポーネントを外しておく。

---

## 付録: 導入先の一覧

| ソフト | 導入先 | 導入に使うもの |
|---|---|---|
| Illustrator | `%APPDATA%\Adobe\CEP\extensions\com.yato.compositionguides\` | `install.ps1 -Target il`（`tools\dev-install.ps1`） |
| After Effects | `<AE>\Support Files\Scripts\ScriptUI Panels\CompositionGuides_AE.jsx` | `install.ps1 -Target ae`（`tools\ae-install.ps1`） |
| Premiere Pro | `%APPDATA%\Adobe\CEP\extensions\com.yato.compositionguides.ppro\` | `install.ps1 -Target ppro`（`tools\dev-install.ps1 -Target ppro`） |
| Unity | `<UnityProject>\Assets\Yato\CompositionGuides\` | `install.ps1 -Target unity -UnityProject <path>` |

どれも**展開したフォルダ（またはリポジトリ）からのコピー**なので、導入した後はフォルダを移動したりリネームしたり消したりしても動作に影響しない。
