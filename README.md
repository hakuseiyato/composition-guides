# Composition Guides (Illustrator / After Effects / Premiere Pro)

Adobe Illustrator / After Effects / Premiere Pro 用 構図ガイド生成ツール。
Blender アドオン `composition_check` の構図ガイド群を移植したもの。

描画エンジン（構図ロジック）は全ホストで**共通**で、基準フレームと出力先・UI だけ
ホストごとに差し替える構成。Illustrator 版はこの README、After Effects 版は
[After Effects 版](#after-effects-版) の節を参照。
Premiere Pro 版は [Premiere Pro 版](#premiere-pro-版) の節を参照。

> [!TIP]
> **導入方法はソフト別に [INSTALL.md](INSTALL.md) にまとめてある**。Claude に「INSTALL.md を読んで導入して」と頼めば、そのまま導入まで進められる。
> 設計の概要は [doc/architecture.md](doc/architecture.md) を参照。

## 入手と導入

1. GitHub の [Releases](https://github.com/hakuseiyato/composition-guides/releases) から `composition-guides-v<バージョン>.zip` をダウンロードして展開する。
2. 展開したフォルダの `install.cmd` をダブルクリックし、導入するソフトを番号で選ぶ（Illustrator / After Effects / Premiere Pro / Unity）。

git・ビルド・Node.js・PowerShell 7 は要らない（Windows 標準の PowerShell 5.1 で動く）。
コマンドでの導入・判定・アンインストール・失敗時の対処は [INSTALL.md](INSTALL.md) を参照。

---

## Illustrator 版

基準フレームは**アクティブアートボード / 指定した 1 枚 / 全アートボード**から選べる。
そのフレームに対して三分割・黄金比・対角線などの構図ガイドを
**ネイティブガイド**（`View > Guides`）として専用レイヤーに生成する。

## 動作環境・前提

- Adobe Illustrator（ExtendScript 対応版。バージョン非依存で動作する想定）
- 実装基盤: ExtendScript (.jsx) + ScriptUI モーダルダイアログ
  - ※ Illustrator の UXP はサードパーティ非公開（2026 時点）のため UXP は不採用
  - ※ 常駐パレットは BridgeTalk が必要で実装が重いため、まずはダイアログ方式

## なぜネイティブガイドか

Illustrator はプラグインがリアルタイム GPU オーバーレイを描く API を持たない。
そのため Blender のライブ描画ではなく、**実パスを生成して `pathItem.guides = true` で
ネイティブガイドに変換**する方式を採る。これにより Illustrator 標準の操作
（ガイドの表示/非表示・ロック・消去）がそのまま効く。

- ガイドは `Composition Guides` という専用レイヤーに生成される
- 「生成 / 更新」のたびにこのレイヤーは作り直される（前回分は消える）
- ネイティブガイドの色・線幅は Illustrator 全体共通（個別配色は不可）
- 座標が一致するガイドは 1 本に畳まれる（`中央十字` と `水平線 0.5` / `垂直線 0.5`、
  `対角線` と `三角構図` / `黄金分割` の対角線、`三分割` と `パターン 3×3` など）
- ただし `フレーム外周` / `セーフエリア` / `アスペクトマスク` は**閉じた矩形パス 1 本**として
  生成されるため、**辺単位では畳まれない**。全アートボード生成で辺を共有するアートボードが
  並んでいると、共有辺には矩形ガイドが 2 本重なる（見た目は 1 本。パスが 2 つ）
- アートボードを**完全に重ならせて**配置している場合は、ガイド一式が 1 組に畳まれる

## 使い方

### 開発時（モジュール分割のまま実行）

1. Illustrator でドキュメントを開く
2. `File > Scripts > Other Script...` から `src/CompositionGuides.jsx` を実行
3. ダイアログで表示したいガイドにチェック → 「生成 / 更新」
   - 「基準アートボード」で「すべて / All artboards」を選ぶと、1 回の生成で
     全アートボードにガイドが載る（単一の `Composition Guides` レイヤーにまとまる）
4. 調整したい場合は再度開いて再生成。不要になったら「全消去」

`#include` は実行ファイルからの相対パスで解決されるため、`src/` 構成のまま実行できる。

### 配布時（単一ファイル）

```
pwsh -File build.ps1
```

`dist/CompositionGuides.jsx`（ScriptUI 版）と `cep/jsx/engine.jsx`（CEP エンジン）が生成される。

### CEP パネル版（ドック可能 UI・推奨）

整列/文字/線/パスファインダーのようにドックできる常駐パネル。Illustrator 2026 (v30) / CEP 12 対応。

開発インストール:

```
pwsh -File tools\dev-install.ps1     # PlayerDebugMode 有効化 + cep を実体コピー
pwsh -File tools\sync.ps1            # コード編集後の再同期（build + コピー）
```

`%APPDATA%\Adobe\CEP\extensions\com.yato.compositionguides` へ `cep/` を**実体コピー**する。
**Illustrator を再起動**し、`ウィンドウ > エクステンション > 構図ガイド Composition Guides` から開く。

> 注意点（ハマりどころ）:
> - **CEP は extensions 配下の Junction/シンボリックリンクを辿らない** → 実体コピー必須（編集後は `sync.ps1`）。
> - `manifest.xml` の `ExtensionManifest Version` は **6.0**（CEP 12 でも 12.0 等にすると無言で却下される）。
> - `<Menu>` 名に **`/`（スラッシュ）を入れない**（メニュー階層区切りと解釈され項目が非表示になる）。

- パネルでガイドにチェック →「生成 / 更新」で `Composition Guides` レイヤーにネイティブガイドを生成
- 「基準アートボード」で「すべて」を選べる（1 回の生成で全アートボードにガイドを載せる）
- 「全消去」でレイヤーごと削除
- UI(`cep/js/main.js`)は ExtendScript エンジン(`cep/jsx/engine.jsx` の `CGHost`)を
  `__adobe_cep__.evalScript` 経由で呼ぶ。エンジンは ScriptUI 版と同一ロジック。

## 実装済みガイド（Phase 1-3）

| 区分 | ガイド |
|------|--------|
| 構図 | 三分割 / 黄金比 / 対角線 / 中央十字 / 三角構図(TL→BR, TR→BL) / 黄金分割 / 黄金螺旋(4方向) |
| 絵画構図 | 水平線(高さ) / 垂直線(位置) / 斜線(角度/本数/拡がり) / パターン(列×行) / 日の丸(同心円) |
| 領域 | セーフエリア(Action/Title) / アスペクトマスク(1:1, 9:16, 16:9, 4:3, 21:9, カスタム) |
| パース | 1点/2点/3点透視（水平線高さ・VP位置・放射本数・VPマーカー・水平線。AE 版は VP をヌルでライブ調整可） |
| 枠 | フレーム外周 |

## 今後の予定

- Phase 4: プリセット JSON 保存/読込・既定プリセット・配布パッケージ
- CEP 化: 整列/文字/線/パスファインダーのようなドック可能パネル化（ScriptUI では不可のため CEP 拡張で実装。描画ロジックはエンジンとして再利用）

---

## After Effects 版

Illustrator 版と同じ構図ガイドを After Effects で生成する。

### なぜシェイプレイヤーか

After Effects のルーラーガイドは**水平/垂直線のみ**で、斜線・対角線・黄金螺旋・
同心円・パース線を表現できない。そのため `Composition Guides` という専用シェイプ
レイヤーを 1 枚作り、各ガイドを**実パス**として描画する。このレイヤーは
**ガイドレイヤー（`guideLayer = true`）**にするため最終レンダー/書き出しには
焼かれず、コンポ画面でのみ表示される（= Illustrator のネイティブガイドの等価物）。

- 基準フレームは**アクティブコンポ**（幅×高さ）
- 「生成 / 更新」のたびにこのレイヤーは作り直される（前回分は消える）
- レイヤーはロックされる。線の色・太さは `src/ae/layer.jsx` の `CG.STROKE_COLOR` /
  `CG.STROKE_WIDTH`（既定: シアン / 2px）

Illustrator と違い After Effects は **ScriptUI パネルをネイティブにドックできる**ため、
CEP は不要。

### インストール / 使い方

```
pwsh -File tools\ae-install.ps1
```

`build.ps1` を実行して `dist/CompositionGuides_AE.jsx` を生成し、AE の
`Support Files\Scripts\ScriptUI Panels\` へコピーする（Program Files 配下のため
管理者権限へ自動昇格）。**After Effects を再起動**し、`ウィンドウ` メニューの
`CompositionGuides_AE.jsx` からドック可能パネルを開く。

- 特定バージョン指定: `pwsh -File tools\ae-install.ps1 -AeRoot "C:\Program Files\Adobe\Adobe After Effects 2026"`
- 単体実行（ドックしない・フローティング）: `File > Scripts > Run Script File...` から
  `dist/CompositionGuides_AE.jsx`（開発時は `src/CompositionGuides_AE.jsx`）を実行

パネルでガイドにチェック →「生成 / 更新」でアクティブコンポにガイドレイヤーを生成、
「全消去」でレイヤーごと削除。生成/消去は Undo グループに包まれる。

### パース VP のライブ調整

パース線を生成すると、コンポに `CG VP1` / `CG VP-L` / `CG VP-R` / `CG VP3` の
ヌルが生成される。ヌルをドラッグすると、パース線が即座に追従する。

- 「生成 / 更新」では既存のヌル位置を保持する。`水平線高さ`・`VP横(1P)`・
  `拡がり(2P)`・`垂直VP(3P)` の数値は、ヌルの**初期配置のみ**に効く
- 数値から配置し直すには「VP をリセット」を押す
- 2P の左右 VP は独立して移動でき、水平線は左右 VP を通る直線として追従する
- **ヌルをリネームするとエクスプレッションが切れる**
- `createPath()` を使うため After Effects CC 2018 (15.0) 以降が必要
- 「VP をヌルで調整（ライブ）」を外すと、従来の焼き込み描画になる

### 写真に合わせた人物サイズ合わせ

**地面に立つ物体の画面上の高さは、水平線からの垂直距離に正比例する**。奥行き（カメラからの距離）は式から消えるため、奥行きの入力は不要です。

- ① イラストを写真の 1 箇所で目で合わせます。
- ② 「選択レイヤーを基準にする」で、`CG Figure Ref` ヌルに位置とスケールを記録します。
- ③ 「選択レイヤーをスケール連動」で Scale にエクスプレッションが入り、以後は上下移動だけでサイズが追従します。
- 2P モードでは、`CG VP-L` / `CG VP-R` を写真の平行線の収束点へドラッグすると、水平線＝アイレベルが確定します。
- `身長比` スライダーで基準と違う身長のキャラを扱えます。基準 170cm に対して子供 120cm なら、`120 / 170 ≒ 0.7` です。

注意点:

- **アンカーが足元にある前提**です。「アンカーを下端中央へ」で移せますが、絵に余白がある場合は手で足元へ合わせてください。
- **親子付けなし・2D レイヤー前提**です。Scale 式の循環参照を避けるため、`toComp()` ではなく `position` を使っています。
- 「全消去」で VP や基準ヌルが消えても、式を `try/catch` で包んでいるためスケールは直前値のまま壊れません。
- サイズは合っても、**イラストが描かれている俯瞰・煽りの角度は直りません**。

> 実装済みガイドは Illustrator 版と同一（描画エンジン共有）。

---

## Premiere Pro 版

Illustrator 版と同じ構図ガイドを Premiere Pro のシーケンスに重ねる（CEP パネル）。

### なぜ PNG オーバーレイか

Premiere Pro には**シェイプを描く ExtendScript API も、書き出されないガイドレイヤーも無い**。
ネイティブのガイドは水平/垂直線のみで、斜線・黄金螺旋・同心円・パース線を表現できない。
そのため、パネル内の canvas にガイドを描いて**透過 PNG**にし、それをクリップとして
シーケンスの最上段に重ねる。

### 仕組み

- 基準フレームは**アクティブシーケンス**のフレームサイズ（幅×高さ px）
- 「生成 / 更新」で、パネル内 canvas に描画エンジン（IL/AE と共通）で透過 PNG を描き、
  プロジェクトの `Composition Guides` ビンに `CG_<シーケンスID>.png` として読み込む
- 初回は**最上段の空ビデオトラック**にシーケンス全尺で配置する。2 回目以降は
  `changeMediaPath` で PNG を差し替える（配置済みクリップはそのまま）
- 尺は `シーケンス終端 − 開始 TC` で求める（01:00:00:00 開始でも黒尺が付かない）。
  再生成のたびに合わせ直すが、**伸ばす方向にしか追従しない**（ガイドが最長のクリップだと縮まない。
  縮めたいときは「全消去」→「生成 / 更新」）
- PNG はプロジェクトファイルと同階層の `Composition Guides/` フォルダに書き出す。
  未保存のプロジェクトでは `ドキュメント/Composition Guides/` に書き出す
- 「表示切替」でガイドクリップの有効/無効を切り替え、「全消去」でシーケンスから外す
  （ビンのアイテムと PNG は残る）

> [!WARNING]
> **ガイドは通常のクリップなので、そのままだと書き出しに焼き込まれる。**
> 書き出し前に必ず「表示切替」で無効化するか、「全消去」で外すこと。

- 配置には**最上段のビデオトラックが空いている**必要がある。埋まっている場合は、
  空のビデオトラックを最上段に追加してから「生成 / 更新」を押す

### インストール / 使い方

```
pwsh -File tools\dev-install.ps1 -Target ppro
```

PlayerDebugMode を有効化し、`cep_ppro/` を CEP extensions へコピーする。
コード編集後の再同期は `pwsh -File tools\sync.ps1 -Target ppro`。
**Premiere Pro を再起動**し、`ウィンドウ > エクステンション > 構図ガイド Composition Guides`
から開く。

### 制約

- パース VP のライブ調整（AE のヌル）と人物サイズ合わせは無い。パース線は焼き込み描画
- アナモルフィック（ピクセル縦横比 ≠ 1）のシーケンスは未考慮（横方向がずれる）
- CEP は Premiere Pro 25.6 以降 UXP に置き換えられ、2028-12 に既定で無効化される予定。
  将来は UXP への移行が必要

### スモークテスト

```
node tools\ppro-smoke.js
```

build 済みの `cep_ppro/js/engine.js` を node で読み込み、偽 canvas への描画で
次を検査する（事前に `pwsh -File build.ps1`）。

- 例外が出ないこと
- y 反転
- 楕円の中心と半径
- 矩形の閉路
- 線の設定
- 放射線の本数

`host.jsx`（Premiere API 側）は対象外。

> 実装済みガイドは Illustrator 版と同一（描画エンジン共有）。

---

## Unity 版

Unity 用は `unity/` 配下の 2 本の MonoBehaviour。どちらも**カメラにアタッチする**
`[ExecuteAlways]` コンポーネントで、`GL` による直描画のため Game ビューに
リアルタイム表示される（シーンにオブジェクトを生成しない）。

### Composition Guides（`unity/CompositionGuides.cs`）

IL / AE 版と同じ構図ガイド群（三分割・黄金比・対角線・中央十字・三角構図・黄金分割・
黄金螺旋・水平/垂直線・斜線・パターン・日の丸・セーフエリア・アスペクトマスク・
1〜3 点透視・フレーム外周）を、カメラの `pixelRect` を基準フレームとして
**`GL.LINES` で Game ビューに直描き**する。

- カメラに `Yato > Composition Guides` を追加するだけで動く（`[RequireComponent(typeof(Camera))]`）
- SRP（URP/HDRP）では `RenderPipelineManager.endCameraRendering`、ビルトインでは
  `Camera.onPostRender` に自動で切り替わる
- Game ビュー内に ON/OFF トグルパネルを表示する（`showPanel` / `panelCorner`）。
  `guidesVisible` で線ごと一括非表示
- 線色は `lineColor` 1 色（IL のネイティブガイドと違い自由に指定できる）

### LED 回線チャート（`unity/LedChart.cs`）

LED ウォールの回線チャート（パネル割り・モジュール数・実寸・解像度）を Game ビューに
描くコンポーネント。`LED_Line_Chart_Generator.html` の描画結果を Unity 上で再現し、
実際のカメラ画角・出力解像度に対して当たりを取るために使う。

- カメラに `Yato > LED Chart` を追加。`panels`（`LedPanel` のリスト）に
  パネル名・色・X/Y/W/H・横縦モジュール数（小数可）・実寸 mm を並べる
- パネル座標は**チャート座標（左上原点・px）**。HTML 版の入力値をそのまま移せる
- Inspector 項目
  - チャート全体: `chartWidth` / `chartHeight` / `fitToScreen` / `drawBackground` /
    `fillViewBackground` / `bgColor` / `lineColor` / `lineOpacity`
  - 表示要素: 市松 `showChecker` / 境界線 `showModGrid` / 対角線 `showDiag` /
    センター円 `showCircle` / スペックラベル `showLabel` / 外枠 `showPanelBorder`
  - 中央テキスト: `centerText` / `autoRes` / `resText`
  - ゲーム内パネル: `showPanel` / `panelCorner`、`chartVisible` で一括表示切替

#### `fitToScreen` の 2 モード

| モード | 挙動 |
|--------|------|
| `true`（フィット） | `chartWidth × chartHeight` がカメラ表示領域に収まるよう等方スケール |
| `false`（ピクセル等倍） | スケール 1.0。チャートは**ビュー中央**に配置される（左下寄せではない）。実解像度でのドット等倍確認用 |

どちらもチャートはビュー中央基準。座標変換は `Pt()` 1 箇所に集約している。

#### チャート単体で出す（カメラ映像を隠す）

`drawBackground` は既定でチャート矩形を `bgColor` で塗り潰すため、**`bgColor` が不透明ならカメラ映像は隠れる**（アルファが 1 未満だと下の映像が透ける）。

ただしチャートとカメラ表示領域のアスペクトが違うと、**レターボックス部分だけカメラ映像が残る**。これを塞ぐのが `fillViewBackground` で、ON にすると背景をチャート矩形ではなく**カメラ表示領域全体**へ広げる（チャートはその上に描かれる）。アスペクトが一致していれば ON / OFF で差は出ない。

本番カメラの絵を潰したくない場合は、チャート専用カメラを立ててそちらにアタッチする（`Culling Mask` を `Nothing`、HDRP なら `HD Additional Camera Data > Background Type` を `Color`、`Depth` を本番カメラより大きく）。

#### ContextMenu

コンポーネントのコンテキストメニューから実行する。

- `プリセット: 16:9 4K 1パネル` — 3840×2160 / 20×11.25 モジュールの全面 1 パネル
- `プリセット: 複数パネルの例` — 3420×2090 に 2 パネル
- `セルフチェック: 座標変換` — `Pt()` をフィット／等倍の両モードで検算し、
  変換後の幅高さ・中心一致・Y 反転を Console に出力する（失敗時は `LogError`）

#### 制限事項

- **テキストは `OnGUI` 描画のため Game ビュー専用**。カメラを `targetTexture` に
  流した場合、線と塗りは出るが文字は出ない
- **`GL.LINES` のため線幅は 1px 固定**。HTML 版の `lineWidth = 2` は再現できない
- `CompositionGuides` と同じカメラに同居できるが、**描画順はイベント登録順に依存**する
  （どちらが上に載るかは有効化の順序次第）

---

## ファイル構成

```
composition-guides/   ※ IL / AE / Premiere Pro / Unity 対応
├── src/
│   ├── state.jsx               設定 state + 既定値（共有）
│   ├── generate.jsx            メインディスパッチャ（共有・ホスト中立）
│   ├── draw/
│   │   ├── guides.jsx          構図/絵画/領域ガイド（共有）
│   │   └── perspective.jsx     パース線（共有）
│   ├── core/                   ── Illustrator バックエンド
│   │   ├── frame.jsx           アートボード取得・座標変換・クリップ（+中立エイリアス）
│   │   ├── dedup.jsx           座標が一致するガイドを 1 本に畳む重複除去
│   │   └── guidelayer.jsx      専用レイヤー管理・ネイティブガイド生成
│   ├── ui/panel.jsx            IL ScriptUI モーダルダイアログ
│   ├── ae/                     ── After Effects バックエンド
│   │   ├── frame.jsx           コンポ基準フレーム（y 上向き数学座標）+ host 中立化
│   │   ├── layer.jsx           ガイドレイヤー化シェイプ出力（描画時 y 反転）
│   │   ├── vpexpr.jsx          パース VP ヌル管理・ライブ描画エクスプレッション
│   │   ├── figure.jsx          人物サイズ合わせ（基準ヌル・Scale 連動式）
│   │   └── panel.jsx           AE ドック可能 ScriptUI パネル（タブ構成）
│   ├── ppro/                   ── Premiere Pro バックエンド
│   │   ├── layer.jsx           canvas 描画（描画時 y 反転。frame は ae/frame.jsx を再利用）
│   │   └── host.jsx            Premiere ExtendScript（PNG の読込・差し替え・全尺配置）
│   ├── ppro_engine.jsx             Premiere CEP 版エンジンのエントリ（ブラウザ側で実行）
│   ├── CompositionGuides.jsx       IL ScriptUI 版エントリ
│   ├── cep_engine.jsx              IL CEP 版エントリ（UI/main なし）
│   ├── host.jsx                    IL CEP ホスト API
│   └── CompositionGuides_AE.jsx    AE 版エントリ（#include + run + パネル）
├── cep/                        IL CEP パネル（ドック可能 UI）
│   ├── CSXS/manifest.xml
│   ├── index.html / css/style.css / js/main.js
│   ├── js/ui.js                IL / Premiere 共通 UI（CGUI。Premiere 側へは build でコピー）
│   ├── jsx/engine.jsx          エンジン（build で生成）
│   └── .debug                  リモートデバッグ用
├── cep_ppro/                   Premiere CEP パネル（ドック可能 UI）
│   ├── CSXS/manifest.xml / .debug / index.html / js/main.js
│   ├── js/engine.js            エンジン（build で生成）
│   ├── jsx/host.jsx            ホスト API（build で生成）
│   └── js/ui.js / css/style.css  cep/ からのコピー（build で生成）
├── tools/
│   ├── PlayerDebugMode.reg     署名なし拡張の許可（CEP 開発用）
│   ├── dev-install.ps1         CEP インストール（-Target il / ppro）
│   ├── sync.ps1                CEP 再同期（-Target il / ppro）
│   ├── ppro-smoke.js           Premiere 版エンジンのスモークテスト（node）
│   ├── package.ps1             配布 ZIP の作成（release/ へ出力）
│   └── ae-install.ps1          AE ScriptUI Panels インストール（書き込めないときだけ管理者昇格）
├── install.cmd / install.ps1   導入の入口（-Target il,ae,ppro,unity / -Uninstall。引数なしで対話）
├── build.ps1                   dist（IL/AE）・cep/jsx/engine.jsx・cep_ppro の生成物を生成
├── dist/
│   ├── CompositionGuides.jsx       IL ScriptUI 版 配布物（build で生成）
│   └── CompositionGuides_AE.jsx    AE 版 配布物（build で生成）
├── unity/                      ── Unity バックエンド（カメラに付ける MonoBehaviour）
│   ├── CompositionGuides.cs    構図ガイドを GL.LINES で Game ビューに直描き
│   └── LedChart.cs             LED 回線チャート（パネル割り・市松・スペック表示）
├── doc/architecture.md         構成・設計の概要
├── INSTALL.md                  ソフト別の導入手順（Claude が読んで実行できる形式）
├── CLAUDE.md                   Claude 向けの案内（導入時は INSTALL.md に従う）
├── CHANGELOG.md
└── README.md
```

## ライセンス

なし（All rights reserved）。社内・知人向けに配布している。無断での再配布はしない。
