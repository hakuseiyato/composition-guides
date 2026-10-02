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
