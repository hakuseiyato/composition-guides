// Composition Guides for Illustrator
// cep_engine.jsx — CEP 用エンジンエントリ（UI/main を含まない）
//
// CEP の manifest <ScriptPath> から読み込まれ、CG と CGHost を定義するだけ。
// ダイアログ表示や自動実行は行わない。build.ps1 が #include を展開して
// cep/jsx/engine.jsx を生成する。

#target illustrator

var CG = {};

// ===== begin state.jsx =====
// Composition Guides for Illustrator
// state.jsx — 設定 state と既定値（Blender props.py 相当）
//
// ExtendScript (ES3) 互換。CG 名前空間に載せる。

// 黄金比定数 / Golden ratio constants
CG.PHI = (1.0 + Math.sqrt(5.0)) / 2.0;       // ≈ 1.6180339887
CG.PHI_SHORT = 1.0 / (1.0 + CG.PHI);          // ≈ 0.3819660113 (短辺比)
CG.PHI_LONG = CG.PHI / (1.0 + CG.PHI);        // ≈ 0.6180339887 (長辺比)

// 既定設定を返す / Return default settings object
CG.defaults = function () {
    return {
        // 基準アートボード index（-1 = アクティブ）
        artboard_index: -1,

        // ----- 構図ガイド / Composition guides -----
        show_thirds: true,
        show_golden: false,
        show_diagonal: false,
        show_center: false,
        show_quad: false,
        show_triangle: false,
        triangle_orientation: "TL_BR",   // 'TL_BR' / 'TR_BL'
        show_golden_section: false,

        // ----- 絵画構図 / Painting -----
        show_division: false,
        division_axis: "H",              // 'H' / 'V'
        show_symmetry: false,
        symmetry_axis: "V",              // 'H' / 'V' / 'BOTH'

        // ----- Phase 2: パラメトリック / Parametric -----
        show_spiral: false,
        spiral_orientation: "TL",        // 'TL' / 'TR' / 'BL' / 'BR'

        show_horizontal_line: false,
        horizontal_pos: 0.5,             // 0=下端, 1=上端

        show_vertical_line: false,
        vertical_pos: 0.5,               // 0=左端, 1=右端

        show_slanted: false,
        slanted_angle_deg: 30.0,         // 度（UV 空間, 0=水平, 90=垂直）
        slanted_count: 4,
        slanted_spread: 0.9,             // 法線方向の総拡がり (UV)

        show_pattern: false,
        pattern_cols: 6,
        pattern_rows: 6,

        show_bullseye: false,
        bullseye_rings: 2,               // 同心円の数（0 で十字のみ）

        // ----- Phase 2: 領域 / Area -----
        show_safe_area: false,
        safe_action: 0.9,                // アクション安全域（短辺比）
        safe_title: 0.8,                 // タイトル安全域

        show_aspect: false,
        aspect_ratio: "9_16",            // '1_1' '9_16' '16_9' '4_3' '21_9' 'CUSTOM'
        aspect_custom_w: 2.39,
        aspect_custom_h: 1.0,

        // ----- Phase 3: パース線 / Perspective -----
        show_perspective: false,
        perspective_mode: "2P",          // '1P' / '2P' / '3P'
        perspective_horizon_v: 0.5,      // 水平線の高さ (0..1)
        perspective_vp1_u: 0.5,          // 1P の VP の横位置 (0..1)
        perspective_vp_spread: 0.9,      // 2P/3P 左右VPの中心からの半幅比（>0.5 で画面外）
        perspective_vp3_dist: 1.5,       // 3P 垂直VPの horizon からの距離 (UV-v, 符号付き)
        perspective_lines: 12,           // 各 VP からの放射本数
        perspective_show_vp_marker: true,
        perspective_show_horizon: true,

        // ----- 枠 / Frame -----
        show_frame: false
    };
};
// ===== end state.jsx =====
// ===== begin core/frame.jsx =====
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
// ===== end core/frame.jsx =====
// ===== begin core/guidelayer.jsx =====
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
    var item = lyr.pathItems.add();
    item.setEntirePath([[p0[0], p0[1]], [p1[0], p1[1]]]);
    item.guides = true;
    return item;
};

// pts = [[x,y], ...] の連続線（オプションで閉じる）をガイド化
CG.layer.addPolylineGuide = function (lyr, pts, closed) {
    if (pts.length < 2) { return null; }
    var item = lyr.pathItems.add();
    item.setEntirePath(pts);
    if (closed) { item.closed = true; }
    item.guides = true;
    return item;
};

// 中央 (cx,cy) 半径 (rx,ry) の楕円ガイド
CG.layer.addEllipseGuide = function (lyr, cx, cy, rx, ry) {
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
// ===== end core/guidelayer.jsx =====
// ===== begin draw/guides.jsx =====
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
// ===== end draw/guides.jsx =====
// ===== begin draw/perspective.jsx =====
// Composition Guides for Illustrator
// draw/perspective.jsx — パース線（パラメトリック消失点）
//
// Blender はカメラからワールド軸方向に VP を求めたが、Illustrator にはカメラが
// 無いため VP を **パラメトリック**に置く:
//   - 水平線（horizon）の高さ: horizon_v (0..1)
//   - 1P: VP1 = (vp1_u, horizon_v)
//   - 2P: 左右 VP を horizon 上に vp_spread（中心からの半幅比, 画面外可）で配置
//   - 3P: + 垂直 VP = (0.5, horizon_v + vp3_dist)
// 各 VP から放射線を生成し、アートボード矩形へクリップ。

CG.perspective = {};

// VP（点）から frame 全体を覆う n 本の放射線を生成しクリップして描画
CG.perspective._raysFromVP = function (lyr, frame, vp, n) {
    var ab = CG.frame.aabb(frame);
    var center = CG.frame.uvToPoint(frame, 0.5, 0.5);
    var dxRef = center[0] - vp[0], dyRef = center[1] - vp[1];
    if (Math.abs(dxRef) < 1e-6 && Math.abs(dyRef) < 1e-6) { return; }
    var base = Math.atan2(dyRef, dxRef);

    // 4 隅への角度を base まわりに正規化して範囲を決める
    var corners = [
        [ab.x_min, ab.y_min], [ab.x_max, ab.y_min],
        [ab.x_max, ab.y_max], [ab.x_min, ab.y_max]
    ];
    var aMin = 1e9, aMax = -1e9;
    for (var c = 0; c < corners.length; c++) {
        var a = Math.atan2(corners[c][1] - vp[1], corners[c][0] - vp[0]);
        var diff = ((a - base + Math.PI) % (2 * Math.PI)) - Math.PI;
        if (diff < aMin) { aMin = diff; }
        if (diff > aMax) { aMax = diff; }
    }

    var diag = Math.sqrt(
        (ab.x_max - ab.x_min) * (ab.x_max - ab.x_min) +
        (ab.y_max - ab.y_min) * (ab.y_max - ab.y_min));
    var length = diag * 2.0;
    if (n < 2) { n = 2; }

    for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        var ang = base + aMin + t * (aMax - aMin);
        var end = [vp[0] + length * Math.cos(ang), vp[1] + length * Math.sin(ang)];
        var clip = CG.frame.clipLineRect(vp, end, ab.x_min, ab.y_min, ab.x_max, ab.y_max);
        if (clip) {
            CG.layer.addLineGuide(lyr, [clip[0], clip[1]], [clip[2], clip[3]]);
        }
    }
};

// VP 位置に小さな十字マーカー（frame 内のときのみ）
CG.perspective._vpMarker = function (lyr, frame, vp) {
    var ab = CG.frame.aabb(frame);
    if (!(vp[0] >= ab.x_min && vp[0] <= ab.x_max && vp[1] >= ab.y_min && vp[1] <= ab.y_max)) {
        return;
    }
    var size = (ab.x_max - ab.x_min) * 0.01;
    CG.layer.addLineGuide(lyr, [vp[0] - size, vp[1]], [vp[0] + size, vp[1]]);
    CG.layer.addLineGuide(lyr, [vp[0], vp[1] - size], [vp[0], vp[1] + size]);
};

CG.guides.perspective = function (ctx) {
    var f = ctx.frame, l = ctx.layer, s = ctx.state;
    var hv = s.perspective_horizon_v;
    var n = Math.max(2, Math.round(s.perspective_lines));
    var P = CG.perspective;

    var vps = [];   // 水平線描画・マーカー用

    if (s.perspective_mode === "1P") {
        var vp1 = CG.frame.uvToPoint(f, s.perspective_vp1_u, hv);
        P._raysFromVP(l, f, vp1, n);
        vps.push(vp1);
    } else {
        // 2P / 3P: 左右 VP
        var uL = 0.5 - s.perspective_vp_spread;
        var uR = 0.5 + s.perspective_vp_spread;
        var vpL = CG.frame.uvToPoint(f, uL, hv);
        var vpR = CG.frame.uvToPoint(f, uR, hv);
        P._raysFromVP(l, f, vpL, n);
        P._raysFromVP(l, f, vpR, n);
        vps.push(vpL); vps.push(vpR);

        if (s.perspective_mode === "3P") {
            var vp3 = CG.frame.uvToPoint(f, 0.5, hv + s.perspective_vp3_dist);
            P._raysFromVP(l, f, vp3, n);
            // 垂直 VP はマーカーのみ（水平線対象外）
            if (s.perspective_show_vp_marker) { P._vpMarker(l, f, vp3); }
        }
    }

    // 水平線（horizon）
    if (s.perspective_show_horizon) {
        CG.layer.addLineGuide(l,
            CG.frame.uvToPoint(f, 0.0, hv),
            CG.frame.uvToPoint(f, 1.0, hv));
    }

    // VP マーカー
    if (s.perspective_show_vp_marker) {
        for (var i = 0; i < vps.length; i++) { P._vpMarker(l, f, vps[i]); }
    }
};
// ===== end draw/perspective.jsx =====
// ===== begin generate.jsx =====
// Composition Guides for Illustrator
// generate.jsx — メインディスパッチャ（Blender core.py 相当）
//
// state に基づき、専用レイヤーを作り直して有効なガイドを描画する。

// doc: IL=Document / AE=CompItem。基準フレーム取得とレイヤー生成はバックエンドが担う。
CG.generate = function (doc, state) {
    var frame = CG.frame.fromBase(doc, state);
    var layer = CG.layer.recreate(doc);
    var ctx = { frame: frame, layer: layer, state: state };

    // 構図ガイド
    if (state.show_thirds)         { CG.guides.thirds(ctx); }
    if (state.show_golden)         { CG.guides.golden(ctx); }
    if (state.show_diagonal)       { CG.guides.diagonal(ctx); }
    if (state.show_center)         { CG.guides.center(ctx); }
    if (state.show_quad)           { CG.guides.quad(ctx); }
    if (state.show_triangle)       { CG.guides.triangle(ctx); }
    if (state.show_golden_section) { CG.guides.golden_section(ctx); }

    // 絵画構図
    if (state.show_division)       { CG.guides.division(ctx); }
    if (state.show_symmetry)       { CG.guides.symmetry(ctx); }

    // Phase 2: パラメトリック
    if (state.show_spiral)          { CG.guides.spiral(ctx); }
    if (state.show_horizontal_line) { CG.guides.horizontal_line(ctx); }
    if (state.show_vertical_line)   { CG.guides.vertical_line(ctx); }
    if (state.show_slanted)         { CG.guides.slanted(ctx); }
    if (state.show_pattern)         { CG.guides.pattern(ctx); }
    if (state.show_bullseye)        { CG.guides.bullseye(ctx); }

    // Phase 2: 領域
    if (state.show_safe_area)       { CG.guides.safe_area(ctx); }
    if (state.show_aspect)          { CG.guides.aspect_mask(ctx); }

    // Phase 3: パース線
    if (state.show_perspective)     { CG.guides.perspective(ctx); }

    // 枠
    if (state.show_frame)          { CG.guides.frame_border(ctx); }

    CG.layer.finalize(layer);
    CG.host.redraw();
    return frame.index;
};
// ===== end generate.jsx =====
// ===== begin host.jsx =====
// Composition Guides for Illustrator
// host.jsx — CEP パネルから呼ばれるホスト API
//
// CEP パネル(JS)は __adobe_cep__.evalScript で CGHost.* を呼ぶ。
// ExtendScript には JSON が無いため、状態は eval('('+str+')') でパースする
// （ローカルの信頼できるデータのみを扱う）。

var CGHost = {};

CGHost._doc = function () {
    return (app.documents.length > 0) ? app.activeDocument : null;
};

// state(JSON文字列) を受け取りガイド生成。戻り値は "OK:<index>" / "NO_DOC" / "ERR:<msg>"
CGHost.generate = function (jsonStr) {
    var doc = CGHost._doc();
    if (!doc) { return "NO_DOC"; }
    var state;
    try {
        state = eval("(" + jsonStr + ")");
    } catch (e) {
        return "ERR:state parse: " + e;
    }
    try {
        var idx = CG.generate(doc, state);
        return "OK:" + idx;
    } catch (e2) {
        return "ERR:" + e2;
    }
};

// 専用レイヤーを全消去。"OK" / "NO_DOC"
CGHost.clear = function () {
    var doc = CGHost._doc();
    if (!doc) { return "NO_DOC"; }
    CG.layer.clear(doc);
    app.redraw();
    return "OK";
};

// アートボード名一覧（改行区切り）。ドキュメントが無ければ空文字
CGHost.artboards = function () {
    var doc = CGHost._doc();
    if (!doc) { return ""; }
    var names = [];
    for (var i = 0; i < doc.artboards.length; i++) {
        names.push(doc.artboards[i].name);
    }
    return names.join("\n");
};
// ===== end host.jsx =====
