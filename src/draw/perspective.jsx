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
