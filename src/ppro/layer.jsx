// Composition Guides — Premiere Pro 版
// ppro/layer.jsx — canvas バックエンド（描画プリミティブ）
//
// Premiere にはシェイプ描画 API とガイドレイヤーが無い。そこでパネル内の
// canvas（シーケンスのフレームサイズ px）へ各ガイドをストロークし、
// 透過 PNG として書き出してから host.jsx がシーケンスへ配置する。
//
// 座標: draw/* は y 上向きの数学座標で点を渡してくる。canvas は y 下向き
// なので、描く直前に _pproFlip() で y を反転する（AE の _flip と同規約）。
//
// perspectiveLive / pruneVP / ensureVP / clearVP / dedup は定義しない:
//   - Premiere にはエクスプレッションもヌルも無いので、パース線は焼き込み描画にする
//     （draw/perspective.jsx と generate.jsx は未定義なら焼き込み経路になる）。
//   - canvas は同じ線を重ね描きしても見た目が変わらないので dedup は不要。

CG.layer = {};

CG.LAYER_NAME = "Composition Guides";

// 描画設定（AE 版と同値）
CG.STROKE_COLOR = [0.0, 1.0, 1.0];   // シアン (0..1 RGB)
CG.STROKE_WIDTH = 2.0;               // px

// 現在の生成対象を保持（プリミティブはここを参照する）
CG._cur = null;   // { ctx, h }

// 数学座標 [x, y]（y 上向き） → canvas 座標 [x, y']（y 下向き）
function _pproFlip(p) {
    return [p[0], CG._cur.h - p[1]];
}

// 0..1 RGB → "rgb(r,g,b)"
function _pproRgb(c) {
    return "rgb(" + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + ")";
}

// doc = { width, height, canvas }。canvas をフレームサイズにしてクリアし、描画設定を行う。
// 戻り値の doc をレイヤートークンとして各プリミティブへ渡す。
CG.layer.recreate = function (doc) {
    var canvas = doc.canvas;
    canvas.width = doc.width;     // サイズ代入でクリアされる
    canvas.height = doc.height;
    var ctx = canvas.getContext("2d");
    ctx.strokeStyle = _pproRgb(CG.STROKE_COLOR);
    ctx.lineWidth = CG.STROKE_WIDTH;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    CG._cur = { ctx: ctx, h: doc.height };
    return doc;
};

// canvas は描いた時点で確定するので仕上げ処理は無い
CG.layer.finalize = function (lyr) {};

// --- ガイド生成プリミティブ（IL/AE 版と同一シグネチャ） -----------------

// 1 本の線分ガイド。p0, p1 は数学座標 [x, y]
CG.layer.addLineGuide = function (lyr, p0, p1) {
    return CG.layer.addPolylineGuide(lyr, [p0, p1], false);
};

// pts = [[x,y], ...] の連続線（オプションで閉じる）をガイド化
CG.layer.addPolylineGuide = function (lyr, pts, closed) {
    if (pts.length < 2) { return null; }
    var ctx = CG._cur.ctx;
    ctx.beginPath();
    var p = _pproFlip(pts[0]);
    ctx.moveTo(p[0], p[1]);
    for (var i = 1; i < pts.length; i++) {
        p = _pproFlip(pts[i]);
        ctx.lineTo(p[0], p[1]);
    }
    if (closed) { ctx.closePath(); }
    ctx.stroke();
    return lyr;
};

// 中央 (cx,cy) 半径 (rx,ry) の楕円ガイド（数学座標）
CG.layer.addEllipseGuide = function (lyr, cx, cy, rx, ry) {
    var ctx = CG._cur.ctx;
    ctx.beginPath();
    ctx.ellipse(cx, CG._cur.h - cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.stroke();
    return lyr;
};

// 矩形（4 隅 [bl, br, tr, tl]、数学座標）をガイド化
CG.layer.addRectGuide = function (lyr, bl, br, tr, tl) {
    return CG.layer.addPolylineGuide(lyr, [bl, br, tr, tl], true);
};
