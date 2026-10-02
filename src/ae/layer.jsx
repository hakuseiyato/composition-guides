// Composition Guides — After Effects 版
// ae/layer.jsx — ガイド用シェイプレイヤー管理と描画プリミティブ
//
// AE のルーラーガイドは水平/垂直のみで斜線・円・螺旋・パースを表現できない。
// そこで "Composition Guides" という 1 枚のシェイプレイヤーを専用に作り、
// 各ガイドをパス（Vector Group）として描画する。レイヤーは guideLayer=true に
// するため最終レンダーには焼かれず、コンポ画面でのみ表示される（= IL のネイティブ
// ガイドの等価物）。毎回作り直す（= 再生成）。
//
// 座標: draw/* は y 上向きの数学座標で点を渡してくる。AE のレイヤー座標は y 下向き
// なので、パス頂点へ落とす直前に _flip() で y を反転する（frame.compH 基準）。

CG.layer = {};

CG.LAYER_NAME = "Composition Guides";

// 描画設定（必要なら state から差し替え可能にする余地を残す）
CG.STROKE_COLOR = [0.0, 1.0, 1.0];   // シアン (0..1 RGB)
CG.STROKE_WIDTH = 2.0;               // px

// 現在の生成対象を保持（プリミティブはここを参照する）
CG._cur = null;   // { comp, layer, contents, compH }

// matchName 定数
var _MN = {
    rootVectors: "ADBE Root Vectors Group",
    group: "ADBE Vector Group",
    groupContents: "ADBE Vectors Group",
    shape: "ADBE Vector Shape - Group",
    shapePath: "ADBE Vector Shape",
    ellipse: "ADBE Vector Shape - Ellipse",
    ellipseSize: "ADBE Vector Ellipse Size",
    ellipsePos: "ADBE Vector Ellipse Position",
    stroke: "ADBE Vector Graphic - Stroke",
    strokeColor: "ADBE Vector Stroke Color",
    strokeWidth: "ADBE Vector Stroke Width",
    transform: "ADBE Transform Group",
    anchor: "ADBE Anchor Point",
    position: "ADBE Position"
};

// 数学座標 [x, y]（y 上向き） → AE レイヤー座標 [x, y']（y 下向き）
function _flip(p) {
    return [p[0], CG._cur.compH - p[1]];
}

// 既存の Composition Guides レイヤーを返す（無ければ null）
CG.layer.find = function (comp) {
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === CG.LAYER_NAME) {
            return comp.layer(i);
        }
    }
    return null;
};

// レイヤーを消去（複数あれば全て削除）
CG.layer.clear = function (comp) {
    var removed = false;
    var lyr = CG.layer.find(comp);
    while (lyr) {
        lyr.locked = false;
        lyr.remove();
        removed = true;
        lyr = CG.layer.find(comp);
    }
    return removed;
};

// 専用シェイプレイヤーを作り直して返す（既存は削除）
CG.layer.recreate = function (comp) {
    CG.layer.clear(comp);
    var lyr = comp.layers.addShape();
    lyr.name = CG.LAYER_NAME;
    lyr.guideLayer = true;   // 最終レンダーに焼かれない

    // レイヤー空間＝コンポ空間に固定（アンカー/位置を原点へ）
    var tr = lyr.property(_MN.transform);
    tr.property(_MN.anchor).setValue([0, 0]);
    tr.property(_MN.position).setValue([0, 0]);

    var contents = lyr.property(_MN.rootVectors);

    CG._cur = {
        comp: comp,
        layer: lyr,
        contents: contents,
        compH: comp.height
    };
    return lyr;
};

// レイヤーをロックして仕上げる
CG.layer.finalize = function (lyr) {
    lyr.locked = true;
};

// --- 内部ヘルパ ---------------------------------------------------------

// 新しい Vector Group を作り、その contents を返す
function _newGroupContents() {
    var g = CG._cur.contents.addProperty(_MN.group);
    return g.property(_MN.groupContents);
}

// グループにストロークを追加（共通の色・幅）
function _addStroke(gc) {
    var st = gc.addProperty(_MN.stroke);
    st.property(_MN.strokeColor).setValue(CG.STROKE_COLOR);
    st.property(_MN.strokeWidth).setValue(CG.STROKE_WIDTH);
}

// 頂点配列（数学座標）からパスを追加。closed で閉路。
function _addPathFromMath(gc, mathPts, closed) {
    var verts = [];
    for (var i = 0; i < mathPts.length; i++) {
        verts.push(_flip(mathPts[i]));
    }
    var shapeProp = gc.addProperty(_MN.shape);
    var shape = new Shape();
    shape.vertices = verts;
    shape.closed = !!closed;
    shapeProp.property(_MN.shapePath).setValue(shape);
}

// --- ガイド生成プリミティブ（IL 版と同一シグネチャ） --------------------

// 1 本の線分ガイド。p0, p1 は数学座標 [x, y]
CG.layer.addLineGuide = function (lyr, p0, p1) {
    var gc = _newGroupContents();
    _addPathFromMath(gc, [p0, p1], false);
    _addStroke(gc);
    return gc;
};

// pts = [[x,y], ...] の連続線（オプションで閉じる）をガイド化
CG.layer.addPolylineGuide = function (lyr, pts, closed) {
    if (pts.length < 2) { return null; }
    var gc = _newGroupContents();
    _addPathFromMath(gc, pts, closed);
    _addStroke(gc);
    return gc;
};

// 中央 (cx,cy) 半径 (rx,ry) の楕円ガイド（数学座標）
CG.layer.addEllipseGuide = function (lyr, cx, cy, rx, ry) {
    var gc = _newGroupContents();
    var el = gc.addProperty(_MN.ellipse);
    el.property(_MN.ellipseSize).setValue([rx * 2.0, ry * 2.0]);
    el.property(_MN.ellipsePos).setValue(_flip([cx, cy]));
    _addStroke(gc);
    return gc;
};

// 矩形（4 隅 [bl, br, tr, tl]、数学座標）をガイド化
CG.layer.addRectGuide = function (lyr, bl, br, tr, tl) {
    return CG.layer.addPolylineGuide(lyr, [bl, br, tr, tl], true);
};

// --- live VP プリミティブ -----------------------------------------------

// AE バックエンドだけが定義し、共有 draw 側の分岐キーにする。
CG.layer.perspectiveLive = true;

CG.layer.addExprLineGuide = function (lyr, expr) {
    var gc = _newGroupContents();
    var shapeProp = gc.addProperty(_MN.shape);
    shapeProp.property(_MN.shapePath).expression = expr;
    _addStroke(gc);
    return gc;
};

CG.layer.ensureVP = function (frame, key, mathPt) {
    return CG.ae.vp.ensure(frame.comp, key, mathPt);
};

CG.layer.pruneVP = function (frame, keepNames) {
    CG.ae.vp.prune(frame.comp, keepNames);
};

CG.layer.clearVP = function (comp) {
    CG.ae.vp.clearAll(comp);
};

CG.layer.addRaysLive = function (lyr, nullName, n) {
    for (var i = 0; i < n; i++) {
        CG.layer.addExprLineGuide(lyr, CG.ae.vp.rayExpr(nullName, i, n));
    }
};

CG.layer.addVPMarkerLive = function (lyr, nullName) {
    CG.layer.addExprLineGuide(lyr, CG.ae.vp.markerExpr(nullName, 0));
    CG.layer.addExprLineGuide(lyr, CG.ae.vp.markerExpr(nullName, 1));
};

CG.layer.addHorizonLive = function (lyr, nameL, nameR) {
    var expr = nameR
        ? CG.ae.vp.horizon2Expr(nameL, nameR)
        : CG.ae.vp.horizon1Expr(nameL);
    CG.layer.addExprLineGuide(lyr, expr);
};
