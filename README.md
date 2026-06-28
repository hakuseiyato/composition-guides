# Composition Guides (Illustrator / After Effects)

Adobe Illustrator / After Effects 用 構図ガイド生成ツール。
Blender アドオン `composition_check` の構図ガイド群を移植したもの。

描画エンジン（構図ロジック）は両ホストで**共通**で、基準フレームと出力先・UI だけ
ホストごとに差し替える構成。Illustrator 版はこの README、After Effects 版は
[After Effects 版](#after-effects-版) の節を参照。

---

## Illustrator 版

アクティブアートボードを基準フレームとして、三分割・黄金比・対角線などの構図ガイドを
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

## 使い方

### 開発時（モジュール分割のまま実行）

1. Illustrator でドキュメントを開く
2. `File > Scripts > Other Script...` から `src/CompositionGuides.jsx` を実行
3. ダイアログで表示したいガイドにチェック → 「生成 / 更新」
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
- 「全消去」でレイヤーごと削除
- UI(`cep/js/main.js`)は ExtendScript エンジン(`cep/jsx/engine.jsx` の `CGHost`)を
  `__adobe_cep__.evalScript` 経由で呼ぶ。エンジンは ScriptUI 版と同一ロジック。

## 実装済みガイド（Phase 1-3）

| 区分 | ガイド |
|------|--------|
| 構図 | 三分割 / 黄金比 / 対角線 / 中央十字 / 4分割 / 三角構図(TL→BR, TR→BL) / 黄金分割 / 黄金螺旋(4方向) |
| 絵画構図 | 二分割(横/縦) / シンメトリー(横/縦/両方) / 水平線(高さ) / 垂直線(位置) / 斜線(角度/本数/拡がり) / パターン(列×行) / 日の丸(同心円) |
| 領域 | セーフエリア(Action/Title) / アスペクトマスク(1:1, 9:16, 16:9, 4:3, 21:9, カスタム) |
| パース | 1点/2点/3点透視（水平線高さ・VP位置・放射本数・VPマーカー・水平線） |
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

> 実装済みガイドは Illustrator 版と同一（描画エンジン共有）。

---

## ファイル構成

```
yato-illustrator-composition-guides/   ※ IL / AE 両対応（リポジトリ名は据え置き）
├── src/
│   ├── state.jsx               設定 state + 既定値（共有）
│   ├── generate.jsx            メインディスパッチャ（共有・ホスト中立）
│   ├── draw/
│   │   ├── guides.jsx          構図/絵画/領域ガイド（共有）
│   │   └── perspective.jsx     パース線（共有）
│   ├── core/                   ── Illustrator バックエンド
│   │   ├── frame.jsx           アートボード取得・座標変換・クリップ（+中立エイリアス）
│   │   └── guidelayer.jsx      専用レイヤー管理・ネイティブガイド生成
│   ├── ui/panel.jsx            IL ScriptUI モーダルダイアログ
│   ├── ae/                     ── After Effects バックエンド
│   │   ├── frame.jsx           コンポ基準フレーム（y 上向き数学座標）+ host 中立化
│   │   ├── layer.jsx           ガイドレイヤー化シェイプ出力（描画時 y 反転）
│   │   └── panel.jsx           AE ドック可能 ScriptUI パネル（タブ構成）
│   ├── CompositionGuides.jsx       IL ScriptUI 版エントリ
│   ├── cep_engine.jsx              IL CEP 版エントリ（UI/main なし）
│   ├── host.jsx                    IL CEP ホスト API
│   └── CompositionGuides_AE.jsx    AE 版エントリ（#include + run + パネル）
├── cep/                        IL CEP パネル（ドック可能 UI）
│   ├── CSXS/manifest.xml
│   ├── index.html / css/style.css / js/main.js
│   ├── jsx/engine.jsx          エンジン（build で生成）
│   └── .debug                  リモートデバッグ用
├── tools/
│   ├── PlayerDebugMode.reg     署名なし拡張の許可（IL CEP 開発用）
│   ├── dev-install.ps1         IL CEP インストール
│   └── ae-install.ps1          AE ScriptUI Panels インストール（管理者昇格）
├── build.ps1                   dist（IL/AE）と cep/jsx/engine.jsx を生成
├── dist/
│   ├── CompositionGuides.jsx       IL ScriptUI 版 配布物（build で生成）
│   └── CompositionGuides_AE.jsx    AE 版 配布物（build で生成）
├── CHANGELOG.md
└── README.md
```
