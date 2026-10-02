# アーキテクチャ

## 概要

構図ガイド（三分割・黄金比・対角線・黄金螺旋・パース線など）を、複数の制作ソフトに表示するツール群。

設計の中心は次の 2 点にある。

- **描画エンジンは全 Adobe ホストで 1 つを共有する**。エンジンは ES3 で書かれ、`src/state.jsx` `src/draw/*` `src/generate.jsx` からなる。
- ホストごとに差し替えるのは 2 つだけ。基準フレームの取得（`CG.frame`）と、描画プリミティブ（`CG.layer`）。

| ホスト | 基準フレーム | 出力先 | UI |
|---|---|---|---|
| Illustrator | アートボード（1 枚 / 全部） | ネイティブガイド（`pathItem.guides = true`） | CEP パネル / ScriptUI ダイアログ |
| After Effects | アクティブコンポ | ガイドレイヤー化したシェイプレイヤー（パース VP はヌル + エクスプレッションでライブ調整） | ScriptUI ドックパネル |
| Premiere Pro | アクティブシーケンス | canvas に描いた透過 PNG を最上段トラックへ配置 | CEP パネル |
| Unity | カメラの `pixelRect` | `GL.LINES` で直接描画（C# への移植版） | Game ビュー内トグル |

## 技術スタック

- ExtendScript（ES3）: Illustrator / After Effects / Premiere Pro のホスト側
- CEP（HTML + JS、Chromium）: Illustrator / Premiere Pro のパネル。`ExtensionManifest Version="6.0"`、CSXS 9.0 以降
- C#（UnityEngine のみ）: Unity 版
- PowerShell 7: ビルドと導入スクリプト
- Node.js: スモークテストのみ（任意）

外部ライブラリへの依存は無い。CEP では `CSInterface.js` を使わず、`window.__adobe_cep__` と `window.cep.fs` を直接使っている。

## 描画エンジンの規約

- 座標は **y 上向きの数学座標**で、UV は u が左→右、v が下→上（0..1）。y 下向きのホスト（AE / Premiere の canvas）は、描画の直前に `h - y` で反転する。
- ホスト依存の機能は存在チェックで分岐させる。たとえば `CG.layer.perspectiveLive` / `pruneVP` を定義しているのは AE だけで、他ホストではパース線が焼き込みの経路になる。
- 重複除去 `src/core/dedup.jsx` を使うのは Illustrator だけ（全アートボード生成で座標が重なるため）。

## ディレクトリ構成

```
src/
  state.jsx               設定と既定値（CG.defaults）
  generate.jsx            ディスパッチャ（CG.generate）
  draw/guides.jsx         構図・絵画・領域ガイド（共有）
  draw/perspective.jsx    パース線（共有）
  core/                   Illustrator バックエンド（frame / dedup / guidelayer）
  ui/panel.jsx            Illustrator ScriptUI ダイアログ
  ae/                     After Effects バックエンド（frame / layer / vpexpr / figure / panel）
  ppro/                   Premiere Pro バックエンド（layer = canvas、host = ExtendScript）
  CompositionGuides.jsx   エントリ: IL ScriptUI
  cep_engine.jsx + host.jsx  エントリ: IL CEP エンジン
  CompositionGuides_AE.jsx   エントリ: AE
  ppro_engine.jsx         エントリ: Premiere のブラウザ側エンジン
cep/                      IL CEP パネル（js/ui.js は IL / Premiere 共通の UI）
cep_ppro/                 Premiere CEP パネル
dist/                     IL ScriptUI / AE の配布物（生成物）
unity/                    Unity 用 MonoBehaviour（CompositionGuides.cs / LedChart.cs）
tools/                    導入・同期スクリプト、スモークテスト
```

## ビルドと実行

- **ビルド**: `pwsh -NoProfile -File build.ps1`
  - `#include "x"` をインライン展開し、`dist/*.jsx`、`cep/jsx/engine.jsx`、`cep_ppro/js/engine.js`、`cep_ppro/jsx/host.jsx` を生成する。
  - あわせて共通 UI（`ui.js`）と CSS を `cep_ppro/` へコピーする。
- **導入**: [INSTALL.md](../INSTALL.md)
- **テスト**: `node tools\ppro-smoke.js`
  - Premiere 版のエンジンを、偽の canvas に描かせて検査する。
  - 確認する項目は、座標・y 反転・楕円・閉路・線の設定・放射線の本数。
  - 各ホスト上での動作は手動で確認する。

## 確認が必要な点

- Unity 版の動作確認済みバージョン
- Premiere Pro 版の、実機での API の挙動（`trackItem.end` の代入、静止画への `changeMediaPath`）
