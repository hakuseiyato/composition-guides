// Composition Guides for Illustrator
// core/frame.jsx — アートボード基準フレームと座標変換
//
// frame = { left, top, right, bottom, w, h }
//   Illustrator 座標は y 上向き（top > bottom）。アートボードは常に軸並行矩形。
//   UV: u は左→右 (0..1)、v は下→上 (0..1)。Blender の UV と揃える。

CG.frame = {};

// プラットフォーム中立エントリ（generate.jsx から呼ばれる）。IL はアートボード基準。
CG.frame.fromBase = function (doc, state) {
    return CG.frame.fromArtboard(doc, state.artboard_index);
};

// ホスト依存処理の中立化（IL は app.redraw）。
CG.host = CG.host || {};
CG.host.redraw = function () { app.redraw(); };

// アクティブ（または index 指定）アートボードの矩形を frame として返す
CG.frame.fromArtboard = function (doc, index) {
    var abs = doc.artboards;
    var i = index;
    if (i === undefined || i === null || i < 0 || i >= abs.length) {
        i = abs.getActiveArtboardIndex();
    }
    var rect = abs[i].artboardRect; // [left, top, right, bottom]
    var left = rect[0], top = rect[1], right = rect[2], bottom = rect[3];
    return {
        index: i,
        left: left,
        top: top,
        right: right,
        bottom: bottom,
        w: right - left,
        h: top - bottom
    };
};

// UV (u,v) → ドキュメント座標 [x, y]
CG.frame.uvToPoint = function (frame, u, v) {
    return [frame.left + u * frame.w, frame.bottom + v * frame.h];
};

// frame の AABB（UV→点で 4 隅）を返す
CG.frame.aabb = function (frame) {
    return {
        x_min: frame.left,
        y_min: frame.bottom,
        x_max: frame.right,
        y_max: frame.top
    };
};

// UV 矩形 [0,1]x[0,1] へ線分をクリップ（Liang-Barsky）
// 戻り値: [u0, v0, u1, v1] or null
CG.frame.clipLineUV = function (x0, y0, x1, y1) {
    var p = [-(x1 - x0), (x1 - x0), -(y1 - y0), (y1 - y0)];
    var q = [x0, 1.0 - x0, y0, 1.0 - y0];
    var u1 = 0.0, u2 = 1.0;
    for (var i = 0; i < 4; i++) {
        if (p[i] === 0.0) {
            if (q[i] < 0.0) { return null; }
        } else {
            var t = q[i] / p[i];
            if (p[i] < 0.0) {
                if (t > u2) { return null; }
                if (t > u1) { u1 = t; }
            } else {
                if (t < u1) { return null; }
                if (t < u2) { u2 = t; }
            }
        }
    }
    return [
        x0 + u1 * (x1 - x0),
        y0 + u1 * (y1 - y0),
        x0 + u2 * (x1 - x0),
        y0 + u2 * (y1 - y0)
    ];
};

// 線分 p0-p1 を矩形 [xmin,ymin,xmax,ymax] へクリップ（Liang-Barsky, 点空間）
// 戻り値: [x0, y0, x1, y1] or null
CG.frame.clipLineRect = function (p0, p1, xmin, ymin, xmax, ymax) {
    var x0 = p0[0], y0 = p0[1], x1 = p1[0], y1 = p1[1];
    var dx = x1 - x0, dy = y1 - y0;
    var p = [-dx, dx, -dy, dy];
    var q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
    var u1 = 0.0, u2 = 1.0;
    for (var i = 0; i < 4; i++) {
        if (Math.abs(p[i]) < 1e-12) {
            if (q[i] < 0) { return null; }
        } else {
            var t = q[i] / p[i];
            if (p[i] < 0) {
                if (t > u2) { return null; }
                if (t > u1) { u1 = t; }
            } else {
                if (t < u1) { return null; }
                if (t < u2) { u2 = t; }
            }
        }
    }
    if (u1 > u2) { return null; }
    return [x0 + u1 * dx, y0 + u1 * dy, x0 + u2 * dx, y0 + u2 * dy];
};

// 点 p から直線 a-b への垂足（perpendicular foot）。a,b,p は [x,y]
CG.frame.foot = function (p, a, b) {
    var abx = b[0] - a[0];
    var aby = b[1] - a[1];
    var denom = abx * abx + aby * aby;
    if (denom < 1e-9) { return [a[0], a[1]]; }
    var t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / denom;
    return [a[0] + t * abx, a[1] + t * aby];
};
