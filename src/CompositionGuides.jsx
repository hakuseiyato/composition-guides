// Composition Guides for Illustrator
// CompositionGuides.jsx — エントリポイント
//
// 使い方: Illustrator で File > Scripts > Other Script... から本ファイルを実行
//   （開発時はモジュールを #include で読み込む。配布時は build で単一ファイルに結合）
//
// 基準: アクティブアートボード / 出力: ネイティブガイド（専用レイヤー）

#target illustrator

// 名前空間（#include より前に宣言する必要がある）
var CG = {};

#include "state.jsx"
#include "core/frame.jsx"
#include "core/guidelayer.jsx"
#include "draw/guides.jsx"
#include "draw/perspective.jsx"
#include "generate.jsx"
#include "ui/panel.jsx"

// メイン
CG.main = function () {
    if (app.documents.length === 0) {
        alert("ドキュメントが開かれていません。\nNo document is open.");
        return;
    }
    var doc = app.activeDocument;
    var state = CG.defaults();

    // ダイアログを再表示しながら反復（閉じるまで）
    var loop = true;
    while (loop) {
        var res = CG.ui.show(doc, state);
        state = res.state;
        if (res.action === "generate") {
            try {
                CG.generate(doc, state);
            } catch (e) {
                alert("生成に失敗しました / Generate failed:\n" + e);
            }
        } else if (res.action === "clear") {
            CG.layer.clear(doc);
            app.redraw();
        } else {
            loop = false;
        }
    }
};

CG.main();
