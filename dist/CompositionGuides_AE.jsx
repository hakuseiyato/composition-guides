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
        // 基準アートボード index（-1 = アクティブ, -2 = 全アートボード）
        artboard_index: -1,

        // ----- 構図ガイド / Composition guides -----
        show_thirds: true,
        show_golden: false,
        show_diagonal: false,
        show_center: false,
        show_triangle: false,
        triangle_orientation: "TL_BR",   // 'TL_BR' / 'TR_BL'
        show_golden_section: false,

        // ----- 絵画構図 / Painting -----

        // ----- Phase 2: パラメトリック / Parametric -----
        show_spiral_tl: false,
        show_spiral_tr: false,
        show_spiral_bl: false,
        show_spiral_br: false,

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
        perspective_live_vp: true,       // AE: VP をヌルレイヤーで調整（IL は無視）

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

// 描画対象フレームの配列を返す（generate.jsx から呼ばれる）。
// AE はコンポ 1 個が基準でアートボードの概念が無いため、常に単一要素配列を返す。
CG.frame.list = function (comp, state) {
    return [CG.frame.fromBase(comp, state)];
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
// ===== end ae/layer.jsx =====
// ===== begin ae/vpexpr.jsx =====
// Composition Guides — After Effects 版
// ae/vpexpr.jsx — パース消失点ヌルとライブ描画エクスプレッション
//
// パース消失点をヌルレイヤーとして管理し、シェイプパスがドラッグへ即追従するための
// エクスプレッション文字列を生成する。

CG.ae = CG.ae || {};
CG.ae.vp = {};

CG.ae.vp.NAMES = { P1: "CG VP1", L: "CG VP-L", R: "CG VP-R", V3: "CG VP3" };
CG.ae.vp.PREFIX = "CG VP";

CG.ae.vp.ensure = function (comp, key, mathPt) {
    var name = CG.ae.vp.NAMES[key];
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === name) { return name; }
    }
    var lyr = comp.layers.addNull();
    lyr.name = name;
    var tr = lyr.property("ADBE Transform Group");
    tr.property("ADBE Anchor Point").setValue([lyr.width / 2, lyr.height / 2]);
    tr.property("ADBE Scale").setValue([25, 25]);
    tr.property("ADBE Position").setValue([mathPt[0], comp.height - mathPt[1]]);
    lyr.label = 9;
    return name;
};

CG.ae.vp.prune = function (comp, keepNames) {
    for (var i = comp.numLayers; i >= 1; i--) {
        var lyr = comp.layer(i);
        if (lyr.name.indexOf(CG.ae.vp.PREFIX) === 0) {
            var keep = false;
            for (var k = 0; k < keepNames.length; k++) {
                if (lyr.name === keepNames[k]) { keep = true; break; }
            }
            if (!keep) {
                lyr.locked = false;
                lyr.remove();
            }
        }
    }
};

CG.ae.vp.clearAll = function (comp) {
    CG.ae.vp.prune(comp, []);
};

CG.ae.vp.rayExpr = function (nullName, i, n) {
    // クリップ不成立時は butt cap で不可視になる同一点の縮退パスを返す。
    return "var L = thisComp.layer(\"" + nullName + "\");\n" +
        "var vp = L.toComp(L.anchorPoint);\n" +
        "var W = thisComp.width, H = thisComp.height;\n" +
        "var N = " + n + ", I = " + i + ";\n" +
        "var base = Math.atan2(H / 2 - vp[1], W / 2 - vp[0]);\n" +
        "var cs = [[0, 0], [W, 0], [W, H], [0, H]];\n" +
        "var aMin = 1e9, aMax = -1e9;\n" +
        "for (var k = 0; k < 4; k++) {\n" +
        // JavaScript の % は被除数が負のとき負を返すため、コンポ座標（y 下向き）では角度差が (-2π, -π] に落ちて範囲計算が壊れる。
        // 正方向へ回してから -π する。
        "    var d = (Math.atan2(cs[k][1] - vp[1], cs[k][0] - vp[0]) - base + Math.PI) % (2 * Math.PI);\n" +
        "    if (d < 0) { d += 2 * Math.PI; }\n" +
        "    d -= Math.PI;\n" +
        "    if (d < aMin) { aMin = d; }\n" +
        "    if (d > aMax) { aMax = d; }\n" +
        "}\n" +
        "var t = (N < 2) ? 0 : I / (N - 1);\n" +
        "var ang = base + aMin + t * (aMax - aMin);\n" +
        "var len = Math.sqrt(W * W + H * H) * 2;\n" +
        "var dx = len * Math.cos(ang), dy = len * Math.sin(ang);\n" +
        "var pp = [-dx, dx, -dy, dy];\n" +
        "var qq = [vp[0], W - vp[0], vp[1], H - vp[1]];\n" +
        "var u1 = 0, u2 = 1, ok = true;\n" +
        "for (var m = 0; m < 4; m++) {\n" +
        "    if (Math.abs(pp[m]) < 1e-12) {\n" +
        "        if (qq[m] < 0) { ok = false; }\n" +
        "    } else {\n" +
        "        var tt = qq[m] / pp[m];\n" +
        "        if (pp[m] < 0) {\n" +
        "            if (tt > u2) { ok = false; } else if (tt > u1) { u1 = tt; }\n" +
        "        } else {\n" +
        "            if (tt < u1) { ok = false; } else if (tt < u2) { u2 = tt; }\n" +
        "        }\n" +
        "    }\n" +
        "}\n" +
        "var q0, q1;\n" +
        "if (!ok || u1 > u2) { q0 = vp; q1 = vp; } else {\n" +
        "    q0 = [vp[0] + u1 * dx, vp[1] + u1 * dy];\n" +
        "    q1 = [vp[0] + u2 * dx, vp[1] + u2 * dy];\n" +
        "}\n" +
        "createPath([fromComp(q0), fromComp(q1)], [[0, 0], [0, 0]], [[0, 0], [0, 0]], false);";
};

CG.ae.vp.markerExpr = function (nullName, axis) {
    return "var L = thisComp.layer(\"" + nullName + "\");\n" +
        "var vp = L.toComp(L.anchorPoint);\n" +
        "var W = thisComp.width, H = thisComp.height;\n" +
        "var s = W * 0.01;\n" +
        "var q0, q1;\n" +
        "if (vp[0] < 0 || vp[0] > W || vp[1] < 0 || vp[1] > H) {\n" +
        "    q0 = vp; q1 = vp;\n" +
        "} else if (" + axis + " === 0) {\n" +
        "    q0 = [vp[0] - s, vp[1]]; q1 = [vp[0] + s, vp[1]];\n" +
        "} else {\n" +
        "    q0 = [vp[0], vp[1] - s]; q1 = [vp[0], vp[1] + s];\n" +
        "}\n" +
        "createPath([fromComp(q0), fromComp(q1)], [[0, 0], [0, 0]], [[0, 0], [0, 0]], false);";
};

CG.ae.vp.horizon1Expr = function (nullName) {
    return "var L = thisComp.layer(\"" + nullName + "\");\n" +
        "var vp = L.toComp(L.anchorPoint);\n" +
        "var W = thisComp.width;\n" +
        "createPath([fromComp([0, vp[1]]), fromComp([W, vp[1]])], [[0, 0], [0, 0]], [[0, 0], [0, 0]], false);";
};

CG.ae.vp.horizon2Expr = function (nameL, nameR) {
    return "var A = thisComp.layer(\"" + nameL + "\"), B = thisComp.layer(\"" + nameR + "\");\n" +
        "var a = A.toComp(A.anchorPoint), b = B.toComp(B.anchorPoint);\n" +
        "var W = thisComp.width, H = thisComp.height;\n" +
        "var dx = b[0] - a[0];\n" +
        "var q0, q1;\n" +
        "if (Math.abs(dx) < 1e-6) {\n" +
        "    q0 = [a[0], 0]; q1 = [a[0], H];\n" +
        "} else {\n" +
        "    var m = (b[1] - a[1]) / dx;\n" +
        "    q0 = [0, a[1] + m * (0 - a[0])];\n" +
        "    q1 = [W, a[1] + m * (W - a[0])];\n" +
        "}\n" +
        "createPath([fromComp(q0), fromComp(q1)], [[0, 0], [0, 0]], [[0, 0], [0, 0]], false);";
};
// ===== end ae/vpexpr.jsx =====
// ===== begin ae/figure.jsx =====
// Composition Guides — After Effects 版
// ae/figure.jsx — 写真に合わせた人物サイズ合わせ
//
// 地面に立つ物体の画面上の高さは水平線からの垂直距離に正比例する、という幾何ルールを扱う。

CG.ae = CG.ae || {};
CG.ae.figure = {};

CG.ae.figure.REF_NAME = "CG Figure Ref";
CG.ae.figure.EFF_REF_SCALE = "基準スケール";
CG.ae.figure.EFF_RATIO = "身長比";

// 名前でレイヤーを引く（無ければ null）。comp.layer(name) は該当なしで例外を投げるため、
// ae/vpexpr.jsx と同じく名前を走査する。
CG.ae.figure.findLayer = function (comp, name) {
    for (var i = 1; i <= comp.numLayers; i++) {
        if (comp.layer(i).name === name) { return comp.layer(i); }
    }
    return null;
};

CG.ae.figure.hasLayer = function (comp, name) {
    return CG.ae.figure.findLayer(comp, name) !== null;
};

CG.ae.figure.ensureSlider = function (lyr, effName, defVal) {
    var effects = lyr.property("ADBE Effect Parade");
    var i;
    var eff;
    for (i = 1; i <= effects.numProperties; i++) {
        eff = effects.property(i);
        if (eff.name === effName) {
            return eff;
        }
    }
    eff = effects.addProperty("ADBE Slider Control");
    eff.name = effName;
    // UI 言語で変わる「スライダー」や "Slider" ではなく、値は eff.property(1) で参照する。
    eff.property(1).setValue(defVal);
    return eff;
};

CG.ae.figure.ensureRef = function (comp) {
    var lyr = CG.ae.figure.findLayer(comp, CG.ae.figure.REF_NAME);
    var tr;
    if (!lyr) {
        lyr = comp.layers.addNull();
        lyr.name = CG.ae.figure.REF_NAME;
        tr = lyr.property("ADBE Transform Group");
        tr.property("ADBE Anchor Point").setValue([lyr.width / 2, lyr.height / 2]);
        tr.property("ADBE Scale").setValue([25, 25]);
        // VP ヌルのラベル 9 と区別する。
        lyr.label = 11;
    }
    CG.ae.figure.ensureSlider(lyr, CG.ae.figure.EFF_REF_SCALE, 100);
    return lyr;
};

CG.ae.figure.setRef = function (comp, srcLayer) {
    var ref = CG.ae.figure.ensureRef(comp);
    var refTr = ref.property("ADBE Transform Group");
    var srcTr = srcLayer.property("ADBE Transform Group");
    var eff = CG.ae.figure.ensureSlider(ref, CG.ae.figure.EFF_REF_SCALE, 100);
    // value は式が付いていても評価後の実効値を返す。
    // Ref ヌルは 2D なので、3D レイヤーを基準にしても落ちないよう xy だけ取る。
    var sp = srcTr.property("ADBE Position").value;
    refTr.property("ADBE Position").setValue([sp[0], sp[1]]);
    eff.property(1).setValue(srcTr.property("ADBE Scale").value[0]);
    return ref;
};

// 自分のレイヤーに toComp() を呼ぶと Scale 式が自分の transform を参照して循環参照になるため、position を直接使う。親子付けなし・2D レイヤー前提。
// 全体を try/catch で包むので、「全消去」で VP ヌルや Ref が消えてもイラストのスケールは壊れず直前値のままになる。
// スライダー値は UI 言語に依存しない effect("名前")(1) のインデックス形式で参照する。
CG.ae.figure.scaleExpr = function (mode) {
    if (mode === "1P") {
        return "try {\n" +
            "    var A = thisComp.layer(\"" + CG.ae.vp.NAMES.P1 + "\");\n" +
            "    var hz = A.toComp(A.anchorPoint)[1];\n" +
            "    var R = thisComp.layer(\"" + CG.ae.figure.REF_NAME + "\");\n" +
            "    var r = R.position;\n" +
            "    var s0 = R.effect(\"" + CG.ae.figure.EFF_REF_SCALE + "\")(1);\n" +
            "    var ratio = effect(\"" + CG.ae.figure.EFF_RATIO + "\")(1);\n" +
            "    var d0 = r[1] - hz;\n" +
            "    var d = position[1] - hz;\n" +
            "    var k = (Math.abs(d0) < 1e-6) ? value[0] : s0 * (d / d0) * ratio;\n" +
            "    [k, k];\n" +
            "} catch (e) { value; }";
    }
    return "try {\n" +
        "    var A = thisComp.layer(\"" + CG.ae.vp.NAMES.L + "\"), B = thisComp.layer(\"" + CG.ae.vp.NAMES.R + "\");\n" +
        "    var a = A.toComp(A.anchorPoint), b = B.toComp(B.anchorPoint);\n" +
        "    var R = thisComp.layer(\"" + CG.ae.figure.REF_NAME + "\");\n" +
        "    var r = R.position;\n" +
        "    var s0 = R.effect(\"" + CG.ae.figure.EFF_REF_SCALE + "\")(1);\n" +
        "    var ratio = effect(\"" + CG.ae.figure.EFF_RATIO + "\")(1);\n" +
        "    var dxAB = b[0] - a[0];\n" +
        "    var m = (Math.abs(dxAB) < 1e-6) ? 0 : (b[1] - a[1]) / dxAB;\n" +
        "    var d0 = r[1] - (a[1] + m * (r[0] - a[0]));\n" +
        "    var d = position[1] - (a[1] + m * (position[0] - a[0]));\n" +
        "    var k = (Math.abs(d0) < 1e-6) ? value[0] : s0 * (d / d0) * ratio;\n" +
        "    [k, k];\n" +
        "} catch (e) { value; }";
};

CG.ae.figure.link = function (comp, layers, mode) {
    var count = 0;
    var i;
    var lyr;
    for (i = 0; i < layers.length; i++) {
        lyr = layers[i];
        // 誤選択防止のため、基準ヌルと VP ヌルをスキップする。
        if (lyr.name === CG.ae.figure.REF_NAME || lyr.name.indexOf(CG.ae.vp.PREFIX) === 0) {
            continue;
        }
        CG.ae.figure.ensureSlider(lyr, CG.ae.figure.EFF_RATIO, 1.0);
        lyr.property("ADBE Transform Group").property("ADBE Scale").expression = CG.ae.figure.scaleExpr(mode);
        count++;
    }
    return count;
};

CG.ae.figure.unlink = function (comp, layers) {
    var count = 0;
    var i;
    var sc;
    var v;
    for (i = 0; i < layers.length; i++) {
        sc = layers[i].property("ADBE Transform Group").property("ADBE Scale");
        if (sc.expression !== "") {
            // 式適用前の value に戻らないよう、解除前の実効値を保持する。
            v = sc.value;
            sc.expression = "";
            sc.setValue(v);
            count++;
        }
    }
    return count;
};

CG.ae.figure.anchorToBottom = function (comp, layers) {
    var count = 0;
    var i;
    var lyr;
    var tr;
    var anchorProp;
    var scaleProp;
    var posProp;
    var a0;
    var a1;
    var sc;
    var p0;
    var p1;
    for (i = 0; i < layers.length; i++) {
        lyr = layers[i];
        tr = lyr.property("ADBE Transform Group");
        anchorProp = tr.property("ADBE Anchor Point");
        scaleProp = tr.property("ADBE Scale");
        posProp = tr.property("ADBE Position");
        a0 = anchorProp.value;
        a1 = [lyr.width / 2, lyr.height];
        sc = scaleProp.value;
        p0 = posProp.value;
        p1 = [p0[0] + (a1[0] - a0[0]) * sc[0] / 100, p0[1] + (a1[1] - a0[1]) * sc[1] / 100];
        // 3D レイヤーは xyz 3 成分なので、z を保ったまま返す（成分数が違うと setValue が失敗する）
        if (a0.length > 2) { a1.push(a0[2]); p1.push(p0[2]); }
        // 回転なし前提。Scale に式がある場合も壊さないよう Scale 自体には触らない。
        anchorProp.setValue(a1);
        posProp.setValue(p1);
        count++;
    }
    return count;
};
// ===== end ae/figure.jsx =====
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
function _spiralOne(ctx, orientation) {
    var f = ctx.frame, l = ctx.layer;

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
}

CG.guides.spiral = function (ctx) {
    if (ctx.state.show_spiral_tl) { _spiralOne(ctx, "TL"); }
    if (ctx.state.show_spiral_tr) { _spiralOne(ctx, "TR"); }
    if (ctx.state.show_spiral_bl) { _spiralOne(ctx, "BL"); }
    if (ctx.state.show_spiral_br) { _spiralOne(ctx, "BR"); }
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
    // VP が frame 中心ちょうどのときは基準方向が定まらないが、atan2(0,0) === 0 で
    // +x 方向を基準に扇を張れば足りる。以前はここで return しており、既定の 1P
    // （VP横=0.5, 水平線高さ=0.5）でパース線が 1 本も出なかった
    var base = Math.atan2(dyRef, dxRef);

    // 4 隅への角度を base まわりに正規化して範囲を決める
    var corners = [
        [ab.x_min, ab.y_min], [ab.x_max, ab.y_min],
        [ab.x_max, ab.y_max], [ab.x_min, ab.y_max]
    ];
    var aMin = 1e9, aMax = -1e9;
    for (var c = 0; c < corners.length; c++) {
        var a = Math.atan2(corners[c][1] - vp[1], corners[c][0] - vp[0]);
        // base まわりの符号付き差 (-π, π]。JS の % は被除数が負だと負を返すため、
        // 一度正方向へ回してから -π する（base が ±π 近傍だと a-base+π が負に落ちて
        // 角度範囲が一周ぶん壊れる。既定の 2P 右 VP がまさにこれに当たっていた）
        var diff = (a - base + Math.PI) % (2 * Math.PI);
        if (diff < 0) { diff += 2 * Math.PI; }
        diff -= Math.PI;
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

CG.perspective._live = function (ctx) {
    var f = ctx.frame, l = ctx.layer, s = ctx.state;
    var hv = s.perspective_horizon_v;
    var n = Math.max(2, Math.round(s.perspective_lines));
    var keep = [];

    if (s.perspective_mode === "1P") {
        var nameP1 = CG.layer.ensureVP(f, "P1", CG.frame.uvToPoint(f, s.perspective_vp1_u, hv));
        keep.push(nameP1);
        CG.layer.addRaysLive(l, nameP1, n);
        if (s.perspective_show_vp_marker) { CG.layer.addVPMarkerLive(l, nameP1); }
        if (s.perspective_show_horizon) { CG.layer.addHorizonLive(l, nameP1, null); }
    } else {
        var nameL = CG.layer.ensureVP(f, "L", CG.frame.uvToPoint(f, 0.5 - s.perspective_vp_spread, hv));
        var nameR = CG.layer.ensureVP(f, "R", CG.frame.uvToPoint(f, 0.5 + s.perspective_vp_spread, hv));
        keep.push(nameL); keep.push(nameR);
        CG.layer.addRaysLive(l, nameL, n);
        CG.layer.addRaysLive(l, nameR, n);
        if (s.perspective_show_vp_marker) {
            CG.layer.addVPMarkerLive(l, nameL);
            CG.layer.addVPMarkerLive(l, nameR);
        }

        if (s.perspective_mode === "3P") {
            var nameV3 = CG.layer.ensureVP(f, "V3", CG.frame.uvToPoint(f, 0.5, hv + s.perspective_vp3_dist));
            keep.push(nameV3);
            CG.layer.addRaysLive(l, nameV3, n);
            if (s.perspective_show_vp_marker) { CG.layer.addVPMarkerLive(l, nameV3); }
        }

        if (s.perspective_show_horizon) { CG.layer.addHorizonLive(l, nameL, nameR); }
    }

    // ponytail: keep はこのフレームの VP のみ。複数フレーム × live VP が同時に
    // 成立するバックエンドができたら、後のフレームが前のフレームの VP ヌルを消す。
    // 現状 live VP は AE 専用で AE は常に 1 フレームのため到達しない。
    CG.layer.pruneVP(f, keep);
};

CG.guides.perspective = function (ctx) {
    var f = ctx.frame, l = ctx.layer, s = ctx.state;
    var live = !!(s.perspective_live_vp && CG.layer.perspectiveLive);
    if (live) {
        CG.perspective._live(ctx);
        return;
    }
    if (CG.layer.pruneVP) { CG.layer.pruneVP(f, []); }
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

// 1 フレーム分のガイドを描く。frame / layer / state を受け取る。
CG._drawFrame = function (frame, layer, state) {
    var ctx = { frame: frame, layer: layer, state: state };

    // 構図ガイド
    if (state.show_thirds)         { CG.guides.thirds(ctx); }
    if (state.show_golden)         { CG.guides.golden(ctx); }
    if (state.show_diagonal)       { CG.guides.diagonal(ctx); }
    if (state.show_center)         { CG.guides.center(ctx); }
    if (state.show_triangle)       { CG.guides.triangle(ctx); }
    if (state.show_golden_section) { CG.guides.golden_section(ctx); }

    // 絵画構図

    // Phase 2: パラメトリック
    if (state.show_spiral_tl || state.show_spiral_tr || state.show_spiral_bl || state.show_spiral_br) { CG.guides.spiral(ctx); }
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
    else if (CG.layer.pruneVP)      { CG.layer.pruneVP(frame, []); }   // AE: パース OFF なら VP ヌルも掃除

    // 枠
    if (state.show_frame)          { CG.guides.frame_border(ctx); }
};

// doc: IL=Document / AE=CompItem。基準フレーム取得とレイヤー生成はバックエンドが担う。
// 戻り値: 単一フレームならその index、複数フレーム（全アートボード）なら -2。
CG.generate = function (doc, state) {
    var frames = CG.frame.list(doc, state);
    var layer = CG.layer.recreate(doc);
    if (CG.dedup) { CG.dedup.reset(); }          // AE では未ロード = no-op
    for (var i = 0; i < frames.length; i++) {
        CG._drawFrame(frames[i], layer, state);
    }
    CG.layer.finalize(layer);
    CG.host.redraw();
    // -2 = 「全アートボードモードで生成した」。frames.length で判定すると
    // アートボードが 1 枚の文書で「すべて」を選んだときに UI の文言がずれる
    return (state.artboard_index === -2) ? -2 : frames[0].index;
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
// チェック/数値/ドロップダウンの変更は即 CG.run.generate(state) で反映する
// （ドック高さ不足でボタンに届かなくても操作できるようにするため）。

CG.ui = {};

CG.ui.build = function (thisObj, state) {
    var pal = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "構図ガイド / Composition Guides", undefined, { resizeable: true });

    pal.orientation = "column";
    pal.alignChildren = ["fill", "top"];
    pal.spacing = 6;
    pal.margins = 8;

    function regenerate() { CG.run.generate(state); }

    // --- 共通ビルダ（変更のたびに自動生成・更新） ---
    function checkRow(parent, key, label) {
        var cb = parent.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; regenerate(); };
        return cb;
    }

    function numField(row, numKey, isInt, chars, wheelStep) {
        var et = row.add("edittext", undefined, "" + state[numKey]);
        et.characters = chars || 4;
        et.onChange = function () {
            var v = parseFloat(this.text);
            if (isNaN(v)) { this.text = "" + state[numKey]; return; }
            if (isInt) { v = Math.round(v); }
            state[numKey] = v;
            this.text = "" + v;
            regenerate();
        };
        if (wheelStep) {
            try {
                et.addEventListener("mousewheel", function (ev) {
                    var delta = (ev.wheelDelta > 0) ? 1 : -1;
                    var v = Math.max(0, Math.min(1, state[numKey] + delta * wheelStep));
                    state[numKey] = v;
                    this.text = "" + v;
                    regenerate();
                    if (ev.preventDefault) { ev.preventDefault(); }
                });
            } catch (e) { /* mousewheel 未対応ホストでは無視 */ }
        }
        return et;
    }

    function numRow(parent, key, label, numKey, isInt, wheelStep) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var cb = row.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; regenerate(); };
        numField(row, numKey, isInt, 5, wheelStep);
        return row;
    }

    function cbDropRow(parent, key, label, items, getIndex, setByIndex) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        var cb = row.add("checkbox", undefined, label);
        cb.value = state[key];
        cb.onClick = function () { state[key] = this.value; regenerate(); };
        var dd = row.add("dropdownlist", undefined, items);
        dd.selection = getIndex();
        dd.onChange = function () { setByIndex(this.selection.index); regenerate(); };
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

    // ===== タブ1: 構図 / Composition =====
    var tabA = tabs.add("tab", undefined, "構図 / Composition");
    tabA.orientation = "column";
    tabA.alignChildren = ["fill", "top"];
    tabA.margins = 8;

    checkRow(tabA, "show_thirds", "三分割 / Rule of Thirds");
    checkRow(tabA, "show_golden", "黄金比 / Golden Ratio");
    checkRow(tabA, "show_diagonal", "対角線 / Diagonal");
    checkRow(tabA, "show_center", "中央十字 / Center Cross");
    checkRow(tabA, "show_golden_section", "黄金分割 / Golden Section");

    // 三角構図（向き付き）
    cbDropRow(tabA, "show_triangle", "三角構図 / Triangle",
        ["TL→BR", "TR→BL"],
        function () { return (state.triangle_orientation === "TL_BR") ? 0 : 1; },
        function (idx) { state.triangle_orientation = (idx === 0) ? "TL_BR" : "TR_BL"; });

    // 黄金螺旋（4方向独立・2×2グリッド）
    var spiralRow1 = tabA.add("group");
    spiralRow1.orientation = "row";
    spiralRow1.alignChildren = ["left", "center"];
    checkRow(spiralRow1, "show_spiral_tl", "螺旋 左上 TL");
    checkRow(spiralRow1, "show_spiral_tr", "螺旋 右上 TR");
    var spiralRow2 = tabA.add("group");
    spiralRow2.orientation = "row";
    spiralRow2.alignChildren = ["left", "center"];
    checkRow(spiralRow2, "show_spiral_bl", "螺旋 左下 BL");
    checkRow(spiralRow2, "show_spiral_br", "螺旋 右下 BR");

    // ===== タブ2: 絵画 / Painting =====
    var tabB = tabs.add("tab", undefined, "絵画 / Painting");
    tabB.orientation = "column";
    tabB.alignChildren = ["fill", "top"];
    tabB.margins = 8;

    numRow(tabB, "show_horizontal_line", "水平線 / Horizontal（高さ 0..1）", "horizontal_pos", false, 0.01);
    numRow(tabB, "show_vertical_line", "垂直線 / Vertical（位置 0..1）", "vertical_pos", false, 0.01);

    // 斜線（角度・本数・拡がり）
    var slRow = tabB.add("group");
    slRow.orientation = "row";
    slRow.alignChildren = ["left", "center"];
    var slCb = slRow.add("checkbox", undefined, "斜線");
    slCb.value = state.show_slanted;
    slCb.onClick = function () { state.show_slanted = this.value; regenerate(); };
    slRow.add("statictext", undefined, "角度"); numField(slRow, "slanted_angle_deg", false, 4);
    slRow.add("statictext", undefined, "本数"); numField(slRow, "slanted_count", true, 3);
    slRow.add("statictext", undefined, "拡がり"); numField(slRow, "slanted_spread", false, 4);

    // パターン（列 x 行）
    var ptRow = tabB.add("group");
    ptRow.orientation = "row";
    ptRow.alignChildren = ["left", "center"];
    var ptCb = ptRow.add("checkbox", undefined, "パターン");
    ptCb.value = state.show_pattern;
    ptCb.onClick = function () { state.show_pattern = this.value; regenerate(); };
    ptRow.add("statictext", undefined, "列"); numField(ptRow, "pattern_cols", true, 3);
    ptRow.add("statictext", undefined, "行"); numField(ptRow, "pattern_rows", true, 3);

    numRow(tabB, "show_bullseye", "日の丸 / Bullseye（同心円数）", "bullseye_rings", true);

    // ===== タブ3: 領域・枠 / Area & Frame =====
    var tabC = tabs.add("tab", undefined, "領域・枠 / Area & Frame");
    tabC.orientation = "column";
    tabC.alignChildren = ["fill", "top"];
    tabC.margins = 8;

    // セーフエリア（Action / Title）
    var saRow = tabC.add("group");
    saRow.orientation = "row";
    saRow.alignChildren = ["left", "center"];
    var saCb = saRow.add("checkbox", undefined, "セーフエリア");
    saCb.value = state.show_safe_area;
    saCb.onClick = function () { state.show_safe_area = this.value; regenerate(); };
    saRow.add("statictext", undefined, "Action"); numField(saRow, "safe_action", false, 4);
    saRow.add("statictext", undefined, "Title"); numField(saRow, "safe_title", false, 4);

    // アスペクトマスク
    var asRow = tabC.add("group");
    asRow.orientation = "row";
    asRow.alignChildren = ["left", "center"];
    var asCb = asRow.add("checkbox", undefined, "アスペクト");
    asCb.value = state.show_aspect;
    asCb.onClick = function () { state.show_aspect = this.value; regenerate(); };
    var asKeys = ["1_1", "9_16", "16_9", "4_3", "21_9", "CUSTOM"];
    var asItems = ["1:1", "9:16", "16:9", "4:3", "21:9", "カスタム"];
    var asDrop = asRow.add("dropdownlist", undefined, asItems);
    var asSel = 0;
    for (var ai = 0; ai < asKeys.length; ai++) { if (asKeys[ai] === state.aspect_ratio) { asSel = ai; } }
    asDrop.selection = asSel;
    asDrop.onChange = function () { state.aspect_ratio = asKeys[this.selection.index]; regenerate(); };
    asRow.add("statictext", undefined, "W"); numField(asRow, "aspect_custom_w", false, 4);
    asRow.add("statictext", undefined, "H"); numField(asRow, "aspect_custom_h", false, 4);

    checkRow(tabC, "show_frame", "フレーム外周 / Frame Border");

    // ===== タブ4: パース / Perspective =====
    var tabD = tabs.add("tab", undefined, "パース / Perspective");
    tabD.orientation = "column";
    tabD.alignChildren = ["fill", "top"];
    tabD.margins = 8;

    var peTop = tabD.add("group");
    peTop.orientation = "row";
    peTop.alignChildren = ["left", "center"];
    var peCb = peTop.add("checkbox", undefined, "パース線を表示");
    peCb.value = state.show_perspective;
    peCb.onClick = function () { state.show_perspective = this.value; regenerate(); };
    peTop.add("statictext", undefined, "点数");
    var peMode = peTop.add("dropdownlist", undefined, ["1点 / 1P", "2点 / 2P", "3点 / 3P"]);
    peMode.selection = (state.perspective_mode === "1P") ? 0 : (state.perspective_mode === "2P") ? 1 : 2;
    peMode.onChange = function () { state.perspective_mode = ["1P", "2P", "3P"][this.selection.index]; regenerate(); };

    var peR1 = tabD.add("group");
    peR1.orientation = "row";
    peR1.alignChildren = ["left", "center"];
    peR1.add("statictext", undefined, "水平線高さ"); numField(peR1, "perspective_horizon_v", false, 4);
    peR1.add("statictext", undefined, "放射本数"); numField(peR1, "perspective_lines", true, 3);

    var peR2 = tabD.add("group");
    peR2.orientation = "row";
    peR2.alignChildren = ["left", "center"];
    peR2.add("statictext", undefined, "VP横(1P)"); numField(peR2, "perspective_vp1_u", false, 4);
    peR2.add("statictext", undefined, "拡がり(2P)"); numField(peR2, "perspective_vp_spread", false, 4);
    peR2.add("statictext", undefined, "垂直VP(3P)"); numField(peR2, "perspective_vp3_dist", false, 4);

    var peR3 = tabD.add("group");
    peR3.orientation = "row";
    peR3.alignChildren = ["left", "center"];
    var peMk = peR3.add("checkbox", undefined, "VPマーカー");
    peMk.value = state.perspective_show_vp_marker;
    peMk.onClick = function () { state.perspective_show_vp_marker = this.value; regenerate(); };
    var peHz = peR3.add("checkbox", undefined, "水平線");
    peHz.value = state.perspective_show_horizon;
    peHz.onClick = function () { state.perspective_show_horizon = this.value; regenerate(); };

    var peR4 = tabD.add("group");
    peR4.orientation = "row";
    peR4.alignChildren = ["left", "center"];
    var peLive = peR4.add("checkbox", undefined, "VP をヌルで調整（ライブ）");
    peLive.value = state.perspective_live_vp;
    peLive.onClick = function () { state.perspective_live_vp = this.value; regenerate(); };
    var peReset = peR4.add("button", undefined, "VP をリセット");
    peReset.onClick = function () { CG.run.resetVP(state); };

    // ===== タブ5: 人物 / Figure =====
    var tabE = tabs.add("tab", undefined, "人物 / Figure");
    tabE.orientation = "column";
    tabE.alignChildren = ["fill", "top"];
    tabE.margins = 8;

    var figureHelp = tabE.add("statictext", undefined,
        "① イラストを写真の 1 箇所で目で合わせる\n"
        + "② 「基準にする」でその位置とサイズを記録\n"
        + "③ 「スケール連動」で以後は上下移動だけでサイズが追従",
        { multiline: true });
    figureHelp.alignment = ["fill", "top"];

    var figSetRef = tabE.add("button", undefined, "選択レイヤーを基準にする");
    figSetRef.alignment = ["fill", "top"];
    figSetRef.onClick = function () { CG.run.figureSetRef(state); };

    var figLink = tabE.add("button", undefined, "選択レイヤーをスケール連動");
    figLink.alignment = ["fill", "top"];
    figLink.onClick = function () { CG.run.figureLink(state); };

    var figUnlink = tabE.add("button", undefined, "連動を解除");
    figUnlink.alignment = ["fill", "top"];
    figUnlink.onClick = function () { CG.run.figureUnlink(); };

    var figAnchor = tabE.add("button", undefined, "アンカーを下端中央へ");
    figAnchor.alignment = ["fill", "top"];
    figAnchor.onClick = function () { CG.run.figureAnchorBottom(); };

    tabs.selection = tabA;

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
