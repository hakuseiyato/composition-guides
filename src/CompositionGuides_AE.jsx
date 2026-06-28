// Composition Guides — After Effects 版
// CompositionGuides_AE.jsx — エントリポイント（ドック可能 ScriptUI パネル）
//
// 使い方:
//   ・ドック運用（推奨）: build した単一ファイルを AE の
//       <AE>/Scripts/ScriptUI Panels/ に置き、AE 再起動 →「ウィンドウ」メニューから開く
//   ・単体実行: File > Scripts > Run Script File... から実行（フローティングパレット）
//
// 基準: アクティブコンポ / 出力: ガイドレイヤー化したシェイプレイヤー
//   （開発時はモジュールを #include で読み込む。配布時は build で単一ファイルに結合）

#target aftereffects

// 名前空間（#include より前に宣言する必要がある）
var CG = {};

#include "state.jsx"
#include "ae/frame.jsx"
#include "ae/layer.jsx"
#include "draw/guides.jsx"
#include "draw/perspective.jsx"
#include "generate.jsx"
#include "ae/panel.jsx"

// --- 実行ハンドラ（パネルのボタンから呼ばれる） -------------------------
CG.run = {};

CG.run._comp = function () {
    var item = (app.project) ? app.project.activeItem : null;
    return (item && item instanceof CompItem) ? item : null;
};

CG.run.generate = function (state) {
    var comp = CG.run._comp();
    if (!comp) {
        alert("アクティブなコンポがありません。\nNo active composition.");
        return;
    }
    app.beginUndoGroup("Composition Guides: 生成 / 更新");
    try {
        CG.generate(comp, state);
    } catch (e) {
        alert("生成に失敗しました / Generate failed:\n" + e);
    }
    app.endUndoGroup();
};

CG.run.clear = function () {
    var comp = CG.run._comp();
    if (!comp) {
        alert("アクティブなコンポがありません。\nNo active composition.");
        return;
    }
    app.beginUndoGroup("Composition Guides: 全消去");
    try {
        CG.layer.clear(comp);
    } catch (e) {
        alert("消去に失敗しました / Clear failed:\n" + e);
    }
    app.endUndoGroup();
};

// --- パネル構築 ---------------------------------------------------------
(function (thisObj) {
    var state = CG.defaults();
    var ui = CG.ui.build(thisObj, state);
    if (ui instanceof Window) {
        ui.center();
        ui.show();
    }
})(this);
