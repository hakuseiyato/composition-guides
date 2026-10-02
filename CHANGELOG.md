# Changelog

## [0.10.0] - 2026-10-02 (Premiere Pro 版)

### Added

- Premiere Pro 版 CEP パネル `cep_ppro/` を追加。アクティブシーケンスのフレームサイズで
  パネル内 canvas にガイドを描き、透過 PNG としてシーケンスの最上段の空ビデオトラックへ
  全尺で配置する。「表示切替」で有効/無効、「全消去」で配置を外す。
- `src/ppro/layer.jsx` を追加。描画プリミティブの canvas バックエンド（y 反転は `_pproFlip`）。
- `src/ppro/host.jsx` を追加。Premiere ExtendScript 側の `CGPHost`（PNG の読込・ビン管理・
  配置・差し替え・表示切替・消去）。
- `src/ppro_engine.jsx` を追加。ブラウザ側エンジンのエントリ（`ae/frame.jsx` を再利用）。
- `tools/ppro-smoke.js` を追加。node で engine.js を読み込み、偽 canvas で描画を検査する。
- `INSTALL.md` を追加。ソフト別の導入・判定・更新・アンインストールの手順を、
  Claude が読んでそのまま実行できる形式でまとめた。
- `CLAUDE.md`（導入時は INSTALL.md に従うよう指示）と `doc/architecture.md` を追加。
- リポジトリ名を `yato-illustrator-composition-guides` から `composition-guides` に変更した
  （ローカルフォルダと GitHub の両方）。
- 配布の整備。GitHub Releases にビルド済み ZIP を置き、展開して `install.cmd` を実行するだけで
  導入できるようにした（git・ビルド・Node.js・PowerShell 7 は不要）。
  - `install.ps1` / `install.cmd` を追加。`-Target il,ae,ppro,unity`（複数可）・`-UnityProject`・
    `-AeRoot`・`-Uninstall` を受け取り、IL / Premiere は `tools/dev-install.ps1`、AE は
    `tools/ae-install.ps1` に任せ、Unity は `Assets/Yato/CompositionGuides/` へコピーする。
    最後に INSTALL.md の「判定」と同じ確認を表で出し、NG があれば終了コード 1 を返す。
    引数なしのときは、インストール済みの Adobe ソフトを表示して番号で選ばせる。
  - `tools/package.ps1` を追加。build・スモークテスト・CHANGELOG と manifest のバージョン一致を
    確かめてから、`release/composition-guides-v<ver>.zip` を作る（`.debug` と `src/` は入れない）。
    `.gitignore` に `release/` を追加。

### Changed

- `cep/js/main.js` からホスト非依存の UI 部品を `cep/js/ui.js`（`CGUI`）へ切り出し。
  IL パネルの挙動は不変。
- `build.ps1` に Premiere 出力（`cep_ppro/js/engine.js` / `cep_ppro/jsx/host.jsx`）と、
  共通 UI・CSS の `cep_ppro/` へのコピーを追加。
- `tools/dev-install.ps1` / `tools/sync.ps1` に `-Target il|ppro` を追加（既定 `il` で挙動不変）。
- `.ps1` をすべて UTF-8 BOM 付き・CRLF で保存し直した。Windows 標準の PowerShell 5.1 でも
  日本語のコメント・文言でパースが壊れない。
- `pwsh` の直接呼び出しを、いま動いている PowerShell（`(Get-Process -Id $PID).Path`）に置き換えた。
  build が失敗したら中断する。
- `tools/ae-install.ps1`: `build.ps1` がある（clone した開発環境の）ときだけビルドする。
  管理者への昇格は導入先に書き込めないときだけ行い、昇格先の終了を待ってその終了コードを返す。
  `-Uninstall` を追加した。
- `cep/CSXS/manifest.xml` のバージョンを `0.4.0` から `0.10.0` に上げた（CHANGELOG と揃えた）。
- `INSTALL.md` の取得手順を ZIP（利用者向け）と clone（開発者向け）の 2 経路に分け、
  導入コマンドを `install.ps1 -Target <x>` に揃えた。README に「入手と導入」とライセンスの節を追加。

### Notes

- Premiere 実機での動作確認は要・Yato 検証。`trackItem.end` への代入・静止画の
  `changeMediaPath`・`cep.fs` の Base64 書き出しは実機未確認。
- ガイドは通常のクリップなので**書き出しに焼き込まれる**。書き出し前に「表示切替」で
  無効化するか「全消去」で外す必要がある。
- 敵対的レビューの指摘を反映した。
  - 尺を `end − zeroPoint` で配置前に求める（開始 TC≠0 で黒尺が付く問題、静止画の既定尺が混ざる問題）。
  - 再生成時に尺を合わせ直す（伸ばす方向のみ）。
  - `changeMediaPath` の成功を確かめてから旧 PNG を消す（オフライン防止）。
  - Windows の `\\?\` 接頭辞を除去する。
  - 読み込んだアイテムを前後差分で特定する。
  - 「最上段が埋まっている」判定をアイテム変更前に行う。
  - 未参照の PNG を消す。
  - スモークテストに楕円・閉路・線設定・放射線本数の検査を追加した。
- 見送り:
  - ガイドアイテムを別ビンへ移したり改名したりすると、新規読み込み扱いになる。
  - `dev-install -Target ppro` は `engine.js` の有無だけで build 要否を判断する。

## [0.9.0] - 2026-09-02 (IL: 全アートボード一括生成)

### Added

- 基準アートボードに「すべて / All artboards」を追加。1 回の「生成 / 更新」で
  全アートボードへガイドを生成する（単一の `Composition Guides` レイヤーにまとめる）。
- `src/core/dedup.jsx` を追加。座標が一致するガイドパスを 1 本に畳む
  （`中央十字` × `水平線 0.5` × `垂直線 0.5` → 2 本、`対角線` × `三角構図` → 1 本削除、
  `対角線` × `黄金分割` → 2 本削除、`三分割` × `パターン 3×3` → 4 本削除）。
  `CG.dedup.selfCheck()` で検算できる。

### Changed

- `CG.generate()` をフレーム配列のループ構造へ変更（`CG._drawFrame()` を抽出）。
  レイヤーの作り直しとロックはループ外で 1 回だけ行う。
- `CG.frame.list()` を IL / AE 双方に追加。

### Notes

- **重複除去は矩形ガイドの辺単位には効かない**。`フレーム外周` / `セーフエリア` /
  `アスペクトマスク` は `addRectGuide` → 閉じた 4 点ポリライン 1 本として生成されるため、
  辺単位のキーが存在しない。隣接アートボードの共有辺には矩形が 2 本重なる（見た目は 1 本）。
  辺単位で畳むには `addRectGuide` を 4 本の `addLineGuide` に分解する必要があり、
  ガイドの選択単位が 1 つ → 4 つに変わるため今回はしない。
- アートボードを完全に重ならせている場合は、ガイド一式が 1 組に畳まる（座標が同一なので見た目不変）。
- AE 版は `CG.frame.list()` 追加のみで挙動不変（`CG.dedup` は AE 側では未ロード）。
- Illustrator 実機での動作確認は要・Yato 検証。

## [0.8.1] - 2026-08-13 (Unity: チャート単体表示)

### Added

- `LedChart.fillViewBackground` を追加。`drawBackground` の塗り範囲をチャート矩形から
  **カメラ表示領域全体**へ広げる。チャートとビューのアスペクトが違うときに
  レターボックス部へカメラ映像が残るのを塞ぎ、チャート単体表示を保証する。
- `セルフチェック: 座標変換` に、カメラ矩形をチャート空間へ逆変換して `Pt()` で戻すと
  元のカメラ矩形に一致することの検算を追加。

### Notes

- `bgColor` のアルファが 1 未満だと、どちらの塗り方でも下のカメラ映像が透ける。
- 本番カメラを潰さずに使うには、チャート専用カメラ（`Culling Mask` = Nothing）を立てる。
  README の「チャート単体で出す」を参照。

## [0.8.0] - 2026-08-12 (Unity: LED 回線チャート)

### Added

- `unity/LedChart.cs` を追加。LED ウォールの回線チャート（パネル割り・市松モジュール・
  モジュール境界線・対角線・センター円・スペックラベル・中央タイトル/解像度）を
  カメラに付けるだけで Game ビューへ直描きする `[ExecuteAlways]` コンポーネント。
  `LED_Line_Chart_Generator.html` の `draw()` を忠実移植したもの。
- パネルは `LedPanel`（名前 / 色 / X・Y・W・H / 横縦モジュール数（小数可）/ 実寸 mm）の
  リストで持つ。座標は HTML と同じ**チャート座標（左上原点・px）**なので入力値をそのまま移せる。
- `fitToScreen` でフィット表示とピクセル等倍を切り替え。どちらもチャートはビュー中央基準。
  座標変換は `Pt()` に集約。
- ContextMenu に `プリセット: 16:9 4K 1パネル` / `プリセット: 複数パネルの例` /
  `セルフチェック: 座標変換`（両モードで幅高さ・中心一致・Y 反転を検算し Console に出力）。
- Game ビュー内トグルパネル（表示 / 市松 / 境界線 / 対角線 / 円 / ラベル / 外枠 / 等倍）。
  `CompositionGuides` と同じ見た目・同じ隅配置。

### Changed

- README に `## Unity 版` の節を新設。従来 README に記載の無かった
  `unity/CompositionGuides.cs`（Unity 版 構図ガイド）の説明も併せて追記。

### Notes

- テキストは `OnGUI` 描画のため **Game ビュー専用**。`targetTexture` 出力には文字が乗らない。
- `GL.LINES` のため**線幅は 1px 固定**（HTML 版の `lineWidth = 2` は再現不可）。
- `CompositionGuides` と同一カメラに同居可能だが、描画順はイベント登録順に依存する。
- Unity 実機での動作確認は要・Yato 検証（構文チェックのみ実施済み）。

## [0.7.0] - 2026-08-11 (AE: 写真に合わせた人物サイズ合わせ)

### Added

- `src/ae/figure.jsx` を追加。`CG Figure Ref` ヌルに基準位置と基準スケールを記録し、イラストレイヤーの Scale をエクスプレッションで自動算出。
- 水平線からの垂直距離の比でスケールを決めるため、奥行きの入力は不要（1P は VP1 の水平線、2P / 3P は左右 VP を通る直線）。
- `身長比` スライダーで基準と違う身長のキャラに対応。
- 「アンカーを下端中央へ」「連動を解除」ボタンを追加。
- パネルに「人物」タブを追加。

### Notes

- 親子付けなし・2D レイヤー前提（Scale 式の循環参照回避のため `position` を使用）。
- アンカーが足元にある前提。
- After Effects 実機での動作確認は要・Yato 検証。

## [0.6.0] - 2026-08-11 (AE: パース VP のライブ調整)

### Added
- `src/ae/vpexpr.jsx` を追加し、パース VP を `CG VP1` / `CG VP-L` / `CG VP-R` /
  `CG VP3` ヌルとして管理
- VP ヌルのドラッグへ放射線・VP マーカー・水平線が即座に追従するライブ描画
- `perspective_live_vp` 設定と「VP をヌルで調整（ライブ）」UI
- 数値設定から VP ヌルを再配置する「VP をリセット」ボタン

### Changed
- 「生成 / 更新」で既存の VP ヌル位置を保持し、パース OFF・焼き込み描画・全消去時は
  不要な VP ヌルを掃除
- 2P / 3P の水平線は左右 VP を通る直線として追従

### Fixed
- パース線の角度範囲計算を修正（`src/draw/perspective.jsx` の `_raysFromVP`。**IL / AE 共通**）。
  JS の `%` が負の被除数で負値を返すため、`base` が ±π 近傍だと角度範囲が一周ぶん壊れていた。
  既定の 2P では右 VP がこれに該当し、本来 70.2° の扇が 337.3° になっていた
- VP が frame 中心ちょうどのとき早期 return してパース線が 1 本も出ない問題を修正
  （**IL / AE 共通**）。既定の 1P（`VP横=0.5` × `水平線高さ=0.5`）がこれに該当していた

### Notes
- ライブ描画は `createPath()` に依存するため After Effects CC 2018 (15.0) 以降が必要
- After Effects 実機での動作確認は要・Yato 検証

## [0.5.0] - 2026-06-24 (After Effects 版)

### Added
- After Effects 版（`src/ae/` + エントリ `src/CompositionGuides_AE.jsx`）
  - 基準フレーム = アクティブコンポ（`ae/frame.jsx`）。座標は IL 版と同一の y 上向き
    数学規約に統一し、描画エンジン（`draw/*`）を**無改変で再利用**
  - 出力 = ガイドレイヤー化したシェイプレイヤー（`ae/layer.jsx`）。AE のルーラー
    ガイドは H/V のみで斜線・円・螺旋・パースを描けないため、実パスを描画し
    `guideLayer=true` で最終レンダー除外（IL のネイティブガイドの等価物）
  - ドック可能 ScriptUI パネル（`ae/panel.jsx`）。CEP 不要。項目はタブ整理
  - 全ガイド（構図/絵画/領域/パース/枠）が IL 版と同一エンジンでそのまま出力
- `tools/ae-install.ps1`（`Scripts/ScriptUI Panels/` へコピー・管理者自己昇格）
- `build.ps1` が `dist/CompositionGuides_AE.jsx` も生成

### Changed
- `generate.jsx` をプラットフォーム中立化（`CG.frame.fromBase` / `CG.host.redraw`）。
  IL 側 `core/frame.jsx` に同名エイリアスを追加（IL の挙動は不変）

### Notes
- エンジン（state/generate/draw）は IL 版・AE 版で共有。差し替えは frame/layer/UI のみ
- AE 実機（2026）での動作確認は要・Yato 検証

## [0.4.0] - 2026-06-18 (CEP パネル化)

### Added
- CEP 拡張パネル（`cep/`）— 整列/文字パネルのようにドック可能な常駐 UI
  - `CSXS/manifest.xml`（CEP 12 / Illustrator ILST v26+）
  - `index.html` + `css/style.css`（Illustrator ダークUI 風）
  - `js/main.js`（スキーマ駆動で全ガイドのコントロールを描画・state 管理）
  - `__adobe_cep__.evalScript` で ExtendScript エンジンを呼び出し（CSInterface.js 不要）
- ホスト API `host.jsx`（`CGHost.generate/clear/artboards`、JSON は `eval` でパース）
- CEP 用エンジンエントリ `cep_engine.jsx`（UI/main を含まない）
- `build.ps1` が ScriptUI 版と CEP エンジンの両方を生成
- 開発ツール `tools/PlayerDebugMode.reg`・`tools/dev-install.ps1`（Junction インストール）

### Notes
- 描画エンジン(.jsx)は ScriptUI 版・CEP 版で共通。UI 層のみ載せ替え
- 次は Phase 4（プリセット保存/読込）を CEP パネル上に実装

## [0.3.0] - 2026-06-18 (Phase 3)

### Added
- パース線（`draw/perspective.jsx`）— パラメトリック消失点
  - 1点 / 2点 / 3点透視、水平線高さ・放射本数・VP位置（画面外可）可変
  - VP マーカー / 水平線の表示トグル
- 点空間 Liang-Barsky クリップ（`core/frame.jsx` の `clipLineRect`）
- ダイアログにパース線UIを追加

### Notes
- カメラが無いため VP はパラメトリック配置（水平線高さ + VP横位置/拡がり/垂直距離）
- 次は CEP パネル化（ドック可能 UI）。描画エンジンは完成、UI 層のみ載せ替え

## [0.2.0] - 2026-06-18 (Phase 2)

### Added
- パラメトリックガイド（`draw/guides.jsx`）
  - 黄金螺旋（Fibonacci, 4方向）/ 水平線(高さ) / 垂直線(位置)
  - 斜線(角度/本数/拡がり) / パターン(列×行) / 日の丸(同心円数)
- 領域ガイド
  - セーフエリア(Action/Title) / アスペクトマスク(1:1, 9:16, 16:9, 4:3, 21:9, カスタムWH)
- ダイアログに上記の数値入力・ドロップダウンUIを追加

### Notes
- ドック可能パネル（整列/文字/線/パスファインダー相当）は ScriptUI 不可と確認。
  Illustrator では CEP 拡張が必須。描画ロジック(.jsx)は CEP のエンジンとして再利用予定。

## [0.1.0] - 2026-06-18 (Phase 1)

### Added
- プロジェクト足場（`src/` モジュール構成 + `build.ps1` 配布結合）
- 基準フレーム = アクティブ/指定アートボード（`core/frame.jsx`）
- 専用レイヤー `Composition Guides` 管理とガイド生成プリミティブ（`core/guidelayer.jsx`）
  - 線分 / 連続線 / 楕円 / 矩形 → `pathItem.guides = true` でネイティブガイド化
- 基本構図ガイド（`draw/guides.jsx`）
  - 三分割 / 黄金比 / 対角線 / 中央十字 / 4分割 / 三角構図 / 黄金分割
  - 二分割(横/縦) / シンメトリー(横/縦/両方) / フレーム外周
- ScriptUI モーダルダイアログ（`ui/panel.jsx`）
  - 生成/更新・全消去・基準アートボード選択
- メインディスパッチャ（`generate.jsx`）

### Notes
- Illustrator UXP はサードパーティ非公開のため ExtendScript (.jsx) を採用
- 常駐パレットは BridgeTalk 依存で重いためモーダルダイアログ方式を採用
- ネイティブガイドは色・線幅が文書共通（個別配色は不可）
- JSON プリセットは Phase 4 で対応予定
