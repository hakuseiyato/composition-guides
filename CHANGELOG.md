# Changelog

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
