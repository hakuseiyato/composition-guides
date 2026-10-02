// Composition Guides — Premiere Pro 版
// ppro_engine.jsx — Premiere CEP パネルのブラウザ側で動くエンジン（UI を含まない）
//
// Premiere にはシェイプ描画 API が無いため、描画エンジン（draw/*）をパネルの
// ブラウザ側で動かし、canvas へ描いて透過 PNG にする。build.ps1 が #include を
// 展開して cep_ppro/js/engine.js を生成する（ブラウザで読むので #target は書かない）。
//
// frame は ae/frame.jsx を再利用する: 数学座標（y 上向き）の frame とクリップ関数が
// 揃っており、doc は {width, height, canvas} を持つ擬似コンポとして渡せる
// （fromBase は width/height しか読まない。frame.comp を使うのは AE の VP だけ）。

var CG = {};

#include "state.jsx"
#include "ae/frame.jsx"
#include "ppro/layer.jsx"
#include "draw/guides.jsx"
#include "draw/perspective.jsx"
#include "generate.jsx"
