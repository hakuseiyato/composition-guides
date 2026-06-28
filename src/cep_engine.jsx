// Composition Guides for Illustrator
// cep_engine.jsx — CEP 用エンジンエントリ（UI/main を含まない）
//
// CEP の manifest <ScriptPath> から読み込まれ、CG と CGHost を定義するだけ。
// ダイアログ表示や自動実行は行わない。build.ps1 が #include を展開して
// cep/jsx/engine.jsx を生成する。

#target illustrator

var CG = {};

#include "state.jsx"
#include "core/frame.jsx"
#include "core/guidelayer.jsx"
#include "draw/guides.jsx"
#include "draw/perspective.jsx"
#include "generate.jsx"
#include "host.jsx"
