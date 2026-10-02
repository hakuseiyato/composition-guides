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
#include "ae/vpexpr.jsx"
#include "ae/figure.jsx"
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
        CG.layer.clearVP(comp);
    } catch (e) {
        alert("消去に失敗しました / Clear failed:\n" + e);
    }
    app.endUndoGroup();
};

CG.run.resetVP = function (state) {
    var comp = CG.run._comp();
    if (!comp) {
        alert("アクティブなコンポがありません。\nNo active composition.");
        return;
    }
    app.beginUndoGroup("Composition Guides: VP をリセット");
    try {
        CG.layer.clearVP(comp);
        CG.generate(comp, state);
    } catch (e) {
        alert("VP のリセットに失敗しました / Reset VP failed:\n" + e);
    }
    app.endUndoGroup();
};

CG.run._selected = function (comp) {
    var sel = comp.selectedLayers;
    return (sel && sel.length > 0) ? sel : null;
};

CG.run.figureSetRef = function (state) {
    var comp = CG.run._comp();
    if (!comp) {
        alert("アクティブなコンポがありません。\nNo active composition.");
        return;
    }
    var sel = CG.run._selected(comp);
    if (!sel) {
        alert("基準にするレイヤーを 1 つ選択してください。\nSelect one layer to use as the size reference.");
        return;
    }
    app.beginUndoGroup("Composition Guides: 基準を設定");
    try {
        CG.ae.figure.setRef(comp, sel[0]);
    } catch (e) {
        alert("基準の設定に失敗しました / Set reference failed:\n" + e);
    }
    app.endUndoGroup();
};

CG.run.figureLink = function (state) {
    var comp = CG.run._comp();
    if (!comp) {
        alert("アクティブなコンポがありません。\nNo active composition.");
        return;
    }
    var sel = CG.run._selected(comp);
    if (!sel) {
        alert("スケール連動するレイヤーを選択してください。\nSelect layers to link scale.");
        return;
    }
    if (!CG.ae.figure.hasLayer(comp, CG.ae.figure.REF_NAME)) {
        alert("先に「選択レイヤーを基準にする」を実行してください。\nSet the size reference first.");
        return;
    }
    // 式が参照する VP ヌルが揃っているか、モードごとに確認する。
    var need = (state.perspective_mode === "1P")
        ? [CG.ae.vp.NAMES.P1]
        : [CG.ae.vp.NAMES.L, CG.ae.vp.NAMES.R];
    for (var i = 0; i < need.length; i++) {
        if (!CG.ae.figure.hasLayer(comp, need[i])) {
            alert("パース線を「VP をヌルで調整（ライブ）」で生成してから実行してください。\nGenerate perspective guides with live VP nulls first.");
            return;
        }
    }
    app.beginUndoGroup("Composition Guides: スケール連動");
    try {
        var n = CG.ae.figure.link(comp, sel, state.perspective_mode);
        if (n === 0) {
            alert("対象レイヤーがありません（VP / 基準ヌルは対象外）。\nNo target layers (VP / reference nulls are excluded).");
        }
    } catch (e) {
        alert("スケール連動に失敗しました / Link scale failed:\n" + e);
    }
    app.endUndoGroup();
};

CG.run.figureUnlink = function () {
    var comp = CG.run._comp();
    if (!comp) {
        alert("アクティブなコンポがありません。\nNo active composition.");
        return;
    }
    var sel = CG.run._selected(comp);
    if (!sel) {
        alert("連動を解除するレイヤーを選択してください。\nSelect layers to unlink.");
        return;
    }
    app.beginUndoGroup("Composition Guides: 連動を解除");
    try {
        CG.ae.figure.unlink(comp, sel);
    } catch (e) {
        alert("連動の解除に失敗しました / Unlink failed:\n" + e);
    }
    app.endUndoGroup();
};

CG.run.figureAnchorBottom = function () {
    var comp = CG.run._comp();
    if (!comp) {
        alert("アクティブなコンポがありません。\nNo active composition.");
        return;
    }
    var sel = CG.run._selected(comp);
    if (!sel) {
        alert("アンカーを移すレイヤーを選択してください。\nSelect layers to move the anchor point.");
        return;
    }
    app.beginUndoGroup("Composition Guides: アンカーを下端中央へ");
    try {
        CG.ae.figure.anchorToBottom(comp, sel);
    } catch (e) {
        alert("アンカーの移動に失敗しました / Move anchor failed:\n" + e);
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
