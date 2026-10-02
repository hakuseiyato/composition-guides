// Composition Guides — Premiere Pro 版 スモークテスト（node 用）
//
// build 済みの cep_ppro/js/engine.js を vm で読み込み、記録するだけの偽 canvas に
// CG.generate で描かせて、例外が出ないこと・y 反転（数学座標 → canvas 座標）・
// 楕円の中心と半径・矩形の閉路・線の設定・放射線の本数を検査する。
//
// 使い方: node tools\ppro-smoke.js （事前に pwsh -File build.ps1）

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var code = fs.readFileSync(path.join(__dirname, "..", "cep_ppro", "js", "engine.js"), "utf8");
if (code.charCodeAt(0) === 0xFEFF) { code = code.slice(1); }
var sandbox = {};
vm.runInNewContext(code, sandbox);
var CG = sandbox.CG;

// --- 偽 canvas（呼び出しを記録するだけ） ---------------------------------
var calls = [];
function rec(name) {
    return function () { calls.push({ op: name, args: Array.prototype.slice.call(arguments) }); };
}
var ctx = {
    beginPath: rec("beginPath"),
    moveTo: rec("moveTo"),
    lineTo: rec("lineTo"),
    closePath: rec("closePath"),
    stroke: rec("stroke"),
    ellipse: rec("ellipse"),
    arc: rec("arc"),
    clearRect: rec("clearRect"),
    rect: rec("rect"),
    fill: rec("fill"),
    save: rec("save"),
    restore: rec("restore")
};
var canvas = { width: 0, height: 0, getContext: function () { return ctx; } };

function strokeCount() {
    var n = 0;
    for (var i = 0; i < calls.length; i++) { if (calls[i].op === "stroke") { n++; } }
    return n;
}

// moveTo→lineTo の連続から隣接 2 点ずつの線分を取り出す（closePath なら始点へ戻る線分も）
function segments() {
    var segs = [];
    var start = null, cur = null;
    for (var i = 0; i < calls.length; i++) {
        var c = calls[i];
        if (c.op === "beginPath") { start = null; cur = null; }
        else if (c.op === "moveTo") { start = [c.args[0], c.args[1]]; cur = start; }
        else if (c.op === "lineTo") {
            var p = [c.args[0], c.args[1]];
            if (cur) { segs.push([cur, p]); }
            cur = p;
        } else if (c.op === "closePath") {
            if (cur && start) { segs.push([cur, start]); cur = start; }
        }
    }
    return segs;
}

function near(a, b) { return Math.abs(a - b) < 1e-6; }
function samePt(p, q) { return near(p[0], q[0]) && near(p[1], q[1]); }
function hasSeg(segs, a, b) {
    for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if ((samePt(s[0], a) && samePt(s[1], b)) || (samePt(s[0], b) && samePt(s[1], a))) { return true; }
    }
    return false;
}

// 全 show_* を v にした state
function stateAll(v) {
    var s = CG.defaults();
    for (var k in s) {
        if (s.hasOwnProperty(k) && k.indexOf("show_") === 0) { s[k] = v; }
    }
    return s;
}

function run(state, w, h) {
    calls = [];
    CG.generate({ width: w || 1920, height: h || 1080, canvas: canvas }, state);
}

function opCalls(name) {
    var r = [];
    for (var i = 0; i < calls.length; i++) { if (calls[i].op === name) { r.push(calls[i].args); } }
    return r;
}

var failures = 0;
function fail(msg) { failures++; console.error("NG: " + msg); }

// --- テスト 1: 全ガイド ON で 1P/2P/3P が通る -----------------------------
var modes = ["1P", "2P", "3P"];
for (var m = 0; m < modes.length; m++) {
    var s1 = stateAll(true);
    s1.perspective_mode = modes[m];
    try {
        run(s1);
        if (strokeCount() <= 0) { fail("全ガイド ON（" + modes[m] + "）で stroke が 1 回も呼ばれていません"); }
        if (canvas.width !== 1920 || canvas.height !== 1080) {
            fail("全ガイド ON（" + modes[m] + "）で canvas サイズが 1920×1080 ではありません: " + canvas.width + "×" + canvas.height);
        }
    } catch (e) {
        fail("全ガイド ON（" + modes[m] + "）で例外: " + (e && e.stack ? e.stack : e));
    }
}

// --- テスト 2: 中央十字 ---------------------------------------------------
try {
    var s2 = stateAll(false);
    s2.show_center = true;
    run(s2);
    var segs2 = segments();
    if (!hasSeg(segs2, [960, 0], [960, 1080])) { fail("中央十字の垂直線 (960,0)-(960,1080) がありません"); }
    if (!hasSeg(segs2, [0, 540], [1920, 540])) { fail("中央十字の水平線 (0,540)-(1920,540) がありません"); }
} catch (e2) {
    fail("中央十字で例外: " + (e2 && e2.stack ? e2.stack : e2));
}

// --- テスト 3: y 反転（horizontal_pos は 0=下端） -------------------------
try {
    var s3 = stateAll(false);
    s3.show_horizontal_line = true;
    s3.horizontal_pos = 0.25;
    run(s3);
    var segs3 = segments();
    if (!hasSeg(segs3, [0, 810], [1920, 810])) { fail("水平線 (0,810)-(1920,810) がありません（y 反転の誤り）"); }
    if (hasSeg(segs3, [0, 270], [1920, 270])) { fail("水平線が y=270 に描かれています（y 反転されていません）"); }
} catch (e3) {
    fail("水平線で例外: " + (e3 && e3.stack ? e3.stack : e3));
}

// 以下は非正方形（1000×701）で検査する。正方形・16:9 固定だと rx/ry や w/h の取り違えを見逃すため

// --- テスト 4: 日の丸の楕円（中心・半径・角度） ---------------------------
try {
    var s4 = stateAll(false);
    s4.show_bullseye = true;
    s4.bullseye_rings = 2;
    run(s4, 1000, 701);
    var el = opCalls("ellipse");
    // 中心は数学座標 (500, 350.5) → canvas y = 701 - 350.5。半径は UV 0.225 / 0.45 × w, h
    var want = [[0.225 * 1000, 0.225 * 701], [0.45 * 1000, 0.45 * 701]];
    if (el.length !== 2) { fail("日の丸の楕円が 2 個ではありません: " + el.length); }
    for (var q = 0; q < el.length && q < 2; q++) {
        var a = el[q];
        if (!near(a[0], 500) || !near(a[1], 701 - 350.5)) { fail("楕円 " + q + " の中心が (500,350.5) ではありません: " + a[0] + "," + a[1]); }
        if (!near(a[2], want[q][0]) || !near(a[3], want[q][1])) { fail("楕円 " + q + " の半径が " + want[q] + " ではありません: " + a[2] + "," + a[3]); }
        if (!near(a[4], 0) || !near(a[5], 0) || !near(a[6], 2 * Math.PI)) { fail("楕円 " + q + " が 1 周になっていません"); }
    }
} catch (e4) {
    fail("日の丸で例外: " + (e4 && e4.stack ? e4.stack : e4));
}

// --- テスト 5: フレーム外周（閉路・4 隅） ---------------------------------
try {
    var s5 = stateAll(false);
    s5.show_frame = true;
    run(s5, 1000, 701);
    var segs5 = segments();
    var edges = [[[0, 0], [1000, 0]], [[1000, 0], [1000, 701]], [[1000, 701], [0, 701]], [[0, 701], [0, 0]]];
    for (var ed = 0; ed < edges.length; ed++) {
        if (!hasSeg(segs5, edges[ed][0], edges[ed][1])) { fail("フレーム外周の辺 " + edges[ed][0] + "-" + edges[ed][1] + " がありません（閉路・頂点の欠落）"); }
    }
} catch (e5) {
    fail("フレーム外周で例外: " + (e5 && e5.stack ? e5.stack : e5));
}

// --- テスト 6: 線の見た目とパース放射線の本数 -----------------------------
try {
    var s6 = stateAll(false);
    s6.show_perspective = true;
    s6.perspective_mode = "1P";
    s6.perspective_lines = 12;
    s6.perspective_show_vp_marker = false;
    s6.perspective_show_horizon = false;
    run(s6, 1000, 701);
    if (ctx.lineWidth !== CG.STROKE_WIDTH || !(ctx.lineWidth > 0)) { fail("lineWidth が STROKE_WIDTH ではありません: " + ctx.lineWidth); }
    if (ctx.strokeStyle !== "rgb(0,255,255)") { fail("strokeStyle がシアンではありません: " + ctx.strokeStyle); }
    // VP がフレーム内（中央）なら 12 本すべてがフレーム内に残る
    if (strokeCount() !== 12) { fail("1P 放射線が 12 本ではありません: " + strokeCount()); }
} catch (e6) {
    fail("パース線で例外: " + (e6 && e6.stack ? e6.stack : e6));
}

if (failures > 0) {
    console.error("失敗: " + failures + " 件");
    process.exit(1);
}
console.log("OK");
