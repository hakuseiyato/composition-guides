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
// ===== begin ae/frame.jsx =====
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
// ===== end ae/frame.jsx =====
// ===== begin ae/layer.jsx =====
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
// ===== end ae/layer.jsx =====
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
// ===== begin ae/panel.jsx =====
// Composition Guides — After Effects 版
// ae/panel.jsx — ドック可能 ScriptUI パネル
//
// AE は ScriptUI パネルをネイティブにドックできる（CEP 不要）。
// `Scripts/ScriptUI Panels/` に置くと「ウィンドウ」メニューに出る。
// build() は Panel（ドック時）/ Window（単体実行時）の両対応。
// 生成・消去は CG.run.* を介してエントリ側で Undo グループに包む。

CG.ui = {};

CG.ui.build = function (thisObj, state) {
    var pal = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "構図ガイド / Composition Guides", undefined, { resizeable: true });

    pal.orientation = "column";
    pal.alignChildren = ["fill", "top"];
    pal.spacing = 6;
    pal.margins = 8;

    // --- 共通ビルダ ---
    function checkRow(parent, key, label) {
        var cb = parent.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; };
        return cb;
    }

    function numField(row, numKey, isInt, chars) {
        var et = row.add("edittext", undefined, "" + state[numKey]);
        et.characters = chars || 4;
        et.onChange = function () {
            var v = parseFloat(this.text);
            if (isNaN(v)) { this.text = "" + state[numKey]; return; }
            if (isInt) { v = Math.round(v); }
            state[numKey] = v;
            this.text = "" + v;
        };
        return et;
    }

    function numRow(parent, key, label, numKey, isInt) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var cb = row.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; };
        numField(row, numKey, isInt, 5);
        return row;
    }

    function cbDropRow(parent, key, label, items, getIndex, setByIndex) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var cb = row.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; };
        var dd = row.add("dropdownlist", undefined, items);
        dd.selection = getIndex();
        dd.onChange = function () { setByIndex(this.selection.index); };
        return row;
    }

    // --- 対象表示 ---
    var head = pal.add("group");
    head.orientation = "row";
    head.alignChildren = ["left", "center"];
    head.add("statictext", undefined, "対象: アクティブコンポ / Active Comp");

    // --- タブ ---
    var tabs = pal.add("tabbedpanel");
    tabs.alignChildren = ["fill", "top"];
    tabs.preferredSize.width = 320;

    // ===== タブ: 構図 =====
    var t1 = tabs.add("tab", undefined, "構図");
    t1.orientation = "column";
    t1.alignChildren = ["fill", "top"];
    t1.margins = 8;
    checkRow(t1, "show_thirds", "三分割 / Rule of Thirds");
    checkRow(t1, "show_golden", "黄金比 / Golden Ratio");
    checkRow(t1, "show_diagonal", "対角線 / Diagonal");
    checkRow(t1, "show_center", "中央十字 / Center Cross");
    checkRow(t1, "show_quad", "4 分割 / Quad");
    checkRow(t1, "show_golden_section", "黄金分割 / Golden Section");

    // 三角構図（向き付き）
    cbDropRow(t1, "show_triangle", "三角構図 / Triangle",
        ["TL→BR", "TR→BL"],
        function () { return (state.triangle_orientation === "TL_BR") ? 0 : 1; },
        function (idx) { state.triangle_orientation = (idx === 0) ? "TL_BR" : "TR_BL"; });

    // 黄金螺旋（収束方向）
    cbDropRow(t1, "show_spiral", "黄金螺旋 / Spiral",
        ["左上 TL", "右上 TR", "左下 BL", "右下 BR"],
        function () {
            var o = state.spiral_orientation;
            return (o === "TL") ? 0 : (o === "TR") ? 1 : (o === "BL") ? 2 : 3;
        },
        function (idx) { state.spiral_orientation = ["TL", "TR", "BL", "BR"][idx]; });

    // ===== タブ: 絵画 =====
    var t2 = tabs.add("tab", undefined, "絵画");
    t2.orientation = "column";
    t2.alignChildren = ["fill", "top"];
    t2.margins = 8;

    cbDropRow(t2, "show_division", "二分割 / Division",
        ["横 / H", "縦 / V"],
        function () { return (state.division_axis === "H") ? 0 : 1; },
        function (idx) { state.division_axis = (idx === 0) ? "H" : "V"; });

    cbDropRow(t2, "show_symmetry", "シンメトリー / Symmetry",
        ["横 / H", "縦 / V", "両方 / Both"],
        function () { return (state.symmetry_axis === "H") ? 0 : (state.symmetry_axis === "V" ? 1 : 2); },
        function (idx) { state.symmetry_axis = (idx === 0) ? "H" : (idx === 1 ? "V" : "BOTH"); });

    numRow(t2, "show_horizontal_line", "水平線 / Horizontal（高さ 0..1）", "horizontal_pos", false);
    numRow(t2, "show_vertical_line", "垂直線 / Vertical（位置 0..1）", "vertical_pos", false);

    // 斜線（角度・本数・拡がり）
    var slRow = t2.add("group");
    slRow.orientation = "row";
    slRow.alignChildren = ["left", "center"];
    var slCb = slRow.add("checkbox", undefined, "斜線");
    slCb.value = state.show_slanted;
    slCb.onClick = function () { state.show_slanted = this.value; };
    slRow.add("statictext", undefined, "角度"); numField(slRow, "slanted_angle_deg", false, 4);
    slRow.add("statictext", undefined, "本数"); numField(slRow, "slanted_count", true, 3);
    slRow.add("statictext", undefined, "拡がり"); numField(slRow, "slanted_spread", false, 4);

    // パターン（列 x 行）
    var ptRow = t2.add("group");
    ptRow.orientation = "row";
    ptRow.alignChildren = ["left", "center"];
    var ptCb = ptRow.add("checkbox", undefined, "パターン");
    ptCb.value = state.show_pattern;
    ptCb.onClick = function () { state.show_pattern = this.value; };
    ptRow.add("statictext", undefined, "列"); numField(ptRow, "pattern_cols", true, 3);
    ptRow.add("statictext", undefined, "行"); numField(ptRow, "pattern_rows", true, 3);

    numRow(t2, "show_bullseye", "日の丸 / Bullseye（同心円数）", "bullseye_rings", true);

    // ===== タブ: 領域 =====
    var t3 = tabs.add("tab", undefined, "領域");
    t3.orientation = "column";
    t3.alignChildren = ["fill", "top"];
    t3.margins = 8;

    // セーフエリア（Action / Title）
    var saRow = t3.add("group");
    saRow.orientation = "row";
    saRow.alignChildren = ["left", "center"];
    var saCb = saRow.add("checkbox", undefined, "セーフエリア");
    saCb.value = state.show_safe_area;
    saCb.onClick = function () { state.show_safe_area = this.value; };
    saRow.add("statictext", undefined, "Action"); numField(saRow, "safe_action", false, 4);
    saRow.add("statictext", undefined, "Title"); numField(saRow, "safe_title", false, 4);

    // アスペクトマスク
    var asRow = t3.add("group");
    asRow.orientation = "row";
    asRow.alignChildren = ["left", "center"];
    var asCb = asRow.add("checkbox", undefined, "アスペクト");
    asCb.value = state.show_aspect;
    asCb.onClick = function () { state.show_aspect = this.value; };
    var asKeys = ["1_1", "9_16", "16_9", "4_3", "21_9", "CUSTOM"];
    var asItems = ["1:1", "9:16", "16:9", "4:3", "21:9", "カスタム"];
    var asDrop = asRow.add("dropdownlist", undefined, asItems);
    var asSel = 0;
    for (var ai = 0; ai < asKeys.length; ai++) { if (asKeys[ai] === state.aspect_ratio) { asSel = ai; } }
    asDrop.selection = asSel;
    asDrop.onChange = function () { state.aspect_ratio = asKeys[this.selection.index]; };
    asRow.add("statictext", undefined, "W"); numField(asRow, "aspect_custom_w", false, 4);
    asRow.add("statictext", undefined, "H"); numField(asRow, "aspect_custom_h", false, 4);

    // ===== タブ: パース =====
    var t4 = tabs.add("tab", undefined, "パース");
    t4.orientation = "column";
    t4.alignChildren = ["fill", "top"];
    t4.margins = 8;

    var peTop = t4.add("group");
    peTop.orientation = "row";
    peTop.alignChildren = ["left", "center"];
    var peCb = peTop.add("checkbox", undefined, "パース線を表示");
    peCb.value = state.show_perspective;
    peCb.onClick = function () { state.show_perspective = this.value; };
    peTop.add("statictext", undefined, "点数");
    var peMode = peTop.add("dropdownlist", undefined, ["1点 / 1P", "2点 / 2P", "3点 / 3P"]);
    peMode.selection = (state.perspective_mode === "1P") ? 0 : (state.perspective_mode === "2P") ? 1 : 2;
    peMode.onChange = function () { state.perspective_mode = ["1P", "2P", "3P"][this.selection.index]; };

    var peR1 = t4.add("group");
    peR1.orientation = "row";
    peR1.alignChildren = ["left", "center"];
    peR1.add("statictext", undefined, "水平線高さ"); numField(peR1, "perspective_horizon_v", false, 4);
    peR1.add("statictext", undefined, "放射本数"); numField(peR1, "perspective_lines", true, 3);

    var peR2 = t4.add("group");
    peR2.orientation = "row";
    peR2.alignChildren = ["left", "center"];
    peR2.add("statictext", undefined, "VP横(1P)"); numField(peR2, "perspective_vp1_u", false, 4);
    peR2.add("statictext", undefined, "拡がり(2P)"); numField(peR2, "perspective_vp_spread", false, 4);
    peR2.add("statictext", undefined, "垂直VP(3P)"); numField(peR2, "perspective_vp3_dist", false, 4);

    var peR3 = t4.add("group");
    peR3.orientation = "row";
    peR3.alignChildren = ["left", "center"];
    var peMk = peR3.add("checkbox", undefined, "VPマーカー");
    peMk.value = state.perspective_show_vp_marker;
    peMk.onClick = function () { state.perspective_show_vp_marker = this.value; };
    var peHz = peR3.add("checkbox", undefined, "水平線");
    peHz.value = state.perspective_show_horizon;
    peHz.onClick = function () { state.perspective_show_horizon = this.value; };

    // ===== タブ: 枠 =====
    var t5 = tabs.add("tab", undefined, "枠");
    t5.orientation = "column";
    t5.alignChildren = ["fill", "top"];
    t5.margins = 8;
    checkRow(t5, "show_frame", "フレーム外周 / Frame Border");

    tabs.selection = t1;

    // --- ボタン ---
    var btns = pal.add("group");
    btns.orientation = "row";
    btns.alignment = ["fill", "bottom"];
    var clearBtn = btns.add("button", undefined, "全消去 / Clear");
    var spacer = btns.add("statictext", undefined, "");
    spacer.alignment = ["fill", "center"];
    var genBtn = btns.add("button", undefined, "生成 / 更新");

    genBtn.onClick = function () { CG.run.generate(state); };
    clearBtn.onClick = function () { CG.run.clear(); };

    pal.layout.layout(true);
    pal.layout.resize();
    pal.onResizing = pal.onResize = function () { this.layout.resize(); };

    return pal;
};
// ===== end ae/panel.jsx =====

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
