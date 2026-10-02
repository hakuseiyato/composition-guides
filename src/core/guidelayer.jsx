// Composition Guides for Illustrator
// core/guidelayer.jsx — ガイド用レイヤー管理とガイド生成プリミティブ
//
// "Composition Guides" レイヤーを専用に作り、毎回作り直す（= 再生成）。
// パスを生成したのち pathItem.guides = true でネイティブガイドに変換する。

CG.layer = {};

CG.LAYER_NAME = "Composition Guides";

// 既存の Composition Guides レイヤーを返す（無ければ null）
CG.layer.find = function (doc) {
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name === CG.LAYER_NAME) {
            return doc.layers[i];
        }
    }
    return null;
};

// レイヤーを消去（あれば削除）
CG.layer.clear = function (doc) {
    var lyr = CG.layer.find(doc);
    if (lyr) {
        lyr.locked = false;
        lyr.visible = true;
        lyr.remove();
        return true;
    }
    return false;
};

// 専用レイヤーを作り直して返す（既存は削除）
CG.layer.recreate = function (doc) {
    CG.layer.clear(doc);
    var lyr = doc.layers.add();
    lyr.name = CG.LAYER_NAME;
    return lyr;
};

// レイヤーをロックして仕上げる
CG.layer.finalize = function (lyr) {
    lyr.locked = true;
};

// --- ガイド生成プリミティブ ---------------------------------------------

// 1 本の線分ガイド。p0, p1 は [x, y]
CG.layer.addLineGuide = function (lyr, p0, p1) {
    if (CG.dedup && !CG.dedup.claim(CG.dedup.segKey(p0, p1))) { return null; }
    var item = lyr.pathItems.add();
    item.setEntirePath([[p0[0], p0[1]], [p1[0], p1[1]]]);
    item.guides = true;
    return item;
};

// pts = [[x,y], ...] の連続線（オプションで閉じる）をガイド化
CG.layer.addPolylineGuide = function (lyr, pts, closed) {
    if (pts.length < 2) { return null; }
    if (CG.dedup && !CG.dedup.claim(CG.dedup.ptsKey(pts, closed))) { return null; }
    var item = lyr.pathItems.add();
    item.setEntirePath(pts);
    if (closed) { item.closed = true; }
    item.guides = true;
    return item;
};

// 中央 (cx,cy) 半径 (rx,ry) の楕円ガイド
CG.layer.addEllipseGuide = function (lyr, cx, cy, rx, ry) {
    if (CG.dedup && !CG.dedup.claim(CG.dedup.ellipseKey(cx, cy, rx, ry))) { return null; }
    // ellipse(top, left, width, height): top は上端 y、left は左端 x
    var item = lyr.pathItems.ellipse(cy + ry, cx - rx, rx * 2.0, ry * 2.0);
    item.guides = true;
    return item;
};

// 矩形（4 辺）をガイド化。UV ではなく点で 4 隅 [bl, br, tr, tl]
CG.layer.addRectGuide = function (lyr, bl, br, tr, tl) {
    return CG.layer.addPolylineGuide(lyr, [
        [bl[0], bl[1]], [br[0], br[1]], [tr[0], tr[1]], [tl[0], tl[1]]
    ], true);
};
