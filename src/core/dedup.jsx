// Composition Guides for Illustrator
// dedup.jsx — 同一ジオメトリの重複ガイドを 1 本に畳む
//
// src/ae/layer.jsx は対象外。AE は 1 コンポ = 1 フレームで被りが起きないため。
// キーの先頭を "L" / "P" / "E" にするのは、_seen がプレーンオブジェクトなので
// "constructor" 等の Object.prototype プロパティ名と衝突させないため。

CG.dedup = {};

CG.dedup._seen = {};

CG.dedup.reset = function () {
    CG.dedup._seen = {};
};

// 座標を 0.01 単位に量子化する。
function _q(v) {
    return Math.round(v * 100) / 100;
}

CG.dedup.claim = function (key) {
    if (CG.dedup._seen[key]) {
        return false;
    }
    CG.dedup._seen[key] = true;
    return true;
};

CG.dedup.segKey = function (p0, p1) {
    var x0 = _q(p0[0]);
    var y0 = _q(p0[1]);
    var x1 = _q(p1[0]);
    var y1 = _q(p1[1]);
    var swap = (x0 > x1) || (x0 === x1 && y0 > y1);
    if (swap) {
        var tx = x0;
        var ty = y0;
        x0 = x1;
        y0 = y1;
        x1 = tx;
        y1 = ty;
    }
    return "L" + x0 + "," + y0 + "|" + x1 + "," + y1;
};

CG.dedup.ptsKey = function (pts, closed) {
    // ponytail: 頂点順が一致するものだけ同一視する。逆順の同一形状は別扱い。実害が出たら正規化を足す。
    var key = "P";
    for (var i = 0; i < pts.length; i++) {
        if (i > 0) {
            key += "|";
        }
        key += _q(pts[i][0]) + "," + _q(pts[i][1]);
    }
    return key + "|" + (closed ? "true" : "false");
};

CG.dedup.ellipseKey = function (cx, cy, rx, ry) {
    return "E" + _q(cx) + "," + _q(cy) + "|" + _q(rx) + "," + _q(ry);
};

CG.dedup.selfCheck = function () {
    CG.dedup.reset();
    var failures = [];
    var keyA = CG.dedup.segKey([0, 0], [10, 5]);
    var keyB = CG.dedup.segKey([10, 5], [0, 0]);
    var keyC = CG.dedup.segKey([0, 0], [10, 6]);
    var keyD = CG.dedup.segKey([0.001, 0], [10, 5]);

    if (keyA !== keyB) {
        failures.push("項目 1: 線分キーが端点順に依存しています");
    }
    if (keyA === keyC) {
        failures.push("項目 2: 異なる線分が同じキーになっています");
    }

    CG.dedup.reset();
    if (!CG.dedup.claim(keyA) || CG.dedup.claim(keyA)) {
        failures.push("項目 3: claim の既出判定が正しくありません");
    }

    if (keyA !== keyD) {
        failures.push("項目 4: 量子化未満の座標差が同一視されません");
    }

    CG.dedup.reset();
    var ptsKey = CG.dedup.ptsKey([[0, 0], [10, 5], [5, 10]], true);
    if (!CG.dedup.claim(ptsKey) || CG.dedup.claim(ptsKey)) {
        failures.push("項目 5: ptsKey の既出判定が正しくありません");
    }
    // 形状が違えばキーも違うこと。これを見ないと、ptsKey が定数を返しても
    // 項目 5 は通る（全ポリラインが 1 本に潰れても検出できない）
    if (ptsKey === CG.dedup.ptsKey([[0, 0], [10, 5], [5, 11]], true)) {
        failures.push("項目 6: 異なる頂点列が同じ ptsKey になっています");
    }
    if (ptsKey === CG.dedup.ptsKey([[0, 0], [10, 5], [5, 10]], false)) {
        failures.push("項目 7: closed の違いが ptsKey に反映されていません");
    }

    CG.dedup.reset();
    var ellipseKey = CG.dedup.ellipseKey(10, 20, 5, 3);
    if (!CG.dedup.claim(ellipseKey) || CG.dedup.claim(ellipseKey)) {
        failures.push("項目 8: ellipseKey の既出判定が正しくありません");
    }
    // 同上。ellipseKey が定数を返しても項目 8 は通ってしまう
    if (ellipseKey === CG.dedup.ellipseKey(10, 20, 5, 4)) {
        failures.push("項目 9: 異なる半径が同じ ellipseKey になっています");
    }
    if (ellipseKey === CG.dedup.ellipseKey(11, 20, 5, 3)) {
        failures.push("項目 10: 異なる中心が同じ ellipseKey になっています");
    }

    CG.dedup.reset();
    if (failures.length === 0) {
        return "OK";
    }
    return failures.join(" / ");
};
