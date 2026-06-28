// Composition Guides for Illustrator
// draw/guides.jsx — 構図ガイド描画（Blender guides.py 移植）
//
// 各関数は ctx = { frame, layer } を受け取り、ガイドをレイヤーに追加する。
// 座標は CG.frame.uvToPoint で UV → 点へ変換。

CG.guides = {};

// 内部ショートカット
function _uv(frame, u, v) { return CG.frame.uvToPoint(frame, u, v); }
function _line(lyr, frame, u0, v0, u1, v1) {
    CG.layer.addLineGuide(lyr, _uv(frame, u0, v0), _uv(frame, u1, v1));
}

// --- 三分割 / Rule of Thirds ---------------------------------------------
CG.guides.thirds = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var us = [1.0 / 3.0, 2.0 / 3.0];
    for (var i = 0; i < us.length; i++) {
        _line(l, f, us[i], 0.0, us[i], 1.0);
        _line(l, f, 0.0, us[i], 1.0, us[i]);
    }
};

// --- 黄金比 / Golden Ratio (Phi grid) ------------------------------------
CG.guides.golden = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var us = [CG.PHI_SHORT, CG.PHI_LONG];
    for (var i = 0; i < us.length; i++) {
        _line(l, f, us[i], 0.0, us[i], 1.0);
        _line(l, f, 0.0, us[i], 1.0, us[i]);
    }
};

// --- 対角線 / Diagonal (X cross) -----------------------------------------
CG.guides.diagonal = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    _line(l, f, 0.0, 0.0, 1.0, 1.0);
    _line(l, f, 1.0, 0.0, 0.0, 1.0);
};

// --- 中央十字 / Center Cross ---------------------------------------------
CG.guides.center = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    _line(l, f, 0.5, 0.0, 0.5, 1.0);
    _line(l, f, 0.0, 0.5, 1.0, 0.5);
};

// --- 4 分割 / Quad（意味的に別だが線は中央十字と同等） -------------------
CG.guides.quad = function (ctx) {
    CG.guides.center(ctx);
};

// --- 三角構図 / Golden Triangle (Dynamic Symmetry) -----------------------
// 対角線 1 本 + 反対 2 隅からその対角線への垂線 2 本
CG.guides.triangle = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var bl = _uv(f, 0.0, 0.0), br = _uv(f, 1.0, 0.0);
    var tr = _uv(f, 1.0, 1.0), tl = _uv(f, 0.0, 1.0);
    var a, b, c1, c2;
    if (ctx.state.triangle_orientation === "TL_BR") {
        a = tl; b = br; c1 = tr; c2 = bl;
    } else {
        a = tr; b = bl; c1 = tl; c2 = br;
    }
    CG.layer.addLineGuide(l, a, b);
    CG.layer.addLineGuide(l, c1, CG.frame.foot(c1, a, b));
    CG.layer.addLineGuide(l, c2, CG.frame.foot(c2, a, b));
};

// --- 黄金分割 / Golden Section (Armature of Rectangle) -------------------
// 両対角線 + 各対角線への垂線（反対 2 隅から）
CG.guides.golden_section = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var bl = _uv(f, 0.0, 0.0), br = _uv(f, 1.0, 0.0);
    var tr = _uv(f, 1.0, 1.0), tl = _uv(f, 0.0, 1.0);
    CG.layer.addLineGuide(l, tl, br);                 // diag 1
    CG.layer.addLineGuide(l, tr, bl);                 // diag 2
    CG.layer.addLineGuide(l, tr, CG.frame.foot(tr, tl, br));
    CG.layer.addLineGuide(l, bl, CG.frame.foot(bl, tl, br));
    CG.layer.addLineGuide(l, tl, CG.frame.foot(tl, tr, bl));
    CG.layer.addLineGuide(l, br, CG.frame.foot(br, tr, bl));
};

// --- 二分割 / Division ----------------------------------------------------
CG.guides.division = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    if (ctx.state.division_axis === "H") {
        _line(l, f, 0.0, 0.5, 1.0, 0.5);
    } else {
        _line(l, f, 0.5, 0.0, 0.5, 1.0);
    }
};

// --- シンメトリー / Symmetry ----------------------------------------------
CG.guides.symmetry = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var ax = ctx.state.symmetry_axis;
    if (ax === "H" || ax === "BOTH") { _line(l, f, 0.0, 0.5, 1.0, 0.5); }
    if (ax === "V" || ax === "BOTH") { _line(l, f, 0.5, 0.0, 0.5, 1.0); }
};

// --- フレーム外周 / Frame Border -----------------------------------------
CG.guides.frame_border = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    CG.layer.addRectGuide(l,
        _uv(f, 0.0, 0.0), _uv(f, 1.0, 0.0),
        _uv(f, 1.0, 1.0), _uv(f, 0.0, 1.0));
};

// =========================================================================
// Phase 2 — パラメトリック / 領域
// =========================================================================

// --- 水平線 / Horizontal Line（高さ可変） --------------------------------
CG.guides.horizontal_line = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var p = Math.max(0.0, Math.min(1.0, ctx.state.horizontal_pos));
    _line(l, f, 0.0, p, 1.0, p);
};

// --- 垂直線 / Vertical Line（位置可変） ----------------------------------
CG.guides.vertical_line = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var p = Math.max(0.0, Math.min(1.0, ctx.state.vertical_pos));
    _line(l, f, p, 0.0, p, 1.0);
};

// --- 斜線 / Slanted（平行 N 本・角度/本数/拡がり可変） -------------------
CG.guides.slanted = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var s = ctx.state;
    var ang = s.slanted_angle_deg * Math.PI / 180.0;
    var count = Math.max(1, s.slanted_count);
    var spread = s.slanted_spread;

    var dx = Math.cos(ang), dy = Math.sin(ang);   // 方向
    var nx = -dy, ny = dx;                          // 法線
    var cu = 0.5, cv = 0.5;
    var L = 2.0;                                    // UV box 外まで延ばす

    for (var i = 0; i < count; i++) {
        var t = (count === 1) ? 0.0 : ((i / (count - 1)) - 0.5) * spread;
        var ou = cu + nx * t, ov = cv + ny * t;
        var clip = CG.frame.clipLineUV(ou - dx * L, ov - dy * L, ou + dx * L, ov + dy * L);
        if (clip === null) { continue; }
        _line(l, f, clip[0], clip[1], clip[2], clip[3]);
    }
};

// --- パターン / Pattern（cols x rows グリッド） --------------------------
CG.guides.pattern = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var cols = Math.max(2, Math.round(ctx.state.pattern_cols));
    var rows = Math.max(2, Math.round(ctx.state.pattern_rows));
    var i;
    for (i = 1; i < cols; i++) {
        var u = i / cols;
        _line(l, f, u, 0.0, u, 1.0);
    }
    for (i = 1; i < rows; i++) {
        var v = i / rows;
        _line(l, f, 0.0, v, 1.0, v);
    }
};

// --- 日の丸 / Bullseye（中央十字 + 同心円） ------------------------------
CG.guides.bullseye = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var rings = Math.max(0, Math.round(ctx.state.bullseye_rings));
    // 中央ターゲット（短い十字）
    var cr = 0.04;
    _line(l, f, 0.5 - cr, 0.5, 0.5 + cr, 0.5);
    _line(l, f, 0.5, 0.5 - cr, 0.5, 0.5 + cr);
    // 同心円（UV 空間の円 → frame アスペクトに合わせた楕円）
    if (rings > 0) {
        var center = _uv(f, 0.5, 0.5);
        var max_r = 0.45;
        for (var k = 1; k <= rings; k++) {
            var r = (k / rings) * max_r;
            CG.layer.addEllipseGuide(l, center[0], center[1], r * f.w, r * f.h);
        }
    }
};

// --- 黄金螺旋 / Golden Spiral（Fibonacci, 4 方向） -----------------------
CG.guides.spiral = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    var orientation = ctx.state.spiral_orientation;

    var rect = [0.0, 0.0, 1.0, 1.0];   // u0, v0, u1, v1
    var cur = orientation;
    var iterations = 8;
    var arc_uv = [];

    function arcPoints(cx, cy, radius, angle_start, segments) {
        var pts = [];
        for (var i = 0; i <= segments; i++) {
            var a = angle_start + (i / segments) * (Math.PI / 2);
            pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
        }
        return pts;
    }

    for (var step = 0; step < iterations; step++) {
        var u0 = rect[0], v0 = rect[1], u1 = rect[2], v1 = rect[3];
        var w = u1 - u0, h = v1 - v0;
        if (w <= 1e-5 || h <= 1e-5) { break; }
        var sq = (w >= h) ? h : w;
        var cx, cy, angle_start, next_rect, next_corner, square;

        if (w >= h) {
            if (cur === "TL" || cur === "BL") {
                square = [u0, v0, u0 + sq, v1];
                next_rect = [u0 + sq, v0, u1, v1];
                if (cur === "TL") { cx = square[2]; cy = square[1]; angle_start = Math.PI / 2; next_corner = "BL"; }
                else { cx = square[2]; cy = square[3]; angle_start = Math.PI; next_corner = "TL"; }
            } else {
                square = [u1 - sq, v0, u1, v1];
                next_rect = [u0, v0, u1 - sq, v1];
                if (cur === "TR") { cx = square[0]; cy = square[1]; angle_start = 0.0; next_corner = "BR"; }
                else { cx = square[0]; cy = square[3]; angle_start = -Math.PI / 2; next_corner = "TR"; }
            }
        } else {
            if (cur === "TL" || cur === "TR") {
                square = [u0, v1 - sq, u1, v1];
                next_rect = [u0, v0, u1, v1 - sq];
                if (cur === "TL") { cx = square[2]; cy = square[1]; angle_start = Math.PI / 2; next_corner = "TR"; }
                else { cx = square[0]; cy = square[1]; angle_start = 0.0; next_corner = "TL"; }
            } else {
                square = [u0, v0, u1, v0 + sq];
                next_rect = [u0, v0 + sq, u1, v1];
                if (cur === "BL") { cx = square[2]; cy = square[3]; angle_start = Math.PI; next_corner = "BR"; }
                else { cx = square[0]; cy = square[3]; angle_start = -Math.PI / 2; next_corner = "BL"; }
            }
        }

        var pts = arcPoints(cx, cy, sq, angle_start, 18);
        for (var p = 0; p < pts.length; p++) { arc_uv.push(pts[p]); }
        rect = next_rect;
        cur = next_corner;
    }

    var coords = [];
    for (var q = 0; q < arc_uv.length; q++) {
        coords.push(_uv(f, arc_uv[q][0], arc_uv[q][1]));
    }
    CG.layer.addPolylineGuide(l, coords, false);
};

// --- セーフエリア / Safe Area（Action + Title） --------------------------
function _insetRectGuide(lyr, frame, ratio) {
    var margin = (1.0 - ratio) / 2.0;
    var u0 = margin, u1 = 1.0 - margin, v0 = margin, v1 = 1.0 - margin;
    CG.layer.addRectGuide(lyr,
        CG.frame.uvToPoint(frame, u0, v0), CG.frame.uvToPoint(frame, u1, v0),
        CG.frame.uvToPoint(frame, u1, v1), CG.frame.uvToPoint(frame, u0, v1));
}

CG.guides.safe_area = function (ctx) {
    var f = ctx.frame, l = ctx.layer;
    _insetRectGuide(l, f, ctx.state.safe_action);   // Action safe（外）
    _insetRectGuide(l, f, ctx.state.safe_title);    // Title safe（内）
};

// --- アスペクトマスク / Aspect Mask（内接矩形・中央寄せ） ----------------
CG.ASPECT_RATIOS = {
    "1_1": 1.0,
    "9_16": 9.0 / 16.0,
    "16_9": 16.0 / 9.0,
    "4_3": 4.0 / 3.0,
    "21_9": 21.0 / 9.0
};

CG.guides.aspect_mask = function (ctx) {
    var f = ctx.frame, l = ctx.layer, s = ctx.state;
    var scene_aspect = f.w / f.h;
    var target;
    if (s.aspect_ratio === "CUSTOM") {
        if (s.aspect_custom_h <= 1e-6) { return; }
        target = s.aspect_custom_w / s.aspect_custom_h;
    } else {
        target = CG.ASPECT_RATIOS[s.aspect_ratio];
        if (target === undefined) { target = 1.0; }
    }
    var scale_u, scale_v;
    if (target >= scene_aspect) {   // ターゲットが横長 → 縦を縮める
        scale_v = scene_aspect / target; scale_u = 1.0;
    } else {                         // ターゲットが縦長 → 横を縮める
        scale_u = target / scene_aspect; scale_v = 1.0;
    }
    var mu = (1.0 - scale_u) / 2.0, mv = (1.0 - scale_v) / 2.0;
    var u0 = mu, u1 = 1.0 - mu, v0 = mv, v1 = 1.0 - mv;
    CG.layer.addRectGuide(l,
        _uv(f, u0, v0), _uv(f, u1, v0),
        _uv(f, u1, v1), _uv(f, u0, v1));
};
