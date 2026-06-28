// Composition Guides — After Effects 版
// ae/frame.jsx — コンポ基準フレームと座標変換
//
// 描画エンジン（draw/*）を無改変で再利用するため、frame は IL 版と同一規約とする:
//   - y は上向き（top > bottom）の「数学座標」
//   - UV: u は左→右 (0..1)、v は下→上 (0..1)
// AE のレイヤー座標は y 下向きなので、その変換は ae/layer.jsx 側で行う
//   （frame.compH を使って描画時に反転）。

CG.frame = {};

// プラットフォーム中立エントリ（generate.jsx から呼ばれる）。AE はアクティブコンポ基準。
// comp は CompItem。原点を左下に置く数学座標フレームを返す。
CG.frame.fromBase = function (comp, state) {
    var w = comp.width;
    var h = comp.height;
    return {
        index: 0,
        comp: comp,
        compH: h,          // AE 座標への y 反転に使う
        left: 0,
        bottom: 0,
        right: w,
        top: h,
        w: w,
        h: h
    };
};

// ホスト依存処理の中立化。AE はコンポが自動更新されるため no-op。
CG.host = CG.host || {};
CG.host.redraw = function () { /* AE: no explicit redraw needed */ };

// UV (u,v) → 数学座標 [x, y]（y 上向き）
CG.frame.uvToPoint = function (frame, u, v) {
    return [frame.left + u * frame.w, frame.bottom + v * frame.h];
};

// frame の AABB（数学座標）
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
